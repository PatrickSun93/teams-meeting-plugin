// Cloud STT Service - Handles cloud-based speech-to-text services
import axios from 'axios';

class CloudSTTService {
  constructor() {
    this.providers = new Map();
    this.rateLimiters = new Map();
    this.networkChecker = null;
    this.isOnline = navigator.onLine;
    
    // Initialize providers
    this.initializeProviders();
    
    // Set up network monitoring
    this.setupNetworkMonitoring();
    
    // Event listeners
    this.eventListeners = new Map();
  }

  /**
   * Initialize all cloud STT providers
   */
  initializeProviders() {
    // OpenAI Whisper API
    this.providers.set('openai_whisper', {
      name: 'OpenAI Whisper API',
      endpoint: 'https://api.openai.com/v1/audio/transcriptions',
      maxFileSize: 25 * 1024 * 1024, // 25MB
      supportedFormats: ['mp3', 'mp4', 'mpeg', 'mpga', 'm4a', 'wav', 'webm'],
      rateLimit: { requests: 50, window: 60000 }, // 50 requests per minute
      timeout: 30000
    });

    // Azure Speech Services
    this.providers.set('azure_speech', {
      name: 'Azure Speech Services',
      endpoint: 'https://{region}.stt.speech.microsoft.com/speech/recognition/conversation/cognitiveservices/v1',
      maxFileSize: 100 * 1024 * 1024, // 100MB
      supportedFormats: ['wav', 'ogg', 'flac', 'mp3'],
      rateLimit: { requests: 20, window: 60000 }, // 20 requests per minute (varies by tier)
      timeout: 30000
    });

    // Claude Speech (Anthropic) - Note: This is hypothetical as Claude doesn't have speech API yet
    this.providers.set('claude_speech', {
      name: 'Claude Speech (Anthropic)',
      endpoint: 'https://api.anthropic.com/v1/speech/transcribe',
      maxFileSize: 50 * 1024 * 1024, // 50MB
      supportedFormats: ['wav', 'mp3', 'flac'],
      rateLimit: { requests: 30, window: 60000 }, // 30 requests per minute
      timeout: 30000
    });

    // Initialize rate limiters for each provider
    this.providers.forEach((config, providerId) => {
      this.rateLimiters.set(providerId, {
        requests: [],
        limit: config.rateLimit.requests,
        window: config.rateLimit.window
      });
    });
  }

  /**
   * Set up network connectivity monitoring
   */
  setupNetworkMonitoring() {
    // Listen for online/offline events
    window.addEventListener('online', () => {
      this.isOnline = true;
      this.notifyListeners('networkStatusChanged', { isOnline: true });
    });

    window.addEventListener('offline', () => {
      this.isOnline = false;
      this.notifyListeners('networkStatusChanged', { isOnline: false });
    });

    // Periodic connectivity check
    this.networkChecker = setInterval(() => {
      this.checkNetworkConnectivity();
    }, 30000); // Check every 30 seconds
  }

  /**
   * Check network connectivity with actual request
   */
  async checkNetworkConnectivity() {
    try {
      const response = await fetch('https://httpbin.org/get', {
        method: 'GET',
        mode: 'no-cors',
        cache: 'no-cache',
        timeout: 5000
      });
      
      const wasOnline = this.isOnline;
      this.isOnline = true;
      
      if (!wasOnline) {
        this.notifyListeners('networkStatusChanged', { isOnline: true });
      }
    } catch (error) {
      const wasOnline = this.isOnline;
      this.isOnline = false;
      
      if (wasOnline) {
        this.notifyListeners('networkStatusChanged', { isOnline: false });
      }
    }
  }

  /**
   * Transcribe audio using specified cloud provider
   */
  async transcribe(audioData, provider, config = {}) {
    if (!this.isOnline) {
      throw new Error('No internet connection available for cloud transcription');
    }

    if (!this.providers.has(provider)) {
      throw new Error(`Unsupported provider: ${provider}`);
    }

    // Check rate limits
    if (!this.checkRateLimit(provider)) {
      throw new Error(`Rate limit exceeded for provider: ${provider}`);
    }

    const providerConfig = this.providers.get(provider);
    
    try {
      // Record request for rate limiting
      this.recordRequest(provider);
      
      // Validate audio data
      this.validateAudioData(audioData, providerConfig);
      
      // Convert audio to appropriate format
      const audioBlob = await this.prepareAudioForProvider(audioData, provider);
      
      // Perform transcription based on provider
      let result;
      switch (provider) {
        case 'openai_whisper':
          result = await this.transcribeWithOpenAI(audioBlob, config);
          break;
        case 'azure_speech':
          result = await this.transcribeWithAzure(audioBlob, config);
          break;
        case 'claude_speech':
          result = await this.transcribeWithClaude(audioBlob, config);
          break;
        default:
          throw new Error(`Provider ${provider} not implemented`);
      }
      
      // Standardize result format
      return this.standardizeResult(result, provider);
      
    } catch (error) {
      console.error(`Transcription failed with ${provider}:`, error);
      throw new Error(`${provider} transcription failed: ${error.message}`);
    }
  }

  /**
   * Transcribe using OpenAI Whisper API
   */
  async transcribeWithOpenAI(audioBlob, config) {
    const apiKey = config.apiKey;
    if (!apiKey) {
      throw new Error('OpenAI API key is required');
    }

    const formData = new FormData();
    formData.append('file', audioBlob, 'audio.wav');
    formData.append('model', config.model || 'whisper-1');
    
    if (config.language) {
      formData.append('language', config.language);
    }
    
    if (config.prompt) {
      formData.append('prompt', config.prompt);
    }
    
    formData.append('response_format', 'verbose_json');
    formData.append('timestamp_granularities[]', 'segment');

    const response = await axios.post(
      'https://api.openai.com/v1/audio/transcriptions',
      formData,
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'multipart/form-data'
        },
        timeout: this.providers.get('openai_whisper').timeout
      }
    );

    return response.data;
  }

  /**
   * Transcribe using Azure Speech Services
   */
  async transcribeWithAzure(audioBlob, config) {
    const apiKey = config.apiKey;
    const region = config.region || 'eastus';
    
    if (!apiKey) {
      throw new Error('Azure Speech Services API key is required');
    }

    const endpoint = `https://${region}.stt.speech.microsoft.com/speech/recognition/conversation/cognitiveservices/v1`;
    
    const params = new URLSearchParams({
      language: config.language || 'en-US',
      format: 'detailed',
      profanity: 'masked'
    });

    const response = await axios.post(
      `${endpoint}?${params}`,
      audioBlob,
      {
        headers: {
          'Ocp-Apim-Subscription-Key': apiKey,
          'Content-Type': 'audio/wav',
          'Accept': 'application/json'
        },
        timeout: this.providers.get('azure_speech').timeout
      }
    );

    return response.data;
  }

  /**
   * Transcribe using Claude Speech (hypothetical implementation)
   */
  async transcribeWithClaude(audioBlob, config) {
    const apiKey = config.apiKey;
    if (!apiKey) {
      throw new Error('Claude API key is required');
    }

    // Note: This is a hypothetical implementation as Claude doesn't have speech API yet
    const formData = new FormData();
    formData.append('audio', audioBlob, 'audio.wav');
    formData.append('language', config.language || 'en');
    formData.append('model', config.model || 'claude-speech-1');

    const response = await axios.post(
      'https://api.anthropic.com/v1/speech/transcribe',
      formData,
      {
        headers: {
          'x-api-key': apiKey,
          'Content-Type': 'multipart/form-data',
          'anthropic-version': '2023-06-01'
        },
        timeout: this.providers.get('claude_speech').timeout
      }
    );

    return response.data;
  }

  /**
   * Validate audio data for provider requirements
   */
  validateAudioData(audioData, providerConfig) {
    if (!audioData || !audioData.data) {
      throw new Error('Invalid audio data');
    }

    // Check file size (estimate based on sample rate and duration)
    const estimatedSize = audioData.data.length * 2; // 16-bit samples
    if (estimatedSize > providerConfig.maxFileSize) {
      throw new Error(`Audio file too large. Maximum size: ${providerConfig.maxFileSize / (1024 * 1024)}MB`);
    }

    // Check duration (most services have limits)
    if (audioData.duration && audioData.duration > 600) { // 10 minutes
      throw new Error('Audio duration too long. Maximum: 10 minutes');
    }
  }

  /**
   * Prepare audio data for specific provider
   */
  async prepareAudioForProvider(audioData, provider) {
    // Convert Float32Array to WAV blob
    const wavBlob = this.audioDataToWav(audioData);
    
    // Provider-specific format conversion if needed
    switch (provider) {
      case 'openai_whisper':
        // OpenAI accepts various formats, WAV is fine
        return wavBlob;
      case 'azure_speech':
        // Azure prefers WAV format
        return wavBlob;
      case 'claude_speech':
        // Claude (hypothetical) accepts WAV
        return wavBlob;
      default:
        return wavBlob;
    }
  }

  /**
   * Convert audio data to WAV blob
   */
  audioDataToWav(audioData) {
    const sampleRate = audioData.sampleRate || 16000;
    const samples = audioData.data;
    const length = samples.length;
    
    // Create WAV file buffer
    const buffer = new ArrayBuffer(44 + length * 2);
    const view = new DataView(buffer);
    
    // WAV header
    const writeString = (offset, string) => {
      for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
      }
    };
    
    writeString(0, 'RIFF');
    view.setUint32(4, 36 + length * 2, true);
    writeString(8, 'WAVE');
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    writeString(36, 'data');
    view.setUint32(40, length * 2, true);
    
    // Convert float samples to 16-bit PCM
    let offset = 44;
    for (let i = 0; i < length; i++) {
      const sample = Math.max(-1, Math.min(1, samples[i]));
      view.setInt16(offset, sample * 0x7FFF, true);
      offset += 2;
    }
    
    return new Blob([buffer], { type: 'audio/wav' });
  }

  /**
   * Standardize transcription result format across providers
   */
  standardizeResult(result, provider) {
    let standardized = {
      text: '',
      confidence: 0,
      language: 'en',
      segments: [],
      provider: provider,
      timestamp: Date.now()
    };

    switch (provider) {
      case 'openai_whisper':
        standardized.text = result.text || '';
        standardized.language = result.language || 'en';
        standardized.confidence = 0.9; // OpenAI doesn't provide confidence scores
        
        if (result.segments) {
          standardized.segments = result.segments.map(segment => ({
            text: segment.text,
            start: segment.start,
            end: segment.end,
            confidence: 0.9
          }));
        }
        break;

      case 'azure_speech':
        if (result.RecognitionStatus === 'Success') {
          standardized.text = result.DisplayText || '';
          standardized.confidence = result.Confidence || 0;
          
          if (result.NBest && result.NBest.length > 0) {
            const best = result.NBest[0];
            standardized.text = best.Display || standardized.text;
            standardized.confidence = best.Confidence || standardized.confidence;
            
            if (best.Words) {
              standardized.segments = best.Words.map(word => ({
                text: word.Word,
                start: word.Offset / 10000000, // Convert from 100ns units to seconds
                end: (word.Offset + word.Duration) / 10000000,
                confidence: word.Confidence || 0
              }));
            }
          }
        } else {
          throw new Error(`Azure transcription failed: ${result.RecognitionStatus}`);
        }
        break;

      case 'claude_speech':
        // Hypothetical Claude response format
        standardized.text = result.transcript || '';
        standardized.confidence = result.confidence || 0;
        standardized.language = result.language || 'en';
        
        if (result.segments) {
          standardized.segments = result.segments.map(segment => ({
            text: segment.text,
            start: segment.start_time,
            end: segment.end_time,
            confidence: segment.confidence
          }));
        }
        break;
    }

    return standardized;
  }

  /**
   * Check rate limit for provider
   */
  checkRateLimit(provider) {
    const rateLimiter = this.rateLimiters.get(provider);
    if (!rateLimiter) return true;

    const now = Date.now();
    const windowStart = now - rateLimiter.window;
    
    // Remove old requests outside the window
    rateLimiter.requests = rateLimiter.requests.filter(time => time > windowStart);
    
    // Check if we're under the limit
    return rateLimiter.requests.length < rateLimiter.limit;
  }

  /**
   * Record a request for rate limiting
   */
  recordRequest(provider) {
    const rateLimiter = this.rateLimiters.get(provider);
    if (rateLimiter) {
      rateLimiter.requests.push(Date.now());
    }
  }

  /**
   * Get rate limit status for provider
   */
  getRateLimitStatus(provider) {
    const rateLimiter = this.rateLimiters.get(provider);
    if (!rateLimiter) return null;

    const now = Date.now();
    const windowStart = now - rateLimiter.window;
    const recentRequests = rateLimiter.requests.filter(time => time > windowStart);
    
    return {
      requests: recentRequests.length,
      limit: rateLimiter.limit,
      windowMs: rateLimiter.window,
      resetTime: recentRequests.length > 0 ? Math.max(...recentRequests) + rateLimiter.window : now
    };
  }

  /**
   * Get available providers
   */
  getAvailableProviders() {
    return Array.from(this.providers.entries()).map(([id, config]) => ({
      id,
      name: config.name,
      isOnline: this.isOnline,
      rateLimit: this.getRateLimitStatus(id)
    }));
  }

  /**
   * Check if provider is available
   */
  isProviderAvailable(provider) {
    return this.isOnline && this.providers.has(provider) && this.checkRateLimit(provider);
  }

  /**
   * Get network status
   */
  getNetworkStatus() {
    return {
      isOnline: this.isOnline,
      lastCheck: Date.now()
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
    if (this.networkChecker) {
      clearInterval(this.networkChecker);
      this.networkChecker = null;
    }
    
    this.eventListeners.clear();
    this.rateLimiters.clear();
    
    // Note: Event listeners are added in setupNetworkMonitoring but we don't store references
    // In a real implementation, we would store the handler references to properly remove them
  }
}

export default CloudSTTService;