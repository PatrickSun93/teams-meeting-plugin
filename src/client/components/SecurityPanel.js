/**
 * SecurityPanel - UI component for managing security and privacy settings
 */

import React, { useState, useEffect } from 'react';
import SecurityManager from '../services/SecurityManager.js';
import './SecurityPanel.css';

const SecurityPanel = ({ securityManager, onSecurityChange }) => {
  const [securityStatus, setSecurityStatus] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadSecurityStatus();
  }, [securityManager]);

  const loadSecurityStatus = async () => {
    try {
      setLoading(true);
      const status = securityManager.getSecurityStatus();
      setSecurityStatus(status);
      setError(null);
    } catch (err) {
      setError('Failed to load security status');
      console.error('Security status error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSecurityLevelChange = (level) => {
    securityManager.setSecurityLevel(level);
    loadSecurityStatus();
    onSecurityChange?.('security_level_changed', { level });
  };

  const handlePrivacyModeToggle = (enabled) => {
    if (enabled) {
      securityManager.enablePrivacyMode();
    } else {
      securityManager.disablePrivacyMode();
    }
    loadSecurityStatus();
    onSecurityChange?.('privacy_mode_changed', { enabled });
  };

  const handleConsentRevoke = async (consentType) => {
    securityManager.consentService.revokeConsent(consentType);
    loadSecurityStatus();
    onSecurityChange?.('consent_revoked', { consentType });
  };

  const generateComplianceReport = () => {
    const endTime = Date.now();
    const startTime = endTime - (30 * 24 * 60 * 60 * 1000); // Last 30 days
    const report = securityManager.generateComplianceReport(startTime, endTime);
    
    // Create downloadable report
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `compliance-report-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return <div className="security-panel loading">Loading security settings...</div>;
  }

  if (error) {
    return <div className="security-panel error">Error: {error}</div>;
  }

  return (
    <div className="security-panel">
      <div className="security-header">
        <h2>Security & Privacy Settings</h2>
        <div className="security-status">
          <span className={`status-indicator ${securityStatus.initialized ? 'active' : 'inactive'}`}>
            {securityStatus.initialized ? 'Secure' : 'Not Initialized'}
          </span>
        </div>
      </div>

      <div className="security-tabs">
        <button 
          className={`tab ${activeTab === 'overview' ? 'active' : ''}`}
          onClick={() => setActiveTab('overview')}
        >
          Overview
        </button>
        <button 
          className={`tab ${activeTab === 'privacy' ? 'active' : ''}`}
          onClick={() => setActiveTab('privacy')}
        >
          Privacy
        </button>
        <button 
          className={`tab ${activeTab === 'consent' ? 'active' : ''}`}
          onClick={() => setActiveTab('consent')}
        >
          Consent
        </button>
        <button 
          className={`tab ${activeTab === 'retention' ? 'active' : ''}`}
          onClick={() => setActiveTab('retention')}
        >
          Data Retention
        </button>
        <button 
          className={`tab ${activeTab === 'audit' ? 'active' : ''}`}
          onClick={() => setActiveTab('audit')}
        >
          Audit Logs
        </button>
      </div>

      <div className="security-content">
        {activeTab === 'overview' && (
          <SecurityOverview 
            securityStatus={securityStatus}
            onSecurityLevelChange={handleSecurityLevelChange}
            onGenerateReport={generateComplianceReport}
          />
        )}

        {activeTab === 'privacy' && (
          <PrivacySettings 
            privacyStatus={securityStatus.privacyMode}
            onPrivacyModeToggle={handlePrivacyModeToggle}
          />
        )}

        {activeTab === 'consent' && (
          <ConsentManagement 
            consentStatus={securityStatus.consentStatus}
            onConsentRevoke={handleConsentRevoke}
          />
        )}

        {activeTab === 'retention' && (
          <RetentionSettings 
            retentionPolicies={securityStatus.retentionPolicies}
            onPolicyUpdate={loadSecurityStatus}
          />
        )}

        {activeTab === 'audit' && (
          <AuditLogViewer 
            auditStats={securityStatus.auditLogStats}
            securityManager={securityManager}
          />
        )}
      </div>
    </div>
  );
};

const SecurityOverview = ({ securityStatus, onSecurityLevelChange, onGenerateReport }) => (
  <div className="security-overview">
    <div className="security-level-section">
      <h3>Security Level</h3>
      <div className="security-level-options">
        {['minimal', 'standard', 'high'].map(level => (
          <label key={level} className="security-level-option">
            <input
              type="radio"
              name="securityLevel"
              value={level}
              checked={securityStatus.securityLevel === level}
              onChange={() => onSecurityLevelChange(level)}
            />
            <span className="level-name">{level.charAt(0).toUpperCase() + level.slice(1)}</span>
            <span className="level-description">
              {level === 'minimal' && 'Basic security with local storage only'}
              {level === 'standard' && 'Balanced security with encryption and privacy controls'}
              {level === 'high' && 'Maximum security with strict privacy and consent requirements'}
            </span>
          </label>
        ))}
      </div>
    </div>

    <div className="security-summary">
      <h3>Security Summary</h3>
      <div className="summary-grid">
        <div className="summary-item">
          <span className="label">Privacy Mode:</span>
          <span className={`value ${securityStatus.privacyMode.enabled ? 'enabled' : 'disabled'}`}>
            {securityStatus.privacyMode.enabled ? 'Enabled' : 'Disabled'}
          </span>
        </div>
        <div className="summary-item">
          <span className="label">Active Consents:</span>
          <span className="value">
            {Object.values(securityStatus.consentStatus).filter(s => s.granted).length} / {Object.keys(securityStatus.consentStatus).length}
          </span>
        </div>
        <div className="summary-item">
          <span className="label">Retention Policies:</span>
          <span className="value">
            {Object.values(securityStatus.retentionPolicies).filter(p => p.enabled).length} active
          </span>
        </div>
        <div className="summary-item">
          <span className="label">Audit Logs:</span>
          <span className="value">{securityStatus.auditLogStats.totalLogs} entries</span>
        </div>
      </div>
    </div>

    <div className="compliance-section">
      <h3>Compliance</h3>
      <button className="generate-report-btn" onClick={onGenerateReport}>
        Generate Compliance Report
      </button>
    </div>
  </div>
);

const PrivacySettings = ({ privacyStatus, onPrivacyModeToggle }) => (
  <div className="privacy-settings">
    <div className="privacy-mode-section">
      <h3>Privacy Mode</h3>
      <label className="privacy-toggle">
        <input
          type="checkbox"
          checked={privacyStatus.enabled}
          onChange={(e) => onPrivacyModeToggle(e.target.checked)}
        />
        <span className="toggle-slider"></span>
        <span className="toggle-label">
          {privacyStatus.enabled ? 'Privacy Mode Enabled' : 'Privacy Mode Disabled'}
        </span>
      </label>
      <p className="privacy-description">
        When enabled, privacy mode restricts data processing to local-only services and blocks cloud-based features.
      </p>
    </div>

    {privacyStatus.enabled && (
      <div className="privacy-settings-details">
        <h4>Privacy Settings</h4>
        <div className="setting-item">
          <span className="setting-label">Block Cloud STT:</span>
          <span className={`setting-value ${privacyStatus.settings?.blockCloudSTT ? 'enabled' : 'disabled'}`}>
            {privacyStatus.settings?.blockCloudSTT ? 'Blocked' : 'Allowed'}
          </span>
        </div>
        <div className="setting-item">
          <span className="setting-label">Block Cloud Summary:</span>
          <span className={`setting-value ${privacyStatus.settings?.blockCloudSummary ? 'enabled' : 'disabled'}`}>
            {privacyStatus.settings?.blockCloudSummary ? 'Blocked' : 'Allowed'}
          </span>
        </div>
        <div className="setting-item">
          <span className="setting-label">Local Storage Only:</span>
          <span className={`setting-value ${privacyStatus.settings?.localStorageOnly ? 'enabled' : 'disabled'}`}>
            {privacyStatus.settings?.localStorageOnly ? 'Yes' : 'No'}
          </span>
        </div>
      </div>
    )}

    <div className="allowed-services">
      <h4>Allowed Services</h4>
      <div className="service-list">
        <div className="service-item">
          <span className="service-name">Speech-to-Text:</span>
          <span className="service-status">
            {Array.isArray(privacyStatus.allowedServices?.stt) 
              ? privacyStatus.allowedServices.stt.join(', ')
              : privacyStatus.allowedServices?.stt || 'All'}
          </span>
        </div>
        <div className="service-item">
          <span className="service-name">Summary Generation:</span>
          <span className="service-status">{privacyStatus.allowedServices?.summary || 'All'}</span>
        </div>
        <div className="service-item">
          <span className="service-name">Analytics:</span>
          <span className="service-status">{privacyStatus.allowedServices?.analytics || 'Enabled'}</span>
        </div>
      </div>
    </div>
  </div>
);

const ConsentManagement = ({ consentStatus, onConsentRevoke }) => (
  <div className="consent-management">
    <h3>Consent Management</h3>
    <div className="consent-list">
      {Object.entries(consentStatus).map(([consentType, status]) => (
        <div key={consentType} className="consent-item">
          <div className="consent-header">
            <h4>{status.requirement.title}</h4>
            <span className={`consent-status ${status.granted ? 'granted' : 'not-granted'}`}>
              {status.granted ? 'Granted' : 'Not Granted'}
            </span>
          </div>
          <p className="consent-description">{status.requirement.description}</p>
          
          {status.consent && (
            <div className="consent-details">
              <div className="consent-meta">
                <span>Granted: {new Date(status.consent.grantedAt).toLocaleDateString()}</span>
                {status.consent.expiresAt && (
                  <span>Expires: {new Date(status.consent.expiresAt).toLocaleDateString()}</span>
                )}
                {status.expired && <span className="expired-warning">EXPIRED</span>}
              </div>
              
              {status.granted && (
                <button 
                  className="revoke-consent-btn"
                  onClick={() => onConsentRevoke(consentType)}
                >
                  Revoke Consent
                </button>
              )}
            </div>
          )}

          <div className="consent-info">
            <div className="data-processed">
              <strong>Data Processed:</strong> {status.requirement.dataProcessed.join(', ')}
            </div>
            <div className="third-parties">
              <strong>Third Parties:</strong> {status.requirement.thirdParties.join(', ')}
            </div>
            <div className="retention">
              <strong>Retention:</strong> {status.requirement.retention}
            </div>
          </div>
        </div>
      ))}
    </div>
  </div>
);

const RetentionSettings = ({ retentionPolicies, onPolicyUpdate }) => (
  <div className="retention-settings">
    <h3>Data Retention Policies</h3>
    <div className="retention-list">
      {Object.entries(retentionPolicies).map(([dataType, policy]) => (
        <div key={dataType} className="retention-item">
          <div className="retention-header">
            <h4>{dataType.charAt(0).toUpperCase() + dataType.slice(1)}</h4>
            <span className={`policy-status ${policy.enabled ? 'enabled' : 'disabled'}`}>
              {policy.enabled ? 'Active' : 'Inactive'}
            </span>
          </div>
          
          <div className="retention-details">
            <div className="retention-setting">
              <span className="setting-label">Retention Period:</span>
              <span className="setting-value">{policy.retentionDays} days</span>
            </div>
            <div className="retention-setting">
              <span className="setting-label">Auto Delete:</span>
              <span className={`setting-value ${policy.autoDelete ? 'enabled' : 'disabled'}`}>
                {policy.autoDelete ? 'Yes' : 'No'}
              </span>
            </div>
            {policy.archiveBeforeDelete && (
              <div className="retention-setting">
                <span className="setting-label">Archive Before Delete:</span>
                <span className="setting-value">Yes</span>
              </div>
            )}
            {policy.notifyBeforeDelete && (
              <div className="retention-setting">
                <span className="setting-label">Notification:</span>
                <span className="setting-value">{policy.notifyDaysBefore} days before deletion</span>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  </div>
);

const AuditLogViewer = ({ auditStats, securityManager }) => {
  const [logs, setLogs] = useState([]);
  const [filters, setFilters] = useState({});
  const [loading, setLoading] = useState(false);

  const loadLogs = async () => {
    setLoading(true);
    try {
      const auditLogs = securityManager.auditLogService.getAuditLogs(filters);
      setLogs(auditLogs.slice(0, 100)); // Limit to 100 most recent
    } catch (error) {
      console.error('Failed to load audit logs:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLogs();
  }, [filters]);

  const exportLogs = () => {
    const exportData = securityManager.auditLogService.exportAuditLogs(filters);
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit-logs-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="audit-log-viewer">
      <div className="audit-header">
        <h3>Audit Logs</h3>
        <button className="export-logs-btn" onClick={exportLogs}>
          Export Logs
        </button>
      </div>

      <div className="audit-stats">
        <div className="stat-item">
          <span className="stat-label">Total Logs:</span>
          <span className="stat-value">{auditStats.totalLogs}</span>
        </div>
        <div className="stat-item">
          <span className="stat-label">Today:</span>
          <span className="stat-value">{auditStats.logsToday}</span>
        </div>
        <div className="stat-item">
          <span className="stat-label">This Week:</span>
          <span className="stat-value">{auditStats.logsThisWeek}</span>
        </div>
        <div className="stat-item">
          <span className="stat-label">Security Events:</span>
          <span className="stat-value">{auditStats.logsByLevel.security}</span>
        </div>
      </div>

      <div className="log-filters">
        <select 
          value={filters.level || ''} 
          onChange={(e) => setFilters({...filters, level: e.target.value || undefined})}
        >
          <option value="">All Levels</option>
          <option value="info">Info</option>
          <option value="warning">Warning</option>
          <option value="error">Error</option>
          <option value="security">Security</option>
          <option value="compliance">Compliance</option>
        </select>
      </div>

      <div className="log-list">
        {loading ? (
          <div className="loading">Loading logs...</div>
        ) : (
          logs.map(log => (
            <div key={log.id} className={`log-entry ${log.level}`}>
              <div className="log-header">
                <span className="log-timestamp">
                  {new Date(log.timestamp).toLocaleString()}
                </span>
                <span className={`log-level ${log.level}`}>{log.level.toUpperCase()}</span>
                <span className="log-event-type">{log.eventType}</span>
              </div>
              <div className="log-details">
                {Object.entries(log.data).map(([key, value]) => (
                  <div key={key} className="log-detail">
                    <span className="detail-key">{key}:</span>
                    <span className="detail-value">
                      {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default SecurityPanel;