// Configuration Manager - Handles user settings, API keys, and preferences
class ConfigurationManager {
  constructor() {
    this.dbName = 'TeamsTranscriptionConfig';
    this.dbVersion = 1;
    this.db = null;
    this.initialized = false;
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

        // Create object stores
        if (!db.objectStoreNames.contains('userConfig')) {
          const userConfigStore = db.createObjectStore('userConfig', { keyPath: 'userId' });
          userConfigStore.createIndex('userId', 'userId', { unique: true });
        }

        if (!db.objectStoreNames.contains('apiKeys')) {
          const apiKeysStore = db.createObjectStore('apiKeys', { keyPath: 'service' });
          apiKeysStore.createIndex('service', 'service', { unique: true });
        }

        if (!db.objectStoreNames.contains('userPrompts')) {
          const userPromptsStore = db.createObjectStore('userPrompts', { keyPath: 'id' });
          userPromptsStore.createIndex('userId', 'userId', { unique: false });
          userPromptsStore.createIndex('name', 'name', { unique: false });
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

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['userConfig'], 'readwrite');
      const store = transaction.objectStore('userConfig');
      const request = store.put(config);

      request.onsuccess = () => {
        resolve(config);
      };

      request.onerror = () => {
        reject(new Error('Failed to save user configuration'));
      };
    });
  }

  // Get API key for a service
  async getApiKey(service) {
    await this.initialize();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['apiKeys'], 'readonly');
      const store = transaction.objectStore('apiKeys');
      const request = store.get(service);

      request.onsuccess = () => {
        const result = request.result;
        if (result && result.encryptedKey) {
          // Decrypt the API key (simple base64 for now, should use proper encryption in production)
          const decryptedKey = this.decryptApiKey(result.encryptedKey);
          resolve(decryptedKey);
        } else {
          resolve(null);
        }
      };

      request.onerror = () => {
        reject(new Error('Failed to retrieve API key'));
      };
    });
  }

  // Save API key for a service
  async saveApiKey(service, apiKey) {
    await this.initialize();

    if (!apiKey || typeof apiKey !== 'string') {
      throw new Error('Invalid API key');
    }

    // Encrypt the API key (simple base64 for now, should use proper encryption in production)
    const encryptedKey = this.encryptApiKey(apiKey);

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['apiKeys'], 'readwrite');
      const store = transaction.objectStore('apiKeys');
      const request = store.put({
        service,
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
    return {
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
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
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

  // Clear all configuration data
  async clearAllData() {
    await this.initialize();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['userConfig', 'apiKeys', 'userPrompts'], 'readwrite');
      
      let completed = 0;
      const stores = ['userConfig', 'apiKeys', 'userPrompts'];
      
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
}

export default ConfigurationManager;