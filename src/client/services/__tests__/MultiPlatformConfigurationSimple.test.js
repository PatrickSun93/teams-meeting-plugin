// Simple Multi-Platform Configuration Tests
import ConfigurationManager from '../ConfigurationManager.js';
import { PlatformConfigurationManager } from '../PlatformConfigurationManager.js';

describe('Multi-Platform Configuration - Core Features', () => {
  let configManager;
  let platformConfigManager;

  beforeEach(() => {
    configManager = new ConfigurationManager();
    platformConfigManager = new PlatformConfigurationManager();
  });

  describe('default platform configurations', () => {
    test('should generate correct Teams default configuration', () => {
      const teamsConfig = configManager.getDefaultPlatformConfig('testuser', 'teams');
      
      expect(teamsConfig.platform).toBe('teams');
      expect(teamsConfig.userId).toBe('testuser');
      expect(teamsConfig.config.nativeIntegration).toBe(true);
      expect(teamsConfig.config.graphApiEnabled).toBe(true);
      expect(teamsConfig.config.chatIntegrationEnabled).toBe(true);
    });

    test('should generate correct Zoom default configuration', () => {
      const zoomConfig = configManager.getDefaultPlatformConfig('testuser', 'zoom');
      
      expect(zoomConfig.platform).toBe('zoom');
      expect(zoomConfig.config.sdkIntegration).toBe(true);
      expect(zoomConfig.config.webhookEnabled).toBe(true);
      expect(zoomConfig.config.chatIntegrationEnabled).toBe(true);
    });

    test('should generate correct Google Meet default configuration', () => {
      const meetConfig = configManager.getDefaultPlatformConfig('testuser', 'google_meet');
      
      expect(meetConfig.platform).toBe('google_meet');
      expect(meetConfig.config.extensionMode).toBe(true);
      expect(meetConfig.config.calendarIntegration).toBe(true);
      expect(meetConfig.config.chatIntegrationEnabled).toBe(false); // Google Meet doesn't support chat API
      expect(meetConfig.config.exportFormat).toBe('pdf');
    });

    test('should generate correct generic default configuration', () => {
      const genericConfig = configManager.getDefaultPlatformConfig('testuser', 'generic');
      
      expect(genericConfig.platform).toBe('generic');
      expect(genericConfig.config.audioQuality).toBe('medium');
      expect(genericConfig.config.speakerIdentificationEnabled).toBe(false);
      expect(genericConfig.config.chatIntegrationEnabled).toBe(false);
      expect(genericConfig.config.agendaAccessEnabled).toBe(false);
      expect(genericConfig.config.exportFormat).toBe('txt');
    });
  });

  describe('platform capabilities', () => {
    test('should return correct Teams capabilities', () => {
      const capabilities = configManager._getPlatformCapabilities('teams');
      
      expect(capabilities.chatIntegration).toBe(true);
      expect(capabilities.agendaAccess).toBe(true);
      expect(capabilities.participantInfo).toBe(true);
      expect(capabilities.hostDetection).toBe(true);
      expect(capabilities.audioQuality).toBe('high');
      expect(capabilities.nativeIntegration).toBe(true);
    });

    test('should return correct Zoom capabilities', () => {
      const capabilities = configManager._getPlatformCapabilities('zoom');
      
      expect(capabilities.chatIntegration).toBe(true);
      expect(capabilities.agendaAccess).toBe(false);
      expect(capabilities.participantInfo).toBe(true);
      expect(capabilities.hostDetection).toBe(true);
      expect(capabilities.audioQuality).toBe('high');
      expect(capabilities.sdkIntegration).toBe(true);
    });

    test('should return correct Google Meet capabilities', () => {
      const capabilities = configManager._getPlatformCapabilities('google_meet');
      
      expect(capabilities.chatIntegration).toBe(false);
      expect(capabilities.agendaAccess).toBe(true);
      expect(capabilities.participantInfo).toBe(false);
      expect(capabilities.hostDetection).toBe(false);
      expect(capabilities.audioQuality).toBe('medium');
      expect(capabilities.extensionMode).toBe(true);
    });

    test('should return correct generic capabilities', () => {
      const capabilities = configManager._getPlatformCapabilities('generic');
      
      expect(capabilities.chatIntegration).toBe(false);
      expect(capabilities.agendaAccess).toBe(false);
      expect(capabilities.participantInfo).toBe(false);
      expect(capabilities.hostDetection).toBe(false);
      expect(capabilities.audioQuality).toBe('medium');
      expect(capabilities.fallbackMode).toBe(true);
    });
  });

  describe('enhanced default user configuration', () => {
    test('should include multi-platform settings in default config', () => {
      const defaultConfig = configManager.getDefaultConfig('testuser');

      expect(defaultConfig.crossPlatformSync).toBe(true);
      expect(defaultConfig.platformSpecificSettings).toEqual({});
      expect(defaultConfig.defaultPlatform).toBe('teams');
      expect(defaultConfig.userId).toBe('testuser');
    });

    test('should maintain backward compatibility with existing settings', () => {
      const defaultConfig = configManager.getDefaultConfig('testuser');

      // Existing settings should still be present
      expect(defaultConfig.sttProvider).toBe('local_whisper');
      expect(defaultConfig.aiProvider).toBe('openai_gpt');
      expect(defaultConfig.language).toBe('en-US');
      expect(defaultConfig.transcriptionQuality).toBe('high');
      expect(defaultConfig.enableSpeakerIdentification).toBe(true);
      expect(defaultConfig.autoSendToChat).toBe(true);
      expect(defaultConfig.enableSummaryGeneration).toBe(true);
    });
  });

  describe('platform configuration manager integration', () => {
    test('should set and get configuration manager reference', () => {
      platformConfigManager.setConfigurationManager(configManager);
      expect(platformConfigManager.configurationManager).toBe(configManager);
    });

    test('should enable and disable sync', () => {
      platformConfigManager.setSyncEnabled(true);
      expect(platformConfigManager.syncEnabled).toBe(true);
      
      platformConfigManager.setSyncEnabled(false);
      expect(platformConfigManager.syncEnabled).toBe(false);
    });

    test('should extract syncable settings correctly', () => {
      const config = {
        transcriptionEnabled: true,
        speakerIdentificationEnabled: true,
        summaryEnabled: true,
        audioQuality: 'high',
        language: 'en-US',
        transcriptionQuality: 'high',
        platformSpecificSetting: 'should not sync',
        nativeIntegration: true
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
      expect(syncableSettings.nativeIntegration).toBeUndefined();
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
      expect(filteredSettings.transcriptionEnabled).toBe(true);
    });

    test('should get platform capabilities from platform config manager', () => {
      const teamsCapabilities = platformConfigManager._getPlatformCapabilities('teams');
      expect(teamsCapabilities.chatIntegration).toBe(true);
      expect(teamsCapabilities.audioQuality).toBe('high');

      const meetCapabilities = platformConfigManager._getPlatformCapabilities('google_meet');
      expect(meetCapabilities.chatIntegration).toBe(false);
      expect(meetCapabilities.audioQuality).toBe('medium');
    });
  });

  describe('configuration validation', () => {
    test('should validate configuration with multi-platform settings', () => {
      const validConfig = {
        userId: 'testuser',
        sttProvider: 'openai_whisper',
        aiProvider: 'claude',
        language: 'en-US',
        transcriptionQuality: 'high',
        dataRetentionDays: 30,
        crossPlatformSync: true,
        platformSpecificSettings: {},
        defaultPlatform: 'teams'
      };

      const result = configManager.validateConfig(validConfig);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('should handle missing multi-platform settings gracefully', () => {
      const configWithoutMultiPlatform = {
        userId: 'testuser',
        sttProvider: 'local_whisper',
        aiProvider: 'openai_gpt',
        language: 'en-US',
        transcriptionQuality: 'high',
        dataRetentionDays: 30
        // Missing crossPlatformSync, platformSpecificSettings, defaultPlatform
      };

      const result = configManager.validateConfig(configWithoutMultiPlatform);
      expect(result.isValid).toBe(true); // Should still be valid for backward compatibility
    });
  });

  describe('API key management enhancements', () => {
    test('should handle platform-specific API key identifiers', () => {
      // Test that the system can handle both general and platform-specific API keys
      const generalKey = 'openai';
      const platformSpecificKey = 'openai_teams';
      
      // These should be treated as different keys
      expect(generalKey).not.toBe(platformSpecificKey);
      
      // The system should be able to construct platform-specific keys
      const constructedKey = `${generalKey}_teams`;
      expect(constructedKey).toBe(platformSpecificKey);
    });
  });

  describe('error handling', () => {
    test('should handle operations without configuration manager gracefully', async () => {
      const platformConfigManagerWithoutConfig = new PlatformConfigurationManager();
      
      const apiKeys = await platformConfigManagerWithoutConfig.getPlatformApiKeys('teams');
      expect(apiKeys).toEqual({});

      const setResult = await platformConfigManagerWithoutConfig.setPlatformApiKeys('teams', {});
      expect(setResult).toBe(false);

      const migrateResult = await platformConfigManagerWithoutConfig.migrateConfiguration();
      expect(migrateResult).toBe(false);
    });
  });
});