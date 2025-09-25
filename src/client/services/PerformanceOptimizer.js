// Performance Optimizer - Manages system performance and resource optimization
class PerformanceOptimizer {
  constructor() {
    this.isOptimizing = false;
    this.performanceMode = 'balanced'; // 'performance', 'balanced', 'battery'
    this.resourceMonitor = null;
    this.optimizationStrategies = new Map();
    this.performanceMetrics = {
      cpuUsage: 0,
      memoryUsage: 0,
      audioLatency: 0,
      transcriptionLatency: 0,
      frameRate: 0,
      gcPressure: 0
    };
    
    // Performance thresholds
    this.thresholds = {
      highCPU: 80,
      highMemory: 85,
      maxAudioLatency: 100, // ms
      maxTranscriptionLatency: 2000, // ms
      minFrameRate: 30
    };
    
    // Optimization settings
    this.optimizations = {
      audioBufferSize: 4096,
      audioProcessingInterval: 100,
      transcriptionBatchSize: 5,
      gcInterval: 30000, // 30 seconds
      memoryCleanupThreshold: 100 * 1024 * 1024, // 100MB
      enableWebWorkers: true,
      enableOffscreenCanvas: true,
      enableAudioWorklet: true
    };
    
    this.eventListeners = new Map();
    this.monitoringInterval = null;
    this.gcInterval = null;
    
    // Initialize optimization strategies
    this.initializeOptimizationStrategies();
  }

  /**
   * Initialize performance optimization strategies
   */
  initializeOptimizationStrategies() {
    // Audio processing optimizations
    this.optimizationStrategies.set('audio', {
      name: 'Audio Processing',
      enabled: true,
      apply: () => this.optimizeAudioProcessing(),
      revert: () => this.revertAudioOptimizations()
    });
    
    // Memory management optimizations
    this.optimizationStrategies.set('memory', {
      name: 'Memory Management',
      enabled: true,
      apply: () => this.optimizeMemoryUsage(),
      revert: () => this.revertMemoryOptimizations()
    });
    
    // Transcription optimizations
    this.optimizationStrategies.set('transcription', {
      name: 'Transcription Processing',
      enabled: true,
      apply: () => this.optimizeTranscriptionProcessing(),
      revert: () => this.revertTranscriptionOptimizations()
    });
    
    // UI rendering optimizations
    this.optimizationStrategies.set('rendering', {
      name: 'UI Rendering',
      enabled: true,
      apply: () => this.optimizeUIRendering(),
      revert: () => this.revertUIOptimizations()
    });
  }

  /**
   * Start performance optimization
   */
  async startOptimization(mode = 'balanced') {
    if (this.isOptimizing) {
      console.log('Performance optimization already active');
      return;
    }

    try {
      this.performanceMode = mode;
      this.isOptimizing = true;
      
      console.log(`Starting performance optimization in ${mode} mode`);
      
      // Apply mode-specific settings
      this.applyPerformanceMode(mode);
      
      // Start resource monitoring
      this.startResourceMonitoring();
      
      // Start garbage collection management
      this.startGarbageCollectionManagement();
      
      // Apply optimization strategies
      await this.applyOptimizationStrategies();
      
      this.notifyListeners('optimizationStarted', {
        mode: this.performanceMode,
        strategies: Array.from(this.optimizationStrategies.keys())
      });
      
      console.log('Performance optimization started successfully');
      
    } catch (error) {
      this.isOptimizing = false;
      console.error('Failed to start performance optimization:', error);
      throw error;
    }
  }

  /**
   * Apply performance mode settings
   */
  applyPerformanceMode(mode) {
    switch (mode) {
      case 'performance':
        this.optimizations.audioBufferSize = 2048;
        this.optimizations.audioProcessingInterval = 50;
        this.optimizations.transcriptionBatchSize = 3;
        this.optimizations.gcInterval = 15000;
        this.thresholds.maxAudioLatency = 50;
        break;
        
      case 'battery':
        this.optimizations.audioBufferSize = 8192;
        this.optimizations.audioProcessingInterval = 200;
        this.optimizations.transcriptionBatchSize = 10;
        this.optimizations.gcInterval = 60000;
        this.thresholds.maxAudioLatency = 200;
        break;
        
      case 'balanced':
      default:
        this.optimizations.audioBufferSize = 4096;
        this.optimizations.audioProcessingInterval = 100;
        this.optimizations.transcriptionBatchSize = 5;
        this.optimizations.gcInterval = 30000;
        this.thresholds.maxAudioLatency = 100;
        break;
    }
  }

  /**
   * Start resource monitoring
   */
  startResourceMonitoring() {
    this.monitoringInterval = setInterval(() => {
      this.updatePerformanceMetrics();
      this.checkPerformanceThresholds();
    }, 1000);
  }

  /**
   * Update performance metrics
   */
  updatePerformanceMetrics() {
    // Memory usage
    if (performance.memory) {
      this.performanceMetrics.memoryUsage = (performance.memory.usedJSHeapSize / performance.memory.totalJSHeapSize) * 100;
      this.performanceMetrics.gcPressure = performance.memory.totalJSHeapSize - performance.memory.usedJSHeapSize;
    }
    
    // Frame rate (approximate)
    this.measureFrameRate();
    
    // Audio latency (if available)
    this.measureAudioLatency();
    
    // Notify listeners of metrics update
    this.notifyListeners('metricsUpdated', this.performanceMetrics);
  }

  /**
   * Measure frame rate
   */
  measureFrameRate() {
    if (!this.frameRateCounter) {
      this.frameRateCounter = {
        frames: 0,
        lastTime: performance.now()
      };
    }
    
    this.frameRateCounter.frames++;
    const currentTime = performance.now();
    const elapsed = currentTime - this.frameRateCounter.lastTime;
    
    if (elapsed >= 1000) {
      this.performanceMetrics.frameRate = Math.round((this.frameRateCounter.frames * 1000) / elapsed);
      this.frameRateCounter.frames = 0;
      this.frameRateCounter.lastTime = currentTime;
    }
  }

  /**
   * Measure audio latency
   */
  measureAudioLatency() {
    // This would be implemented with actual audio context measurements
    // For now, we'll use a placeholder
    if (window.audioContext && window.audioContext.baseLatency !== undefined) {
      this.performanceMetrics.audioLatency = window.audioContext.baseLatency * 1000;
    }
  }

  /**
   * Check performance thresholds and trigger optimizations
   */
  checkPerformanceThresholds() {
    const metrics = this.performanceMetrics;
    
    // High memory usage
    if (metrics.memoryUsage > this.thresholds.highMemory) {
      this.triggerMemoryOptimization();
    }
    
    // High audio latency
    if (metrics.audioLatency > this.thresholds.maxAudioLatency) {
      this.triggerAudioOptimization();
    }
    
    // Low frame rate
    if (metrics.frameRate < this.thresholds.minFrameRate && metrics.frameRate > 0) {
      this.triggerRenderingOptimization();
    }
    
    // GC pressure
    if (metrics.gcPressure > this.optimizations.memoryCleanupThreshold) {
      this.triggerGarbageCollection();
    }
  }

  /**
   * Apply optimization strategies
   */
  async applyOptimizationStrategies() {
    for (const [key, strategy] of this.optimizationStrategies) {
      if (strategy.enabled) {
        try {
          await strategy.apply();
          console.log(`Applied ${strategy.name} optimization`);
        } catch (error) {
          console.error(`Failed to apply ${strategy.name} optimization:`, error);
        }
      }
    }
  }

  /**
   * Optimize audio processing
   */
  optimizeAudioProcessing() {
    // Use AudioWorklet if available for better performance
    if (this.optimizations.enableAudioWorklet && window.AudioWorklet) {
      this.enableAudioWorklet();
    }
    
    // Optimize buffer sizes
    this.optimizeAudioBuffers();
    
    // Enable audio processing optimizations
    this.enableAudioOptimizations();
  }

  /**
   * Enable AudioWorklet for better audio processing
   */
  async enableAudioWorklet() {
    try {
      if (window.audioContext && window.audioContext.audioWorklet) {
        // Register audio worklet processor
        await window.audioContext.audioWorklet.addModule('/audio-processor-worklet.js');
        console.log('AudioWorklet enabled for optimized audio processing');
      }
    } catch (error) {
      console.warn('Failed to enable AudioWorklet:', error);
    }
  }

  /**
   * Optimize audio buffers
   */
  optimizeAudioBuffers() {
    // Adjust buffer sizes based on performance mode
    const bufferSize = this.optimizations.audioBufferSize;
    
    // Notify audio processor to update buffer size
    this.notifyListeners('audioBufferOptimization', {
      bufferSize: bufferSize,
      processingInterval: this.optimizations.audioProcessingInterval
    });
  }

  /**
   * Enable audio processing optimizations
   */
  enableAudioOptimizations() {
    // Enable SIMD operations if available
    if (typeof WebAssembly !== 'undefined' && WebAssembly.validate) {
      this.enableSIMDOptimizations();
    }
    
    // Use Web Workers for audio processing
    if (this.optimizations.enableWebWorkers) {
      this.enableAudioWebWorkers();
    }
  }

  /**
   * Enable SIMD optimizations
   */
  enableSIMDOptimizations() {
    // Check for SIMD support
    try {
      const simdSupported = WebAssembly.validate(new Uint8Array([
        0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00,
        0x01, 0x05, 0x01, 0x60, 0x00, 0x01, 0x7b
      ]));
      
      if (simdSupported) {
        console.log('SIMD optimizations enabled');
        this.notifyListeners('simdEnabled', { supported: true });
      }
    } catch (error) {
      console.warn('SIMD not supported:', error);
    }
  }

  /**
   * Enable Web Workers for audio processing
   */
  enableAudioWebWorkers() {
    try {
      // Create audio processing worker
      const workerBlob = new Blob([`
        self.onmessage = function(e) {
          const { audioData, operation } = e.data;
          
          switch (operation) {
            case 'normalize':
              const normalized = normalizeAudio(audioData);
              self.postMessage({ result: normalized, operation });
              break;
            case 'filter':
              const filtered = applyFilter(audioData);
              self.postMessage({ result: filtered, operation });
              break;
          }
        };
        
        function normalizeAudio(data) {
          const peak = Math.max(...data.map(Math.abs));
          return peak > 0 ? data.map(x => x / peak * 0.8) : data;
        }
        
        function applyFilter(data) {
          // Simple high-pass filter
          const filtered = new Float32Array(data.length);
          filtered[0] = data[0];
          for (let i = 1; i < data.length; i++) {
            filtered[i] = data[i] - 0.97 * data[i - 1];
          }
          return filtered;
        }
      `], { type: 'application/javascript' });
      
      const workerUrl = URL.createObjectURL(workerBlob);
      this.audioWorker = new Worker(workerUrl);
      
      console.log('Audio Web Worker enabled');
      this.notifyListeners('audioWorkerEnabled', { enabled: true });
      
    } catch (error) {
      console.warn('Failed to enable audio Web Worker:', error);
    }
  }

  /**
   * Optimize memory usage
   */
  optimizeMemoryUsage() {
    // Enable object pooling
    this.enableObjectPooling();
    
    // Optimize garbage collection
    this.optimizeGarbageCollection();
    
    // Enable memory monitoring
    this.enableMemoryMonitoring();
  }

  /**
   * Enable object pooling for frequently created objects
   */
  enableObjectPooling() {
    // Create pools for common objects
    this.objectPools = {
      audioBuffers: [],
      transcriptionResults: [],
      eventObjects: []
    };
    
    console.log('Object pooling enabled');
  }

  /**
   * Optimize garbage collection
   */
  optimizeGarbageCollection() {
    // Schedule regular cleanup
    this.scheduleMemoryCleanup();
    
    // Enable weak references where appropriate
    this.enableWeakReferences();
  }

  /**
   * Schedule memory cleanup
   */
  scheduleMemoryCleanup() {
    if (this.gcInterval) {
      clearInterval(this.gcInterval);
    }
    
    this.gcInterval = setInterval(() => {
      this.performMemoryCleanup();
    }, this.optimizations.gcInterval);
  }

  /**
   * Perform memory cleanup
   */
  performMemoryCleanup() {
    // Clear object pools
    if (this.objectPools) {
      Object.values(this.objectPools).forEach(pool => {
        pool.length = 0;
      });
    }
    
    // Force garbage collection if available
    if (window.gc) {
      window.gc();
    }
    
    // Clear caches
    this.clearCaches();
    
    console.log('Memory cleanup performed');
    this.notifyListeners('memoryCleanup', { timestamp: Date.now() });
  }

  /**
   * Clear various caches
   */
  clearCaches() {
    // Clear audio buffer caches
    if (window.audioBufferCache) {
      window.audioBufferCache.clear();
    }
    
    // Clear transcription caches
    if (window.transcriptionCache) {
      window.transcriptionCache.clear();
    }
  }

  /**
   * Enable weak references
   */
  enableWeakReferences() {
    if (typeof WeakRef !== 'undefined') {
      this.useWeakReferences = true;
      console.log('Weak references enabled');
    }
  }

  /**
   * Enable memory monitoring
   */
  enableMemoryMonitoring() {
    if (performance.memory) {
      this.memoryMonitoringEnabled = true;
      console.log('Memory monitoring enabled');
    }
  }

  /**
   * Optimize transcription processing
   */
  optimizeTranscriptionProcessing() {
    // Enable batch processing
    this.enableBatchProcessing();
    
    // Optimize STT service usage
    this.optimizeSTTServices();
    
    // Enable caching
    this.enableTranscriptionCaching();
  }

  /**
   * Enable batch processing for transcriptions
   */
  enableBatchProcessing() {
    this.batchProcessingEnabled = true;
    this.batchSize = this.optimizations.transcriptionBatchSize;
    
    console.log(`Batch processing enabled with size: ${this.batchSize}`);
    this.notifyListeners('batchProcessingEnabled', { batchSize: this.batchSize });
  }

  /**
   * Optimize STT services
   */
  optimizeSTTServices() {
    // Enable connection pooling for cloud services
    this.enableConnectionPooling();
    
    // Optimize local model loading
    this.optimizeLocalModels();
  }

  /**
   * Enable connection pooling
   */
  enableConnectionPooling() {
    this.connectionPoolingEnabled = true;
    console.log('Connection pooling enabled for STT services');
  }

  /**
   * Optimize local models
   */
  optimizeLocalModels() {
    // Enable model caching
    this.modelCachingEnabled = true;
    
    // Use quantized models if available
    this.useQuantizedModels = true;
    
    console.log('Local model optimizations enabled');
  }

  /**
   * Enable transcription caching
   */
  enableTranscriptionCaching() {
    this.transcriptionCachingEnabled = true;
    this.transcriptionCache = new Map();
    
    console.log('Transcription caching enabled');
  }

  /**
   * Optimize UI rendering
   */
  optimizeUIRendering() {
    // Enable virtual scrolling
    this.enableVirtualScrolling();
    
    // Optimize React rendering
    this.optimizeReactRendering();
    
    // Enable offscreen canvas
    this.enableOffscreenCanvas();
  }

  /**
   * Enable virtual scrolling
   */
  enableVirtualScrolling() {
    this.virtualScrollingEnabled = true;
    console.log('Virtual scrolling enabled');
    this.notifyListeners('virtualScrollingEnabled', { enabled: true });
  }

  /**
   * Optimize React rendering
   */
  optimizeReactRendering() {
    // Enable React.memo and useMemo optimizations
    this.reactOptimizationsEnabled = true;
    
    // Enable concurrent features if available
    this.enableConcurrentFeatures();
    
    console.log('React rendering optimizations enabled');
  }

  /**
   * Enable concurrent features
   */
  enableConcurrentFeatures() {
    if (typeof React !== 'undefined' && React.version >= '18.0.0') {
      this.concurrentFeaturesEnabled = true;
      console.log('React concurrent features enabled');
    }
  }

  /**
   * Enable offscreen canvas
   */
  enableOffscreenCanvas() {
    if (this.optimizations.enableOffscreenCanvas && typeof OffscreenCanvas !== 'undefined') {
      this.offscreenCanvasEnabled = true;
      console.log('Offscreen canvas enabled');
    }
  }

  /**
   * Trigger specific optimizations based on performance issues
   */
  triggerMemoryOptimization() {
    console.log('Triggering memory optimization due to high usage');
    this.performMemoryCleanup();
    this.notifyListeners('memoryOptimizationTriggered', this.performanceMetrics);
  }

  triggerAudioOptimization() {
    console.log('Triggering audio optimization due to high latency');
    this.optimizeAudioBuffers();
    this.notifyListeners('audioOptimizationTriggered', this.performanceMetrics);
  }

  triggerRenderingOptimization() {
    console.log('Triggering rendering optimization due to low frame rate');
    this.optimizeUIRendering();
    this.notifyListeners('renderingOptimizationTriggered', this.performanceMetrics);
  }

  triggerGarbageCollection() {
    console.log('Triggering garbage collection due to memory pressure');
    this.performMemoryCleanup();
  }

  /**
   * Start garbage collection management
   */
  startGarbageCollectionManagement() {
    this.scheduleMemoryCleanup();
  }

  /**
   * Get current performance metrics
   */
  getPerformanceMetrics() {
    return { ...this.performanceMetrics };
  }

  /**
   * Get optimization status
   */
  getOptimizationStatus() {
    return {
      isOptimizing: this.isOptimizing,
      performanceMode: this.performanceMode,
      enabledStrategies: Array.from(this.optimizationStrategies.entries())
        .filter(([, strategy]) => strategy.enabled)
        .map(([key, strategy]) => ({ key, name: strategy.name })),
      metrics: this.performanceMetrics,
      thresholds: this.thresholds
    };
  }

  /**
   * Stop performance optimization
   */
  stopOptimization() {
    if (!this.isOptimizing) {
      console.log('Performance optimization not active');
      return;
    }

    try {
      // Stop monitoring
      if (this.monitoringInterval) {
        clearInterval(this.monitoringInterval);
        this.monitoringInterval = null;
      }
      
      if (this.gcInterval) {
        clearInterval(this.gcInterval);
        this.gcInterval = null;
      }
      
      // Revert optimizations
      this.revertOptimizationStrategies();
      
      // Cleanup workers
      if (this.audioWorker) {
        this.audioWorker.terminate();
        this.audioWorker = null;
      }
      
      this.isOptimizing = false;
      
      console.log('Performance optimization stopped');
      this.notifyListeners('optimizationStopped', { timestamp: Date.now() });
      
    } catch (error) {
      console.error('Error stopping performance optimization:', error);
    }
  }

  /**
   * Revert optimization strategies
   */
  revertOptimizationStrategies() {
    for (const [key, strategy] of this.optimizationStrategies) {
      if (strategy.enabled && strategy.revert) {
        try {
          strategy.revert();
          console.log(`Reverted ${strategy.name} optimization`);
        } catch (error) {
          console.error(`Failed to revert ${strategy.name} optimization:`, error);
        }
      }
    }
  }

  /**
   * Revert audio optimizations
   */
  revertAudioOptimizations() {
    // Reset to default settings
    this.notifyListeners('audioOptimizationReverted', {});
  }

  /**
   * Revert memory optimizations
   */
  revertMemoryOptimizations() {
    // Clear object pools
    this.objectPools = null;
    this.useWeakReferences = false;
  }

  /**
   * Revert transcription optimizations
   */
  revertTranscriptionOptimizations() {
    this.batchProcessingEnabled = false;
    this.transcriptionCachingEnabled = false;
    if (this.transcriptionCache) {
      this.transcriptionCache.clear();
    }
  }

  /**
   * Revert UI optimizations
   */
  revertUIOptimizations() {
    this.virtualScrollingEnabled = false;
    this.reactOptimizationsEnabled = false;
    this.offscreenCanvasEnabled = false;
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
    this.stopOptimization();
    this.eventListeners.clear();
    console.log('Performance optimizer cleaned up');
  }
}

export default PerformanceOptimizer;