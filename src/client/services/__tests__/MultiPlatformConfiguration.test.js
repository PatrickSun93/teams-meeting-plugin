// Multi-Platform Configuration Tests
import ConfigurationManager from '../ConfigurationManager.js';
import { PlatformConfigurationManager } from '../PlatformConfigurationManager.js';

// Mock IndexedDB
const mockIndexedDB = {
  open: jest.fn(),
  databases: new Map()
};

const mockTransaction = {
  objectStore: jest.fn(),
  oncomplete: null,
  onerror: null
};

const mockObjectStore = {
  get: jest.fn(),
  put: jest.fn(),
  delete: jest.fn(),
  clear: jest.fn(),
  createIndex: jest.fn(),
  index: jest.fn()
};

const mockRequest = {
  onsuccess: null,
  onerror: null,
  result: null
};

// Setup IndexedDB mock
beforeAll(() => {
  global.indexedDB = mockIndexedDB;
  global.btoa = (str) => Buffer.from(str).toString('base64');
  global.atob = (str) => Buffer.from(str, 'base64').toString();
});

beforeEach(() => {
  jest.clearAllMocks();
  
  // Reset mock implementations
  mockIndexedDB.open.mockImplementation(() => {
    const request = { ...mockRequest };
    setTimeout(() => {
      if (request.onupgradeneeded) {
        const mockDB = {
          objectStoreNames: { contains: () => false },
          createObjectStore: () => mockObjectStore
        };
        request.onupgradeneeded({ target: { result: mockDB }, oldVersion: 0 });
      }
      if (request.onsuccess) {
        const mockDB = {
          objectStoreNames: { contains: () => true },
          transaction: () => mockTransaction
        };
        request.onsuccess({ target: { result: mockDB } });
      }
    }, 0);
    return request;
  });

  mockTransaction.objectStore.mockReturnValue(mockObjectStore);
  mockObjectStore.get.mockReturnValue({ ...mockRequest });
  mockObjectStore.put.mockReturnValue({ ...mockRequest });
  mockObjectStore.delete.mockReturnValue({ ...mockRequest });
  mockObjectStore.clear.mockReturnValue({ ...mockRequest });
  mockObjectStore.index.mockReturnValue({
    getAll: jest.fn().mockReturnValue({ ...mockRequest })
  });
});

describe('Multi-Platform Configuration Manager', () => {
  let configManager;
  let platformConfigManager;

  beforeEach(() => {
    configManager = new ConfigurationManager();
    platformConfigManager = new PlatformConfigurationManager(null, configManager);
    
    // Mock successful initialization
    const mockDB = {
      objectStoreNames: { contains: () => true },
      transaction: () => mockTransaction
    };
    configManager.db = mockDB;
    configManager.initialized = true;
  });

  describe('platform-specific configuration', () => {
    test('should get default platform configuration for Teams', () => {
      const teamsConfig = configManager.getDefaultPlatformConfig('testuser', 'teams');
      
      expect(teamsConfig.platform).toBe('teams');
      expect(teamsConfig.userId).toBe('testuser');
      expect(teamsConfig.config.nativeIntegration).toBe(true);
      expect(teamsConfig.config.graphApiEnabled).toBe(true);
    });

    test('should get default platform configuration for Zoom', () => {
      const zoomConfig = configManager.getDefaultPlatformConfig('testuser', 'zoom');
      
      expect(zoomConfig.platform).toBe('zoom');
      expect(zoomConfig.config.sdkIntegration).toBe(true);
      expect(zoomConfig.config.webhookEnabled).toBe(true);
    });

    test('should get default platform configuration for Google Meet', () => {
      const meetConfig = configManager.getDefaultPlatformConfig('testuser', 'google_meet');
      
      expect(meetConfig.platform).toBe('google_meet');
      expect(meetConfig.config.extensionMode).toBe(true);
      expect(meetConfig.config.calendarIntegration).toBe(true);
      expect(meetConfig.config.chatIntegrationEnabled).toBe(false);
    });

    test('should save platform configuration', async () => {
      const platformConfig = {
        enabled: true,
        audioQuality: 'high',
        transcriptionEnabled: true
      };

      mockObjectStore.put.mockImplementation(() => {
        const request = { ...mockRequest };
        setTimeout(() => {
          if (request.onsuccess) request.onsuccess();
        }, 0);
        return request;
      });

      const result = await configManager.savePlatformConfig('testuser', 'teams', platformConfig);

      expect(result.platform).toBe('teams');
      expect(result.userId).toBe('testuser');
      expect(result.config).toEqual(platformConfig);
    });
  });

  describe('platform-specific API keys', () => {
    test('should save platform-specific API key', async () => {
      mockObjectStore.put.mockReturnValue({
        onsuccess: null,
        onerror: null
      });

      const result = await configManager.saveApiKey('openai', 'test-key', 'teams');

      // Trigger success callback
      const putRequest = mockObjectStore.put();
      setTimeout(() => putRequest.onsuccess(), 0);

      expect(result).toBe(true);
      expect(mockObjectStore.put).toHaveBeenCalledWith({
        id: 'openai_teams',
        service: 'openai',
        platform: 'teams',
        encryptedKey: expect.any(String),
        updatedAt: expect.any(String)
      });
    });

    test('should retrieve platform-specific API key', async () => {
      const apiKey = 'test-key-123';
      const encryptedKey = btoa(apiKey);

      mockObjectStore.get.mockReturnValue({
        onsuccess: null,
        onerror: null,
        result: {
          id: 'openai_teams',
          service: 'openai',
          platform: 'teams',
          encryptedKey
        }
      });

      const retrievedKey = await configManager.getApiKey('openai', 'teams');

      // Trigger success callback
      const getRequest = mockObjectStore.get();
      setTimeout(() => getRequest.onsuccess(), 0);

      expect(retrievedKey).toBe(apiKey);
    });

    test('should get all API keys for a platform', async () => {
      const mockIndex = {
        getAll: jest.fn().mockReturnValue({
          onsuccess: null,
          onerror: null,
          result: [
            {
              service: 'openai',
              platform: 'teams',
              encryptedKey: btoa('openai-key')
            },
            {
              service: 'azure',
              platform: 'teams',
              encryptedKey: btoa('azure-key')
            }
          ]
        })
      };

      mockObjectStore.index.mockReturnValue(mockIndex);

      const apiKeys = await configManager.getPlatformApiKeys('teams');

      // Trigger success callback
      const getAllRequest = mockIndex.getAll();
      setTimeout(() => getAllRequest.onsuccess(), 0);

      expect(apiKeys).toEqual({
        openai: 'openai-key',
        azure: 'azure-key'
      });
    });
  });

  describe('cross-platform synchronization', () => {
    test('should sync settings across platforms', async () => {
      const sourceConfig = {
        userId: 'testuser',
        sttProvider: 'openai_whisper',
        aiProvider: 'claude',
        language: 'en-US',
        transcriptionQuality: 'high',
        enableSpeakerIdentification: true,
        enableSummaryGeneration: true,
        crossPlatformSync: true
      };

      // Mock platform config retrieval and saving
      mockObjectStore.get.mockReturnValue({
        onsuccess: null,
        onerror: null,
        result: {
          id: 'testuser_teams',
          userId: 'testuser',
          platform: 'teams',
          config: { enabled: true }
        }
      });

      mockObjectStore.put.mockReturnValue({
        onsuccess: null,
        onerror: null
      });

      const syncData = await configManager.syncSettingsAcrossPlatforms('testuser', sourceConfig);

      // Trigger success callbacks
      const getRequest = mockObjectStore.get();
      setTimeout(() => getRequest.onsuccess(), 0);

      const putRequest = mockObjectStore.put();
      setTimeout(() => putRequest.onsuccess(), 0);

      expect(syncData.syncType).toBe('settings');
      expect(syncData.userId).toBe('testuser');
      expect(syncData.sourceConfig).toEqual(sourceConfig);
    });

    test('should get unified configuration for platform', async () => {
      const userConfig = {
        userId: 'testuser',
        sttProvider: 'openai_whisper',
        aiProvider: 'claude',
        crossPlatformSync: true
      };

      const platformConfig = {
        id: 'testuser_teams',
        userId: 'testuser',
        platform: 'teams',
        config: {
          enabled: true,
          nativeIntegration: true
        }
      };

      // Mock getUserConfig and getPlatformConfig
      configManager.getUserConfig = jest.fn().mockResolvedValue(userConfig);
      configManager.getPlatformConfig = jest.fn().mockResolvedValue(platformConfig);

      const unifiedConfig = await configManager.getUnifiedConfig('testuser', 'teams');

      expect(unifiedConfig.userId).toBe('testuser');
      expect(unifiedConfig.sttProvider).toBe('openai_whisper');
      expect(unifiedConfig.enabled).toBe(true);
      expect(unifiedConfig.nativeIntegration).toBe(true);
      expect(unifiedConfig.platform).toBe('teams');
      expect(unifiedConfig.platformCapabilities).toBeDefined();
    });

    test('should get platform capabilities', () => {
      const teamsCapabilities = configManager._getPlatformCapabilities('teams');
      expect(teamsCapabilities.chatIntegration).toBe(true);
      expect(teamsCapabilities.agendaAccess).toBe(true);
      expect(teamsCapabilities.audioQuality).toBe('high');

      const meetCapabilities = configManager._getPlatformCapabilities('google_meet');
      expect(meetCapabilities.chatIntegration).toBe(false);
      expect(meetCapabilities.agendaAccess).toBe(true);
      expect(meetCapabilities.audioQuality).toBe('medium');
    });
  });

  describe('migration from Teams-only configuration', () => {
    test('should migrate existing Teams-only configuration', async () => {
      const oldConfig = {
        userId: 'testuser',
        sttProvider: 'openai_whisper',
        aiProvider: 'claude',
        enableSpeakerIdentification: true,
        enableSummaryGeneration: true,
        autoSendToChat: true
        // Missing crossPlatformSync and platformSpecificSettings
      };

      // Mock getUserConfig to return old format
      configManager.getUserConfig = jest.fn().mockResolvedValue(oldConfig);
      configManager.saveUserConfig = jest.fn().mockResolvedValue(true);
      configManager.savePlatformConfig = jest.fn().mockResolvedValue(true);

      const migrationResult = await configManager.migrateTeamsOnlyConfig('testuser');

      expect(migrationResult).toBe(true);
      expect(configManager.savePlatformConfig).toHaveBeenCalledTimes(4); // teams, zoom, google_meet, generic
      expect(configManager.saveUserConfig).toHaveBeenCalledWith({
        ...oldConfig,
        crossPlatformSync: true,
        platformSpecificSettings: {},
        defaultPlatform: 'teams'
      });
    });

    test('should skip migration if already migrated', async () => {
      const newConfig = {
        userId: 'testuser',
        crossPlatformSync: true,
        platformSpecificSettings: {}
      };

      configManager.getUserConfig = jest.fn().mockResolvedValue(newConfig);
      configManager.saveUserConfig = jest.fn();
      configManager.savePlatformConfig = jest.fn();

      const migrationResult = await configManager.migrateTeamsOnlyConfig('testuser');

      expect(migrationResult).toBe(true);
      expect(configManager.saveUserConfig).not.toHaveBeenCalled();
      expect(configManager.savePlatformConfig).not.toHaveBeenCalled();
    });
  });

  describe('enhanced default configuration', () => {
    test('should include multi-platform settings in default config', () => {
      const defaultConfig = configManager.getDefaultConfig('testuser');

      expect(defaultConfig.crossPlatformSync).toBe(true);
      expect(defaultConfig.platformSpecificSettings).toEqual({});
      expect(defaultConfig.defaultPlatform).toBe('teams');
    });
  });

  describe('platform configuration manager integration', () => {
    test('should work with platform configuration manager', () => {
      configManager.setPlatformConfigurationManager(platformConfigManager);
      expect(configManager.platformConfigManager).toBe(platformConfigManager);
    });

    test('should sync across platforms via platform config manager', async () => {
      const userConfig = { crossPlatformSync: true };
      const platformConfig = {
        config: {
          transcriptionEnabled: true,
          speakerIdentificationEnabled: true,
          audioQuality: 'high'
        }
      };

      configManager.getUserConfig = jest.fn().mockResolvedValue(userConfig);
      configManager.getPlatformConfig = jest.fn().mockResolvedValue(platformConfig);
      configManager.savePlatformConfig = jest.fn().mockResolvedValue(true);

      platformConfigManager.setSyncEnabled(true);

      const result = await platformConfigManager.setPlatformConfig('teams', { enabled: true }, 'testuser');

      expect(result).toBe(true);
    });
  });
});