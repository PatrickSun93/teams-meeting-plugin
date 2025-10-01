const Store = require('electron-store');
const { app } = require('electron');
const path = require('path');
const fs = require('fs');

class ConfigurationManager {
  constructor() {
    this.store = new Store({
      name: 'meeting-transcription-config',
      defaults: {
        transcription: {
          provider: 'local',
          apiKey: null,
          endpoint: null,
          model: 'whisper-1',
          language: 'en',
          enableSpeakerDiarization: true,
          confidenceThreshold: 0.7
        },
        audio: {
          selectedDevice: 'default',
          sampleRate: 16000,
          channels: 1,
          enableNoiseReduction: true,
          audioQuality: 'high'
        },
        platform: {
          manualSelection: null,
          autoDetection: true,
          confidenceThreshold: 0.6,
          detectionInterval: 5000
        },
        ui: {
          theme: 'system',
          minimizeToTray: false,
          showNotifications: true,
          autoStart: false,
          windowBounds: null
        },
        export: {
          defaultFormat: 'txt',
          includeTimestamps: true,
          includeSpeakerLabels: true,
          includeConfidenceScores: false,
          defaultLocation: null
        },
        privacy: {
          enableLocalProcessing: true,
          dataRetentionDays: 30,
          enableAnalytics: false,
          enableCrashReporting: true
        },
        advanced: {
          enableScreenAnalysis: false,
          screenAnalysisInterval: 5000,
          enableDebugLogging: false,
          maxConcurrentTranscriptions: 1
        }
      }
    });

    this.configPath = this.store.path;
    this.backupPath = path.join(path.dirname(this.configPath), 'config-backup.json');
  }

  getConfig() {
    try {
      return this.store.store;
    } catch (error) {
      console.error('Failed to get configuration:', error);
      return this.getDefaultConfig();
    }
  }

  async saveConfig(config) {
    try {
      // Validate configuration before saving
      const validatedConfig = this.validateConfig(config);
      
      // Create backup of current config
      await this.createBackup();
      
      // Save new configuration
      this.store.store = validatedConfig;
      
      return { success: true };
    } catch (error) {
      console.error('Failed to save configuration:', error);
      return { success: false, error: error.message };
    }
  }

  validateConfig(config) {
    const validated = { ...config };

    // Validate transcription settings
    if (validated.transcription) {
      const validProviders = ['local', 'openai', 'azure', 'claude'];
      if (!validProviders.includes(validated.transcription.provider)) {
        validated.transcription.provider = 'local';
      }

      if (validated.transcription.confidenceThreshold < 0 || validated.transcription.confidenceThreshold > 1) {
        validated.transcription.confidenceThreshold = 0.7;
      }
    }

    // Validate audio settings
    if (validated.audio) {
      const validSampleRates = [8000, 16000, 22050, 44100, 48000];
      if (!validSampleRates.includes(validated.audio.sampleRate)) {
        validated.audio.sampleRate = 16000;
      }

      if (validated.audio.channels < 1 || validated.audio.channels > 2) {
        validated.audio.channels = 1;
      }
    }

    // Validate platform settings
    if (validated.platform) {
      if (validated.platform.confidenceThreshold < 0 || validated.platform.confidenceThreshold > 1) {
        validated.platform.confidenceThreshold = 0.6;
      }

      if (validated.platform.detectionInterval < 1000 || validated.platform.detectionInterval > 60000) {
        validated.platform.detectionInterval = 5000;
      }
    }

    // Validate privacy settings
    if (validated.privacy) {
      if (validated.privacy.dataRetentionDays < 1 || validated.privacy.dataRetentionDays > 365) {
        validated.privacy.dataRetentionDays = 30;
      }
    }

    return validated;
  }

  getDefaultConfig() {
    return this.store.defaults;
  }

  async resetConfig() {
    try {
      await this.createBackup();
      this.store.clear();
      return { success: true };
    } catch (error) {
      console.error('Failed to reset configuration:', error);
      return { success: false, error: error.message };
    }
  }

  async createBackup() {
    try {
      const currentConfig = this.store.store;
      const backupData = {
        timestamp: new Date().toISOString(),
        config: currentConfig
      };
      
      fs.writeFileSync(this.backupPath, JSON.stringify(backupData, null, 2));
    } catch (error) {
      console.warn('Failed to create config backup:', error);
    }
  }

  async restoreFromBackup() {
    try {
      if (!fs.existsSync(this.backupPath)) {
        throw new Error('No backup file found');
      }

      const backupData = JSON.parse(fs.readFileSync(this.backupPath, 'utf8'));
      const validatedConfig = this.validateConfig(backupData.config);
      
      this.store.store = validatedConfig;
      
      return { success: true, timestamp: backupData.timestamp };
    } catch (error) {
      console.error('Failed to restore from backup:', error);
      return { success: false, error: error.message };
    }
  }

  // Specific configuration getters and setters
  getTranscriptionConfig() {
    return this.store.get('transcription');
  }

  setTranscriptionConfig(config) {
    const current = this.getTranscriptionConfig();
    const updated = { ...current, ...config };
    this.store.set('transcription', updated);
  }

  getAudioConfig() {
    return this.store.get('audio');
  }

  setAudioConfig(config) {
    const current = this.getAudioConfig();
    const updated = { ...current, ...config };
    this.store.set('audio', updated);
  }

  getPlatformConfig() {
    return this.store.get('platform');
  }

  setPlatformConfig(config) {
    const current = this.getPlatformConfig();
    const updated = { ...current, ...config };
    this.store.set('platform', updated);
  }

  getUIConfig() {
    return this.store.get('ui');
  }

  setUIConfig(config) {
    const current = this.getUIConfig();
    const updated = { ...current, ...config };
    this.store.set('ui', updated);
  }

  getExportConfig() {
    return this.store.get('export');
  }

  setExportConfig(config) {
    const current = this.getExportConfig();
    const updated = { ...current, ...config };
    this.store.set('export', updated);
  }

  getPrivacyConfig() {
    return this.store.get('privacy');
  }

  setPrivacyConfig(config) {
    const current = this.getPrivacyConfig();
    const updated = { ...current, ...config };
    this.store.set('privacy', updated);
  }

  getAdvancedConfig() {
    return this.store.get('advanced');
  }

  setAdvancedConfig(config) {
    const current = this.getAdvancedConfig();
    const updated = { ...current, ...config };
    this.store.set('advanced', updated);
  }

  // API key management
  setAPIKey(provider, apiKey) {
    if (!apiKey || typeof apiKey !== 'string') {
      throw new Error('Invalid API key');
    }

    // Encrypt API key before storing (simplified implementation)
    const encryptedKey = this.encryptAPIKey(apiKey);
    
    this.store.set(`transcription.apiKeys.${provider}`, encryptedKey);
  }

  getAPIKey(provider) {
    const encryptedKey = this.store.get(`transcription.apiKeys.${provider}`);
    if (!encryptedKey) {
      return null;
    }

    try {
      return this.decryptAPIKey(encryptedKey);
    } catch (error) {
      console.error('Failed to decrypt API key:', error);
      return null;
    }
  }

  removeAPIKey(provider) {
    this.store.delete(`transcription.apiKeys.${provider}`);
  }

  // Simple encryption/decryption for API keys
  // In production, use proper encryption libraries
  encryptAPIKey(apiKey) {
    // This is a very basic obfuscation - use proper encryption in production
    const encoded = Buffer.from(apiKey).toString('base64');
    return `enc_${encoded}`;
  }

  decryptAPIKey(encryptedKey) {
    if (!encryptedKey.startsWith('enc_')) {
      throw new Error('Invalid encrypted key format');
    }

    const encoded = encryptedKey.substring(4);
    return Buffer.from(encoded, 'base64').toString('utf8');
  }

  // Configuration validation helpers
  validateAPIKey(provider, apiKey) {
    const patterns = {
      openai: /^sk-[a-zA-Z0-9]{48}$/,
      azure: /^[a-f0-9]{32}$/,
      claude: /^sk-ant-[a-zA-Z0-9-_]{95}$/
    };

    const pattern = patterns[provider];
    if (pattern && !pattern.test(apiKey)) {
      return false;
    }

    return true;
  }

  // Import/Export configuration
  async exportConfig(filePath) {
    try {
      const config = this.getConfig();
      
      // Remove sensitive data from export
      const exportConfig = { ...config };
      if (exportConfig.transcription && exportConfig.transcription.apiKeys) {
        exportConfig.transcription.apiKeys = {};
      }

      const exportData = {
        version: app.getVersion(),
        timestamp: new Date().toISOString(),
        config: exportConfig
      };

      fs.writeFileSync(filePath, JSON.stringify(exportData, null, 2));
      
      return { success: true };
    } catch (error) {
      console.error('Failed to export configuration:', error);
      return { success: false, error: error.message };
    }
  }

  async importConfig(filePath) {
    try {
      if (!fs.existsSync(filePath)) {
        throw new Error('Configuration file not found');
      }

      const importData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      
      if (!importData.config) {
        throw new Error('Invalid configuration file format');
      }

      // Validate imported configuration
      const validatedConfig = this.validateConfig(importData.config);
      
      // Create backup before importing
      await this.createBackup();
      
      // Merge with current configuration (preserve API keys)
      const currentConfig = this.getConfig();
      const mergedConfig = {
        ...validatedConfig,
        transcription: {
          ...validatedConfig.transcription,
          apiKeys: currentConfig.transcription?.apiKeys || {}
        }
      };

      this.store.store = mergedConfig;
      
      return { success: true, version: importData.version };
    } catch (error) {
      console.error('Failed to import configuration:', error);
      return { success: false, error: error.message };
    }
  }

  // Configuration migration
  async migrateConfig(fromVersion, toVersion) {
    try {
      const config = this.getConfig();
      let migratedConfig = { ...config };

      // Add migration logic here for different versions
      // Example:
      // if (fromVersion < '1.1.0') {
      //   migratedConfig = this.migrateFrom1_0_0(migratedConfig);
      // }

      this.store.store = migratedConfig;
      
      return { success: true };
    } catch (error) {
      console.error('Configuration migration failed:', error);
      return { success: false, error: error.message };
    }
  }

  getConfigInfo() {
    return {
      path: this.configPath,
      backupPath: this.backupPath,
      hasBackup: fs.existsSync(this.backupPath),
      size: fs.existsSync(this.configPath) ? fs.statSync(this.configPath).size : 0,
      lastModified: fs.existsSync(this.configPath) ? fs.statSync(this.configPath).mtime : null
    };
  }
}

module.exports = ConfigurationManager;