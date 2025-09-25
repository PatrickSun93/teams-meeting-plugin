/**
 * ConsentService - Manages user consent flows for cloud service usage
 * Handles consent collection, storage, and validation for privacy compliance
 */

class ConsentService {
  constructor() {
    this.consentTypes = {
      CLOUD_STT: 'cloud_stt',
      CLOUD_SUMMARY: 'cloud_summary',
      DATA_ANALYTICS: 'data_analytics',
      DATA_SHARING: 'data_sharing',
      TRANSCRIPT_STORAGE: 'transcript_storage'
    };
    
    this.consentLevels = {
      REQUIRED: 'required',
      OPTIONAL: 'optional',
      RECOMMENDED: 'recommended'
    };

    this.consentStorage = new Map();
    this.consentListeners = new Set();
    this.initializeFromStorage();
  }

  /**
   * Define consent requirements for different services
   */
  getConsentRequirements() {
    return {
      [this.consentTypes.CLOUD_STT]: {
        level: this.consentLevels.REQUIRED,
        title: 'Cloud Speech-to-Text Processing',
        description: 'Allow sending audio data to external speech recognition services (OpenAI, Azure, etc.) for improved transcription accuracy.',
        dataProcessed: ['Meeting audio', 'Voice patterns'],
        thirdParties: ['OpenAI', 'Microsoft Azure', 'Anthropic'],
        retention: 'Audio data is processed in real-time and not stored by the service provider',
        risks: 'Audio content may be temporarily processed by third-party services'
      },
      
      [this.consentTypes.CLOUD_SUMMARY]: {
        level: this.consentLevels.OPTIONAL,
        title: 'AI-Powered Summary Generation',
        description: 'Allow sending transcript text to AI services for generating meeting summaries and extracting action items.',
        dataProcessed: ['Meeting transcripts', 'Meeting metadata'],
        thirdParties: ['OpenAI', 'Anthropic Claude', 'Microsoft Azure'],
        retention: 'Text data may be temporarily cached for processing optimization',
        risks: 'Meeting content may be processed by third-party AI services'
      },
      
      [this.consentTypes.DATA_ANALYTICS]: {
        level: this.consentLevels.OPTIONAL,
        title: 'Usage Analytics',
        description: 'Allow collection of anonymous usage statistics to improve the plugin functionality.',
        dataProcessed: ['Feature usage patterns', 'Error logs', 'Performance metrics'],
        thirdParties: ['Analytics providers'],
        retention: 'Analytics data retained for 12 months',
        risks: 'Minimal - only anonymous usage patterns are collected'
      },
      
      [this.consentTypes.DATA_SHARING]: {
        level: this.consentLevels.OPTIONAL,
        title: 'Data Sharing with Team Members',
        description: 'Allow sharing transcripts and summaries with other meeting participants through Teams chat.',
        dataProcessed: ['Meeting transcripts', 'Generated summaries'],
        thirdParties: ['Microsoft Teams'],
        retention: 'Data shared through Teams follows Microsoft\'s retention policies',
        risks: 'Transcripts will be visible to all meeting participants'
      },
      
      [this.consentTypes.TRANSCRIPT_STORAGE]: {
        level: this.consentLevels.RECOMMENDED,
        title: 'Local Transcript Storage',
        description: 'Allow storing meeting transcripts locally on your device for future reference.',
        dataProcessed: ['Meeting transcripts', 'Speaker identification', 'Meeting metadata'],
        thirdParties: ['None - stored locally only'],
        retention: 'Stored until manually deleted or auto-cleanup policy applies',
        risks: 'Minimal - data stored locally on your device'
      }
    };
  }

  /**
   * Request consent for a specific service
   * @param {string} consentType - Type of consent needed
   * @param {object} context - Additional context for consent request
   * @returns {Promise<object>} Consent result
   */
  async requestConsent(consentType, context = {}) {
    const requirements = this.getConsentRequirements();
    const requirement = requirements[consentType];
    
    if (!requirement) {
      throw new Error(`Unknown consent type: ${consentType}`);
    }

    // Check if consent already exists and is valid
    const existingConsent = this.getConsent(consentType);
    if (existingConsent && existingConsent.granted && !this.isConsentExpired(existingConsent)) {
      return {
        granted: true,
        existing: true,
        consent: existingConsent
      };
    }

    // Create consent request
    const consentRequest = {
      type: consentType,
      requirement,
      context,
      requestedAt: Date.now(),
      requestId: this.generateRequestId()
    };

    // Return promise that resolves when user responds
    return new Promise((resolve) => {
      this.showConsentDialog(consentRequest, (result) => {
        if (result.granted) {
          this.storeConsent(consentType, result);
        }
        resolve(result);
      });
    });
  }

  /**
   * Show consent dialog to user
   * @param {object} consentRequest - Consent request details
   * @param {function} callback - Callback for user response
   */
  showConsentDialog(consentRequest, callback) {
    // This would typically show a modal dialog
    // For now, we'll simulate user interaction
    const { requirement } = consentRequest;
    
    // Create consent dialog event
    const dialogEvent = new CustomEvent('show-consent-dialog', {
      detail: {
        consentRequest,
        onResponse: callback
      }
    });
    
    document.dispatchEvent(dialogEvent);
  }

  /**
   * Store user consent
   * @param {string} consentType - Type of consent
   * @param {object} consentResult - Consent result from user
   */
  storeConsent(consentType, consentResult) {
    const consent = {
      type: consentType,
      granted: consentResult.granted,
      grantedAt: Date.now(),
      expiresAt: this.calculateExpirationDate(consentType),
      version: '1.0',
      ipAddress: this.getClientIP(),
      userAgent: navigator.userAgent,
      conditions: consentResult.conditions || {}
    };

    this.consentStorage.set(consentType, consent);
    this.saveToStorage();
    this.notifyConsentListeners('consent_updated', { consentType, consent });
  }

  /**
   * Get stored consent for a type
   * @param {string} consentType - Type of consent
   * @returns {object|null} Stored consent or null
   */
  getConsent(consentType) {
    return this.consentStorage.get(consentType) || null;
  }

  /**
   * Check if user has granted consent for a service
   * @param {string} consentType - Type of consent
   * @returns {boolean} Whether consent is granted and valid
   */
  hasValidConsent(consentType) {
    const consent = this.getConsent(consentType);
    return consent && consent.granted && !this.isConsentExpired(consent);
  }

  /**
   * Check if consent has expired
   * @param {object} consent - Consent object
   * @returns {boolean} Whether consent has expired
   */
  isConsentExpired(consent) {
    return consent.expiresAt && Date.now() > consent.expiresAt;
  }

  /**
   * Calculate expiration date for consent type
   * @param {string} consentType - Type of consent
   * @returns {number|null} Expiration timestamp or null for no expiration
   */
  calculateExpirationDate(consentType) {
    // Different consent types may have different expiration periods
    const expirationPeriods = {
      [this.consentTypes.CLOUD_STT]: 365 * 24 * 60 * 60 * 1000, // 1 year
      [this.consentTypes.CLOUD_SUMMARY]: 365 * 24 * 60 * 60 * 1000, // 1 year
      [this.consentTypes.DATA_ANALYTICS]: 730 * 24 * 60 * 60 * 1000, // 2 years
      [this.consentTypes.DATA_SHARING]: null, // No expiration
      [this.consentTypes.TRANSCRIPT_STORAGE]: null // No expiration
    };

    const period = expirationPeriods[consentType];
    return period ? Date.now() + period : null;
  }

  /**
   * Revoke consent for a service
   * @param {string} consentType - Type of consent to revoke
   */
  revokeConsent(consentType) {
    const consent = this.getConsent(consentType);
    if (consent) {
      consent.granted = false;
      consent.revokedAt = Date.now();
      this.consentStorage.set(consentType, consent);
      this.saveToStorage();
      this.notifyConsentListeners('consent_revoked', { consentType, consent });
    }
  }

  /**
   * Get all consent statuses
   * @returns {object} All consent statuses
   */
  getAllConsentStatuses() {
    const requirements = this.getConsentRequirements();
    const statuses = {};

    Object.keys(requirements).forEach(consentType => {
      const consent = this.getConsent(consentType);
      statuses[consentType] = {
        requirement: requirements[consentType],
        granted: this.hasValidConsent(consentType),
        consent: consent,
        expired: consent ? this.isConsentExpired(consent) : false
      };
    });

    return statuses;
  }

  /**
   * Check if all required consents are granted
   * @param {string[]} requiredTypes - Required consent types
   * @returns {object} Validation result
   */
  validateRequiredConsents(requiredTypes) {
    const missing = [];
    const expired = [];

    requiredTypes.forEach(consentType => {
      const consent = this.getConsent(consentType);
      if (!consent || !consent.granted) {
        missing.push(consentType);
      } else if (this.isConsentExpired(consent)) {
        expired.push(consentType);
      }
    });

    return {
      valid: missing.length === 0 && expired.length === 0,
      missing,
      expired
    };
  }

  /**
   * Generate unique request ID
   * @returns {string} Unique request ID
   */
  generateRequestId() {
    return 'consent_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }

  /**
   * Get client IP address (simplified)
   * @returns {string} Client IP or placeholder
   */
  getClientIP() {
    // In a real implementation, this might use a service to get the IP
    return 'client_ip_not_available';
  }

  /**
   * Initialize consent storage from localStorage
   */
  initializeFromStorage() {
    try {
      const stored = localStorage.getItem('teams_transcription_consents');
      if (stored) {
        const consents = JSON.parse(stored);
        Object.entries(consents).forEach(([type, consent]) => {
          this.consentStorage.set(type, consent);
        });
      }
    } catch (error) {
      console.error('Failed to initialize consent storage:', error);
    }
  }

  /**
   * Save consent storage to localStorage
   */
  saveToStorage() {
    try {
      const consents = {};
      this.consentStorage.forEach((consent, type) => {
        consents[type] = consent;
      });
      localStorage.setItem('teams_transcription_consents', JSON.stringify(consents));
    } catch (error) {
      console.error('Failed to save consent storage:', error);
    }
  }

  /**
   * Add consent change listener
   * @param {function} listener - Listener function
   */
  addConsentListener(listener) {
    this.consentListeners.add(listener);
  }

  /**
   * Remove consent change listener
   * @param {function} listener - Listener function
   */
  removeConsentListener(listener) {
    this.consentListeners.delete(listener);
  }

  /**
   * Notify consent listeners
   * @param {string} event - Event type
   * @param {object} data - Event data
   */
  notifyConsentListeners(event, data) {
    this.consentListeners.forEach(listener => {
      try {
        listener(event, data);
      } catch (error) {
        console.error('Error in consent listener:', error);
      }
    });
  }

  /**
   * Export consent records for compliance
   * @returns {object} Consent records export
   */
  exportConsentRecords() {
    const records = {};
    this.consentStorage.forEach((consent, type) => {
      records[type] = {
        ...consent,
        exportedAt: Date.now()
      };
    });

    return {
      version: '1.0',
      exportedAt: Date.now(),
      records
    };
  }

  /**
   * Clear all consent data
   */
  clearAllConsents() {
    this.consentStorage.clear();
    localStorage.removeItem('teams_transcription_consents');
    this.notifyConsentListeners('all_consents_cleared');
  }
}

export default ConsentService;