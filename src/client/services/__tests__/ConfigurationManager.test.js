// Configuration Manager Tests
import ConfigurationManager from '../ConfigurationManager.js';

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
  createIndex: jest.fn()
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
        request.onupgradeneeded({ target: { result: mockDB } });
      }
      if (request.onsuccess) {
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
});

describe('ConfigurationManager', () => {
  let configManager;

  beforeEach(() => {
    configManager = new ConfigurationManager();
  });

  describe('initialization', () => {
    test('should initialize IndexedDB successfully', async () => {
      const mockDB = { objectStoreNames: { contains: () => true } };
      mockIndexedDB.open.mockImplementation(() => {
        const request = { ...mockRequest };
        setTimeout(() => {
          if (request.onsuccess) {
            request.onsuccess({ target: { result: mockDB } });
          }
        }, 0);
        return request;
      });

      await configManager.initialize();
      expect(configManager.initialized).toBe(true);
      expect(configManager.db).toBe(mockDB);
    });

    test('should handle IndexedDB initialization error', async () => {
      mockIndexedDB.open.mockImplementation(() => {
        const request = { ...mockRequest };
        setTimeout(() => {
          if (request.onerror) {
            request.onerror();
          }
        }, 0);
        return request;
      });

      await expect(configManager.initialize()).rejects.toThrow('Failed to open IndexedDB');
    });
  });

  describe('user configuration', () => {
    beforeEach(async () => {
      // Mock successful initialization
      const mockDB = {
        objectStoreNames: { contains: () => true },
        transaction: () => mockTransaction
      };
      configManager.db = mockDB;
      configManager.initialized = true;
    });

    test('should get default configuration for new user', async () => {
      mockObjectStore.get.mockImplementation(() => {
        const request = { ...mockRequest };
        setTimeout(() => {
          request.result = null; // No existing config
          if (request.onsuccess) request.onsuccess();
        }, 0);
        return request;
      });

      const config = await configManager.getUserConfig('testUser');
      
      expect(config.userId).toBe('testUser');
      expect(config.sttProvider).toBe('local_whisper');
      expect(config.aiProvider).toBe('openai_gpt');
      expect(config.language).toBe('en-US');
      expect(config.consentGiven).toBe(false);
    });

    test('should get existing user configuration', async () => {
      const existingConfig = {
        userId: 'testUser',
        sttProvider: 'openai_whisper',
        aiProvider: 'claude',
        language: 'es-ES',
        consentGiven: true
      };

      mockObjectStore.get.mockImplementation(() => {
        const request = { ...mockRequest };
        setTimeout(() => {
          request.result = existingConfig;
          if (request.onsuccess) request.onsuccess();
        }, 0);
        return request;
      });

      const config = await configManager.getUserConfig('testUser');
      expect(config).toEqual(existingConfig);
    });

    test('should save valid user configuration', async () => {
      const validConfig = {
        userId: 'testUser',
        sttProvider: 'openai_whisper',
        aiProvider: 'claude',
        language: 'en-US',
        transcriptionQuality: 'high',
        enableSpeakerIdentification: true,
        autoSendToChat: true,
        enableSummaryGeneration: true,
        privacyMode: false,
        dataRetentionDays: 30,
        consentGiven: true
      };

      mockObjectStore.put.mockImplementation(() => {
        const request = { ...mockRequest };
        setTimeout(() => {
          if (request.onsuccess) request.onsuccess();
        }, 0);
        return request;
      });

      const result = await configManager.saveUserConfig(validConfig);
      expect(result).toEqual(validConfig);
      expect(mockObjectStore.put).toHaveBeenCalledWith(validConfig);
    });

    test('should reject invalid configuration', async () => {
      const invalidConfig = {
        userId: 'testUser',
        sttProvider: 'invalid_provider', // Invalid provider
        aiProvider: 'claude',
        language: 'en-US',
        transcriptionQuality: 'high',
        dataRetentionDays: 30
      };

      await expect(configManager.saveUserConfig(invalidConfig))
        .rejects.toThrow('Invalid configuration: Invalid STT provider');
    });
  });

  describe('API key management', () => {
    beforeEach(async () => {
      const mockDB = {
        objectStoreNames: { contains: () => true },
        transaction: () => mockTransaction
      };
      configManager.db = mockDB;
      configManager.initialized = true;
    });

    test('should save and retrieve API key', async () => {
      const service = 'openai_whisper';
      const apiKey = 'test-api-key-123';

      // Mock save
      mockObjectStore.put.mockImplementation(() => {
        const request = { ...mockRequest };
        setTimeout(() => {
          if (request.onsuccess) request.onsuccess();
        }, 0);
        return request;
      });

      await configManager.saveApiKey(service, apiKey);
      expect(mockObjectStore.put).toHaveBeenCalledWith({
        service,
        encryptedKey: btoa(apiKey), // Base64 encoded
        updatedAt: expect.any(String)
      });

      // Mock retrieve
      mockObjectStore.get.mockImplementation(() => {
        const request = { ...mockRequest };
        setTimeout(() => {
          request.result = {
            service,
            encryptedKey: btoa(apiKey)
          };
          if (request.onsuccess) request.onsuccess();
        }, 0);
        return request;
      });

      const retrievedKey = await configManager.getApiKey(service);
      expect(retrievedKey).toBe(apiKey);
    });

    test('should return null for non-existent API key', async () => {
      mockObjectStore.get.mockImplementation(() => {
        const request = { ...mockRequest };
        setTimeout(() => {
          request.result = null;
          if (request.onsuccess) request.onsuccess();
        }, 0);
        return request;
      });

      const result = await configManager.getApiKey('non_existent_service');
      expect(result).toBeNull();
    });

    test('should delete API key', async () => {
      const service = 'openai_whisper';

      mockObjectStore.delete.mockImplementation(() => {
        const request = { ...mockRequest };
        setTimeout(() => {
          if (request.onsuccess) request.onsuccess();
        }, 0);
        return request;
      });

      const result = await configManager.deleteApiKey(service);
      expect(result).toBe(true);
      expect(mockObjectStore.delete).toHaveBeenCalledWith(service);
    });

    test('should reject invalid API key', async () => {
      await expect(configManager.saveApiKey('service', null))
        .rejects.toThrow('Invalid API key');
      
      await expect(configManager.saveApiKey('service', ''))
        .rejects.toThrow('Invalid API key');
    });
  });

  describe('user prompts', () => {
    beforeEach(async () => {
      const mockDB = {
        objectStoreNames: { contains: () => true },
        transaction: () => mockTransaction
      };
      configManager.db = mockDB;
      configManager.initialized = true;
    });

    test('should save and retrieve custom prompt', async () => {
      const userId = 'testUser';
      const customPrompt = 'Custom summary prompt for testing';

      // Mock save
      mockObjectStore.put.mockImplementation(() => {
        const request = { ...mockRequest };
        setTimeout(() => {
          if (request.onsuccess) request.onsuccess();
        }, 0);
        return request;
      });

      await configManager.saveUserPrompt(userId, customPrompt);
      expect(mockObjectStore.put).toHaveBeenCalledWith({
        userId,
        prompt: customPrompt,
        updatedAt: expect.any(String)
      });

      // Mock retrieve
      mockObjectStore.get.mockImplementation(() => {
        const request = { ...mockRequest };
        setTimeout(() => {
          request.result = { userId, prompt: customPrompt };
          if (request.onsuccess) request.onsuccess();
        }, 0);
        return request;
      });

      const retrievedPrompt = await configManager.getUserPrompt(userId);
      expect(retrievedPrompt).toBe(customPrompt);
    });

    test('should return default prompt when no custom prompt exists', async () => {
      mockObjectStore.get.mockImplementation(() => {
        const request = { ...mockRequest };
        setTimeout(() => {
          request.result = null;
          if (request.onsuccess) request.onsuccess();
        }, 0);
        return request;
      });

      const prompt = await configManager.getUserPrompt('testUser');
      expect(prompt).toBe(configManager.getDefaultPrompt());
    });
  });

  describe('configuration validation', () => {
    test('should validate correct configuration', () => {
      const validConfig = {
        userId: 'testUser',
        sttProvider: 'openai_whisper',
        aiProvider: 'claude',
        language: 'en-US',
        transcriptionQuality: 'high',
        dataRetentionDays: 30
      };

      const result = configManager.validateConfig(validConfig);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('should reject configuration with invalid STT provider', () => {
      const invalidConfig = {
        userId: 'testUser',
        sttProvider: 'invalid_provider',
        aiProvider: 'claude',
        language: 'en-US',
        transcriptionQuality: 'high',
        dataRetentionDays: 30
      };

      const result = configManager.validateConfig(invalidConfig);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Invalid STT provider');
    });

    test('should reject configuration with invalid AI provider', () => {
      const invalidConfig = {
        userId: 'testUser',
        sttProvider: 'local_whisper',
        aiProvider: 'invalid_ai',
        language: 'en-US',
        transcriptionQuality: 'high',
        dataRetentionDays: 30
      };

      const result = configManager.validateConfig(invalidConfig);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Invalid AI provider');
    });

    test('should reject configuration with invalid data retention', () => {
      const invalidConfig = {
        userId: 'testUser',
        sttProvider: 'local_whisper',
        aiProvider: 'openai_gpt',
        language: 'en-US',
        transcriptionQuality: 'high',
        dataRetentionDays: 500 // Too high
      };

      const result = configManager.validateConfig(invalidConfig);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Data retention days must be between 1 and 365');
    });

    test('should reject configuration missing required fields', () => {
      const invalidConfig = {
        sttProvider: 'local_whisper',
        aiProvider: 'openai_gpt'
        // Missing userId, language, etc.
      };

      const result = configManager.validateConfig(invalidConfig);
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('utility methods', () => {
    test('should identify cloud services requiring consent', () => {
      expect(configManager.requiresConsent('local_whisper')).toBe(false);
      expect(configManager.requiresConsent('openai_whisper')).toBe(true);
      expect(configManager.requiresConsent('azure_speech')).toBe(true);
      expect(configManager.requiresConsent('claude')).toBe(true);
    });

    test('should return available STT providers', () => {
      const providers = configManager.getAvailableSTTProviders();
      expect(providers).toHaveLength(4);
      expect(providers[0]).toEqual({
        id: 'local_whisper',
        name: 'Local Whisper',
        requiresApiKey: false,
        isCloud: false
      });
    });

    test('should return available AI providers', () => {
      const providers = configManager.getAvailableAIProviders();
      expect(providers).toHaveLength(3);
      expect(providers[0]).toEqual({
        id: 'openai_gpt',
        name: 'OpenAI GPT',
        requiresApiKey: true,
        isCloud: true
      });
    });

    test('should encrypt and decrypt API keys', () => {
      const originalKey = 'test-api-key-123';
      const encrypted = configManager.encryptApiKey(originalKey);
      const decrypted = configManager.decryptApiKey(encrypted);
      
      expect(encrypted).not.toBe(originalKey);
      expect(decrypted).toBe(originalKey);
    });
  });

  describe('data management', () => {
    beforeEach(async () => {
      const mockDB = {
        objectStoreNames: { contains: () => true },
        transaction: () => mockTransaction
      };
      configManager.db = mockDB;
      configManager.initialized = true;
    });

    test('should clear all data', async () => {
      mockObjectStore.clear.mockImplementation(() => {
        const request = { ...mockRequest };
        setTimeout(() => {
          if (request.onsuccess) request.onsuccess();
        }, 0);
        return request;
      });

      const result = await configManager.clearAllData();
      expect(result).toBe(true);
      expect(mockObjectStore.clear).toHaveBeenCalledTimes(3); // Three stores
    });
  });
});