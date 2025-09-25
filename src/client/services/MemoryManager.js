// Memory Manager - Advanced memory management and garbage collection
class MemoryManager {
  constructor() {
    this.isActive = false;
    this.memoryPools = new Map();
    this.weakReferences = new Map();
    this.memoryThresholds = {
      warning: 80, // 80% of heap
      critical: 90, // 90% of heap
      cleanup: 95   // 95% of heap - force cleanup
    };
    
    this.memoryStats = {
      totalAllocated: 0,
      currentUsage: 0,
      peakUsage: 0,
      gcCount: 0,
      lastGCTime: 0,
      poolHits: 0,
      poolMisses: 0
    };
    
    this.cleanupStrategies = new Map();
    this.monitoringInterval = null;
    this.eventListeners = new Map();
    
    // Initialize cleanup strategies
    this.initializeCleanupStrategies();
    
    // Bind methods
    this.performCleanup = this.performCleanup.bind(this);
    this.monitorMemory = this.monitorMemory.bind(this);
  }

  /**
   * Initialize memory cleanup strategies
   */
  initializeCleanupStrategies() {
    // Audio buffer cleanup
    this.cleanupStrategies.set('audioBuffers', {
      name: 'Audio Buffers',
      priority: 1,
      cleanup: () => this.cleanupAudioBuffers(),
      estimate: () => this.estimateAudioBufferMemory()
    });
    
    // Transcription cache cleanup
    this.cleanupStrategies.set('transcriptionCache', {
      name: 'Transcription Cache',
      priority: 2,
      cleanup: () => this.cleanupTranscriptionCache(),
      estimate: () => this.estimateTranscriptionCacheMemory()
    });
    
    // Event listener cleanup
    this.cleanupStrategies.set('eventListeners', {
      name: 'Event Listeners',
      priority: 3,
      cleanup: () => this.cleanupEventListeners(),
      estimate: () => this.estimateEventListenerMemory()
    });
    
    // DOM element cleanup
    this.cleanupStrategies.set('domElements', {
      name: 'DOM Elements',
      priority: 4,
      cleanup: () => this.cleanupDOMElements(),
      estimate: () => this.estimateDOMMemory()
    });
    
    // Object pool cleanup
    this.cleanupStrategies.set('objectPools', {
      name: 'Object Pools',
      priority: 5,
      cleanup: () => this.cleanupObjectPools(),
      estimate: () => this.estimateObjectPoolMemory()
    });
  }

  /**
   * Start memory management
   */
  start() {
    if (this.isActive) {
      console.log('Memory manager already active');
      return;
    }

    try {
      this.isActive = true;
      
      // Initialize memory pools
      this.initializeMemoryPools();
      
      // Start memory monitoring
      this.startMemoryMonitoring();
      
      // Set up memory pressure handlers
      this.setupMemoryPressureHandlers();
      
      console.log('Memory manager started');
      this.notifyListeners('started', { timestamp: Date.now() });
      
    } catch (error) {
      this.isActive = false;
      console.error('Failed to start memory manager:', error);
      throw error;
    }
  }

  /**
   * Initialize memory pools for object reuse
   */
  initializeMemoryPools() {
    // Audio buffer pool
    this.memoryPools.set('audioBuffers', {
      pool: [],
      maxSize: 50,
      factory: () => new Float32Array(4096),
      reset: (buffer) => buffer.fill(0)
    });
    
    // Transcription result pool
    this.memoryPools.set('transcriptionResults', {
      pool: [],
      maxSize: 100,
      factory: () => ({
        text: '',
        confidence: 0,
        timestamp: 0,
        segments: [],
        speaker: null
      }),
      reset: (result) => {
        result.text = '';
        result.confidence = 0;
        result.timestamp = 0;
        result.segments.length = 0;
        result.speaker = null;
      }
    });
    
    // Event object pool
    this.memoryPools.set('eventObjects', {
      pool: [],
      maxSize: 200,
      factory: () => ({}),
      reset: (obj) => {
        Object.keys(obj).forEach(key => delete obj[key]);
      }
    });
    
    // Array pool for various uses
    this.memoryPools.set('arrays', {
      pool: [],
      maxSize: 100,
      factory: () => [],
      reset: (arr) => arr.length = 0
    });
    
    console.log('Memory pools initialized');
  }

  /**
   * Start memory monitoring
   */
  startMemoryMonitoring() {
    this.monitoringInterval = setInterval(this.monitorMemory, 5000); // Every 5 seconds
  }

  /**
   * Monitor memory usage
   */
  monitorMemory() {
    if (!performance.memory) {
      return;
    }

    const memory = performance.memory;
    const currentUsage = (memory.usedJSHeapSize / memory.totalJSHeapSize) * 100;
    
    // Update stats
    this.memoryStats.currentUsage = currentUsage;
    this.memoryStats.peakUsage = Math.max(this.memoryStats.peakUsage, currentUsage);
    this.memoryStats.totalAllocated = memory.totalJSHeapSize;
    
    // Check thresholds
    this.checkMemoryThresholds(currentUsage);
    
    // Notify listeners
    this.notifyListeners('memoryUpdate', {
      usage: currentUsage,
      total: memory.totalJSHeapSize,
      used: memory.usedJSHeapSize,
      limit: memory.jsHeapSizeLimit
    });
  }

  /**
   * Check memory thresholds and trigger appropriate actions
   */
  checkMemoryThresholds(currentUsage) {
    if (currentUsage >= this.memoryThresholds.critical) {
      this.handleCriticalMemory();
    } else if (currentUsage >= this.memoryThresholds.warning) {
      this.handleWarningMemory();
    }
  }

  /**
   * Handle critical memory situation
   */
  handleCriticalMemory() {
    console.warn('Critical memory usage detected, performing aggressive cleanup');
    
    this.notifyListeners('criticalMemory', {
      usage: this.memoryStats.currentUsage,
      timestamp: Date.now()
    });
    
    // Perform aggressive cleanup
    this.performAggressiveCleanup();
  }

  /**
   * Handle warning memory situation
   */
  handleWarningMemory() {
    console.warn('High memory usage detected, performing cleanup');
    
    this.notifyListeners('warningMemory', {
      usage: this.memoryStats.currentUsage,
      timestamp: Date.now()
    });
    
    // Perform standard cleanup
    this.performCleanup();
  }

  /**
   * Setup memory pressure handlers
   */
  setupMemoryPressureHandlers() {
    // Listen for memory pressure events if available
    if ('memory' in navigator) {
      navigator.memory.addEventListener('memoryPressure', (event) => {
        console.log('Memory pressure event received:', event.level);
        this.handleMemoryPressure(event.level);
      });
    }
    
    // Listen for page visibility changes to cleanup when hidden
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.performCleanup();
      }
    });
    
    // Listen for beforeunload to cleanup
    window.addEventListener('beforeunload', () => {
      this.performFinalCleanup();
    });
  }

  /**
   * Handle memory pressure events
   */
  handleMemoryPressure(level) {
    switch (level) {
      case 'critical':
        this.performAggressiveCleanup();
        break;
      case 'moderate':
        this.performCleanup();
        break;
      default:
        this.performLightCleanup();
        break;
    }
  }

  /**
   * Get object from memory pool
   */
  getFromPool(poolName) {
    const pool = this.memoryPools.get(poolName);
    if (!pool) {
      this.memoryStats.poolMisses++;
      return null;
    }
    
    if (pool.pool.length > 0) {
      this.memoryStats.poolHits++;
      const obj = pool.pool.pop();
      pool.reset(obj);
      return obj;
    } else {
      this.memoryStats.poolMisses++;
      return pool.factory();
    }
  }

  /**
   * Return object to memory pool
   */
  returnToPool(poolName, obj) {
    const pool = this.memoryPools.get(poolName);
    if (!pool || pool.pool.length >= pool.maxSize) {
      return false;
    }
    
    pool.reset(obj);
    pool.pool.push(obj);
    return true;
  }

  /**
   * Create weak reference
   */
  createWeakReference(key, object, finalizer = null) {
    if (typeof WeakRef === 'undefined') {
      // Fallback for browsers without WeakRef support
      this.weakReferences.set(key, object);
      return object;
    }
    
    const weakRef = new WeakRef(object);
    this.weakReferences.set(key, weakRef);
    
    if (finalizer && typeof FinalizationRegistry !== 'undefined') {
      if (!this.finalizationRegistry) {
        this.finalizationRegistry = new FinalizationRegistry((heldValue) => {
          console.log('Object finalized:', heldValue);
        });
      }
      this.finalizationRegistry.register(object, key);
    }
    
    return weakRef;
  }

  /**
   * Get object from weak reference
   */
  getWeakReference(key) {
    const ref = this.weakReferences.get(key);
    if (!ref) {
      return null;
    }
    
    if (typeof WeakRef !== 'undefined' && ref instanceof WeakRef) {
      const obj = ref.deref();
      if (!obj) {
        this.weakReferences.delete(key);
      }
      return obj;
    }
    
    return ref;
  }

  /**
   * Perform light cleanup
   */
  performLightCleanup() {
    console.log('Performing light memory cleanup');
    
    // Clean up expired weak references
    this.cleanupWeakReferences();
    
    // Trim object pools
    this.trimObjectPools(0.8); // Keep 80% of pool size
    
    this.memoryStats.gcCount++;
    this.memoryStats.lastGCTime = Date.now();
    
    this.notifyListeners('lightCleanup', { timestamp: Date.now() });
  }

  /**
   * Perform standard cleanup
   */
  performCleanup() {
    console.log('Performing standard memory cleanup');
    
    // Execute cleanup strategies by priority
    const strategies = Array.from(this.cleanupStrategies.values())
      .sort((a, b) => a.priority - b.priority);
    
    for (const strategy of strategies) {
      try {
        const freed = strategy.cleanup();
        console.log(`${strategy.name} cleanup freed: ${freed} bytes`);
      } catch (error) {
        console.error(`Error in ${strategy.name} cleanup:`, error);
      }
    }
    
    // Trim object pools more aggressively
    this.trimObjectPools(0.5); // Keep 50% of pool size
    
    // Force garbage collection if available
    this.forceGarbageCollection();
    
    this.memoryStats.gcCount++;
    this.memoryStats.lastGCTime = Date.now();
    
    this.notifyListeners('cleanup', { timestamp: Date.now() });
  }

  /**
   * Perform aggressive cleanup
   */
  performAggressiveCleanup() {
    console.log('Performing aggressive memory cleanup');
    
    // Clear all caches
    this.clearAllCaches();
    
    // Execute all cleanup strategies
    this.performCleanup();
    
    // Clear object pools completely
    this.clearObjectPools();
    
    // Clear weak references
    this.clearWeakReferences();
    
    // Force multiple garbage collections
    for (let i = 0; i < 3; i++) {
      this.forceGarbageCollection();
    }
    
    this.notifyListeners('aggressiveCleanup', { timestamp: Date.now() });
  }

  /**
   * Perform final cleanup before page unload
   */
  performFinalCleanup() {
    console.log('Performing final memory cleanup');
    
    // Clear everything
    this.clearAllCaches();
    this.clearObjectPools();
    this.clearWeakReferences();
    
    // Remove all event listeners
    this.eventListeners.clear();
    
    // Stop monitoring
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
    }
  }

  /**
   * Cleanup audio buffers
   */
  cleanupAudioBuffers() {
    let freedBytes = 0;
    
    // Clear global audio buffer cache if it exists
    if (window.audioBufferCache) {
      const cacheSize = window.audioBufferCache.size;
      window.audioBufferCache.clear();
      freedBytes += cacheSize * 4096 * 4; // Estimate 4KB per buffer
    }
    
    // Clear audio processor buffers
    if (window.audioProcessor && window.audioProcessor.audioBuffers) {
      const bufferCount = window.audioProcessor.audioBuffers.length;
      window.audioProcessor.audioBuffers.length = 0;
      freedBytes += bufferCount * 4096 * 4;
    }
    
    return freedBytes;
  }

  /**
   * Cleanup transcription cache
   */
  cleanupTranscriptionCache() {
    let freedBytes = 0;
    
    // Clear transcription cache
    if (window.transcriptionCache) {
      const entries = window.transcriptionCache.size;
      window.transcriptionCache.clear();
      freedBytes += entries * 1000; // Estimate 1KB per transcription
    }
    
    // Clear transcription engine buffer
    if (window.transcriptionEngine && window.transcriptionEngine.transcriptionBuffer) {
      const bufferSize = window.transcriptionEngine.transcriptionBuffer.length;
      window.transcriptionEngine.transcriptionBuffer.length = 0;
      freedBytes += bufferSize * 500; // Estimate 500 bytes per entry
    }
    
    return freedBytes;
  }

  /**
   * Cleanup event listeners
   */
  cleanupEventListeners() {
    let freedBytes = 0;
    
    // Remove unused event listeners from various components
    const components = [
      window.audioProcessor,
      window.transcriptionEngine,
      window.speakerIdentification,
      window.summaryService
    ];
    
    components.forEach(component => {
      if (component && component.eventListeners) {
        const listenerCount = Array.from(component.eventListeners.values())
          .reduce((sum, listeners) => sum + listeners.length, 0);
        
        // Remove listeners that haven't been called recently
        component.eventListeners.forEach((listeners, eventType) => {
          component.eventListeners.set(eventType, 
            listeners.filter(listener => listener.lastCalled > Date.now() - 300000) // 5 minutes
          );
        });
        
        freedBytes += listenerCount * 100; // Estimate 100 bytes per listener
      }
    });
    
    return freedBytes;
  }

  /**
   * Cleanup DOM elements
   */
  cleanupDOMElements() {
    let freedBytes = 0;
    
    // Remove unused DOM elements
    const unusedElements = document.querySelectorAll('[data-cleanup="true"]');
    unusedElements.forEach(element => {
      element.remove();
      freedBytes += 1000; // Estimate 1KB per element
    });
    
    // Clear text content from hidden elements
    const hiddenElements = document.querySelectorAll('[style*="display: none"]');
    hiddenElements.forEach(element => {
      if (element.textContent.length > 1000) {
        element.textContent = '';
        freedBytes += element.textContent.length;
      }
    });
    
    return freedBytes;
  }

  /**
   * Cleanup object pools
   */
  cleanupObjectPools() {
    let freedBytes = 0;
    
    this.memoryPools.forEach((pool, name) => {
      const originalSize = pool.pool.length;
      pool.pool.length = Math.floor(pool.pool.length * 0.3); // Keep only 30%
      freedBytes += (originalSize - pool.pool.length) * 100; // Estimate 100 bytes per object
    });
    
    return freedBytes;
  }

  /**
   * Estimate memory usage of different components
   */
  estimateAudioBufferMemory() {
    let estimate = 0;
    
    if (window.audioBufferCache) {
      estimate += window.audioBufferCache.size * 4096 * 4;
    }
    
    if (window.audioProcessor && window.audioProcessor.audioBuffers) {
      estimate += window.audioProcessor.audioBuffers.length * 4096 * 4;
    }
    
    return estimate;
  }

  estimateTranscriptionCacheMemory() {
    let estimate = 0;
    
    if (window.transcriptionCache) {
      estimate += window.transcriptionCache.size * 1000;
    }
    
    if (window.transcriptionEngine && window.transcriptionEngine.transcriptionBuffer) {
      estimate += window.transcriptionEngine.transcriptionBuffer.length * 500;
    }
    
    return estimate;
  }

  estimateEventListenerMemory() {
    let estimate = 0;
    
    const components = [
      window.audioProcessor,
      window.transcriptionEngine,
      window.speakerIdentification,
      window.summaryService
    ];
    
    components.forEach(component => {
      if (component && component.eventListeners) {
        const listenerCount = Array.from(component.eventListeners.values())
          .reduce((sum, listeners) => sum + listeners.length, 0);
        estimate += listenerCount * 100;
      }
    });
    
    return estimate;
  }

  estimateDOMMemory() {
    const elements = document.querySelectorAll('*');
    return elements.length * 500; // Rough estimate
  }

  estimateObjectPoolMemory() {
    let estimate = 0;
    
    this.memoryPools.forEach(pool => {
      estimate += pool.pool.length * 100;
    });
    
    return estimate;
  }

  /**
   * Cleanup expired weak references
   */
  cleanupWeakReferences() {
    if (typeof WeakRef === 'undefined') {
      return;
    }
    
    const keysToDelete = [];
    
    this.weakReferences.forEach((ref, key) => {
      if (ref instanceof WeakRef && !ref.deref()) {
        keysToDelete.push(key);
      }
    });
    
    keysToDelete.forEach(key => {
      this.weakReferences.delete(key);
    });
    
    console.log(`Cleaned up ${keysToDelete.length} expired weak references`);
  }

  /**
   * Trim object pools to specified ratio
   */
  trimObjectPools(ratio) {
    this.memoryPools.forEach((pool, name) => {
      const targetSize = Math.floor(pool.maxSize * ratio);
      if (pool.pool.length > targetSize) {
        pool.pool.length = targetSize;
      }
    });
  }

  /**
   * Clear all object pools
   */
  clearObjectPools() {
    this.memoryPools.forEach(pool => {
      pool.pool.length = 0;
    });
  }

  /**
   * Clear all weak references
   */
  clearWeakReferences() {
    this.weakReferences.clear();
  }

  /**
   * Clear all caches
   */
  clearAllCaches() {
    // Clear browser caches if possible
    if ('caches' in window) {
      caches.keys().then(names => {
        names.forEach(name => {
          caches.delete(name);
        });
      });
    }
    
    // Clear application caches
    const cacheNames = [
      'audioBufferCache',
      'transcriptionCache',
      'modelCache',
      'configCache'
    ];
    
    cacheNames.forEach(cacheName => {
      if (window[cacheName]) {
        window[cacheName].clear();
      }
    });
  }

  /**
   * Force garbage collection if available
   */
  forceGarbageCollection() {
    if (window.gc) {
      window.gc();
    } else if (window.CollectGarbage) {
      window.CollectGarbage();
    }
  }

  /**
   * Get memory statistics
   */
  getMemoryStats() {
    const stats = { ...this.memoryStats };
    
    if (performance.memory) {
      stats.heapUsed = performance.memory.usedJSHeapSize;
      stats.heapTotal = performance.memory.totalJSHeapSize;
      stats.heapLimit = performance.memory.jsHeapSizeLimit;
    }
    
    // Calculate pool efficiency
    const totalHits = this.memoryStats.poolHits;
    const totalRequests = totalHits + this.memoryStats.poolMisses;
    stats.poolEfficiency = totalRequests > 0 ? (totalHits / totalRequests) * 100 : 0;
    
    return stats;
  }

  /**
   * Get memory usage breakdown
   */
  getMemoryBreakdown() {
    const breakdown = {};
    
    this.cleanupStrategies.forEach((strategy, name) => {
      breakdown[name] = {
        name: strategy.name,
        estimatedUsage: strategy.estimate(),
        priority: strategy.priority
      };
    });
    
    return breakdown;
  }

  /**
   * Stop memory management
   */
  stop() {
    if (!this.isActive) {
      console.log('Memory manager not active');
      return;
    }

    try {
      // Stop monitoring
      if (this.monitoringInterval) {
        clearInterval(this.monitoringInterval);
        this.monitoringInterval = null;
      }
      
      // Perform final cleanup
      this.performFinalCleanup();
      
      this.isActive = false;
      
      console.log('Memory manager stopped');
      this.notifyListeners('stopped', { timestamp: Date.now() });
      
    } catch (error) {
      console.error('Error stopping memory manager:', error);
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
}

export default MemoryManager;