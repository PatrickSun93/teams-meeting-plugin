// Transcription Engine - Orchestrates STT services and manages transcription workflow
import LocalSTTService from './LocalSTTService.js';
import CloudSTTService from './CloudSTTService.js';
import SpeakerIdentificationService from './SpeakerIdentificationService.js';

class TranscriptionEngine {
  constructor() {
    this.localSTTService = new LocalSTTService();
    this.cloudSTTService = new CloudSTTService();
    this.speakerIdentificationService = new SpeakerIdentificationService();
    this.isInitialized = false;
    this.isTranscribing = false;
    this.isPaused = false;
    this.currentProvider = 'local';
    this.speakerIdentificationEnabled = true;
    
    // Configuration
    this.config = {
      provider: 'local',
      language: 'en',
      enableFallback: true,
      confidenceThreshold: 0.3,
      maxRetries: 3,
      retryDelay: 1000,
      apiKeys: {},
      cloudConfig: {},
      realTimeMode: true,
      bufferSize: 5,
      outputDelay: 2000,
      speakerIdentification: {
        enabled: true,
        confidenceThreshold: 0.6,
        handleOverlappingSpeech: true,
        trackConsistency: true
      }
    };
    
    // Transcription state
    this.transcriptionBuffer = [];
    this.lastTranscriptionTime = 0;
    this.processingQueue = [];
    this.isProcessing = false;
    this.currentSegment = null;
    this.segmentBuffer = '';
    
    // Real-time streaming
    this.streamingBuffer = '';
    this.lastStreamUpdate = 0;
    this.streamingTimer = null;
    
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
    this.updateStreamingText = this.updateStreamingText.bind(this);
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
      
      // Initialize speaker identification if enabled
      if (this.config.speakerIdentification.enabled) {
        await this.speakerIdentificationService.initialize();
        this.setupSpeakerIdentificationListeners();
        console.log('Speaker identification service initialized');
      }
      
      this.isInitialized = true;
      console.log('Transcription engine initialized successfully');
      
      this.notifyListeners('initialized', {
        provider: this.currentProvider,
        config: this.config,
        speakerIdentificationEnabled: this.config.speakerIdentification.enabled
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
   * Set up event listeners for speaker identification service
   */
  setupSpeakerIdentificationListeners() {
    this.speakerIdentificationService.addEventListener('speakerIdentified', (data) => {
      this.notifyListeners('speakerIdentified', data);
    });
    
    this.speakerIdentificationService.addEventListener('speakerChanged', (data) => {
      this.notifyListeners('speakerChanged', data);
    });
    
    this.speakerIdentificationService.addEventListener('newSpeakerDetected', (data) => {
      this.notifyListeners('newSpeakerDetected', data);
    });
    
    this.speakerIdentificationService.addEventListener('speakerEnrolled', (data) => {
      this.notifyListeners('speakerEnrolled', data);
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
      this.isPaused = false;
      this.transcriptionBuffer = [];
      this.processingQueue = [];
      this.currentSegment = null;
      this.segmentBuffer = '';
      this.streamingBuffer = '';
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
   * Pause transcription process
   */
  pauseTranscription() {
    if (!this.isTranscribing) {
      console.warn('Transcription not active');
      return;
    }

    this.isPaused = true;
    
    // Clear streaming timer
    if (this.streamingTimer) {
      clearTimeout(this.streamingTimer);
      this.streamingTimer = null;
    }
    
    console.log('Transcription paused');
    this.notifyListeners('transcriptionPaused', {
      timestamp: Date.now()
    });
  }

  /**
   * Resume transcription process
   */
  resumeTranscription() {
    if (!this.isTranscribing) {
      console.warn('Transcription not active');
      return;
    }

    this.isPaused = false;
    
    // Resume processing queue if needed
    if (!this.isProcessing && this.processingQueue.length > 0) {
      this.processTranscriptionQueue();
    }
    
    console.log('Transcription resumed');
    this.notifyListeners('transcriptionResumed', {
      timestamp: Date.now()
    });
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
    if (!this.isTranscribing || this.isPaused || !audioData || !audioData.data) {
      return;
    }

    // Add to processing queue
    const queueItem = {
      id: `audio_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
      audioData: audioData,
      timestamp: Date.now(),
      retries: 0
    };
    
    this.processingQueue.push(queueItem);
    
    // Notify processing status change
    this.notifyListeners('processingStatusChanged', {
      isProcessing: this.isProcessing,
      queueLength: this.processingQueue.length
    });
    
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
    
    // Notify processing started
    this.notifyListeners('processingStatusChanged', {
      isProcessing: true,
      queueLength: this.processingQueue.length
    });
    
    while (this.processingQueue.length > 0 && this.isTranscribing && !this.isPaused) {
      const queueItem = this.processingQueue.shift();
      
      try {
        await this.processAudioSegment(queueItem);
      } catch (error) {
        console.error('Error processing audio segment:', error);
        await this.handleProcessingError(queueItem, error);
      }
      
      // Update processing status
      this.notifyListeners('processingStatusChanged', {
        isProcessing: true,
        queueLength: this.processingQueue.length
      });
      
      // Small delay to prevent overwhelming the system
      await this.delay(100);
    }
    
    this.isProcessing = false;
    
    // Notify processing completed
    this.notifyListeners('processingStatusChanged', {
      isProcessing: false,
      queueLength: this.processingQueue.length
    });
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
      
      // Perform speaker identification if enabled
      let speakerInfo = null;
      if (this.config.speakerIdentification.enabled && this.speakerIdentificationService.isInitialized) {
        try {
          speakerInfo = await this.speakerIdentificationService.identifySpeaker(queueItem.audioData);
          console.log(`Speaker identified: ${speakerInfo.speakerId} (confidence: ${speakerInfo.confidence})`);
        } catch (error) {
          console.warn('Speaker identification failed:', error);
          speakerInfo = {
            speakerId: 'unknown',
            confidence: 0,
            isNewSpeaker: false,
            reason: 'identification_error'
          };
        }
      }
      
      // Determine which provider to use (check for fallback)
      const providerToUse = queueItem.fallbackProvider || this.currentProvider;
      
      // Transcribe using appropriate provider
      let result;
      if (this.isLocalProvider(providerToUse)) {
        result = await this.transcribeWithLocal(queueItem.audioData);
      } else {
        result = await this.transcribeWithCloud(queueItem.audioData, providerToUse);
      }
      
      // Add speaker information to transcription result
      if (speakerInfo) {
        result.speaker = speakerInfo;
      }
      
      // Clear fallback provider after successful transcription
      if (queueItem.fallbackProvider) {
        delete queueItem.fallbackProvider;
        delete queueItem.fallbackAttempts;
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
    
    // Create transcription entry
    const transcriptionEntry = {
      id: result.id || (queueItem ? queueItem.id : `result_${Date.now()}`),
      text: result.text,
      confidence: result.confidence,
      language: result.language,
      timestamp: result.timestamp || Date.now(),
      segments: result.segments || [],
      processingTime: processingTime,
      provider: result.provider || this.currentProvider,
      speaker: result.speaker || null
    };
    
    // Add speaker label to text if speaker identification is available
    if (transcriptionEntry.speaker && transcriptionEntry.speaker.speakerId !== 'unknown') {
      const speakerLabel = this.formatSpeakerLabel(transcriptionEntry.speaker);
      transcriptionEntry.labeledText = `${speakerLabel}: ${transcriptionEntry.text}`;
    } else {
      transcriptionEntry.labeledText = transcriptionEntry.text;
    }
    
    // Handle real-time mode
    if (this.config.realTimeMode) {
      this.handleRealTimeResult(transcriptionEntry);
    } else {
      // Traditional buffered mode
      this.transcriptionBuffer.push(transcriptionEntry);
      this.lastTranscriptionTime = Date.now();
      
      // Notify listeners
      this.notifyListeners('transcriptionResult', transcriptionEntry);
      
      // Check if we should send accumulated text
      this.checkForTextOutput();
    }
    
    console.log(`Transcription completed: "${result.text}" (confidence: ${result.confidence})`);
  }

  /**
   * Handle real-time transcription result
   */
  handleRealTimeResult(transcriptionEntry) {
    // Add to buffer immediately for history/editing functionality
    this.transcriptionBuffer.push(transcriptionEntry);
    this.lastTranscriptionTime = Date.now();
    
    // Update streaming buffer for real-time display
    this.streamingBuffer += (this.streamingBuffer ? ' ' : '') + transcriptionEntry.text;
    this.lastStreamUpdate = Date.now();
    
    // Send partial result for real-time display
    this.notifyListeners('partialResult', {
      text: this.streamingBuffer,
      confidence: transcriptionEntry.confidence,
      timestamp: transcriptionEntry.timestamp,
      isPartial: true
    });
    
    // Also send the final result immediately
    this.notifyListeners('transcriptionResult', transcriptionEntry);
    
    // Set timer to finalize segment (for streaming display)
    if (this.streamingTimer) {
      clearTimeout(this.streamingTimer);
    }
    
    this.streamingTimer = setTimeout(() => {
      this.finalizeStreamingSegment();
    }, this.config.outputDelay);
  }

  /**
   * Finalize streaming segment
   */
  finalizeStreamingSegment() {
    if (!this.streamingBuffer) return;
    
    const finalSegment = {
      id: `segment_${Date.now()}`,
      text: this.streamingBuffer.trim(),
      confidence: this.calculateAverageConfidence(),
      timestamp: Date.now(),
      provider: this.currentProvider,
      isFinal: true
    };
    
    // Add to buffer and notify
    this.transcriptionBuffer.push(finalSegment);
    this.notifyListeners('transcriptionResult', finalSegment);
    
    // Clear streaming buffer
    this.streamingBuffer = '';
    this.streamingTimer = null;
    
    console.log(`Finalized segment: "${finalSegment.text}"`);
  }

  /**
   * Calculate average confidence from recent results
   */
  calculateAverageConfidence() {
    const recentResults = this.transcriptionBuffer.slice(-3);
    if (recentResults.length === 0) return 0.5;
    
    const totalConfidence = recentResults.reduce((sum, result) => sum + (result.confidence || 0), 0);
    return totalConfidence / recentResults.length;
  }

  /**
   * Update streaming text display
   */
  updateStreamingText(text, confidence = 0.5) {
    this.notifyListeners('partialResult', {
      text: text,
      confidence: confidence,
      timestamp: Date.now(),
      isPartial: true
    });
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
   * Change STT provider
   */
  async changeProvider(provider, config = {}) {
    console.log(`Changing STT provider to: ${provider}`);
    
    if (!this.isProviderSupported(provider)) {
      throw new Error(`Unsupported provider: ${provider}`);
    }
    
    // Validate cloud provider configuration
    if (this.isCloudProvider(provider)) {
      if (!config.apiKey && !this.config.apiKeys[provider]) {
        throw new Error(`API key required for provider: ${provider}`);
      }
      
      // Check network connectivity
      if (!this.cloudSTTService.getNetworkStatus().isOnline) {
        throw new Error('No internet connection available for cloud provider');
      }
    }
    
    const oldProvider = this.currentProvider;
    this.currentProvider = provider;
    
    // Update configuration
    if (config.apiKey) {
      this.config.apiKeys[provider] = config.apiKey;
    }
    
    if (config.cloudConfig) {
      this.config.cloudConfig[provider] = { ...this.config.cloudConfig[provider], ...config.cloudConfig };
    }
    
    // Initialize new provider if needed
    if (this.isLocalProvider(provider) && !this.localSTTService.isInitialized) {
      await this.localSTTService.initialize({
        language: this.config.language
      });
    }
    
    this.notifyListeners('providerChanged', { 
      from: oldProvider, 
      to: provider,
      config: this.getProviderConfig(provider)
    });
  }

  /**
   * Change language
   */
  async changeLanguage(language) {
    console.log(`Changing transcription language to: ${language}`);
    
    this.config.language = language;
    
    if (this.localSTTService && this.isLocalProvider(this.currentProvider)) {
      await this.localSTTService.changeLanguage(language);
    }
    
    this.notifyListeners('languageChanged', { language });
  }

  /**
   * Update API key for provider
   */
  updateApiKey(provider, apiKey) {
    if (!this.isCloudProvider(provider)) {
      throw new Error(`Provider ${provider} does not require an API key`);
    }
    
    this.config.apiKeys[provider] = apiKey;
    
    this.notifyListeners('apiKeyUpdated', { provider });
  }

  /**
   * Check if provider is supported
   */
  isProviderSupported(provider) {
    const supportedProviders = [
      'local_whisper',
      'openai_whisper', 
      'azure_speech', 
      'claude_speech'
    ];
    return supportedProviders.includes(provider);
  }

  /**
   * Check if provider is local
   */
  isLocalProvider(provider) {
    return provider === 'local_whisper' || provider === 'local';
  }

  /**
   * Check if provider is cloud-based
   */
  isCloudProvider(provider) {
    return ['openai_whisper', 'azure_speech', 'claude_speech'].includes(provider);
  }

  /**
   * Get provider configuration
   */
  getProviderConfig(provider) {
    const config = {
      provider: provider,
      isLocal: this.isLocalProvider(provider),
      isCloud: this.isCloudProvider(provider),
      requiresApiKey: this.isCloudProvider(provider),
      hasApiKey: this.isCloudProvider(provider) ? !!this.config.apiKeys[provider] : true
    };
    
    if (this.isCloudProvider(provider)) {
      config.isAvailable = this.cloudSTTService.isProviderAvailable(provider);
      config.rateLimit = this.cloudSTTService.getRateLimitStatus(provider);
    } else {
      config.isAvailable = true;
    }
    
    return config;
  }

  /**
   * Get all available providers
   */
  getAvailableProviders() {
    const providers = [];
    
    // Local provider
    providers.push({
      id: 'local_whisper',
      name: 'Local Whisper',
      type: 'local',
      isAvailable: true,
      requiresApiKey: false,
      isCurrent: this.currentProvider === 'local_whisper'
    });
    
    // Cloud providers
    const cloudProviders = this.cloudSTTService.getAvailableProviders();
    cloudProviders.forEach(provider => {
      providers.push({
        ...provider,
        type: 'cloud',
        requiresApiKey: true,
        hasApiKey: !!this.config.apiKeys[provider.id],
        isCurrent: this.currentProvider === provider.id
      });
    });
    
    return providers;
  }

  /**
   * Get available languages
   */
  getAvailableLanguages() {
    return this.localSTTService ? this.localSTTService.getAvailableLanguages() : ['en'];
  }

  /**
   * Get transcription history
   */
  getTranscriptionHistory() {
    return this.transcriptionBuffer.map(segment => ({
      id: segment.id,
      text: segment.text,
      confidence: segment.confidence,
      timestamp: segment.timestamp,
      provider: segment.provider,
      isEdited: segment.isEdited || false
    }));
  }

  /**
   * Get full transcript text
   */
  getFullTranscript() {
    return this.transcriptionBuffer
      .filter(segment => segment.text && !segment.isError)
      .map(segment => segment.text)
      .join(' ');
  }

  /**
   * Clear transcription buffer
   */
  clearTranscriptionBuffer() {
    const clearedSegments = [...this.transcriptionBuffer];
    this.transcriptionBuffer = [];
    this.streamingBuffer = '';
    
    if (this.streamingTimer) {
      clearTimeout(this.streamingTimer);
      this.streamingTimer = null;
    }
    
    this.notifyListeners('transcriptionCleared', {
      clearedSegments: clearedSegments,
      timestamp: Date.now()
    });
    
    console.log('Transcription buffer cleared');
  }

  /**
   * Edit transcription segment
   */
  editTranscriptionSegment(segmentId, newText) {
    const segmentIndex = this.transcriptionBuffer.findIndex(segment => segment.id === segmentId);
    
    if (segmentIndex === -1) {
      throw new Error(`Segment with id ${segmentId} not found`);
    }
    
    const originalText = this.transcriptionBuffer[segmentIndex].text;
    this.transcriptionBuffer[segmentIndex].text = newText;
    this.transcriptionBuffer[segmentIndex].isEdited = true;
    this.transcriptionBuffer[segmentIndex].editedAt = Date.now();
    
    this.notifyListeners('segmentEdited', {
      segmentId: segmentId,
      originalText: originalText,
      newText: newText,
      timestamp: Date.now()
    });
    
    console.log(`Segment ${segmentId} edited: "${originalText}" -> "${newText}"`);
  }

  /**
   * Delete transcription segment
   */
  deleteTranscriptionSegment(segmentId) {
    const segmentIndex = this.transcriptionBuffer.findIndex(segment => segment.id === segmentId);
    
    if (segmentIndex === -1) {
      throw new Error(`Segment with id ${segmentId} not found`);
    }
    
    const deletedSegment = this.transcriptionBuffer.splice(segmentIndex, 1)[0];
    
    this.notifyListeners('segmentDeleted', {
      segmentId: segmentId,
      deletedSegment: deletedSegment,
      timestamp: Date.now()
    });
    
    console.log(`Segment ${segmentId} deleted: "${deletedSegment.text}"`);
  }

  /**
   * Export transcription in various formats
   */
  exportTranscription(format = 'text') {
    const segments = this.transcriptionBuffer.filter(segment => !segment.isError);
    
    switch (format) {
      case 'text':
        return segments.map(segment => segment.text).join(' ');
      
      case 'json':
        return JSON.stringify(segments, null, 2);
      
      case 'srt':
        return this.generateSRTFormat(segments);
      
      case 'vtt':
        return this.generateVTTFormat(segments);
      
      default:
        throw new Error(`Unsupported export format: ${format}`);
    }
  }

  /**
   * Generate SRT subtitle format
   */
  generateSRTFormat(segments) {
    let srt = '';
    let counter = 1;
    
    segments.forEach((segment, index) => {
      const startTime = new Date(segment.timestamp);
      const endTime = index < segments.length - 1 
        ? new Date(segments[index + 1].timestamp)
        : new Date(segment.timestamp + 3000); // Default 3 second duration
      
      srt += `${counter}\n`;
      srt += `${this.formatSRTTime(startTime)} --> ${this.formatSRTTime(endTime)}\n`;
      srt += `${segment.text}\n\n`;
      counter++;
    });
    
    return srt;
  }

  /**
   * Generate WebVTT format
   */
  generateVTTFormat(segments) {
    let vtt = 'WEBVTT\n\n';
    
    segments.forEach((segment, index) => {
      const startTime = new Date(segment.timestamp);
      const endTime = index < segments.length - 1 
        ? new Date(segments[index + 1].timestamp)
        : new Date(segment.timestamp + 3000);
      
      vtt += `${this.formatVTTTime(startTime)} --> ${this.formatVTTTime(endTime)}\n`;
      vtt += `${segment.text}\n\n`;
    });
    
    return vtt;
  }

  /**
   * Format time for SRT
   */
  formatSRTTime(date) {
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    const milliseconds = String(date.getMilliseconds()).padStart(3, '0');
    return `${hours}:${minutes}:${seconds},${milliseconds}`;
  }

  /**
   * Format time for WebVTT
   */
  formatVTTTime(date) {
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    const milliseconds = String(date.getMilliseconds()).padStart(3, '0');
    return `${hours}:${minutes}:${seconds}.${milliseconds}`;
  }

  /**
   * Format speaker label for display
   */
  formatSpeakerLabel(speakerInfo) {
    if (!speakerInfo || speakerInfo.speakerId === 'unknown') {
      return 'Unknown Speaker';
    }
    
    // Get speaker profile to check for custom name
    const profile = this.speakerIdentificationService.getSpeakerProfile(speakerInfo.speakerId);
    const displayName = profile && profile.name !== profile.id ? profile.name : speakerInfo.speakerId;
    
    // Add confidence indicator for low confidence identifications
    if (speakerInfo.confidence < this.config.speakerIdentification.confidenceThreshold) {
      return `${displayName}?`;
    }
    
    return displayName;
  }

  /**
   * Handle overlapping speech detection
   */
  handleOverlappingSpeech(audioData, currentSpeaker) {
    // Simple implementation - could be enhanced with more sophisticated detection
    if (!this.config.speakerIdentification.handleOverlappingSpeech) {
      return currentSpeaker;
    }
    
    // Check if audio energy suggests multiple speakers
    const samples = audioData.data;
    const windowSize = Math.floor(samples.length / 4);
    const energyWindows = [];
    
    for (let i = 0; i < 4; i++) {
      const start = i * windowSize;
      const end = Math.min(start + windowSize, samples.length);
      let energy = 0;
      
      for (let j = start; j < end; j++) {
        energy += samples[j] * samples[j];
      }
      
      energyWindows.push(Math.sqrt(energy / (end - start)));
    }
    
    // Check for significant energy variations that might indicate overlapping speech
    const maxEnergy = Math.max(...energyWindows);
    const minEnergy = Math.min(...energyWindows);
    const energyVariation = maxEnergy > 0 ? (maxEnergy - minEnergy) / maxEnergy : 0;
    
    if (energyVariation > 0.5) {
      return {
        ...currentSpeaker,
        speakerId: 'Multiple Speakers',
        confidence: Math.max(0.3, currentSpeaker.confidence * 0.7),
        overlappingSpeech: true
      };
    }
    
    return currentSpeaker;
  }

  /**
   * Enable/disable speaker identification
   */
  setSpeakerIdentificationEnabled(enabled) {
    this.config.speakerIdentification.enabled = enabled;
    
    if (enabled && !this.speakerIdentificationService.isInitialized) {
      this.speakerIdentificationService.initialize().then(() => {
        this.setupSpeakerIdentificationListeners();
        console.log('Speaker identification enabled and initialized');
      }).catch(error => {
        console.error('Failed to initialize speaker identification:', error);
      });
    }
    
    this.notifyListeners('speakerIdentificationToggled', { enabled });
  }

  /**
   * Get speaker identification service
   */
  getSpeakerIdentificationService() {
    return this.speakerIdentificationService;
  }

  /**
   * Get speaker statistics
   */
  getSpeakerStatistics() {
    if (!this.speakerIdentificationService.isInitialized) {
      return null;
    }
    
    const profiles = this.speakerIdentificationService.getAllSpeakerProfiles();
    const status = this.speakerIdentificationService.getStatus();
    
    // Analyze transcription buffer for speaker distribution
    const speakerCounts = new Map();
    const speakerDurations = new Map();
    
    for (const entry of this.transcriptionBuffer) {
      if (entry.speaker && entry.speaker.speakerId !== 'unknown') {
        const speakerId = entry.speaker.speakerId;
        speakerCounts.set(speakerId, (speakerCounts.get(speakerId) || 0) + 1);
        
        // Estimate duration based on text length (rough approximation)
        const estimatedDuration = entry.text.length * 50; // ~50ms per character
        speakerDurations.set(speakerId, (speakerDurations.get(speakerId) || 0) + estimatedDuration);
      }
    }
    
    return {
      totalSpeakers: profiles.length,
      unknownSpeakers: status.unknownSpeakerCount,
      currentSpeaker: status.currentSpeaker,
      speakerDistribution: Object.fromEntries(speakerCounts),
      speakerDurations: Object.fromEntries(speakerDurations),
      profiles: profiles.map(p => ({
        id: p.id,
        name: p.name,
        sampleCount: p.sampleCount,
        enrollmentDate: p.enrollmentDate
      }))
    };
  }

  /**
   * Get current status
   */
  getStatus() {
    return {
      isInitialized: this.isInitialized,
      isTranscribing: this.isTranscribing,
      isPaused: this.isPaused,
      isProcessing: this.isProcessing,
      currentProvider: this.currentProvider,
      providerConfig: this.getProviderConfig(this.currentProvider),
      config: { 
        ...this.config,
        apiKeys: Object.keys(this.config.apiKeys) // Don't expose actual keys
      },
      queueLength: this.processingQueue.length,
      bufferLength: this.transcriptionBuffer.length,
      streamingBuffer: this.streamingBuffer,
      hasStreamingTimer: !!this.streamingTimer,
      metrics: this.getMetrics(),
      networkStatus: this.cloudSTTService.getNetworkStatus(),
      availableProviders: this.getAvailableProviders(),
      localSTTStatus: this.localSTTService ? this.localSTTService.getStatus() : null,
      speakerIdentification: {
        enabled: this.config.speakerIdentification.enabled,
        initialized: this.speakerIdentificationService.isInitialized,
        status: this.speakerIdentificationService.isInitialized ? this.speakerIdentificationService.getStatus() : null,
        statistics: this.getSpeakerStatistics()
      }
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
    
    // Clear streaming timer
    if (this.streamingTimer) {
      clearTimeout(this.streamingTimer);
      this.streamingTimer = null;
    }
    
    if (this.localSTTService) {
      this.localSTTService.cleanup();
    }
    
    if (this.cloudSTTService) {
      this.cloudSTTService.cleanup();
    }
    
    this.transcriptionBuffer = [];
    this.processingQueue = [];
    this.streamingBuffer = '';
    this.currentSegment = null;
    this.segmentBuffer = '';
    this.eventListeners.clear();
    this.isInitialized = false;
    this.isPaused = false;
    
    console.log('Transcription engine cleaned up');
  }
}

export default TranscriptionEngine;