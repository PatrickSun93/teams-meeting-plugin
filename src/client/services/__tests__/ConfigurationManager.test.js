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

  describe('Enhanced Prompt Management', () => {
    test('should get all user prompts', async () => {
      const configManager = new ConfigurationManager();
      
      // Mock prompts in database
      const mockPrompts = [
        {
          id: 'prompt1',
          userId: 'testuser',
          name: 'Default',
          prompt: 'Default prompt',
          isDefault: true,
          createdAt: '2023-01-01T00:00:00.000Z',
          updatedAt: '2023-01-01T00:00:00.000Z'
        },
        {
          id: 'prompt2',
          userId: 'testuser',
          name: 'Custom',
          prompt: 'Custom prompt',
          isDefault: false,
          createdAt: '2023-01-02T00:00:00.000Z',
          updatedAt: '2023-01-02T00:00:00.000Z'
        }
      ];

      // Mock IndexedDB
      const mockTransaction = {
        objectStore: jest.fn().mockReturnValue({
          index: jest.fn().mockReturnValue({
            getAll: jest.fn().mockReturnValue({
              onsuccess: null,
              onerror: null,
              result: mockPrompts
            })
          })
        })
      };

      configManager.db = {
        transaction: jest.fn().mockReturnValue(mockTransaction)
      };
      configManager.initialized = true;

      const prompts = await configManager.getUserPrompts('testuser');

      // Trigger success callback
      const getAllRequest = mockTransaction.objectStore().index().getAll();
      getAllRequest.onsuccess();

      expect(prompts).toEqual(mockPrompts);
    });

    test('should create default prompt if none exist', async () => {
      const configManager = new ConfigurationManager();
      
      // Mock empty prompts array
      const mockTransaction = {
        objectStore: jest.fn().mockReturnValue({
          index: jest.fn().mockReturnValue({
            getAll: jest.fn().mockReturnValue({
              onsuccess: null,
              onerror: null,
              result: []
            })
          })
        })
      };

      configManager.db = {
        transaction: jest.fn().mockReturnValue(mockTransaction)
      };
      configManager.initialized = true;

      const prompts = await configManager.getUserPrompts('testuser');

      // Trigger success callback
      const getAllRequest = mockTransaction.objectStore().index().getAll();
      getAllRequest.onsuccess();

      expect(prompts).toHaveLength(1);
      expect(prompts[0].name).toBe('Default');
      expect(prompts[0].isDefault).toBe(true);
    });

    test('should save prompt with validation', async () => {
      const configManager = new ConfigurationManager();
      
      const promptData = {
        userId: 'testuser',
        name: 'Test Prompt',
        prompt: 'Test content',
        description: 'Test description',
        tags: ['test'],
        isDefault: false
      };

      // Mock IndexedDB
      const mockStore = {
        put: jest.fn().mockReturnValue({
          onsuccess: null,
          onerror: null
        }),
        index: jest.fn().mockReturnValue({
          getAll: jest.fn().mockReturnValue({
            onsuccess: null,
            onerror: null,
            result: []
          })
        })
      };

      const mockTransaction = {
        objectStore: jest.fn().mockReturnValue(mockStore)
      };

      configManager.db = {
        transaction: jest.fn().mockReturnValue(mockTransaction)
      };
      configManager.initialized = true;

      const savedPrompt = await configManager.savePrompt(promptData);

      // Trigger success callbacks
      const getAllRequest = mockStore.index().getAll();
      getAllRequest.onsuccess();
      
      const putRequest = mockStore.put();
      putRequest.onsuccess();

      expect(savedPrompt.name).toBe('Test Prompt');
      expect(savedPrompt.userId).toBe('testuser');
      expect(savedPrompt.id).toBeDefined();
    });

    test('should validate prompt data', () => {
      const configManager = new ConfigurationManager();

      // Valid prompt
      const validPrompt = {
        name: 'Valid Prompt',
        prompt: 'Valid content',
        description: 'Valid description',
        tags: ['tag1', 'tag2']
      };

      const validResult = configManager.validatePrompt(validPrompt);
      expect(validResult.isValid).toBe(true);
      expect(validResult.errors).toHaveLength(0);

      // Invalid prompt - missing name
      const invalidPrompt = {
        prompt: 'Valid content'
      };

      const invalidResult = configManager.validatePrompt(invalidPrompt);
      expect(invalidResult.isValid).toBe(false);
      expect(invalidResult.errors).toContain('Prompt name is required');

      // Invalid prompt - empty content
      const emptyContentPrompt = {
        name: 'Valid Name',
        prompt: ''
      };

      const emptyResult = configManager.validatePrompt(emptyContentPrompt);
      expect(emptyResult.isValid).toBe(false);
      expect(emptyResult.errors).toContain('Prompt content is required');

      // Invalid prompt - content too long
      const longContentPrompt = {
        name: 'Valid Name',
        prompt: 'x'.repeat(10001)
      };

      const longResult = configManager.validatePrompt(longContentPrompt);
      expect(longResult.isValid).toBe(false);
      expect(longResult.errors).toContain('Prompt content is too long (maximum 10,000 characters)');
    });

    test('should delete prompt', async () => {
      const configManager = new ConfigurationManager();
      
      // Mock IndexedDB
      const mockStore = {
        delete: jest.fn().mockReturnValue({
          onsuccess: null,
          onerror: null
        })
      };

      const mockTransaction = {
        objectStore: jest.fn().mockReturnValue(mockStore)
      };

      configManager.db = {
        transaction: jest.fn().mockReturnValue(mockTransaction)
      };
      configManager.initialized = true;

      const result = await configManager.deletePrompt('prompt123');

      // Trigger success callback
      const deleteRequest = mockStore.delete();
      deleteRequest.onsuccess();

      expect(result).toBe(true);
      expect(mockStore.delete).toHaveBeenCalledWith('prompt123');
    });

    test('should export prompts', async () => {
      const configManager = new ConfigurationManager();
      
      const mockPrompts = [
        {
          id: 'prompt1',
          userId: 'testuser',
          name: 'Prompt 1',
          prompt: 'Content 1',
          description: 'Description 1',
          tags: ['tag1'],
          createdAt: '2023-01-01T00:00:00.000Z'
        }
      ];

      // Mock getUserPrompts
      configManager.getUserPrompts = jest.fn().mockResolvedValue(mockPrompts);

      const exportData = await configManager.exportPrompts('testuser');
      const parsed = JSON.parse(exportData);

      expect(parsed.version).toBe('1.0');
      expect(parsed.prompts).toHaveLength(1);
      expect(parsed.prompts[0].name).toBe('Prompt 1');
      expect(parsed.prompts[0]).not.toHaveProperty('id');
      expect(parsed.prompts[0]).not.toHaveProperty('userId');
    });

    test('should import prompts', async () => {
      const configManager = new ConfigurationManager();
      
      const importData = {
        version: '1.0',
        prompts: [
          {
            name: 'Imported Prompt',
            prompt: 'Imported content',
            description: 'Imported description',
            tags: ['imported']
          }
        ]
      };

      // Mock savePrompt
      configManager.savePrompt = jest.fn().mockResolvedValue({
        id: 'new-prompt-id',
        ...importData.prompts[0],
        userId: 'testuser'
      });

      const importedPrompts = await configManager.importPrompts('testuser', importData);

      expect(importedPrompts).toHaveLength(1);
      expect(configManager.savePrompt).toHaveBeenCalledWith({
        userId: 'testuser',
        name: 'Imported Prompt',
        prompt: 'Imported content',
        description: 'Imported description',
        tags: ['imported'],
        isDefault: false
      });
    });

    test('should handle invalid import data', async () => {
      const configManager = new ConfigurationManager();

      // Invalid JSON
      await expect(configManager.importPrompts('testuser', 'invalid json'))
        .rejects.toThrow('Invalid import data format');

      // Missing prompts array
      await expect(configManager.importPrompts('testuser', { version: '1.0' }))
        .rejects.toThrow('Import data must contain a prompts array');
    });

    test('should set default prompt correctly', async () => {
      const configManager = new ConfigurationManager();
      
      const existingPrompts = [
        {
          id: 'prompt1',
          userId: 'testuser',
          name: 'Prompt 1',
          isDefault: true,
          updatedAt: '2023-01-01T00:00:00.000Z'
        },
        {
          id: 'prompt2',
          userId: 'testuser',
          name: 'Prompt 2',
          isDefault: false,
          updatedAt: '2023-01-01T00:00:00.000Z'
        }
      ];

      const mockStore = {
        put: jest.fn().mockReturnValue({
          onsuccess: null,
          onerror: null
        }),
        index: jest.fn().mockReturnValue({
          getAll: jest.fn().mockReturnValue({
            onsuccess: null,
            onerror: null,
            result: existingPrompts
          })
        })
      };

      const mockTransaction = {
        objectStore: jest.fn().mockReturnValue(mockStore)
      };

      configManager.db = {
        transaction: jest.fn().mockReturnValue(mockTransaction)
      };
      configManager.initialized = true;

      const newDefaultPrompt = {
        id: 'prompt3',
        userId: 'testuser',
        name: 'New Default',
        prompt: 'New default content',
        isDefault: true
      };

      const savedPrompt = await configManager.savePrompt(newDefaultPrompt);

      // Trigger success callbacks
      const getAllRequest = mockStore.index().getAll();
      getAllRequest.onsuccess();
      
      const putRequest = mockStore.put();
      putRequest.onsuccess();

      // Should have called put multiple times to unset other defaults
      expect(mockStore.put).toHaveBeenCalledTimes(2); // Once for existing default, once for new prompt
    });
  });