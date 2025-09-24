// Unit tests for AudioProcessor
import AudioProcessor from '../AudioProcessor.js';

// Mock Web Audio API
const mockAudioContext = {
  sampleRate: 16000,
  state: 'running',
  createMediaStreamSource: jest.fn(),
  createAnalyser: jest.fn(),
  createGain: jest.fn(),
  createBiquadFilter: jest.fn(),
  createScriptProcessor: jest.fn(),
  close: jest.fn()
};

const mockAnalyserNode = {
  fftSize: 2048,
  smoothingTimeConstant: 0.8,
  frequencyBinCount: 1024,
  getByteTimeDomainData: jest.fn(),
  getByteFrequencyData: jest.fn(),
  connect: jest.fn(),
  disconnect: jest.fn()
};

const mockGainNode = {
  gain: { value: 1.0 },
  connect: jest.fn(),
  disconnect: jest.fn()
};

const mockFilterNode = {
  type: 'highpass',
  frequency: { value: 80 },
  Q: { value: 1 },
  connect: jest.fn(),
  disconnect: jest.fn()
};

const mockProcessorNode = {
  onaudioprocess: null,
  connect: jest.fn(),
  disconnect: jest.fn()
};

const mockSourceNode = {
  connect: jest.fn(),
  disconnect: jest.fn()
};

const mockMediaStream = {
  getTracks: jest.fn(() => [
    { stop: jest.fn() }
  ])
};

// Mock global AudioContext
global.AudioContext = jest.fn(() => mockAudioContext);
global.webkitAudioContext = jest.fn(() => mockAudioContext);

// Mock navigator.mediaDevices
global.navigator = {
  mediaDevices: {
    getUserMedia: jest.fn()
  }
};

describe('AudioProcessor', () => {
  let audioProcessor;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Reset AudioContext mock to return the mock context
    AudioContext.mockReturnValue(mockAudioContext);
    
    // Set up mock returns
    mockAudioContext.createMediaStreamSource.mockReturnValue(mockSourceNode);
    mockAudioContext.createAnalyser.mockReturnValue(mockAnalyserNode);
    mockAudioContext.createGain.mockReturnValue(mockGainNode);
    mockAudioContext.createBiquadFilter.mockReturnValue(mockFilterNode);
    mockAudioContext.createScriptProcessor.mockReturnValue(mockProcessorNode);
    
    // Set up connect chain mocks
    mockSourceNode.connect.mockReturnValue(mockFilterNode);
    mockFilterNode.connect.mockReturnValue(mockGainNode);
    mockGainNode.connect.mockReturnValue(mockAnalyserNode);
    mockAnalyserNode.connect.mockReturnValue(mockProcessorNode);
    mockProcessorNode.connect.mockReturnValue(mockAudioContext);
    
    audioProcessor = new AudioProcessor();
  });

  afterEach(() => {
    if (audioProcessor) {
      audioProcessor.cleanup();
    }
  });

  describe('Initialization', () => {
    test('should initialize successfully', async () => {
      const result = await audioProcessor.initialize();
      
      expect(result).toBe(true);
      expect(AudioContext).toHaveBeenCalledWith({
        sampleRate: 16000,
        latencyHint: 'interactive'
      });
      expect(audioProcessor.audioContext).toBeDefined();
    });

    test('should handle initialization failure', async () => {
      AudioContext.mockImplementation(() => {
        throw new Error('AudioContext not supported');
      });

      await expect(audioProcessor.initialize()).rejects.toThrow('Audio initialization failed');
    });
  });

  describe('Audio Capture', () => {
    beforeEach(async () => {
      await audioProcessor.initialize();
    });

    test('should start audio capture successfully', async () => {
      const mockStream = mockMediaStream;
      
      await audioProcessor.startCapture(mockStream);
      
      expect(audioProcessor.isCapturing).toBe(true);
      expect(mockAudioContext.createMediaStreamSource).toHaveBeenCalledWith(mockStream);
      expect(mockAudioContext.createAnalyser).toHaveBeenCalled();
      expect(mockAudioContext.createGain).toHaveBeenCalled();
      expect(mockAudioContext.createBiquadFilter).toHaveBeenCalled();
      expect(mockAudioContext.createScriptProcessor).toHaveBeenCalled();
    });

    test('should not start capture if already capturing', async () => {
      const mockStream = mockMediaStream;
      
      await audioProcessor.startCapture(mockStream);
      
      // Try to start again
      await audioProcessor.startCapture(mockStream);
      
      // Should only create nodes once
      expect(mockAudioContext.createMediaStreamSource).toHaveBeenCalledTimes(1);
    });

    test('should fail to start capture without initialization', async () => {
      const uninitializedProcessor = new AudioProcessor();
      const mockStream = mockMediaStream;
      
      await expect(uninitializedProcessor.startCapture(mockStream)).rejects.toThrow('Audio processor not initialized');
    });

    test('should stop audio capture successfully', async () => {
      const mockStream = mockMediaStream;
      
      await audioProcessor.startCapture(mockStream);
      audioProcessor.stopCapture();
      
      expect(audioProcessor.isCapturing).toBe(false);
      expect(mockProcessorNode.disconnect).toHaveBeenCalled();
      expect(mockSourceNode.disconnect).toHaveBeenCalled();
      expect(mockAnalyserNode.disconnect).toHaveBeenCalled();
      expect(mockGainNode.disconnect).toHaveBeenCalled();
      expect(mockFilterNode.disconnect).toHaveBeenCalled();
    });
  });

  describe('Audio Processing', () => {
    beforeEach(async () => {
      await audioProcessor.initialize();
      await audioProcessor.startCapture(mockMediaStream);
    });

    test('should process audio data correctly', () => {
      const mockAudioBuffer = {
        getChannelData: jest.fn(() => new Float32Array([0.1, 0.2, 0.3, 0.4])),
        duration: 0.1
      };

      const mockEvent = {
        inputBuffer: mockAudioBuffer
      };

      // Simulate audio processing
      audioProcessor.processAudioData(mockEvent);

      expect(audioProcessor.audioBuffers.length).toBe(1);
      expect(audioProcessor.audioBuffers[0].data).toEqual(new Float32Array([0.1, 0.2, 0.3, 0.4]));
    });

    test('should manage buffer size correctly', () => {
      const mockAudioBuffer = {
        getChannelData: jest.fn(() => new Float32Array([0.1, 0.2])),
        duration: 0.1
      };

      const mockEvent = {
        inputBuffer: mockAudioBuffer
      };

      // Add more segments than max buffer size
      for (let i = 0; i < audioProcessor.maxBufferSize + 10; i++) {
        audioProcessor.processAudioData(mockEvent);
      }

      expect(audioProcessor.audioBuffers.length).toBe(audioProcessor.maxBufferSize);
    });
  });

  describe('Audio Quality Assessment', () => {
    beforeEach(async () => {
      await audioProcessor.initialize();
    });

    test('should assess audio quality', () => {
      // Mock analyser data
      const mockTimeData = new Uint8Array(1024).fill(128); // Silent audio
      const mockFreqData = new Uint8Array(1024).fill(0);
      
      mockAnalyserNode.getByteTimeDomainData.mockImplementation((array) => {
        array.set(mockTimeData);
      });
      
      mockAnalyserNode.getByteFrequencyData.mockImplementation((array) => {
        array.set(mockFreqData);
      });

      audioProcessor.assessAudioQuality();

      expect(audioProcessor.qualityMetrics).toBeDefined();
      expect(audioProcessor.qualityMetrics.averageVolume).toBeDefined();
      expect(audioProcessor.qualityMetrics.peakVolume).toBeDefined();
      expect(audioProcessor.qualityMetrics.noiseLevel).toBeDefined();
      expect(audioProcessor.qualityMetrics.signalToNoiseRatio).toBeDefined();
    });

    test('should determine if quality is sufficient', () => {
      // Set good quality metrics
      audioProcessor.qualityMetrics = {
        averageVolume: 0.5,
        noiseLevel: 0.1,
        signalToNoiseRatio: 5.0,
        clippingDetected: false
      };

      expect(audioProcessor.isQualitySufficient()).toBe(true);

      // Set poor quality metrics
      audioProcessor.qualityMetrics = {
        averageVolume: 0.005, // Too low
        noiseLevel: 0.5,      // Too high
        signalToNoiseRatio: 1.0, // Too low
        clippingDetected: true
      };

      expect(audioProcessor.isQualitySufficient()).toBe(false);
    });
  });

  describe('Audio Preprocessing', () => {
    beforeEach(async () => {
      await audioProcessor.initialize();
    });

    test('should normalize audio correctly', () => {
      const audioData = new Float32Array([0.1, 0.5, 1.0, -0.8, 0.3]);
      const originalData = new Float32Array(audioData);
      
      audioProcessor.normalizeAudio(audioData);
      
      // Check that peak is now at target level (0.7)
      const newPeak = Math.max(...audioData.map(Math.abs));
      expect(newPeak).toBeCloseTo(0.7, 2);
      
      // Check that relative proportions are maintained
      const originalPeak = Math.max(...originalData.map(Math.abs));
      const scaleFactor = 0.7 / originalPeak;
      
      for (let i = 0; i < audioData.length; i++) {
        expect(audioData[i]).toBeCloseTo(originalData[i] * scaleFactor, 5);
      }
    });

    test('should apply noise gate correctly', () => {
      const audioData = new Float32Array([0.005, 0.5, 0.008, -0.003, 0.3]);
      const threshold = 0.01;
      
      audioProcessor.applyNoiseGate(audioData, threshold);
      
      expect(audioData[0]).toBe(0); // Below threshold
      expect(audioData[1]).toBe(0.5); // Above threshold
      expect(audioData[2]).toBe(0); // Below threshold
      expect(audioData[3]).toBe(0); // Below threshold
      expect(audioData[4]).toBeCloseTo(0.3, 5); // Above threshold
    });

    test('should preprocess audio with normalization and noise gate', () => {
      const originalData = new Float32Array([0.005, 0.1, 0.5, 1.0, -0.8]);
      
      const processedData = audioProcessor.preprocessAudio(originalData);
      
      expect(processedData).not.toBe(originalData); // Should be a copy
      expect(processedData.length).toBe(originalData.length);
      
      // Check that preprocessing was applied
      const peak = Math.max(...processedData.map(Math.abs));
      expect(peak).toBeCloseTo(0.7, 2); // Normalized
    });
  });

  describe('Audio Segment Management', () => {
    beforeEach(async () => {
      await audioProcessor.initialize();
    });

    test('should combine audio segments correctly', () => {
      const segments = [
        { data: new Float32Array([0.1, 0.2]), timestamp: 1000, duration: 0.1, sampleRate: 16000 },
        { data: new Float32Array([0.3, 0.4]), timestamp: 1100, duration: 0.1, sampleRate: 16000 },
        { data: new Float32Array([0.5, 0.6]), timestamp: 1200, duration: 0.1, sampleRate: 16000 }
      ];

      const combined = audioProcessor.combineAudioSegments(segments);

      expect(combined.data).toEqual(new Float32Array([0.1, 0.2, 0.3, 0.4, 0.5, 0.6]));
      expect(combined.timestamp).toBe(1000);
      expect(combined.duration).toBeCloseTo(0.3, 5);
      expect(combined.segmentCount).toBe(3);
    });

    test('should return null for empty segments', () => {
      const combined = audioProcessor.combineAudioSegments([]);
      expect(combined).toBeNull();
    });

    test('should get audio segment for transcription', () => {
      // Add some test segments
      audioProcessor.audioBuffers = [
        { data: new Float32Array([0.1, 0.2]), timestamp: 1000, duration: 1000, sampleRate: 16000 },
        { data: new Float32Array([0.3, 0.4]), timestamp: 2000, duration: 1000, sampleRate: 16000 },
        { data: new Float32Array([0.5, 0.6]), timestamp: 3000, duration: 1000, sampleRate: 16000 }
      ];

      const segment = audioProcessor.getAudioSegment(2000); // 2 seconds

      expect(segment).toBeDefined();
      expect(segment.data.length).toBe(4); // Combined last 2 segments
      expect(segment.segmentCount).toBe(2);
    });

    test('should return null when no audio segments available', () => {
      const segment = audioProcessor.getAudioSegment(1000);
      expect(segment).toBeNull();
    });
  });

  describe('Event Handling', () => {
    beforeEach(async () => {
      await audioProcessor.initialize();
    });

    test('should add and remove event listeners', () => {
      const listener = jest.fn();
      
      audioProcessor.addEventListener('test', listener);
      audioProcessor.notifyListeners('test', { data: 'test' });
      
      expect(listener).toHaveBeenCalledWith({ data: 'test' });
      
      audioProcessor.removeEventListener('test', listener);
      audioProcessor.notifyListeners('test', { data: 'test2' });
      
      expect(listener).toHaveBeenCalledTimes(1); // Should not be called again
    });

    test('should handle listener errors gracefully', () => {
      const errorListener = jest.fn(() => {
        throw new Error('Listener error');
      });
      
      const consoleError = jest.spyOn(console, 'error').mockImplementation();
      
      audioProcessor.addEventListener('test', errorListener);
      audioProcessor.notifyListeners('test', { data: 'test' });
      
      expect(consoleError).toHaveBeenCalled();
      consoleError.mockRestore();
    });
  });

  describe('Status and Cleanup', () => {
    test('should return correct status', async () => {
      const status = audioProcessor.getStatus();
      
      expect(status.isCapturing).toBe(false);
      expect(status.isInitialized).toBe(false);
      expect(status.audioContextState).toBe('not-initialized');
      
      await audioProcessor.initialize();
      await audioProcessor.startCapture(mockMediaStream);
      
      const activeStatus = audioProcessor.getStatus();
      expect(activeStatus.isCapturing).toBe(true);
      expect(activeStatus.isInitialized).toBe(true);
      expect(activeStatus.audioContextState).toBe('running');
    });

    test('should cleanup resources properly', async () => {
      await audioProcessor.initialize();
      await audioProcessor.startCapture(mockMediaStream);
      
      audioProcessor.cleanup();
      
      expect(audioProcessor.isCapturing).toBe(false);
      expect(audioProcessor.audioBuffers.length).toBe(0);
      expect(mockAudioContext.close).toHaveBeenCalled();
    });
  });
});