/**
 * SecurityManager - Main coordinator for security and privacy features
 * Integrates all security services and provides unified security management
 */

import EncryptionService from './EncryptionService.js';
import SecureStorageService from './SecureStorageService.js';
import PrivacyModeService from './PrivacyModeService.js';
import ConsentService from './ConsentService.js';
import DataRetentionService from './DataRetentionService.js';
import AuditLogService from './AuditLogService.js';

class SecurityManager {
  constructor() {
    this.encryptionService = new EncryptionService();
    this.secureStorageService = new SecureStorageService();
    this.privacyModeService = new PrivacyModeService();
    this.consentService = new ConsentService();
    this.dataRetentionService = new DataRetentionService();
    this.auditLogService = new AuditLogService();
    
    this.initialized = false;
    this.securityLevel = 'standard'; // 'minimal', 'standard', 'high'
    this.securityPolicies = new Map();
    
    this.initializeSecurityPolicies();
    this.setupEventListeners();
  }

  /**
   * Initialize security manager with user credentials
   * @param {string} userId - User identifier
   * @param {string} password - User password for encryption
   * @returns {Promise<boolean>} Initialization success
   */
  async initialize(userId, password) {
    try {
      // Set user ID for audit logging
      this.auditLogService.setUserId(userId);
      
      // Initialize secure storage
      const storageInitialized = await this.secureStorageService.initialize(password);
      if (!storageInitialized) {
        throw new Error('Failed to initialize secure storage');
      }

      // Initialize privacy mode from storage
      this.privacyModeService.initializeFromStorage();

      // Log initialization
      this.auditLogService.logEvent(
        this.auditLogService.eventTypes.LOGIN,
        { userId: userId },
        this.auditLogService.logLevels.INFO
      );

      this.initialized = true;
      return true;
    } catch (error) {
      this.auditLogService.logSystemError(error, 'SecurityManager.initialize');
      return false;
    }
  }

  /**
   * Check if security manager is initialized
   * @returns {boolean} Initialization status
   */
  isInitialized() {
    return this.initialized;
  }

  /**
   * Set security level
   * @param {string} level - Security level (minimal, standard, high)
   */
  setSecurityLevel(level) {
    const oldLevel = this.securityLevel;
    this.securityLevel = level;
    
    this.auditLogService.logConfigChange(
      'security_level',
      oldLevel,
      level,
      'Security level changed by user'
    );

    this.applySecurityLevel(level);
  }

  /**
   * Get current security level
   * @returns {string} Current security level
   */
  getSecurityLevel() {
    return this.securityLevel;
  }

  /**
   * Validate security requirements for an operation
   * @param {string} operation - Operation to validate
   * @param {object} context - Operation context
   * @returns {Promise<object>} Validation result
   */
  async validateSecurityRequirements(operation, context = {}) {
    const requirements = this.getSecurityRequirements(operation);
    const validationResult = {
      allowed: true,
      requirements: requirements,
      violations: [],
      recommendations: []
    };

    // Check privacy mode compliance
    if (requirements.respectPrivacyMode) {
      const privacyCheck = this.privacyModeService.validateProcessingRequest({
        serviceType: context.serviceType,
        provider: context.provider,
        dataType: context.dataType,
        destination: context.destination
      });

      if (!privacyCheck.allowed) {
        validationResult.allowed = false;
        validationResult.violations.push({
          type: 'privacy_violation',
          message: privacyCheck.reason,
          alternative: privacyCheck.alternative
        });
      }
    }

    // Check consent requirements
    if (requirements.requiredConsents && requirements.requiredConsents.length > 0) {
      const consentValidation = this.consentService.validateRequiredConsents(requirements.requiredConsents);
      
      if (!consentValidation.valid) {
        validationResult.allowed = false;
        
        if (consentValidation.missing.length > 0) {
          validationResult.violations.push({
            type: 'missing_consent',
            message: `Missing required consents: ${consentValidation.missing.join(', ')}`,
            missingConsents: consentValidation.missing
          });
        }

        if (consentValidation.expired.length > 0) {
          validationResult.violations.push({
            type: 'expired_consent',
            message: `Expired consents: ${consentValidation.expired.join(', ')}`,
            expiredConsents: consentValidation.expired
          });
        }
      }
    }

    // Check data retention policies
    if (requirements.checkRetention && context.dataTimestamp) {
      const retentionCheck = this.dataRetentionService.shouldDeleteData(
        context.dataType,
        context.dataTimestamp
      );

      if (retentionCheck.shouldDelete) {
        validationResult.allowed = false;
        validationResult.violations.push({
          type: 'retention_violation',
          message: 'Data exceeds retention policy and should be deleted',
          retentionPolicy: retentionCheck.policy
        });
      }
    }

    // Log security validation
    this.auditLogService.logSecurityEvent(
      'security_validation',
      {
        operation: operation,
        allowed: validationResult.allowed,
        violations: validationResult.violations.length,
        context: context
      },
      validationResult.allowed ? 'low' : 'high'
    );

    return validationResult;
  }

  /**
   * Securely store data with encryption
   * @param {string} dataType - Type of data
   * @param {string} dataId - Data identifier
   * @param {object} data - Data to store
   * @param {object} options - Storage options
   * @returns {Promise<boolean>} Storage success
   */
  async securelyStoreData(dataType, dataId, data, options = {}) {
    try {
      // Validate security requirements
      const validation = await this.validateSecurityRequirements('store_data', {
        dataType: dataType,
        serviceType: 'storage',
        destination: 'local'
      });

      if (!validation.allowed) {
        throw new Error(`Security validation failed: ${validation.violations.map(v => v.message).join(', ')}`);
      }

      // Apply privacy mode sanitization
      const sanitizedData = this.privacyModeService.sanitizeData(data, dataType);

      // Encrypt data if required
      let storedData = sanitizedData;
      if (options.encrypt !== false) {
        const masterKey = await this.getMasterEncryptionKey();
        const encryptedPackage = await this.encryptionService.encryptTranscript(sanitizedData, masterKey);
        storedData = encryptedPackage;
      }

      // Store data
      const storageKey = `teams_transcription_${dataType}_${dataId}`;
      localStorage.setItem(storageKey, JSON.stringify({
        data: storedData,
        encrypted: options.encrypt !== false,
        timestamp: Date.now(),
        dataType: dataType,
        version: '1.0'
      }));

      // Log data access
      this.auditLogService.logDataAccess('write', dataType, dataId, {
        encrypted: options.encrypt !== false,
        size: JSON.stringify(data).length
      });

      return true;
    } catch (error) {
      this.auditLogService.logSystemError(error, 'SecurityManager.securelyStoreData');
      return false;
    }
  }

  /**
   * Securely retrieve data with decryption
   * @param {string} dataType - Type of data
   * @param {string} dataId - Data identifier
   * @returns {Promise<object|null>} Retrieved data or null
   */
  async securelyRetrieveData(dataType, dataId) {
    try {
      // Validate security requirements
      const validation = await this.validateSecurityRequirements('retrieve_data', {
        dataType: dataType,
        serviceType: 'storage'
      });

      if (!validation.allowed) {
        throw new Error(`Security validation failed: ${validation.violations.map(v => v.message).join(', ')}`);
      }

      // Retrieve data
      const storageKey = `teams_transcription_${dataType}_${dataId}`;
      const storedItem = localStorage.getItem(storageKey);
      
      if (!storedItem) {
        return null;
      }

      const storageData = JSON.parse(storedItem);

      // Decrypt if necessary
      let retrievedData = storageData.data;
      if (storageData.encrypted) {
        const masterKey = await this.getMasterEncryptionKey();
        retrievedData = await this.encryptionService.decryptTranscript(storageData.data, masterKey);
      }

      // Log data access
      this.auditLogService.logDataAccess('read', dataType, dataId, {
        encrypted: storageData.encrypted,
        timestamp: storageData.timestamp
      });

      return retrievedData;
    } catch (error) {
      this.auditLogService.logSystemError(error, 'SecurityManager.securelyRetrieveData');
      return null;
    }
  }

  /**
   * Securely delete data
   * @param {string} dataType - Type of data
   * @param {string} dataId - Data identifier
   * @returns {Promise<boolean>} Deletion success
   */
  async securelyDeleteData(dataType, dataId) {
    try {
      // Validate security requirements
      const validation = await this.validateSecurityRequirements('delete_data', {
        dataType: dataType,
        serviceType: 'storage'
      });

      if (!validation.allowed) {
        throw new Error(`Security validation failed: ${validation.violations.map(v => v.message).join(', ')}`);
      }

      // Remove from storage
      const storageKey = `teams_transcription_${dataType}_${dataId}`;
      localStorage.removeItem(storageKey);

      // Log data access
      this.auditLogService.logDataAccess('delete', dataType, dataId);

      return true;
    } catch (error) {
      this.auditLogService.logSystemError(error, 'SecurityManager.securelyDeleteData');
      return false;
    }
  }

  /**
   * Request user consent for an operation
   * @param {string} consentType - Type of consent needed
   * @param {object} context - Operation context
   * @returns {Promise<boolean>} Consent granted
   */
  async requestConsent(consentType, context = {}) {
    try {
      const consentResult = await this.consentService.requestConsent(consentType, context);
      
      this.auditLogService.logConsentEvent(
        consentResult.granted ? 'granted' : 'denied',
        consentType,
        { context: context }
      );

      return consentResult.granted;
    } catch (error) {
      this.auditLogService.logSystemError(error, 'SecurityManager.requestConsent');
      return false;
    }
  }

  /**
   * Enable privacy mode
   * @param {object} settings - Privacy settings
   */
  enablePrivacyMode(settings = {}) {
    this.privacyModeService.enablePrivacyMode(settings);
    this.auditLogService.logPrivacyChange('privacy_mode', true, settings);
  }

  /**
   * Disable privacy mode
   */
  disablePrivacyMode() {
    this.privacyModeService.disablePrivacyMode();
    this.auditLogService.logPrivacyChange('privacy_mode', false);
  }

  /**
   * Get security status overview
   * @returns {object} Security status
   */
  getSecurityStatus() {
    return {
      initialized: this.initialized,
      securityLevel: this.securityLevel,
      privacyMode: this.privacyModeService.getPrivacyStatus(),
      consentStatus: this.consentService.getAllConsentStatuses(),
      retentionPolicies: this.dataRetentionService.getAllRetentionPolicies(),
      auditLogStats: this.auditLogService.getLogStatistics(),
      secureStorageProviders: this.secureStorageService.getStoredProviders()
    };
  }

  /**
   * Generate security compliance report
   * @param {number} startTime - Report start time
   * @param {number} endTime - Report end time
   * @returns {object} Compliance report
   */
  generateComplianceReport(startTime, endTime) {
    const auditReport = this.auditLogService.generateComplianceReport(startTime, endTime);
    const consentStatuses = this.consentService.getAllConsentStatuses();
    const privacyStatus = this.privacyModeService.getPrivacyStatus();
    
    return {
      reportPeriod: auditReport.reportPeriod,
      securityLevel: this.securityLevel,
      auditSummary: auditReport.summary,
      consentCompliance: {
        totalConsentTypes: Object.keys(consentStatuses).length,
        grantedConsents: Object.values(consentStatuses).filter(s => s.granted).length,
        expiredConsents: Object.values(consentStatuses).filter(s => s.expired).length
      },
      privacyCompliance: {
        privacyModeEnabled: privacyStatus.enabled,
        localOnlyProcessing: privacyStatus.settings?.localStorageOnly || false,
        cloudServicesBlocked: privacyStatus.settings?.blockCloudSTT || false
      },
      dataRetention: {
        policiesActive: Object.values(this.dataRetentionService.getAllRetentionPolicies())
          .filter(p => p.enabled).length,
        autoCleanupEnabled: this.dataRetentionService.getCleanupStatus().schedulerActive
      },
      generatedAt: Date.now(),
      generatedBy: this.auditLogService.userId
    };
  }

  /**
   * Initialize security policies
   */
  initializeSecurityPolicies() {
    // Define security requirements for different operations
    this.securityPolicies.set('store_data', {
      respectPrivacyMode: true,
      requiredConsents: ['transcript_storage'],
      checkRetention: false,
      requireEncryption: true
    });

    this.securityPolicies.set('retrieve_data', {
      respectPrivacyMode: true,
      requiredConsents: [],
      checkRetention: true,
      requireEncryption: false
    });

    this.securityPolicies.set('delete_data', {
      respectPrivacyMode: false,
      requiredConsents: [],
      checkRetention: false,
      requireEncryption: false
    });

    this.securityPolicies.set('cloud_stt', {
      respectPrivacyMode: true,
      requiredConsents: ['cloud_stt'],
      checkRetention: false,
      requireEncryption: false
    });

    this.securityPolicies.set('cloud_summary', {
      respectPrivacyMode: true,
      requiredConsents: ['cloud_summary'],
      checkRetention: false,
      requireEncryption: false
    });

    this.securityPolicies.set('share_data', {
      respectPrivacyMode: true,
      requiredConsents: ['data_sharing'],
      checkRetention: true,
      requireEncryption: false
    });
  }

  /**
   * Get security requirements for an operation
   * @param {string} operation - Operation name
   * @returns {object} Security requirements
   */
  getSecurityRequirements(operation) {
    return this.securityPolicies.get(operation) || {
      respectPrivacyMode: false,
      requiredConsents: [],
      checkRetention: false,
      requireEncryption: false
    };
  }

  /**
   * Apply security level settings
   * @param {string} level - Security level
   */
  applySecurityLevel(level) {
    switch (level) {
      case 'minimal':
        // Minimal security - basic encryption only
        this.updateSecurityPolicy('store_data', { requireEncryption: false });
        break;
        
      case 'standard':
        // Standard security - encryption and basic privacy
        this.updateSecurityPolicy('store_data', { requireEncryption: true });
        break;
        
      case 'high':
        // High security - full encryption, privacy mode, strict consent
        this.updateSecurityPolicy('store_data', { requireEncryption: true });
        this.updateSecurityPolicy('cloud_stt', { requiredConsents: ['cloud_stt', 'data_analytics'] });
        break;
    }
  }

  /**
   * Update security policy
   * @param {string} operation - Operation name
   * @param {object} updates - Policy updates
   */
  updateSecurityPolicy(operation, updates) {
    const currentPolicy = this.securityPolicies.get(operation) || {};
    this.securityPolicies.set(operation, { ...currentPolicy, ...updates });
  }

  /**
   * Setup event listeners for security events
   */
  setupEventListeners() {
    // Listen for privacy mode changes
    this.privacyModeService.addListener((event, data) => {
      this.auditLogService.logPrivacyChange('privacy_mode_event', event === 'privacy_enabled', data);
    });

    // Listen for consent changes
    this.consentService.addConsentListener((event, data) => {
      this.auditLogService.logConsentEvent(event, data.consentType, data.consent);
    });
  }

  /**
   * Get master encryption key (placeholder - would use secure key derivation)
   * @returns {Promise<CryptoKey>} Master encryption key
   */
  async getMasterEncryptionKey() {
    // This would typically derive a key from the user's password
    // For now, generate a temporary key
    return await this.encryptionService.generateKey();
  }

  /**
   * Cleanup and shutdown security manager
   */
  shutdown() {
    this.dataRetentionService.stopCleanup();
    this.auditLogService.logEvent(
      this.auditLogService.eventTypes.LOGOUT,
      { userId: this.auditLogService.userId },
      this.auditLogService.logLevels.INFO
    );
    this.initialized = false;
  }
}

export default SecurityManager;