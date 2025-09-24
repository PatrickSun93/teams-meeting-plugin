// Local STT Service - Handles local speech-to-text using Whisper.js
import { pipeline, env } from '@xenova/transformers';

// Configure transformers.js to use local models
env.allowRemoteModels = false;
env.allowLocalModels = true;

class LocalSTTService {
  constructor() {
    this.pipeline = null;
    this.isInitialized = false;
    this.isLoading = false;
    this.modelName = 'Xenova/whisper-tiny.en'; // Default to tiny English model
    this.supportedLanguages = new Map([
      ['en', 'Xenova/whisper-tiny.en'],
      ['multilingual', 'Xenova/whisper-tiny'],
      ['base-en', 'Xenova/whisper-base.en'],
      ['base-multilingual', 'Xenova/whisper-base'],
      ['small-en', 'Xenova/whisper-small.en'],
      ['small-multilingual', 'Xenova/whisper-small']
    ]);
    
    this.currentLanguage = 'en';
    this.confidence = 0;
    this.lastError = null;
    
    // Performance monitoring
    this.stats = {
      totalTranscriptions: 0,
      totalProcessingTime: 0,
      averageProcessingTime: 0,
      successRate: 0,
      failures: 0
    };
    
    // Event listeners
    this.eventListeners = new Map();
  }

  /**
   * Initialize the Whisper pipeline
   */
  async initialize(options = {}) {
    if (this.isInitialized) {
      console.log('Local STT service already initialized');
      return true;
    }

    if (this.isLoading) {
      console.log('Local STT service is already loading');
      return false;
    }

    try {
      this.isLoading = true;
      this.notifyListeners('loadingStarted', { modelName: this.modelName });
      
      console.log(`Initializing Whisper pipeline with model: ${this.modelName}`);
      
      // Set language and model based on options
      if (options.language && this.supportedLanguages.has(options.language)) {
        this.currentLanguage = options.language;
        this.modelName = this.supportedLanguages.get(options.language);
      }
      
      // Initialize the pipeline
      this.pipeline = await pipeline('automatic-speech-recognition', this.modelName, {
        chunk_length_s: 30,
        stride_length_s: 5,
        ...options
      });
      
      this.isInitialized = true;
      this.isLoading = false;
      this.lastError = null;
      
      console.log('Local STT service initialized successfully');
      this.notifyListeners('initialized', { 
        modelName: this.modelName,
        language: this.currentLanguage 
      });
      
      return true;
      
    } catch (error) {
      this.isLoading = false;
      this.lastError = error;
      console.error('Failed to initialize local STT service:', error);
      this.notifyListeners('initializationFailed', { error: error.message });
      throw new Error(`Local STT initialization failed: ${error.message}`);
    }
  }

  /**
   * Transcribe audio data to text
   */
  async transcribe(audioData, options = {}) {
    if (!this.isInitialized) {
      throw new Error('Local STT service not initialized. Call initialize() first.');
    }

    const startTime = performance.now();
    
    try {
      // Validate audio data
      if (!audioData || !audioData.data || audioData.data.length === 0) {
        throw new Error('Invalid audio data provided');
      }

      // Prepare audio for Whisper
      const processedAudio = this.prepareAudioForWhisper(audioData);
      
      // Configure transcription options
      const transcriptionOptions = {
        language: options.language || this.currentLanguage,
        task: options.task || 'transcribe',
        return_timestamps: options.return_timestamps !== false,
        chunk_length_s: options.chunk_length_s || 30,
        stride_length_s: options.stride_length_s || 5,
        ...options
      };

      console.log('Starting transcription with options:', transcriptionOptions);
      
      // Perform transcription
      const result = await this.pipeline(processedAudio, transcriptionOptions);
      
      // Process and format result
      const transcriptionResult = this.processTranscriptionResult(result, audioData);
      
      // Update statistics
      const processingTime = performance.now() - startTime;
      this.updateStats(processingTime, true);
      
      console.log(`Transcription completed in ${processingTime.toFixed(2)}ms:`, transcriptionResult.text);
      
      this.notifyListeners('transcriptionCompleted', {
        result: transcriptionResult,
        processingTime
      });
      
      return transcriptionResult;
      
    } catch (error) {
      const processingTime = performance.now() - startTime;
      this.updateStats(processingTime, false);
      
      console.error('Transcription failed:', error);
      this.notifyListeners('transcriptionFailed', { 
        error: error.message,
        processingTime 
      });
      
      // Return fallback result
      return this.createFallbackResult(error, audioData);
    }
  }

  /**
   * Prepare audio data for Whisper processing
   */
  prepareAudioForWhisper(audioData) {
    let audioArray = audioData.data;
    
    // Ensure audio is Float32Array
    if (!(audioArray instanceof Float32Array)) {
      audioArray = new Float32Array(audioArray);
    }
    
    // Resample if necessary (Whisper expects 16kHz)
    const targetSampleRate = 16000;
    if (audioData.sampleRate && audioData.sampleRate !== targetSampleRate) {
      audioArray = this.resampleAudio(audioArray, audioData.sampleRate, targetSampleRate);
    }
    
    // Normalize audio levels
    audioArray = this.normalizeAudio(audioArray);
    
    // Apply pre-emphasis filter to improve speech recognition
    audioArray = this.applyPreEmphasis(audioArray);
    
    return audioArray;
  }

  /**
   * Resample audio to target sample rate
   */
  resampleAudio(audioData, sourceSampleRate, targetSampleRate) {
    if (sourceSampleRate === targetSampleRate) {
      return audioData;
    }
    
    const ratio = sourceSampleRate / targetSampleRate;
    const newLength = Math.round(audioData.length / ratio);
    const resampled = new Float32Array(newLength);
    
    for (let i = 0; i < newLength; i++) {
      const sourceIndex = i * ratio;
      const index = Math.floor(sourceIndex);
      const fraction = sourceIndex - index;
      
      if (index + 1 < audioData.length) {
        // Linear interpolation
        resampled[i] = audioData[index] * (1 - fraction) + audioData[index + 1] * fraction;
      } else {
        resampled[i] = audioData[index] || 0;
      }
    }
    
    return resampled;
  }

  /**
   * Normalize audio levels
   */
  normalizeAudio(audioData) {
    const normalized = new Float32Array(audioData.length);
    
    // Find peak amplitude
    let peak = 0;
    for (let i = 0; i < audioData.length; i++) {
      peak = Math.max(peak, Math.abs(audioData[i]));
    }
    
    // Normalize to prevent clipping while maintaining dynamic range
    if (peak > 0) {
      const targetLevel = 0.8; // Leave some headroom
      const gain = Math.min(targetLevel / peak, 4.0); // Limit maximum gain
      
      for (let i = 0; i < audioData.length; i++) {
        normalized[i] = audioData[i] * gain;
      }
    } else {
      // If no signal, return zeros
      normalized.fill(0);
    }
    
    return normalized;
  }

  /**
   * Apply pre-emphasis filter to enhance speech frequencies
   */
  applyPreEmphasis(audioData, coefficient = 0.97) {
    const filtered = new Float32Array(audioData.length);
    
    filtered[0] = audioData[0];
    for (let i = 1; i < audioData.length; i++) {
      filtered[i] = audioData[i] - coefficient * audioData[i - 1];
    }
    
    return filtered;
  }

  /**
   * Process transcription result from Whisper
   */
  processTranscriptionResult(result, originalAudioData) {
    // Handle different result formats from Whisper
    let text = '';
    let segments = [];
    let confidence = 0;
    
    if (typeof result === 'string') {
      text = result;
      confidence = 0.8; // Default confidence for string results
    } else if (result && result.text) {
      text = result.text;
      confidence = result.confidence || 0.8;
      
      // Process segments if available
      if (result.chunks && Array.isArray(result.chunks)) {
        segments = result.chunks.map((chunk, index) => ({
          id: `segment_${index}`,
          text: chunk.text || '',
          startTime: chunk.timestamp ? chunk.timestamp[0] : 0,
          endTime: chunk.timestamp ? chunk.timestamp[1] : 0,
          confidence: chunk.confidence || confidence
        }));
      }
    }
    
    // Clean up text
    text = this.cleanTranscriptionText(text);
    
    // Calculate overall confidence based on text quality
    const qualityConfidence = this.assessTranscriptionQuality(text, originalAudioData);
    confidence = Math.min(confidence, qualityConfidence);
    
    // Detect language if not specified
    const detectedLanguage = this.detectLanguage(text);
    
    return {
      text: text.trim(),
      confidence: Math.round(confidence * 100) / 100,
      segments: segments,
      language: detectedLanguage || this.currentLanguage,
      timestamp: Date.now(),
      processingInfo: {
        modelUsed: this.modelName,
        audioLength: originalAudioData.duration || 0,
        sampleRate: originalAudioData.sampleRate || 16000
      }
    };
  }

  /**
   * Clean transcription text
   */
  cleanTranscriptionText(text) {
    if (!text || typeof text !== 'string') {
      return '';
    }
    
    return text
      .trim()
      .replace(/\s+/g, ' ') // Normalize whitespace
      .replace(/[^\w\s.,!?;:'"()-]/g, '') // Remove unusual characters
      .replace(/^[.,!?;:]+|[.,!?;:]+$/g, ''); // Remove leading/trailing punctuation
  }

  /**
   * Assess transcription quality based on text characteristics
   */
  assessTranscriptionQuality(text, audioData) {
    if (!text || text.length === 0) {
      return 0.1;
    }
    
    let qualityScore = 0.8; // Base score
    
    // Penalize very short transcriptions
    if (text.length < 10) {
      qualityScore *= 0.7;
    }
    
    // Penalize repetitive text
    const words = text.toLowerCase().split(/\s+/);
    const uniqueWords = new Set(words);
    const repetitionRatio = uniqueWords.size / words.length;
    if (repetitionRatio < 0.5) {
      qualityScore *= 0.8;
    }
    
    // Boost score for proper sentence structure
    if (/[.!?]/.test(text)) {
      qualityScore *= 1.1;
    }
    
    // Consider audio quality metrics if available
    if (audioData && audioData.qualityMetrics) {
      const audioQuality = audioData.qualityMetrics;
      if (audioQuality.signalToNoiseRatio > 3) {
        qualityScore *= 1.1;
      } else if (audioQuality.signalToNoiseRatio < 1) {
        qualityScore *= 0.8;
      }
    }
    
    return Math.min(qualityScore, 1.0);
  }

  /**
   * Simple language detection based on text patterns
   */
  detectLanguage(text) {
    if (!text || text.length < 10) {
      return null;
    }
    
    // Simple heuristics for common languages
    const patterns = {
      'en': /\b(the|and|is|in|to|of|a|that|it|with|for|as|was|on|are|you)\b/gi,
      'es': /\b(el|la|de|que|y|en|un|es|se|no|te|lo|le|da|su|por|son|con|para|una)\b/gi,
      'fr': /\b(le|de|et|à|un|il|être|et|en|avoir|que|pour|dans|ce|son|une|sur|avec|ne|se|pas)\b/gi,
      'de': /\b(der|die|und|in|den|von|zu|das|mit|sich|des|auf|für|ist|im|dem|nicht|ein|eine|als)\b/gi
    };
    
    let maxMatches = 0;
    let detectedLang = null;
    
    for (const [lang, pattern] of Object.entries(patterns)) {
      const matches = (text.match(pattern) || []).length;
      if (matches > maxMatches) {
        maxMatches = matches;
        detectedLang = lang;
      }
    }
    
    // Require at least 3 matches for confidence
    return maxMatches >= 3 ? detectedLang : null;
  }

  /**
   * Create fallback result when transcription fails
   */
  createFallbackResult(error, audioData) {
    return {
      text: '',
      confidence: 0,
      segments: [],
      language: this.currentLanguage,
      timestamp: Date.now(),
      error: error.message,
      fallback: true,
      processingInfo: {
        modelUsed: this.modelName,
        audioLength: audioData.duration || 0,
        sampleRate: audioData.sampleRate || 16000,
        errorType: error.name || 'UnknownError'
      }
    };
  }

  /**
   * Update performance statistics
   */
  updateStats(processingTime, success) {
    this.stats.totalTranscriptions++;
    this.stats.totalProcessingTime += processingTime;
    this.stats.averageProcessingTime = this.stats.totalProcessingTime / this.stats.totalTranscriptions;
    
    if (success) {
      this.stats.successRate = ((this.stats.totalTranscriptions - this.stats.failures) / this.stats.totalTranscriptions) * 100;
    } else {
      this.stats.failures++;
      this.stats.successRate = ((this.stats.totalTranscriptions - this.stats.failures) / this.stats.totalTranscriptions) * 100;
    }
  }

  /**
   * Change language/model
   */
  async changeLanguage(language) {
    if (!this.supportedLanguages.has(language)) {
      throw new Error(`Unsupported language: ${language}`);
    }
    
    const newModelName = this.supportedLanguages.get(language);
    
    if (newModelName !== this.modelName) {
      console.log(`Switching to model: ${newModelName}`);
      
      // Reinitialize with new model
      this.isInitialized = false;
      this.pipeline = null;
      this.modelName = newModelName;
      this.currentLanguage = language;
      
      await this.initialize();
    } else {
      this.currentLanguage = language;
    }
  }

  /**
   * Get available languages
   */
  getAvailableLanguages() {
    return Array.from(this.supportedLanguages.keys());
  }

  /**
   * Get current status
   */
  getStatus() {
    return {
      isInitialized: this.isInitialized,
      isLoading: this.isLoading,
      currentLanguage: this.currentLanguage,
      modelName: this.modelName,
      lastError: this.lastError?.message || null,
      stats: { ...this.stats }
    };
  }

  /**
   * Get performance statistics
   */
  getStats() {
    return { ...this.stats };
  }

  /**
   * Reset statistics
   */
  resetStats() {
    this.stats = {
      totalTranscriptions: 0,
      totalProcessingTime: 0,
      averageProcessingTime: 0,
      successRate: 0,
      failures: 0
    };
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
   * Cleanup resources
   */
  cleanup() {
    this.pipeline = null;
    this.isInitialized = false;
    this.isLoading = false;
    this.eventListeners.clear();
    console.log('Local STT service cleaned up');
  }
}

export default LocalSTTService;