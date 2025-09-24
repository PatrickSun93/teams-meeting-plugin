// CloudSTTService Tests
import CloudSTTService from '../CloudSTTService.js';

// Mock axios
jest.mock('axios');
import axios from 'axios';

// Mock navigator.onLine
Object.defineProperty(navigator, 'onLine', {
  writable: true,
  value: true
});

// Mock window.addEventListener
const mockAddEventListener = jest.fn();
const mockRemoveEventListener = jest.fn();
Object.defineProperty(window, 'addEventListener', {
  value: mockAddEventListener
});
Object.defineProperty(window, 'removeEventListener', {
  value: mockRemoveEventListener
});

describe('CloudSTTService', () => {
  let cloudSTTService;
  let mockAudioData;

  beforeEach(() => {
    cloudSTTService = new CloudSTTService();
    
    // Mock audio data
    mockAudioData = {
      data: new Float32Array([0.1, 0.2, -0.1, -0.2, 0.3]),
      sampleRate: 16000,
      duration: 1.0
    };
    
    // Reset axios mock
    axios.post.mockReset();
    
    // Reset navigator.onLine
    navigator.onLine = true;
  });

  afterEach(() => {
    cloudSTTService.cleanup();
  });

  describe('Initialization', () => {
    test('should initialize with default providers', () => {
      const providers = cloudSTTService.getAvailableProviders();
      
      expect(providers).toHaveLength(3);
      expect(providers.map(p => p.id)).toEqual([
        'openai_whisper',
        'azure_speech', 
        'claude_speech'
      ]);
    });

    test('should set up network monitoring', () => {
      expect(mockAddEventListener).toHaveBeenCalledWith('online', expect.any(Function));
      expect(mockAddEventListener).toHaveBeenCalledWith('offline', expect.any(Function));
    });
  });

  describe('Network Status', () => {
    test('should return correct network status', () => {
      const status = cloudSTTService.getNetworkStatus();
      
      expect(status).toEqual({
        isOnline: true,
        lastCheck: expect.any(Number)
      });
    });

    test('should handle network offline event', () => {
      const listener = jest.fn();
      cloudSTTService.addEventListener('networkStatusChanged', listener);
      
      // Simulate offline event by directly calling the handler
      navigator.onLine = false;
      cloudSTTService.isOnline = false;
      cloudSTTService.notifyListeners('networkStatusChanged', { isOnline: false });
      
      expect(listener).toHaveBeenCalledWith({ isOnline: false });
    });
  });

  describe('Rate Limiting', () => {
    test('should check rate limits correctly', () => {
      // Should allow requests initially
      expect(cloudSTTService.checkRateLimit('openai_whisper')).toBe(true);
      
      // Record many requests
      for (let i = 0; i < 50; i++) {
        cloudSTTService.recordRequest('openai_whisper');
      }
      
      // Should now be rate limited
      expect(cloudSTTService.checkRateLimit('openai_whisper')).toBe(false);
    });

    test('should get rate limit status', () => {
      cloudSTTService.recordRequest('openai_whisper');
      
      const status = cloudSTTService.getRateLimitStatus('openai_whisper');
      
      expect(status).toEqual({
        requests: 1,
        limit: 50,
        windowMs: 60000,
        resetTime: expect.any(Number)
      });
    });
  });

  describe('Provider Availability', () => {
    test('should check provider availability', () => {
      expect(cloudSTTService.isProviderAvailable('openai_whisper')).toBe(true);
      expect(cloudSTTService.isProviderAvailable('invalid_provider')).toBe(false);
    });

    test('should return false when offline', () => {
      navigator.onLine = false;
      cloudSTTService.isOnline = false;
      
      expect(cloudSTTService.isProviderAvailable('openai_whisper')).toBe(false);
    });
  });

  describe('Audio Validation', () => {
    test('should validate audio data correctly', () => {
      const providerConfig = {
        maxFileSize: 25 * 1024 * 1024,
        supportedFormats: ['wav', 'mp3']
      };
      
      // Should not throw for valid audio
      expect(() => {
        cloudSTTService.validateAudioData(mockAudioData, providerConfig);
      }).not.toThrow();
    });

    test('should reject invalid audio data', () => {
      const providerConfig = {
        maxFileSize: 25 * 1024 * 1024,
        supportedFormats: ['wav', 'mp3']
      };
      
      // Should throw for null data
      expect(() => {
        cloudSTTService.validateAudioData(null, providerConfig);
      }).toThrow('Invalid audio data');
      
      // Should throw for empty data
      expect(() => {
        cloudSTTService.validateAudioData({ data: null }, providerConfig);
      }).toThrow('Invalid audio data');
    });

    test('should reject audio that is too long', () => {
      const providerConfig = {
        maxFileSize: 25 * 1024 * 1024,
        supportedFormats: ['wav', 'mp3']
      };
      
      const longAudioData = {
        ...mockAudioData,
        duration: 700 // 11+ minutes
      };
      
      expect(() => {
        cloudSTTService.validateAudioData(longAudioData, providerConfig);
      }).toThrow('Audio duration too long');
    });
  });

  describe('Audio Format Conversion', () => {
    test('should convert audio data to WAV blob', () => {
      const wavBlob = cloudSTTService.audioDataToWav(mockAudioData);
      
      expect(wavBlob).toBeInstanceOf(Blob);
      expect(wavBlob.type).toBe('audio/wav');
      expect(wavBlob.size).toBeGreaterThan(44); // WAV header + data
    });

    test('should prepare audio for different providers', async () => {
      const blob = await cloudSTTService.prepareAudioForProvider(mockAudioData, 'openai_whisper');
      
      expect(blob).toBeInstanceOf(Blob);
      expect(blob.type).toBe('audio/wav');
    });
  });

  describe('OpenAI Whisper Integration', () => {
    test('should transcribe with OpenAI successfully', async () => {
      const mockResponse = {
        data: {
          text: 'Hello world',
          language: 'en',
          segments: [
            {
              text: 'Hello world',
              start: 0.0,
              end: 1.0
            }
          ]
        }
      };
      
      axios.post.mockResolvedValue(mockResponse);
      
      const result = await cloudSTTService.transcribe(mockAudioData, 'openai_whisper', {
        apiKey: 'test-key'
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
      
      expect(result).toEqual({
        text: 'Hello world',
        confidence: 0.9,
        language: 'en',
        segments: [{
          text: 'Hello world',
          start: 0.0,
          end: 1.0,
          confidence: 0.9
        }],
        provider: 'openai_whisper',
        timestamp: expect.any(Number)
      });
    });

    test('should handle OpenAI API errors', async () => {
      axios.post.mockRejectedValue(new Error('API Error'));
      
      await expect(
        cloudSTTService.transcribe(mockAudioData, 'openai_whisper', {
          apiKey: 'test-key'
        })
      ).rejects.toThrow('openai_whisper transcription failed: API Error');
    });

    test('should require API key for OpenAI', async () => {
      await expect(
        cloudSTTService.transcribe(mockAudioData, 'openai_whisper', {})
      ).rejects.toThrow('OpenAI API key is required');
    });
  });

  describe('Azure Speech Services Integration', () => {
    test('should transcribe with Azure successfully', async () => {
      const mockResponse = {
        data: {
          RecognitionStatus: 'Success',
          DisplayText: 'Hello world',
          Confidence: 0.95,
          NBest: [{
            Display: 'Hello world',
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
            }]
          }]
        }
      };
      
      axios.post.mockResolvedValue(mockResponse);
      
      const result = await cloudSTTService.transcribe(mockAudioData, 'azure_speech', {
        apiKey: 'test-key',
        region: 'eastus'
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
      
      expect(result).toEqual({
        text: 'Hello world',
        confidence: 0.95,
        language: 'en',
        segments: expect.arrayContaining([
          expect.objectContaining({
            text: 'Hello',
            confidence: 0.95
          })
        ]),
        provider: 'azure_speech',
        timestamp: expect.any(Number)
      });
    });

    test('should handle Azure recognition failure', async () => {
      const mockResponse = {
        data: {
          RecognitionStatus: 'NoMatch'
        }
      };
      
      axios.post.mockResolvedValue(mockResponse);
      
      await expect(
        cloudSTTService.transcribe(mockAudioData, 'azure_speech', {
          apiKey: 'test-key'
        })
      ).rejects.toThrow('Azure transcription failed: NoMatch');
    });

    test('should require API key for Azure', async () => {
      await expect(
        cloudSTTService.transcribe(mockAudioData, 'azure_speech', {})
      ).rejects.toThrow('Azure Speech Services API key is required');
    });
  });

  describe('Claude Speech Integration', () => {
    test('should transcribe with Claude successfully', async () => {
      const mockResponse = {
        data: {
          transcript: 'Hello world',
          confidence: 0.88,
          language: 'en',
          segments: [{
            text: 'Hello world',
            start_time: 0.0,
            end_time: 1.0,
            confidence: 0.88
          }]
        }
      };
      
      axios.post.mockResolvedValue(mockResponse);
      
      const result = await cloudSTTService.transcribe(mockAudioData, 'claude_speech', {
        apiKey: 'test-key'
      });
      
      expect(axios.post).toHaveBeenCalledWith(
        'https://api.anthropic.com/v1/speech/transcribe',
        expect.any(FormData),
        expect.objectContaining({
          headers: expect.objectContaining({
            'x-api-key': 'test-key'
          })
        })
      );
      
      expect(result).toEqual({
        text: 'Hello world',
        confidence: 0.88,
        language: 'en',
        segments: [{
          text: 'Hello world',
          start: 0.0,
          end: 1.0,
          confidence: 0.88
        }],
        provider: 'claude_speech',
        timestamp: expect.any(Number)
      });
    });

    test('should require API key for Claude', async () => {
      await expect(
        cloudSTTService.transcribe(mockAudioData, 'claude_speech', {})
      ).rejects.toThrow('Claude API key is required');
    });
  });

  describe('Error Handling', () => {
    test('should handle network offline error', async () => {
      navigator.onLine = false;
      cloudSTTService.isOnline = false;
      
      await expect(
        cloudSTTService.transcribe(mockAudioData, 'openai_whisper', {
          apiKey: 'test-key'
        })
      ).rejects.toThrow('No internet connection available');
    });

    test('should handle unsupported provider', async () => {
      // Ensure we're online first
      cloudSTTService.isOnline = true;
      
      await expect(
        cloudSTTService.transcribe(mockAudioData, 'unsupported_provider', {})
      ).rejects.toThrow('Unsupported provider: unsupported_provider');
    });

    test('should handle rate limit exceeded', async () => {
      // Exhaust rate limit
      for (let i = 0; i < 50; i++) {
        cloudSTTService.recordRequest('openai_whisper');
      }
      
      await expect(
        cloudSTTService.transcribe(mockAudioData, 'openai_whisper', {
          apiKey: 'test-key'
        })
      ).rejects.toThrow('Rate limit exceeded for provider: openai_whisper');
    });
  });

  describe('Event Handling', () => {
    test('should add and remove event listeners', () => {
      const listener = jest.fn();
      
      cloudSTTService.addEventListener('test', listener);
      cloudSTTService.notifyListeners('test', { data: 'test' });
      
      expect(listener).toHaveBeenCalledWith({ data: 'test' });
      
      cloudSTTService.removeEventListener('test', listener);
      cloudSTTService.notifyListeners('test', { data: 'test2' });
      
      expect(listener).toHaveBeenCalledTimes(1);
    });

    test('should handle listener errors gracefully', () => {
      const errorListener = jest.fn(() => {
        throw new Error('Listener error');
      });
      
      cloudSTTService.addEventListener('test', errorListener);
      
      // Should not throw
      expect(() => {
        cloudSTTService.notifyListeners('test', {});
      }).not.toThrow();
    });
  });

  describe('Cleanup', () => {
    test('should cleanup resources properly', () => {
      const clearIntervalSpy = jest.spyOn(global, 'clearInterval');
      
      cloudSTTService.cleanup();
      
      expect(clearIntervalSpy).toHaveBeenCalled();
      // Note: The actual event listeners are stored internally, so we can't easily test their removal
      // but we can verify the cleanup method runs without errors
    });
  });
});