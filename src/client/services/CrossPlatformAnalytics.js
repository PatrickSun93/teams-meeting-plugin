/**
 * Cross-Platform Analytics and Monitoring Service
 * Collects and analyzes usage data across all platforms
 */

class CrossPlatformAnalytics {
  constructor() {
    this.analyticsData = new Map();
    this.sessionData = new Map();
    this.platformUsage = new Map();
    this.featureUsage = new Map();
    this.errorTracking = new Map();
    this.performanceMetrics = new Map();
    
    this.initializeAnalytics();
  }

  initializeAnalytics() {
    // Initialize platform tracking
    ['teams', 'zoom', 'meet', 'generic'].forEach(platform => {
      this.platformUsage.set(platform, {
        sessions: 0,
        totalDuration: 0,
        features: new Map(),
        errors: [],
        performance: []
      });
    });

    // Initialize feature tracking
    this.initializeFeatureTracking();
  }

  initializeFeatureTracking() {
    const features = [
      'transcription',
      'speaker_identification',
      'summary_generation',
      'chat_integration',
      'agenda_integration',
      'export_functionality',
      'privacy_mode',
      'local_stt',
      'cloud_stt'
    ];

    features.forEach(feature => {
      this.featureUsage.set(feature, {
        totalUsage: 0,
        platformBreakdown: new Map(),
        successRate: 0,
        averageLatency: 0,
        errors: []
      });
    });
  }

  startSession(platform, sessionId, metadata = {}) {
    const session = {
      id: sessionId,
      platform,
      startTime: Date.now(),
      endTime: null,
      duration: 0,
      features: [],
      events: [],
      errors: [],
      performance: [],
      metadata: {
        userAgent: navigator.userAgent,
        platform: navigator.platform,
        language: navigator.language,
        ...metadata
      }
    };

    this.sessionData.set(sessionId, session);
    
    // Update platform usage
    const platformData = this.platformUsage.get(platform);
    if (platformData) {
      platformData.sessions++;
    }

    this.trackEvent('session_started', { platform, sessionId });
  }

  endSession(sessionId) {
    const session = this.sessionData.get(sessionId);
    if (!session) return;

    session.endTime = Date.now();
    session.duration = session.endTime - session.startTime;

    // Update platform usage
    const platformData = this.platformUsage.get(session.platform);
    if (platformData) {
      platformData.totalDuration += session.duration;
    }

    this.trackEvent('session_ended', { 
      sessionId, 
      duration: session.duration,
      platform: session.platform
    });

    // Archive session data
    this.archiveSession(session);
  }

  trackFeatureUsage(feature, platform, sessionId, metadata = {}) {
    const timestamp = Date.now();
    
    // Update feature usage
    const featureData = this.featureUsage.get(feature);
    if (featureData) {
      featureData.totalUsage++;
      
      const platformCount = featureData.platformBreakdown.get(platform) || 0;
      featureData.platformBreakdown.set(platform, platformCount + 1);
    }

    // Update session data
    const session = this.sessionData.get(sessionId);
    if (session) {
      session.features.push({
        feature,
        timestamp,
        metadata
      });
    }

    // Update platform data
    const platformData = this.platformUsage.get(platform);
    if (platformData) {
      const featureCount = platformData.features.get(feature) || 0;
      platformData.features.set(feature, featureCount + 1);
    }

    this.trackEvent('feature_used', { feature, platform, sessionId, ...metadata });
  }

  trackPerformanceMetric(metric, value, platform, sessionId, context = {}) {
    const performanceData = {
      metric,
      value,
      platform,
      sessionId,
      timestamp: Date.now(),
      context
    };

    // Store in performance metrics
    if (!this.performanceMetrics.has(metric)) {
      this.performanceMetrics.set(metric, []);
    }
    this.performanceMetrics.get(metric).push(performanceData);

    // Update session data
    const session = this.sessionData.get(sessionId);
    if (session) {
      session.performance.push(performanceData);
    }

    // Update platform data
    const platformData = this.platformUsage.get(platform);
    if (platformData) {
      platformData.performance.push(performanceData);
    }

    // Update feature performance if applicable
    if (context.feature) {
      const featureData = this.featureUsage.get(context.feature);
      if (featureData && metric === 'latency') {
        const currentAvg = featureData.averageLatency;
        const count = featureData.totalUsage;
        featureData.averageLatency = (currentAvg * (count - 1) + value) / count;
      }
    }
  }

  trackError(error, platform, sessionId, context = {}) {
    const errorData = {
      message: error.message,
      stack: error.stack,
      platform,
      sessionId,
      timestamp: Date.now(),
      context,
      severity: this.categorizeError(error)
    };

    // Store in error tracking
    if (!this.errorTracking.has(platform)) {
      this.errorTracking.set(platform, []);
    }
    this.errorTracking.get(platform).push(errorData);

    // Update session data
    const session = this.sessionData.get(sessionId);
    if (session) {
      session.errors.push(errorData);
    }

    // Update platform data
    const platformData = this.platformUsage.get(platform);
    if (platformData) {
      platformData.errors.push(errorData);
    }

    // Update feature error rate if applicable
    if (context.feature) {
      const featureData = this.featureUsage.get(context.feature);
      if (featureData) {
        featureData.errors.push(errorData);
        // Recalculate success rate
        const totalAttempts = featureData.totalUsage;
        const errorCount = featureData.errors.length;
        featureData.successRate = ((totalAttempts - errorCount) / totalAttempts) * 100;
      }
    }

    this.trackEvent('error_occurred', { 
      error: error.message, 
      platform, 
      sessionId, 
      severity: errorData.severity 
    });
  }

  trackEvent(eventType, data) {
    const event = {
      type: eventType,
      timestamp: Date.now(),
      data
    };

    // Store in analytics data
    if (!this.analyticsData.has(eventType)) {
      this.analyticsData.set(eventType, []);
    }
    this.analyticsData.get(eventType).push(event);

    // Add to session if applicable
    if (data && data.sessionId) {
      const session = this.sessionData.get(data.sessionId);
      if (session) {
        session.events.push(event);
      }
    }
  }

  categorizeError(error) {
    const message = error.message.toLowerCase();
    
    if (message.includes('network') || message.includes('fetch')) {
      return 'network';
    } else if (message.includes('audio') || message.includes('media')) {
      return 'audio';
    } else if (message.includes('transcription') || message.includes('stt')) {
      return 'transcription';
    } else if (message.includes('permission') || message.includes('access')) {
      return 'permission';
    } else if (message.includes('api') || message.includes('service')) {
      return 'service';
    } else {
      return 'general';
    }
  }

  generateAnalyticsReport(timeRange = '24h') {
    const now = Date.now();
    const timeRanges = {
      '1h': 60 * 60 * 1000,
      '24h': 24 * 60 * 60 * 1000,
      '7d': 7 * 24 * 60 * 60 * 1000,
      '30d': 30 * 24 * 60 * 60 * 1000
    };
    
    const cutoff = now - (timeRanges[timeRange] || timeRanges['24h']);

    return {
      timeRange,
      generatedAt: new Date().toISOString(),
      platformUsage: this.generatePlatformReport(cutoff),
      featureUsage: this.generateFeatureReport(cutoff),
      performance: this.generatePerformanceReport(cutoff),
      errors: this.generateErrorReport(cutoff),
      insights: this.generateInsights(cutoff)
    };
  }

  generatePlatformReport(cutoff) {
    const report = {};
    
    for (const [platform, data] of this.platformUsage) {
      const recentSessions = this.getRecentSessions(platform, cutoff);
      const recentErrors = data.errors.filter(e => e.timestamp > cutoff);
      
      report[platform] = {
        sessions: recentSessions.length,
        totalDuration: recentSessions.reduce((sum, s) => sum + s.duration, 0),
        averageSessionDuration: recentSessions.length > 0 ? 
          recentSessions.reduce((sum, s) => sum + s.duration, 0) / recentSessions.length : 0,
        errorRate: recentSessions.length > 0 ? 
          (recentErrors.length / recentSessions.length) * 100 : 0,
        popularFeatures: this.getPopularFeatures(platform, cutoff)
      };
    }
    
    return report;
  }

  generateFeatureReport(cutoff) {
    const report = {};
    
    for (const [feature, data] of this.featureUsage) {
      const recentUsage = this.getRecentFeatureUsage(feature, cutoff);
      
      report[feature] = {
        totalUsage: recentUsage,
        platformBreakdown: Object.fromEntries(data.platformBreakdown),
        successRate: data.successRate,
        averageLatency: data.averageLatency,
        errorCount: data.errors.filter(e => e.timestamp > cutoff).length
      };
    }
    
    return report;
  }

  generatePerformanceReport(cutoff) {
    const report = {};
    
    for (const [metric, data] of this.performanceMetrics) {
      const recentData = data.filter(d => d.timestamp > cutoff);
      
      if (recentData.length > 0) {
        const values = recentData.map(d => d.value);
        report[metric] = {
          count: recentData.length,
          average: values.reduce((sum, v) => sum + v, 0) / values.length,
          min: Math.min(...values),
          max: Math.max(...values),
          median: this.calculateMedian(values),
          platformBreakdown: this.groupByPlatform(recentData)
        };
      }
    }
    
    return report;
  }

  generateErrorReport(cutoff) {
    const report = {
      totalErrors: 0,
      errorsByPlatform: {},
      errorsBySeverity: {},
      topErrors: []
    };

    const allErrors = [];
    
    for (const [platform, errors] of this.errorTracking) {
      const recentErrors = errors.filter(e => e.timestamp > cutoff);
      allErrors.push(...recentErrors);
      
      report.errorsByPlatform[platform] = recentErrors.length;
    }

    report.totalErrors = allErrors.length;

    // Group by severity
    const severityGroups = {};
    allErrors.forEach(error => {
      severityGroups[error.severity] = (severityGroups[error.severity] || 0) + 1;
    });
    report.errorsBySeverity = severityGroups;

    // Top errors by frequency
    const errorCounts = {};
    allErrors.forEach(error => {
      errorCounts[error.message] = (errorCounts[error.message] || 0) + 1;
    });
    
    report.topErrors = Object.entries(errorCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10)
      .map(([message, count]) => ({ message, count }));

    return report;
  }

  generateInsights(cutoff) {
    const insights = [];
    
    // Platform adoption insights
    const platformReport = this.generatePlatformReport(cutoff);
    const mostUsedPlatform = Object.entries(platformReport)
      .sort(([,a], [,b]) => b.sessions - a.sessions)[0];
    
    if (mostUsedPlatform) {
      insights.push({
        type: 'platform_adoption',
        message: `${mostUsedPlatform[0]} is the most used platform with ${mostUsedPlatform[1].sessions} sessions`,
        priority: 'info'
      });
    }

    // Performance insights
    const performanceReport = this.generatePerformanceReport(cutoff);
    if (performanceReport.latency && performanceReport.latency.average > 500) {
      insights.push({
        type: 'performance',
        message: `Average latency is ${performanceReport.latency.average.toFixed(0)}ms, consider optimization`,
        priority: 'warning'
      });
    }

    // Error insights
    const errorReport = this.generateErrorReport(cutoff);
    if (errorReport.totalErrors > 0) {
      const errorRate = (errorReport.totalErrors / Object.values(platformReport)
        .reduce((sum, p) => sum + p.sessions, 0)) * 100;
      
      if (errorRate > 5) {
        insights.push({
          type: 'error_rate',
          message: `Error rate is ${errorRate.toFixed(1)}%, investigate top errors`,
          priority: 'critical'
        });
      }
    }

    // Feature usage insights
    const featureReport = this.generateFeatureReport(cutoff);
    const leastUsedFeature = Object.entries(featureReport)
      .sort(([,a], [,b]) => a.totalUsage - b.totalUsage)[0];
    
    if (leastUsedFeature && leastUsedFeature[1].totalUsage === 0) {
      insights.push({
        type: 'feature_adoption',
        message: `${leastUsedFeature[0]} feature has no usage, consider improving discoverability`,
        priority: 'info'
      });
    }

    return insights;
  }

  getRecentSessions(platform, cutoff) {
    return Array.from(this.sessionData.values())
      .filter(session => session.platform === platform && session.startTime > cutoff);
  }

  getRecentFeatureUsage(feature, cutoff) {
    return Array.from(this.sessionData.values())
      .reduce((count, session) => {
        return count + session.features.filter(f => 
          f.feature === feature && f.timestamp > cutoff
        ).length;
      }, 0);
  }

  getPopularFeatures(platform, cutoff) {
    const featureCounts = {};
    
    this.getRecentSessions(platform, cutoff).forEach(session => {
      session.features.forEach(feature => {
        if (feature.timestamp > cutoff) {
          featureCounts[feature.feature] = (featureCounts[feature.feature] || 0) + 1;
        }
      });
    });

    return Object.entries(featureCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .map(([feature, count]) => ({ feature, count }));
  }

  groupByPlatform(data) {
    const grouped = {};
    data.forEach(item => {
      if (!grouped[item.platform]) {
        grouped[item.platform] = [];
      }
      grouped[item.platform].push(item.value);
    });

    // Calculate averages for each platform
    Object.keys(grouped).forEach(platform => {
      const values = grouped[platform];
      grouped[platform] = {
        count: values.length,
        average: values.reduce((sum, v) => sum + v, 0) / values.length
      };
    });

    return grouped;
  }

  calculateMedian(values) {
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0 ? 
      (sorted[mid - 1] + sorted[mid]) / 2 : 
      sorted[mid];
  }

  archiveSession(session) {
    // In a real implementation, this would send data to a backend
    // For now, we'll just keep it in memory with a size limit
    const maxSessions = 1000;
    const sessions = Array.from(this.sessionData.values());
    
    if (sessions.length > maxSessions) {
      // Remove oldest sessions
      const sortedSessions = sessions.sort((a, b) => a.startTime - b.startTime);
      const toRemove = sortedSessions.slice(0, sessions.length - maxSessions);
      toRemove.forEach(s => this.sessionData.delete(s.id));
    }
  }

  exportAnalyticsData(format = 'json') {
    const data = {
      platformUsage: Object.fromEntries(this.platformUsage),
      featureUsage: Object.fromEntries(this.featureUsage),
      performanceMetrics: Object.fromEntries(this.performanceMetrics),
      errorTracking: Object.fromEntries(this.errorTracking),
      exportedAt: new Date().toISOString()
    };

    if (format === 'csv') {
      return this.convertToCSV(data);
    }
    
    return JSON.stringify(data, null, 2);
  }

  convertToCSV(data) {
    // Simple CSV conversion for analytics data
    let csv = 'Type,Platform,Metric,Value,Timestamp\n';
    
    // Add platform usage data
    Object.entries(data.platformUsage).forEach(([platform, usage]) => {
      csv += `platform,${platform},sessions,${usage.sessions},${new Date().toISOString()}\n`;
      csv += `platform,${platform},totalDuration,${usage.totalDuration},${new Date().toISOString()}\n`;
    });

    return csv;
  }
}

export default CrossPlatformAnalytics;