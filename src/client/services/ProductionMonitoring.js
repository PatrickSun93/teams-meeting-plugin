/**
 * Production Monitoring Service
 * Monitors application health and performance in production
 */

class ProductionMonitoring {
  constructor() {
    this.isProduction = process.env.NODE_ENV === 'production';
    this.monitoringData = new Map();
    this.healthChecks = new Map();
    this.alerts = [];
    this.metrics = new Map();
    this.thresholds = this.initializeThresholds();
    
    if (this.isProduction) {
      this.initializeMonitoring();
    }
  }

  initializeThresholds() {
    return {
      // Performance thresholds
      audioLatency: 200, // ms
      transcriptionDelay: 1000, // ms
      memoryUsage: 200 * 1024 * 1024, // 200MB
      cpuUsage: 80, // percentage
      errorRate: 5, // percentage
      
      // Availability thresholds
      uptime: 99.5, // percentage
      responseTime: 2000, // ms
      successRate: 95, // percentage
      
      // Resource thresholds
      diskUsage: 80, // percentage
      networkLatency: 500, // ms
      apiResponseTime: 3000, // ms
      
      // Business metrics thresholds
      sessionDuration: 30 * 60 * 1000, // 30 minutes
      featureAdoption: 50, // percentage
      userSatisfaction: 4.0 // out of 5
    };
  }

  initializeMonitoring() {
    // Start health checks
    this.startHealthChecks();
    
    // Start performance monitoring
    this.startPerformanceMonitoring();
    
    // Start error monitoring
    this.startErrorMonitoring();
    
    // Start resource monitoring
    this.startResourceMonitoring();
    
    // Setup periodic reporting
    this.setupPeriodicReporting();
  }

  startHealthChecks() {
    // System health check
    this.healthChecks.set('system', {
      name: 'System Health',
      check: this.checkSystemHealth.bind(this),
      interval: 30000, // 30 seconds
      timeout: 5000,
      retries: 3
    });

    // Platform connectivity check
    this.healthChecks.set('platforms', {
      name: 'Platform Connectivity',
      check: this.checkPlatformConnectivity.bind(this),
      interval: 60000, // 1 minute
      timeout: 10000,
      retries: 2
    });

    // Service availability check
    this.healthChecks.set('services', {
      name: 'External Services',
      check: this.checkServiceAvailability.bind(this),
      interval: 120000, // 2 minutes
      timeout: 15000,
      retries: 3
    });

    // Audio system check
    this.healthChecks.set('audio', {
      name: 'Audio System',
      check: this.checkAudioSystem.bind(this),
      interval: 45000, // 45 seconds
      timeout: 8000,
      retries: 2
    });

    // Start all health checks
    for (const [key, healthCheck] of this.healthChecks) {
      this.startHealthCheck(key, healthCheck);
    }
  }

  startHealthCheck(key, healthCheck) {
    const runCheck = async () => {
      try {
        const startTime = Date.now();
        const result = await Promise.race([
          healthCheck.check(),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Health check timeout')), healthCheck.timeout)
          )
        ]);
        
        const duration = Date.now() - startTime;
        
        this.recordHealthCheckResult(key, {
          status: 'healthy',
          duration,
          result,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        this.recordHealthCheckResult(key, {
          status: 'unhealthy',
          error: error.message,
          timestamp: new Date().toISOString()
        });
        
        this.handleHealthCheckFailure(key, healthCheck, error);
      }
    };

    // Run immediately and then on interval
    runCheck();
    setInterval(runCheck, healthCheck.interval);
  }

  async checkSystemHealth() {
    const health = {
      memory: this.getMemoryHealth(),
      performance: this.getPerformanceHealth(),
      storage: await this.getStorageHealth(),
      network: await this.getNetworkHealth()
    };

    const isHealthy = Object.values(health).every(h => h.status === 'healthy');
    
    return {
      status: isHealthy ? 'healthy' : 'degraded',
      details: health
    };
  }

  getMemoryHealth() {
    if (!performance.memory) {
      return { status: 'unknown', reason: 'Memory API not available' };
    }

    const memoryUsage = performance.memory.usedJSHeapSize;
    const memoryLimit = performance.memory.jsHeapSizeLimit;
    const usagePercentage = (memoryUsage / memoryLimit) * 100;

    if (usagePercentage > 90) {
      return { status: 'critical', usage: usagePercentage, reason: 'Memory usage critical' };
    } else if (usagePercentage > 70) {
      return { status: 'warning', usage: usagePercentage, reason: 'Memory usage high' };
    } else {
      return { status: 'healthy', usage: usagePercentage };
    }
  }

  getPerformanceHealth() {
    const now = performance.now();
    const timing = performance.timing;
    
    if (!timing) {
      return { status: 'unknown', reason: 'Performance timing not available' };
    }

    const loadTime = timing.loadEventEnd - timing.navigationStart;
    const domReady = timing.domContentLoadedEventEnd - timing.navigationStart;

    if (loadTime > 10000) {
      return { status: 'critical', loadTime, reason: 'Load time critical' };
    } else if (loadTime > 5000) {
      return { status: 'warning', loadTime, reason: 'Load time high' };
    } else {
      return { status: 'healthy', loadTime, domReady };
    }
  }

  async getStorageHealth() {
    try {
      if (!navigator.storage || !navigator.storage.estimate) {
        return { status: 'unknown', reason: 'Storage API not available' };
      }

      const estimate = await navigator.storage.estimate();
      const usagePercentage = (estimate.usage / estimate.quota) * 100;

      if (usagePercentage > 90) {
        return { status: 'critical', usage: usagePercentage, reason: 'Storage nearly full' };
      } else if (usagePercentage > 70) {
        return { status: 'warning', usage: usagePercentage, reason: 'Storage usage high' };
      } else {
        return { status: 'healthy', usage: usagePercentage };
      }
    } catch (error) {
      return { status: 'error', reason: error.message };
    }
  }

  async getNetworkHealth() {
    try {
      if (!navigator.onLine) {
        return { status: 'critical', reason: 'No network connection' };
      }

      const connection = navigator.connection;
      if (connection) {
        const effectiveType = connection.effectiveType;
        const rtt = connection.rtt;

        if (effectiveType === 'slow-2g' || rtt > 2000) {
          return { status: 'warning', effectiveType, rtt, reason: 'Slow network connection' };
        } else {
          return { status: 'healthy', effectiveType, rtt };
        }
      }

      return { status: 'healthy', reason: 'Network connection available' };
    } catch (error) {
      return { status: 'error', reason: error.message };
    }
  }

  async checkPlatformConnectivity() {
    const platforms = ['teams', 'zoom', 'meet'];
    const results = {};

    for (const platform of platforms) {
      try {
        const connectivity = await this.testPlatformConnectivity(platform);
        results[platform] = connectivity;
      } catch (error) {
        results[platform] = { status: 'error', error: error.message };
      }
    }

    const healthyPlatforms = Object.values(results).filter(r => r.status === 'healthy').length;
    const totalPlatforms = platforms.length;

    return {
      status: healthyPlatforms === totalPlatforms ? 'healthy' : 
              healthyPlatforms > 0 ? 'degraded' : 'critical',
      platforms: results,
      healthyCount: healthyPlatforms,
      totalCount: totalPlatforms
    };
  }

  async testPlatformConnectivity(platform) {
    const startTime = Date.now();
    
    try {
      switch (platform) {
        case 'teams':
          return await this.testTeamsConnectivity();
        case 'zoom':
          return await this.testZoomConnectivity();
        case 'meet':
          return await this.testMeetConnectivity();
        default:
          throw new Error(`Unknown platform: ${platform}`);
      }
    } catch (error) {
      return {
        status: 'error',
        error: error.message,
        responseTime: Date.now() - startTime
      };
    }
  }

  async testTeamsConnectivity() {
    // Test Teams SDK availability and basic functionality
    if (typeof window !== 'undefined' && window.microsoftTeams) {
      return { status: 'healthy', sdk: 'available' };
    } else {
      return { status: 'warning', sdk: 'unavailable', reason: 'Teams SDK not loaded' };
    }
  }

  async testZoomConnectivity() {
    // Test Zoom SDK availability
    if (typeof window !== 'undefined' && window.ZoomMtg) {
      return { status: 'healthy', sdk: 'available' };
    } else {
      return { status: 'warning', sdk: 'unavailable', reason: 'Zoom SDK not loaded' };
    }
  }

  async testMeetConnectivity() {
    // Test Google Meet extension availability
    if (typeof window !== 'undefined' && window.chrome && window.chrome.runtime) {
      return { status: 'healthy', extension: 'available' };
    } else {
      return { status: 'warning', extension: 'unavailable', reason: 'Chrome extension not available' };
    }
  }

  async checkServiceAvailability() {
    const services = [
      { name: 'OpenAI', url: 'https://api.openai.com/v1/models', timeout: 5000 },
      { name: 'Azure', url: 'https://management.azure.com/', timeout: 5000 },
      { name: 'Anthropic', url: 'https://api.anthropic.com/', timeout: 5000 }
    ];

    const results = {};

    for (const service of services) {
      try {
        const startTime = Date.now();
        const response = await Promise.race([
          fetch(service.url, { method: 'HEAD', mode: 'no-cors' }),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Service timeout')), service.timeout)
          )
        ]);
        
        const responseTime = Date.now() - startTime;
        results[service.name] = {
          status: 'healthy',
          responseTime,
          available: true
        };
      } catch (error) {
        results[service.name] = {
          status: 'error',
          error: error.message,
          available: false
        };
      }
    }

    const availableServices = Object.values(results).filter(r => r.available).length;
    const totalServices = services.length;

    return {
      status: availableServices === totalServices ? 'healthy' : 
              availableServices > 0 ? 'degraded' : 'critical',
      services: results,
      availableCount: availableServices,
      totalCount: totalServices
    };
  }

  async checkAudioSystem() {
    try {
      const audioHealth = {
        mediaDevices: !!navigator.mediaDevices,
        audioContext: false,
        permissions: 'unknown'
      };

      // Test AudioContext
      try {
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        audioHealth.audioContext = audioContext.state === 'running' || audioContext.state === 'suspended';
        audioContext.close();
      } catch (error) {
        audioHealth.audioContextError = error.message;
      }

      // Test microphone permissions
      try {
        const permission = await navigator.permissions.query({ name: 'microphone' });
        audioHealth.permissions = permission.state;
      } catch (error) {
        audioHealth.permissionsError = error.message;
      }

      const isHealthy = audioHealth.mediaDevices && audioHealth.audioContext && 
                       audioHealth.permissions === 'granted';

      return {
        status: isHealthy ? 'healthy' : 'degraded',
        details: audioHealth
      };
    } catch (error) {
      return {
        status: 'error',
        error: error.message
      };
    }
  }

  recordHealthCheckResult(key, result) {
    if (!this.monitoringData.has('healthChecks')) {
      this.monitoringData.set('healthChecks', new Map());
    }

    const healthCheckData = this.monitoringData.get('healthChecks');
    if (!healthCheckData.has(key)) {
      healthCheckData.set(key, []);
    }

    const results = healthCheckData.get(key);
    results.push(result);

    // Keep only last 100 results
    if (results.length > 100) {
      results.splice(0, results.length - 100);
    }

    // Check for alerts
    this.checkHealthAlerts(key, result);
  }

  handleHealthCheckFailure(key, healthCheck, error) {
    console.error(`Health check failed for ${key}:`, error);

    // Implement retry logic
    if (healthCheck.retries > 0) {
      healthCheck.retries--;
      setTimeout(() => {
        this.startHealthCheck(key, healthCheck);
      }, 5000); // Retry after 5 seconds
    } else {
      this.createAlert('health_check_failure', {
        healthCheck: key,
        error: error.message,
        severity: 'high'
      });
    }
  }

  startPerformanceMonitoring() {
    // Monitor performance metrics every 10 seconds
    setInterval(() => {
      this.collectPerformanceMetrics();
    }, 10000);
  }

  collectPerformanceMetrics() {
    const metrics = {
      timestamp: new Date().toISOString(),
      memory: this.getMemoryMetrics(),
      performance: this.getPerformanceMetrics(),
      network: this.getNetworkMetrics(),
      custom: this.getCustomMetrics()
    };

    this.recordMetrics('performance', metrics);
    this.checkPerformanceAlerts(metrics);
  }

  getMemoryMetrics() {
    if (!performance.memory) return null;

    return {
      used: performance.memory.usedJSHeapSize,
      total: performance.memory.totalJSHeapSize,
      limit: performance.memory.jsHeapSizeLimit,
      usagePercentage: (performance.memory.usedJSHeapSize / performance.memory.jsHeapSizeLimit) * 100
    };
  }

  getPerformanceMetrics() {
    const entries = performance.getEntriesByType('navigation');
    if (entries.length === 0) return null;

    const navigation = entries[0];
    return {
      loadTime: navigation.loadEventEnd - navigation.loadEventStart,
      domContentLoaded: navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart,
      firstPaint: this.getFirstPaintTime(),
      firstContentfulPaint: this.getFirstContentfulPaintTime()
    };
  }

  getFirstPaintTime() {
    const entries = performance.getEntriesByName('first-paint');
    return entries.length > 0 ? entries[0].startTime : null;
  }

  getFirstContentfulPaintTime() {
    const entries = performance.getEntriesByName('first-contentful-paint');
    return entries.length > 0 ? entries[0].startTime : null;
  }

  getNetworkMetrics() {
    const connection = navigator.connection;
    if (!connection) return null;

    return {
      effectiveType: connection.effectiveType,
      downlink: connection.downlink,
      rtt: connection.rtt,
      saveData: connection.saveData
    };
  }

  getCustomMetrics() {
    // Collect application-specific metrics
    return {
      activeSessions: this.getActiveSessionCount(),
      transcriptionRate: this.getTranscriptionRate(),
      errorRate: this.getErrorRate(),
      featureUsage: this.getFeatureUsageMetrics()
    };
  }

  getActiveSessionCount() {
    // This would be implemented based on your session tracking
    return 0; // Placeholder
  }

  getTranscriptionRate() {
    // This would be implemented based on your transcription tracking
    return 0; // Placeholder
  }

  getErrorRate() {
    // This would be implemented based on your error tracking
    return 0; // Placeholder
  }

  getFeatureUsageMetrics() {
    // This would be implemented based on your feature tracking
    return {}; // Placeholder
  }

  recordMetrics(category, metrics) {
    if (!this.metrics.has(category)) {
      this.metrics.set(category, []);
    }

    const categoryMetrics = this.metrics.get(category);
    categoryMetrics.push(metrics);

    // Keep only last 1000 metrics
    if (categoryMetrics.length > 1000) {
      categoryMetrics.splice(0, categoryMetrics.length - 1000);
    }
  }

  checkHealthAlerts(key, result) {
    if (result.status === 'unhealthy' || result.status === 'critical') {
      this.createAlert('health_check_alert', {
        healthCheck: key,
        status: result.status,
        error: result.error,
        severity: result.status === 'critical' ? 'critical' : 'medium'
      });
    }
  }

  checkPerformanceAlerts(metrics) {
    // Memory usage alert
    if (metrics.memory && metrics.memory.usagePercentage > 90) {
      this.createAlert('high_memory_usage', {
        usage: metrics.memory.usagePercentage,
        severity: 'high'
      });
    }

    // Performance alert
    if (metrics.performance && metrics.performance.loadTime > 10000) {
      this.createAlert('slow_performance', {
        loadTime: metrics.performance.loadTime,
        severity: 'medium'
      });
    }

    // Network alert
    if (metrics.network && metrics.network.rtt > 2000) {
      this.createAlert('high_network_latency', {
        rtt: metrics.network.rtt,
        severity: 'medium'
      });
    }
  }

  createAlert(type, data) {
    const alert = {
      id: this.generateAlertId(),
      type,
      timestamp: new Date().toISOString(),
      severity: data.severity || 'medium',
      data,
      acknowledged: false
    };

    this.alerts.push(alert);

    // Keep only last 1000 alerts
    if (this.alerts.length > 1000) {
      this.alerts.splice(0, this.alerts.length - 1000);
    }

    // Send alert notification
    this.sendAlertNotification(alert);

    return alert;
  }

  generateAlertId() {
    return `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  sendAlertNotification(alert) {
    // In production, this would send to monitoring service
    console.warn('Production Alert:', alert);

    // Could integrate with services like:
    // - Slack notifications
    // - Email alerts
    // - PagerDuty
    // - Custom webhook
  }

  startErrorMonitoring() {
    // Global error handler
    window.addEventListener('error', (event) => {
      this.recordError({
        type: 'javascript_error',
        message: event.message,
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        stack: event.error?.stack
      });
    });

    // Unhandled promise rejection handler
    window.addEventListener('unhandledrejection', (event) => {
      this.recordError({
        type: 'unhandled_promise_rejection',
        message: event.reason?.message || 'Unhandled promise rejection',
        stack: event.reason?.stack
      });
    });
  }

  recordError(error) {
    const errorRecord = {
      ...error,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      url: window.location.href
    };

    this.recordMetrics('errors', errorRecord);

    // Create alert for critical errors
    if (this.isCriticalError(error)) {
      this.createAlert('critical_error', {
        error: errorRecord,
        severity: 'critical'
      });
    }
  }

  isCriticalError(error) {
    const criticalPatterns = [
      /cannot read property/i,
      /is not a function/i,
      /network error/i,
      /permission denied/i,
      /quota exceeded/i
    ];

    return criticalPatterns.some(pattern => pattern.test(error.message));
  }

  startResourceMonitoring() {
    // Monitor resource usage every 30 seconds
    setInterval(() => {
      this.collectResourceMetrics();
    }, 30000);
  }

  collectResourceMetrics() {
    const resources = {
      timestamp: new Date().toISOString(),
      cpu: this.estimateCPUUsage(),
      memory: this.getMemoryMetrics(),
      storage: this.getStorageUsage(),
      network: this.getNetworkUsage()
    };

    this.recordMetrics('resources', resources);
    this.checkResourceAlerts(resources);
  }

  estimateCPUUsage() {
    // Simple CPU usage estimation
    const start = performance.now();
    let iterations = 0;
    const duration = 10; // 10ms test

    while (performance.now() - start < duration) {
      iterations++;
    }

    // Normalize to percentage (rough estimate)
    return Math.min((iterations / 10000) * 100, 100);
  }

  async getStorageUsage() {
    try {
      if (navigator.storage && navigator.storage.estimate) {
        const estimate = await navigator.storage.estimate();
        return {
          used: estimate.usage,
          available: estimate.quota - estimate.usage,
          total: estimate.quota,
          usagePercentage: (estimate.usage / estimate.quota) * 100
        };
      }
    } catch (error) {
      return { error: error.message };
    }
    return null;
  }

  getNetworkUsage() {
    // This would require more sophisticated tracking
    // For now, return connection info
    const connection = navigator.connection;
    return connection ? {
      effectiveType: connection.effectiveType,
      downlink: connection.downlink,
      rtt: connection.rtt
    } : null;
  }

  checkResourceAlerts(resources) {
    // CPU usage alert
    if (resources.cpu > this.thresholds.cpuUsage) {
      this.createAlert('high_cpu_usage', {
        usage: resources.cpu,
        threshold: this.thresholds.cpuUsage,
        severity: 'medium'
      });
    }

    // Storage usage alert
    if (resources.storage && resources.storage.usagePercentage > this.thresholds.diskUsage) {
      this.createAlert('high_storage_usage', {
        usage: resources.storage.usagePercentage,
        threshold: this.thresholds.diskUsage,
        severity: 'medium'
      });
    }
  }

  setupPeriodicReporting() {
    // Generate reports every hour
    setInterval(() => {
      this.generatePeriodicReport();
    }, 60 * 60 * 1000);

    // Generate daily summary
    setInterval(() => {
      this.generateDailySummary();
    }, 24 * 60 * 60 * 1000);
  }

  generatePeriodicReport() {
    const report = {
      timestamp: new Date().toISOString(),
      period: 'hourly',
      health: this.getHealthSummary(),
      performance: this.getPerformanceSummary(),
      errors: this.getErrorSummary(),
      alerts: this.getAlertSummary()
    };

    this.sendReport(report);
    return report;
  }

  generateDailySummary() {
    const report = {
      timestamp: new Date().toISOString(),
      period: 'daily',
      uptime: this.calculateUptime(),
      totalSessions: this.getTotalSessions(),
      errorRate: this.calculateErrorRate(),
      performanceTrends: this.getPerformanceTrends(),
      topIssues: this.getTopIssues()
    };

    this.sendReport(report);
    return report;
  }

  getHealthSummary() {
    const healthChecks = this.monitoringData.get('healthChecks');
    if (!healthChecks) return {};

    const summary = {};
    for (const [key, results] of healthChecks) {
      const recent = results.slice(-10); // Last 10 results
      const healthy = recent.filter(r => r.status === 'healthy').length;
      summary[key] = {
        healthPercentage: (healthy / recent.length) * 100,
        lastStatus: recent[recent.length - 1]?.status,
        totalChecks: results.length
      };
    }

    return summary;
  }

  getPerformanceSummary() {
    const performanceMetrics = this.metrics.get('performance');
    if (!performanceMetrics || performanceMetrics.length === 0) return {};

    const recent = performanceMetrics.slice(-60); // Last hour
    const memoryUsages = recent.map(m => m.memory?.usagePercentage).filter(Boolean);
    const loadTimes = recent.map(m => m.performance?.loadTime).filter(Boolean);

    return {
      averageMemoryUsage: memoryUsages.length > 0 ? 
        memoryUsages.reduce((sum, usage) => sum + usage, 0) / memoryUsages.length : 0,
      averageLoadTime: loadTimes.length > 0 ? 
        loadTimes.reduce((sum, time) => sum + time, 0) / loadTimes.length : 0,
      sampleCount: recent.length
    };
  }

  getErrorSummary() {
    const errors = this.metrics.get('errors');
    if (!errors) return {};

    const recent = errors.slice(-100); // Last 100 errors
    const errorTypes = {};
    
    recent.forEach(error => {
      errorTypes[error.type] = (errorTypes[error.type] || 0) + 1;
    });

    return {
      totalErrors: recent.length,
      errorTypes,
      errorRate: this.calculateErrorRate()
    };
  }

  getAlertSummary() {
    const recentAlerts = this.alerts.slice(-50); // Last 50 alerts
    const alertTypes = {};
    const severityCounts = {};

    recentAlerts.forEach(alert => {
      alertTypes[alert.type] = (alertTypes[alert.type] || 0) + 1;
      severityCounts[alert.severity] = (severityCounts[alert.severity] || 0) + 1;
    });

    return {
      totalAlerts: recentAlerts.length,
      alertTypes,
      severityCounts,
      unacknowledged: recentAlerts.filter(a => !a.acknowledged).length
    };
  }

  calculateUptime() {
    // This would be calculated based on health check data
    return 99.5; // Placeholder
  }

  getTotalSessions() {
    // This would be calculated based on session tracking
    return 0; // Placeholder
  }

  calculateErrorRate() {
    const errors = this.metrics.get('errors');
    if (!errors || errors.length === 0) return 0;

    const recentErrors = errors.slice(-100);
    const timeWindow = 60 * 60 * 1000; // 1 hour
    const now = Date.now();
    
    const recentErrorsInWindow = recentErrors.filter(error => 
      now - new Date(error.timestamp).getTime() < timeWindow
    );

    // Calculate as errors per hour
    return recentErrorsInWindow.length;
  }

  getPerformanceTrends() {
    const performanceMetrics = this.metrics.get('performance');
    if (!performanceMetrics || performanceMetrics.length < 2) return {};

    const recent = performanceMetrics.slice(-24); // Last 24 hours
    const memoryTrend = this.calculateTrend(recent.map(m => m.memory?.usagePercentage).filter(Boolean));
    const loadTimeTrend = this.calculateTrend(recent.map(m => m.performance?.loadTime).filter(Boolean));

    return {
      memoryTrend,
      loadTimeTrend
    };
  }

  calculateTrend(values) {
    if (values.length < 2) return 'stable';

    const first = values.slice(0, Math.floor(values.length / 2));
    const second = values.slice(Math.floor(values.length / 2));

    const firstAvg = first.reduce((sum, val) => sum + val, 0) / first.length;
    const secondAvg = second.reduce((sum, val) => sum + val, 0) / second.length;

    const change = ((secondAvg - firstAvg) / firstAvg) * 100;

    if (change > 10) return 'increasing';
    if (change < -10) return 'decreasing';
    return 'stable';
  }

  getTopIssues() {
    const alerts = this.alerts.slice(-100);
    const issues = {};

    alerts.forEach(alert => {
      issues[alert.type] = (issues[alert.type] || 0) + 1;
    });

    return Object.entries(issues)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .map(([type, count]) => ({ type, count }));
  }

  sendReport(report) {
    // In production, this would send to monitoring service
    console.log('Production Report:', report);

    // Could integrate with services like:
    // - DataDog
    // - New Relic
    // - Application Insights
    // - Custom analytics endpoint
  }

  getMonitoringDashboard() {
    return {
      timestamp: new Date().toISOString(),
      health: this.getHealthSummary(),
      performance: this.getPerformanceSummary(),
      errors: this.getErrorSummary(),
      alerts: this.getAlertSummary(),
      resources: this.getResourceSummary(),
      uptime: this.calculateUptime()
    };
  }

  getResourceSummary() {
    const resources = this.metrics.get('resources');
    if (!resources || resources.length === 0) return {};

    const recent = resources.slice(-10);
    const cpuUsages = recent.map(r => r.cpu).filter(Boolean);
    const memoryUsages = recent.map(r => r.memory?.usagePercentage).filter(Boolean);

    return {
      averageCPU: cpuUsages.length > 0 ? 
        cpuUsages.reduce((sum, usage) => sum + usage, 0) / cpuUsages.length : 0,
      averageMemory: memoryUsages.length > 0 ? 
        memoryUsages.reduce((sum, usage) => sum + usage, 0) / memoryUsages.length : 0
    };
  }

  acknowledgeAlert(alertId) {
    const alert = this.alerts.find(a => a.id === alertId);
    if (alert) {
      alert.acknowledged = true;
      alert.acknowledgedAt = new Date().toISOString();
    }
  }

  exportMonitoringData(format = 'json') {
    const data = {
      healthChecks: Object.fromEntries(this.monitoringData.get('healthChecks') || new Map()),
      metrics: Object.fromEntries(this.metrics),
      alerts: this.alerts,
      exportedAt: new Date().toISOString()
    };

    if (format === 'csv') {
      return this.convertToCSV(data);
    }

    return JSON.stringify(data, null, 2);
  }

  convertToCSV(data) {
    // Simple CSV conversion for monitoring data
    let csv = 'Type,Timestamp,Category,Value,Details\n';
    
    // Add metrics data
    Object.entries(data.metrics).forEach(([category, metrics]) => {
      metrics.forEach(metric => {
        csv += `metric,${metric.timestamp},${category},${JSON.stringify(metric)}\n`;
      });
    });

    // Add alerts data
    data.alerts.forEach(alert => {
      csv += `alert,${alert.timestamp},${alert.type},${alert.severity},${JSON.stringify(alert.data)}\n`;
    });

    return csv;
  }
}

export default ProductionMonitoring;