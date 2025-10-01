/**
 * Platform Configuration Manager Tests
 * Tests for the PlatformConfigurationManager class
 */

import { 
  PlatformConfigurationManager, 
  PlatformConfigKeys 
} from '../PlatformConfigurationManager.js';
import { MeetingPlatform, PlatformCapabilities } from '../PlatformAdapter.js';

// Mock storage service
class MockStorageService {
  constructor() {
    this.storage = new Map();
  }

  async getItem(key) {
    return this.storage.get(key) || null;
  }

  async setItem(key, value) {
    this.storage.set(key, value);
  }

  async removeItem(key) {
    this.storage.delete(key);
  }

  clear() {
    this.storage.clear();
  }
}

describe('PlatformConfigurationManager', () => {
  let configManager;
  let mockStorage;

  beforeEach(() => {
    mockStorage = new MockStorageService();
    configManager = new PlatformConfigurationManager(mockStorage);
  });

  afterEach(async () => {
    await configManager.cleanup();
  });

  describe('Initialization', () => {
    test('should initialize successfully', async () => {
      const result = await configManager.initialize();

      expect(result).toBe(true);
      expect(configManager.initialized).toBe(true);
    });

    test('should load default configurations', async () => {
      await configManager.initialize();

      const teamsConfig = configManager.getPlatformConfig(MeetingPlatform.TEAMS);
      expect(teamsConfig).toHaveProperty('transcriptionEnabled', true);
      expect(teamsConfig).toHaveProperty('audioQuality', 'high');
    });

    test('should load configurations from storage', async () => {
      const customConfig = {
        transcriptionEnabled: false,
        customSetting: 'test'
      };
      await mockStorage.setItem(`platform_config_${MeetingPlatform.TEAMS}`, customConfig);

      await configManager.initialize();

      const teamsConfig = configManager.getPlatformConfig(MeetingPlatform.TEAMS);
      expect(teamsConfig.transcriptionEnabled).toBe(false);
      expect(teamsConfig.customSetting).toBe('test');
    });

    test('should handle storage errors gracefully', async () => {
      mockStorage.getItem = jest.fn().mockRejectedValue(new Error('Storage error'));

      const result = await configManager.initialize();

      expect(result).toBe(true);
      // Should fall back to defaults
      const teamsConfig = configManager.getPlatformConfig(MeetingPlatform.TEAMS);
      expect(teamsConfig).toHaveProperty('transcriptionEnabled', true);
    });

    test('should work without storage service', async () => {
      configManager = new PlatformConfigurationManager();

      const result = await configManager.initialize();

      expect(result).toBe(true);
      const teamsConfig = configManager.getPlatformConfig(MeetingPlatform.TEAMS);
      expect(teamsConfig).toHaveProperty('transcriptionEnabled', true);
    });
  });

  describe('Platform Configuration', () => {
    beforeEach(async () => {
      await configManager.initialize();
    });

    test('should get platform configuration', () => {
      const config = configManager.getPlatformConfig(MeetingPlatform.TEAMS);

      expect(config).toHaveProperty('transcriptionEnabled', true);
      expect(config).toHaveProperty('audioQuality', 'high');
      expect(config).toHaveProperty(PlatformConfigKeys.TEAMS_CHAT_ENABLED, true);
    });

    test('should return default config for unknown platform', () => {
      const config = configManager.getPlatformConfig('unknown-platform');
      expect(config).toEqual({});
    });

    test('should set platform configuration', async () => {
      const newConfig = {
        transcriptionEnabled: false,
        customSetting: 'test'
      };

      const result = await configManager.setPlatformConfig(MeetingPlatform.TEAMS, newConfig);

      expect(result).toBe(true);
      const config = configManager.getPlatformConfig(MeetingPlatform.TEAMS);
      expect(config.transcriptionEnabled).toBe(false);
      expect(config.customSetting).toBe('test');
    });

    test('should merge configurations when setting', async () => {
      const originalConfig = configManager.getPlatformConfig(MeetingPlatform.TEAMS);
      const newConfig = { customSetting: 'test' };

      await configManager.setPlatformConfig(MeetingPlatform.TEAMS, newConfig);

      const config = configManager.getPlatformConfig(MeetingPlatform.TEAMS);
      expect(config.transcriptionEnabled).toBe(originalConfig.transcriptionEnabled);
      expect(config.customSetting).toBe('test');
    });

    test('should persist configuration to storage', async () => {
      const newConfig = { customSetting: 'test' };

      await configManager.setPlatformConfig(MeetingPlatform.TEAMS, newConfig);

      const stored = await mockStorage.getItem(`platform_config_${MeetingPlatform.TEAMS}`);
      expect(stored.customSetting).toBe('test');
    });

    test('should handle storage errors when setting config', async () => {
      mockStorage.setItem = jest.fn().mockRejectedValue(new Error('Storage error'));

      const result = await configManager.setPlatformConfig(MeetingPlatform.TEAMS, {});

      expect(result).toBe(false);
    });
  });

  describe('Configuration Values', () => {
    beforeEach(async () => {
      await configManager.initialize();
    });

    test('should get specific configuration value', () => {
      const value = configManager.getPlatformConfigValue(
        MeetingPlatform.TEAMS, 
        'transcriptionEnabled'
      );

      expect(value).toBe(true);
    });

    test('should return default value for missing key', () => {
      const value = configManager.getPlatformConfigValue(
        MeetingPlatform.TEAMS, 
        'nonexistentKey', 
        'default'
      );

      expect(value).toBe('default');
    });

    test('should set specific configuration value', async () => {
      const result = await configManager.setPlatformConfigValue(
        MeetingPlatform.TEAMS, 
        'customKey', 
        'customValue'
      );

      expect(result).toBe(true);
      const value = configManager.getPlatformConfigValue(
        MeetingPlatform.TEAMS, 
        'customKey'
      );
      expect(value).toBe('customValue');
    });
  });

  describe('Optimized Configuration', () => {
    beforeEach(async () => {
      await configManager.initialize();
    });

    test('should optimize config based on capabilities', () => {
      const capabilities = {
        [PlatformCapabilities.CHAT_INTEGRATION]: false,
        [PlatformCapabilities.PARTICIPANT_INFO]: false,
        [PlatformCapabilities.AGENDA_ACCESS]: false,
        [PlatformCapabilities.AUDIO_QUALITY]: 'low'
      };

      const optimizedConfig = configManager.getOptimizedConfig(
        MeetingPlatform.TEAMS, 
        capabilities
      );

      expect(optimizedConfig.chatEnabled).toBe(false);
      expect(optimizedConfig.speakerIdentificationEnabled).toBe(false);
      expect(optimizedConfig.agendaBasedSummary).toBe(false);
      expect(optimizedConfig.audioQuality).toBe('low');
    });

    test('should preserve enabled features when supported', () => {
      const capabilities = {
        [PlatformCapabilities.CHAT_INTEGRATION]: true,
        [PlatformCapabilities.PARTICIPANT_INFO]: true,
        [PlatformCapabilities.AGENDA_ACCESS]: true,
        [PlatformCapabilities.AUDIO_QUALITY]: 'high'
      };

      const optimizedConfig = configManager.getOptimizedConfig(
        MeetingPlatform.TEAMS, 
        capabilities
      );

      expect(optimizedConfig.chatEnabled).not.toBe(false);
      expect(optimizedConfig.speakerIdentificationEnabled).not.toBe(false);
      expect(optimizedConfig.agendaBasedSummary).not.toBe(false);
    });
  });

  describe('Configuration Reset', () => {
    beforeEach(async () => {
      await configManager.initialize();
    });

    test('should reset platform configuration to defaults', async () => {
      // Modify configuration
      await configManager.setPlatformConfigValue(MeetingPlatform.TEAMS, 'customKey', 'customValue');

      // Reset
      const result = await configManager.resetPlatformConfig(MeetingPlatform.TEAMS);

      expect(result).toBe(true);
      const config = configManager.getPlatformConfig(MeetingPlatform.TEAMS);
      expect(config.customKey).toBeUndefined();
      expect(config.transcriptionEnabled).toBe(true); // Default value
    });
  });

  describe('All Platform Configurations', () => {
    beforeEach(async () => {
      await configManager.initialize();
    });

    test('should get all platform configurations', () => {
      const allConfigs = configManager.getAllPlatformConfigs();

      expect(allConfigs).toHaveProperty(MeetingPlatform.TEAMS);
      expect(allConfigs).toHaveProperty(MeetingPlatform.ZOOM);
      expect(allConfigs).toHaveProperty(MeetingPlatform.GOOGLE_MEET);
      expect(allConfigs).toHaveProperty(MeetingPlatform.UNKNOWN);
    });
  });

  describe('Import/Export', () => {
    beforeEach(async () => {
      await configManager.initialize();
    });

    test('should export configurations', () => {
      const exported = configManager.exportConfigurations();

      expect(exported).toHaveProperty(MeetingPlatform.TEAMS);
      expect(exported).toHaveProperty(MeetingPlatform.ZOOM);
    });

    test('should import configurations', async () => {
      const configs = {
        [MeetingPlatform.TEAMS]: {
          transcriptionEnabled: false,
          customSetting: 'imported'
        },
        [MeetingPlatform.ZOOM]: {
          audioQuality: 'low'
        }
      };

      const result = await configManager.importConfigurations(configs);

      expect(result).toBe(true);
      const teamsConfig = configManager.getPlatformConfig(MeetingPlatform.TEAMS);
      expect(teamsConfig.transcriptionEnabled).toBe(false);
      expect(teamsConfig.customSetting).toBe('imported');
    });

    test('should handle import errors', async () => {
      configManager.setPlatformConfig = jest.fn().mockRejectedValue(new Error('Import error'));

      const result = await configManager.importConfigurations({});

      expect(result).toBe(false);
    });
  });

  describe('Configuration Validation', () => {
    test('should validate Teams configuration', () => {
      const validConfig = {
        [PlatformConfigKeys.TEAMS_CHAT_ENABLED]: true,
        [PlatformConfigKeys.TEAMS_APP_ID]: 'app-123'
      };

      const result = configManager.validatePlatformConfig(MeetingPlatform.TEAMS, validConfig);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('should detect Teams validation errors', () => {
      const invalidConfig = {
        [PlatformConfigKeys.TEAMS_CHAT_ENABLED]: true
        // Missing TEAMS_APP_ID
      };

      const result = configManager.validatePlatformConfig(MeetingPlatform.TEAMS, invalidConfig);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Teams App ID required when chat is enabled');
    });

    test('should validate Zoom configuration', () => {
      const invalidConfig = {
        [PlatformConfigKeys.ZOOM_CHAT_ENABLED]: true
        // Missing ZOOM_API_KEY
      };

      const result = configManager.validatePlatformConfig(MeetingPlatform.ZOOM, invalidConfig);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Zoom API key required when chat is enabled');
    });

    test('should generate warnings for Google Meet', () => {
      const config = {};

      const result = configManager.validatePlatformConfig(MeetingPlatform.GOOGLE_MEET, config);

      expect(result.isValid).toBe(true);
      expect(result.warnings).toContain('Export format not specified, using default');
    });
  });

  describe('Event Handling', () => {
    beforeEach(async () => {
      await configManager.initialize();
    });

    test('should add configuration change listeners', () => {
      const callback = jest.fn();
      configManager.onConfigChange(callback);

      expect(configManager.configChangeListeners).toContain(callback);
    });

    test('should remove configuration change listeners', () => {
      const callback = jest.fn();
      configManager.onConfigChange(callback);
      configManager.removeConfigChangeListener(callback);

      expect(configManager.configChangeListeners).not.toContain(callback);
    });

    test('should notify listeners on configuration change', async () => {
      const callback = jest.fn();
      configManager.onConfigChange(callback);

      const newConfig = { customSetting: 'test' };
      await configManager.setPlatformConfig(MeetingPlatform.TEAMS, newConfig);

      expect(callback).toHaveBeenCalledWith({
        platform: MeetingPlatform.TEAMS,
        config: expect.objectContaining({ customSetting: 'test' })
      });
    });

    test('should handle errors in change listeners', async () => {
      const errorCallback = jest.fn(() => {
        throw new Error('Listener error');
      });
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      configManager.onConfigChange(errorCallback);
      await configManager.setPlatformConfig(MeetingPlatform.TEAMS, {});

      expect(consoleErrorSpy).toHaveBeenCalled();
      consoleErrorSpy.mockRestore();
    });
  });

  describe('Cleanup', () => {
    beforeEach(async () => {
      await configManager.initialize();
    });

    test('should cleanup resources', async () => {
      const callback = jest.fn();
      configManager.onConfigChange(callback);

      await configManager.cleanup();

      expect(configManager.platformConfigs.size).toBe(0);
      expect(configManager.configChangeListeners).toEqual([]);
      expect(configManager.initialized).toBe(false);
    });
  });
});

describe('PlatformConfigKeys', () => {
  test('should have correct Teams keys', () => {
    expect(PlatformConfigKeys.TEAMS_TENANT_ID).toBe('teams.tenantId');
    expect(PlatformConfigKeys.TEAMS_APP_ID).toBe('teams.appId');
    expect(PlatformConfigKeys.TEAMS_CHAT_ENABLED).toBe('teams.chatEnabled');
    expect(PlatformConfigKeys.TEAMS_GRAPH_API_KEY).toBe('teams.graphApiKey');
  });

  test('should have correct Zoom keys', () => {
    expect(PlatformConfigKeys.ZOOM_API_KEY).toBe('zoom.apiKey');
    expect(PlatformConfigKeys.ZOOM_API_SECRET).toBe('zoom.apiSecret');
    expect(PlatformConfigKeys.ZOOM_WEBHOOK_SECRET).toBe('zoom.webhookSecret');
    expect(PlatformConfigKeys.ZOOM_CHAT_ENABLED).toBe('zoom.chatEnabled');
  });

  test('should have correct Google Meet keys', () => {
    expect(PlatformConfigKeys.MEET_EXTENSION_ID).toBe('meet.extensionId');
    expect(PlatformConfigKeys.MEET_CALENDAR_API_KEY).toBe('meet.calendarApiKey');
    expect(PlatformConfigKeys.MEET_EXPORT_FORMAT).toBe('meet.exportFormat');
  });

  test('should have correct generic keys', () => {
    expect(PlatformConfigKeys.GENERIC_AUDIO_QUALITY).toBe('generic.audioQuality');
    expect(PlatformConfigKeys.GENERIC_EXPORT_FORMAT).toBe('generic.exportFormat');
  });
});

// Enhanced Multi-Platform Configuration Manager Tests
describe('Enhanced Multi-Platform Features', () => {
  let platformConfigManager;
  let mockConfigurationManager;
  let mockStorageService;

  beforeEach(() => {
    mockConfigurationManager = {
      getUserConfig: jest.fn(),
      getPlatformConfig: jest.fn(),
      savePlatformConfig: jest.fn(),
      getPlatformApiKeys: jest.fn(),
      savePlatformApiKeys: jest.fn(),
      migrateTeamsOnlyConfig: jest.fn()
    };

    mockStorageService = {
      getItem: jest.fn(),
      setItem: jest.fn()
    };

    platformConfigManager = new PlatformConfigurationManager(mockStorageService, mockConfigurationManager);
  });

  describe('cross-platform synchronization', () => {
    test('should sync configuration across platforms when enabled', async () => {
      const userConfig = { crossPlatformSync: true };
      const platformConfig = {
        config: {
          transcriptionEnabled: true,
          speakerIdentificationEnabled: true,
          audioQuality: 'high'
        }
      };

      mockConfigurationManager.getUserConfig.mockResolvedValue(userConfig);
      mockConfigurationManager.getPlatformConfig.mockResolvedValue(platformConfig);
      mockConfigurationManager.savePlatformConfig.mockResolvedValue(true);

      platformConfigManager.setSyncEnabled(true);

      const result = await platformConfigManager.setPlatformConfig('teams', { enabled: true }, 'testuser');

      expect(result).toBe(true);
      expect(mockConfigurationManager.savePlatformConfig).toHaveBeenCalledTimes(4); // teams + 3 other platforms
    });

    test('should not sync when synchronization is disabled', async () => {
      platformConfigManager.setSyncEnabled(false);

      mockConfigurationManager.savePlatformConfig.mockResolvedValue(true);

      const result = await platformConfigManager.setPlatformConfig('teams', { enabled: true }, 'testuser');

      expect(result).toBe(true);
      expect(mockConfigurationManager.savePlatformConfig).toHaveBeenCalledTimes(1); // Only the target platform
    });

    test('should filter settings by platform capabilities during sync', async () => {
      const userConfig = { crossPlatformSync: true };
      const platformConfig = {
        config: {
          transcriptionEnabled: true,
          speakerIdentificationEnabled: true,
          chatEnabled: true
        }
      };

      mockConfigurationManager.getUserConfig.mockResolvedValue(userConfig);
      mockConfigurationManager.getPlatformConfig.mockResolvedValue(platformConfig);
      mockConfigurationManager.savePlatformConfig.mockResolvedValue(true);

      platformConfigManager.setSyncEnabled(true);

      await platformConfigManager.setPlatformConfig('teams', { chatEnabled: true }, 'testuser');

      // Check that Google Meet config doesn't include chat (not supported)
      const googleMeetCall = mockConfigurationManager.savePlatformConfig.mock.calls
        .find(call => call[1] === MeetingPlatform.GOOGLE_MEET);
      
      expect(googleMeetCall[2].chatEnabled).toBe(false);
    });
  });

  describe('platform-specific API key management', () => {
    test('should get API keys for specific platform', async () => {
      const mockApiKeys = {
        openai: 'openai-key',
        azure: 'azure-key'
      };

      mockConfigurationManager.getPlatformApiKeys.mockResolvedValue(mockApiKeys);

      const apiKeys = await platformConfigManager.getPlatformApiKeys('teams', 'testuser');

      expect(apiKeys).toEqual(mockApiKeys);
      expect(mockConfigurationManager.getPlatformApiKeys).toHaveBeenCalledWith('teams');
    });

    test('should set API keys for specific platform', async () => {
      const apiKeys = {
        openai: 'new-openai-key',
        azure: 'new-azure-key'
      };

      mockConfigurationManager.savePlatformApiKeys.mockResolvedValue({
        openai: true,
        azure: true
      });

      const result = await platformConfigManager.setPlatformApiKeys('teams', apiKeys, 'testuser');

      expect(result).toBe(true);
      expect(mockConfigurationManager.savePlatformApiKeys).toHaveBeenCalledWith('teams', apiKeys);
    });

    test('should handle API key save failures', async () => {
      const apiKeys = {
        openai: 'new-openai-key',
        azure: 'new-azure-key'
      };

      mockConfigurationManager.savePlatformApiKeys.mockResolvedValue({
        openai: true,
        azure: false // One failed
      });

      const result = await platformConfigManager.setPlatformApiKeys('teams', apiKeys, 'testuser');

      expect(result).toBe(false);
    });
  });

  describe('configuration migration', () => {
    test('should migrate configuration successfully', async () => {
      mockConfigurationManager.migrateTeamsOnlyConfig.mockResolvedValue(true);

      const result = await platformConfigManager.migrateConfiguration('testuser');

      expect(result).toBe(true);
      expect(mockConfigurationManager.migrateTeamsOnlyConfig).toHaveBeenCalledWith('testuser');
    });

    test('should handle migration errors', async () => {
      mockConfigurationManager.migrateTeamsOnlyConfig.mockRejectedValue(new Error('Migration failed'));

      const result = await platformConfigManager.migrateConfiguration('testuser');

      expect(result).toBe(false);
    });
  });

  describe('platform capability filtering', () => {
    test('should extract syncable settings correctly', () => {
      const config = {
        transcriptionEnabled: true,
        speakerIdentificationEnabled: true,
        summaryEnabled: true,
        audioQuality: 'high',
        language: 'en-US',
        transcriptionQuality: 'high',
        platformSpecificSetting: 'should not sync'
      };

      const syncableSettings = platformConfigManager._extractSyncableSettings(config);

      expect(syncableSettings).toEqual({
        transcriptionEnabled: true,
        speakerIdentificationEnabled: true,
        summaryEnabled: true,
        audioQuality: 'high',
        language: 'en-US',
        transcriptionQuality: 'high'
      });
      expect(syncableSettings.platformSpecificSetting).toBeUndefined();
    });

    test('should filter settings by platform capabilities', () => {
      const settings = {
        transcriptionEnabled: true,
        speakerIdentificationEnabled: true,
        chatEnabled: true,
        agendaBasedSummary: true,
        audioQuality: 'high'
      };

      const googleMeetCapabilities = {
        participantInfo: false,
        chatIntegration: false,
        agendaAccess: true,
        audioQuality: 'medium'
      };

      const filteredSettings = platformConfigManager._filterByCapabilities(settings, googleMeetCapabilities);

      expect(filteredSettings.speakerIdentificationEnabled).toBe(false);
      expect(filteredSettings.chatEnabled).toBe(false);
      expect(filteredSettings.audioQuality).toBe('medium');
      expect(filteredSettings.agendaBasedSummary).toBe(true);
    });

    test('should get correct platform capabilities', () => {
      const teamsCapabilities = platformConfigManager._getPlatformCapabilities(MeetingPlatform.TEAMS);
      expect(teamsCapabilities.chatIntegration).toBe(true);
      expect(teamsCapabilities.agendaAccess).toBe(true);
      expect(teamsCapabilities.audioQuality).toBe('high');

      const zoomCapabilities = platformConfigManager._getPlatformCapabilities(MeetingPlatform.ZOOM);
      expect(zoomCapabilities.chatIntegration).toBe(true);
      expect(zoomCapabilities.agendaAccess).toBe(false);
      expect(zoomCapabilities.audioQuality).toBe('high');

      const meetCapabilities = platformConfigManager._getPlatformCapabilities(MeetingPlatform.GOOGLE_MEET);
      expect(meetCapabilities.chatIntegration).toBe(false);
      expect(meetCapabilities.agendaAccess).toBe(true);
      expect(meetCapabilities.audioQuality).toBe('medium');

      const genericCapabilities = platformConfigManager._getPlatformCapabilities(MeetingPlatform.UNKNOWN);
      expect(genericCapabilities.chatIntegration).toBe(false);
      expect(genericCapabilities.agendaAccess).toBe(false);
      expect(genericCapabilities.audioQuality).toBe('medium');
    });
  });

  describe('configuration manager integration', () => {
    test('should set configuration manager reference', () => {
      const newConfigManager = { test: 'manager' };
      
      platformConfigManager.setConfigurationManager(newConfigManager);
      
      expect(platformConfigManager.configurationManager).toBe(newConfigManager);
    });

    test('should handle operations without configuration manager', async () => {
      platformConfigManager.setConfigurationManager(null);

      const apiKeys = await platformConfigManager.getPlatformApiKeys('teams');
      expect(apiKeys).toEqual({});

      const setResult = await platformConfigManager.setPlatformApiKeys('teams', {});
      expect(setResult).toBe(false);

      const migrateResult = await platformConfigManager.migrateConfiguration();
      expect(migrateResult).toBe(false);
    });
  });

  describe('error handling', () => {
    test('should handle configuration save errors gracefully', async () => {
      mockConfigurationManager.savePlatformConfig.mockRejectedValue(new Error('Save failed'));

      const result = await platformConfigManager.setPlatformConfig('teams', { enabled: true }, 'testuser');

      expect(result).toBe(false);
    });

    test('should handle API key retrieval errors gracefully', async () => {
      mockConfigurationManager.getPlatformApiKeys.mockRejectedValue(new Error('Retrieval failed'));

      const apiKeys = await platformConfigManager.getPlatformApiKeys('teams');

      expect(apiKeys).toEqual({});
    });

    test('should handle sync errors gracefully', async () => {
      const userConfig = { crossPlatformSync: true };
      mockConfigurationManager.getUserConfig.mockResolvedValue(userConfig);
      mockConfigurationManager.getPlatformConfig.mockRejectedValue(new Error('Platform config error'));
      mockConfigurationManager.savePlatformConfig.mockResolvedValue(true);

      platformConfigManager.setSyncEnabled(true);

      // Should not throw error, should handle gracefully
      const result = await platformConfigManager.setPlatformConfig('teams', { enabled: true }, 'testuser');

      expect(result).toBe(true);
    });
  });
});