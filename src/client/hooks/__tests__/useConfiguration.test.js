// useConfiguration Hook Tests
import { renderHook, act } from '@testing-library/react-hooks';
import useConfiguration from '../useConfiguration.js';
import ConfigurationManager from '../../services/ConfigurationManager.js';

// Mock the ConfigurationManager
jest.mock('../../services/ConfigurationManager.js');

describe('useConfiguration', () => {
  let mockConfigManager;

  beforeEach(() => {
    mockConfigManager = {
      getUserConfig: jest.fn(),
      saveUserConfig: jest.fn(),
      getApiKey: jest.fn(),
      saveApiKey: jest.fn(),
      getUserPrompt: jest.fn(),
      saveUserPrompt: jest.fn(),
      clearAllData: jest.fn(),
      validateConfig: jest.fn(),
      requiresConsent: jest.fn(),
      getAvailableSTTProviders: jest.fn(),
      getAvailableAIProviders: jest.fn(),
      getDefaultPrompt: jest.fn()
    };

    ConfigurationManager.mockImplementation(() => mockConfigManager);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test('should load configuration on mount', async () => {
    const mockConfig = {
      userId: 'default',
      sttProvider: 'local_whisper',
      aiProvider: 'openai_gpt',
      language: 'en-US'
    };

    mockConfigManager.getUserConfig.mockResolvedValue(mockConfig);

    const { result, waitForNextUpdate } = renderHook(() => useConfiguration());

    expect(result.current.loading).toBe(true);
    expect(result.current.config).toBeNull();

    await waitForNextUpdate();

    expect(result.current.loading).toBe(false);
    expect(result.current.config).toEqual(mockConfig);
    expect(result.current.error).toBeNull();
    expect(mockConfigManager.getUserConfig).toHaveBeenCalledTimes(1);
  });

  test('should handle configuration loading error', async () => {
    const errorMessage = 'Failed to load configuration';
    mockConfigManager.getUserConfig.mockRejectedValue(new Error(errorMessage));

    const { result, waitForNextUpdate } = renderHook(() => useConfiguration());

    await waitForNextUpdate();

    expect(result.current.loading).toBe(false);
    expect(result.current.config).toBeNull();
    expect(result.current.error).toBe(errorMessage);
  });

  test('should update configuration successfully', async () => {
    const initialConfig = {
      userId: 'default',
      sttProvider: 'local_whisper',
      aiProvider: 'openai_gpt'
    };

    const updatedConfig = {
      ...initialConfig,
      sttProvider: 'openai_whisper'
    };

    mockConfigManager.getUserConfig.mockResolvedValue(initialConfig);
    mockConfigManager.saveUserConfig.mockResolvedValue(updatedConfig);

    const { result, waitForNextUpdate } = renderHook(() => useConfiguration());

    await waitForNextUpdate();

    let updateResult;
    await act(async () => {
      updateResult = await result.current.updateConfiguration(updatedConfig);
    });

    expect(updateResult.success).toBe(true);
    expect(updateResult.config).toEqual(updatedConfig);
    expect(result.current.config).toEqual(updatedConfig);
    expect(mockConfigManager.saveUserConfig).toHaveBeenCalledWith(updatedConfig);
  });

  test('should handle configuration update error', async () => {
    const initialConfig = {
      userId: 'default',
      sttProvider: 'local_whisper'
    };

    const errorMessage = 'Invalid configuration';
    mockConfigManager.getUserConfig.mockResolvedValue(initialConfig);
    mockConfigManager.saveUserConfig.mockRejectedValue(new Error(errorMessage));

    const { result, waitForNextUpdate } = renderHook(() => useConfiguration());

    await waitForNextUpdate();

    let updateResult;
    await act(async () => {
      updateResult = await result.current.updateConfiguration(initialConfig);
    });

    expect(updateResult.success).toBe(false);
    expect(updateResult.error).toBe(errorMessage);
    expect(result.current.error).toBe(errorMessage);
  });

  test('should get API key successfully', async () => {
    const apiKey = 'test-api-key';
    mockConfigManager.getUserConfig.mockResolvedValue({});
    mockConfigManager.getApiKey.mockResolvedValue(apiKey);

    const { result, waitForNextUpdate } = renderHook(() => useConfiguration());

    await waitForNextUpdate();

    let retrievedKey;
    await act(async () => {
      retrievedKey = await result.current.getApiKey('openai_whisper');
    });

    expect(retrievedKey).toBe(apiKey);
    expect(mockConfigManager.getApiKey).toHaveBeenCalledWith('openai_whisper');
  });

  test('should save API key successfully', async () => {
    mockConfigManager.getUserConfig.mockResolvedValue({});
    mockConfigManager.saveApiKey.mockResolvedValue(true);

    const { result, waitForNextUpdate } = renderHook(() => useConfiguration());

    await waitForNextUpdate();

    let saveResult;
    await act(async () => {
      saveResult = await result.current.saveApiKey('openai_whisper', 'test-key');
    });

    expect(saveResult.success).toBe(true);
    expect(mockConfigManager.saveApiKey).toHaveBeenCalledWith('openai_whisper', 'test-key');
  });

  test('should handle API key save error', async () => {
    const errorMessage = 'Failed to save API key';
    mockConfigManager.getUserConfig.mockResolvedValue({});
    mockConfigManager.saveApiKey.mockRejectedValue(new Error(errorMessage));

    const { result, waitForNextUpdate } = renderHook(() => useConfiguration());

    await waitForNextUpdate();

    let saveResult;
    await act(async () => {
      saveResult = await result.current.saveApiKey('openai_whisper', 'test-key');
    });

    expect(saveResult.success).toBe(false);
    expect(saveResult.error).toBe(errorMessage);
  });

  test('should get user prompt successfully', async () => {
    const customPrompt = 'Custom prompt text';
    mockConfigManager.getUserConfig.mockResolvedValue({});
    mockConfigManager.getUserPrompt.mockResolvedValue(customPrompt);

    const { result, waitForNextUpdate } = renderHook(() => useConfiguration());

    await waitForNextUpdate();

    let prompt;
    await act(async () => {
      prompt = await result.current.getUserPrompt();
    });

    expect(prompt).toBe(customPrompt);
    expect(mockConfigManager.getUserPrompt).toHaveBeenCalledTimes(1);
  });

  test('should save user prompt successfully', async () => {
    const config = { userId: 'testUser' };
    const customPrompt = 'Custom prompt text';
    
    mockConfigManager.getUserConfig.mockResolvedValue(config);
    mockConfigManager.saveUserPrompt.mockResolvedValue(customPrompt);

    const { result, waitForNextUpdate } = renderHook(() => useConfiguration());

    await waitForNextUpdate();

    let saveResult;
    await act(async () => {
      saveResult = await result.current.saveUserPrompt(customPrompt);
    });

    expect(saveResult.success).toBe(true);
    expect(mockConfigManager.saveUserPrompt).toHaveBeenCalledWith('testUser', customPrompt);
  });

  test('should check if consent is required', async () => {
    const config = {
      sttProvider: 'openai_whisper',
      aiProvider: 'claude'
    };

    mockConfigManager.getUserConfig.mockResolvedValue(config);
    mockConfigManager.requiresConsent.mockReturnValue(true);

    const { result, waitForNextUpdate } = renderHook(() => useConfiguration());

    await waitForNextUpdate();

    const requiresConsent = result.current.requiresConsent();
    expect(requiresConsent).toBe(true);
    expect(mockConfigManager.requiresConsent).toHaveBeenCalledWith('openai_whisper');
  });

  test('should validate configuration correctly', async () => {
    const config = {
      sttProvider: 'local_whisper',
      aiProvider: 'openai_gpt',
      consentGiven: false
    };

    mockConfigManager.getUserConfig.mockResolvedValue(config);
    mockConfigManager.requiresConsent.mockReturnValue(false);
    mockConfigManager.validateConfig.mockReturnValue({ isValid: true });

    const { result, waitForNextUpdate } = renderHook(() => useConfiguration());

    await waitForNextUpdate();

    const isValid = result.current.hasValidConfiguration();
    expect(isValid).toBe(true);
  });

  test('should reject configuration without consent for cloud services', async () => {
    const config = {
      sttProvider: 'openai_whisper',
      aiProvider: 'claude',
      consentGiven: false
    };

    mockConfigManager.getUserConfig.mockResolvedValue(config);
    mockConfigManager.requiresConsent.mockReturnValue(true);

    const { result, waitForNextUpdate } = renderHook(() => useConfiguration());

    await waitForNextUpdate();

    const isValid = result.current.hasValidConfiguration();
    expect(isValid).toBe(false);
  });

  test('should get available providers', async () => {
    const sttProviders = [
      { id: 'local_whisper', name: 'Local Whisper' },
      { id: 'openai_whisper', name: 'OpenAI Whisper' }
    ];
    
    const aiProviders = [
      { id: 'openai_gpt', name: 'OpenAI GPT' },
      { id: 'claude', name: 'Claude' }
    ];

    mockConfigManager.getUserConfig.mockResolvedValue({});
    mockConfigManager.getAvailableSTTProviders.mockReturnValue(sttProviders);
    mockConfigManager.getAvailableAIProviders.mockReturnValue(aiProviders);

    const { result, waitForNextUpdate } = renderHook(() => useConfiguration());

    await waitForNextUpdate();

    expect(result.current.getSTTProviders()).toEqual(sttProviders);
    expect(result.current.getAIProviders()).toEqual(aiProviders);
  });

  test('should reset configuration successfully', async () => {
    const initialConfig = { userId: 'default' };
    const resetConfig = { userId: 'default', sttProvider: 'local_whisper' };

    mockConfigManager.getUserConfig
      .mockResolvedValueOnce(initialConfig)
      .mockResolvedValueOnce(resetConfig);
    mockConfigManager.clearAllData.mockResolvedValue(true);

    const { result, waitForNextUpdate } = renderHook(() => useConfiguration());

    await waitForNextUpdate();

    let resetResult;
    await act(async () => {
      resetResult = await result.current.resetConfiguration();
    });

    expect(resetResult.success).toBe(true);
    expect(mockConfigManager.clearAllData).toHaveBeenCalledTimes(1);
    expect(mockConfigManager.getUserConfig).toHaveBeenCalledTimes(2);
  });

  test('should handle reset configuration error', async () => {
    const errorMessage = 'Failed to clear data';
    mockConfigManager.getUserConfig.mockResolvedValue({});
    mockConfigManager.clearAllData.mockRejectedValue(new Error(errorMessage));

    const { result, waitForNextUpdate } = renderHook(() => useConfiguration());

    await waitForNextUpdate();

    let resetResult;
    await act(async () => {
      resetResult = await result.current.resetConfiguration();
    });

    expect(resetResult.success).toBe(false);
    expect(resetResult.error).toBe(errorMessage);
    expect(result.current.error).toBe(errorMessage);
  });
});