const AudioCaptureManager = require('../../src/services/AudioCaptureManager');

describe('AudioCaptureManager', () => {
  let audioCapture;

  beforeEach(() => {
    audioCapture = new AudioCaptureManager();
  });

  afterEach(async () => {
    if (audioCapture.isRecording) {
      await audioCapture.stopCapture();
    }
  });

  describe('initialization', () => {
    test('should initialize with default settings', async () => {
      await audioCapture.initialize();
      
      expect(audioCapture.isRecording).toBe(false);
      expect(audioCapture.sampleRate).toBe(16000);
      expect(audioCapture.channels).toBe(1);
      expect(audioCapture.availableDevices).toHaveLength(2); // default + system
    });

    test('should detect available audio devices', async () => {
      await audioCapture.initialize();
      const devices = await audioCapture.getAvailableDevices();
      
      expect(devices).toBeInstanceOf(Array);
      expect(devices.length).toBeGreaterThan(0);
      expect(devices[0]).toHaveProperty('id');
      expect(devices[0]).toHaveProperty('name');
    });
  });

  describe('device management', () => {
    beforeEach(async () => {
      await audioCapture.initialize();
    });

    test('should set audio device', async () => {
      const devices = await audioCapture.getAvailableDevices();
      const deviceId = devices[0].id;
      
      await audioCapture.setAudioDevice(deviceId);
      
      expect(audioCapture.selectedDevice.id).toBe(deviceId);
    });

    test('should throw error for invalid device', async () => {
      await expect(audioCapture.setAudioDevice('invalid-device'))
        .rejects.toThrow('Audio device not found: invalid-device');
    });
  });

  describe('audio capture', () => {
    beforeEach(async () => {
      await audioCapture.initialize();
    });

    test('should start audio capture', async () => {
      const captureStartedSpy = jest.fn();
      audioCapture.on('captureStarted', captureStartedSpy);

      await audioCapture.startCapture();

      expect(audioCapture.isRecording).toBe(true);
      expect(captureStartedSpy).toHaveBeenCalled();
    });

    test('should stop audio capture', async () => {
      await audioCapture.startCapture();
      
      const captureStoppedSpy = jest.fn();
      audioCapture.on('captureStopped', captureStoppedSpy);

      await audioCapture.stopCapture();

      expect(audioCapture.isRecording).toBe(false);
      expect(captureStoppedSpy).toHaveBeenCalled();
    });

    test('should throw error when starting capture twice', async () => {
      await audioCapture.startCapture();
      
      await expect(audioCapture.startCapture())
        .rejects.toThrow('Audio capture already in progress');
    });

    test('should emit audio data events', async () => {
      const audioDataSpy = jest.fn();
      audioCapture.on('audioData', audioDataSpy);

      await audioCapture.startCapture();
      
      // Simulate audio data
      const mockAudioData = Buffer.alloc(1024);
      audioCapture.emit('audioData', mockAudioData);

      expect(audioDataSpy).toHaveBeenCalledWith(mockAudioData);
    });
  });

  describe('audio processing', () => {
    beforeEach(async () => {
      await audioCapture.initialize();
    });

    test('should process audio for STT', () => {
      const audioBuffer = Buffer.alloc(1024);
      const processed = audioCapture.processAudioForSTT(audioBuffer);

      expect(processed).toHaveProperty('data');
      expect(processed).toHaveProperty('sampleRate', 16000);
      expect(processed).toHaveProperty('channels', 1);
      expect(processed).toHaveProperty('format', 'pcm16');
    });

    test('should get audio stats', () => {
      const stats = audioCapture.getAudioStats();

      expect(stats).toHaveProperty('isRecording');
      expect(stats).toHaveProperty('selectedDevice');
      expect(stats).toHaveProperty('sampleRate');
      expect(stats).toHaveProperty('channels');
      expect(stats).toHaveProperty('bufferSize');
    });
  });

  describe('audio testing', () => {
    beforeEach(async () => {
      await audioCapture.initialize();
    });

    test('should test audio capture functionality', async () => {
      const testResults = await audioCapture.testCapture(1000); // 1 second test

      expect(testResults).toHaveProperty('success');
      expect(testResults).toHaveProperty('duration');
      expect(testResults).toHaveProperty('audioReceived');
      expect(testResults.duration).toBeGreaterThan(900); // Allow some variance
    }, 10000);
  });

  describe('error handling', () => {
    test('should handle initialization errors gracefully', async () => {
      // Mock a failure scenario
      const originalDetectAudioDevices = audioCapture.detectAudioDevices;
      audioCapture.detectAudioDevices = jest.fn().mockRejectedValue(new Error('Device detection failed'));

      await expect(audioCapture.initialize()).rejects.toThrow('Device detection failed');
      
      // Restore original method
      audioCapture.detectAudioDevices = originalDetectAudioDevices;
    });

    test('should emit error events on capture failure', async () => {
      await audioCapture.initialize();
      
      const errorSpy = jest.fn();
      audioCapture.on('error', errorSpy);

      // Simulate an error
      const mockError = new Error('Capture failed');
      audioCapture.emit('error', mockError);

      expect(errorSpy).toHaveBeenCalledWith(mockError);
    });
  });
});