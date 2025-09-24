// LocalSTTService.test.js - Unit tests for Local STT Service
import LocalSTTService from '../LocalSTTService.js';

// Mock @xenova/transformers
jest.mock('@xenova/transformers', () => ({
  pipeline: jest.fn(),
  env: {
    allowRemoteModels: false,
    allowLocalModels: true
  }
}));

describe('LocalSTTService', () => {
  let sttService;
  let mockPipeline;

  beforeEach(() => {
    sttService = new LocalSTTService();
    mockPipeline = jest.fn();
    
    // Reset mocks
    jest.clearAllMocks();
    
    // Mock the pipeline function
    const { pipeline } = require('@xenova/transformers');
    pipeline.mockResolvedValue(mockPipeline);
  });

  afterEach(() => {
    if (sttService) {
      sttService.cleanup();
    }
  });

  describe('Initialization', () => {
    test('should initialize successfully with default settings', async () => {
      const result = await sttService.initialize();
      
      expect(result).toBe(true);
      expect(sttService.isInitialized).toBe(true);
      expect(sttService.modelName).toBe('Xenova/whisper-tiny.en');
      expect(sttService.currentLanguage).toBe('en');
    });

    test('should initialize with custom language', async () => {
      const result = await sttService.initialize({ language: 'multilingual' });
      
      expect(result).toBe(true);
      expect(sttService.currentLanguage).toBe('multilingual');
      expect(sttService.modelName).toBe('Xenova/whisper-tiny');
    });

    test('should not reinitialize if already initialized', async () => {
      await sttService.initialize();
      const { pipeline } = require('@xenova/transformers');
      pipeline.mockClear();
      
      const result = await sttService.initialize();
      
      expect(result).toBe(true);
      expect(pipeline).not.toHaveBeenCalled();
    });

    test('should handle initialization failure', async () => {
      const { pipeline } = require('@xenova/transformers');
      pipeline.mockRejectedValue(new Error('Model loading failed'));
      
      await expect(sttService.initialize()).rejects.toThrow('Local STT initialization failed: Model loading failed');
      expect(sttService.isInitialized).toBe(false);
    });

    test('should emit initialization events', async () => {
      const loadingStartedListener = jest.fn();
      const initializedListener = jest.fn();
      
      sttService.addEventListener('loadingStarted', loadingStartedListener);
      sttService.addEventListener('initialized', initializedListener);
      
      await sttService.initialize();
      
      expect(loadingStartedListener).toHaveBeenCalledWith({
        modelName: 'Xenova/whisper-tiny.en'
      });
      expect(initializedListener).toHaveBeenCalledWith({
        modelName: 'Xenova/whisper-tiny.en',
        language: 'en'
      });
    });
  });

  describe('Audio Processing', () => {
    beforeEach(async () => {
      await sttService.initialize();
    });

    test('should prepare audio for Whisper correctly', () => {
      const audioData = {
        data: new Float32Array([0.1, 0.2, 0.3, 0.4]),
        sampleRate: 44100
      };
      
      const processedAudio = sttService.prepareAudioForWhisper(audioData);
      
      expect(processedAudio).toBeInstanceOf(Float32Array);
      expect(processedAudio.length).toBeGreaterThan(0);
    });

    test('should resample audio to 16kHz', () => {
      const sourceData = new Float32Array(1000);
      sourceData.fill(0.5);
      
      const resampled = sttService.resampleAudio(sourceData, 44100, 16000);
      
      expect(resampled).toBeInstanceOf(Float32Array);
      expect(resampled.length).toBeLessThan(sourceData.length);
      expect(resampled.length).toBeCloseTo(Math.round(1000 * 16000 / 44100), 10);
    });

    test('should normalize audio levels', () => {
      const audioData = new Float32Array([0.1, 0.5, 1.0, -0.8, 0.3]);
      
      const normalized = sttService.normalizeAudio(audioData);
      
      expect(normalized).toBeInstanceOf(Float32Array);
      expect(Math.max(...normalized)).toBeLessThanOrEqual(0.81); // Allow for floating point precision
      expect(Math.min(...normalized)).toBeGreaterThanOrEqual(-0.81);
    });

    test('should apply pre-emphasis filter', () => {
      const audioData = new Float32Array([0.1, 0.2, 0.3, 0.4]);
      
      const filtered = sttService.applyPreEmphasis(audioData);
      
      expect(filtered).toBeInstanceOf(Float32Array);
      expect(filtered.length).toBe(audioData.length);
      expect(filtered[0]).toBe(audioData[0]);
    });
  });

  describe('Transcription', () => {
    beforeEach(async () => {
      await sttService.initialize();
    });

    test('should transcribe audio successfully', async () => {
      const mockResult = {
        text: 'Hello world',
        confidence: 0.95
      };
      mockPipeline.mockResolvedValue(mockResult);
      
      const audioData = {
        data: new Float32Array(1000),
        sampleRate: 16000,
        duration: 1.0
      };
      
      const result = await sttService.transcribe(audioData);
      
      expect(result.text).toBe('Hello world');
      expect(result.confidence).toBeCloseTo(0.8, 1); // Quality assessment may adjust confidence
      expect(result.language).toBe('en');
      expect(result.timestamp).toBeDefined();
      expect(mockPipeline).toHaveBeenCalled();
    });

    test('should handle string result from Whisper', async () => {
      mockPipeline.mockResolvedValue('Simple text result');
      
      const audioData = {
        data: new Float32Array(1000),
        sampleRate: 16000
      };
      
      const result = await sttService.transcribe(audioData);
      
      expect(result.text).toBe('Simple text result');
      expect(result.confidence).toBe(0.8); // Default confidence for string results
    });

    test('should process segments when available', async () => {
      const mockResult = {
        text: 'Hello world',
        confidence: 0.9,
        chunks: [
          { text: 'Hello', timestamp: [0, 0.5], confidence: 0.95 },
          { text: 'world', timestamp: [0.5, 1.0], confidence: 0.85 }
        ]
      };
      mockPipeline.mockResolvedValue(mockResult);
      
      const audioData = {
        data: new Float32Array(1000),
        sampleRate: 16000
      };
      
      const result = await sttService.transcribe(audioData);
      
      expect(result.segments).toHaveLength(2);
      expect(result.segments[0].text).toBe('Hello');
      expect(result.segments[0].startTime).toBe(0);
      expect(result.segments[0].endTime).toBe(0.5);
    });

    test('should handle transcription failure gracefully', async () => {
      mockPipeline.mockRejectedValue(new Error('Transcription failed'));
      
      const audioData = {
        data: new Float32Array(1000),
        sampleRate: 16000
      };
      
      const result = await sttService.transcribe(audioData);
      
      expect(result.text).toBe('');
      expect(result.confidence).toBe(0);
      expect(result.error).toBe('Transcription failed');
      expect(result.fallback).toBe(true);
    });

    test('should validate audio data before transcription', async () => {
      const invalidAudioData = { data: null };
      
      const result = await sttService.transcribe(invalidAudioData);
      
      expect(result.text).toBe('');
      expect(result.error).toBe('Invalid audio data provided');
      expect(result.fallback).toBe(true);
    });

    test('should emit transcription events', async () => {
      const completedListener = jest.fn();
      const failedListener = jest.fn();
      
      sttService.addEventListener('transcriptionCompleted', completedListener);
      sttService.addEventListener('transcriptionFailed', failedListener);
      
      mockPipeline.mockResolvedValue({ text: 'Test', confidence: 0.8 });
      
      const audioData = {
        data: new Float32Array(1000),
        sampleRate: 16000
      };
      
      await sttService.transcribe(audioData);
      
      expect(completedListener).toHaveBeenCalled();
      expect(failedListener).not.toHaveBeenCalled();
    });
  });

  describe('Text Processing', () => {
    beforeEach(async () => {
      await sttService.initialize();
    });

    test('should clean transcription text', () => {
      const dirtyText = '  Hello,   world!  ';
      const cleaned = sttService.cleanTranscriptionText(dirtyText);
      
      expect(cleaned).toBe('Hello, world'); // Trailing punctuation is removed
    });

    test('should remove unusual characters', () => {
      const textWithSpecialChars = 'Hello @#$% world!';
      const cleaned = sttService.cleanTranscriptionText(textWithSpecialChars);
      
      expect(cleaned).toBe('Hello  world'); // Special chars removed, trailing punctuation removed
    });

    test('should assess transcription quality', () => {
      const goodText = 'This is a well-formed sentence with proper structure.';
      const poorText = 'a a a a a';
      
      const goodQuality = sttService.assessTranscriptionQuality(goodText, {});
      const poorQuality = sttService.assessTranscriptionQuality(poorText, {});
      
      expect(goodQuality).toBeGreaterThan(poorQuality);
      expect(goodQuality).toBeGreaterThan(0.8);
      expect(poorQuality).toBeLessThan(0.8);
    });

    test('should detect language patterns', () => {
      const englishText = 'The quick brown fox jumps over the lazy dog and it is in the house';
      const spanishText = 'El gato está en la mesa con el perro y no se mueve de ahí';
      
      const englishLang = sttService.detectLanguage(englishText);
      const spanishLang = sttService.detectLanguage(spanishText);
      
      expect(englishLang).toBe('en');
      expect(spanishLang).toBe('es');
    });

    test('should return null for short text language detection', () => {
      const shortText = 'Hi';
      const detected = sttService.detectLanguage(shortText);
      
      expect(detected).toBeNull();
    });
  });

  describe('Language Management', () => {
    beforeEach(async () => {
      await sttService.initialize();
    });

    test('should change language successfully', async () => {
      await sttService.changeLanguage('multilingual');
      
      expect(sttService.currentLanguage).toBe('multilingual');
      expect(sttService.modelName).toBe('Xenova/whisper-tiny');
    });

    test('should throw error for unsupported language', async () => {
      await expect(sttService.changeLanguage('unsupported')).rejects.toThrow('Unsupported language: unsupported');
    });

    test('should get available languages', () => {
      const languages = sttService.getAvailableLanguages();
      
      expect(languages).toContain('en');
      expect(languages).toContain('multilingual');
      expect(Array.isArray(languages)).toBe(true);
    });
  });

  describe('Statistics and Monitoring', () => {
    beforeEach(async () => {
      await sttService.initialize();
    });

    test('should track performance statistics', async () => {
      mockPipeline.mockResolvedValue({ text: 'Test', confidence: 0.8 });
      
      const audioData = {
        data: new Float32Array(1000),
        sampleRate: 16000
      };
      
      await sttService.transcribe(audioData);
      
      const stats = sttService.getStats();
      
      expect(stats.totalTranscriptions).toBe(1);
      expect(stats.successRate).toBe(100);
      expect(stats.averageProcessingTime).toBeGreaterThan(0);
    });

    test('should track failures in statistics', async () => {
      mockPipeline.mockRejectedValue(new Error('Failed'));
      
      const audioData = {
        data: new Float32Array(1000),
        sampleRate: 16000
      };
      
      await sttService.transcribe(audioData);
      
      const stats = sttService.getStats();
      
      expect(stats.totalTranscriptions).toBe(1);
      expect(stats.failures).toBe(1);
      expect(stats.successRate).toBe(0);
    });

    test('should reset statistics', async () => {
      mockPipeline.mockResolvedValue({ text: 'Test', confidence: 0.8 });
      
      const audioData = {
        data: new Float32Array(1000),
        sampleRate: 16000
      };
      
      await sttService.transcribe(audioData);
      sttService.resetStats();
      
      const stats = sttService.getStats();
      
      expect(stats.totalTranscriptions).toBe(0);
      expect(stats.successRate).toBe(0);
    });

    test('should get current status', () => {
      const status = sttService.getStatus();
      
      expect(status.isInitialized).toBe(true);
      expect(status.currentLanguage).toBe('en');
      expect(status.modelName).toBe('Xenova/whisper-tiny.en');
      expect(status.stats).toBeDefined();
    });
  });

  describe('Event System', () => {
    test('should add and remove event listeners', () => {
      const listener = jest.fn();
      
      sttService.addEventListener('test', listener);
      sttService.notifyListeners('test', { data: 'test' });
      
      expect(listener).toHaveBeenCalledWith({ data: 'test' });
      
      sttService.removeEventListener('test', listener);
      sttService.notifyListeners('test', { data: 'test2' });
      
      expect(listener).toHaveBeenCalledTimes(1);
    });

    test('should handle listener errors gracefully', () => {
      const errorListener = jest.fn(() => {
        throw new Error('Listener error');
      });
      const goodListener = jest.fn();
      
      sttService.addEventListener('test', errorListener);
      sttService.addEventListener('test', goodListener);
      
      // Should not throw despite error in first listener
      expect(() => {
        sttService.notifyListeners('test', {});
      }).not.toThrow();
      
      expect(goodListener).toHaveBeenCalled();
    });
  });

  describe('Cleanup', () => {
    test('should cleanup resources properly', async () => {
      await sttService.initialize();
      
      sttService.cleanup();
      
      expect(sttService.pipeline).toBeNull();
      expect(sttService.isInitialized).toBe(false);
      expect(sttService.eventListeners.size).toBe(0);
    });
  });
});