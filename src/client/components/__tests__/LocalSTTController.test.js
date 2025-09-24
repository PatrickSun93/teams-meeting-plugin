// LocalSTTController.test.js - Unit tests for LocalSTTController
import { renderHook, act } from '@testing-library/react-hooks';
import LocalSTTController from '../LocalSTTController.js';
import AudioProcessor from '../AudioProcessor.js';
import TranscriptionEngine from '../../services/TranscriptionEngine.js';

// Mock dependencies
jest.mock('../AudioProcessor.js');
jest.mock('../../services/TranscriptionEngine.js');

// Mock getUserMedia
const mockGetUserMedia = jest.fn();
Object.defineProperty(navigator, 'mediaDevices', {
  writable: true,
  value: {
    getUserMedia: mockGetUserMedia
  }
});

describe('LocalSTTController', () => {
  let mockAudioProcessor;
  let mockTranscriptionEngine;
  let mockMediaStream;

  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();

    // Mock MediaStream
    mockMediaStream = {
      getTracks: jest.fn().mockReturnValue([
        { stop: jest.fn() }
      ])
    };

    // Mock AudioProcessor
    mockAudioProcessor = {
      initialize: jest.fn().mockResolvedValue(true),
      startCapture: jest.fn().mockResolvedValue(true),
      stopCapture: jest.fn(),
      cleanup: jest.fn(),
      addEventListener: jest.fn(),
      getStatus: jest.fn().mockReturnValue({
        isCapturing: false,
        isInitialized: true
      })
    };

    // Mock TranscriptionEngine
    mockTranscriptionEngine = {
      initialize: jest.fn().mockResolvedValue(true),
      startTranscription: jest.fn().mockResolvedValue(true),
      stopTranscription: jest.fn(),
      changeLanguage: jest.fn().mockResolvedValue(true),
      getAvailableLanguages: jest.fn().mockReturnValue(['en', 'es', 'fr']),
      getMetrics: jest.fn().mockReturnValue({
        totalTranscriptions: 0,
        successRate: 0,
        averageConfidence: 0,
        averageProcessingTime: 0
      }),
      getStatus: jest.fn().mockReturnValue({
        isInitialized: true,
        isTranscribing: false
      }),
      handleAudioData: jest.fn(),
      addEventListener: jest.fn(),
      cleanup: jest.fn()
    };

    // Mock constructors
    AudioProcessor.mockImplementation(() => mockAudioProcessor);
    TranscriptionEngine.mockImplementation(() => mockTranscriptionEngine);

    // Mock getUserMedia
    mockGetUserMedia.mockResolvedValue(mockMediaStream);
  });

  describe('Initialization', () => {
    test('should initialize successfully', async () => {
      const { result, waitForNextUpdate } = renderHook(() => 
        LocalSTTController({ isEnabled: false })
      );

      // Wait for initialization
      await waitForNextUpdate();

      expect(result.current.isInitialized).toBe(true);
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBeNull();
      expect(mockAudioProcessor.initialize).toHaveBeenCalled();
      expect(mockTranscriptionEngine.initialize).toHaveBeenCalledWith({
        language: 'en',
        provider: 'local',
        confidenceThreshold: 0.3
      });
    });

    test('should initialize with custom language', async () => {
      const { result, waitForNextUpdate } = renderHook(() => 
        LocalSTTController({ isEnabled: false, language: 'es' })
      );

      await waitForNextUpdate();

      expect(mockTranscriptionEngine.initialize).toHaveBeenCalledWith({
        language: 'es',
        provider: 'local',
        confidenceThreshold: 0.3
      });
    });

    test('should handle initialization failure', async () => {
      mockAudioProcessor.initialize.mockRejectedValue(new Error('Init failed'));
      
      const onError = jest.fn();
      const { result, waitForNextUpdate } = renderHook(() => 
        LocalSTTController({ isEnabled: false, onError })
      );

      await waitForNextUpdate();

      expect(result.current.isInitialized).toBe(false);
      expect(result.current.error).toBe('Init failed');
      expect(onError).toHaveBeenCalledWith(expect.any(Error));
    });

    test('should set up event listeners', async () => {
      const { waitForNextUpdate } = renderHook(() => 
        LocalSTTController({ isEnabled: false })
      );

      await waitForNextUpdate();

      // Check that event listeners were added
      expect(mockAudioProcessor.addEventListener).toHaveBeenCalledWith('captureStarted', expect.any(Function));
      expect(mockAudioProcessor.addEventListener).toHaveBeenCalledWith('captureStopped', expect.any(Function));
      expect(mockAudioProcessor.addEventListener).toHaveBeenCalledWith('audioReady', expect.any(Function));
      expect(mockAudioProcessor.addEventListener).toHaveBeenCalledWith('qualityUpdate', expect.any(Function));

      expect(mockTranscriptionEngine.addEventListener).toHaveBeenCalledWith('modelLoading', expect.any(Function));
      expect(mockTranscriptionEngine.addEventListener).toHaveBeenCalledWith('modelLoaded', expect.any(Function));
      expect(mockTranscriptionEngine.addEventListener).toHaveBeenCalledWith('transcriptionStarted', expect.any(Function));
      expect(mockTranscriptionEngine.addEventListener).toHaveBeenCalledWith('transcriptionStopped', expect.any(Function));
      expect(mockTranscriptionEngine.addEventListener).toHaveBeenCalledWith('textOutput', expect.any(Function));
    });
  });

  describe('Transcription Control', () => {
    test('should start transcription successfully', async () => {
      const { result, waitForNextUpdate } = renderHook(() => 
        LocalSTTController({ isEnabled: false })
      );

      await waitForNextUpdate();

      let startResult;
      await act(async () => {
        startResult = await result.current.startTranscription();
      });

      expect(startResult).toBe(true);
      expect(mockGetUserMedia).toHaveBeenCalledWith({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 16000
        }
      });
      expect(mockAudioProcessor.startCapture).toHaveBeenCalledWith(mockMediaStream);
      expect(mockTranscriptionEngine.startTranscription).toHaveBeenCalled();
    });

    test('should not start if not initialized', async () => {
      mockAudioProcessor.initialize.mockRejectedValue(new Error('Init failed'));
      
      const { result, waitForNextUpdate } = renderHook(() => 
        LocalSTTController({ isEnabled: false })
      );

      await waitForNextUpdate();

      let startResult;
      await act(async () => {
        startResult = await result.current.startTranscription();
      });

      expect(startResult).toBe(false);
      expect(mockGetUserMedia).not.toHaveBeenCalled();
    });

    test('should handle getUserMedia failure', async () => {
      mockGetUserMedia.mockRejectedValue(new Error('Microphone access denied'));
      
      const onError = jest.fn();
      const { result, waitForNextUpdate } = renderHook(() => 
        LocalSTTController({ isEnabled: false, onError })
      );

      await waitForNextUpdate();

      let startResult;
      await act(async () => {
        startResult = await result.current.startTranscription();
      });

      expect(startResult).toBe(false);
      expect(result.current.error).toBe('Microphone access denied');
      expect(onError).toHaveBeenCalledWith(expect.any(Error));
    });

    test('should stop transcription', async () => {
      const { result, waitForNextUpdate } = renderHook(() => 
        LocalSTTController({ isEnabled: false })
      );

      await waitForNextUpdate();

      // Start transcription first
      await act(async () => {
        await result.current.startTranscription();
      });

      // Stop transcription
      act(() => {
        result.current.stopTranscription();
      });

      expect(mockTranscriptionEngine.stopTranscription).toHaveBeenCalled();
      expect(mockAudioProcessor.stopCapture).toHaveBeenCalled();
      expect(mockMediaStream.getTracks()[0].stop).toHaveBeenCalled();
    });

    test('should auto-start when enabled', async () => {
      const { result, waitForNextUpdate, rerender } = renderHook(
        ({ isEnabled }) => LocalSTTController({ isEnabled }),
        { initialProps: { isEnabled: false } }
      );

      await waitForNextUpdate();

      // Enable transcription
      await act(async () => {
        rerender({ isEnabled: true });
      });

      expect(mockGetUserMedia).toHaveBeenCalled();
      expect(mockAudioProcessor.startCapture).toHaveBeenCalled();
      expect(mockTranscriptionEngine.startTranscription).toHaveBeenCalled();
    });

    test('should auto-stop when disabled', async () => {
      const { result, waitForNextUpdate, rerender } = renderHook(
        ({ isEnabled }) => LocalSTTController({ isEnabled }),
        { initialProps: { isEnabled: true } }
      );

      await waitForNextUpdate();

      // Disable transcription
      act(() => {
        rerender({ isEnabled: false });
      });

      expect(mockTranscriptionEngine.stopTranscription).toHaveBeenCalled();
      expect(mockAudioProcessor.stopCapture).toHaveBeenCalled();
    });
  });

  describe('Event Handling', () => {
    test('should handle audio ready events', async () => {
      const { result, waitForNextUpdate } = renderHook(() => 
        LocalSTTController({ isEnabled: false })
      );

      await waitForNextUpdate();

      // Start transcription to enable audio handling
      await act(async () => {
        await result.current.startTranscription();
      });

      // Simulate audio ready event
      const audioReadyHandler = mockAudioProcessor.addEventListener.mock.calls
        .find(call => call[0] === 'audioReady')[1];
      
      const audioData = { data: new Float32Array([0.1, 0.2]), timestamp: Date.now() };
      
      act(() => {
        audioReadyHandler(audioData);
      });

      expect(mockTranscriptionEngine.handleAudioData).toHaveBeenCalledWith(audioData);
    });

    test('should handle text output events', async () => {
      const onTranscriptionResult = jest.fn();
      const { result, waitForNextUpdate } = renderHook(() => 
        LocalSTTController({ isEnabled: false, onTranscriptionResult })
      );

      await waitForNextUpdate();

      // Simulate text output event
      const textOutputHandler = mockTranscriptionEngine.addEventListener.mock.calls
        .find(call => call[0] === 'textOutput')[1];
      
      const textOutput = {
        text: 'Hello world',
        confidence: 0.9,
        timestamp: Date.now(),
        segmentCount: 2
      };
      
      act(() => {
        textOutputHandler(textOutput);
      });

      expect(result.current.currentText).toBe('Hello world');
      expect(result.current.confidence).toBe(0.9);
      expect(onTranscriptionResult).toHaveBeenCalledWith({
        text: 'Hello world',
        confidence: 0.9,
        timestamp: textOutput.timestamp,
        segmentCount: 2,
        provider: 'local'
      });
    });

    test('should handle transcription errors', async () => {
      const onError = jest.fn();
      const { result, waitForNextUpdate } = renderHook(() => 
        LocalSTTController({ isEnabled: false, onError })
      );

      await waitForNextUpdate();

      // Simulate transcription error event
      const errorHandler = mockTranscriptionEngine.addEventListener.mock.calls
        .find(call => call[0] === 'transcriptionError')[1];
      
      const errorData = { error: 'Transcription failed' };
      
      act(() => {
        errorHandler(errorData);
      });

      expect(result.current.error).toBe('Transcription failed: Transcription failed');
      expect(onError).toHaveBeenCalledWith(expect.any(Error));
    });

    test('should handle status change events', async () => {
      const onStatusChange = jest.fn();
      const { result, waitForNextUpdate } = renderHook(() => 
        LocalSTTController({ isEnabled: false, onStatusChange })
      );

      await waitForNextUpdate();

      // Simulate audio quality update
      const qualityHandler = mockAudioProcessor.addEventListener.mock.calls
        .find(call => call[0] === 'qualityUpdate')[1];
      
      const qualityMetrics = { averageVolume: 0.5, signalToNoiseRatio: 3.0 };
      
      act(() => {
        qualityHandler(qualityMetrics);
      });

      expect(result.current.audioQuality).toEqual(qualityMetrics);
      expect(onStatusChange).toHaveBeenCalledWith({
        type: 'audioQualityUpdate',
        data: qualityMetrics
      });
    });
  });

  describe('Language Management', () => {
    test('should change language successfully', async () => {
      const onStatusChange = jest.fn();
      const { result, waitForNextUpdate } = renderHook(() => 
        LocalSTTController({ isEnabled: false, onStatusChange })
      );

      await waitForNextUpdate();

      let changeResult;
      await act(async () => {
        changeResult = await result.current.changeLanguage('es');
      });

      expect(changeResult).toBe(true);
      expect(mockTranscriptionEngine.changeLanguage).toHaveBeenCalledWith('es');
      expect(onStatusChange).toHaveBeenCalledWith({
        type: 'languageChanged',
        data: { language: 'es' }
      });
    });

    test('should handle language change failure', async () => {
      mockTranscriptionEngine.changeLanguage.mockRejectedValue(new Error('Language change failed'));
      
      const onError = jest.fn();
      const { result, waitForNextUpdate } = renderHook(() => 
        LocalSTTController({ isEnabled: false, onError })
      );

      await waitForNextUpdate();

      let changeResult;
      await act(async () => {
        changeResult = await result.current.changeLanguage('invalid');
      });

      expect(changeResult).toBe(false);
      expect(result.current.error).toBe('Language change failed');
      expect(onError).toHaveBeenCalledWith(expect.any(Error));
    });

    test('should get available languages', async () => {
      const { result, waitForNextUpdate } = renderHook(() => 
        LocalSTTController({ isEnabled: false })
      );

      await waitForNextUpdate();

      const languages = result.current.getAvailableLanguages();

      expect(languages).toEqual(['en', 'es', 'fr']);
      expect(mockTranscriptionEngine.getAvailableLanguages).toHaveBeenCalled();
    });
  });

  describe('Status and Metrics', () => {
    test('should get current status', async () => {
      const { result, waitForNextUpdate } = renderHook(() => 
        LocalSTTController({ isEnabled: false })
      );

      await waitForNextUpdate();

      const status = result.current.getStatus();

      expect(status).toEqual({
        isInitialized: true,
        isTranscribing: false,
        isLoading: false,
        currentText: '',
        confidence: 0,
        error: null,
        audioQuality: null,
        stats: {
          totalTranscriptions: 0,
          successRate: 0,
          averageConfidence: 0,
          averageProcessingTime: 0
        },
        audioProcessorStatus: {
          isCapturing: false,
          isInitialized: true
        },
        transcriptionEngineStatus: {
          isInitialized: true,
          isTranscribing: false
        }
      });
    });

    test('should update stats from transcription engine', async () => {
      const { result, waitForNextUpdate } = renderHook(() => 
        LocalSTTController({ isEnabled: false })
      );

      await waitForNextUpdate();

      // Mock updated metrics
      mockTranscriptionEngine.getMetrics.mockReturnValue({
        totalTranscriptions: 5,
        successRate: 80,
        averageConfidence: 0.85,
        averageProcessingTime: 150
      });

      // Simulate text output to trigger stats update
      const textOutputHandler = mockTranscriptionEngine.addEventListener.mock.calls
        .find(call => call[0] === 'textOutput')[1];
      
      act(() => {
        textOutputHandler({ text: 'Test', confidence: 0.8, timestamp: Date.now() });
      });

      expect(result.current.stats).toEqual({
        totalTranscriptions: 5,
        successRate: 80,
        averageConfidence: 0.85,
        averageProcessingTime: 150
      });
    });
  });

  describe('Cleanup', () => {
    test('should cleanup resources on unmount', async () => {
      const { result, waitForNextUpdate, unmount } = renderHook(() => 
        LocalSTTController({ isEnabled: false })
      );

      await waitForNextUpdate();

      // Start transcription
      await act(async () => {
        await result.current.startTranscription();
      });

      // Unmount component
      unmount();

      expect(mockTranscriptionEngine.stopTranscription).toHaveBeenCalled();
      expect(mockAudioProcessor.stopCapture).toHaveBeenCalled();
      expect(mockAudioProcessor.cleanup).toHaveBeenCalled();
      expect(mockTranscriptionEngine.cleanup).toHaveBeenCalled();
      expect(mockMediaStream.getTracks()[0].stop).toHaveBeenCalled();
    });

    test('should cleanup manually', async () => {
      const { result, waitForNextUpdate } = renderHook(() => 
        LocalSTTController({ isEnabled: false })
      );

      await waitForNextUpdate();

      act(() => {
        result.current.cleanup();
      });

      expect(mockAudioProcessor.cleanup).toHaveBeenCalled();
      expect(mockTranscriptionEngine.cleanup).toHaveBeenCalled();
      expect(result.current.isInitialized).toBe(false);
      expect(result.current.isTranscribing).toBe(false);
      expect(result.current.currentText).toBe('');
    });
  });
});