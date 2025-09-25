// STT Cache Optimizer - Optimizes STT service usage and caching
class STTCacheOptimizer {
  constructor() {
    this.isActive = false;
    this.cache = new Map();
    this.requestQueue = [];
    this.batchProcessor = null;
    
    // Cache configuration
    this.config = {
      maxCacheSize: 1000,
      maxCacheAge: 3600000, // 1 hour
      batchSize: 5,
      batchTimeout: 2000, // 2 seconds
      compressionEnabled: true,
      deduplicationEnabled: true,
      prefetchEnabled: true
    };
    
    // Performance metrics
    this.metrics = {
      cacheHits: 0,
      cacheMisses: 0,
      batchRequests: 0,
      compressionRatio: 0,
      deduplicationSavings: 0
    };
    
    this.eventListeners = new Map();
    this.cleanupInterval = null;
    
    // Initialize cache optimization
    this.initializeCacheOptimization();
  }

  /**
   * Initialize cache optimization
   */
  initializeCacheOptimization() {
    // Set up periodic cache cleanup
    this.cleanupInterval = setInterval(() => {
      this.performCacheCleanup();
    }, 300000); // Every 5 minutes
  }

  /**
   * Start STT cache optimization
   */
  start() {
    if (this.isActive) {
      console.log('STT cache optimizer already active');
      return;
    }

    try {
      this.isActive = true;
      
      // Start batch processor
      this.startBatchProcessor();
      
      console.log('STT cache optimizer started');
      this.notifyListeners('optimizerStarted', { timestamp: Date.now() });
      
    } catch (error) {
      this.isActive = false;
      console.error('Failed to start STT cache optimizer:', error);
      throw error;
    }
  }

  /**
   * Start batch processor for STT requests
   */
  startBatchProcessor() {
    this.batchProcessor = setInterval(() => {
      this.processBatch();
    }, this.config.batchTimeout);
  }

  /**
   * Process batch of STT requests
   */
  processBatch() {
    if (this.requestQueue.length === 0) {
      return;
    }

    const batch = this.requestQueue.splice(0, this.config.batchSize);
    this.metrics.batchRequests++;
    
    console.log(`Processing STT batch of ${batch.length} requests`);
    
    // Group requests by provider and configuration
    const groupedRequests = this.groupRequestsByProvider(batch);
    
    // Process each group
    Object.entries(groupedRequests).forEach(([provider, requests]) => {
      this.processBatchForProvider(provider, requests);
    });
  }

  /**
   * Group requests by STT provider
   */
  groupRequestsByProvider(requests) {
    const groups = {};
    
    requests.forEach(request => {
      const key = `${request.provider}_${JSON.stringify(request.config)}`;
      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push(request);
    });
    
    return groups;
  }

  /**
   * Process batch for specific provider
   */
  async processBatchForProvider(providerKey, requests) {
    try {
      // Check cache for each request first
      const uncachedRequests = [];
      
      for (const request of requests) {
        const cacheKey = this.generateCacheKey(request.audioData, request.config);
        const cachedResult = this.getFromCache(cacheKey);
        
        if (cachedResult) {
          this.metrics.cacheHits++;
          request.resolve(cachedResult);
        } else {
          this.metrics.cacheMisses++;
          uncachedRequests.push(request);
        }
      }
      
      // Process uncached requests
      if (uncachedRequests.length > 0) {
        await this.processUncachedRequests(uncachedRequests);
      }
      
    } catch (error) {
      console.error('Error processing batch for provider:', error);
      
      // Reject all requests in batch
      requests.forEach(request => {
        request.reject(error);
      });
    }
  }

  /**
   * Process uncached STT requests
   */
  async processUncachedRequests(requests) {
    // Deduplicate similar audio data
    const deduplicatedRequests = this.deduplicateRequests(requests);
    
    // Process each unique request
    for (const request of deduplicatedRequests) {
      try {
        const result = await this.performSTTRequest(request);
        
        // Cache the result
        const cacheKey = this.generateCacheKey(request.audioData, request.config);
        this.addToCache(cacheKey, result);
        
        // Resolve all similar requests
        request.similarRequests.forEach(similarRequest => {
          similarRequest.resolve(result);
        });
        
      } catch (error) {
        console.error('STT request failed:', error);
        
        // Reject all similar requests
        request.similarRequests.forEach(similarRequest => {
          similarRequest.reject(error);
        });
      }
    }
  }

  /**
   * Deduplicate similar requests
   */
  deduplicateRequests(requests) {
    const uniqueRequests = [];
    const processedHashes = new Set();
    
    for (const request of requests) {
      const audioHash = this.generateAudioHash(request.audioData);
      
      if (!processedHashes.has(audioHash)) {
        processedHashes.add(audioHash);
        request.similarRequests = [request];
        uniqueRequests.push(request);
      } else {
        // Find the existing request with same hash
        const existingRequest = uniqueRequests.find(r => 
          this.generateAudioHash(r.audioData) === audioHash
        );
        
        if (existingRequest) {
          existingRequest.similarRequests.push(request);
          this.metrics.deduplicationSavings++;
        }
      }
    }
    
    return uniqueRequests;
  }

  /**
   * Generate audio hash for deduplication
   */
  generateAudioHash(audioData) {
    if (!audioData || !audioData.data) {
      return 'empty';
    }
    
    // Simple hash based on audio characteristics
    const samples = audioData.data;
    let hash = 0;
    
    // Sample every 100th point to create a signature
    for (let i = 0; i < samples.length; i += 100) {
      hash = ((hash << 5) - hash + Math.floor(samples[i] * 1000)) & 0xffffffff;
    }
    
    return hash.toString(36);
  }

  /**
   * Perform actual STT request
   */
  async performSTTRequest(request) {
    const { audioData, provider, config } = request;
    
    // Compress audio data if enabled
    const processedAudio = this.config.compressionEnabled 
      ? this.compressAudioData(audioData)
      : audioData;
    
    // Make STT request based on provider
    switch (provider) {
      case 'local':
        return await this.performLocalSTT(processedAudio, config);
      case 'openai':
        return await this.performOpenAISTT(processedAudio, config);
      case 'azure':
        return await this.performAzureSTT(processedAudio, config);
      case 'claude':
        return await this.performClaudeSTT(processedAudio, config);
      default:
        throw new Error(`Unsupported STT provider: ${provider}`);
    }
  }

  /**
   * Compress audio data
   */
  compressAudioData(audioData) {
    if (!audioData || !audioData.data) {
      return audioData;
    }
    
    // Simple compression by reducing sample rate or bit depth
    const originalSize = audioData.data.length;
    const compressionFactor = 0.8; // 20% compression
    const targetSize = Math.floor(originalSize * compressionFactor);
    
    const compressed = new Float32Array(targetSize);
    const step = originalSize / targetSize;
    
    for (let i = 0; i < targetSize; i++) {
      const sourceIndex = Math.floor(i * step);
      compressed[i] = audioData.data[sourceIndex];
    }
    
    const compressionRatio = (originalSize - targetSize) / originalSize;
    this.metrics.compressionRatio = 
      (this.metrics.compressionRatio + compressionRatio) / 2;
    
    return {
      ...audioData,
      data: compressed,
      compressed: true,
      originalSize: originalSize
    };
  }

  /**
   * Perform local STT
   */
  async performLocalSTT(audioData, config) {
    if (window.localSTTService) {
      return await window.localSTTService.transcribe(audioData, config);
    }
    throw new Error('Local STT service not available');
  }

  /**
   * Perform OpenAI STT
   */
  async performOpenAISTT(audioData, config) {
    if (window.cloudSTTService) {
      return await window.cloudSTTService.transcribe(audioData, 'openai_whisper', config);
    }
    throw new Error('Cloud STT service not available');
  }

  /**
   * Perform Azure STT
   */
  async performAzureSTT(audioData, config) {
    if (window.cloudSTTService) {
      return await window.cloudSTTService.transcribe(audioData, 'azure_speech', config);
    }
    throw new Error('Cloud STT service not available');
  }

  /**
   * Perform Claude STT
   */
  async performClaudeSTT(audioData, config) {
    if (window.cloudSTTService) {
      return await window.cloudSTTService.transcribe(audioData, 'claude_speech', config);
    }
    throw new Error('Cloud STT service not available');
  }

  /**
   * Generate cache key
   */
  generateCacheKey(audioData, config) {
    const audioHash = this.generateAudioHash(audioData);
    const configHash = this.hashObject(config);
    return `${audioHash}_${configHash}`;
  }

  /**
   * Hash object for cache key
   */
  hashObject(obj) {
    const str = JSON.stringify(obj, Object.keys(obj).sort());
    let hash = 0;
    
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    
    return hash.toString(36);
  }

  /**
   * Add result to cache
   */
  addToCache(key, result) {
    // Check cache size limit
    if (this.cache.size >= this.config.maxCacheSize) {
      this.evictOldestCacheEntry();
    }
    
    const cacheEntry = {
      result: result,
      timestamp: Date.now(),
      accessCount: 0,
      lastAccessed: Date.now()
    };
    
    this.cache.set(key, cacheEntry);
  }

  /**
   * Get result from cache
   */
  getFromCache(key) {
    const entry = this.cache.get(key);
    
    if (!entry) {
      return null;
    }
    
    // Check if entry is expired
    const age = Date.now() - entry.timestamp;
    if (age > this.config.maxCacheAge) {
      this.cache.delete(key);
      return null;
    }
    
    // Update access statistics
    entry.accessCount++;
    entry.lastAccessed = Date.now();
    
    return entry.result;
  }

  /**
   * Evict oldest cache entry
   */
  evictOldestCacheEntry() {
    let oldestKey = null;
    let oldestTime = Date.now();
    
    this.cache.forEach((entry, key) => {
      if (entry.lastAccessed < oldestTime) {
        oldestTime = entry.lastAccessed;
        oldestKey = key;
      }
    });
    
    if (oldestKey) {
      this.cache.delete(oldestKey);
    }
  }

  /**
   * Perform cache cleanup
   */
  performCacheCleanup() {
    const now = Date.now();
    const keysToDelete = [];
    
    this.cache.forEach((entry, key) => {
      const age = now - entry.timestamp;
      if (age > this.config.maxCacheAge) {
        keysToDelete.push(key);
      }
    });
    
    keysToDelete.forEach(key => {
      this.cache.delete(key);
    });
    
    console.log(`Cache cleanup: removed ${keysToDelete.length} expired entries`);
  }

  /**
   * Queue STT request
   */
  queueSTTRequest(audioData, provider, config) {
    return new Promise((resolve, reject) => {
      const request = {
        audioData,
        provider,
        config,
        resolve,
        reject,
        timestamp: Date.now()
      };
      
      this.requestQueue.push(request);
      
      // Process immediately if batch is full
      if (this.requestQueue.length >= this.config.batchSize) {
        this.processBatch();
      }
    });
  }

  /**
   * Prefetch likely needed transcriptions
   */
  prefetchTranscriptions(audioSegments, provider, config) {
    if (!this.config.prefetchEnabled) {
      return;
    }
    
    audioSegments.forEach(audioData => {
      const cacheKey = this.generateCacheKey(audioData, config);
      
      if (!this.cache.has(cacheKey)) {
        // Queue for prefetch (low priority)
        setTimeout(() => {
          this.queueSTTRequest(audioData, provider, config)
            .catch(error => {
              console.warn('Prefetch failed:', error);
            });
        }, 1000);
      }
    });
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    const totalRequests = this.metrics.cacheHits + this.metrics.cacheMisses;
    const hitRate = totalRequests > 0 ? (this.metrics.cacheHits / totalRequests) * 100 : 0;
    
    return {
      ...this.metrics,
      cacheSize: this.cache.size,
      maxCacheSize: this.config.maxCacheSize,
      hitRate: Math.round(hitRate * 100) / 100,
      queueLength: this.requestQueue.length
    };
  }

  /**
   * Clear cache
   */
  clearCache() {
    this.cache.clear();
    console.log('STT cache cleared');
    this.notifyListeners('cacheCleared', { timestamp: Date.now() });
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig) {
    this.config = { ...this.config, ...newConfig };
    console.log('STT cache optimizer configuration updated');
    this.notifyListeners('configUpdated', this.config);
  }

  /**
   * Stop STT cache optimizer
   */
  stop() {
    if (!this.isActive) {
      console.log('STT cache optimizer not active');
      return;
    }

    try {
      // Stop batch processor
      if (this.batchProcessor) {
        clearInterval(this.batchProcessor);
        this.batchProcessor = null;
      }
      
      // Stop cleanup interval
      if (this.cleanupInterval) {
        clearInterval(this.cleanupInterval);
        this.cleanupInterval = null;
      }
      
      // Process remaining requests
      if (this.requestQueue.length > 0) {
        this.processBatch();
      }
      
      this.isActive = false;
      
      console.log('STT cache optimizer stopped');
      this.notifyListeners('optimizerStopped', { timestamp: Date.now() });
      
    } catch (error) {
      console.error('Error stopping STT cache optimizer:', error);
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
   * Cleanup resources
   */
  cleanup() {
    this.stop();
    this.clearCache();
    this.eventListeners.clear();
    console.log('STT cache optimizer cleaned up');
  }
}

export default STTCacheOptimizer;