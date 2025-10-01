const recorder = require('node-record-lpcm16');
const { EventEmitter } = require('events');

class AudioCaptureManager extends EventEmitter {
  constructor() {
    super();
    this.isRecording = false;
    this.recordingStream = null;
    this.audioBuffer = [];
    this.sampleRate = 16000;
    this.channels = 1;
    this.selectedDevice = null;
    this.availableDevices = [];
  }

  async initialize() {
    try {
      await this.detectAudioDevices();
      console.log('AudioCaptureManager initialized');
    } catch (error) {
      console.error('Failed to initialize AudioCaptureManager:', error);
      throw error;
    }
  }

  async detectAudioDevices() {
    try {
      // Get available audio input devices
      // This is a simplified implementation - in a real app you'd use a more robust method
      this.availableDevices = [
        { id: 'default', name: 'Default Microphone', isDefault: true },
        { id: 'system', name: 'System Audio (Loopback)', isSystem: true }
      ];

      // Set default device
      this.selectedDevice = this.availableDevices.find(d => d.isDefault) || this.availableDevices[0];
      
      return this.availableDevices;
    } catch (error) {
      console.error('Failed to detect audio devices:', error);
      throw error;
    }
  }

  async getAvailableDevices() {
    return this.availableDevices;
  }

  async setAudioDevice(deviceId) {
    const device = this.availableDevices.find(d => d.id === deviceId);
    if (!device) {
      throw new Error(`Audio device not found: ${deviceId}`);
    }
    
    this.selectedDevice = device;
    
    // If currently recording, restart with new device
    if (this.isRecording) {
      await this.stopCapture();
      await this.startCapture();
    }
  }

  async startCapture() {
    if (this.isRecording) {
      throw new Error('Audio capture already in progress');
    }

    try {
      const recordingOptions = {
        sampleRate: this.sampleRate,
        channels: this.channels,
        compress: false,
        threshold: 0.5,
        thresholdStart: null,
        thresholdEnd: null,
        silence: '1.0',
        device: this.selectedDevice?.id === 'system' ? 'pulse' : null, // Use system audio for loopback
        recordProgram: this.selectedDevice?.id === 'system' ? 'sox' : 'rec'
      };

      this.recordingStream = recorder.record(recordingOptions);
      this.isRecording = true;
      this.audioBuffer = [];

      // Handle audio data
      this.recordingStream.stream().on('data', (chunk) => {
        this.audioBuffer.push(chunk);
        this.emit('audioData', chunk);
        
        // Emit audio segments for real-time processing
        if (this.audioBuffer.length > 10) { // Adjust buffer size as needed
          const audioSegment = Buffer.concat(this.audioBuffer);
          this.emit('audioSegment', audioSegment);
          this.audioBuffer = [];
        }
      });

      this.recordingStream.stream().on('error', (error) => {
        console.error('Audio recording error:', error);
        this.emit('error', error);
      });

      this.recordingStream.stream().on('end', () => {
        console.log('Audio recording ended');
        this.isRecording = false;
        this.emit('recordingEnded');
      });

      console.log('Audio capture started');
      this.emit('captureStarted');
      
    } catch (error) {
      this.isRecording = false;
      console.error('Failed to start audio capture:', error);
      throw error;
    }
  }

  async stopCapture() {
    if (!this.isRecording) {
      return;
    }

    try {
      if (this.recordingStream) {
        this.recordingStream.stop();
        this.recordingStream = null;
      }

      this.isRecording = false;
      
      // Process any remaining audio buffer
      if (this.audioBuffer.length > 0) {
        const finalSegment = Buffer.concat(this.audioBuffer);
        this.emit('audioSegment', finalSegment);
        this.audioBuffer = [];
      }

      console.log('Audio capture stopped');
      this.emit('captureStopped');
      
    } catch (error) {
      console.error('Failed to stop audio capture:', error);
      throw error;
    }
  }

  getAudioStats() {
    return {
      isRecording: this.isRecording,
      selectedDevice: this.selectedDevice,
      sampleRate: this.sampleRate,
      channels: this.channels,
      bufferSize: this.audioBuffer.length
    };
  }

  // Convert audio buffer to format suitable for STT services
  processAudioForSTT(audioBuffer) {
    try {
      // Convert to the format expected by STT services
      // This is a simplified implementation
      return {
        data: audioBuffer,
        sampleRate: this.sampleRate,
        channels: this.channels,
        format: 'pcm16'
      };
    } catch (error) {
      console.error('Failed to process audio for STT:', error);
      throw error;
    }
  }

  // Test audio capture functionality
  async testCapture(duration = 5000) {
    return new Promise((resolve, reject) => {
      const testResults = {
        success: false,
        duration: 0,
        audioReceived: false,
        error: null
      };

      const startTime = Date.now();
      let audioReceived = false;

      const cleanup = () => {
        this.removeListener('audioData', onAudioData);
        this.removeListener('error', onError);
      };

      const onAudioData = () => {
        audioReceived = true;
      };

      const onError = (error) => {
        cleanup();
        testResults.error = error.message;
        reject(testResults);
      };

      this.on('audioData', onAudioData);
      this.on('error', onError);

      this.startCapture()
        .then(() => {
          setTimeout(async () => {
            try {
              await this.stopCapture();
              cleanup();
              
              testResults.success = true;
              testResults.duration = Date.now() - startTime;
              testResults.audioReceived = audioReceived;
              
              resolve(testResults);
            } catch (error) {
              cleanup();
              testResults.error = error.message;
              reject(testResults);
            }
          }, duration);
        })
        .catch((error) => {
          cleanup();
          testResults.error = error.message;
          reject(testResults);
        });
    });
  }
}

module.exports = AudioCaptureManager;