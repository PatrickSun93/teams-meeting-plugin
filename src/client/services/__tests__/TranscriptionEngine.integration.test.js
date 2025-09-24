// TranscriptionEngine Integration Tests (without LocalSTTService dependency)
import CloudSTTService from '../CloudSTTService.js';

// Mock axios for CloudSTTService
jest.mock('axios');
import axios from 'axios';

// Mock navigator.onLine
Object.defineProperty(navigator, 'onLine', {
  writable: true,
  value: true
});

// Mock window.addEventListener
const mockAddEventListener = jest.fn();
Object.defineProperty(window, 'addEventListener', {
  value: mockAddEventListener
});

describe('TranscriptionEngine - Cloud Integration (Isolated)', () => {
  let mockTranscriptionEngine;
  let cloudSTTService;
  let mockAudioData;

  beforeEach(() => {
    // Create a minimal TranscriptionEngine mock that only tests cloud functionality
    mockTranscriptionEngine = {
      config: {
        provider: 'openai_whisper',
        language: 'en',
        enableFallback: true,
        apiKeys: { openai_whisper: 'test-key' },
        cloudConfig: {}
      },
      currentProvider: 'openai_whisper',
      isCloudProvider: (provider) => ['openai_whisper', 'azure_speech', 'claude_speech'].includes(provider),
      isLocalProvider: (provider) => provider === 'local_whisper' || provider === 'local'
    };

    cloudSTTService = new CloudSTTService();
    
    // Mock audio data
    mockAudioData = {
      data: new Float32Array([0.1, 0.2, -0.1, -0.2, 0.3]),
      sampleRate: 16000,
      duration: 1.0
    };
    
    // Reset axios mock
    axios.post.mockReset();
    navigator.onLine = true;
  });

  afterEach(() => {
    cloudSTTService.cleanup();
  });

  describe('Cloud Provider Integration', () => {
    test('should successfully transcribe with OpenAI Whisper', async () => {
      const mockResponse = {
        data: {
          text: 'Hello world from OpenAI',
          language: 'en',
          segments: [
            {
              text: 'Hello world from OpenAI',
              start: 0.0,
              end: 2.0
            }
          ]
        }
      };
      
      axios.post.mockResolvedValue(mockResponse);
      
      const result = await cloudSTTService.transcribe(mockAudioData, 'openai_whisper', {
        apiKey: 'test-key',
        language: 'en'
      });
      
      expect(result).toEqual({
        text: 'Hello world from OpenAI',
        confidence: 0.9,
        language: 'en',
        segments: [{
          text: 'Hello world from OpenAI',
          start: 0.0,
          end: 2.0,
          confidence: 0.9
        }],
        provider: 'openai_whisper',
        timestamp: expect.any(Number)
      });
      
      expect(axios.post).toHaveBeenCalledWith(
        'https://api.openai.com/v1/audio/transcriptions',
        expect.any(FormData),
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': 'Bearer test-key'
          })
        })
      );
    });

    test('should successfully transcribe with Azure Speech Services', async () => {
      const mockResponse = {
        data: {
          RecognitionStatus: 'Success',
          DisplayText: 'Hello world from Azure',
          Confidence: 0.95,
          NBest: [{
            Display: 'Hello world from Azure',
            Confidence: 0.95,
            Words: [{
              Word: 'Hello',
              Offset: 0,
              Duration: 5000000,
              Confidence: 0.95
            }, {
              Word: 'world',
              Offset: 5000000,
              Duration: 5000000,
              Confidence: 0.95
            }, {
              Word: 'from',
              Offset: 10000000,
              Duration: 5000000,
              Confidence: 0.95
            }, {
              Word: 'Azure',
              Offset: 15000000,
              Duration: 5000000,
              Confidence: 0.95
            }]
          }]
        }
      };
      
      axios.post.mockResolvedValue(mockResponse);
      
      const result = await cloudSTTService.transcribe(mockAudioData, 'azure_speech', {
        apiKey: 'test-key',
        region: 'eastus',
        language: 'en-US'
      });
      
      expect(result).toEqual({
        text: 'Hello world from Azure',
        confidence: 0.95,
        language: 'en',
        segments: expect.arrayContaining([
          expect.objectContaining({
            text: 'Hello',
            confidence: 0.95,
            start: 0,
            end: 0.5
          }),
          expect.objectContaining({
            text: 'world',
            confidence: 0.95,
            start: 0.5,
            end: 1.0
          })
        ]),
        provider: 'azure_speech',
        timestamp: expect.any(Number)
      });
      
      expect(axios.post).toHaveBeenCalledWith(
        expect.stringContaining('eastus.stt.speech.microsoft.com'),
        expect.any(Blob),
        expect.objectContaining({
          headers: expect.objectContaining({
            'Ocp-Apim-Subscription-Key': 'test-key'
          })
        })
      );
    });

    test('should handle rate limiting correctly', async () => {
      // Exhaust rate limit for OpenAI
      for (let i = 0; i < 50; i++) {
        cloudSTTService.recordRequest('openai_whisper');
      }
      
      await expect(
        cloudSTTService.transcribe(mockAudioData, 'openai_whisper', {
          apiKey: 'test-key'
        })
      ).rejects.toThrow('Rate limit exceeded for provider: openai_whisper');
    });

    test('should handle network connectivity issues', async () => {
      cloudSTTService.isOnline = false;
      
      await expect(
        cloudSTTService.transcribe(mockAudioData, 'openai_whisper', {
          apiKey: 'test-key'
        })
      ).rejects.toThrow('No internet connection available for cloud transcription');
    });

    test('should validate API key requirements', async () => {
      await expect(
        cloudSTTService.transcribe(mockAudioData, 'openai_whisper', {})
      ).rejects.toThrow('OpenAI API key is required');
      
      await expect(
        cloudSTTService.transcribe(mockAudioData, 'azure_speech', {})
      ).rejects.toThrow('Azure Speech Services API key is required');
      
      await expect(
        cloudSTTService.transcribe(mockAudioData, 'claude_speech', {})
      ).rejects.toThrow('Claude API key is required');
    });
  });

  describe('Provider Management', () => {
    test('should identify cloud providers correctly', () => {
      expect(mockTranscriptionEngine.isCloudProvider('openai_whisper')).toBe(true);
      expect(mockTranscriptionEngine.isCloudProvider('azure_speech')).toBe(true);
      expect(mockTranscriptionEngine.isCloudProvider('claude_speech')).toBe(true);
      expect(mockTranscriptionEngine.isCloudProvider('local_whisper')).toBe(false);
    });

    test('should identify local providers correctly', () => {
      expect(mockTranscriptionEngine.isLocalProvider('local_whisper')).toBe(true);
      expect(mockTranscriptionEngine.isLocalProvider('local')).toBe(true);
      expect(mockTranscriptionEngine.isLocalProvider('openai_whisper')).toBe(false);
    });

    test('should get available cloud providers', () => {
      const providers = cloudSTTService.getAvailableProviders();
      
      expect(providers).toHaveLength(3);
      expect(providers.map(p => p.id)).toEqual([
        'openai_whisper',
        'azure_speech',
        'claude_speech'
      ]);
      
      providers.forEach(provider => {
        expect(provider).toEqual({
          id: expect.any(String),
          name: expect.any(String),
          isOnline: true,
          rateLimit: expect.any(Object)
        });
      });
    });

    test('should check provider availability', () => {
      expect(cloudSTTService.isProviderAvailable('openai_whisper')).toBe(true);
      expect(cloudSTTService.isProviderAvailable('azure_speech')).toBe(true);
      expect(cloudSTTService.isProviderAvailable('claude_speech')).toBe(true);
      expect(cloudSTTService.isProviderAvailable('invalid_provider')).toBe(false);
    });
  });

  describe('Audio Processing', () => {
    test('should convert audio data to WAV format', () => {
      const wavBlob = cloudSTTService.audioDataToWav(mockAudioData);
      
      expect(wavBlob).toBeInstanceOf(Blob);
      expect(wavBlob.type).toBe('audio/wav');
      expect(wavBlob.size).toBeGreaterThan(44); // WAV header is 44 bytes
    });

    test('should validate audio data before processing', () => {
      const providerConfig = {
        maxFileSize: 25 * 1024 * 1024,
        supportedFormats: ['wav', 'mp3']
      };
      
      // Valid audio should not throw
      expect(() => {
        cloudSTTService.validateAudioData(mockAudioData, providerConfig);
      }).not.toThrow();
      
      // Invalid audio should throw
      expect(() => {
        cloudSTTService.validateAudioData(null, providerConfig);
      }).toThrow('Invalid audio data');
      
      expect(() => {
        cloudSTTService.validateAudioData({ data: null }, providerConfig);
      }).toThrow('Invalid audio data');
    });

    test('should prepare audio for different providers', async () => {
      const openAIBlob = await cloudSTTService.prepareAudioForProvider(mockAudioData, 'openai_whisper');
      const azureBlob = await cloudSTTService.prepareAudioForProvider(mockAudioData, 'azure_speech');
      const claudeBlob = await cloudSTTService.prepareAudioForProvider(mockAudioData, 'claude_speech');
      
      expect(openAIBlob).toBeInstanceOf(Blob);
      expect(azureBlob).toBeInstanceOf(Blob);
      expect(claudeBlob).toBeInstanceOf(Blob);
      
      expect(openAIBlob.type).toBe('audio/wav');
      expect(azureBlob.type).toBe('audio/wav');
      expect(claudeBlob.type).toBe('audio/wav');
    });
  });

  describe('Error Handling and Fallback', () => {
    test('should handle API errors gracefully', async () => {
      axios.post.mockRejectedValue(new Error('Network timeout'));
      
      await expect(
        cloudSTTService.transcribe(mockAudioData, 'openai_whisper', {
          apiKey: 'test-key'
        })
      ).rejects.toThrow('openai_whisper transcription failed: Network timeout');
    });

    test('should handle malformed API responses', async () => {
      // Test OpenAI with missing text
      axios.post.mockResolvedValue({ data: {} });
      
      const result = await cloudSTTService.transcribe(mockAudioData, 'openai_whisper', {
        apiKey: 'test-key'
      });
      
      expect(result.text).toBe('');
      expect(result.confidence).toBe(0.9); // Default for OpenAI
    });

    test('should handle Azure recognition failures', async () => {
      const mockResponse = {
        data: {
          RecognitionStatus: 'InitialSilenceTimeout'
        }
      };
      
      axios.post.mockResolvedValue(mockResponse);
      
      await expect(
        cloudSTTService.transcribe(mockAudioData, 'azure_speech', {
          apiKey: 'test-key'
        })
      ).rejects.toThrow('Azure transcription failed: InitialSilenceTimeout');
    });
  });

  describe('Network Monitoring', () => {
    test('should monitor network status changes', () => {
      const listener = jest.fn();
      cloudSTTService.addEventListener('networkStatusChanged', listener);
      
      // Simulate network status change
      cloudSTTService.isOnline = false;
      cloudSTTService.notifyListeners('networkStatusChanged', { isOnline: false });
      
      expect(listener).toHaveBeenCalledWith({ isOnline: false });
      
      // Simulate network recovery
      cloudSTTService.isOnline = true;
      cloudSTTService.notifyListeners('networkStatusChanged', { isOnline: true });
      
      expect(listener).toHaveBeenCalledWith({ isOnline: true });
    });

    test('should return current network status', () => {
      const status = cloudSTTService.getNetworkStatus();
      
      expect(status).toEqual({
        isOnline: expect.any(Boolean),
        lastCheck: expect.any(Number)
      });
    });
  });
});