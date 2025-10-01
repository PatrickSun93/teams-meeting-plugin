/**
 * Google Meet Audio Capture Content Script
 * Captures audio streams from Google Meet for transcription
 */

class MeetAudioCapture {
  constructor() {
    this.audioStream = null;
    this.mediaRecorder = null;
    this.audioChunks = [];
    this.isRecording = false;
    this.audioContext = null;
    this.analyser = null;
    this.onAudioDataCallback = null;
    
    this.init();
  }

  async init() {
    console.log('Audio capture initialized');
    
    // Listen for messages from popup/background
    chrome.runtime.onMessage.addListener(this.handleMessage.bind(this));
    
    // Set up audio context for analysis
    this.setupAudioContext();
  }

  setupAudioContext() {
    try {
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 2048;
    } catch (error) {
      console.error('Failed to create audio context:', error);
    }
  }

  async handleMessage(message, sender, sendResponse) {
    switch (message.type) {
      case 'START_AUDIO_CAPTURE':
        return this.startCapture();
      
      case 'STOP_AUDIO_CAPTURE':
        return this.stopCapture();
      
      case 'GET_AUDIO_LEVEL':
        return this.getAudioLevel();
      
      case 'SET_AUDIO_CALLBACK':
        this.onAudioDataCallback = message.callback;
        return { success: true };
    }
  }

  async startCapture() {
    try {
      console.log('Starting audio capture...');
      
      // Request microphone access
      this.audioStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 16000 // Optimal for speech recognition
        }
      });

      // Connect to audio context for analysis
      if (this.audioContext && this.analyser) {
        const source = this.audioContext.createMediaStreamSource(this.audioStream);
        source.connect(this.analyser);
      }

      // Set up MediaRecorder for audio chunks
      this.mediaRecorder = new MediaRecorder(this.audioStream, {
        mimeType: 'audio/webm;codecs=opus'
      });

      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.audioChunks.push(event.data);
          this.processAudioChunk(event.data);
        }
      };

      this.mediaRecorder.onstop = () => {
        console.log('MediaRecorder stopped');
        this.processCompleteRecording();
      };

      // Start recording in chunks for real-time processing
      this.mediaRecorder.start(1000); // 1 second chunks
      this.isRecording = true;

      console.log('Audio capture started successfully');
      return { success: true };

    } catch (error) {
      console.error('Failed to start audio capture:', error);
      return { success: false, error: error.message };
    }
  }

  async stopCapture() {
    try {
      console.log('Stopping audio capture...');

      if (this.mediaRecorder && this.isRecording) {
        this.mediaRecorder.stop();
      }

      if (this.audioStream) {
        this.audioStream.getTracks().forEach(track => track.stop());
        this.audioStream = null;
      }

      this.isRecording = false;
      console.log('Audio capture stopped');
      
      return { success: true };

    } catch (error) {
      console.error('Failed to stop audio capture:', error);
      return { success: false, error: error.message };
    }
  }

  processAudioChunk(audioBlob) {
    // Convert blob to ArrayBuffer for processing
    const reader = new FileReader();
    reader.onload = async (event) => {
      const arrayBuffer = event.target.result;
      
      // Send audio chunk for transcription
      this.sendAudioForTranscription(arrayBuffer);
    };
    reader.readAsArrayBuffer(audioBlob);
  }

  processCompleteRecording() {
    if (this.audioChunks.length === 0) return;

    // Combine all audio chunks
    const completeBlob = new Blob(this.audioChunks, { type: 'audio/webm' });
    this.audioChunks = [];

    // Send complete recording for final processing
    this.sendCompleteRecording(completeBlob);
  }

  sendAudioForTranscription(audioBuffer) {
    // Send to background script for transcription processing
    chrome.runtime.sendMessage({
      type: 'PROCESS_AUDIO_CHUNK',
      data: {
        audioBuffer: audioBuffer,
        timestamp: Date.now(),
        meetingId: this.getMeetingId()
      }
    }).catch(error => {
      console.error('Failed to send audio for transcription:', error);
    });
  }

  sendCompleteRecording(audioBlob) {
    const reader = new FileReader();
    reader.onload = (event) => {
      chrome.runtime.sendMessage({
        type: 'PROCESS_COMPLETE_RECORDING',
        data: {
          audioBuffer: event.target.result,
          meetingId: this.getMeetingId(),
          timestamp: Date.now()
        }
      }).catch(error => {
        console.error('Failed to send complete recording:', error);
      });
    };
    reader.readAsArrayBuffer(audioBlob);
  }

  getAudioLevel() {
    if (!this.analyser) return { level: 0 };

    const bufferLength = this.analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    this.analyser.getByteFrequencyData(dataArray);

    // Calculate average volume level
    let sum = 0;
    for (let i = 0; i < bufferLength; i++) {
      sum += dataArray[i];
    }
    const average = sum / bufferLength;
    const level = average / 255; // Normalize to 0-1

    return { level, success: true };
  }

  getMeetingId() {
    const url = window.location.href;
    const meetingIdMatch = url.match(/meet\.google\.com\/([a-z0-9-]+)/);
    return meetingIdMatch ? meetingIdMatch[1] : null;
  }

  // Capture system audio (requires additional permissions)
  async captureSystemAudio() {
    try {
      // This requires screen capture with audio
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: false,
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });

      return stream;
    } catch (error) {
      console.error('Failed to capture system audio:', error);
      throw error;
    }
  }

  // Get audio quality metrics
  getAudioQuality() {
    if (!this.analyser) return null;

    const bufferLength = this.analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    this.analyser.getByteFrequencyData(dataArray);

    // Calculate signal-to-noise ratio and other metrics
    let signalPower = 0;
    let noisePower = 0;
    
    for (let i = 0; i < bufferLength; i++) {
      const value = dataArray[i];
      if (i < bufferLength * 0.1) { // Low frequencies (noise)
        noisePower += value * value;
      } else { // Higher frequencies (signal)
        signalPower += value * value;
      }
    }

    const snr = signalPower / (noisePower + 1); // Add 1 to avoid division by zero
    
    return {
      signalToNoiseRatio: snr,
      overallLevel: this.getAudioLevel().level,
      quality: snr > 10 ? 'high' : snr > 5 ? 'medium' : 'low'
    };
  }

  destroy() {
    this.stopCapture();
    
    if (this.audioContext) {
      this.audioContext.close();
    }
  }
}

// Initialize audio capture
const audioCapture = new MeetAudioCapture();

// Clean up on page unload
window.addEventListener('beforeunload', () => {
  audioCapture.destroy();
});