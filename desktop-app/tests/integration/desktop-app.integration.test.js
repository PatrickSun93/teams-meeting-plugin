const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const { promisify } = require('util');

const AudioCaptureManager = require('../../src/services/AudioCaptureManager');
const PlatformDetector = require('../../src/services/PlatformDetector');
const ScreenAnalyzer = require('../../src/services/ScreenAnalyzer');
const TranscriptionService = require('../../src/services/TranscriptionService');
const ConfigurationManager = require('../../src/services/ConfigurationManager');

describe('Desktop App Integration Tests', () => {
  let audioCapture;
  let platformDetector;
  let screenAnalyzer;
  let transcriptionService;
  let configManager;

  beforeAll(async () => {
    // Initialize all services
    audioCapture = new AudioCaptureManager();
    platformDetector = new PlatformDetector();
    screenAnalyzer = new ScreenAnalyzer();
    transcriptionService = new TranscriptionService();
    configManager = new ConfigurationManager();

    // Initialize services
    await audioCapture.initialize();
    await screenAnalyzer.initialize();
    await transcriptionService.initialize();
  });

  afterAll(async () => {
    // Cleanup
    if (audioCapture.isRecording) {
      await audioCapture.stopCapture();
    }
    if (screenAnalyzer.isAnalyzing) {
      await screenAnalyzer.stopAnalysis();
    }
    if (transcriptionService.isTranscribing) {
      await transcriptionService.stopTranscription();
    }
    await screenAnalyzer.cleanup();
  });

  describe('Service Integration', () => {
    test('should integrate audio capture with transcription service', async () => {
      const transcriptPromise = new Promise((resolve) => {
        transcriptionService.once('transcriptUpdate', resolve);
      });

      // Start transcription
      await transcriptionService.startTranscription({
        meetingId: 'test-meeting',
        audioSource: audioCapture
      });

      // Start audio capture
      await audioCapture.startCapture();

      // Simulate audio data
      const mockAudioBuffer = Buffer.alloc(16000 * 2); // 1 second of 16kHz audio
      audioCapture.emit('audioSegment', mockAudioBuffer);

      // Wait for transcription (with timeout)
      const transcript = await Promise.race([
        transcriptPromise,
        new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 10000))
      ]);

      expect(transcript).toBeDefined();
      expect(transcript).toHaveProperty('text');
      expect(transcript).toHaveProperty('speaker');
      expect(transcript).toHaveProperty('confidence');

      // Cleanup
      await audioCapture.stopCapture();
      await transcriptionService.stopTranscription();
    }, 15000);

    test('should integrate platform detection with screen analysis', async () => {
      // Start screen analysis
      await screenAnalyzer.startAnalysis();

      // Detect platform
      const platformInfo = await platformDetector.detectCurrentPlatform();

      // Get screen analysis result
      const analysisPromise = new Promise((resolve) => {
        screenAnalyzer.once('analysisResult', resolve);
      });

      const analysisResult = await Promise.race([
        analysisPromise,
        new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 10000))
      ]);

      expect(platformInfo).toBeDefined();
      expect(analysisResult).toBeDefined();

      // Stop screen analysis
      await screenAnalyzer.stopAnalysis();
    }, 15000);

    test('should save and load configuration across services', async () => {
      const testConfig = {
        transcription: {
          provider: 'openai',
          language: 'es',
          enableSpeakerDiarization: false
        },
        audio: {
          sampleRate: 22050,
          enableNoiseReduction: true
        },
        platform: {
          autoDetection: false,
          detectionInterval: 10000
        }
      };

      // Save configuration
      const saveResult = await configManager.saveConfig(testConfig);
      expect(saveResult.success).toBe(true);

      // Load configuration
      const loadedConfig = configManager.getConfig();
      expect(loadedConfig.transcription.provider).toBe('openai');
      expect(loadedConfig.transcription.language).toBe('es');
      expect(loadedConfig.audio.sampleRate).toBe(22050);
      expect(loadedConfig.platform.detectionInterval).toBe(10000);

      // Update transcription service with new config
      transcriptionService.updateConfig(loadedConfig.transcription);
      expect(transcriptionService.getConfig().provider).toBe('openai');

      // Update platform detector with new config
      platformDetector.setConfidenceThreshold(0.8);
      expect(platformDetector.confidenceThreshold).toBe(0.8);
    });
  });

  describe('End-to-End Workflow', () => {
    test('should complete full meeting transcription workflow', async () => {
      const meetingId = `test-meeting-${Date.now()}`;
      const transcripts = [];

      // Set up event listeners
      transcriptionService.on('transcriptUpdate', (transcript) => {
        transcripts.push(transcript);
      });

      // Start full workflow
      await audioCapture.startCapture();
      await transcriptionService.startTranscription({
        meetingId,
        audioSource: audioCapture
      });

      // Simulate meeting audio over time
      for (let i = 0; i < 3; i++) {
        const mockAudio = Buffer.alloc(16000 * 2); // 1 second of audio
        audioCapture.emit('audioSegment', mockAudio);
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      // Stop workflow
      const session = await transcriptionService.stopTranscription();
      await audioCapture.stopCapture();

      // Verify results
      expect(session).toBeDefined();
      expect(session.id).toBe(meetingId);
      expect(transcripts.length).toBeGreaterThan(0);

      // Verify transcript structure
      transcripts.forEach(transcript => {
        expect(transcript).toHaveProperty('id');
        expect(transcript).toHaveProperty('timestamp');
        expect(transcript).toHaveProperty('speaker');
        expect(transcript).toHaveProperty('text');
        expect(transcript).toHaveProperty('confidence');
      });
    }, 20000);

    test('should handle platform switching during meeting', async () => {
      // Start with auto-detection
      let platformInfo = await platformDetector.detectCurrentPlatform();
      expect(platformInfo).toBeDefined();

      // Switch to manual platform
      const manualPlatform = platformDetector.setManualPlatform('teams');
      expect(manualPlatform.id).toBe('teams');
      expect(manualPlatform.isManual).toBe(true);

      // Verify platform features
      expect(manualPlatform.features.chatIntegration).toBe(true);
      expect(manualPlatform.features.agendaAccess).toBe(true);

      // Switch to different platform
      const zoomPlatform = platformDetector.setManualPlatform('zoom');
      expect(zoomPlatform.id).toBe('zoom');
      expect(zoomPlatform.features.chatIntegration).toBe(true);
      expect(zoomPlatform.features.agendaAccess).toBe(false);

      // Clear manual selection
      platformDetector.clearManualPlatform();
      expect(platformDetector.isManualMode()).toBe(false);
    });

    test('should handle error recovery scenarios', async () => {
      // Test audio capture failure recovery
      await audioCapture.startCapture();
      
      // Simulate error
      audioCapture.emit('error', new Error('Simulated audio error'));
      
      // Should be able to restart
      await audioCapture.stopCapture();
      await audioCapture.startCapture();
      expect(audioCapture.isRecording).toBe(true);
      
      await audioCapture.stopCapture();

      // Test transcription service failure recovery
      await transcriptionService.startTranscription({
        meetingId: 'error-test',
        audioSource: audioCapture
      });

      // Simulate transcription error
      transcriptionService.emit('transcriptionError', new Error('Simulated STT error'));

      // Should be able to restart
      await transcriptionService.stopTranscription();
      await transcriptionService.startTranscription({
        meetingId: 'error-recovery-test',
        audioSource: audioCapture
      });

      expect(transcriptionService.isTranscribing).toBe(true);
      await transcriptionService.stopTranscription();
    });
  });

  describe('Performance Tests', () => {
    test('should handle concurrent audio processing', async () => {
      const startTime = Date.now();
      const audioSegments = [];

      // Generate multiple audio segments
      for (let i = 0; i < 10; i++) {
        audioSegments.push(Buffer.alloc(16000 * 0.5)); // 0.5 seconds each
      }

      await audioCapture.startCapture();
      await transcriptionService.startTranscription({
        meetingId: 'performance-test',
        audioSource: audioCapture
      });

      // Process all segments rapidly
      const promises = audioSegments.map((segment, index) => {
        return new Promise((resolve) => {
          setTimeout(() => {
            audioCapture.emit('audioSegment', segment);
            resolve();
          }, index * 100); // 100ms intervals
        });
      });

      await Promise.all(promises);

      // Wait for processing to complete
      await new Promise(resolve => setTimeout(resolve, 2000));

      const endTime = Date.now();
      const processingTime = endTime - startTime;

      // Should process within reasonable time (less than 10 seconds)
      expect(processingTime).toBeLessThan(10000);

      await transcriptionService.stopTranscription();
      await audioCapture.stopCapture();
    }, 15000);

    test('should maintain memory usage within limits', async () => {
      const initialMemory = process.memoryUsage();

      // Run intensive operations
      await audioCapture.startCapture();
      await screenAnalyzer.startAnalysis();
      await transcriptionService.startTranscription({
        meetingId: 'memory-test',
        audioSource: audioCapture
      });

      // Generate load
      for (let i = 0; i < 50; i++) {
        const audioBuffer = Buffer.alloc(16000 * 0.1); // 0.1 seconds
        audioCapture.emit('audioSegment', audioBuffer);
        await new Promise(resolve => setTimeout(resolve, 50));
      }

      // Stop operations
      await transcriptionService.stopTranscription();
      await screenAnalyzer.stopAnalysis();
      await audioCapture.stopCapture();

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      const finalMemory = process.memoryUsage();
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;

      // Memory increase should be reasonable (less than 100MB)
      expect(memoryIncrease).toBeLessThan(100 * 1024 * 1024);
    }, 30000);
  });

  describe('Data Persistence', () => {
    test('should persist meeting data correctly', async () => {
      const meetingId = `persist-test-${Date.now()}`;
      const testTranscript = {
        id: '1',
        timestamp: new Date(),
        speaker: 'Test Speaker',
        text: 'This is a test transcript',
        confidence: 0.95
      };

      // Start session
      await transcriptionService.startTranscription({
        meetingId,
        audioSource: audioCapture
      });

      // Add transcript
      transcriptionService.currentSession.transcript.push(testTranscript);

      // Stop session
      const session = await transcriptionService.stopTranscription();

      // Verify session data
      expect(session.id).toBe(meetingId);
      expect(session.transcript).toHaveLength(1);
      expect(session.transcript[0].text).toBe('This is a test transcript');
    });

    test('should handle configuration backup and restore', async () => {
      const originalConfig = configManager.getConfig();

      // Create backup
      await configManager.createBackup();

      // Modify configuration
      const modifiedConfig = {
        ...originalConfig,
        transcription: {
          ...originalConfig.transcription,
          provider: 'azure',
          language: 'fr'
        }
      };

      await configManager.saveConfig(modifiedConfig);

      // Verify modification
      const currentConfig = configManager.getConfig();
      expect(currentConfig.transcription.provider).toBe('azure');
      expect(currentConfig.transcription.language).toBe('fr');

      // Restore from backup
      const restoreResult = await configManager.restoreFromBackup();
      expect(restoreResult.success).toBe(true);

      // Verify restoration
      const restoredConfig = configManager.getConfig();
      expect(restoredConfig.transcription.provider).toBe(originalConfig.transcription.provider);
      expect(restoredConfig.transcription.language).toBe(originalConfig.transcription.language);
    });
  });

  describe('Cross-Platform Compatibility', () => {
    test('should detect platform capabilities correctly', () => {
      const platforms = platformDetector.getAvailablePlatforms();
      
      expect(platforms).toBeInstanceOf(Array);
      expect(platforms.length).toBeGreaterThan(0);

      // Check Teams platform
      const teams = platforms.find(p => p.id === 'teams');
      expect(teams).toBeDefined();
      expect(teams.features.chatIntegration).toBe(true);
      expect(teams.features.agendaAccess).toBe(true);

      // Check Google Meet platform
      const meet = platforms.find(p => p.id === 'meet');
      expect(meet).toBeDefined();
      expect(meet.features.chatIntegration).toBe(false);
      expect(meet.features.agendaAccess).toBe(true);

      // Check generic platform
      const generic = platforms.find(p => p.id === 'generic');
      expect(generic).toBeDefined();
      expect(generic.features.chatIntegration).toBe(false);
      expect(generic.features.agendaAccess).toBe(false);
    });

    test('should adapt audio settings for different platforms', async () => {
      // Test different sample rates
      const sampleRates = [16000, 22050, 44100];
      
      for (const sampleRate of sampleRates) {
        audioCapture.sampleRate = sampleRate;
        
        const stats = audioCapture.getAudioStats();
        expect(stats.sampleRate).toBe(sampleRate);
        
        // Test audio processing with different rates
        const audioBuffer = Buffer.alloc(sampleRate * 2); // 1 second
        const processed = audioCapture.processAudioForSTT(audioBuffer);
        
        expect(processed.sampleRate).toBe(sampleRate);
        expect(processed.data).toBeDefined();
      }
    });
  });

  describe('Security and Privacy', () => {
    test('should handle API key encryption', () => {
      const testApiKey = 'sk-test-api-key-12345';
      
      // Set API key
      configManager.setAPIKey('openai', testApiKey);
      
      // Retrieve API key
      const retrievedKey = configManager.getAPIKey('openai');
      expect(retrievedKey).toBe(testApiKey);
      
      // Remove API key
      configManager.removeAPIKey('openai');
      const removedKey = configManager.getAPIKey('openai');
      expect(removedKey).toBeNull();
    });

    test('should validate API key formats', () => {
      // Valid OpenAI key format
      const validOpenAI = 'sk-' + 'a'.repeat(48);
      expect(configManager.validateAPIKey('openai', validOpenAI)).toBe(true);
      
      // Invalid OpenAI key format
      expect(configManager.validateAPIKey('openai', 'invalid-key')).toBe(false);
      
      // Valid Azure key format
      const validAzure = 'a'.repeat(32);
      expect(configManager.validateAPIKey('azure', validAzure)).toBe(true);
      
      // Invalid Azure key format
      expect(configManager.validateAPIKey('azure', 'invalid')).toBe(false);
    });

    test('should handle local processing mode', async () => {
      // Set local processing mode
      const localConfig = {
        transcription: { provider: 'local' },
        privacy: { enableLocalProcessing: true }
      };
      
      await configManager.saveConfig(localConfig);
      transcriptionService.updateConfig(localConfig.transcription);
      
      // Verify local mode
      const config = transcriptionService.getConfig();
      expect(config.provider).toBe('local');
      
      // Test local transcription
      if (transcriptionService.localTranscriber) {
        const audioBuffer = Buffer.alloc(16000 * 2);
        const result = await transcriptionService.transcribeWithLocal(audioBuffer);
        
        expect(result).toHaveProperty('text');
        expect(result).toHaveProperty('confidence');
      }
    });
  });
});