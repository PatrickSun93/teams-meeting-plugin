/**
 * Unified Error Reporting and Diagnostics Service
 * Provides centralized error handling and diagnostics across all platforms
 */

class UnifiedErrorReporting {
  constructor() {
    this.errorQueue = [];
    this.diagnosticData = new Map();
    this.errorCategories = new Map();
    this.platformDiagnostics = new Map();
    this.recoveryStrategies = new Map();
    
    this.initializeErrorCategories();
    this.initializeRecoveryStrategies();
    this.setupGlobalErrorHandlers();
  }

  initializeErrorCategories() {
    this.errorCategories.set('AUDIO_CAPTURE', {
      severity: 'high',
      category: 'audio',
      autoRecover: true,
      userNotification: true
    });

    this.errorCategories.set('TRANSCRIPTION_FAILURE', {
      severity: 'medium',
      category: 'transcription',
      autoRecover: true,
      userNotification: true
    });

    this.errorCategories.set('PLATFORM_CONNECTION', {
      severity: 'high',
      category: 'platform',
      autoRecover: false,
      userNotification: true
    });

    this.errorCategories.set('API_RATE_LIMIT', {
      severity: 'medium',
      category: 'api',
      autoRecover: true,
      userNotification: false
    });

    this.errorCategories.set('PERMISSION_DENIED', {
      severity: 'critical',
      category: 'permission',
      autoRecover: false,
      userNotification: true
    });

    this.errorCategories.set('NETWORK_ERROR', {
      severity: 'medium',
      category: 'network',
      autoRecover: true,
      userNotification: false
    });

    this.errorCategories.set('CONFIGURATION_ERROR', {
      severity: 'low',
      category: 'config',
      autoRecover: false,
      userNotification: true
    });
  }

  initializeRecoveryStrategies() {
    this.recoveryStrategies.set('AUDIO_CAPTURE', [
      { strategy: 'restart_audio_stream', priority: 1 },
      { strategy: 'fallback_to_system_audio', priority: 2 },
      { strategy: 'reduce_audio_quality', priority: 3 }
    ]);

    this.recoveryStrategies.set('TRANSCRIPTION_FAILURE', [
      { strategy: 'retry_with_backoff', priority: 1 },
      { strategy: 'switch_stt_provider', priority: 2 },
      { strategy: 'fallback_to_local_stt', priority: 3 }
    ]);

    this.recoveryStrategies.set('API_RATE_LIMIT', [
      { strategy: 'exponential_backoff', priority: 1 },
      { strategy: 'queue_requests', priority: 2 },
      { strategy: 'switch_api_provider', priority: 3 }
    ]);

    this.recoveryStrategies.set('NETWORK_ERROR', [
      { strategy: 'retry_request', priority: 1 },
      { strategy: 'cache_offline', priority: 2 },
      { strategy: 'notify_offline_mode', priority: 3 }
    ]);
  }

  setupGlobalErrorHandlers() {
    // Only setup handlers in browser environment
    if (typeof window === 'undefined') return;

    // Unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
      this.reportError(event.reason, 'global', 'unhandled_promise_rejection', {
        promise: event.promise
      });
    });

    // Global JavaScript errors
    window.addEventListener('error', (event) => {
      this.reportError(new Error(event.message), 'global', 'javascript_error', {
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno
      });
    });

    // Resource loading errors
    window.addEventListener('error', (event) => {
      if (event.target !== window) {
        this.reportError(new Error(`Resource failed to load: ${event.target.src || event.target.href}`), 
          'global', 'resource_error', {
          element: event.target.tagName,
          source: event.target.src || event.target.href
        });
      }
    }, true);
  }

  async reportError(error, platform, context = '', metadata = {}) {
    const errorReport = {
      id: this.generateErrorId(),
      timestamp: new Date().toISOString(),
      platform,
      context,
      error: {
        message: error.message,
        stack: error.stack,
        name: error.name
      },
      metadata: {
        userAgent: navigator.userAgent,
        url: window.location.href,
        platform: navigator.platform,
        language: navigator.language,
        ...metadata
      },
      diagnostics: await this.collectDiagnostics(platform),
      category: this.categorizeError(error, context),
      severity: this.determineSeverity(error, context)
    };

    // Add to error queue
    this.errorQueue.push(errorReport);

    // Attempt automatic recovery if applicable
    if (this.shouldAttemptRecovery(errorReport)) {
      await this.attemptRecovery(errorReport);
    }

    // Notify user if necessary
    if (this.shouldNotifyUser(errorReport)) {
      this.notifyUser(errorReport);
    }

    // Log for debugging
    console.error('Unified Error Report:', errorReport);

    return errorReport;
  }

  async collectDiagnostics(platform) {
    const diagnostics = {
      timestamp: new Date().toISOString(),
      platform,
      system: await this.getSystemDiagnostics(),
      browser: this.getBrowserDiagnostics(),
      audio: await this.getAudioDiagnostics(),
      network: await this.getNetworkDiagnostics(),
      platform_specific: await this.getPlatformSpecificDiagnostics(platform)
    };

    this.diagnosticData.set(platform, diagnostics);
    return diagnostics;
  }

  async getSystemDiagnostics() {
    const diagnostics = {
      memory: {},
      performance: {},
      storage: {}
    };

    // Memory information
    if (performance.memory) {
      diagnostics.memory = {
        used: performance.memory.usedJSHeapSize,
        total: performance.memory.totalJSHeapSize,
        limit: performance.memory.jsHeapSizeLimit
      };
    }

    // Performance timing
    if (performance.timing) {
      diagnostics.performance = {
        loadTime: performance.timing.loadEventEnd - performance.timing.navigationStart,
        domReady: performance.timing.domContentLoadedEventEnd - performance.timing.navigationStart
      };
    }

    // Storage information
    try {
      if (navigator.storage && navigator.storage.estimate) {
        const estimate = await navigator.storage.estimate();
        diagnostics.storage = {
          quota: estimate.quota,
          usage: estimate.usage,
          available: estimate.quota - estimate.usage
        };
      }
    } catch (error) {
      diagnostics.storage.error = error.message;
    }

    return diagnostics;
  }

  getBrowserDiagnostics() {
    if (typeof navigator === 'undefined') {
      return { error: 'Navigator not available in test environment' };
    }

    return {
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      language: navigator.language,
      cookieEnabled: navigator.cookieEnabled,
      onLine: navigator.onLine,
      hardwareConcurrency: navigator.hardwareConcurrency,
      deviceMemory: navigator.deviceMemory,
      connection: navigator.connection ? {
        effectiveType: navigator.connection.effectiveType,
        downlink: navigator.connection.downlink,
        rtt: navigator.connection.rtt
      } : null
    };
  }

  async getAudioDiagnostics() {
    const diagnostics = {
      mediaDevices: false,
      audioContext: false,
      permissions: null,
      devices: []
    };

    try {
      // Check MediaDevices API
      if (navigator.mediaDevices) {
        diagnostics.mediaDevices = true;

        // Check audio permissions
        try {
          const permission = await navigator.permissions.query({ name: 'microphone' });
          diagnostics.permissions = permission.state;
        } catch (error) {
          diagnostics.permissions = 'unknown';
        }

        // Enumerate audio devices
        try {
          const devices = await navigator.mediaDevices.enumerateDevices();
          diagnostics.devices = devices
            .filter(device => device.kind === 'audioinput')
            .map(device => ({
              deviceId: device.deviceId,
              label: device.label,
              groupId: device.groupId
            }));
        } catch (error) {
          diagnostics.devicesError = error.message;
        }
      }

      // Check AudioContext
      try {
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        diagnostics.audioContext = true;
        diagnostics.sampleRate = audioContext.sampleRate;
        diagnostics.state = audioContext.state;
        audioContext.close();
      } catch (error) {
        diagnostics.audioContextError = error.message;
      }
    } catch (error) {
      diagnostics.error = error.message;
    }

    return diagnostics;
  }

  async getNetworkDiagnostics() {
    const diagnostics = {
      online: navigator.onLine,
      connection: null,
      latency: null,
      bandwidth: null
    };

    // Connection information
    if (navigator.connection) {
      diagnostics.connection = {
        effectiveType: navigator.connection.effectiveType,
        downlink: navigator.connection.downlink,
        rtt: navigator.connection.rtt,
        saveData: navigator.connection.saveData
      };
    }

    // Test network latency
    try {
      const start = performance.now();
      await fetch('/ping', { method: 'HEAD', cache: 'no-cache' });
      diagnostics.latency = performance.now() - start;
    } catch (error) {
      diagnostics.latencyError = error.message;
    }

    return diagnostics;
  }

  async getPlatformSpecificDiagnostics(platform) {
    const diagnostics = {};

    switch (platform) {
      case 'teams':
        diagnostics.teamsSDK = await this.getTeamsDiagnostics();
        break;
      case 'zoom':
        diagnostics.zoomSDK = await this.getZoomDiagnostics();
        break;
      case 'meet':
        diagnostics.meetExtension = await this.getMeetDiagnostics();
        break;
      case 'generic':
        diagnostics.desktop = await this.getDesktopDiagnostics();
        break;
    }

    return diagnostics;
  }

  async getTeamsDiagnostics() {
    const diagnostics = {
      sdkAvailable: false,
      initialized: false,
      context: null,
      capabilities: null
    };

    try {
      if (window.microsoftTeams) {
        diagnostics.sdkAvailable = true;
        
        // Check if initialized
        try {
          await new Promise((resolve, reject) => {
            window.microsoftTeams.initialize(() => resolve());
            setTimeout(() => reject(new Error('Initialization timeout')), 5000);
          });
          diagnostics.initialized = true;

          // Get context
          diagnostics.context = await new Promise((resolve) => {
            window.microsoftTeams.getContext(resolve);
          });

          // Get capabilities
          if (window.microsoftTeams.media) {
            diagnostics.capabilities = {
              media: true,
              audio: !!window.microsoftTeams.media.getAudioStream,
              chat: !!window.microsoftTeams.conversations
            };
          }
        } catch (error) {
          diagnostics.initError = error.message;
        }
      }
    } catch (error) {
      diagnostics.error = error.message;
    }

    return diagnostics;
  }

  async getZoomDiagnostics() {
    const diagnostics = {
      sdkAvailable: false,
      initialized: false,
      version: null,
      capabilities: null
    };

    try {
      if (window.ZoomMtg) {
        diagnostics.sdkAvailable = true;
        diagnostics.version = window.ZoomMtg.getVersion?.();

        // Check capabilities
        diagnostics.capabilities = {
          audio: !!window.ZoomMtg.getAudioStream,
          chat: !!window.ZoomMtg.sendChatMessage,
          participants: !!window.ZoomMtg.getParticipants
        };
      }
    } catch (error) {
      diagnostics.error = error.message;
    }

    return diagnostics;
  }

  async getMeetDiagnostics() {
    const diagnostics = {
      extensionAvailable: false,
      permissions: null,
      calendarAPI: false
    };

    try {
      if (window.chrome && window.chrome.runtime) {
        diagnostics.extensionAvailable = true;
        diagnostics.extensionId = window.chrome.runtime.id;

        // Check permissions
        try {
          const permissions = await new Promise((resolve) => {
            window.chrome.permissions.getAll(resolve);
          });
          diagnostics.permissions = permissions;
        } catch (error) {
          diagnostics.permissionsError = error.message;
        }

        // Check Google Calendar API
        diagnostics.calendarAPI = !!window.gapi;
      }
    } catch (error) {
      diagnostics.error = error.message;
    }

    return diagnostics;
  }

  async getDesktopDiagnostics() {
    const diagnostics = {
      electron: false,
      nodeIntegration: false,
      systemAudio: false
    };

    try {
      // Check if running in Electron
      if (window.process && window.process.type) {
        diagnostics.electron = true;
        diagnostics.nodeIntegration = !!window.require;
        diagnostics.electronVersion = window.process.versions.electron;
      }

      // Check system audio capabilities
      if (navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia) {
        diagnostics.systemAudio = true;
      }
    } catch (error) {
      diagnostics.error = error.message;
    }

    return diagnostics;
  }

  categorizeError(error, context) {
    const message = error.message.toLowerCase();
    
    if (message.includes('audio') || message.includes('microphone') || message.includes('media')) {
      return 'AUDIO_CAPTURE';
    } else if (message.includes('transcription') || message.includes('stt') || message.includes('speech')) {
      return 'TRANSCRIPTION_FAILURE';
    } else if (message.includes('network') || message.includes('fetch') || message.includes('xhr')) {
      return 'NETWORK_ERROR';
    } else if (message.includes('permission') || message.includes('denied') || message.includes('access')) {
      return 'PERMISSION_DENIED';
    } else if (message.includes('rate limit') || message.includes('quota') || message.includes('throttle')) {
      return 'API_RATE_LIMIT';
    } else if (message.includes('config') || message.includes('setting') || message.includes('invalid')) {
      return 'CONFIGURATION_ERROR';
    } else if (context.includes('platform') || message.includes('teams') || message.includes('zoom') || message.includes('meet')) {
      return 'PLATFORM_CONNECTION';
    } else {
      return 'UNKNOWN';
    }
  }

  determineSeverity(error, context) {
    const category = this.categorizeError(error, context);
    const categoryInfo = this.errorCategories.get(category);
    
    if (categoryInfo) {
      return categoryInfo.severity;
    }

    // Fallback severity determination
    if (error.message.includes('critical') || error.message.includes('fatal')) {
      return 'critical';
    } else if (error.message.includes('warning') || error.message.includes('deprecated')) {
      return 'low';
    } else {
      return 'medium';
    }
  }

  shouldAttemptRecovery(errorReport) {
    const categoryInfo = this.errorCategories.get(errorReport.category);
    return categoryInfo && categoryInfo.autoRecover;
  }

  shouldNotifyUser(errorReport) {
    const categoryInfo = this.errorCategories.get(errorReport.category);
    return categoryInfo && categoryInfo.userNotification;
  }

  async attemptRecovery(errorReport) {
    const strategies = this.recoveryStrategies.get(errorReport.category);
    if (!strategies) return false;

    for (const strategy of strategies.sort((a, b) => a.priority - b.priority)) {
      try {
        const success = await this.executeRecoveryStrategy(strategy.strategy, errorReport);
        if (success) {
          errorReport.recovery = {
            strategy: strategy.strategy,
            success: true,
            timestamp: new Date().toISOString()
          };
          return true;
        }
      } catch (recoveryError) {
        console.warn(`Recovery strategy ${strategy.strategy} failed:`, recoveryError);
      }
    }

    errorReport.recovery = {
      attempted: true,
      success: false,
      timestamp: new Date().toISOString()
    };
    return false;
  }

  async executeRecoveryStrategy(strategy, errorReport) {
    switch (strategy) {
      case 'restart_audio_stream':
        return await this.restartAudioStream(errorReport);
      case 'retry_with_backoff':
        return await this.retryWithBackoff(errorReport);
      case 'switch_stt_provider':
        return await this.switchSTTProvider(errorReport);
      case 'exponential_backoff':
        return await this.exponentialBackoff(errorReport);
      case 'fallback_to_local_stt':
        return await this.fallbackToLocalSTT(errorReport);
      default:
        return false;
    }
  }

  async restartAudioStream(errorReport) {
    // Implementation would restart audio stream
    console.log('Attempting to restart audio stream');
    return true; // Placeholder
  }

  async retryWithBackoff(errorReport) {
    // Implementation would retry the failed operation with backoff
    console.log('Retrying with backoff');
    return true; // Placeholder
  }

  async switchSTTProvider(errorReport) {
    // Implementation would switch to alternative STT provider
    console.log('Switching STT provider');
    return true; // Placeholder
  }

  async exponentialBackoff(errorReport) {
    // Implementation would implement exponential backoff
    console.log('Applying exponential backoff');
    return true; // Placeholder
  }

  async fallbackToLocalSTT(errorReport) {
    // Implementation would fallback to local STT
    console.log('Falling back to local STT');
    return true; // Placeholder
  }

  notifyUser(errorReport) {
    // Implementation would show user notification
    console.log('Notifying user of error:', errorReport.error.message);
  }

  generateErrorId() {
    return `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  generateDiagnosticReport() {
    return {
      timestamp: new Date().toISOString(),
      errors: this.errorQueue.slice(-50), // Last 50 errors
      diagnostics: Object.fromEntries(this.diagnosticData),
      summary: this.generateErrorSummary()
    };
  }

  generateErrorSummary() {
    const summary = {
      totalErrors: this.errorQueue.length,
      errorsByCategory: {},
      errorsBySeverity: {},
      errorsByPlatform: {},
      recoveryRate: 0
    };

    let recoveredErrors = 0;

    this.errorQueue.forEach(error => {
      // Count by category
      summary.errorsByCategory[error.category] = 
        (summary.errorsByCategory[error.category] || 0) + 1;

      // Count by severity
      summary.errorsBySeverity[error.severity] = 
        (summary.errorsBySeverity[error.severity] || 0) + 1;

      // Count by platform
      summary.errorsByPlatform[error.platform] = 
        (summary.errorsByPlatform[error.platform] || 0) + 1;

      // Count recovered errors
      if (error.recovery && error.recovery.success) {
        recoveredErrors++;
      }
    });

    summary.recoveryRate = this.errorQueue.length > 0 ? 
      (recoveredErrors / this.errorQueue.length) * 100 : 0;

    return summary;
  }

  exportErrorReport(format = 'json') {
    const report = this.generateDiagnosticReport();
    
    if (format === 'csv') {
      return this.convertErrorReportToCSV(report);
    }
    
    return JSON.stringify(report, null, 2);
  }

  convertErrorReportToCSV(report) {
    let csv = 'Timestamp,Platform,Category,Severity,Message,Recovered\n';
    
    report.errors.forEach(error => {
      const recovered = error.recovery && error.recovery.success ? 'Yes' : 'No';
      csv += `${error.timestamp},${error.platform},${error.category},${error.severity},"${error.error.message}",${recovered}\n`;
    });

    return csv;
  }
}

export default UnifiedErrorReporting;