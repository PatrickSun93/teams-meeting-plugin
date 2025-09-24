// Real-time Transcription Engine Tests
import TranscriptionEngine from '../TranscriptionEngine.js';

// Mock LocalSTTService
jest.mock('../LocalSTTService.js', () => {
  return jest.fn().mockImplementation(() => ({
    initialize: jest.fn().mockResolvedValue(true),
    isInitialized: true,
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    transcribe: jest.fn().mockResolvedValue({
      text: 'Mock transcription',
      confidence: 0.9,
      language: 'en'
    }),
    changeLanguage: jest.fn().mockResolvedValue(true),
    getAvailableLanguages: jest.fn().mockReturnValue(['en', 'es', 'fr']),
    getStatus: jest.fn().mockReturnValue({ isReady: true }),
    cleanup: jest.fn()
  }));
});

// Mock CloudSTTService
jest.mock('../CloudSTTService.js', () => {
  return jest.fn().mockImplementation(() => ({
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    transcribe: jest.fn().mockResolvedValue({
      text: 'Cloud transcription',
      confidence: 0.95,
      language: 'en'
    }),
    getNetworkStatus: jest.fn().mockReturnValue({ isOnline: true }),
    isProviderAvailable: jest.fn().mockReturnValue(true),
    getRateLimitStatus: jest.fn().mockReturnValue({ remaining: 100 }),
    getAvailableProviders: jest.fn().mockReturnValue([
      { id: 'openai_whisper', name: 'OpenAI Whisper' },
      { id: 'azure_speech', name: 'Azure Speech' }
    ]),
    cleanup: jest.fn()
  }));
});

describe('TranscriptionEngine Real-time Features', () => {
  let engine;
  let mockEventListener;

  beforeEach(async () => {
    engine = new TranscriptionEngine();
    mockEventListener = jest.fn();
    
    await engine.initialize({
      provider: 'local',
      language: 'en',
      realTimeMode: true,
      bufferSize: 3,
      outputDelay: 1000
    });
  });

  afterEach(() => {
    if (engine) {
      engine.cleanup();
    }
    jest.clearAllMocks();
  });

  describe('Pause and Resume Functionality', () => {
    test('should pause transcription', async () => {
      await engine.startTranscription();
      
      engine.addEventListener('transcriptionPaused', mockEventListener);
      engine.pauseTranscription();
      
      expect(engine.getStatus().isPaused).toBe(true);
      expect(mockEventListener).toHaveBeenCalledWith(
        expect.objectContaining({
          timestamp: expect.any(Number)
        })
      );
    });

    test('should resume transcription', async () => {
      await engine.startTranscription();
      engine.pauseTranscription();
      
      engine.addEventListener('transcriptionResumed', mockEventListener);
      engine.resumeTranscription();
      
      expect(engine.getStatus().isPaused).toBe(false);
      expect(mockEventListener).toHaveBeenCalledWith(
        expect.objectContaining({
          timestamp: expect.any(Number)
        })
      );
    });

    test('should not process audio when paused', async () => {
      await engine.startTranscription();
      engine.pauseTranscription();
      
      const audioData = {
        data: new Float32Array([0.1, 0.2, 0.3]),
        duration: 1.0,
        sampleRate: 16000
      };
      
      const initialQueueLength = engine.getStatus().queueLength;
      engine.handleAudioData(audioData);
      
      // Queue should not increase when paused
      expect(engine.getStatus().queueLength).toBe(initialQueueLength);
    });

    test('should resume processing queue when resumed', async () => {
      await engine.startTranscription();
      
      // Add audio data while active
      const audioData = {
        data: new Float32Array([0.1, 0.2, 0.3]),
        duration: 1.0,
        sampleRate: 16000
      };
      
      engine.handleAudioData(audioData);
      engine.pauseTranscription();
      
      // Resume should trigger queue processing
      const processingStatusListener = jest.fn();
      engine.addEventListener('processingStatusChanged', processingStatusListener);
      
      engine.resumeTranscription();
      
      // Should eventually start processing
      await new Promise(resolve => setTimeout(resolve, 100));
      
      expect(processingStatusListener).toHaveBeenCalled();
    });
  });

  describe('Real-time Streaming', () => {
    test('should emit partial results in real-time mode', async () => {
      await engine.startTranscription();
      
      const partialResultListener = jest.fn();
      engine.addEventListener('partialResult', partialResultListener);
      
      // Simulate transcription result
      engine.handleTranscriptionResult({
        text: 'Hello world',
        confidence: 0.9,
        timestamp: Date.now(),
        provider: 'local'
      }, 100);
      
      expect(partialResultListener).toHaveBeenCalledWith(
        expect.objectContaining({
          text: 'Hello world',
          confidence: 0.9,
          isPartial: true
        })
      );
    });

    test('should finalize streaming segments after delay', async () => {
      jest.useFakeTimers();
      
      await engine.startTranscription();
      
      const transcriptionResultListener = jest.fn();
      engine.addEventListener('transcriptionResult', transcriptionResultListener);
      
      // Simulate transcription result
      engine.handleTranscriptionResult({
        text: 'Test segment',
        confidence: 0.8,
        timestamp: Date.now(),
        provider: 'local'
      }, 100);
      
      // Fast-forward time to trigger finalization
      jest.advanceTimersByTime(1500);
      
      expect(transcriptionResultListener).toHaveBeenCalledWith(
        expect.objectContaining({
          text: 'Test segment',
          isFinal: true
        })
      );
      
      jest.useRealTimers();
    });

    test('should accumulate streaming buffer', async () => {
      await engine.startTranscription();
      
      // Add multiple results quickly
      engine.handleTranscriptionResult({
        text: 'Hello',
        confidence: 0.9,
        timestamp: Date.now(),
        provider: 'local'
      }, 50);
      
      engine.handleTranscriptionResult({
        text: 'world',
        confidence: 0.8,
        timestamp: Date.now() + 100,
        provider: 'local'
      }, 50);
      
      const status = engine.getStatus();
      expect(status.streamingBuffer).toBe('Hello world');
    });
  });

  describe('Transcription History Management', () => {
    test('should return transcription history', async () => {
      await engine.startTranscription();
      
      // Add some transcription segments
      engine.handleTranscriptionResult({
        text: 'First segment',
        confidence: 0.9,
        timestamp: Date.now(),
        provider: 'local'
      }, 100);
      
      engine.handleTranscriptionResult({
        text: 'Second segment',
        confidence: 0.8,
        timestamp: Date.now() + 1000,
        provider: 'local'
      }, 120);
      
      const history = engine.getTranscriptionHistory();
      
      expect(history).toHaveLength(2);
      expect(history[0]).toMatchObject({
        text: 'First segment',
        confidence: 0.9,
        provider: 'local'
      });
      expect(history[1]).toMatchObject({
        text: 'Second segment',
        confidence: 0.8,
        provider: 'local'
      });
    });

    test('should get full transcript text', async () => {
      await engine.startTranscription();
      
      // Add transcription segments
      engine.handleTranscriptionResult({
        text: 'Hello',
        confidence: 0.9,
        timestamp: Date.now(),
        provider: 'local'
      }, 100);
      
      engine.handleTranscriptionResult({
        text: 'world',
        confidence: 0.8,
        timestamp: Date.now() + 1000,
        provider: 'local'
      }, 120);
      
      const fullTranscript = engine.getFullTranscript();
      expect(fullTranscript).toBe('Hello world');
    });

    test('should clear transcription buffer', async () => {
      await engine.startTranscription();
      
      // Add transcription
      engine.handleTranscriptionResult({
        text: 'To be cleared',
        confidence: 0.9,
        timestamp: Date.now(),
        provider: 'local'
      }, 100);
      
      const clearListener = jest.fn();
      engine.addEventListener('transcriptionCleared', clearListener);
      
      engine.clearTranscriptionBuffer();
      
      expect(engine.getTranscriptionHistory()).toHaveLength(0);
      expect(engine.getFullTranscript()).toBe('');
      expect(clearListener).toHaveBeenCalledWith(
        expect.objectContaining({
          clearedSegments: expect.any(Array),
          timestamp: expect.any(Number)
        })
      );
    });
  });

  describe('Segment Editing', () => {
    test('should edit transcription segment', async () => {
      await engine.startTranscription();
      
      // Add segment
      const result = {
        id: 'edit-test',
        text: 'Original text',
        confidence: 0.9,
        timestamp: Date.now(),
        provider: 'local'
      };
      engine.handleTranscriptionResult(result, 100);
      
      const editListener = jest.fn();
      engine.addEventListener('segmentEdited', editListener);
      
      engine.editTranscriptionSegment('edit-test', 'Edited text');
      
      const history = engine.getTranscriptionHistory();
      const editedSegment = history.find(s => s.id === 'edit-test');
      
      expect(editedSegment.text).toBe('Edited text');
      expect(editedSegment.isEdited).toBe(true);
      expect(editListener).toHaveBeenCalledWith(
        expect.objectContaining({
          segmentId: 'edit-test',
          originalText: 'Original text',
          newText: 'Edited text'
        })
      );
    });

    test('should delete transcription segment', async () => {
      await engine.startTranscription();
      
      // Add segment
      const result = {
        id: 'delete-test',
        text: 'To be deleted',
        confidence: 0.9,
        timestamp: Date.now(),
        provider: 'local'
      };
      engine.handleTranscriptionResult(result, 100);
      
      const deleteListener = jest.fn();
      engine.addEventListener('segmentDeleted', deleteListener);
      
      engine.deleteTranscriptionSegment('delete-test');
      
      const history = engine.getTranscriptionHistory();
      expect(history.find(s => s.id === 'delete-test')).toBeUndefined();
      expect(deleteListener).toHaveBeenCalledWith(
        expect.objectContaining({
          segmentId: 'delete-test',
          deletedSegment: expect.objectContaining({
            text: 'To be deleted'
          })
        })
      );
    });

    test('should throw error when editing non-existent segment', () => {
      expect(() => {
        engine.editTranscriptionSegment('non-existent', 'New text');
      }).toThrow('Segment with id non-existent not found');
    });

    test('should throw error when deleting non-existent segment', () => {
      expect(() => {
        engine.deleteTranscriptionSegment('non-existent');
      }).toThrow('Segment with id non-existent not found');
    });
  });

  describe('Export Functionality', () => {
    beforeEach(async () => {
      await engine.startTranscription();
      
      // Add test segments
      const result1 = {
        id: 'export-1',
        text: 'First segment',
        confidence: 0.9,
        timestamp: new Date('2023-01-01T10:00:00Z').getTime(),
        provider: 'local'
      };
      engine.handleTranscriptionResult(result1, 100);
      
      const result2 = {
        id: 'export-2',
        text: 'Second segment',
        confidence: 0.8,
        timestamp: new Date('2023-01-01T10:00:03Z').getTime(),
        provider: 'local'
      };
      engine.handleTranscriptionResult(result2, 120);
    });

    test('should export as plain text', () => {
      const exported = engine.exportTranscription('text');
      expect(exported).toBe('First segment Second segment');
    });

    test('should export as JSON', () => {
      const exported = engine.exportTranscription('json');
      const parsed = JSON.parse(exported);
      
      expect(parsed).toHaveLength(2);
      expect(parsed[0]).toMatchObject({
        id: 'export-1',
        text: 'First segment',
        confidence: 0.9
      });
    });

    test('should export as SRT format', () => {
      const exported = engine.exportTranscription('srt');
      
      expect(exported).toContain('1\n');
      expect(exported).toContain('First segment');
      expect(exported).toContain('2\n');
      expect(exported).toContain('Second segment');
      expect(exported).toMatch(/\d{2}:\d{2}:\d{2},\d{3} --> \d{2}:\d{2}:\d{2},\d{3}/);
    });

    test('should export as WebVTT format', () => {
      const exported = engine.exportTranscription('vtt');
      
      expect(exported.startsWith('WEBVTT\n\n')).toBe(true);
      expect(exported).toContain('First segment');
      expect(exported).toContain('Second segment');
      expect(exported).toMatch(/\d{2}:\d{2}:\d{2}\.\d{3} --> \d{2}:\d{2}:\d{2}\.\d{3}/);
    });

    test('should throw error for unsupported format', () => {
      expect(() => {
        engine.exportTranscription('unsupported');
      }).toThrow('Unsupported export format: unsupported');
    });
  });

  describe('Processing Status Events', () => {
    test('should emit processing status changes', async () => {
      await engine.startTranscription();
      
      const statusListener = jest.fn();
      engine.addEventListener('processingStatusChanged', statusListener);
      
      const audioData = {
        data: new Float32Array([0.1, 0.2, 0.3]),
        duration: 1.0,
        sampleRate: 16000
      };
      
      engine.handleAudioData(audioData);
      
      // Should emit status change when audio is added to queue
      expect(statusListener).toHaveBeenCalledWith(
        expect.objectContaining({
          isProcessing: expect.any(Boolean),
          queueLength: expect.any(Number)
        })
      );
    });
  });

  describe('Enhanced Status Information', () => {
    test('should include real-time status in getStatus', async () => {
      await engine.startTranscription();
      
      const status = engine.getStatus();
      
      expect(status).toMatchObject({
        isInitialized: true,
        isTranscribing: true,
        isPaused: false,
        isProcessing: false,
        streamingBuffer: expect.any(String),
        hasStreamingTimer: expect.any(Boolean)
      });
    });

    test('should track streaming timer status', async () => {
      jest.useFakeTimers();
      
      await engine.startTranscription();
      
      // Add transcription to start streaming timer
      engine.handleTranscriptionResult({
        text: 'Test',
        confidence: 0.9,
        timestamp: Date.now(),
        provider: 'local'
      }, 100);
      
      let status = engine.getStatus();
      expect(status.hasStreamingTimer).toBe(true);
      
      // Fast-forward to clear timer
      jest.advanceTimersByTime(1500);
      
      status = engine.getStatus();
      expect(status.hasStreamingTimer).toBe(false);
      
      jest.useRealTimers();
    });
  });

  describe('Cleanup with Real-time Features', () => {
    test('should cleanup streaming timer on cleanup', async () => {
      jest.useFakeTimers();
      
      await engine.startTranscription();
      
      // Start streaming
      engine.handleTranscriptionResult({
        text: 'Test',
        confidence: 0.9,
        timestamp: Date.now(),
        provider: 'local'
      }, 100);
      
      expect(engine.getStatus().hasStreamingTimer).toBe(true);
      
      engine.cleanup();
      
      expect(engine.getStatus().hasStreamingTimer).toBe(false);
      expect(engine.getStatus().streamingBuffer).toBe('');
      
      jest.useRealTimers();
    });
  });

  describe('Confidence Calculation', () => {
    test('should calculate average confidence from recent results', async () => {
      await engine.startTranscription();
      
      // Add segments with different confidence levels
      engine.handleTranscriptionResult({
        id: 'conf-1',
        text: 'High confidence',
        confidence: 0.9,
        timestamp: Date.now(),
        provider: 'local'
      }, 100);
      
      engine.handleTranscriptionResult({
        id: 'conf-2',
        text: 'Medium confidence',
        confidence: 0.7,
        timestamp: Date.now() + 1000,
        provider: 'local'
      }, 120);
      
      engine.handleTranscriptionResult({
        id: 'conf-3',
        text: 'Low confidence',
        confidence: 0.5,
        timestamp: Date.now() + 2000,
        provider: 'local'
      }, 110);
      
      // Calculate average should use recent results
      const avgConfidence = engine.calculateAverageConfidence();
      expect(avgConfidence).toBeCloseTo(0.7, 1); // (0.9 + 0.7 + 0.5) / 3
    });
  });
});