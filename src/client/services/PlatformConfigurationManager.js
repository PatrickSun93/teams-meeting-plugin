/**
 * Platform Configuration Manager
 * Manages platform-specific settings and configurations
 */

import { MeetingPlatform, PlatformCapabilities } from './PlatformAdapter.js';

/**
 * Platform-specific configuration keys
 */
export const PlatformConfigKeys = {
  // Teams specific
  TEAMS_TENANT_ID: 'teams.tenantId',
  TEAMS_APP_ID: 'teams.appId',
  TEAMS_CHAT_ENABLED: 'teams.chatEnabled',
  TEAMS_GRAPH_API_KEY: 'teams.graphApiKey',
  
  // Zoom specific
  ZOOM_API_KEY: 'zoom.apiKey',
  ZOOM_API_SECRET: 'zoom.apiSecret',
  ZOOM_WEBHOOK_SECRET: 'zoom.webhookSecret',
  ZOOM_CHAT_ENABLED: 'zoom.chatEnabled',
  
  // Google Meet specific
  MEET_EXTENSION_ID: 'meet.extensionId',
  MEET_CALENDAR_API_KEY: 'meet.calendarApiKey',
  MEET_EXPORT_FORMAT: 'meet.exportFormat',
  
  // Generic/fallback
  GENERIC_AUDIO_QUALITY: 'generic.audioQuality',
  GENERIC_EXPORT_FORMAT: 'generic.exportFormat'
};

/**
 * Default platform configurations
 */
const DEFAULT_PLATFORM_CONFIGS = {
  [MeetingPlatform.TEAMS]: {
    [PlatformConfigKeys.TEAMS_CHAT_ENABLED]: true,
    audioQuality: 'high',
    transcriptionEnabled: true,
    speakerIdentificationEnabled: true,
    summaryEnabled: true
  },
  [MeetingPlatform.ZOOM]: {
    [PlatformConfigKeys.ZOOM_CHAT_ENABLED]: true,
    audioQuality: 'high',
    transcriptionEnabled: true,
    speakerIdentificationEnabled: true,
    summaryEnabled: true
  },
  [MeetingPlatform.GOOGLE_MEET]: {
    [PlatformConfigKeys.MEET_EXPORT_FORMAT]: 'pdf',
    audioQuality: 'medium',
    transcriptionEnabled: true,
    speakerIdentificationEnabled: true,
    summaryEnabled: true
  },
  [MeetingPlatform.UNKNOWN]: {
    [PlatformConfigKeys.GENERIC_AUDIO_QUALITY]: 'medium',
    [PlatformConfigKeys.GENERIC_EXPORT_FORMAT]: 'txt',
    audioQuality: 'medium',
    transcriptionEnabled: true,
    speakerIdentificationEnabled: false,
    summaryEnabled: true
  }
};

/**
 * Platform Configuration Manager Class
 */
export class PlatformConfigurationManager {
  constructor(storageService = null, configurationManager = null) {
    this.storageService = storageService;
    this.configurationManager = configurationManager;
    this.platformConfigs = new Map();
    this.configChangeListeners = [];
    this.initialized = false;
    this.syncEnabled = true;
  }

  /**
   * Initialize the configuration manager
   * @returns {Promise<boolean>} Success status
   */
  async initialize() {
    try {
      await this._loadConfigurations();
      this.initialized = true;
      return true;
    } catch (error) {
      console.error('Error initializing platform configuration manager:', error);
      return false;
    }
  }

  /**
   * Get configuration for specific platform
   * @param {string} platform - Platform identifier
   * @returns {object} Platform configuration
   */
  getPlatformConfig(platform) {
    if (!this.platformConfigs.has(platform)) {
      // Return default config if not found
      return { ...DEFAULT_PLATFORM_CONFIGS[platform] } || {};
    }
    
    return { ...this.platformConfigs.get(platform) };
  }

  /**
   * Set configuration for specific platform
   * @param {string} platform - Platform identifier
   * @param {object} config - Configuration object
   * @param {string} userId - User identifier
   * @returns {Promise<boolean>} Success status
   */
  async setPlatformConfig(platform, config, userId = 'default') {
    try {
      const currentConfig = this.getPlatformConfig(platform);
      const newConfig = { ...currentConfig, ...config };
      
      this.platformConfigs.set(platform, newConfig);
      
      // Use ConfigurationManager for persistence if available
      if (this.configurationManager) {
        await this.configurationManager.savePlatformConfig(userId, platform, newConfig);
      } else if (this.storageService) {
        await this.storageService.setItem(`platform_config_${platform}`, newConfig);
      }
      
      // Sync across platforms if enabled
      if (this.syncEnabled && this.configurationManager) {
        await this._syncConfigAcrossPlatforms(userId, platform, newConfig);
      }
      
      this._notifyConfigChange(platform, newConfig);
      return true;
    } catch (error) {
      console.error(`Error setting platform config for ${platform}:`, error);
      return false;
    }
  }

  /**
   * Get specific configuration value for platform
   * @param {string} platform - Platform identifier
   * @param {string} key - Configuration key
   * @param {*} defaultValue - Default value if not found
   * @returns {*} Configuration value
   */
  getPlatformConfigValue(platform, key, defaultValue = null) {
    const config = this.getPlatformConfig(platform);
    return config[key] !== undefined ? config[key] : defaultValue;
  }

  /**
   * Set specific configuration value for platform
   * @param {string} platform - Platform identifier
   * @param {string} key - Configuration key
   * @param {*} value - Configuration value
   * @returns {Promise<boolean>} Success status
   */
  async setPlatformConfigValue(platform, key, value) {
    const config = this.getPlatformConfig(platform);
    config[key] = value;
    return await this.setPlatformConfig(platform, config);
  }

  /**
   * Get configuration based on platform capabilities
   * @param {string} platform - Platform identifier
   * @param {object} capabilities - Platform capabilities
   * @returns {object} Optimized configuration
   */
  getOptimizedConfig(platform, capabilities) {
    const baseConfig = this.getPlatformConfig(platform);
    const optimizedConfig = { ...baseConfig };
    
    // Disable features not supported by platform
    if (!capabilities[PlatformCapabilities.CHAT_INTEGRATION]) {
      optimizedConfig.chatEnabled = false;
    }
    
    if (!capabilities[PlatformCapabilities.PARTICIPANT_INFO]) {
      optimizedConfig.speakerIdentificationEnabled = false;
    }
    
    if (!capabilities[PlatformCapabilities.AGENDA_ACCESS]) {
      optimizedConfig.agendaBasedSummary = false;
    }
    
    // Adjust audio quality based on platform capabilities
    if (capabilities[PlatformCapabilities.AUDIO_QUALITY] === 'low') {
      optimizedConfig.audioQuality = 'low';
    }
    
    return optimizedConfig;
  }

  /**
   * Reset platform configuration to defaults
   * @param {string} platform - Platform identifier
   * @returns {Promise<boolean>} Success status
   */
  async resetPlatformConfig(platform) {
    const defaultConfig = DEFAULT_PLATFORM_CONFIGS[platform] || {};
    return await this.setPlatformConfig(platform, defaultConfig);
  }

  /**
   * Get all platform configurations
   * @returns {object} All platform configurations
   */
  getAllPlatformConfigs() {
    const allConfigs = {};
    
    // Include all known platforms
    Object.keys(DEFAULT_PLATFORM_CONFIGS).forEach(platform => {
      allConfigs[platform] = this.getPlatformConfig(platform);
    });
    
    return allConfigs;
  }

  /**
   * Import platform configurations
   * @param {object} configs - Configuration object
   * @returns {Promise<boolean>} Success status
   */
  async importConfigurations(configs) {
    try {
      for (const [platform, config] of Object.entries(configs)) {
        await this.setPlatformConfig(platform, config);
      }
      return true;
    } catch (error) {
      console.error('Error importing configurations:', error);
      return false;
    }
  }

  /**
   * Export platform configurations
   * @returns {object} Exported configurations
   */
  exportConfigurations() {
    return this.getAllPlatformConfigs();
  }

  /**
   * Validate platform configuration
   * @param {string} platform - Platform identifier
   * @param {object} config - Configuration to validate
   * @returns {object} Validation result
   */
  validatePlatformConfig(platform, config) {
    const errors = [];
    const warnings = [];
    
    // Platform-specific validation
    switch (platform) {
      case MeetingPlatform.TEAMS:
        if (config[PlatformConfigKeys.TEAMS_CHAT_ENABLED] && !config[PlatformConfigKeys.TEAMS_APP_ID]) {
          errors.push('Teams App ID required when chat is enabled');
        }
        break;
        
      case MeetingPlatform.ZOOM:
        if (config[PlatformConfigKeys.ZOOM_CHAT_ENABLED] && !config[PlatformConfigKeys.ZOOM_API_KEY]) {
          errors.push('Zoom API key required when chat is enabled');
        }
        break;
        
      case MeetingPlatform.GOOGLE_MEET:
        if (!config[PlatformConfigKeys.MEET_EXPORT_FORMAT]) {
          warnings.push('Export format not specified, using default');
        }
        break;
    }
    
    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Add configuration change listener
   * @param {function} callback - Callback function
   */
  onConfigChange(callback) {
    this.configChangeListeners.push(callback);
  }

  /**
   * Remove configuration change listener
   * @param {function} callback - Callback function
   */
  removeConfigChangeListener(callback) {
    const index = this.configChangeListeners.indexOf(callback);
    if (index > -1) {
      this.configChangeListeners.splice(index, 1);
    }
  }

  /**
   * Load configurations from storage
   * @private
   */
  async _loadConfigurations() {
    if (!this.storageService) {
      // Use default configurations
      Object.entries(DEFAULT_PLATFORM_CONFIGS).forEach(([platform, config]) => {
        this.platformConfigs.set(platform, { ...config });
      });
      return;
    }

    try {
      for (const platform of Object.keys(DEFAULT_PLATFORM_CONFIGS)) {
        const stored = await this.storageService.getItem(`platform_config_${platform}`);
        if (stored) {
          this.platformConfigs.set(platform, stored);
        } else {
          this.platformConfigs.set(platform, { ...DEFAULT_PLATFORM_CONFIGS[platform] });
        }
      }
    } catch (error) {
      console.error('Error loading platform configurations:', error);
      // Fall back to defaults
      Object.entries(DEFAULT_PLATFORM_CONFIGS).forEach(([platform, config]) => {
        this.platformConfigs.set(platform, { ...config });
      });
    }
  }

  /**
   * Notify configuration change listeners
   * @private
   * @param {string} platform - Platform identifier
   * @param {object} config - New configuration
   */
  _notifyConfigChange(platform, config) {
    this.configChangeListeners.forEach(callback => {
      try {
        callback({ platform, config });
      } catch (error) {
        console.error('Error in config change listener:', error);
      }
    });
  }

  /**
   * Sync configuration across platforms
   * @private
   * @param {string} userId - User identifier
   * @param {string} sourcePlatform - Source platform
   * @param {object} config - Configuration to sync
   */
  async _syncConfigAcrossPlatforms(userId, sourcePlatform, config) {
    if (!this.configurationManager) {
      return;
    }

    try {
      // Get user's sync preferences
      const userConfig = await this.configurationManager.getUserConfig(userId);
      if (!userConfig.crossPlatformSync) {
        return;
      }

      // Extract syncable settings
      const syncableSettings = this._extractSyncableSettings(config);
      
      // Apply to other platforms
      const allPlatforms = Object.keys(DEFAULT_PLATFORM_CONFIGS);
      for (const platform of allPlatforms) {
        if (platform !== sourcePlatform) {
          try {
            const platformConfig = await this.configurationManager.getPlatformConfig(userId, platform);
            const capabilities = this._getPlatformCapabilities(platform);
            
            // Only sync settings that are supported by the target platform
            const compatibleSettings = this._filterByCapabilities(syncableSettings, capabilities);
            
            const updatedConfig = {
              ...platformConfig.config,
              ...compatibleSettings
            };
            
            await this.configurationManager.savePlatformConfig(userId, platform, updatedConfig);
          } catch (error) {
            console.warn(`Failed to sync config to platform ${platform}:`, error);
          }
        }
      }
    } catch (error) {
      console.error('Error syncing config across platforms:', error);
    }
  }

  /**
   * Extract settings that can be synced across platforms
   * @private
   * @param {object} config - Configuration object
   * @returns {object} Syncable settings
   */
  _extractSyncableSettings(config) {
    return {
      transcriptionEnabled: config.transcriptionEnabled,
      speakerIdentificationEnabled: config.speakerIdentificationEnabled,
      summaryEnabled: config.summaryEnabled,
      audioQuality: config.audioQuality,
      language: config.language,
      transcriptionQuality: config.transcriptionQuality
    };
  }

  /**
   * Filter settings by platform capabilities
   * @private
   * @param {object} settings - Settings to filter
   * @param {object} capabilities - Platform capabilities
   * @returns {object} Filtered settings
   */
  _filterByCapabilities(settings, capabilities) {
    const filtered = { ...settings };
    
    // Disable features not supported by platform
    if (!capabilities.participantInfo) {
      filtered.speakerIdentificationEnabled = false;
    }
    
    if (!capabilities.chatIntegration) {
      filtered.chatEnabled = false;
    }
    
    if (!capabilities.agendaAccess) {
      filtered.agendaBasedSummary = false;
    }
    
    // Adjust quality based on platform limitations
    if (capabilities.audioQuality === 'medium' && filtered.audioQuality === 'high') {
      filtered.audioQuality = 'medium';
    }
    
    return filtered;
  }

  /**
   * Get platform capabilities
   * @private
   * @param {string} platform - Platform identifier
   * @returns {object} Platform capabilities
   */
  _getPlatformCapabilities(platform) {
    const capabilities = {
      [MeetingPlatform.TEAMS]: {
        chatIntegration: true,
        agendaAccess: true,
        participantInfo: true,
        hostDetection: true,
        audioQuality: 'high'
      },
      [MeetingPlatform.ZOOM]: {
        chatIntegration: true,
        agendaAccess: false,
        participantInfo: true,
        hostDetection: true,
        audioQuality: 'high'
      },
      [MeetingPlatform.GOOGLE_MEET]: {
        chatIntegration: false,
        agendaAccess: true,
        participantInfo: false,
        hostDetection: false,
        audioQuality: 'medium'
      },
      [MeetingPlatform.UNKNOWN]: {
        chatIntegration: false,
        agendaAccess: false,
        participantInfo: false,
        hostDetection: false,
        audioQuality: 'medium'
      }
    };

    return capabilities[platform] || capabilities[MeetingPlatform.UNKNOWN];
  }

  /**
   * Enable or disable cross-platform synchronization
   * @param {boolean} enabled - Sync enabled status
   */
  setSyncEnabled(enabled) {
    this.syncEnabled = enabled;
  }

  /**
   * Get API keys for specific platform
   * @param {string} platform - Platform identifier
   * @param {string} userId - User identifier
   * @returns {Promise<object>} Platform API keys
   */
  async getPlatformApiKeys(platform, userId = 'default') {
    if (!this.configurationManager) {
      return {};
    }

    try {
      return await this.configurationManager.getPlatformApiKeys(platform);
    } catch (error) {
      console.error(`Error getting API keys for platform ${platform}:`, error);
      return {};
    }
  }

  /**
   * Set API keys for specific platform
   * @param {string} platform - Platform identifier
   * @param {object} apiKeys - API keys object
   * @param {string} userId - User identifier
   * @returns {Promise<boolean>} Success status
   */
  async setPlatformApiKeys(platform, apiKeys, userId = 'default') {
    if (!this.configurationManager) {
      return false;
    }

    try {
      const results = await this.configurationManager.savePlatformApiKeys(platform, apiKeys);
      return Object.values(results).every(result => result === true);
    } catch (error) {
      console.error(`Error setting API keys for platform ${platform}:`, error);
      return false;
    }
  }

  /**
   * Migrate configuration from old format
   * @param {string} userId - User identifier
   * @returns {Promise<boolean>} Migration success
   */
  async migrateConfiguration(userId = 'default') {
    if (!this.configurationManager) {
      return false;
    }

    try {
      return await this.configurationManager.migrateTeamsOnlyConfig(userId);
    } catch (error) {
      console.error('Error migrating configuration:', error);
      return false;
    }
  }

  /**
   * Set configuration manager reference
   * @param {ConfigurationManager} configManager - Configuration manager instance
   */
  setConfigurationManager(configManager) {
    this.configurationManager = configManager;
  }

  /**
   * Cleanup resources
   */
  async cleanup() {
    this.platformConfigs.clear();
    this.configChangeListeners = [];
    this.initialized = false;
  }
}