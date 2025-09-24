// TranscriptionEngine Cloud Integration Tests
import TranscriptionEngine from '../TranscriptionEngine.js';
import CloudSTTService from '../CloudSTTService.js';

// Mock the services
jest.mock('../LocalSTTService.js');
jest.mock('../CloudSTTService.js');

describe('TranscriptionEngine - Cloud Integration', () => {
  let transcriptionEngine;
  let mockCloudSTTService;
  let mockAudioData;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    
    transcriptionEngine = new TranscriptionEngine();
    mockCloudSTTService = transcriptionEngine.cloudSTTService;
    
    // Mock audio data
    mockAudioData = {
      data: new Float32Array([0.1, 0.2, -0.1, -0.2, 0.3]),
      sampleRate: 16000,
      duration: 1.0
    };
    
    // Setup default mock responses
    mockCloudSTTService.getNetworkStatus.mockReturnValue({ isOnline: true });
    mockCloudSTTService.isProviderAvailable.mockReturnValue(true);
    mockCloudSTTService.checkRateLimit.mockReturnValue(true);
    mockCloudSTTService.getAvailableProviders.mockReturnValue([
      { id: 'openai_whisper', name: 'OpenAI Whisper API', isOnline: true },
      { id: 'azure_speech', name: 'Azure Speech Services', isOnline: true },
      { id: 'claude_speech', name: 'Claude Speech', isOnline: true }
    ]);
  });

  describe('Provider Management', () => {
    test('should change to cloud provider successfully', async () => {
      const config = {
        apiKey: 'test-api-key',
        cloudConfig: { model: 'whisper-1' }
      };
      
      await transcriptionEngine.changeProvider('openai_whisper', config);
      
      expect(transcriptionEngine.currentProvider).toBe('openai_whisper');
      expect(transcriptionEngine.config.apiKeys.openai_whisper).toBe('test-api-key');
    });

    test('should reject cloud provider without API key', async () => {
      await expect(
        transcriptionEngine.changeProvider('openai_whisper', {})
      ).rejects.toThrow('API key required for provider: openai_whisper');
    });

    test('should reject cloud provider when offline', async () => {
      mockCloudSTTService.getNetworkStatus.mockReturnValue({ isOnline: false });
      
      await expect(
        transcriptionEngine.changeProvider('openai_whisper', { apiKey: 'test-key' })
      ).rejects.toThrow('No internet connection available for cloud provider');
    });

    test('should identify provider types correctly', () => {
      expect(transcriptionEngine.isLocalProvider('local_whisper')).toBe(true);
      expect(transcriptionEngine.isLocalProvider('openai_whisper')).toBe(false);
      
      expect(transcriptionEngine.isCloudProvider('openai_whisper')).toBe(true);
      expect(transcriptionEngine.isCloudProvider('azure_speech')).toBe(true);
      expect(transcriptionEngine.isCloudProvider('claude_speech')).toBe(true);
      expect(transcriptionEngine.isCloudProvider('local_whisper')).toBe(false);
    });

    test('should get provider configuration', () => {
      transcriptionEngine.config.apiKeys.openai_whisper = 'test-key';
      
      const config = transcriptionEngine.getProviderConfig('openai_whisper');
      
      expect(config).toEqual({
        provider: 'openai_whisper',
        isLocal: false,
        isCloud: true,
        requiresApiKey: true,
        hasApiKey: true,
        isAvailable: true,
        rateLimit: undefined
      });
    });

    test('should get available providers', () => {
      const providers = transcriptionEngine.getAvailableProviders();
      
      expect(providers).toHaveLength(4); // 1 local + 3 cloud
      expect(providers[0]).toEqual({
        id: 'local_whisper',
        name: 'Local Whisper',
        type: 'local',
        isAvailable: true,
        requiresApiKey: false,
        isCurrent: false
      });
    });
  });

  describe('Cloud Transcription', () => {
    beforeEach(async () => {
      // Initialize with cloud provider
      await transcriptionEngine.initialize({
        provider: 'openai_whisper',
        apiKeys: { openai_whisper: 'test-key' }
      });
      transcriptionEngine.currentProvider = 'openai_whisper';
    });

    test('should transcribe with cloud service', async () => {
      const mockResult = {
        text: 'Hello world',
        confidence: 0.9,
        language: 'en',
        provider: 'openai_whisper',
        timestamp: Date.now()
      };
      
      mockCloudSTTService.transcribe.mockResolvedValue(mockResult);
      
      const result = await transcriptionEngine.transcribeWithCloud(mockAudioData, 'openai_whisper');
      
      expect(mockCloudSTTService.transcribe).toHaveBeenCalledWith(
        mockAudioData,
        'openai_whisper',
        expect.objectContaining({
          apiKey: 'test-key',
          language: 'en'
        })
      );
      
      expect(result).toEqual(mockResult);
    });

    test('should handle cloud transcription failure', async () => {
      mockCloudSTTService.transcribe.mockRejectedValue(new Error('API Error'));
      
      await expect(
        transcriptionEngine.transcribeWithCloud(mockAudioData, 'openai_whisper')
      ).rejects.toThrow('API Error');
    });

    test('should require API key for cloud transcription', async () => {
      transcriptionEngine.config.apiKeys = {}; // No API key
      
      await expect(
        transcriptionEngine.transcribeWithCloud(mockAudioData, 'openai_whisper')
      ).rejects.toThrow('API key not configured for provider: openai_whisper');
    });
  });

  describe('Fallback Logic', () => {
    beforeEach(async () => {
      await transcriptionEngine.initialize({
        provider: 'openai_whisper',
        enableFallback: true,
        apiKeys: { openai_whisper: 'test-key' }
      });
      transcriptionEngine.currentProvider = 'openai_whisper';
    });

    test('should determine fallback conditions correctly', () => {
      const queueItem = { fallbackAttempts: 0 };
      
      // Rate limit error should trigger fallback
      const rateLimitError = new Error('rate limit exceeded');
      expect(transcriptionEngine.shouldAttemptFallback(rateLimitError, queueItem)).toBe(true);
      
      // Network error should trigger fallback
      const networkError = new Error('network timeout');
      expect(transcriptionEngine.shouldAttemptFallback(networkError, queueItem)).toBe(true);
      
      // Too many attempts should not trigger fallback
      queueItem.fallbackAttempts = 3;
      expect(transcriptionEngine.shouldAttemptFallback(rateLimitError, queueItem)).toBe(false);
    });

    test('should attempt fallback from cloud to local', async () => {
      const queueItem = {
        id: 'test-segment',
        audioData: mockAudioData,
        fallbackAttempts: 0
      };
      
      // Mock local STT service
      transcriptionEngine.localSTTService.isInitialized = true;
      
      await transcriptionEngine.attemptFallback(queueItem, new Error('rate limit'));
      
      expect(queueItem.fallbackProvider).toBe('local_whisper');
      expect(queueItem.fallbackAttempts).toBe(1);
      expect(transcriptionEngine.processingQueue).toContain(queueItem);
    });

    test('should handle network failure during transcription', async () => {
      const listener = jest.fn();
      transcriptionEngine.addEventListener('providerFallback', listener);
      
      transcriptionEngine.isTranscribing = true;
      transcriptionEngine.localSTTService.isInitialized = false;
      transcriptionEngine.localSTTService.initialize.mockResolvedValue();
      
      await transcriptionEngine.handleNetworkFailure();
      
      expect(transcriptionEngine.currentProvider).toBe('local_whisper');
      expect(transcriptionEngine.localSTTService.initialize).toHaveBeenCalled();
      expect(listener).toHaveBeenCalledWith({
        from: 'openai_whisper',
        to: 'local_whisper',
        reason: 'network_failure'
      });
    });

    test('should handle fallback initialization failure', async () => {
      const listener = jest.fn();
      transcriptionEngine.addEventListener('fallbackFailed', listener);
      
      transcriptionEngine.isTranscribing = true;
      transcriptionEngine.localSTTService.isInitialized = false;
      transcriptionEngine.localSTTService.initialize.mockRejectedValue(new Error('Init failed'));
      
      await transcriptionEngine.handleNetworkFailure();
      
      expect(listener).toHaveBeenCalledWith({
        error: 'Init failed',
        originalProvider: 'local_whisper'
      });
    });
  });

  describe('Network Monitoring', () => {
    test('should handle network status changes', () => {
      const listener = jest.fn();
      transcriptionEngine.addEventListener('networkStatusChanged', listener);
      
      // Simulate network status change from cloud service
      const cloudListeners = mockCloudSTTService.addEventListener.mock.calls;
      const networkListener = cloudListeners.find(call => call[0] === 'networkStatusChanged')[1];
      
      networkListener({ isOnline: false });
      
      expect(listener).toHaveBeenCalledWith({ isOnline: false });
    });

    test('should trigger fallback when network goes down during cloud transcription', async () => {
      transcriptionEngine.isTranscribing = true;
      transcriptionEngine.currentProvider = 'openai_whisper';
      transcriptionEngine.localSTTService.isInitialized = false;
      transcriptionEngine.localSTTService.initialize.mockResolvedValue();
      
      const handleNetworkFailureSpy = jest.spyOn(transcriptionEngine, 'handleNetworkFailure');
      
      // Simulate network going down
      const cloudListeners = mockCloudSTTService.addEventListener.mock.calls;
      const networkListener = cloudListeners.find(call => call[0] === 'networkStatusChanged')[1];
      
      networkListener({ isOnline: false });
      
      expect(handleNetworkFailureSpy).toHaveBeenCalled();
    });
  });

  describe('API Key Management', () => {
    test('should update API key for provider', () => {
      transcriptionEngine.updateApiKey('openai_whisper', 'new-api-key');
      
      expect(transcriptionEngine.config.apiKeys.openai_whisper).toBe('new-api-key');
    });

    test('should reject API key update for local provider', () => {
      expect(() => {
        transcriptionEngine.updateApiKey('local_whisper', 'key');
      }).toThrow('Provider local_whisper does not require an API key');
    });
  });

  describe('Status and Monitoring', () => {
    test('should include cloud service information in status', () => {
      transcriptionEngine.config.apiKeys = { openai_whisper: 'test-key' };
      
      const status = transcriptionEngine.getStatus();
      
      expect(status).toEqual(expect.objectContaining({
        currentProvider: expect.any(String),
        providerConfig: expect.any(Object),
        networkStatus: expect.any(Object),
        availableProviders: expect.any(Array),
        config: expect.objectContaining({
          apiKeys: ['openai_whisper'] // Should not expose actual keys
        })
      }));
    });

    test('should cleanup cloud service on cleanup', () => {
      transcriptionEngine.cleanup();
      
      expect(mockCloudSTTService.cleanup).toHaveBeenCalled();
    });
  });

  describe('Integration Workflow', () => {
    test('should process audio segment with cloud provider', async () => {
      await transcriptionEngine.initialize({
        provider: 'openai_whisper',
        apiKeys: { openai_whisper: 'test-key' }
      });
      
      transcriptionEngine.currentProvider = 'openai_whisper';
      
      const mockResult = {
        text: 'Hello world',
        confidence: 0.9,
        language: 'en',
        provider: 'openai_whisper',
        timestamp: Date.now()
      };
      
      mockCloudSTTService.transcribe.mockResolvedValue(mockResult);
      
      const queueItem = {
        id: 'test-segment',
        audioData: mockAudioData,
        timestamp: Date.now(),
        retries: 0
      };
      
      await transcriptionEngine.processAudioSegment(queueItem);
      
      expect(mockCloudSTTService.transcribe).toHaveBeenCalled();
      expect(transcriptionEngine.transcriptionBuffer).toHaveLength(1);
      expect(transcriptionEngine.transcriptionBuffer[0]).toEqual(
        expect.objectContaining({
          text: 'Hello world',
          confidence: 0.9,
          provider: 'openai_whisper'
        })
      );
    });

    test('should handle fallback during audio processing', async () => {
      await transcriptionEngine.initialize({
        provider: 'openai_whisper',
        enableFallback: true,
        apiKeys: { openai_whisper: 'test-key' }
      });
      
      transcriptionEngine.currentProvider = 'openai_whisper';
      transcriptionEngine.localSTTService.isInitialized = true;
      
      // First call fails, second call (fallback) succeeds
      mockCloudSTTService.transcribe
        .mockRejectedValueOnce(new Error('rate limit exceeded'))
        .mockResolvedValueOnce({
          text: 'Fallback result',
          confidence: 0.8,
          provider: 'local_whisper'
        });
      
      const queueItem = {
        id: 'test-segment',
        audioData: mockAudioData,
        timestamp: Date.now(),
        retries: 0
      };
      
      // Process the segment - should fail and trigger fallback
      await transcriptionEngine.processAudioSegment(queueItem);
      
      // The item should be added back to queue with fallback provider
      expect(transcriptionEngine.processingQueue).toHaveLength(1);
      expect(transcriptionEngine.processingQueue[0].fallbackProvider).toBe('local_whisper');
    });
  });
});