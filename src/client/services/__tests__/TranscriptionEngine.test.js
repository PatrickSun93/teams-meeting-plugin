// TranscriptionEngine.test.js - Unit tests for Transcription Engine
import TranscriptionEngine from '../TranscriptionEngine.js';
import LocalSTTService from '../LocalSTTService.js';

// Mock LocalSTTService
jest.mock('../LocalSTTService.js');

describe('TranscriptionEngine', () => {
  let transcriptionEngine;
  let mockLocalSTTService;

  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();
    
    // Create mock LocalSTTService
    mockLocalSTTService = {
      initialize: jest.fn().mockResolvedValue(true),
      transcribe: jest.fn(),
      changeLanguage: jest.fn().mockResolvedValue(true),
      getAvailableLanguages: jest.fn().mockReturnValue(['en', 'es', 'fr']),
      getStatus: jest.fn().mockReturnValue({
        isInitialized: true,
        currentLanguage: 'en',
        modelName: 'whisper-tiny.en'
      }),
      addEventListener: jest.fn(),
      cleanup: jest.fn()
    };
    
    // Mock the LocalSTTService constructor
    LocalSTTService.mockImplementation(() => mockLocalSTTService);
    
    transcriptionEngine = new TranscriptionEngine();
  });

  afterEach(() => {
    if (transcriptionEngine) {
      transcriptionEngine.cleanup();
    }
  });

  describe('Initialization', () => {
    test('should initialize successfully with default config', async () => {
      const result = await transcriptionEngine.initialize();
      
      expect(result).toBe(true);
      expect(transcriptionEngine.isInitialized).toBe(true);
      expect(mockLocalSTTService.initialize).toHaveBeenCalledWith({
        language: 'en'
      });
    });

    test('should initialize with custom config', async () => {
      const customConfig = {
        language: 'es',
        confidenceThreshold: 0.5,
        maxRetries: 5
      };
      
      const result = await transcriptionEngine.initialize(customConfig);
      
      expect(result).toBe(true);
      expect(transcriptionEngine.config.language).toBe('es');
      expect(transcriptionEngine.config.confidenceThreshold).toBe(0.5);
      expect(transcriptionEngine.config.maxRetries).toBe(5);
    });

    test('should not reinitialize if already initialized', async () => {
      await transcriptionEngine.initialize();
      mockLocalSTTService.initialize.mockClear();
      
      const result = await transcriptionEngine.initialize();
      
      expect(result).toBe(true);
      expect(mockLocalSTTService.initialize).not.toHaveBeenCalled();
    });

    test('should handle initialization failure', async () => {
      mockLocalSTTService.initialize.mockRejectedValue(new Error('Init failed'));
      
      await expect(transcriptionEngine.initialize()).rejects.toThrow('Transcription engine initialization failed: Init failed');
      expect(transcriptionEngine.isInitialized).toBe(false);
    });

    test('should set up local STT event listeners', async () => {
      await transcriptionEngine.initialize();
      
      expect(mockLocalSTTService.addEventListener).toHaveBeenCalledWith('loadingStarted', expect.any(Function));
      expect(mockLocalSTTService.addEventListener).toHaveBeenCalledWith('initialized', expect.any(Function));
      expect(mockLocalSTTService.addEventListener).toHaveBeenCalledWith('transcriptionCompleted', expect.any(Function));
      expect(mockLocalSTTService.addEventListener).toHaveBeenCalledWith('transcriptionFailed', expect.any(Function));
    });
  });

  describe('Transcription Control', () => {
    beforeEach(async () => {
      await transcriptionEngine.initialize();
    });

    test('should start transcription successfully', async () => {
      await transcriptionEngine.startTranscription();
      
      expect(transcriptionEngine.isTranscribing).toBe(true);
      expect(transcriptionEngine.transcriptionBuffer).toEqual([]);
      expect(transcriptionEngine.processingQueue).toEqual([]);
    });

    test('should not start if not initialized', async () => {
      transcriptionEngine.isInitialized = false;
      
      await expect(transcriptionEngine.startTranscription()).rejects.toThrow('Transcription engine not initialized');
    });

    test('should not start if already transcribing', async () => {
      await transcriptionEngine.startTranscription();
      
      // Should not throw, just warn
      await transcriptionEngine.startTranscription();
      expect(transcriptionEngine.isTranscribing).toBe(true);
    });

    test('should stop transcription', async () => {
      await transcriptionEngine.startTranscription();
      transcriptionEngine.stopTranscription();
      
      expect(transcriptionEngine.isTranscribing).toBe(false);
      expect(transcriptionEngine.isProcessing).toBe(false);
    });

    test('should not stop if not transcribing', () => {
      // Should not throw, just warn
      transcriptionEngine.stopTranscription();
      expect(transcriptionEngine.isTranscribing).toBe(false);
    });
  });

  describe('Audio Processing', () => {
    beforeEach(async () => {
      await transcriptionEngine.initialize();
      await transcriptionEngine.startTranscription();
    });

    test('should handle audio data and add to queue', () => {
      const audioData = {
        data: new Float32Array([0.1, 0.2, 0.3]),
        timestamp: Date.now(),
        duration: 1.0
      };
      
      transcriptionEngine.handleAudioData(audioData);
      
      expect(transcriptionEngine.processingQueue.length).toBe(1);
      expect(transcriptionEngine.processingQueue[0].audioData).toBe(audioData);
    });

    test('should ignore audio data when not transcribing', () => {
      transcriptionEngine.stopTranscription();
      
      const audioData = {
        data: new Float32Array([0.1, 0.2, 0.3])
      };
      
      transcriptionEngine.handleAudioData(audioData);
      
      expect(transcriptionEngine.processingQueue.length).toBe(0);
    });

    test('should ignore invalid audio data', () => {
      transcriptionEngine.handleAudioData(null);
      transcriptionEngine.handleAudioData({ data: null });
      transcriptionEngine.handleAudioData({});
      
      expect(transcriptionEngine.processingQueue.length).toBe(0);
    });

    test('should validate audio quality', () => {
      const goodAudio = {
        data: new Float32Array(1000).fill(0.1),
        duration: 1.0
      };
      
      const silentAudio = {
        data: new Float32Array(1000).fill(0),
        duration: 1.0
      };
      
      const shortAudio = {
        data: new Float32Array(100).fill(0.1),
        duration: 0.1
      };
      
      expect(transcriptionEngine.isAudioQualitySufficient(goodAudio)).toBe(true);
      expect(transcriptionEngine.isAudioQualitySufficient(silentAudio)).toBe(false);
      expect(transcriptionEngine.isAudioQualitySufficient(shortAudio)).toBe(false);
    });
  });

  describe('Transcription Processing', () => {
    beforeEach(async () => {
      await transcriptionEngine.initialize();
      await transcriptionEngine.startTranscription();
    });

    test('should process audio segment successfully', async () => {
      const mockResult = {
        text: 'Hello world',
        confidence: 0.9,
        language: 'en',
        timestamp: Date.now()
      };
      
      mockLocalSTTService.transcribe.mockResolvedValue(mockResult);
      
      const queueItem = {
        id: 'test_1',
        audioData: {
          data: new Float32Array(1000).fill(0.1),
          duration: 1.0
        },
        timestamp: Date.now(),
        retries: 0
      };
      
      await transcriptionEngine.processAudioSegment(queueItem);
      
      expect(mockLocalSTTService.transcribe).toHaveBeenCalled();
      expect(transcriptionEngine.transcriptionBuffer.length).toBe(1);
      expect(transcriptionEngine.transcriptionBuffer[0].text).toBe('Hello world');
    });

    test('should handle transcription failure with retries', async () => {
      mockLocalSTTService.transcribe.mockRejectedValue(new Error('Transcription failed'));
      
      const queueItem = {
        id: 'test_1',
        audioData: {
          data: new Float32Array(1000).fill(0.1),
          duration: 1.0
        },
        timestamp: Date.now(),
        retries: 0
      };
      
      await transcriptionEngine.processAudioSegment(queueItem);
      
      // Should add back to queue for retry
      expect(transcriptionEngine.processingQueue.length).toBe(1);
      expect(transcriptionEngine.processingQueue[0].retries).toBe(1);
    });

    test('should validate transcription results', () => {
      const validResult = {
        text: 'Valid transcription',
        confidence: 0.8
      };
      
      const lowConfidenceResult = {
        text: 'Low confidence',
        confidence: 0.1
      };
      
      const emptyResult = {
        text: '',
        confidence: 0.9
      };
      
      expect(transcriptionEngine.isTranscriptionValid(validResult)).toBe(true);
      expect(transcriptionEngine.isTranscriptionValid(lowConfidenceResult)).toBe(false);
      expect(transcriptionEngine.isTranscriptionValid(emptyResult)).toBe(false);
    });

    test('should handle low confidence results', () => {
      const lowConfidenceResult = {
        text: 'Uncertain text',
        confidence: 0.2,
        timestamp: Date.now()
      };
      
      const queueItem = { id: 'test_1' };
      
      transcriptionEngine.handleLowConfidenceResult(lowConfidenceResult, queueItem);
      
      expect(transcriptionEngine.transcriptionBuffer.length).toBe(1);
      expect(transcriptionEngine.transcriptionBuffer[0].uncertain).toBe(true);
    });
  });

  describe('Text Output Management', () => {
    beforeEach(async () => {
      await transcriptionEngine.initialize();
      await transcriptionEngine.startTranscription();
    });

    test('should accumulate text in buffer', () => {
      const entries = [
        { text: 'Hello', confidence: 0.9 },
        { text: 'world', confidence: 0.8 },
        { text: 'test', confidence: 0.85 }
      ];
      
      entries.forEach(entry => {
        transcriptionEngine.transcriptionBuffer.push(entry);
      });
      
      const textLength = transcriptionEngine.getBufferTextLength();
      expect(textLength).toBe(14); // 'Hello' + 'world' + 'test'
    });

    test('should output accumulated text when conditions are met', () => {
      const listener = jest.fn();
      transcriptionEngine.addEventListener('textOutput', listener);
      
      // Add enough segments to trigger output
      for (let i = 0; i < 6; i++) {
        transcriptionEngine.transcriptionBuffer.push({
          text: `word${i}`,
          confidence: 0.8
        });
      }
      
      transcriptionEngine.checkForTextOutput();
      
      expect(listener).toHaveBeenCalled();
      expect(transcriptionEngine.transcriptionBuffer.length).toBe(0); // Buffer should be cleared
    });

    test('should calculate average confidence in output', () => {
      const listener = jest.fn();
      transcriptionEngine.addEventListener('textOutput', listener);
      
      transcriptionEngine.transcriptionBuffer = [
        { text: 'Hello', confidence: 0.9 },
        { text: 'world', confidence: 0.7 }
      ];
      
      transcriptionEngine.outputAccumulatedText();
      
      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          text: 'Hello world',
          confidence: 0.8, // Average of 0.9 and 0.7
          segmentCount: 2
        })
      );
    });
  });

  describe('Language Management', () => {
    beforeEach(async () => {
      await transcriptionEngine.initialize();
    });

    test('should change language', async () => {
      await transcriptionEngine.changeLanguage('es');
      
      expect(transcriptionEngine.config.language).toBe('es');
      expect(mockLocalSTTService.changeLanguage).toHaveBeenCalledWith('es');
    });

    test('should get available languages', () => {
      const languages = transcriptionEngine.getAvailableLanguages();
      
      expect(languages).toEqual(['en', 'es', 'fr']);
      expect(mockLocalSTTService.getAvailableLanguages).toHaveBeenCalled();
    });
  });

  describe('Metrics and Status', () => {
    beforeEach(async () => {
      await transcriptionEngine.initialize();
    });

    test('should update metrics on successful transcription', () => {
      transcriptionEngine.updateMetrics(100, true, 0.8);
      
      const metrics = transcriptionEngine.getMetrics();
      
      expect(metrics.totalTranscriptions).toBe(1);
      expect(metrics.successfulTranscriptions).toBe(1);
      expect(metrics.averageConfidence).toBe(0.8);
      expect(metrics.averageProcessingTime).toBe(100);
      expect(metrics.successRate).toBe(100);
    });

    test('should update metrics on failed transcription', () => {
      transcriptionEngine.updateMetrics(150, false, 0);
      
      const metrics = transcriptionEngine.getMetrics();
      
      expect(metrics.totalTranscriptions).toBe(1);
      expect(metrics.failedTranscriptions).toBe(1);
      expect(metrics.successRate).toBe(0);
    });

    test('should reset metrics', () => {
      transcriptionEngine.updateMetrics(100, true, 0.8);
      transcriptionEngine.resetMetrics();
      
      const metrics = transcriptionEngine.getMetrics();
      
      expect(metrics.totalTranscriptions).toBe(0);
      expect(metrics.successfulTranscriptions).toBe(0);
      expect(metrics.averageConfidence).toBe(0);
    });

    test('should get current status', () => {
      const status = transcriptionEngine.getStatus();
      
      expect(status.isInitialized).toBe(true);
      expect(status.isTranscribing).toBe(false);
      expect(status.currentProvider).toBe('local');
      expect(status.config).toBeDefined();
      expect(status.metrics).toBeDefined();
      expect(status.localSTTStatus).toBeDefined();
    });
  });

  describe('Event System', () => {
    test('should add and remove event listeners', () => {
      const listener = jest.fn();
      
      transcriptionEngine.addEventListener('test', listener);
      transcriptionEngine.notifyListeners('test', { data: 'test' });
      
      expect(listener).toHaveBeenCalledWith({ data: 'test' });
      
      transcriptionEngine.removeEventListener('test', listener);
      transcriptionEngine.notifyListeners('test', { data: 'test2' });
      
      expect(listener).toHaveBeenCalledTimes(1);
    });

    test('should handle listener errors gracefully', () => {
      const errorListener = jest.fn(() => {
        throw new Error('Listener error');
      });
      const goodListener = jest.fn();
      
      transcriptionEngine.addEventListener('test', errorListener);
      transcriptionEngine.addEventListener('test', goodListener);
      
      expect(() => {
        transcriptionEngine.notifyListeners('test', {});
      }).not.toThrow();
      
      expect(goodListener).toHaveBeenCalled();
    });

    test('should emit transcription events', async () => {
      const startedListener = jest.fn();
      const stoppedListener = jest.fn();
      
      transcriptionEngine.addEventListener('transcriptionStarted', startedListener);
      transcriptionEngine.addEventListener('transcriptionStopped', stoppedListener);
      
      await transcriptionEngine.initialize();
      await transcriptionEngine.startTranscription();
      transcriptionEngine.stopTranscription();
      
      expect(startedListener).toHaveBeenCalled();
      expect(stoppedListener).toHaveBeenCalled();
    });
  });

  describe('Queue Processing', () => {
    beforeEach(async () => {
      await transcriptionEngine.initialize();
      await transcriptionEngine.startTranscription();
    });

    test('should process queue items in order', async () => {
      const mockResults = [
        { text: 'First', confidence: 0.9, timestamp: Date.now() },
        { text: 'Second', confidence: 0.8, timestamp: Date.now() }
      ];
      
      mockLocalSTTService.transcribe
        .mockResolvedValueOnce(mockResults[0])
        .mockResolvedValueOnce(mockResults[1]);
      
      // Add multiple items to queue
      const audioData1 = { data: new Float32Array(1000).fill(0.1), duration: 1.0 };
      const audioData2 = { data: new Float32Array(1000).fill(0.2), duration: 1.0 };
      
      transcriptionEngine.handleAudioData(audioData1);
      transcriptionEngine.handleAudioData(audioData2);
      
      // Process queue
      await transcriptionEngine.processTranscriptionQueue();
      
      expect(mockLocalSTTService.transcribe).toHaveBeenCalledTimes(2);
      expect(transcriptionEngine.transcriptionBuffer.length).toBe(2);
    });

    test('should handle processing errors in queue', async () => {
      mockLocalSTTService.transcribe.mockRejectedValue(new Error('Processing error'));
      
      const audioData = { data: new Float32Array(1000).fill(0.1), duration: 1.0 };
      transcriptionEngine.handleAudioData(audioData);
      
      await transcriptionEngine.processTranscriptionQueue();
      
      // Should have retried and added back to queue
      expect(transcriptionEngine.processingQueue.length).toBe(1);
    });
  });

  describe('Cleanup', () => {
    test('should cleanup resources properly', async () => {
      await transcriptionEngine.initialize();
      await transcriptionEngine.startTranscription();
      
      transcriptionEngine.cleanup();
      
      expect(transcriptionEngine.isTranscribing).toBe(false);
      expect(transcriptionEngine.isInitialized).toBe(false);
      expect(transcriptionEngine.transcriptionBuffer).toEqual([]);
      expect(transcriptionEngine.processingQueue).toEqual([]);
      expect(transcriptionEngine.eventListeners.size).toBe(0);
      expect(mockLocalSTTService.cleanup).toHaveBeenCalled();
    });
  });

  describe('Utility Functions', () => {
    test('should implement delay function', async () => {
      const startTime = Date.now();
      await transcriptionEngine.delay(100);
      const endTime = Date.now();
      
      expect(endTime - startTime).toBeGreaterThanOrEqual(90); // Allow some variance
    });
  });
});