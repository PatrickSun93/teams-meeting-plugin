// Performance tests for transcription engine
const { performance } = require('perf_hooks');

describe('Transcription Engine Performance Tests', () => {
  let transcriptionEngine;
  let mockSTTService;

  beforeEach(() => {
    mockSTTService = {
      transcribe: jest.fn(),
      isAvailable: jest.fn().mockReturnValue(true),
      getConfig: jest.fn().mockReturnValue({ provider: 'local' })
    };

    const TranscriptionEngine = require('../../src/client/services/TranscriptionEngine');
    transcriptionEngine = new TranscriptionEngine();
    transcriptionEngine.setSTTService(mockSTTService);
  });

  test('should handle high-frequency transcription requests', async () => {
    const audioChunks = Array.from({ length: 100 }, (_, i) => ({
      data: new Float32Array(1600), // 0.1 second chunks
      timestamp: i * 100
    }));

    mockSTTService.transcribe.mockImplementation(async (audio) => ({
      text: `Transcription ${Math.floor(Math.random() * 1000)}`,
      confidence: 0.95,
      duration: audio.length / 16000
    }));

    const startTime = performance.now();
    
    const promises = audioChunks.map(chunk => 
      transcriptionEngine.transcribeChunk(chunk.data, chunk.timestamp)
    );
    
    const results = await Promise.all(promises);
    
    const endTime = performance.now();
    const totalTime = endTime - startTime;
    
    // Should process 100 chunks (10 seconds of audio) in less than 2 seconds
    expect(totalTime).toBeLessThan(2000);
    expect(results).toHaveLength(100);
    results.forEach(result => {
      expect(result.text).toBeDefined();
      expect(result.confidence).toBeGreaterThan(0);
    });
  });

  test('should maintain transcription quality under load', async () => {
    const testCases = [
      { chunkSize: 1600, expectedLatency: 50 },   // 0.1s chunks
      { chunkSize: 8000, expectedLatency: 100 },  // 0.5s chunks
      { chunkSize: 16000, expectedLatency: 200 }, // 1.0s chunks
      { chunkSize: 32000, expectedLatency: 400 }  // 2.0s chunks
    ];

    for (const testCase of testCases) {
      const audioChunk = new Float32Array(testCase.chunkSize);
      audioChunk.fill(0.5);

      mockSTTService.transcribe.mockImplementation(async () => {
        // Simulate processing delay proportional to chunk size
        await new Promise(resolve => setTimeout(resolve, testCase.chunkSize / 1600 * 10));
        return {
          text: 'Test transcription',
          confidence: 0.9,
          duration: testCase.chunkSize / 16000
        };
      });

      const startTime = performance.now();
      const result = await transcriptionEngine.transcribeChunk(audioChunk);
      const endTime = performance.now();
      
      const latency = endTime - startTime;
      
      expect(latency).toBeLessThan(testCase.expectedLatency);
      expect(result.confidence).toBeGreaterThan(0.8);
    }
  });

  test('should optimize batch processing for efficiency', async () => {
    const batchSizes = [1, 5, 10, 20, 50];
    const audioChunk = new Float32Array(1600);
    audioChunk.fill(0.5);

    for (const batchSize of batchSizes) {
      const batches = Array.from({ length: batchSize }, () => audioChunk);
      
      mockSTTService.transcribe.mockImplementation(async () => ({
        text: 'Batch transcription',
        confidence: 0.9,
        duration: 0.1
      }));

      const startTime = performance.now();
      const results = await transcriptionEngine.transcribeBatch(batches);
      const endTime = performance.now();
      
      const batchTime = endTime - startTime;
      const timePerItem = batchTime / batchSize;
      
      // Batch processing should be more efficient for larger batches
      if (batchSize > 1) {
        expect(timePerItem).toBeLessThan(50); // Less than 50ms per item in batch
      }
      
      expect(results).toHaveLength(batchSize);
    }
  });

  test('should handle memory efficiently during long transcription sessions', async () => {
    const initialMemory = process.memoryUsage().heapUsed;
    
    mockSTTService.transcribe.mockImplementation(async () => ({
      text: 'Long session transcription ' + Math.random(),
      confidence: 0.9,
      duration: 0.1
    }));

    // Simulate 30 minutes of continuous transcription
    for (let minute = 0; minute < 30; minute++) {
      // Process 600 chunks per minute (0.1s chunks)
      for (let chunk = 0; chunk < 600; chunk++) {
        const audioChunk = new Float32Array(1600);
        audioChunk.fill(Math.random());
        
        await transcriptionEngine.transcribeChunk(audioChunk);
      }
      
      // Check memory usage every 5 minutes
      if (minute % 5 === 0) {
        const currentMemory = process.memoryUsage().heapUsed;
        const memoryIncrease = currentMemory - initialMemory;
        
        // Memory should not increase by more than 100MB
        expect(memoryIncrease).toBeLessThan(100 * 1024 * 1024);
      }
    }
  });

  test('should maintain real-time performance with speaker identification', async () => {
    const speakerIdentificationService = {
      identifySpeaker: jest.fn().mockImplementation(async () => ({
        speakerId: 'speaker-1',
        confidence: 0.85,
        isNewSpeaker: false
      }))
    };

    transcriptionEngine.setSpeakerIdentificationService(speakerIdentificationService);

    const audioChunk = new Float32Array(16000); // 1 second
    audioChunk.fill(0.5);

    mockSTTService.transcribe.mockImplementation(async () => ({
      text: 'Speaker identification test',
      confidence: 0.9,
      duration: 1.0
    }));

    const startTime = performance.now();
    
    const result = await transcriptionEngine.transcribeWithSpeaker(audioChunk);
    
    const endTime = performance.now();
    const processingTime = endTime - startTime;
    
    // Combined transcription + speaker ID should complete within 500ms
    expect(processingTime).toBeLessThan(500);
    expect(result.text).toBeDefined();
    expect(result.speakerId).toBeDefined();
    expect(result.confidence).toBeGreaterThan(0.8);
  });

  test('should optimize queue management for real-time processing', async () => {
    const queueSizes = [10, 50, 100, 200];
    
    for (const queueSize of queueSizes) {
      // Fill the queue with audio chunks
      const chunks = Array.from({ length: queueSize }, (_, i) => ({
        data: new Float32Array(1600),
        timestamp: i * 100,
        priority: Math.random() > 0.5 ? 'high' : 'normal'
      }));

      mockSTTService.transcribe.mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 5)); // 5ms processing time
        return {
          text: 'Queue test',
          confidence: 0.9,
          duration: 0.1
        };
      });

      const startTime = performance.now();
      
      // Process queue with priority handling
      const results = await transcriptionEngine.processQueue(chunks);
      
      const endTime = performance.now();
      const queueProcessingTime = endTime - startTime;
      
      // Queue processing should scale linearly
      const expectedTime = queueSize * 10; // 10ms per item including overhead
      expect(queueProcessingTime).toBeLessThan(expectedTime);
      expect(results).toHaveLength(queueSize);
    }
  });
});