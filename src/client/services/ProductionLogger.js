// Production Logger - Comprehensive logging and monitoring for production deployment
class ProductionLogger {
  constructor() {
    this.isActive = false;
    this.logLevel = 'info'; // 'debug', 'info', 'warn', 'error'
    this.logBuffer = [];
    this.maxBufferSize = 1000;
    this.flushInterval = 30000; // 30 seconds
    
    // Log configuration
    this.config = {
      enableConsoleLogging: true,
      enableRemoteLogging: false,
      enableLocalStorage: true,
      enablePerformanceLogging: true,
      enableErrorTracking: true,
      enableUserActionTracking: true,
      remoteEndpoint: null,
      apiKey: null,
      sessionId: this.generateSessionId(),
      userId: null
    };
    
    // Log categories
    this.categories = {
      SYSTEM: 'system',
      AUDIO: 'audio',
      TRANSCRIPTION: 'transcription',
      NETWORK: 'network',
      UI: 'ui',
      ERROR: 'error',
      PERFORMANCE: 'performance',
      USER_ACTION: 'user_action',
      SECURITY: 'security'
    };
    
    // Log levels
    this.levels = {
      DEBUG: 0,
      INFO: 1,
      WARN: 2,
      ERROR: 3
    };
    
    this.eventListeners = new Map();
    this.flushTimer = null;
    
    // Initialize logger
    this.initializeLogger();
  }

  /**
   * Initialize production logger
   */
  initializeLogger() {
    // Set up error handling
    this.setupGlobalErrorHandling();
    
    // Set up performance monitoring
    this.setupPerformanceMonitoring();
    
    // Set up user action tracking
    this.setupUserActionTracking();
    
    // Load configuration from storage
    this.loadConfiguration();
  }

  /**
   * Start production logging
   */
  start(config = {}) {
    if (this.isActive) {
      console.log('Production logger already active');
      return;
    }

    try {
      // Update configuration
      this.config = { ...this.config, ...config };
      
      this.isActive = true;
      
      // Start log flushing
      this.startLogFlushing();
      
      // Log startup
      this.log('info', this.categories.SYSTEM, 'Production logger started', {
        sessionId: this.config.sessionId,
        timestamp: Date.now(),
        userAgent: navigator.userAgent,
        url: window.location.href
      });
      
      console.log('Production logger started');
      this.notifyListeners('loggerStarted', { sessionId: this.config.sessionId });
      
    } catch (error) {
      this.isActive = false;
      console.error('Failed to start production logger:', error);
      throw error;
    }
  }

  /**
   * Setup global error handling
   */
  setupGlobalErrorHandling() {
    // Catch unhandled errors
    window.addEventListener('error', (event) => {
      this.logError('Unhandled Error', event.error, {
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        message: event.message
      });
    });
    
    // Catch unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
      this.logError('Unhandled Promise Rejection', event.reason, {
        promise: event.promise
      });
    });
    
    // Catch console errors
    const originalConsoleError = console.error;
    console.error = (...args) => {
      this.log('error', this.categories.ERROR, 'Console Error', {
        arguments: args.map(arg => 
          typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
        )
      });
      originalConsoleError.apply(console, args);
    };
  }

  /**
   * Setup performance monitoring
   */
  setupPerformanceMonitoring() {
    if (!this.config.enablePerformanceLogging) {
      return;
    }
    
    // Monitor long tasks
    if ('PerformanceObserver' in window) {
      try {
        const observer = new PerformanceObserver((list) => {
          list.getEntries().forEach(entry => {
            if (entry.duration > 50) { // Log tasks longer than 50ms
              this.log('warn', this.categories.PERFORMANCE, 'Long Task Detected', {
                duration: entry.duration,
                startTime: entry.startTime,
                name: entry.name
              });
            }
          });
        });
        
        observer.observe({ entryTypes: ['longtask'] });
      } catch (error) {
        console.warn('Failed to set up performance observer:', error);
      }
    }
    
    // Monitor memory usage
    if (performance.memory) {
      setInterval(() => {
        const memoryUsage = (performance.memory.usedJSHeapSize / performance.memory.totalJSHeapSize) * 100;
        
        if (memoryUsage > 80) {
          this.log('warn', this.categories.PERFORMANCE, 'High Memory Usage', {
            usage: memoryUsage,
            used: performance.memory.usedJSHeapSize,
            total: performance.memory.totalJSHeapSize
          });
        }
      }, 60000); // Check every minute
    }
  }

  /**
   * Setup user action tracking
   */
  setupUserActionTracking() {
    if (!this.config.enableUserActionTracking) {
      return;
    }
    
    // Track clicks
    document.addEventListener('click', (event) => {
      this.logUserAction('click', {
        target: this.getElementSelector(event.target),
        timestamp: Date.now(),
        coordinates: { x: event.clientX, y: event.clientY }
      });
    });
    
    // Track page visibility changes
    document.addEventListener('visibilitychange', () => {
      this.logUserAction('visibility_change', {
        hidden: document.hidden,
        timestamp: Date.now()
      });
    });
    
    // Track navigation
    window.addEventListener('beforeunload', () => {
      this.logUserAction('page_unload', {
        url: window.location.href,
        timestamp: Date.now()
      });
    });
  }

  /**
   * Get CSS selector for element
   */
  getElementSelector(element) {
    if (!element) return 'unknown';
    
    if (element.id) {
      return `#${element.id}`;
    }
    
    if (element.className) {
      return `.${element.className.split(' ').join('.')}`;
    }
    
    return element.tagName.toLowerCase();
  }

  /**
   * Start log flushing
   */
  startLogFlushing() {
    this.flushTimer = setInterval(() => {
      this.flushLogs();
    }, this.flushInterval);
  }

  /**
   * Generate unique session ID
   */
  generateSessionId() {
    return `session_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  }

  /**
   * Load configuration from storage
   */
  loadConfiguration() {
    try {
      const stored = localStorage.getItem('productionLogger.config');
      if (stored) {
        const config = JSON.parse(stored);
        this.config = { ...this.config, ...config };
      }
    } catch (error) {
      console.warn('Failed to load logger configuration:', error);
    }
  }

  /**
   * Save configuration to storage
   */
  saveConfiguration() {
    try {
      localStorage.setItem('productionLogger.config', JSON.stringify(this.config));
    } catch (error) {
      console.warn('Failed to save logger configuration:', error);
    }
  }

  /**
   * Log message
   */
  log(level, category, message, data = {}) {
    if (!this.shouldLog(level)) {
      return;
    }
    
    const logEntry = {
      timestamp: Date.now(),
      level: level,
      category: category,
      message: message,
      data: data,
      sessionId: this.config.sessionId,
      userId: this.config.userId,
      url: window.location.href,
      userAgent: navigator.userAgent
    };
    
    // Add to buffer
    this.addToBuffer(logEntry);
    
    // Console logging
    if (this.config.enableConsoleLogging) {
      this.logToConsole(logEntry);
    }
    
    // Notify listeners
    this.notifyListeners('logEntry', logEntry);
    
    // Immediate flush for errors
    if (level === 'error') {
      this.flushLogs();
    }
  }

  /**
   * Check if message should be logged based on level
   */
  shouldLog(level) {
    const messageLevel = this.levels[level.toUpperCase()];
    const currentLevel = this.levels[this.logLevel.toUpperCase()];
    return messageLevel >= currentLevel;
  }

  /**
   * Add log entry to buffer
   */
  addToBuffer(logEntry) {
    this.logBuffer.push(logEntry);
    
    // Prevent buffer overflow
    if (this.logBuffer.length > this.maxBufferSize) {
      this.logBuffer.shift();
    }
  }

  /**
   * Log to console with appropriate method
   */
  logToConsole(logEntry) {
    const { level, category, message, data } = logEntry;
    const logMessage = `[${category.toUpperCase()}] ${message}`;
    
    switch (level) {
      case 'debug':
        console.debug(logMessage, data);
        break;
      case 'info':
        console.info(logMessage, data);
        break;
      case 'warn':
        console.warn(logMessage, data);
        break;
      case 'error':
        console.error(logMessage, data);
        break;
      default:
        console.log(logMessage, data);
    }
  }

  /**
   * Log error with stack trace
   */
  logError(message, error, additionalData = {}) {
    const errorData = {
      ...additionalData,
      error: {
        name: error?.name || 'Unknown',
        message: error?.message || 'No message',
        stack: error?.stack || 'No stack trace'
      }
    };
    
    this.log('error', this.categories.ERROR, message, errorData);
  }

  /**
   * Log user action
   */
  logUserAction(action, data = {}) {
    this.log('info', this.categories.USER_ACTION, `User Action: ${action}`, data);
  }

  /**
   * Log performance metric
   */
  logPerformance(metric, value, data = {}) {
    this.log('info', this.categories.PERFORMANCE, `Performance: ${metric}`, {
      ...data,
      metric: metric,
      value: value
    });
  }

  /**
   * Log security event
   */
  logSecurity(event, data = {}) {
    this.log('warn', this.categories.SECURITY, `Security Event: ${event}`, data);
  }

  /**
   * Log audio event
   */
  logAudio(event, data = {}) {
    this.log('info', this.categories.AUDIO, `Audio: ${event}`, data);
  }

  /**
   * Log transcription event
   */
  logTranscription(event, data = {}) {
    this.log('info', this.categories.TRANSCRIPTION, `Transcription: ${event}`, data);
  }

  /**
   * Log network event
   */
  logNetwork(event, data = {}) {
    this.log('info', this.categories.NETWORK, `Network: ${event}`, data);
  }

  /**
   * Log UI event
   */
  logUI(event, data = {}) {
    this.log('info', this.categories.UI, `UI: ${event}`, data);
  }

  /**
   * Flush logs to storage and remote endpoint
   */
  async flushLogs() {
    if (this.logBuffer.length === 0) {
      return;
    }
    
    const logsToFlush = [...this.logBuffer];
    this.logBuffer = [];
    
    try {
      // Save to local storage
      if (this.config.enableLocalStorage) {
        await this.saveToLocalStorage(logsToFlush);
      }
      
      // Send to remote endpoint
      if (this.config.enableRemoteLogging && this.config.remoteEndpoint) {
        await this.sendToRemoteEndpoint(logsToFlush);
      }
      
    } catch (error) {
      console.error('Failed to flush logs:', error);
      
      // Put logs back in buffer if flush failed
      this.logBuffer.unshift(...logsToFlush);
    }
  }

  /**
   * Save logs to local storage
   */
  async saveToLocalStorage(logs) {
    try {
      const existingLogs = JSON.parse(localStorage.getItem('productionLogs') || '[]');
      const allLogs = [...existingLogs, ...logs];
      
      // Keep only recent logs (last 24 hours)
      const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
      const recentLogs = allLogs.filter(log => log.timestamp > oneDayAgo);
      
      localStorage.setItem('productionLogs', JSON.stringify(recentLogs));
      
    } catch (error) {
      console.warn('Failed to save logs to local storage:', error);
    }
  }

  /**
   * Send logs to remote endpoint
   */
  async sendToRemoteEndpoint(logs) {
    if (!this.config.remoteEndpoint || !this.config.apiKey) {
      return;
    }
    
    try {
      const response = await fetch(this.config.remoteEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.config.apiKey}`
        },
        body: JSON.stringify({
          logs: logs,
          sessionId: this.config.sessionId,
          timestamp: Date.now()
        })
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
    } catch (error) {
      console.warn('Failed to send logs to remote endpoint:', error);
      throw error;
    }
  }

  /**
   * Get logs from local storage
   */
  getStoredLogs(filter = {}) {
    try {
      const logs = JSON.parse(localStorage.getItem('productionLogs') || '[]');
      
      // Apply filters
      let filteredLogs = logs;
      
      if (filter.level) {
        filteredLogs = filteredLogs.filter(log => log.level === filter.level);
      }
      
      if (filter.category) {
        filteredLogs = filteredLogs.filter(log => log.category === filter.category);
      }
      
      if (filter.since) {
        filteredLogs = filteredLogs.filter(log => log.timestamp >= filter.since);
      }
      
      return filteredLogs;
      
    } catch (error) {
      console.error('Failed to get stored logs:', error);
      return [];
    }
  }

  /**
   * Export logs
   */
  exportLogs(format = 'json') {
    const logs = this.getStoredLogs();
    
    switch (format) {
      case 'json':
        return JSON.stringify(logs, null, 2);
      case 'csv':
        return this.convertLogsToCSV(logs);
      case 'txt':
        return this.convertLogsToText(logs);
      default:
        return logs;
    }
  }

  /**
   * Convert logs to CSV format
   */
  convertLogsToCSV(logs) {
    const headers = ['timestamp', 'level', 'category', 'message', 'data'];
    const rows = [headers.join(',')];
    
    logs.forEach(log => {
      const row = [
        new Date(log.timestamp).toISOString(),
        log.level,
        log.category,
        `"${log.message.replace(/"/g, '""')}"`,
        `"${JSON.stringify(log.data).replace(/"/g, '""')}"`
      ];
      rows.push(row.join(','));
    });
    
    return rows.join('\n');
  }

  /**
   * Convert logs to text format
   */
  convertLogsToText(logs) {
    return logs.map(log => {
      const timestamp = new Date(log.timestamp).toISOString();
      return `[${timestamp}] [${log.level.toUpperCase()}] [${log.category}] ${log.message}`;
    }).join('\n');
  }

  /**
   * Clear stored logs
   */
  clearStoredLogs() {
    try {
      localStorage.removeItem('productionLogs');
      console.log('Stored logs cleared');
    } catch (error) {
      console.error('Failed to clear stored logs:', error);
    }
  }

  /**
   * Set log level
   */
  setLogLevel(level) {
    if (this.levels[level.toUpperCase()] !== undefined) {
      this.logLevel = level.toLowerCase();
      this.saveConfiguration();
    }
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig) {
    this.config = { ...this.config, ...newConfig };
    this.saveConfiguration();
    
    this.log('info', this.categories.SYSTEM, 'Logger configuration updated', newConfig);
  }

  /**
   * Get logger statistics
   */
  getStats() {
    const logs = this.getStoredLogs();
    const stats = {
      totalLogs: logs.length,
      bufferSize: this.logBuffer.length,
      sessionId: this.config.sessionId,
      logLevel: this.logLevel
    };
    
    // Count by level
    Object.keys(this.levels).forEach(level => {
      stats[`${level.toLowerCase()}Count`] = logs.filter(log => 
        log.level === level.toLowerCase()
      ).length;
    });
    
    // Count by category
    Object.values(this.categories).forEach(category => {
      stats[`${category}Count`] = logs.filter(log => 
        log.category === category
      ).length;
    });
    
    return stats;
  }

  /**
   * Stop production logging
   */
  stop() {
    if (!this.isActive) {
      console.log('Production logger not active');
      return;
    }

    try {
      // Stop flushing timer
      if (this.flushTimer) {
        clearInterval(this.flushTimer);
        this.flushTimer = null;
      }
      
      // Flush remaining logs
      this.flushLogs();
      
      this.isActive = false;
      
      console.log('Production logger stopped');
      this.notifyListeners('loggerStopped', { timestamp: Date.now() });
      
    } catch (error) {
      console.error('Error stopping production logger:', error);
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
    this.eventListeners.clear();
    console.log('Production logger cleaned up');
  }
}

export default ProductionLogger;