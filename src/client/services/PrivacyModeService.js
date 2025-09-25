/**
 * PrivacyModeService - Manages privacy mode with local-only processing
 * Ensures no data is sent to external services when privacy mode is enabled
 */

class PrivacyModeService {
  constructor() {
    this.privacyMode = false;
    this.localOnlyServices = new Set(['local_whisper', 'browser_speech']);
    this.listeners = new Set();
    this.privacySettings = {
      blockCloudSTT: true,
      blockCloudSummary: true,
      blockDataSharing: true,
      blockAnalytics: true,
      localStorageOnly: true,
      autoDeleteTranscripts: false,
      autoDeleteDays: 30
    };
  }

  /**
   * Enable privacy mode
   * @param {object} settings - Privacy settings override
   */
  enablePrivacyMode(settings = {}) {
    this.privacyMode = true;
    this.privacySettings = { ...this.privacySettings, ...settings };
    this.notifyListeners('privacy_enabled', this.privacySettings);
    
    // Store privacy mode state
    localStorage.setItem('teams_transcription_privacy_mode', JSON.stringify({
      enabled: true,
      settings: this.privacySettings,
      enabledAt: Date.now()
    }));
  }

  /**
   * Disable privacy mode
   */
  disablePrivacyMode() {
    this.privacyMode = false;
    this.notifyListeners('privacy_disabled');
    
    // Remove privacy mode state
    localStorage.removeItem('teams_transcription_privacy_mode');
  }

  /**
   * Check if privacy mode is enabled
   * @returns {boolean} Privacy mode status
   */
  isPrivacyModeEnabled() {
    return this.privacyMode;
  }

  /**
   * Get current privacy settings
   * @returns {object} Privacy settings
   */
  getPrivacySettings() {
    return { ...this.privacySettings };
  }

  /**
   * Update privacy settings
   * @param {object} newSettings - New privacy settings
   */
  updatePrivacySettings(newSettings) {
    this.privacySettings = { ...this.privacySettings, ...newSettings };
    
    if (this.privacyMode) {
      localStorage.setItem('teams_transcription_privacy_mode', JSON.stringify({
        enabled: true,
        settings: this.privacySettings,
        enabledAt: Date.now()
      }));
    }
    
    this.notifyListeners('privacy_settings_updated', this.privacySettings);
  }

  /**
   * Check if a service is allowed in privacy mode
   * @param {string} serviceType - Type of service (stt, summary, analytics)
   * @param {string} provider - Service provider name
   * @returns {boolean} Whether service is allowed
   */
  isServiceAllowed(serviceType, provider) {
    if (!this.privacyMode) return true;

    switch (serviceType) {
      case 'stt':
        return this.privacySettings.blockCloudSTT ? 
          this.localOnlyServices.has(provider) : true;
      
      case 'summary':
        return !this.privacySettings.blockCloudSummary || 
          this.localOnlyServices.has(provider);
      
      case 'analytics':
        return !this.privacySettings.blockAnalytics;
      
      case 'sharing':
        return !this.privacySettings.blockDataSharing;
      
      default:
        return false;
    }
  }

  /**
   * Validate data processing request
   * @param {object} request - Processing request details
   * @returns {object} Validation result
   */
  validateProcessingRequest(request) {
    const { serviceType, provider, dataType, destination } = request;
    
    if (!this.privacyMode) {
      return { allowed: true, reason: 'Privacy mode disabled' };
    }

    // Check data destination first (higher priority)
    if (destination === 'external' && this.privacySettings.localStorageOnly) {
      return {
        allowed: false,
        reason: 'External data storage blocked by privacy settings',
        alternative: 'Use local storage only'
      };
    }

    // Check service allowance
    if (!this.isServiceAllowed(serviceType, provider)) {
      return {
        allowed: false,
        reason: `${serviceType} service '${provider}' blocked by privacy settings`,
        alternative: this.suggestAlternative(serviceType, provider)
      };
    }

    return { allowed: true, reason: 'Request complies with privacy settings' };
  }

  /**
   * Suggest alternative service for blocked request
   * @param {string} serviceType - Service type
   * @param {string} blockedProvider - Blocked provider
   * @returns {string|null} Alternative suggestion
   */
  suggestAlternative(serviceType, blockedProvider) {
    switch (serviceType) {
      case 'stt':
        return 'Use local Whisper model or browser speech recognition';
      case 'summary':
        return 'Use local text processing or disable summaries';
      default:
        return null;
    }
  }

  /**
   * Get privacy-compliant configuration
   * @param {object} originalConfig - Original configuration
   * @returns {object} Privacy-compliant configuration
   */
  getPrivacyCompliantConfig(originalConfig) {
    if (!this.privacyMode) return originalConfig;

    const compliantConfig = { ...originalConfig };

    // Force local-only STT if cloud STT is blocked
    if (this.privacySettings.blockCloudSTT) {
      if (!this.localOnlyServices.has(compliantConfig.sttProvider)) {
        compliantConfig.sttProvider = 'local_whisper';
      }
    }

    // Disable cloud summary if blocked
    if (this.privacySettings.blockCloudSummary) {
      if (!this.localOnlyServices.has(compliantConfig.summaryProvider)) {
        compliantConfig.enableSummary = false;
      }
    }

    // Disable analytics if blocked
    if (this.privacySettings.blockAnalytics) {
      compliantConfig.enableAnalytics = false;
    }

    // Force local storage only
    if (this.privacySettings.localStorageOnly) {
      compliantConfig.storageLocation = 'local';
      compliantConfig.enableCloudSync = false;
    }

    return compliantConfig;
  }

  /**
   * Initialize privacy mode from stored state
   */
  initializeFromStorage() {
    try {
      const storedState = localStorage.getItem('teams_transcription_privacy_mode');
      if (storedState) {
        const state = JSON.parse(storedState);
        if (state.enabled) {
          this.privacyMode = true;
          this.privacySettings = { ...this.privacySettings, ...state.settings };
        }
      }
    } catch (error) {
      console.error('Failed to initialize privacy mode from storage:', error);
    }
  }

  /**
   * Add privacy mode change listener
   * @param {function} listener - Listener function
   */
  addListener(listener) {
    this.listeners.add(listener);
  }

  /**
   * Remove privacy mode change listener
   * @param {function} listener - Listener function
   */
  removeListener(listener) {
    this.listeners.delete(listener);
  }

  /**
   * Notify all listeners of privacy mode changes
   * @param {string} event - Event type
   * @param {object} data - Event data
   */
  notifyListeners(event, data = null) {
    this.listeners.forEach(listener => {
      try {
        listener(event, data);
      } catch (error) {
        console.error('Error in privacy mode listener:', error);
      }
    });
  }

  /**
   * Get privacy mode status for UI display
   * @returns {object} Privacy status information
   */
  getPrivacyStatus() {
    return {
      enabled: this.privacyMode,
      settings: this.privacySettings,
      allowedServices: {
        stt: this.privacyMode ? Array.from(this.localOnlyServices) : 'all',
        summary: this.privacyMode && this.privacySettings.blockCloudSummary ? 'local' : 'all',
        analytics: this.privacyMode && this.privacySettings.blockAnalytics ? 'disabled' : 'enabled'
      }
    };
  }

  /**
   * Sanitize data for privacy compliance
   * @param {object} data - Data to sanitize
   * @param {string} dataType - Type of data (transcript, config, etc.)
   * @returns {object} Sanitized data
   */
  sanitizeData(data, dataType) {
    if (!this.privacyMode) return data;

    const sanitized = { ...data };

    switch (dataType) {
      case 'transcript':
        // Remove potentially identifying information
        if (this.privacySettings.anonymizeTranscripts) {
          sanitized.participants = sanitized.participants?.map((p, index) => ({
            ...p,
            name: `Speaker ${index + 1}`,
            email: undefined,
            id: `speaker_${index + 1}`
          }));
        }
        break;

      case 'config':
        // Remove API keys and sensitive settings
        sanitized.apiKeys = {};
        sanitized.userInfo = undefined;
        break;

      case 'analytics':
        // Remove user-identifying analytics data
        sanitized.userId = undefined;
        sanitized.sessionId = undefined;
        break;
    }

    return sanitized;
  }

  /**
   * Check if data retention policy should be applied
   * @returns {boolean} Whether to apply retention policy
   */
  shouldApplyRetentionPolicy() {
    return this.privacyMode && this.privacySettings.autoDeleteTranscripts;
  }

  /**
   * Get data retention period in days
   * @returns {number} Retention period in days
   */
  getRetentionPeriod() {
    return this.privacySettings.autoDeleteDays;
  }
}

export default PrivacyModeService;