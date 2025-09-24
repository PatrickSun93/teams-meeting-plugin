// Transcription Engine - Orchestrates STT services and manages transcription workflow
import LocalSTTService from './LocalSTTService.js';
import CloudSTTService from './CloudSTTService.js';

class TranscriptionEngine {
  constructor() {
    this.localSTTService = new LocalSTTService();
    this.cloudSTTService = new CloudSTTService();
    this.isInitialized = false;
    this.isTranscribing = false;
    this.currentProvider = 'local';
    
    // Configuration
    this.config = {
      provider: 'local',
      language: 'en',
      enableFallback: true,
      confidenceThreshold: 0.3,
      maxRetries: 3,
      retryDelay: 1000,
      apiKeys: {},
      cloudConfig: {}
    };
    
    // Transcription state
    this.transcriptionBuffer = [];
    this.lastTranscriptionTime = 0;
    this.processingQueue = [];
    this.isProcessing = false;
    
    // Performance tracking
    this.metrics = {
      totalTranscriptions: 0,
      successfulTranscriptions: 0,
      failedTranscriptions: 0,
      averageConfidence: 0,
      averageProcessingTime: 0,
      totalProcessingTime: 0
    };
    
    // Event listeners
    this.eventListeners = new Map();
    
    // Bind methods
    this.handleAudioData = this.handleAudioData.bind(this);
    this.processTranscriptionQueue = this.processTranscriptionQueue.bind(this);
  }

  /**
   * Initialize the transcription engine
   */
  async initialize(config = {}) {
    if (this.isInitialized) {
      console.log('Transcription engine already initialized');
      return true;
    }

    try {
      // Update configuration
      this.config = { ...this.config, ...config };
      
      console.log('Initializing transcription engine with config:', this.config);
      
      // Initialize services based on provider
      if (this.isLocalProvider(this.config.provider)) {
        await this.localSTTService.initialize({
          language: this.config.language
        });
        this.setupLocalSTTListeners();
      }
      
      // Set up cloud STT listeners
      this.setupCloudSTTListeners();
      
      this.isInitialized = true;
      console.log('Transcription engine initialized successfully');
      
      this.notifyListeners('initialized', {
        provider: this.currentProvider,
        config: this.config
      });
      
      return true;
      
    } catch (error) {
      console.error('Failed to initialize transcription engine:', error);
      this.notifyListeners('initializationFailed', { error: error.message });
      throw new Error(`Transcription engine initialization failed: ${error.message}`);
    }
  }

  /**
   * Set up event listeners for local STT service
   */
  setupLocalSTTListeners() {
    this.localSTTService.addEventListener('loadingStarted', (data) => {
      this.notifyListeners('modelLoading', data);
    });
    
    this.localSTTService.addEventListener('initialized', (data) => {
      this.notifyListeners('modelLoaded', data);
    });
    
    this.localSTTService.addEventListener('transcriptionCompleted', (data) => {
      this.handleTranscriptionResult(data.result, data.processingTime);
    });
    
    this.localSTTService.addEventListener('transcriptionFailed', (data) => {
      this.handleTranscriptionError(data.error, data.processingTime);
    });
  }

  /**
   * Set up event listeners for cloud STT service
   */
  setupCloudSTTListeners() {
    this.cloudSTTService.addEventListener('networkStatusChanged', (data) => {
      this.notifyListeners('networkStatusChanged', data);
      
      // Handle fallback if network goes down during transcription
      if (!data.isOnline && this.isTranscribing && this.isCloudProvider(this.currentProvider)) {
        this.handleNetworkFailure();
      }
    });
  }

  /**
   * Handle network failure during cloud transcription
   */
  async handleNetworkFailure() {
    if (!this.config.enableFallback) {
      this.notifyListeners('transcriptionError', {
        error: 'Network connection lost and fallback disabled',
        provider: this.currentProvider
      });
      return;
    }

    console.log('Network failure detected, attempting fallback to local STT');
    
    try {
      // Switch to local provider
      const originalProvider = this.currentProvider;
      this.currentProvider = 'local_whisper';
      
      // Initialize local STT if not already done
      if (!this.localSTTService.isInitialized) {
        await this.localSTTService.initialize({
          language: this.config.language
        });
      }
      
      this.notifyListeners('providerFallback', {
        from: originalProvider,
        to: this.currentProvider,
        reason: 'network_failure'
      });
      
    } catch (error) {
      console.error('Fallback to local STT failed:', error);
      this.notifyListeners('fallbackFailed', {
        error: error.message,
        originalProvider: this.currentProvider
      });
    }
  }

  /**
   * Start transcription process
   */
  async startTranscription() {
    if (!this.isInitialized) {
      throw new Error('Transcription engine not initialized');
    }

    if (this.isTranscribing) {
      console.warn('Transcription already active');
      return;
    }

    try {
      this.isTranscribing = true;
      this.transcriptionBuffer = [];
      this.processingQueue = [];
      this.resetMetrics();
      
      console.log('Transcription started');
      this.notifyListeners('transcriptionStarted', {
        provider: this.currentProvider,
        timestamp: Date.now()
      });
      
    } catch (error) {
      this.isTranscribing = false;
      console.error('Failed to start transcription:', error);
      throw new Error(`Failed to start transcription: ${error.message}`);
    }
  }

  /**
   * Stop transcription process
   */
  stopTranscription() {
    if (!this.isTranscribing) {
      console.warn('Transcription not active');
      return;
    }

    this.isTranscribing = false;
    this.isProcessing = false;
    
    // Process any remaining items in queue
    if (this.processingQueue.length > 0) {
      console.log(`Processing ${this.processingQueue.length} remaining items`);
      this.processRemainingQueue();
    }
    
    console.log('Transcription stopped');
    this.notifyListeners('transcriptionStopped', {
      timestamp: Date.now(),
      metrics: this.getMetrics()
    });
  }

  /**
   * Handle audio data from AudioProcessor
   */
  handleAudioData(audioData) {
    if (!this.isTranscribing || !audioData || !audioData.data) {
      return;
    }

    // Add to processing queue
    const queueItem = {
      id: `audio_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      audioData: audioData,
      timestamp: Date.now(),
      retries: 0
    };
    
    this.processingQueue.push(queueItem);
    
    // Start processing if not already processing
    if (!this.isProcessing) {
      this.processTranscriptionQueue();
    }
  }

  /**
   * Process transcription queue
   */
  async processTranscriptionQueue() {
    if (this.isProcessing || this.processingQueue.length === 0) {
      return;
    }

    this.isProcessing = true;
    
    while (this.processingQueue.length > 0 && this.isTranscribing) {
      const queueItem = this.processingQueue.shift();
      
      try {
        await this.processAudioSegment(queueItem);
      } catch (error) {
        console.error('Error processing audio segment:', error);
        await this.handleProcessingError(queueItem, error);
      }
      
      // Small delay to prevent overwhelming the system
      await this.delay(100);
    }
    
    this.isProcessing = false;
  }

  /**
   * Process individual audio segment
   */
  async processAudioSegment(queueItem) {
    const startTime = performance.now();
    
    try {
      console.log(`Processing audio segment: ${queueItem.id} with provider: ${this.currentProvider}`);
      
      // Validate audio quality before transcription
      if (!this.isAudioQualitySufficient(queueItem.audioData)) {
        console.warn('Audio quality insufficient for transcription');
        this.notifyListeners('lowQualityAudio', {
          segmentId: queueItem.id,
          audioData: queueItem.audioData
        });
        return;
      }
      
      // Transcribe using appropriate provider
      let result;
      if (this.isLocalProvider(this.currentProvider)) {
        result = await this.transcribeWithLocal(queueItem.audioData);
      } else {
        result = await this.transcribeWithCloud(queueItem.audioData, this.currentProvider);
      }
      
      const processingTime = performance.now() - startTime;
      
      // Validate transcription result
      if (this.isTranscriptionValid(result)) {
        this.handleTranscriptionResult(result, processingTime, queueItem);
      } else {
        console.warn('Transcription result validation failed');
        this.handleLowConfidenceResult(result, queueItem);
      }
      
    } catch (error) {
      const processingTime = performance.now() - startTime;
      console.error('Transcription processing failed:', error);
      await this.handleTranscriptionFailure(error, processingTime, queueItem);
    }
  }

  /**
   * Transcribe using local STT service
   */
  async transcribeWithLocal(audioData) {
    return await this.localSTTService.transcribe(audioData, {
      language: this.config.language,
      return_timestamps: true
    });
  }

  /**
   * Transcribe using cloud STT service
   */
  async transcribeWithCloud(audioData, provider) {
    const apiKey = this.config.apiKeys[provider];
    if (!apiKey) {
      throw new Error(`API key not configured for provider: ${provider}`);
    }

    const cloudConfig = {
      apiKey: apiKey,
      language: this.config.language,
      ...this.config.cloudConfig[provider]
    };

    return await this.cloudSTTService.transcribe(audioData, provider, cloudConfig);
  }

  /**
   * Handle transcription failure with fallback logic
   */
  async handleTranscriptionFailure(error, processingTime, queueItem) {
    console.error(`Transcription failed with ${this.currentProvider}:`, error);
    
    // Check if we should attempt fallback
    if (this.config.enableFallback && this.shouldAttemptFallback(error, queueItem)) {
      await this.attemptFallback(queueItem, error);
    } else {
      this.handleTranscriptionError(error.message, processingTime, queueItem);
    }
  }

  /**
   * Determine if fallback should be attempted
   */
  shouldAttemptFallback(error, queueItem) {
    // Don't fallback if already retried too many times
    if (queueItem.fallbackAttempts >= 2) {
      return false;
    }

    // Fallback conditions
    const fallbackConditions = [
      error.message.includes('rate limit'),
      error.message.includes('network'),
      error.message.includes('timeout'),
      error.message.includes('API key'),
      !this.cloudSTTService.getNetworkStatus().isOnline
    ];

    return fallbackConditions.some(condition => condition);
  }

  /**
   * Attempt fallback to different provider
   */
  async attemptFallback(queueItem, originalError) {
    queueItem.fallbackAttempts = (queueItem.fallbackAttempts || 0) + 1;
    
    let fallbackProvider;
    
    if (this.isCloudProvider(this.currentProvider)) {
      // Fallback from cloud to local
      fallbackProvider = 'local_whisper';
      
      // Initialize local STT if needed
      if (!this.localSTTService.isInitialized) {
        try {
          await this.localSTTService.initialize({
            language: this.config.language
          });
        } catch (initError) {
          console.error('Failed to initialize local STT for fallback:', initError);
          this.handleTranscriptionError(originalError.message, 0, queueItem);
          return;
        }
      }
    } else {
      // Fallback from local to cloud (if available and configured)
      const availableCloudProviders = ['openai_whisper', 'azure_speech', 'claude_speech']
        .filter(provider => 
          this.config.apiKeys[provider] && 
          this.cloudSTTService.isProviderAvailable(provider)
        );
      
      if (availableCloudProviders.length === 0) {
        this.handleTranscriptionError(originalError.message, 0, queueItem);
        return;
      }
      
      fallbackProvider = availableCloudProviders[0];
    }
    
    console.log(`Attempting fallback from ${this.currentProvider} to ${fallbackProvider}`);
    
    // Temporarily switch provider for this segment
    const originalProvider = this.currentProvider;
    queueItem.fallbackProvider = fallbackProvider;
    
    this.notifyListeners('providerFallback', {
      from: originalProvider,
      to: fallbackProvider,
      reason: 'transcription_failure',
      segmentId: queueItem.id
    });
    
    // Add back to queue with fallback provider
    this.processingQueue.unshift(queueItem);
  }

  /**
   * Handle successful transcription result
   */
  handleTranscriptionResult(result, processingTime, queueItem = null) {
    // Update metrics
    this.updateMetrics(processingTime, true, result.confidence);
    
    // Add to transcription buffer
    const transcriptionEntry = {
      id: queueItem ? queueItem.id : `result_${Date.now()}`,
      text: result.text,
      confidence: result.confidence,
      language: result.language,
      timestamp: result.timestamp,
      segments: result.segments || [],
      processingTime: processingTime,
      provider: 'local'
    };
    
    this.transcriptionBuffer.push(transcriptionEntry);
    this.lastTranscriptionTime = Date.now();
    
    console.log(`Transcription completed: "${result.text}" (confidence: ${result.confidence})`);
    
    // Notify listeners
    this.notifyListeners('transcriptionResult', transcriptionEntry);
    
    // Check if we should send accumulated text
    this.checkForTextOutput();
  }

  /**
   * Handle transcription error
   */
  handleTranscriptionError(errorMessage, processingTime, queueItem = null) {
    this.updateMetrics(processingTime, false, 0);
    
    const errorEntry = {
      id: queueItem ? queueItem.id : `error_${Date.now()}`,
      error: errorMessage,
      timestamp: Date.now(),
      processingTime: processingTime,
      provider: 'local'
    };
    
    console.error('Transcription error:', errorEntry);
    this.notifyListeners('transcriptionError', errorEntry);
    
    // Retry if configured and retries available
    if (queueItem && this.config.enableFallback && queueItem.retries < this.config.maxRetries) {
      this.retryTranscription(queueItem);
    }
  }

  /**
   * Handle low confidence transcription result
   */
  handleLowConfidenceResult(result, queueItem) {
    console.warn(`Low confidence transcription: "${result.text}" (confidence: ${result.confidence})`);
    
    const lowConfidenceEntry = {
      id: queueItem.id,
      text: result.text,
      confidence: result.confidence,
      timestamp: result.timestamp,
      warning: 'low_confidence',
      provider: 'local'
    };
    
    this.notifyListeners('lowConfidenceResult', lowConfidenceEntry);
    
    // Still add to buffer but mark as uncertain
    if (result.text && result.text.length > 0) {
      this.transcriptionBuffer.push({
        ...lowConfidenceEntry,
        uncertain: true
      });
    }
  }

  /**
   * Retry transcription with different parameters
   */
  async retryTranscription(queueItem) {
    queueItem.retries++;
    
    console.log(`Retrying transcription for ${queueItem.id} (attempt ${queueItem.retries})`);
    
    // Add delay before retry
    await this.delay(this.config.retryDelay * queueItem.retries);
    
    // Add back to queue with modified parameters
    this.processingQueue.unshift(queueItem);
  }

  /**
   * Handle processing error
   */
  async handleProcessingError(queueItem, error) {
    console.error(`Processing error for ${queueItem.id}:`, error);
    
    if (queueItem.retries < this.config.maxRetries) {
      await this.retryTranscription(queueItem);
    } else {
      this.handleTranscriptionError(error.message, 0, queueItem);
    }
  }

  /**
   * Check if audio quality is sufficient for transcription
   */
  isAudioQualitySufficient(audioData) {
    // Basic audio validation
    if (!audioData || !audioData.data || audioData.data.length === 0) {
      return false;
    }
    
    // Check for minimum duration (at least 0.5 seconds)
    const minDuration = 0.5;
    if (audioData.duration && audioData.duration < minDuration) {
      return false;
    }
    
    // Check for audio energy (not silent)
    const samples = audioData.data;
    let energy = 0;
    for (let i = 0; i < samples.length; i++) {
      energy += samples[i] * samples[i];
    }
    const rms = Math.sqrt(energy / samples.length);
    
    // Minimum RMS threshold for speech
    const minRMS = 0.001;
    return rms > minRMS;
  }

  /**
   * Validate transcription result
   */
  isTranscriptionValid(result) {
    if (!result || typeof result.text !== 'string') {
      return false;
    }
    
    // Check confidence threshold
    if (result.confidence < this.config.confidenceThreshold) {
      return false;
    }
    
    // Check for minimum text length
    if (result.text.trim().length < 2) {
      return false;
    }
    
    return true;
  }

  /**
   * Check if we should output accumulated text
   */
  checkForTextOutput() {
    const now = Date.now();
    const timeSinceLastOutput = now - this.lastTranscriptionTime;
    const bufferLength = this.transcriptionBuffer.length;
    
    // Output conditions
    const shouldOutput = (
      bufferLength >= 5 || // Enough segments accumulated
      timeSinceLastOutput > 5000 || // 5 seconds since last transcription
      this.getBufferTextLength() > 100 // Enough text accumulated
    );
    
    if (shouldOutput && bufferLength > 0) {
      this.outputAccumulatedText();
    }
  }

  /**
   * Output accumulated transcription text
   */
  outputAccumulatedText() {
    if (this.transcriptionBuffer.length === 0) {
      return;
    }
    
    // Combine text from buffer
    const combinedText = this.transcriptionBuffer
      .filter(entry => entry.text && entry.text.trim().length > 0)
      .map(entry => entry.text.trim())
      .join(' ');
    
    if (combinedText.length === 0) {
      return;
    }
    
    // Calculate average confidence
    const confidenceSum = this.transcriptionBuffer
      .filter(entry => typeof entry.confidence === 'number')
      .reduce((sum, entry) => sum + entry.confidence, 0);
    const averageConfidence = confidenceSum / this.transcriptionBuffer.length;
    
    const output = {
      text: combinedText,
      confidence: averageConfidence,
      segmentCount: this.transcriptionBuffer.length,
      timestamp: Date.now(),
      provider: 'local'
    };
    
    console.log(`Outputting accumulated text: "${combinedText}"`);
    
    // Clear buffer
    this.transcriptionBuffer = [];
    
    // Notify listeners
    this.notifyListeners('textOutput', output);
  }

  /**
   * Get total text length in buffer
   */
  getBufferTextLength() {
    return this.transcriptionBuffer
      .filter(entry => entry.text)
      .reduce((total, entry) => total + entry.text.length, 0);
  }

  /**
   * Process remaining items in queue
   */
  async processRemainingQueue() {
    const remainingItems = [...this.processingQueue];
    this.processingQueue = [];
    
    for (const item of remainingItems) {
      try {
        await this.processAudioSegment(item);
      } catch (error) {
        console.error('Error processing remaining queue item:', error);
      }
    }
    
    // Output any remaining text
    if (this.transcriptionBuffer.length > 0) {
      this.outputAccumulatedText();
    }
  }

  /**
   * Update performance metrics
   */
  updateMetrics(processingTime, success, confidence = 0) {
    this.metrics.totalTranscriptions++;
    this.metrics.totalProcessingTime += processingTime;
    this.metrics.averageProcessingTime = this.metrics.totalProcessingTime / this.metrics.totalTranscriptions;
    
    if (success) {
      this.metrics.successfulTranscriptions++;
      
      // Update average confidence
      const totalConfidence = (this.metrics.averageConfidence * (this.metrics.successfulTranscriptions - 1)) + confidence;
      this.metrics.averageConfidence = totalConfidence / this.metrics.successfulTranscriptions;
    } else {
      this.metrics.failedTranscriptions++;
    }
  }

  /**
   * Reset metrics
   */
  resetMetrics() {
    this.metrics = {
      totalTranscriptions: 0,
      successfulTranscriptions: 0,
      failedTranscriptions: 0,
      averageConfidence: 0,
      averageProcessingTime: 0,
      totalProcessingTime: 0
    };
  }

  /**
   * Get current metrics
   */
  getMetrics() {
    const successRate = this.metrics.totalTranscriptions > 0 
      ? (this.metrics.successfulTranscriptions / this.metrics.totalTranscriptions) * 100 
      : 0;
    
    return {
      ...this.metrics,
      successRate: Math.round(successRate * 100) / 100
    };
  }

  /**
   * Change language
   */
  async changeLanguage(language) {
    console.log(`Changing transcription language to: ${language}`);
    
    this.config.language = language;
    
    if (this.localSTTService) {
      await this.localSTTService.changeLanguage(language);
    }
    
    this.notifyListeners('languageChanged', { language });
  }

  /**
   * Get available languages
   */
  getAvailableLanguages() {
    return this.localSTTService ? this.localSTTService.getAvailableLanguages() : ['en'];
  }

  /**
   * Get current status
   */
  getStatus() {
    return {
      isInitialized: this.isInitialized,
      isTranscribing: this.isTranscribing,
      isProcessing: this.isProcessing,
      currentProvider: this.currentProvider,
      config: { ...this.config },
      queueLength: this.processingQueue.length,
      bufferLength: this.transcriptionBuffer.length,
      metrics: this.getMetrics(),
      localSTTStatus: this.localSTTService ? this.localSTTService.getStatus() : null
    };
  }

  /**
   * Utility function for delays
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
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
    this.stopTranscription();
    
    if (this.localSTTService) {
      this.localSTTService.cleanup();
    }
    
    this.transcriptionBuffer = [];
    this.processingQueue = [];
    this.eventListeners.clear();
    this.isInitialized = false;
    
    console.log('Transcription engine cleaned up');
  }
}

export default TranscriptionEngine;