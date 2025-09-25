/**
 * AuditLogService - Creates audit logging for compliance requirements
 * Tracks user actions, data access, and system events for security and compliance
 */

class AuditLogService {
  constructor() {
    this.logBuffer = [];
    this.maxBufferSize = 1000;
    this.storageKey = 'teams_transcription_audit_logs';
    this.sessionId = this.generateSessionId();
    this.userId = null;
    this.logLevels = {
      INFO: 'info',
      WARNING: 'warning',
      ERROR: 'error',
      SECURITY: 'security',
      COMPLIANCE: 'compliance'
    };
    
    this.eventTypes = {
      // Authentication and Authorization
      LOGIN: 'user_login',
      LOGOUT: 'user_logout',
      PERMISSION_GRANTED: 'permission_granted',
      PERMISSION_DENIED: 'permission_denied',
      
      // Data Access
      DATA_READ: 'data_read',
      DATA_WRITE: 'data_write',
      DATA_DELETE: 'data_delete',
      DATA_EXPORT: 'data_export',
      
      // Configuration Changes
      CONFIG_CHANGE: 'config_change',
      PRIVACY_SETTING_CHANGE: 'privacy_setting_change',
      RETENTION_POLICY_CHANGE: 'retention_policy_change',
      
      // Consent Management
      CONSENT_GRANTED: 'consent_granted',
      CONSENT_REVOKED: 'consent_revoked',
      CONSENT_EXPIRED: 'consent_expired',
      
      // Transcription Activities
      TRANSCRIPTION_STARTED: 'transcription_started',
      TRANSCRIPTION_STOPPED: 'transcription_stopped',
      TRANSCRIPT_CREATED: 'transcript_created',
      TRANSCRIPT_SHARED: 'transcript_shared',
      
      // Security Events
      ENCRYPTION_KEY_GENERATED: 'encryption_key_generated',
      DECRYPTION_ATTEMPTED: 'decryption_attempted',
      SECURITY_VIOLATION: 'security_violation',
      
      // System Events
      SYSTEM_ERROR: 'system_error',
      SERVICE_FAILURE: 'service_failure',
      DATA_CLEANUP: 'data_cleanup'
    };

    this.initializeFromStorage();
  }

  /**
   * Set current user ID for audit logging
   * @param {string} userId - User identifier
   */
  setUserId(userId) {
    this.userId = userId;
    this.logEvent(this.eventTypes.LOGIN, {
      userId: userId,
      sessionId: this.sessionId
    }, this.logLevels.INFO);
  }

  /**
   * Log an audit event
   * @param {string} eventType - Type of event
   * @param {object} eventData - Event-specific data
   * @param {string} level - Log level
   * @param {object} context - Additional context
   */
  logEvent(eventType, eventData = {}, level = this.logLevels.INFO, context = {}) {
    const logEntry = {
      id: this.generateLogId(),
      timestamp: Date.now(),
      sessionId: this.sessionId,
      userId: this.userId,
      eventType: eventType,
      level: level,
      data: { ...eventData },
      context: {
        userAgent: navigator.userAgent,
        url: window.location.href,
        ...context
      },
      ipAddress: this.getClientIP(),
      version: '1.0'
    };

    // Add to buffer
    this.logBuffer.push(logEntry);

    // Maintain buffer size
    if (this.logBuffer.length > this.maxBufferSize) {
      this.logBuffer.shift();
    }

    // Persist to storage
    this.persistLogs();

    // Log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.log('Audit Log:', logEntry);
    }
  }

  /**
   * Log data access event
   * @param {string} action - Action performed (read, write, delete)
   * @param {string} dataType - Type of data accessed
   * @param {string} dataId - Identifier of data accessed
   * @param {object} metadata - Additional metadata
   */
  logDataAccess(action, dataType, dataId, metadata = {}) {
    const eventType = action === 'read' ? this.eventTypes.DATA_READ :
                     action === 'write' ? this.eventTypes.DATA_WRITE :
                     action === 'delete' ? this.eventTypes.DATA_DELETE :
                     this.eventTypes.DATA_READ;

    this.logEvent(eventType, {
      action: action,
      dataType: dataType,
      dataId: dataId,
      ...metadata
    }, this.logLevels.INFO);
  }

  /**
   * Log configuration change
   * @param {string} configKey - Configuration key changed
   * @param {any} oldValue - Previous value
   * @param {any} newValue - New value
   * @param {string} changeReason - Reason for change
   */
  logConfigChange(configKey, oldValue, newValue, changeReason = '') {
    this.logEvent(this.eventTypes.CONFIG_CHANGE, {
      configKey: configKey,
      oldValue: this.sanitizeValue(oldValue),
      newValue: this.sanitizeValue(newValue),
      changeReason: changeReason
    }, this.logLevels.INFO);
  }

  /**
   * Log privacy setting change
   * @param {string} setting - Privacy setting changed
   * @param {boolean} enabled - Whether setting was enabled
   * @param {object} details - Additional details
   */
  logPrivacyChange(setting, enabled, details = {}) {
    this.logEvent(this.eventTypes.PRIVACY_SETTING_CHANGE, {
      setting: setting,
      enabled: enabled,
      ...details
    }, this.logLevels.COMPLIANCE);
  }

  /**
   * Log consent event
   * @param {string} action - Action (granted, revoked, expired)
   * @param {string} consentType - Type of consent
   * @param {object} consentDetails - Consent details
   */
  logConsentEvent(action, consentType, consentDetails = {}) {
    const eventType = action === 'granted' ? this.eventTypes.CONSENT_GRANTED :
                     action === 'revoked' ? this.eventTypes.CONSENT_REVOKED :
                     this.eventTypes.CONSENT_EXPIRED;

    this.logEvent(eventType, {
      consentType: consentType,
      action: action,
      ...consentDetails
    }, this.logLevels.COMPLIANCE);
  }

  /**
   * Log transcription activity
   * @param {string} action - Action (started, stopped, created, shared)
   * @param {string} meetingId - Meeting identifier
   * @param {object} details - Activity details
   */
  logTranscriptionActivity(action, meetingId, details = {}) {
    const eventType = action === 'started' ? this.eventTypes.TRANSCRIPTION_STARTED :
                     action === 'stopped' ? this.eventTypes.TRANSCRIPTION_STOPPED :
                     action === 'created' ? this.eventTypes.TRANSCRIPT_CREATED :
                     this.eventTypes.TRANSCRIPT_SHARED;

    this.logEvent(eventType, {
      meetingId: meetingId,
      action: action,
      ...details
    }, this.logLevels.INFO);
  }

  /**
   * Log security event
   * @param {string} eventType - Security event type
   * @param {object} securityData - Security-related data
   * @param {string} severity - Severity level
   */
  logSecurityEvent(eventType, securityData = {}, severity = 'medium') {
    this.logEvent(eventType, {
      severity: severity,
      ...securityData
    }, this.logLevels.SECURITY);
  }

  /**
   * Log system error
   * @param {Error} error - Error object
   * @param {string} component - Component where error occurred
   * @param {object} context - Error context
   */
  logSystemError(error, component, context = {}) {
    this.logEvent(this.eventTypes.SYSTEM_ERROR, {
      errorMessage: error.message,
      errorStack: error.stack,
      component: component,
      ...context
    }, this.logLevels.ERROR);
  }

  /**
   * Get audit logs with filtering
   * @param {object} filters - Filter criteria
   * @returns {Array} Filtered audit logs
   */
  getAuditLogs(filters = {}) {
    let logs = [...this.logBuffer];

    // Apply filters
    if (filters.eventType) {
      logs = logs.filter(log => log.eventType === filters.eventType);
    }

    if (filters.level) {
      logs = logs.filter(log => log.level === filters.level);
    }

    if (filters.userId) {
      logs = logs.filter(log => log.userId === filters.userId);
    }

    if (filters.startTime) {
      logs = logs.filter(log => log.timestamp >= filters.startTime);
    }

    if (filters.endTime) {
      logs = logs.filter(log => log.timestamp <= filters.endTime);
    }

    if (filters.dataType) {
      logs = logs.filter(log => log.data.dataType === filters.dataType);
    }

    // Sort by timestamp (newest first)
    logs.sort((a, b) => b.timestamp - a.timestamp);

    return logs;
  }

  /**
   * Export audit logs for compliance
   * @param {object} filters - Export filters
   * @returns {object} Audit log export
   */
  exportAuditLogs(filters = {}) {
    const logs = this.getAuditLogs(filters);
    
    return {
      version: '1.0',
      exportedAt: Date.now(),
      exportedBy: this.userId,
      sessionId: this.sessionId,
      filters: filters,
      totalLogs: logs.length,
      logs: logs.map(log => ({
        ...log,
        // Remove sensitive data from export
        context: {
          ...log.context,
          userAgent: log.context.userAgent ? 'redacted' : undefined
        }
      }))
    };
  }

  /**
   * Generate compliance report
   * @param {number} startTime - Report start time
   * @param {number} endTime - Report end time
   * @returns {object} Compliance report
   */
  generateComplianceReport(startTime, endTime) {
    const logs = this.getAuditLogs({ startTime, endTime });
    
    const report = {
      reportPeriod: {
        startTime: startTime,
        endTime: endTime,
        duration: endTime - startTime
      },
      summary: {
        totalEvents: logs.length,
        securityEvents: logs.filter(log => log.level === this.logLevels.SECURITY).length,
        complianceEvents: logs.filter(log => log.level === this.logLevels.COMPLIANCE).length,
        errorEvents: logs.filter(log => log.level === this.logLevels.ERROR).length,
        dataAccessEvents: logs.filter(log => 
          log.eventType === this.eventTypes.DATA_READ ||
          log.eventType === this.eventTypes.DATA_WRITE ||
          log.eventType === this.eventTypes.DATA_DELETE
        ).length
      },
      consentEvents: logs.filter(log => 
        log.eventType === this.eventTypes.CONSENT_GRANTED ||
        log.eventType === this.eventTypes.CONSENT_REVOKED ||
        log.eventType === this.eventTypes.CONSENT_EXPIRED
      ),
      privacyEvents: logs.filter(log => 
        log.eventType === this.eventTypes.PRIVACY_SETTING_CHANGE
      ),
      securityEvents: logs.filter(log => log.level === this.logLevels.SECURITY),
      generatedAt: Date.now(),
      generatedBy: this.userId
    };

    return report;
  }

  /**
   * Search audit logs
   * @param {string} query - Search query
   * @param {object} options - Search options
   * @returns {Array} Search results
   */
  searchLogs(query, options = {}) {
    const logs = this.getAuditLogs(options.filters || {});
    const searchFields = options.fields || ['eventType', 'data', 'context'];
    
    return logs.filter(log => {
      const searchText = query.toLowerCase();
      
      return searchFields.some(field => {
        const value = this.getNestedValue(log, field);
        if (typeof value === 'string') {
          return value.toLowerCase().includes(searchText);
        } else if (typeof value === 'object') {
          return JSON.stringify(value).toLowerCase().includes(searchText);
        }
        return false;
      });
    });
  }

  /**
   * Clear audit logs (with retention check)
   * @param {boolean} force - Force clear without retention check
   * @returns {boolean} Success status
   */
  clearLogs(force = false) {
    if (!force) {
      // Check if logs should be retained for compliance
      const retentionPeriod = 90 * 24 * 60 * 60 * 1000; // 90 days
      const cutoffTime = Date.now() - retentionPeriod;
      
      this.logBuffer = this.logBuffer.filter(log => log.timestamp > cutoffTime);
    } else {
      this.logBuffer = [];
    }

    this.persistLogs();
    return true;
  }

  /**
   * Generate unique session ID
   * @returns {string} Session ID
   */
  generateSessionId() {
    return 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }

  /**
   * Generate unique log ID
   * @returns {string} Log ID
   */
  generateLogId() {
    return 'log_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }

  /**
   * Get client IP address (placeholder)
   * @returns {string} Client IP
   */
  getClientIP() {
    return 'client_ip_not_available';
  }

  /**
   * Sanitize sensitive values for logging
   * @param {any} value - Value to sanitize
   * @returns {any} Sanitized value
   */
  sanitizeValue(value) {
    if (typeof value === 'string') {
      // Redact potential API keys or passwords
      if (value.length > 20 && /^[a-zA-Z0-9_-]+$/.test(value)) {
        return 'redacted_' + value.substr(-4);
      }
    }
    return value;
  }

  /**
   * Get nested object value by path
   * @param {object} obj - Object to search
   * @param {string} path - Dot-separated path
   * @returns {any} Value at path
   */
  getNestedValue(obj, path) {
    return path.split('.').reduce((current, key) => current && current[key], obj);
  }

  /**
   * Initialize audit logs from storage
   */
  initializeFromStorage() {
    try {
      const stored = localStorage.getItem(this.storageKey);
      if (stored) {
        const data = JSON.parse(stored);
        this.logBuffer = data.logs || [];
        
        // Limit buffer size on load
        if (this.logBuffer.length > this.maxBufferSize) {
          this.logBuffer = this.logBuffer.slice(-this.maxBufferSize);
        }
      }
    } catch (error) {
      console.error('Failed to initialize audit logs from storage:', error);
      this.logBuffer = [];
    }
  }

  /**
   * Persist audit logs to storage
   */
  persistLogs() {
    try {
      const data = {
        version: '1.0',
        lastUpdated: Date.now(),
        logs: this.logBuffer
      };
      localStorage.setItem(this.storageKey, JSON.stringify(data));
    } catch (error) {
      console.error('Failed to persist audit logs:', error);
    }
  }

  /**
   * Get audit log statistics
   * @returns {object} Log statistics
   */
  getLogStatistics() {
    const logs = this.logBuffer;
    const now = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;

    return {
      totalLogs: logs.length,
      logsToday: logs.filter(log => now - log.timestamp < dayMs).length,
      logsThisWeek: logs.filter(log => now - log.timestamp < 7 * dayMs).length,
      logsByLevel: {
        info: logs.filter(log => log.level === this.logLevels.INFO).length,
        warning: logs.filter(log => log.level === this.logLevels.WARNING).length,
        error: logs.filter(log => log.level === this.logLevels.ERROR).length,
        security: logs.filter(log => log.level === this.logLevels.SECURITY).length,
        compliance: logs.filter(log => log.level === this.logLevels.COMPLIANCE).length
      },
      oldestLog: logs.length > 0 ? Math.min(...logs.map(log => log.timestamp)) : null,
      newestLog: logs.length > 0 ? Math.max(...logs.map(log => log.timestamp)) : null
    };
  }
}

export default AuditLogService;