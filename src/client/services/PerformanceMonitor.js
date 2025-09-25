// Performance Monitor - Comprehensive performance monitoring and metrics collection
class PerformanceMonitor {
  constructor() {
    this.isMonitoring = false;
    this.metrics = new Map();
    this.observers = new Map();
    this.timers = new Map();
    this.counters = new Map();
    this.histograms = new Map();
    
    // Performance thresholds
    this.thresholds = {
      audioLatency: 100, // ms
      transcriptionLatency: 2000, // ms
      memoryUsage: 85, // %
      cpuUsage: 80, // %
      frameRate: 30, // fps
      networkLatency: 1000, // ms
      errorRate: 5 // %
    };
    
    // Monitoring intervals
    this.intervals = {
      system: 1000, // 1 second
      audio: 100, // 100ms
      transcription: 500, // 500ms
      network: 5000, // 5 seconds
      ui: 16 // ~60fps
    };
    
    // Metric storage
    this.metricHistory = new Map();
    this.maxHistorySize = 1000;
    
    this.eventListeners = new Map();
    this.monitoringIntervals = new Map();
    
    // Initialize performance observers
    this.initializePerformanceObservers();
  }

  /**
   * Initialize performance observers
   */
  initializePerformanceObservers() {
    try {
      // Long Task Observer
      if ('PerformanceObserver' in window && 'PerformanceLongTaskTiming' in window) {
        this.observers.set('longTask', new PerformanceObserver((list) => {
          this.handleLongTasks(list.getEntries());
        }));
      }
      
      // Navigation Observer
      if ('PerformanceObserver' in window) {
        this.observers.set('navigation', new PerformanceObserver((list) => {
          this.handleNavigationTiming(list.getEntries());
        }));
      }
      
      // Resource Observer
      if ('PerformanceObserver' in window) {
        this.observers.set('resource', new PerformanceObserver((list) => {
          this.handleResourceTiming(list.getEntries());
        }));
      }
      
      // Measure Observer
      if ('PerformanceObserver' in window) {
        this.observers.set('measure', new PerformanceObserver((list) => {
          this.handleMeasures(list.getEntries());
        }));
      }
      
      console.log('Performance observers initialized');
      
    } catch (error) {
      console.warn('Failed to initialize performance observers:', error);
    }
  }

  /**
   * Start performance monitoring
   */
  start() {
    if (this.isMonitoring) {
      console.log('Performance monitoring already active');
      return;
    }

    try {
      this.isMonitoring = true;
      
      // Start performance observers
      this.startPerformanceObservers();
      
      // Start monitoring intervals
      this.startMonitoringIntervals();
      
      // Initialize metrics
      this.initializeMetrics();
      
      console.log('Performance monitoring started');
      this.notifyListeners('monitoringStarted', { timestamp: Date.now() });
      
    } catch (error) {
      this.isMonitoring = false;
      console.error('Failed to start performance monitoring:', error);
      throw error;
    }
  }

  /**
   * Start performance observers
   */
  startPerformanceObservers() {
    try {
      // Start long task observer
      const longTaskObserver = this.observers.get('longTask');
      if (longTaskObserver) {
        longTaskObserver.observe({ entryTypes: ['longtask'] });
      }
      
      // Start navigation observer
      const navigationObserver = this.observers.get('navigation');
      if (navigationObserver) {
        navigationObserver.observe({ entryTypes: ['navigation'] });
      }
      
      // Start resource observer
      const resourceObserver = this.observers.get('resource');
      if (resourceObserver) {
        resourceObserver.observe({ entryTypes: ['resource'] });
      }
      
      // Start measure observer
      const measureObserver = this.observers.get('measure');
      if (measureObserver) {
        measureObserver.observe({ entryTypes: ['measure'] });
      }
      
    } catch (error) {
      console.warn('Error starting performance observers:', error);
    }
  }

  /**
   * Start monitoring intervals
   */
  startMonitoringIntervals() {
    // System metrics monitoring
    this.monitoringIntervals.set('system', setInterval(() => {
      this.collectSystemMetrics();
    }, this.intervals.system));
    
    // Audio metrics monitoring
    this.monitoringIntervals.set('audio', setInterval(() => {
      this.collectAudioMetrics();
    }, this.intervals.audio));
    
    // Transcription metrics monitoring
    this.monitoringIntervals.set('transcription', setInterval(() => {
      this.collectTranscriptionMetrics();
    }, this.intervals.transcription));
    
    // Network metrics monitoring
    this.monitoringIntervals.set('network', setInterval(() => {
      this.collectNetworkMetrics();
    }, this.intervals.network));
    
    // UI metrics monitoring
    this.monitoringIntervals.set('ui', setInterval(() => {
      this.collectUIMetrics();
    }, this.intervals.ui));
  }

  /**
   * Initialize metrics
   */
  initializeMetrics() {
    // System metrics
    this.initializeMetric('system.memory.usage', 'gauge');
    this.initializeMetric('system.memory.heap', 'gauge');
    this.initializeMetric('system.cpu.usage', 'gauge');
    
    // Audio metrics
    this.initializeMetric('audio.latency', 'histogram');
    this.initializeMetric('audio.quality.snr', 'gauge');
    this.initializeMetric('audio.quality.volume', 'gauge');
    this.initializeMetric('audio.buffer.underruns', 'counter');
    
    // Transcription metrics
    this.initializeMetric('transcription.latency', 'histogram');
    this.initializeMetric('transcription.confidence', 'histogram');
    this.initializeMetric('transcription.throughput', 'gauge');
    this.initializeMetric('transcription.errors', 'counter');
    
    // Network metrics
    this.initializeMetric('network.latency', 'histogram');
    this.initializeMetric('network.bandwidth', 'gauge');
    this.initializeMetric('network.errors', 'counter');
    
    // UI metrics
    this.initializeMetric('ui.framerate', 'gauge');
    this.initializeMetric('ui.render.time', 'histogram');
    this.initializeMetric('ui.interactions', 'counter');
    
    // Application metrics
    this.initializeMetric('app.errors', 'counter');
    this.initializeMetric('app.warnings', 'counter');
    this.initializeMetric('app.sessions', 'counter');
  }

  /**
   * Initialize a specific metric
   */
  initializeMetric(name, type) {
    const metric = {
      name: name,
      type: type,
      value: type === 'counter' ? 0 : null,
      samples: [],
      lastUpdated: Date.now(),
      min: Infinity,
      max: -Infinity,
      sum: 0,
      count: 0
    };
    
    this.metrics.set(name, metric);
    
    // Initialize type-specific storage
    switch (type) {
      case 'counter':
        this.counters.set(name, 0);
        break;
      case 'histogram':
        this.histograms.set(name, []);
        break;
    }
  }

  /**
   * Collect system metrics
   */
  collectSystemMetrics() {
    try {
      // Memory metrics
      if (performance.memory) {
        const memoryUsage = (performance.memory.usedJSHeapSize / performance.memory.totalJSHeapSize) * 100;
        this.recordGauge('system.memory.usage', memoryUsage);
        this.recordGauge('system.memory.heap', performance.memory.usedJSHeapSize);
      }
      
      // CPU usage (approximate using timing)
      this.measureCPUUsage();
      
    } catch (error) {
      console.error('Error collecting system metrics:', error);
    }
  }

  /**
   * Measure CPU usage approximation
   */
  measureCPUUsage() {
    const start = performance.now();
    const iterations = 10000;
    
    // Perform some CPU work
    for (let i = 0; i < iterations; i++) {
      Math.random();
    }
    
    const duration = performance.now() - start;
    const expectedDuration = 1; // Expected duration for this work
    const cpuUsage = Math.min((duration / expectedDuration) * 100, 100);
    
    this.recordGauge('system.cpu.usage', cpuUsage);
  }

  /**
   * Collect audio metrics
   */
  collectAudioMetrics() {
    try {
      // Get audio processor metrics if available
      if (window.audioProcessor) {
        const status = window.audioProcessor.getStatus();
        const qualityMetrics = window.audioProcessor.getQualityMetrics();
        
        if (qualityMetrics) {
          this.recordGauge('audio.quality.snr', qualityMetrics.signalToNoiseRatio);
          this.recordGauge('audio.quality.volume', qualityMetrics.averageVolume);
        }
        
        // Measure audio latency
        if (window.audioContext) {
          const latency = (window.audioContext.baseLatency || 0) * 1000;
          this.recordHistogram('audio.latency', latency);
        }
      }
      
    } catch (error) {
      console.error('Error collecting audio metrics:', error);
    }
  }

  /**
   * Collect transcription metrics
   */
  collectTranscriptionMetrics() {
    try {
      // Get transcription engine metrics if available
      if (window.transcriptionEngine) {
        const metrics = window.transcriptionEngine.getMetrics();
        
        if (metrics) {
          this.recordHistogram('transcription.confidence', metrics.averageConfidence);
          this.recordGauge('transcription.throughput', metrics.successfulTranscriptions);
          
          if (metrics.averageProcessingTime) {
            this.recordHistogram('transcription.latency', metrics.averageProcessingTime);
          }
        }
      }
      
    } catch (error) {
      console.error('Error collecting transcription metrics:', error);
    }
  }

  /**
   * Collect network metrics
   */
  collectNetworkMetrics() {
    try {
      // Measure network latency using a simple ping
      this.measureNetworkLatency();
      
      // Get connection information
      if (navigator.connection) {
        const connection = navigator.connection;
        this.recordGauge('network.bandwidth', connection.downlink || 0);
      }
      
    } catch (error) {
      console.error('Error collecting network metrics:', error);
    }
  }

  /**
   * Measure network latency
   */
  async measureNetworkLatency() {
    try {
      const start = performance.now();
      
      // Use a small image or endpoint for latency measurement
      const response = await fetch('/favicon.ico', { 
        method: 'HEAD',
        cache: 'no-cache'
      });
      
      if (response.ok) {
        const latency = performance.now() - start;
        this.recordHistogram('network.latency', latency);
      }
      
    } catch (error) {
      this.incrementCounter('network.errors');
    }
  }

  /**
   * Collect UI metrics
   */
  collectUIMetrics() {
    try {
      // Measure frame rate
      this.measureFrameRate();
      
      // Measure render time
      this.measureRenderTime();
      
    } catch (error) {
      console.error('Error collecting UI metrics:', error);
    }
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
      const frameRate = Math.round((this.frameRateCounter.frames * 1000) / elapsed);
      this.recordGauge('ui.framerate', frameRate);
      
      this.frameRateCounter.frames = 0;
      this.frameRateCounter.lastTime = currentTime;
    }
  }

  /**
   * Measure render time
   */
  measureRenderTime() {
    if (typeof requestIdleCallback !== 'undefined') {
      requestIdleCallback((deadline) => {
        const renderTime = 16.67 - deadline.timeRemaining(); // 60fps = 16.67ms per frame
        this.recordHistogram('ui.render.time', renderTime);
      });
    }
  }

  /**
   * Handle long tasks
   */
  handleLongTasks(entries) {
    entries.forEach(entry => {
      console.warn(`Long task detected: ${entry.duration}ms`);
      
      this.notifyListeners('longTask', {
        duration: entry.duration,
        startTime: entry.startTime,
        name: entry.name
      });
      
      // Check if it exceeds threshold
      if (entry.duration > 50) { // 50ms threshold
        this.notifyListeners('performanceIssue', {
          type: 'longTask',
          severity: entry.duration > 100 ? 'high' : 'medium',
          details: entry
        });
      }
    });
  }

  /**
   * Handle navigation timing
   */
  handleNavigationTiming(entries) {
    entries.forEach(entry => {
      const metrics = {
        domContentLoaded: entry.domContentLoadedEventEnd - entry.domContentLoadedEventStart,
        loadComplete: entry.loadEventEnd - entry.loadEventStart,
        firstPaint: entry.responseEnd - entry.requestStart,
        domInteractive: entry.domInteractive - entry.navigationStart
      };
      
      this.notifyListeners('navigationTiming', metrics);
    });
  }

  /**
   * Handle resource timing
   */
  handleResourceTiming(entries) {
    entries.forEach(entry => {
      const duration = entry.responseEnd - entry.requestStart;
      
      if (duration > this.thresholds.networkLatency) {
        this.notifyListeners('slowResource', {
          name: entry.name,
          duration: duration,
          size: entry.transferSize
        });
      }
    });
  }

  /**
   * Handle custom measures
   */
  handleMeasures(entries) {
    entries.forEach(entry => {
      this.recordHistogram(`custom.${entry.name}`, entry.duration);
    });
  }

  /**
   * Record a gauge metric
   */
  recordGauge(name, value) {
    const metric = this.metrics.get(name);
    if (!metric) {
      console.warn(`Metric ${name} not found`);
      return;
    }
    
    metric.value = value;
    metric.lastUpdated = Date.now();
    
    // Update statistics
    metric.min = Math.min(metric.min, value);
    metric.max = Math.max(metric.max, value);
    metric.sum += value;
    metric.count++;
    
    // Add to history
    this.addToHistory(name, value);
    
    // Check thresholds
    this.checkThreshold(name, value);
  }

  /**
   * Record a histogram metric
   */
  recordHistogram(name, value) {
    const metric = this.metrics.get(name);
    if (!metric) {
      console.warn(`Metric ${name} not found`);
      return;
    }
    
    const histogram = this.histograms.get(name);
    if (histogram) {
      histogram.push(value);
      
      // Keep only recent samples
      if (histogram.length > 1000) {
        histogram.shift();
      }
    }
    
    // Update metric statistics
    metric.min = Math.min(metric.min, value);
    metric.max = Math.max(metric.max, value);
    metric.sum += value;
    metric.count++;
    metric.lastUpdated = Date.now();
    
    // Add to history
    this.addToHistory(name, value);
    
    // Check thresholds
    this.checkThreshold(name, value);
  }

  /**
   * Increment a counter metric
   */
  incrementCounter(name, amount = 1) {
    const metric = this.metrics.get(name);
    if (!metric) {
      console.warn(`Metric ${name} not found`);
      return;
    }
    
    const counter = this.counters.get(name);
    if (counter !== undefined) {
      this.counters.set(name, counter + amount);
      metric.value = counter + amount;
      metric.lastUpdated = Date.now();
    }
    
    // Add to history
    this.addToHistory(name, amount);
  }

  /**
   * Add value to metric history
   */
  addToHistory(name, value) {
    if (!this.metricHistory.has(name)) {
      this.metricHistory.set(name, []);
    }
    
    const history = this.metricHistory.get(name);
    history.push({
      value: value,
      timestamp: Date.now()
    });
    
    // Keep only recent history
    if (history.length > this.maxHistorySize) {
      history.shift();
    }
  }

  /**
   * Check if metric exceeds threshold
   */
  checkThreshold(name, value) {
    const thresholdKey = name.split('.').pop();
    const threshold = this.thresholds[thresholdKey];
    
    if (threshold && value > threshold) {
      this.notifyListeners('thresholdExceeded', {
        metric: name,
        value: value,
        threshold: threshold,
        timestamp: Date.now()
      });
    }
  }

  /**
   * Start custom timer
   */
  startTimer(name) {
    this.timers.set(name, performance.now());
  }

  /**
   * End custom timer and record duration
   */
  endTimer(name) {
    const startTime = this.timers.get(name);
    if (startTime) {
      const duration = performance.now() - startTime;
      this.recordHistogram(`timer.${name}`, duration);
      this.timers.delete(name);
      return duration;
    }
    return null;
  }

  /**
   * Create custom performance mark
   */
  mark(name) {
    if (performance.mark) {
      performance.mark(name);
    }
  }

  /**
   * Create custom performance measure
   */
  measure(name, startMark, endMark) {
    if (performance.measure) {
      try {
        performance.measure(name, startMark, endMark);
      } catch (error) {
        console.warn(`Failed to create measure ${name}:`, error);
      }
    }
  }

  /**
   * Get metric value
   */
  getMetric(name) {
    const metric = this.metrics.get(name);
    return metric ? metric.value : null;
  }

  /**
   * Get metric statistics
   */
  getMetricStats(name) {
    const metric = this.metrics.get(name);
    if (!metric) {
      return null;
    }
    
    return {
      name: metric.name,
      type: metric.type,
      value: metric.value,
      min: metric.min === Infinity ? null : metric.min,
      max: metric.max === -Infinity ? null : metric.max,
      average: metric.count > 0 ? metric.sum / metric.count : null,
      count: metric.count,
      lastUpdated: metric.lastUpdated
    };
  }

  /**
   * Get all metrics
   */
  getAllMetrics() {
    const allMetrics = {};
    
    this.metrics.forEach((metric, name) => {
      allMetrics[name] = this.getMetricStats(name);
    });
    
    return allMetrics;
  }

  /**
   * Get metric history
   */
  getMetricHistory(name, duration = 300000) { // Default 5 minutes
    const history = this.metricHistory.get(name);
    if (!history) {
      return [];
    }
    
    const cutoff = Date.now() - duration;
    return history.filter(entry => entry.timestamp > cutoff);
  }

  /**
   * Get performance summary
   */
  getPerformanceSummary() {
    const summary = {
      timestamp: Date.now(),
      system: {
        memoryUsage: this.getMetric('system.memory.usage'),
        cpuUsage: this.getMetric('system.cpu.usage')
      },
      audio: {
        latency: this.getMetricStats('audio.latency'),
        quality: {
          snr: this.getMetric('audio.quality.snr'),
          volume: this.getMetric('audio.quality.volume')
        }
      },
      transcription: {
        latency: this.getMetricStats('transcription.latency'),
        confidence: this.getMetricStats('transcription.confidence'),
        throughput: this.getMetric('transcription.throughput')
      },
      network: {
        latency: this.getMetricStats('network.latency'),
        bandwidth: this.getMetric('network.bandwidth')
      },
      ui: {
        frameRate: this.getMetric('ui.framerate'),
        renderTime: this.getMetricStats('ui.render.time')
      }
    };
    
    return summary;
  }

  /**
   * Export metrics data
   */
  exportMetrics(format = 'json') {
    const data = {
      timestamp: Date.now(),
      metrics: this.getAllMetrics(),
      history: {}
    };
    
    // Add history for key metrics
    const keyMetrics = [
      'system.memory.usage',
      'audio.latency',
      'transcription.latency',
      'ui.framerate'
    ];
    
    keyMetrics.forEach(metric => {
      data.history[metric] = this.getMetricHistory(metric);
    });
    
    switch (format) {
      case 'json':
        return JSON.stringify(data, null, 2);
      case 'csv':
        return this.convertToCSV(data);
      default:
        return data;
    }
  }

  /**
   * Convert metrics to CSV format
   */
  convertToCSV(data) {
    const lines = ['timestamp,metric,value'];
    
    Object.entries(data.metrics).forEach(([name, stats]) => {
      if (stats.value !== null) {
        lines.push(`${data.timestamp},${name},${stats.value}`);
      }
    });
    
    return lines.join('\n');
  }

  /**
   * Stop performance monitoring
   */
  stop() {
    if (!this.isMonitoring) {
      console.log('Performance monitoring not active');
      return;
    }

    try {
      // Stop observers
      this.observers.forEach(observer => {
        observer.disconnect();
      });
      
      // Stop intervals
      this.monitoringIntervals.forEach(interval => {
        clearInterval(interval);
      });
      this.monitoringIntervals.clear();
      
      this.isMonitoring = false;
      
      console.log('Performance monitoring stopped');
      this.notifyListeners('monitoringStopped', { timestamp: Date.now() });
      
    } catch (error) {
      console.error('Error stopping performance monitoring:', error);
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
    this.metrics.clear();
    this.metricHistory.clear();
    this.timers.clear();
    this.counters.clear();
    this.histograms.clear();
    this.eventListeners.clear();
    console.log('Performance monitor cleaned up');
  }
}

export default PerformanceMonitor;