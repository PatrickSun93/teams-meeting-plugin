// Audio Processor - Handles audio capture, preprocessing, and quality assessment
import { errorHandler, ErrorCode, ErrorCategory } from '../services/ErrorHandler.js';

class AudioProcessor {
  constructor() {
    this.audioContext = null;
    this.mediaStream = null;
    this.sourceNode = null;
    this.analyserNode = null;
    this.gainNode = null;
    this.filterNode = null;
    this.processorNode = null;
    
    this.isCapturing = false;
    this.audioBuffers = [];
    this.maxBufferSize = 100; // Maximum number of audio segments to keep
    this.segmentDuration = 1000; // 1 second segments in milliseconds
    
    this.qualityMetrics = {
      averageVolume: 0,
      peakVolume: 0,
      noiseLevel: 0,
      signalToNoiseRatio: 0,
      clippingDetected: false
    };
    
    this.eventListeners = new Map();
  }

  /**
   * Initialize Web Audio API context
   */
  async initialize() {
    try {
      // Create audio context with optimal settings for speech
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)({
        sampleRate: 16000, // Optimal for speech recognition
        latencyHint: 'interactive'
      });
      
      console.log('Audio processor initialized with sample rate:', this.audioContext.sampleRate);
      return true;
    } catch (error) {
      console.error('Failed to initialize audio processor:', error);
      throw new Error(`Audio initialization failed: ${error.message}`);
    }
  }

  /**
   * Start audio capture from media stream
   */
  async startCapture(mediaStream) {
    if (!this.audioContext) {
      const error = new Error('Audio processor not initialized');
      await errorHandler.handleAudioError(error, { component: 'audio-processor' });
      throw error;
    }

    if (this.isCapturing) {
      console.warn('Audio capture already active');
      return;
    }

    try {
      this.mediaStream = mediaStream;
      
      // Create audio processing chain
      await this.setupAudioProcessingChain();
      
      // Start quality monitoring
      this.startQualityMonitoring();
      
      // Start buffer management
      this.startBufferManagement();
      
      this.isCapturing = true;
      console.log('Audio capture started successfully');
      
      this.notifyListeners('captureStarted', { 
        sampleRate: this.audioContext.sampleRate,
        timestamp: Date.now()
      });
      
    } catch (error) {
      console.error('Failed to start audio capture:', error);
      
      // Use error handler for comprehensive error management
      await errorHandler.handleAudioError(error, {
        component: 'audio-processor',
        operation: 'startCapture',
        mediaStreamActive: mediaStream?.active,
        audioContextState: this.audioContext?.state
      });
      
      throw new Error(`Audio capture failed: ${error.message}`);
    }
  }

  /**
   * Set up audio processing chain with Web Audio API
   */
  async setupAudioProcessingChain() {
    // Create source node from media stream
    this.sourceNode = this.audioContext.createMediaStreamSource(this.mediaStream);
    
    // Create analyser for quality assessment
    this.analyserNode = this.audioContext.createAnalyser();
    this.analyserNode.fftSize = 2048;
    this.analyserNode.smoothingTimeConstant = 0.8;
    
    // Create gain node for volume control
    this.gainNode = this.audioContext.createGain();
    this.gainNode.gain.value = 1.0;
    
    // Create filter for noise reduction (high-pass filter to remove low-frequency noise)
    this.filterNode = this.audioContext.createBiquadFilter();
    this.filterNode.type = 'highpass';
    this.filterNode.frequency.value = 80; // Remove frequencies below 80Hz
    this.filterNode.Q.value = 1;
    
    // Create script processor for audio data extraction
    // Note: ScriptProcessorNode is deprecated but still widely supported
    // In production, consider using AudioWorklet for better performance
    const bufferSize = 4096;
    this.processorNode = this.audioContext.createScriptProcessor(bufferSize, 1, 1);
    
    this.processorNode.onaudioprocess = (event) => {
      this.processAudioData(event);
    };
    
    // Connect the audio processing chain
    this.sourceNode
      .connect(this.filterNode)
      .connect(this.gainNode)
      .connect(this.analyserNode)
      .connect(this.processorNode)
      .connect(this.audioContext.destination);
    
    console.log('Audio processing chain established');
  }

  /**
   * Process audio data from the processing chain
   */
  processAudioData(event) {
    if (!this.isCapturing) return;
    
    const inputBuffer = event.inputBuffer;
    const inputData = inputBuffer.getChannelData(0);
    
    // Create audio segment for buffering
    const audioSegment = {
      data: new Float32Array(inputData),
      timestamp: Date.now(),
      sampleRate: this.audioContext.sampleRate,
      duration: inputBuffer.duration
    };
    
    // Add to buffer
    this.addToBuffer(audioSegment);
    
    // Update quality metrics
    this.updateQualityMetrics(inputData);
    
    // Notify listeners of new audio data
    this.notifyListeners('audioData', audioSegment);
  }

  /**
   * Add audio segment to buffer with size management
   */
  addToBuffer(audioSegment) {
    this.audioBuffers.push(audioSegment);
    
    // Remove old segments if buffer is full
    if (this.audioBuffers.length > this.maxBufferSize) {
      this.audioBuffers.shift();
    }
  }

  /**
   * Start quality monitoring
   */
  startQualityMonitoring() {
    this.qualityMonitoringInterval = setInterval(() => {
      this.assessAudioQuality();
    }, 1000); // Check quality every second
  }

  /**
   * Assess audio quality using analyser node
   */
  assessAudioQuality() {
    if (!this.analyserNode || !this.isCapturing) return;
    
    const bufferLength = this.analyserNode.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    const frequencyData = new Uint8Array(bufferLength);
    
    // Get time domain data for volume analysis
    this.analyserNode.getByteTimeDomainData(dataArray);
    
    // Get frequency domain data for noise analysis
    this.analyserNode.getByteFrequencyData(frequencyData);
    
    // Calculate volume metrics
    let sum = 0;
    let peak = 0;
    let clipping = false;
    
    for (let i = 0; i < bufferLength; i++) {
      const value = Math.abs(dataArray[i] - 128) / 128;
      sum += value;
      peak = Math.max(peak, value);
      
      // Detect clipping (values near maximum)
      if (dataArray[i] >= 250 || dataArray[i] <= 5) {
        clipping = true;
      }
    }
    
    const averageVolume = sum / bufferLength;
    
    // Calculate noise level (energy in low frequencies)
    let noiseSum = 0;
    const noiseFreqBins = Math.floor(bufferLength * 0.1); // First 10% of frequency bins
    for (let i = 0; i < noiseFreqBins; i++) {
      noiseSum += frequencyData[i];
    }
    const noiseLevel = noiseSum / (noiseFreqBins * 255);
    
    // Calculate signal level (energy in speech frequencies 300Hz-3400Hz)
    let signalSum = 0;
    const speechStartBin = Math.floor((300 / (this.audioContext.sampleRate / 2)) * bufferLength);
    const speechEndBin = Math.floor((3400 / (this.audioContext.sampleRate / 2)) * bufferLength);
    
    for (let i = speechStartBin; i < speechEndBin && i < bufferLength; i++) {
      signalSum += frequencyData[i];
    }
    const signalLevel = signalSum / ((speechEndBin - speechStartBin) * 255);
    
    // Calculate signal-to-noise ratio
    const snr = signalLevel > 0 && noiseLevel > 0 ? signalLevel / noiseLevel : 0;
    
    // Update quality metrics
    this.qualityMetrics = {
      averageVolume: averageVolume,
      peakVolume: peak,
      noiseLevel: noiseLevel,
      signalToNoiseRatio: snr,
      clippingDetected: clipping,
      timestamp: Date.now()
    };
    
    // Notify listeners of quality update
    this.notifyListeners('qualityUpdate', this.qualityMetrics);
  }

  /**
   * Update quality metrics from raw audio data
   */
  updateQualityMetrics(audioData) {
    // This method provides additional quality analysis from raw float data
    let rms = 0;
    let peak = 0;
    
    for (let i = 0; i < audioData.length; i++) {
      const value = Math.abs(audioData[i]);
      rms += value * value;
      peak = Math.max(peak, value);
    }
    
    rms = Math.sqrt(rms / audioData.length);
    
    // Store additional metrics for detailed analysis
    this.qualityMetrics.rms = rms;
    this.qualityMetrics.peakAmplitude = peak;
  }

  /**
   * Start buffer management for real-time processing
   */
  startBufferManagement() {
    this.bufferManagementInterval = setInterval(() => {
      this.processBufferedAudio();
    }, this.segmentDuration);
  }

  /**
   * Process buffered audio for transcription
   */
  processBufferedAudio() {
    if (this.audioBuffers.length === 0) return;
    
    // Get recent audio segments for processing
    const recentSegments = this.audioBuffers.slice(-10); // Last 10 segments
    
    if (recentSegments.length > 0) {
      const processedSegment = this.combineAudioSegments(recentSegments);
      
      // Notify listeners that audio is ready for transcription
      this.notifyListeners('audioReady', processedSegment);
    }
  }

  /**
   * Combine multiple audio segments into one
   */
  combineAudioSegments(segments) {
    if (segments.length === 0) return null;
    
    // Calculate total length
    let totalLength = 0;
    segments.forEach(segment => {
      totalLength += segment.data.length;
    });
    
    // Combine audio data
    const combinedData = new Float32Array(totalLength);
    let offset = 0;
    
    segments.forEach(segment => {
      combinedData.set(segment.data, offset);
      offset += segment.data.length;
    });
    
    return {
      data: combinedData,
      timestamp: segments[0].timestamp,
      duration: segments.reduce((sum, seg) => sum + seg.duration, 0),
      sampleRate: segments[0].sampleRate,
      segmentCount: segments.length
    };
  }

  /**
   * Apply audio preprocessing (noise reduction, normalization)
   */
  preprocessAudio(audioData) {
    // Create a copy to avoid modifying original data
    const processedData = new Float32Array(audioData);
    
    // Apply normalization
    this.normalizeAudio(processedData);
    
    // Apply noise gate (simple implementation)
    this.applyNoiseGate(processedData);
    
    return processedData;
  }

  /**
   * Normalize audio levels
   */
  normalizeAudio(audioData) {
    // Find peak amplitude
    let peak = 0;
    for (let i = 0; i < audioData.length; i++) {
      peak = Math.max(peak, Math.abs(audioData[i]));
    }
    
    // Normalize to 70% of maximum to prevent clipping
    if (peak > 0) {
      const targetLevel = 0.7;
      const gain = targetLevel / peak;
      
      for (let i = 0; i < audioData.length; i++) {
        audioData[i] *= gain;
      }
    }
  }

  /**
   * Apply simple noise gate
   */
  applyNoiseGate(audioData, threshold = 0.01) {
    for (let i = 0; i < audioData.length; i++) {
      if (Math.abs(audioData[i]) < threshold) {
        audioData[i] = 0;
      }
    }
  }

  /**
   * Get audio segment for transcription
   */
  getAudioSegment(duration = 5000) {
    const targetSegments = Math.ceil(duration / this.segmentDuration);
    const availableSegments = Math.min(targetSegments, this.audioBuffers.length);
    
    if (availableSegments === 0) {
      return null;
    }
    
    const segments = this.audioBuffers.slice(-availableSegments);
    const combinedSegment = this.combineAudioSegments(segments);
    
    if (combinedSegment) {
      // Apply preprocessing
      combinedSegment.data = this.preprocessAudio(combinedSegment.data);
    }
    
    return combinedSegment;
  }

  /**
   * Get current quality metrics
   */
  getQualityMetrics() {
    return { ...this.qualityMetrics };
  }

  /**
   * Assess if audio quality is sufficient for transcription
   */
  isQualitySufficient() {
    const metrics = this.qualityMetrics;
    
    // Define quality thresholds
    const minVolume = 0.01;
    const maxNoise = 0.3;
    const minSNR = 2.0;
    
    return (
      metrics.averageVolume > minVolume &&
      metrics.noiseLevel < maxNoise &&
      metrics.signalToNoiseRatio > minSNR &&
      !metrics.clippingDetected
    );
  }

  /**
   * Stop audio capture
   */
  stopCapture() {
    if (!this.isCapturing) {
      console.warn('Audio capture not active');
      return;
    }
    
    try {
      // Stop intervals
      if (this.qualityMonitoringInterval) {
        clearInterval(this.qualityMonitoringInterval);
      }
      
      if (this.bufferManagementInterval) {
        clearInterval(this.bufferManagementInterval);
      }
      
      // Disconnect audio nodes
      if (this.processorNode) {
        this.processorNode.disconnect();
        this.processorNode = null;
      }
      
      if (this.sourceNode) {
        this.sourceNode.disconnect();
        this.sourceNode = null;
      }
      
      if (this.analyserNode) {
        this.analyserNode.disconnect();
        this.analyserNode = null;
      }
      
      if (this.gainNode) {
        this.gainNode.disconnect();
        this.gainNode = null;
      }
      
      if (this.filterNode) {
        this.filterNode.disconnect();
        this.filterNode = null;
      }
      
      // Stop media stream tracks
      if (this.mediaStream) {
        this.mediaStream.getTracks().forEach(track => track.stop());
        this.mediaStream = null;
      }
      
      this.isCapturing = false;
      console.log('Audio capture stopped');
      
      this.notifyListeners('captureStopped', { timestamp: Date.now() });
      
    } catch (error) {
      console.error('Error stopping audio capture:', error);
      throw new Error(`Failed to stop audio capture: ${error.message}`);
    }
  }

  /**
   * Add event listener
   */
  addEventListener(eventType, listener) {
    if (!this.eventListeners.has(eventType)) {
      this.eventListeners.set(eventType, []);
    }
    this.eventListeners.get(eventType).push(listener);
  }

  /**
   * Remove event listener
   */
  removeEventListener(eventType, listener) {
    const listeners = this.eventListeners.get(eventType);
    if (listeners) {
      const index = listeners.indexOf(listener);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }
  }

  /**
   * Notify event listeners
   */
  notifyListeners(eventType, data) {
    const listeners = this.eventListeners.get(eventType) || [];
    listeners.forEach(listener => {
      try {
        listener(data);
      } catch (error) {
        console.error(`Error in ${eventType} listener:`, error);
      }
    });
  }

  /**
   * Clean up resources
   */
  cleanup() {
    this.stopCapture();
    
    if (this.audioContext && this.audioContext.state !== 'closed') {
      this.audioContext.close();
    }
    
    this.audioBuffers = [];
    this.eventListeners.clear();
    
    console.log('Audio processor cleaned up');
  }

  /**
   * Get audio processor status
   */
  getStatus() {
    return {
      isCapturing: this.isCapturing,
      isInitialized: this.audioContext !== null,
      audioContextState: this.audioContext ? this.audioContext.state : 'not-initialized',
      bufferCount: this.audioBuffers.length,
      qualityMetrics: this.qualityMetrics
    };
  }
}

export default AudioProcessor;