// Performance tests for multi-platform audio processing
const { performance } = require('perf_hooks');

describe('Multi-Platform Audio Processing Performance Tests', () => {
  let platformAdapters;
  let audioProcessors;
  let performanceMonitor;

  beforeEach(() => {
    // Import platform adapters and audio processors
    const TeamsAdapter = require('../../src/client/services/TeamsAdapter');
    const ZoomAdapter = require('../../src/client/services/ZoomAdapter');
    const MeetAdapter = require('../../src/client/services/MeetAdapter');
    const GenericAdapter = require('../../src/client/services/GenericAdapter');
    const AudioProcessor = require('../../src/client/components/AudioProcessor');
    const PerformanceMonitor = require('../../src/client/services/PerformanceMonitor');

    platformAdapters = {
      teams: new TeamsAdapter(),
      zoom: new ZoomAdapter(),
      meet: new MeetAdapter(),
      generic: new GenericAdapter()
    };

    audioProcessors = {
      teams: new AudioProcessor({ platform: 'teams' }),
      zoom: new AudioProcessor({ platform: 'zoom' }),
      meet: new AudioProcessor({ platform: 'meet' }),
      generic: new AudioProcessor({ platform: 'generic' })
    };

    performanceMonitor = new PerformanceMonitor();

    // Mock Web Audio API
    global.AudioContext = jest.fn(() => ({
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
    }));

    // Mock MediaStream
    global.navigator = {
      mediaDevices: {
        getUserMedia: jest.fn().mockResolvedValue({
          getTracks: () => [{ kind: 'audio', stop: jest.fn() }],
          getAudioTracks: () => [{ kind: 'audio', stop: jest.fn() }]
        })
      }
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Platform-Specific Audio Processing Performance', () => {
    const testCases = [
      { platform: 'teams', expectedLatency: 50, expectedThroughput: 1000 },
      { platform: 'zoom', expectedLatency: 75, expectedThroughput: 800 },
      { platform: 'meet', expectedLatency: 100, expectedThroughput: 600 },
      { platform: 'generic', expectedLatency: 150, expectedThroughput: 400 }
    ];

    testCases.forEach(({ platform, expectedLatency, expectedThroughput }) => {
      test(`should meet performance requirements for ${platform}`, async () => {
        const adapter = platformAdapters[platform];
        const processor = audioProcessors[platform];

        await adapter.initialize();
        await processor.initialize();

        // Test audio processing latency
        const audioBuffer = new Float32Array(1024);
        audioBuffer.fill(Math.random());

        const startTime = performance.now();
        await processor.processAudioChunk(audioBuffer);
        const latency = performance.now() - startTime;

        expect(latency).toBeLessThan(expectedLatency);

        // Test throughput (chunks per second)
        const throughputStartTime = performance.now();
        const chunkCount = 100;

        for (let i = 0; i < chunkCount; i++) {
          await processor.processAudioChunk(audioBuffer);
        }

        const throughputTime = performance.now() - throughputStartTime;
        const throughput = (chunkCount / throughputTime) * 1000; // chunks per second

        expect(throughput).toBeGreaterThan(expectedThroughput);
      });

      test(`should handle real-time constraints for ${platform}`, async () => {
        const adapter = platformAdapters[platform];
        const processor = audioProcessors[platform];

        await adapter.initialize();
        await processor.initialize();

        // Simulate real-time audio streaming (16kHz, 1024 samples = 64ms chunks)
        const chunkDuration = 64; // milliseconds
        const audioBuffer = new Float32Array(1024);

        const processingTimes = [];

        for (let i = 0; i < 10; i++) {
          audioBuffer.fill(Math.random());
          
          const startTime = performance.now();
          await processor.processRealTimeAudio(audioBuffer);
          const processingTime = performance.now() - startTime;
          
          processingTimes.push(processingTime);
          
          // Processing time should be less than chunk duration
          expect(processingTime).toBeLessThan(chunkDuration);
        }

        // Average processing time should be well below real-time threshold
        const avgProcessingTime = processingTimes.reduce((a, b) => a + b, 0) / processingTimes.length;
        expect(avgProcessingTime).toBeLessThan(chunkDuration * 0.5); // 50% margin
      });

      test(`should maintain memory efficiency for ${platform}`, async () => {
        const adapter = platformAdapters[platform];
        const processor = audioProcessors[platform];

        await adapter.initialize();
        await processor.initialize();

        const initialMemory = process.memoryUsage().heapUsed;

        // Process audio for 5 minutes (simulated)
        const chunksPerSecond = 15.625; // 16kHz / 1024 samples
        const totalChunks = Math.floor(5 * 60 * chunksPerSecond); // 5 minutes

        for (let i = 0; i < totalChunks; i++) {
          const audioBuffer = new Float32Array(1024);
          audioBuffer.fill(Math.random());
          
          await processor.processAudioChunk(audioBuffer);
          
          // Force garbage collection every 100 chunks
          if (i % 100 === 0 && global.gc) {
            global.gc();
          }
        }

        const finalMemory = process.memoryUsage().heapUsed;
        const memoryIncrease = finalMemory - initialMemory;

        // Memory increase should be less than 100MB for 5 minutes of processing
        expect(memoryIncrease).toBeLessThan(100 * 1024 * 1024);
      });
    });
  });

  describe('Cross-Platform Performance Comparison', () => {
    test('should compare audio capture performance across platforms', async () => {
      const captureResults = {};

      for (const [platformName, adapter] of Object.entries(platformAdapters)) {
        await adapter.initialize();

        const startTime = performance.now();
        
        try {
          const audioStream = await adapter.getAudioStream();
          const captureTime = performance.now() - startTime;
          
          captureResults[platformName] = {
            success: true,
            captureTime,
            hasAudioTracks: audioStream?.getAudioTracks?.()?.length > 0
          };
        } catch (error) {
          captureResults[platformName] = {
            success: false,
            error: error.message,
            captureTime: performance.now() - startTime
          };
        }
      }

      // Analyze results
      const successfulCaptures = Object.entries(captureResults)
        .filter(([_, result]) => result.success);

      expect(successfulCaptures.length).toBeGreaterThan(0);

      // Compare capture times
      const captureTimes = successfulCaptures.map(([_, result]) => result.captureTime);
      const avgCaptureTime = captureTimes.reduce((a, b) => a + b, 0) / captureTimes.length;

      // All successful captures should be within 2x of average
      captureTimes.forEach(time => {
        expect(time).toBeLessThan(avgCaptureTime * 2);
      });
    });

    test('should compare transcription processing performance', async () => {
      const TranscriptionEngine = require('../../src/client/services/TranscriptionEngine');
      const transcriptionResults = {};

      const testAudio = new Float32Array(16000); // 1 second of audio
      testAudio.fill(Math.random());

      for (const [platformName, adapter] of Object.entries(platformAdapters)) {
        const engine = new TranscriptionEngine({ platform: platformName });
        await engine.initialize();

        const startTime = performance.now();
        
        try {
          const result = await engine.transcribe(testAudio, { provider: 'local' });
          const transcriptionTime = performance.now() - startTime;
          
          transcriptionResults[platformName] = {
            success: true,
            transcriptionTime,
            textLength: result.text?.length || 0,
            confidence: result.confidence || 0
          };
        } catch (error) {
          transcriptionResults[platformName] = {
            success: false,
            error: error.message,
            transcriptionTime: performance.now() - startTime
          };
        }
      }

      // Verify performance consistency
      const successfulTranscriptions = Object.entries(transcriptionResults)
        .filter(([_, result]) => result.success);

      if (successfulTranscriptions.length > 1) {
        const times = successfulTranscriptions.map(([_, result]) => result.transcriptionTime);
        const maxTime = Math.max(...times);
        const minTime = Math.min(...times);

        // No platform should be more than 3x slower than the fastest
        expect(maxTime / minTime).toBeLessThan(3);
      }
    });

    test('should compare speaker identification performance', async () => {
      const SpeakerIdentificationService = require('../../src/client/services/SpeakerIdentificationService');
      const speakerResults = {};

      const testAudio = new Float32Array(16000); // 1 second of audio
      testAudio.fill(Math.random());

      for (const [platformName, adapter] of Object.entries(platformAdapters)) {
        const speakerService = new SpeakerIdentificationService({ platform: platformName });
        await speakerService.initialize();

        const startTime = performance.now();
        
        try {
          const result = await speakerService.identifySpeaker(testAudio);
          const identificationTime = performance.now() - startTime;
          
          speakerResults[platformName] = {
            success: true,
            identificationTime,
            speakerId: result.speakerId,
            confidence: result.confidence || 0
          };
        } catch (error) {
          speakerResults[platformName] = {
            success: false,
            error: error.message,
            identificationTime: performance.now() - startTime
          };
        }
      }

      // Verify performance consistency
      const successfulIdentifications = Object.entries(speakerResults)
        .filter(([_, result]) => result.success);

      if (successfulIdentifications.length > 1) {
        const times = successfulIdentifications.map(([_, result]) => result.identificationTime);
        
        // All identification times should be under 100ms
        times.forEach(time => {
          expect(time).toBeLessThan(100);
        });
      }
    });
  });

  describe('Concurrent Multi-Platform Performance', () => {
    test('should handle concurrent audio processing across platforms', async () => {
      const concurrentPromises = [];
      const audioBuffer = new Float32Array(1024);
      audioBuffer.fill(Math.random());

      // Start concurrent processing on all platforms
      for (const [platformName, processor] of Object.entries(audioProcessors)) {
        const promise = processor.initialize()
          .then(() => processor.processAudioChunk(audioBuffer))
          .then(() => ({ platform: platformName, success: true }))
          .catch(error => ({ platform: platformName, success: false, error: error.message }));
        
        concurrentPromises.push(promise);
      }

      const startTime = performance.now();
      const results = await Promise.all(concurrentPromises);
      const totalTime = performance.now() - startTime;

      // Concurrent processing should not take significantly longer than sequential
      expect(totalTime).toBeLessThan(1000); // 1 second for all platforms

      // At least 75% should succeed
      const successCount = results.filter(r => r.success).length;
      expect(successCount / results.length).toBeGreaterThanOrEqual(0.75);
    });

    test('should maintain performance under load', async () => {
      const loadTestResults = {};
      const concurrentUsers = 5;
      const audioBuffer = new Float32Array(1024);
      audioBuffer.fill(Math.random());

      for (const [platformName, processor] of Object.entries(audioProcessors)) {
        await processor.initialize();

        const userPromises = [];
        
        // Simulate multiple concurrent users
        for (let user = 0; user < concurrentUsers; user++) {
          const userPromise = (async () => {
            const startTime = performance.now();
            
            // Process 10 audio chunks per user
            for (let chunk = 0; chunk < 10; chunk++) {
              await processor.processAudioChunk(audioBuffer);
            }
            
            return performance.now() - startTime;
          })();
          
          userPromises.push(userPromise);
        }

        const startTime = performance.now();
        const userTimes = await Promise.all(userPromises);
        const totalTime = performance.now() - startTime;

        loadTestResults[platformName] = {
          totalTime,
          avgUserTime: userTimes.reduce((a, b) => a + b, 0) / userTimes.length,
          maxUserTime: Math.max(...userTimes),
          minUserTime: Math.min(...userTimes)
        };
      }

      // Verify load handling
      Object.entries(loadTestResults).forEach(([platform, results]) => {
        // Total time should be reasonable (< 5 seconds for all users)
        expect(results.totalTime).toBeLessThan(5000);
        
        // User time variance should be reasonable (max < 3x min)
        expect(results.maxUserTime / results.minUserTime).toBeLessThan(3);
      });
    });

    test('should optimize resource usage across platforms', async () => {
      const resourceMonitor = performanceMonitor.createResourceMonitor();
      
      // Initialize all platforms
      for (const adapter of Object.values(platformAdapters)) {
        await adapter.initialize();
      }

      const initialResources = resourceMonitor.getResourceUsage();

      // Simulate heavy usage across all platforms
      const heavyWorkload = async () => {
        const audioBuffer = new Float32Array(4096); // Larger buffer
        audioBuffer.fill(Math.random());

        const promises = Object.values(audioProcessors).map(async processor => {
          await processor.initialize();
          
          // Process multiple chunks
          for (let i = 0; i < 50; i++) {
            await processor.processAudioChunk(audioBuffer);
          }
        });

        await Promise.all(promises);
      };

      await heavyWorkload();

      const finalResources = resourceMonitor.getResourceUsage();

      // Verify resource efficiency
      const cpuIncrease = finalResources.cpu - initialResources.cpu;
      const memoryIncrease = finalResources.memory - initialResources.memory;

      // CPU usage should not exceed 80%
      expect(finalResources.cpu).toBeLessThan(80);
      
      // Memory increase should be reasonable (< 200MB)
      expect(memoryIncrease).toBeLessThan(200 * 1024 * 1024);
    });
  });

  describe('Platform-Specific Optimization Tests', () => {
    test('should optimize for Teams native integration', async () => {
      const teamsAdapter = platformAdapters.teams;
      const teamsProcessor = audioProcessors.teams;

      await teamsAdapter.initialize();
      await teamsProcessor.initialize();

      // Test Teams-specific optimizations
      const audioBuffer = new Float32Array(1024);
      audioBuffer.fill(Math.random());

      // Teams should have the best performance due to native integration
      const startTime = performance.now();
      await teamsProcessor.processAudioChunk(audioBuffer);
      const processingTime = performance.now() - startTime;

      // Teams processing should be under 30ms
      expect(processingTime).toBeLessThan(30);

      // Test Teams SDK integration performance
      const sdkStartTime = performance.now();
      const meetingInfo = await teamsAdapter.getMeetingInfo();
      const sdkTime = performance.now() - sdkStartTime;

      // SDK calls should be fast (< 100ms)
      expect(sdkTime).toBeLessThan(100);
    });

    test('should optimize for browser extension constraints', async () => {
      const meetAdapter = platformAdapters.meet;
      const meetProcessor = audioProcessors.meet;

      await meetAdapter.initialize();
      await meetProcessor.initialize();

      // Test browser extension memory constraints
      const initialMemory = process.memoryUsage().heapUsed;
      const audioBuffer = new Float32Array(1024);

      // Process audio with memory monitoring
      for (let i = 0; i < 100; i++) {
        audioBuffer.fill(Math.random());
        await meetProcessor.processAudioChunk(audioBuffer);
        
        // Check memory every 10 iterations
        if (i % 10 === 0) {
          const currentMemory = process.memoryUsage().heapUsed;
          const memoryIncrease = currentMemory - initialMemory;
          
          // Memory should not grow excessively (< 50MB)
          expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024);
        }
      }
    });

    test('should handle generic platform fallbacks efficiently', async () => {
      const genericAdapter = platformAdapters.generic;
      const genericProcessor = audioProcessors.generic;

      await genericAdapter.initialize();
      await genericProcessor.initialize();

      // Test fallback performance
      const audioBuffer = new Float32Array(1024);
      audioBuffer.fill(Math.random());

      const startTime = performance.now();
      await genericProcessor.processAudioChunk(audioBuffer);
      const processingTime = performance.now() - startTime;

      // Generic processing should still be reasonable (< 200ms)
      expect(processingTime).toBeLessThan(200);

      // Test graceful degradation
      const capabilities = genericAdapter.getCapabilities();
      expect(capabilities.audioQuality).toBe('low'); // Should indicate reduced quality
      expect(capabilities.chatIntegration).toBe(false); // Should indicate no chat
    });
  });
});