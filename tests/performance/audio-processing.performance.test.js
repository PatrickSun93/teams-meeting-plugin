// Performance tests for audio processing components
const { performance } = require('perf_hooks');

describe('Audio Processing Performance Tests', () => {
  let audioProcessor;
  let mockAudioContext;
  let mockMediaStream;

  beforeEach(() => {
    // Mock Web Audio API
    mockAudioContext = {
      sampleRate: 16000,
      createMediaStreamSource: jest.fn(),
      createAnalyser: jest.fn(() => ({
        frequencyBinCount: 1024,
        getFloatFrequencyData: jest.fn(),
        getByteFrequencyData: jest.fn()
      })),
      createGain: jest.fn(),
      createBiquadFilter: jest.fn(),
      createScriptProcessor: jest.fn(),
      destination: {}
    };

    mockMediaStream = {
      getTracks: jest.fn(() => []),
      getAudioTracks: jest.fn(() => [{
        kind: 'audio',
        enabled: true,
        stop: jest.fn()
      }])
    };

    global.AudioContext = jest.fn(() => mockAudioContext);
    global.navigator.mediaDevices.getUserMedia = jest.fn().mockResolvedValue(mockMediaStream);

    const AudioProcessor = require('../../src/client/components/AudioProcessor');
    audioProcessor = new AudioProcessor();
  });

  test('should process audio chunks within performance thresholds', async () => {
    const audioBuffer = new Float32Array(1024);
    audioBuffer.fill(0.5); // Simulate audio data

    const startTime = performance.now();
    
    // Process multiple audio chunks
    for (let i = 0; i < 100; i++) {
      await audioProcessor.processAudioChunk(audioBuffer);
    }
    
    const endTime = performance.now();
    const processingTime = endTime - startTime;
    
    // Should process 100 chunks in less than 100ms (1ms per chunk)
    expect(processingTime).toBeLessThan(100);
  });

  test('should handle real-time audio streaming without buffer overflow', async () => {
    const bufferSizes = [256, 512, 1024, 2048, 4096];
    
    for (const bufferSize of bufferSizes) {
      const startTime = performance.now();
      
      // Simulate real-time audio streaming
      const audioBuffer = new Float32Array(bufferSize);
      audioBuffer.fill(Math.random());
      
      await audioProcessor.processRealTimeAudio(audioBuffer);
      
      const processingTime = performance.now() - startTime;
      
      // Processing time should be less than buffer duration
      const bufferDuration = (bufferSize / 16000) * 1000; // ms
      expect(processingTime).toBeLessThan(bufferDuration);
    }
  });

  test('should maintain memory usage within limits during long sessions', async () => {
    const initialMemory = process.memoryUsage().heapUsed;
    
    // Simulate 10 minutes of audio processing
    for (let i = 0; i < 600; i++) { // 600 seconds * 1 chunk per second
      const audioBuffer = new Float32Array(16000); // 1 second of audio
      audioBuffer.fill(Math.random());
      
      await audioProcessor.processAudioChunk(audioBuffer);
      
      // Force garbage collection every 60 iterations
      if (i % 60 === 0 && global.gc) {
        global.gc();
      }
    }
    
    const finalMemory = process.memoryUsage().heapUsed;
    const memoryIncrease = finalMemory - initialMemory;
    
    // Memory increase should be less than 50MB
    expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024);
  });

  test('should handle concurrent audio processing efficiently', async () => {
    const concurrentStreams = 5;
    const promises = [];
    
    const startTime = performance.now();
    
    for (let i = 0; i < concurrentStreams; i++) {
      const audioBuffer = new Float32Array(1024);
      audioBuffer.fill(Math.random());
      
      promises.push(audioProcessor.processAudioChunk(audioBuffer));
    }
    
    await Promise.all(promises);
    
    const endTime = performance.now();
    const processingTime = endTime - startTime;
    
    // Concurrent processing should not be significantly slower than sequential
    expect(processingTime).toBeLessThan(50); // 50ms for 5 concurrent streams
  });

  test('should optimize noise reduction algorithms', async () => {
    const noisyAudioBuffer = new Float32Array(16000);
    
    // Generate noisy audio signal
    for (let i = 0; i < noisyAudioBuffer.length; i++) {
      noisyAudioBuffer[i] = Math.sin(2 * Math.PI * 440 * i / 16000) + // 440Hz tone
                           Math.random() * 0.1; // Add noise
    }
    
    const startTime = performance.now();
    
    const cleanedAudio = await audioProcessor.applyNoiseReduction(noisyAudioBuffer);
    
    const endTime = performance.now();
    const processingTime = endTime - startTime;
    
    // Noise reduction should complete within 10ms for 1 second of audio
    expect(processingTime).toBeLessThan(10);
    expect(cleanedAudio).toBeInstanceOf(Float32Array);
    expect(cleanedAudio.length).toBe(noisyAudioBuffer.length);
  });
});