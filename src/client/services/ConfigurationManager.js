// Configuration Manager - Handles user settings, API keys, and preferences with security integration
class ConfigurationManager {
  constructor(securityManager = null, platformConfigManager = null) {
    this.securityManager = securityManager;
    this.platformConfigManager = platformConfigManager;
    this.dbName = 'UniversalTranscriptionConfig'; // Updated for multi-platform
    this.dbVersion = 2; // Incremented for migration support
    this.db = null;
    this.initialized = false;
    this.migrationCompleted = false;
  }

  // Initialize IndexedDB
  async initialize() {
    if (this.initialized) return;

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion);

      request.onerror = () => {
        reject(new Error('Failed to open IndexedDB'));
      };

      request.onsuccess = (event) => {
        this.db = event.target.result;
        this.initialized = true;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        const oldVersion = event.oldVersion;

        // Create object stores
        if (!db.objectStoreNames.contains('userConfig')) {
          const userConfigStore = db.createObjectStore('userConfig', { keyPath: 'userId' });
          userConfigStore.createIndex('userId', 'userId', { unique: true });
        }

        if (!db.objectStoreNames.contains('apiKeys')) {
          const apiKeysStore = db.createObjectStore('apiKeys', { keyPath: 'id' });
          apiKeysStore.createIndex('service', 'service', { unique: false });
          apiKeysStore.createIndex('platform', 'platform', { unique: false });
        }

        if (!db.objectStoreNames.contains('userPrompts')) {
          const userPromptsStore = db.createObjectStore('userPrompts', { keyPath: 'id' });
          userPromptsStore.createIndex('userId', 'userId', { unique: false });
          userPromptsStore.createIndex('name', 'name', { unique: false });
        }

        // New stores for multi-platform support
        if (!db.objectStoreNames.contains('platformConfigs')) {
          const platformConfigStore = db.createObjectStore('platformConfigs', { keyPath: 'id' });
          platformConfigStore.createIndex('userId', 'userId', { unique: false });
          platformConfigStore.createIndex('platform', 'platform', { unique: false });
        }

        if (!db.objectStoreNames.contains('crossPlatformSync')) {
          const syncStore = db.createObjectStore('crossPlatformSync', { keyPath: 'id' });
          syncStore.createIndex('userId', 'userId', { unique: false });
          syncStore.createIndex('syncType', 'syncType', { unique: false });
        }

        // Migration from version 1 to 2
        if (oldVersion < 2) {
          this._scheduleMigration();
        }
      };
    });
  }

  // Get user configuration
  async getUserConfig(userId = 'default') {
    await this.initialize();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['userConfig'], 'readonly');
      const store = transaction.objectStore('userConfig');
      const request = store.get(userId);

      request.onsuccess = () => {
        const config = request.result || this.getDefaultConfig(userId);
        resolve(config);
      };

      request.onerror = () => {
        reject(new Error('Failed to retrieve user configuration'));
      };
    });
  }

  // Save user configuration
  async saveUserConfig(config) {
    await this.initialize();
    
    // Validate configuration before saving
    const validationResult = this.validateConfig(config);
    if (!validationResult.isValid) {
      throw new Error(`Invalid configuration: ${validationResult.errors.join(', ')}`);
    }

    // Apply privacy mode compliance if SecurityManager is available
    let finalConfig = config;
    if (this.securityManager && this.securityManager.privacyModeService) {
      finalConfig = this.securityManager.privacyModeService.getPrivacyCompliantConfig(config);
    }

    // Check for consent requirements for cloud services
    if (this.securityManager && this.securityManager.consentService) {
      const requiredConsents = [];
      
      if (this.requiresConsent(finalConfig.sttProvider)) {
        requiredConsents.push('cloud_stt');
      }
      
      if (this.requiresConsent(finalConfig.aiProvider)) {
        requiredConsents.push('cloud_summary');
      }

      if (requiredConsents.length > 0) {
        const validation = this.securityManager.consentService.validateRequiredConsents(requiredConsents);
        if (!validation.valid) {
          throw new Error(`Missing required consents: ${validation.missing.join(', ')}`);
        }
      }
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['userConfig'], 'readwrite');
      const store = transaction.objectStore('userConfig');
      const request = store.put(finalConfig);

      request.onsuccess = () => {
        // Log configuration change if SecurityManager is available
        if (this.securityManager && this.securityManager.auditLogService) {
          this.securityManager.auditLogService.logConfigChange(
            'user_config',
            config,
            finalConfig,
            'User configuration updated'
          );
        }
        resolve(finalConfig);
      };

      request.onerror = () => {
        reject(new Error('Failed to save user configuration'));
      };
    });
  }

  // Get API key for a service (with optional platform specificity)
  async getApiKey(service, platform = null) {
    await this.initialize();

    // Use SecurityManager for secure retrieval if available
    if (this.securityManager && this.securityManager.isInitialized()) {
      try {
        const keyId = platform ? `${service}_${platform}` : service;
        const apiKey = await this.securityManager.secureStorageService.getApiKey(keyId);
        if (apiKey) {
          return apiKey;
        }
      } catch (error) {
        console.warn('Failed to use secure storage, falling back to basic decryption:', error);
      }
    }

    // Fallback to basic decryption
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['apiKeys'], 'readonly');
      const store = transaction.objectStore('apiKeys');
      
      // Try platform-specific key first, then fall back to general key
      const keyId = platform ? `${service}_${platform}` : service;
      const request = store.get(keyId);

      request.onsuccess = () => {
        const result = request.result;
        if (result && result.encryptedKey) {
          const decryptedKey = this.decryptApiKey(result.encryptedKey);
          resolve(decryptedKey);
        } else if (platform) {
          // If platform-specific key not found, try general key
          this.getApiKey(service, null).then(resolve).catch(reject);
        } else {
          resolve(null);
        }
      };

      request.onerror = () => {
        reject(new Error('Failed to retrieve API key'));
      };
    });
  }

  // Get all API keys for a platform
  async getPlatformApiKeys(platform) {
    await this.initialize();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['apiKeys'], 'readonly');
      const store = transaction.objectStore('apiKeys');
      const index = store.index('platform');
      const request = index.getAll(platform);

      request.onsuccess = () => {
        const results = request.result || [];
        const apiKeys = {};
        
        results.forEach(result => {
          if (result.encryptedKey) {
            try {
              const decryptedKey = this.decryptApiKey(result.encryptedKey);
              apiKeys[result.service] = decryptedKey;
            } catch (error) {
              console.warn(`Failed to decrypt API key for ${result.service}:`, error);
            }
          }
        });
        
        resolve(apiKeys);
      };

      request.onerror = () => {
        reject(new Error('Failed to retrieve platform API keys'));
      };
    });
  }

  // Save API key for a service (with optional platform specificity)
  async saveApiKey(service, apiKey, platform = null) {
    await this.initialize();

    if (!apiKey || typeof apiKey !== 'string') {
      throw new Error('Invalid API key');
    }

    const keyId = platform ? `${service}_${platform}` : service;

    // Use SecurityManager for secure storage if available
    if (this.securityManager && this.securityManager.isInitialized()) {
      try {
        const success = await this.securityManager.secureStorageService.storeApiKey(keyId, apiKey);
        if (success) {
          return true;
        }
      } catch (error) {
        console.warn('Failed to use secure storage, falling back to basic encryption:', error);
      }
    }

    // Fallback to basic encryption
    const encryptedKey = this.encryptApiKey(apiKey);

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['apiKeys'], 'readwrite');
      const store = transaction.objectStore('apiKeys');
      const request = store.put({
        id: keyId,
        service,
        platform: platform || 'global',
        encryptedKey,
        updatedAt: new Date().toISOString()
      });

      request.onsuccess = () => {
        resolve(true);
      };

      request.onerror = () => {
        reject(new Error('Failed to save API key'));
      };
    });
  }

  // Save multiple API keys for a platform
  async savePlatformApiKeys(platform, apiKeys) {
    const results = {};
    
    for (const [service, apiKey] of Object.entries(apiKeys)) {
      try {
        results[service] = await this.saveApiKey(service, apiKey, platform);
      } catch (error) {
        console.error(`Failed to save API key for ${service} on ${platform}:`, error);
        results[service] = false;
      }
    }
    
    return results;
  }

  // Delete API key for a service
  async deleteApiKey(service) {
    await this.initialize();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['apiKeys'], 'readwrite');
      const store = transaction.objectStore('apiKeys');
      const request = store.delete(service);

      request.onsuccess = () => {
        resolve(true);
      };

      request.onerror = () => {
        reject(new Error('Failed to delete API key'));
      };
    });
  }

  // Get user's custom prompt (backward compatibility)
  async getUserPrompt(userId = 'default') {
    const prompts = await this.getUserPrompts(userId);
    const defaultPrompt = prompts.find(p => p.isDefault) || prompts[0];
    return defaultPrompt ? defaultPrompt.prompt : this.getDefaultPrompt();
  }

  // Save user's custom prompt (backward compatibility)
  async saveUserPrompt(userId = 'default', prompt) {
    return this.savePrompt({
      userId,
      name: 'Default',
      prompt,
      isDefault: true
    });
  }

  // Get all prompts for a user
  async getUserPrompts(userId = 'default') {
    await this.initialize();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['userPrompts'], 'readonly');
      const store = transaction.objectStore('userPrompts');
      const index = store.index('userId');
      const request = index.getAll(userId);

      request.onsuccess = () => {
        const prompts = request.result || [];
        // If no prompts exist, create a default one
        if (prompts.length === 0) {
          const defaultPrompt = {
            id: `${userId}_default_${Date.now()}`,
            userId,
            name: 'Default',
            prompt: this.getDefaultPrompt(),
            isDefault: true,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          };
          prompts.push(defaultPrompt);
        }
        resolve(prompts);
      };

      request.onerror = () => {
        reject(new Error('Failed to retrieve user prompts'));
      };
    });
  }

  // Save a prompt
  async savePrompt(promptData) {
    await this.initialize();

    // Validate prompt data
    const validation = this.validatePrompt(promptData);
    if (!validation.isValid) {
      throw new Error(`Invalid prompt: ${validation.errors.join(', ')}`);
    }

    const prompt = {
      id: promptData.id || `${promptData.userId}_${Date.now()}`,
      userId: promptData.userId || 'default',
      name: promptData.name,
      prompt: promptData.prompt,
      description: promptData.description || '',
      tags: promptData.tags || [],
      isDefault: promptData.isDefault || false,
      isShared: promptData.isShared || false,
      createdAt: promptData.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['userPrompts'], 'readwrite');
      const store = transaction.objectStore('userPrompts');
      
      // If this is being set as default, unset other defaults for this user
      if (prompt.isDefault) {
        const index = store.index('userId');
        const getAllRequest = index.getAll(prompt.userId);
        
        getAllRequest.onsuccess = () => {
          const existingPrompts = getAllRequest.result;
          const updatePromises = existingPrompts
            .filter(p => p.isDefault && p.id !== prompt.id)
            .map(p => {
              p.isDefault = false;
              p.updatedAt = new Date().toISOString();
              return store.put(p);
            });

          // Wait for all updates to complete, then save the new prompt
          Promise.all(updatePromises).then(() => {
            const saveRequest = store.put(prompt);
            
            saveRequest.onsuccess = () => {
              resolve(prompt);
            };
            
            saveRequest.onerror = () => {
              reject(new Error('Failed to save prompt'));
            };
          });
        };
        
        getAllRequest.onerror = () => {
          reject(new Error('Failed to update existing prompts'));
        };
      } else {
        const request = store.put(prompt);
        
        request.onsuccess = () => {
          resolve(prompt);
        };
        
        request.onerror = () => {
          reject(new Error('Failed to save prompt'));
        };
      }
    });
  }

  // Delete a prompt
  async deletePrompt(promptId) {
    await this.initialize();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['userPrompts'], 'readwrite');
      const store = transaction.objectStore('userPrompts');
      const request = store.delete(promptId);

      request.onsuccess = () => {
        resolve(true);
      };

      request.onerror = () => {
        reject(new Error('Failed to delete prompt'));
      };
    });
  }

  // Get prompt by ID
  async getPromptById(promptId) {
    await this.initialize();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['userPrompts'], 'readonly');
      const store = transaction.objectStore('userPrompts');
      const request = store.get(promptId);

      request.onsuccess = () => {
        resolve(request.result || null);
      };

      request.onerror = () => {
        reject(new Error('Failed to retrieve prompt'));
      };
    });
  }

  // Export prompts for sharing
  async exportPrompts(userId = 'default', promptIds = null) {
    const allPrompts = await this.getUserPrompts(userId);
    const promptsToExport = promptIds 
      ? allPrompts.filter(p => promptIds.includes(p.id))
      : allPrompts;

    const exportData = {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      prompts: promptsToExport.map(p => ({
        name: p.name,
        prompt: p.prompt,
        description: p.description,
        tags: p.tags,
        createdAt: p.createdAt
      }))
    };

    return JSON.stringify(exportData, null, 2);
  }

  // Import prompts from exported data
  async importPrompts(userId = 'default', importData) {
    let data;
    
    try {
      data = typeof importData === 'string' ? JSON.parse(importData) : importData;
    } catch (error) {
      throw new Error('Invalid import data format');
    }

    if (!data.prompts || !Array.isArray(data.prompts)) {
      throw new Error('Import data must contain a prompts array');
    }

    const importedPrompts = [];
    
    for (const promptData of data.prompts) {
      try {
        const prompt = await this.savePrompt({
          userId,
          name: promptData.name,
          prompt: promptData.prompt,
          description: promptData.description,
          tags: promptData.tags,
          isDefault: false // Imported prompts are never default
        });
        importedPrompts.push(prompt);
      } catch (error) {
        console.warn(`Failed to import prompt "${promptData.name}":`, error);
      }
    }

    return importedPrompts;
  }

  // Validate prompt data
  validatePrompt(promptData) {
    const errors = [];

    if (!promptData.name || typeof promptData.name !== 'string' || promptData.name.trim().length === 0) {
      errors.push('Prompt name is required');
    }

    if (!promptData.prompt || typeof promptData.prompt !== 'string' || promptData.prompt.trim().length === 0) {
      errors.push('Prompt content is required');
    }

    if (promptData.prompt && promptData.prompt.length > 10000) {
      errors.push('Prompt content is too long (maximum 10,000 characters)');
    }

    if (promptData.name && promptData.name.length > 100) {
      errors.push('Prompt name is too long (maximum 100 characters)');
    }

    if (promptData.description && promptData.description.length > 500) {
      errors.push('Prompt description is too long (maximum 500 characters)');
    }

    if (promptData.tags && (!Array.isArray(promptData.tags) || promptData.tags.some(tag => typeof tag !== 'string'))) {
      errors.push('Tags must be an array of strings');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  // Get default configuration
  getDefaultConfig(userId = 'default') {
    const defaultConfig = {
      userId,
      sttProvider: 'local_whisper',
      aiProvider: 'openai_gpt',
      language: 'en-US',
      transcriptionQuality: 'high',
      enableSpeakerIdentification: true,
      autoSendToChat: true,
      enableSummaryGeneration: true,
      privacyMode: false,
      dataRetentionDays: 30,
      consentGiven: false,
      // Multi-platform settings
      crossPlatformSync: true,
      platformSpecificSettings: {},
      defaultPlatform: 'teams',
      security: {
        encryptStorage: true,
        requireConsent: true,
        securityLevel: 'standard'
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    // Apply privacy mode compliance if SecurityManager is available
    if (this.securityManager && this.securityManager.privacyModeService) {
      return this.securityManager.privacyModeService.getPrivacyCompliantConfig(defaultConfig);
    }

    return defaultConfig;
  }

  // Get platform-specific configuration
  async getPlatformConfig(userId = 'default', platform) {
    await this.initialize();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['platformConfigs'], 'readonly');
      const store = transaction.objectStore('platformConfigs');
      const request = store.get(`${userId}_${platform}`);

      request.onsuccess = () => {
        const config = request.result || this.getDefaultPlatformConfig(userId, platform);
        resolve(config);
      };

      request.onerror = () => {
        reject(new Error('Failed to retrieve platform configuration'));
      };
    });
  }

  // Save platform-specific configuration
  async savePlatformConfig(userId = 'default', platform, config) {
    await this.initialize();

    const platformConfig = {
      id: `${userId}_${platform}`,
      userId,
      platform,
      config,
      updatedAt: new Date().toISOString()
    };

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['platformConfigs'], 'readwrite');
      const store = transaction.objectStore('platformConfigs');
      const request = store.put(platformConfig);

      request.onsuccess = () => {
        // Log configuration change if SecurityManager is available
        if (this.securityManager && this.securityManager.auditLogService) {
          this.securityManager.auditLogService.logConfigChange(
            'platform_config',
            { platform, userId },
            config,
            `Platform configuration updated for ${platform}`
          );
        }
        resolve(platformConfig);
      };

      request.onerror = () => {
        reject(new Error('Failed to save platform configuration'));
      };
    });
  }

  // Get default platform-specific configuration
  getDefaultPlatformConfig(userId = 'default', platform) {
    const baseConfig = {
      id: `${userId}_${platform}`,
      userId,
      platform,
      config: {
        enabled: true,
        audioQuality: 'high',
        transcriptionEnabled: true,
        speakerIdentificationEnabled: true,
        summaryEnabled: true,
        chatIntegrationEnabled: true,
        agendaAccessEnabled: true
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    // Platform-specific defaults
    switch (platform) {
      case 'teams':
        baseConfig.config = {
          ...baseConfig.config,
          nativeIntegration: true,
          graphApiEnabled: true,
          teamsAppId: null,
          tenantId: null
        };
        break;
      case 'zoom':
        baseConfig.config = {
          ...baseConfig.config,
          sdkIntegration: true,
          webhookEnabled: true,
          zoomApiKey: null,
          zoomApiSecret: null
        };
        break;
      case 'google_meet':
        baseConfig.config = {
          ...baseConfig.config,
          extensionMode: true,
          calendarIntegration: true,
          exportFormat: 'pdf',
          chatIntegrationEnabled: false // Google Meet doesn't support chat API
        };
        break;
      case 'generic':
        baseConfig.config = {
          ...baseConfig.config,
          audioQuality: 'medium',
          speakerIdentificationEnabled: false,
          chatIntegrationEnabled: false,
          agendaAccessEnabled: false,
          exportFormat: 'txt'
        };
        break;
    }

    return baseConfig;
  }

  // Get default summary prompt
  getDefaultPrompt() {
    return `Please provide a concise meeting summary that includes:

1. **Key Discussion Points**: Main topics discussed during the meeting
2. **Decisions Made**: Any decisions or conclusions reached
3. **Action Items**: Tasks assigned with responsible parties (if mentioned)
4. **Next Steps**: Follow-up actions or future meetings planned

Focus on the agenda items and important outcomes. Keep the summary professional and actionable.`;
  }

  // Validate configuration
  validateConfig(config) {
    const errors = [];

    // Required fields
    if (!config.userId) {
      errors.push('User ID is required');
    }

    // STT Provider validation
    const validSTTProviders = ['local_whisper', 'openai_whisper', 'azure_speech', 'claude_speech'];
    if (!validSTTProviders.includes(config.sttProvider)) {
      errors.push('Invalid STT provider');
    }

    // AI Provider validation
    const validAIProviders = ['openai_gpt', 'claude', 'azure_openai'];
    if (!validAIProviders.includes(config.aiProvider)) {
      errors.push('Invalid AI provider');
    }

    // Language validation
    if (!config.language || typeof config.language !== 'string') {
      errors.push('Language is required');
    }

    // Quality validation
    const validQualities = ['low', 'medium', 'high'];
    if (!validQualities.includes(config.transcriptionQuality)) {
      errors.push('Invalid transcription quality');
    }

    // Data retention validation
    if (typeof config.dataRetentionDays !== 'number' || config.dataRetentionDays < 1 || config.dataRetentionDays > 365) {
      errors.push('Data retention days must be between 1 and 365');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  // Simple encryption for API keys (should use proper encryption in production)
  encryptApiKey(apiKey) {
    return btoa(apiKey);
  }

  // Simple decryption for API keys (should use proper encryption in production)
  decryptApiKey(encryptedKey) {
    try {
      return atob(encryptedKey);
    } catch (error) {
      throw new Error('Failed to decrypt API key');
    }
  }

  // Check if cloud service requires consent
  requiresConsent(provider) {
    const cloudProviders = ['openai_whisper', 'azure_speech', 'claude_speech', 'openai_gpt', 'claude', 'azure_openai'];
    return cloudProviders.includes(provider);
  }

  // Get available STT providers
  getAvailableSTTProviders() {
    return [
      { id: 'local_whisper', name: 'Local Whisper', requiresApiKey: false, isCloud: false },
      { id: 'openai_whisper', name: 'OpenAI Whisper API', requiresApiKey: true, isCloud: true },
      { id: 'azure_speech', name: 'Azure Speech Services', requiresApiKey: true, isCloud: true },
      { id: 'claude_speech', name: 'Claude Speech (Anthropic)', requiresApiKey: true, isCloud: true }
    ];
  }

  // Get available AI providers
  getAvailableAIProviders() {
    return [
      { id: 'openai_gpt', name: 'OpenAI GPT', requiresApiKey: true, isCloud: true },
      { id: 'claude', name: 'Claude (Anthropic)', requiresApiKey: true, isCloud: true },
      { id: 'azure_openai', name: 'Azure OpenAI', requiresApiKey: true, isCloud: true }
    ];
  }

  // Set security manager for secure operations
  setSecurityManager(securityManager) {
    this.securityManager = securityManager;
  }

  // Check if configuration requires consent
  async checkConsentRequirements(config) {
    if (!this.securityManager || !this.securityManager.consentService) {
      return { valid: true, missing: [], expired: [] };
    }

    const requiredConsents = [];
    
    if (this.requiresConsent(config.sttProvider)) {
      requiredConsents.push('cloud_stt');
    }
    
    if (this.requiresConsent(config.aiProvider)) {
      requiredConsents.push('cloud_summary');
    }

    if (config.autoSendToChat) {
      requiredConsents.push('data_sharing');
    }

    if (config.dataRetentionDays > 0) {
      requiredConsents.push('transcript_storage');
    }

    return this.securityManager.consentService.validateRequiredConsents(requiredConsents);
  }

  // Get security-aware configuration
  async getSecureConfig(userId = 'default') {
    const config = await this.getUserConfig(userId);
    
    // Apply privacy mode compliance if SecurityManager is available
    if (this.securityManager && this.securityManager.privacyModeService) {
      return this.securityManager.privacyModeService.getPrivacyCompliantConfig(config);
    }

    return config;
  }

  // Validate configuration with security checks
  async validateConfigWithSecurity(config) {
    // Basic validation
    const basicValidation = this.validateConfig(config);
    if (!basicValidation.isValid) {
      return basicValidation;
    }

    // Security validation
    if (this.securityManager) {
      try {
        // Check consent requirements
        const consentValidation = await this.checkConsentRequirements(config);
        if (!consentValidation.valid) {
          return {
            isValid: false,
            errors: [
              ...basicValidation.errors,
              `Missing required consents: ${consentValidation.missing.join(', ')}`,
              ...(consentValidation.expired.length > 0 ? [`Expired consents: ${consentValidation.expired.join(', ')}`] : [])
            ]
          };
        }

        // Check privacy mode compliance
        if (this.securityManager.privacyModeService && this.securityManager.privacyModeService.isPrivacyModeEnabled()) {
          const sttValidation = this.securityManager.privacyModeService.validateProcessingRequest({
            serviceType: 'stt',
            provider: config.sttProvider,
            dataType: 'audio'
          });

          const summaryValidation = this.securityManager.privacyModeService.validateProcessingRequest({
            serviceType: 'summary',
            provider: config.aiProvider,
            dataType: 'transcript'
          });

          if (!sttValidation.allowed || !summaryValidation.allowed) {
            return {
              isValid: false,
              errors: [
                ...basicValidation.errors,
                ...(sttValidation.allowed ? [] : [sttValidation.reason]),
                ...(summaryValidation.allowed ? [] : [summaryValidation.reason])
              ]
            };
          }
        }
      } catch (error) {
        console.warn('Security validation failed:', error);
        return {
          isValid: false,
          errors: [...basicValidation.errors, 'Security validation failed']
        };
      }
    }

    return basicValidation;
  }

  // Cross-platform synchronization methods
  async syncSettingsAcrossPlatforms(userId = 'default', sourceConfig) {
    await this.initialize();

    const syncData = {
      id: `${userId}_sync_${Date.now()}`,
      userId,
      syncType: 'settings',
      sourceConfig,
      syncedAt: new Date().toISOString()
    };

    // Extract syncable settings (exclude platform-specific ones)
    const syncableSettings = {
      sttProvider: sourceConfig.sttProvider,
      aiProvider: sourceConfig.aiProvider,
      language: sourceConfig.language,
      transcriptionQuality: sourceConfig.transcriptionQuality,
      enableSpeakerIdentification: sourceConfig.enableSpeakerIdentification,
      enableSummaryGeneration: sourceConfig.enableSummaryGeneration,
      privacyMode: sourceConfig.privacyMode,
      dataRetentionDays: sourceConfig.dataRetentionDays,
      security: sourceConfig.security
    };

    // Apply to all platforms if cross-platform sync is enabled
    if (sourceConfig.crossPlatformSync) {
      const platforms = ['teams', 'zoom', 'google_meet', 'generic'];
      
      for (const platform of platforms) {
        try {
          const platformConfig = await this.getPlatformConfig(userId, platform);
          const updatedConfig = {
            ...platformConfig.config,
            ...syncableSettings
          };
          
          await this.savePlatformConfig(userId, platform, updatedConfig);
        } catch (error) {
          console.warn(`Failed to sync settings to platform ${platform}:`, error);
        }
      }
    }

    // Store sync record
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['crossPlatformSync'], 'readwrite');
      const store = transaction.objectStore('crossPlatformSync');
      const request = store.put(syncData);

      request.onsuccess = () => {
        resolve(syncData);
      };

      request.onerror = () => {
        reject(new Error('Failed to save sync data'));
      };
    });
  }

  // Get unified configuration for a platform
  async getUnifiedConfig(userId = 'default', platform) {
    const [userConfig, platformConfig] = await Promise.all([
      this.getUserConfig(userId),
      this.getPlatformConfig(userId, platform)
    ]);

    // Merge configurations with platform-specific overrides
    const unifiedConfig = {
      ...userConfig,
      ...platformConfig.config,
      platform,
      platformCapabilities: this._getPlatformCapabilities(platform)
    };

    return unifiedConfig;
  }

  // Migrate existing Teams-only configurations to multi-platform
  async migrateTeamsOnlyConfig(userId = 'default') {
    if (this.migrationCompleted) {
      return true;
    }

    try {
      const existingConfig = await this.getUserConfig(userId);
      
      // Check if this is an old Teams-only config
      if (!existingConfig.crossPlatformSync && !existingConfig.platformSpecificSettings) {
        // Create platform-specific configs based on existing config
        const platforms = ['teams', 'zoom', 'google_meet', 'generic'];
        
        for (const platform of platforms) {
          const platformConfig = this.getDefaultPlatformConfig(userId, platform);
          
          // Apply existing settings where applicable
          platformConfig.config = {
            ...platformConfig.config,
            transcriptionEnabled: existingConfig.enableSpeakerIdentification !== false,
            speakerIdentificationEnabled: existingConfig.enableSpeakerIdentification,
            summaryEnabled: existingConfig.enableSummaryGeneration,
            chatIntegrationEnabled: existingConfig.autoSendToChat && platform !== 'google_meet'
          };
          
          await this.savePlatformConfig(userId, platform, platformConfig.config);
        }

        // Update user config to multi-platform format
        const updatedConfig = {
          ...existingConfig,
          crossPlatformSync: true,
          platformSpecificSettings: {},
          defaultPlatform: 'teams'
        };

        await this.saveUserConfig(updatedConfig);
        this.migrationCompleted = true;
        
        console.log('Successfully migrated Teams-only configuration to multi-platform');
        return true;
      }
      
      this.migrationCompleted = true;
      return true;
    } catch (error) {
      console.error('Failed to migrate Teams-only configuration:', error);
      return false;
    }
  }

  // Get platform capabilities for feature toggling
  _getPlatformCapabilities(platform) {
    const capabilities = {
      teams: {
        chatIntegration: true,
        agendaAccess: true,
        participantInfo: true,
        hostDetection: true,
        audioQuality: 'high',
        nativeIntegration: true
      },
      zoom: {
        chatIntegration: true,
        agendaAccess: false,
        participantInfo: true,
        hostDetection: true,
        audioQuality: 'high',
        sdkIntegration: true
      },
      google_meet: {
        chatIntegration: false,
        agendaAccess: true,
        participantInfo: false,
        hostDetection: false,
        audioQuality: 'medium',
        extensionMode: true
      },
      generic: {
        chatIntegration: false,
        agendaAccess: false,
        participantInfo: false,
        hostDetection: false,
        audioQuality: 'medium',
        fallbackMode: true
      }
    };

    return capabilities[platform] || capabilities.generic;
  }

  // Schedule migration to run after initialization
  _scheduleMigration() {
    setTimeout(async () => {
      try {
        await this.migrateTeamsOnlyConfig();
      } catch (error) {
        console.error('Scheduled migration failed:', error);
      }
    }, 1000);
  }

  // Clear all configuration data
  async clearAllData() {
    await this.initialize();

    // Log data deletion if SecurityManager is available
    if (this.securityManager && this.securityManager.auditLogService) {
      this.securityManager.auditLogService.logDataAccess(
        'delete',
        'configuration',
        'all',
        { reason: 'User requested data clearing' }
      );
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['userConfig', 'apiKeys', 'userPrompts', 'platformConfigs', 'crossPlatformSync'], 'readwrite');
      
      let completed = 0;
      const stores = ['userConfig', 'apiKeys', 'userPrompts', 'platformConfigs', 'crossPlatformSync'];
      
      stores.forEach(storeName => {
        const store = transaction.objectStore(storeName);
        const request = store.clear();
        
        request.onsuccess = () => {
          completed++;
          if (completed === stores.length) {
            resolve(true);
          }
        };
        
        request.onerror = () => {
          reject(new Error(`Failed to clear ${storeName} store`));
        };
      });
    });
  }

  // Set platform configuration manager
  setPlatformConfigurationManager(platformConfigManager) {
    this.platformConfigManager = platformConfigManager;
  }
}

export default ConfigurationManager;