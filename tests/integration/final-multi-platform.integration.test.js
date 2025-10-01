/**
 * Final Multi-Platform Integration Tests
 * Comprehensive integration testing across all platforms
 * @jest-environment jsdom
 */

import CrossPlatformPerformanceOptimizer from '../../src/client/services/CrossPlatformPerformanceOptimizer.js';
import CrossPlatformAnalytics from '../../src/client/services/CrossPlatformAnalytics.js';
import UnifiedErrorReporting from '../../src/client/services/UnifiedErrorReporting.js';
import PlatformSpecificOptimizations from '../../src/client/services/PlatformSpecificOptimizations.js';
import PlatformAdapter from '../../src/client/services/PlatformAdapter.js';
import TeamsAdapter from '../../src/client/services/TeamsAdapter.js';
import ZoomAdapter from '../../src/client/services/ZoomAdapter.js';
import MeetAdapter from '../../src/client/services/MeetAdapter.js';
import GenericAdapter from '../../src/client/services/GenericAdapter.js';

// Mock platform-specific APIs
jest.mock('../../src/client/services/TeamsAdapter.js');
jest.mock('../../src/client/services/ZoomAdapter.js');
jest.mock('../../src/client/services/MeetAdapter.js');
jest.mock('../../src/client/services/GenericAdapter.js');

describe('Final Multi-Platform Integration Tests', () => {
  let performanceOptimizer;
  let analytics;
  let errorReporting;
  let platformOptimizations;
  let mockComponents;

  beforeEach(() => {
    performanceOptimizer = new CrossPlatformPerformanceOptimizer();
    analytics = new CrossPlatformAnalytics();
    errorReporting = new UnifiedErrorReporting();
    platformOptimizations = new PlatformSpecificOptimizations();

    // Mock components
    mockComponents = {
      audioProcessor: {
        updateAudioConstraints: jest.fn().mockResolvedValue(true),
        setBufferSize: jest.fn(),
        processAudioChunk: jest.fn().mockResolvedValue(true),
        getBufferSize: jest.fn().mockReturnValue(4096),
        getSampleRate: jest.fn().mockReturnValue(44100)
      },
      transcriptionEngine: {
        setBatchSize: jest.fn(),
        setParallelProcessing: jest.fn(),
        setCacheStrategy: jest.fn(),
        processText: jest.fn().mockResolvedValue(true),
        getBatchSize: jest.fn().mockReturnValue(5)
      },
      memoryManager: {
        setMaxCacheSize: jest.fn(),
        setGarbageCollectionInterval: jest.fn(),
        performGarbageCollection: jest.fn().mockResolvedValue(true),
        getCacheSize: jest.fn().mockReturnValue(50 * 1024 * 1024)
      },
      networkManager: {
        setMaxConcurrentRequests: jest.fn(),
        setRequestTimeout: jest.fn(),
        testConnection: jest.fn().mockResolvedValue(true),
        getConcurrentRequests: jest.fn().mockReturnValue(3)
      }
    };

    // Mock performance.memory
    Object.defineProperty(performance, 'memory', {
      value: {
        usedJSHeapSize: 50 * 1024 * 1024,
        totalJSHeapSize: 100 * 1024 * 1024,
        jsHeapSizeLimit: 200 * 1024 * 1024
      },
      configurable: true
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Cross-Platform Performance Integration', () => {
    test('should optimize performance across all platforms', async () => {
      const platforms = ['teams', 'zoom', 'meet', 'generic'];
      const results = [];

      for (const platform of platforms) {
        const mockMetrics = {
          audioLatency: 150, // Above threshold
          transcriptionDelay: 600, // Above threshold
          memoryUsage: 120 * 1024 * 1024, // Above threshold
          cpuUsage: 80 // Above threshold
        };

        const optimizations = await performanceOptimizer.optimizeForPlatform(platform, mockMetrics);
        results.push({ platform, optimizations });

        expect(optimizations).toHaveLength(4); // All optimization types
        expect(optimizations.every(opt => opt.type)).toBe(true);
        expect(optimizations.every(opt => opt.platform === platform)).toBe(true);
      }

      expect(results).toHaveLength(4);
    });

    test('should apply platform-specific optimizations', async () => {
      const platforms = ['teams', 'zoom', 'meet', 'generic'];

      for (const platform of platforms) {
        const result = await platformOptimizations.applyOptimizations(platform, mockComponents);

        expect(result.platform).toBe(platform);
        expect(result.applied).toContain('audio');
        expect(result.applied).toContain('transcription');
        expect(result.applied).toContain('memory');
        expect(result.applied).toContain('network');
        expect(result.failed).toHaveLength(0);
        expect(result.performance).toBeDefined();
      }
    });

    test('should measure performance impact of optimizations', async () => {
      const platform = 'teams';
      
      await platformOptimizations.applyOptimizations(platform, mockComponents);
      const metrics = await performanceOptimizer.measurePlatformPerformance(platform, mockComponents);

      expect(metrics).toBeDefined();
      expect(metrics.platform).toBe(platform);
      expect(metrics.audioLatency).toBeGreaterThanOrEqual(0);
      expect(metrics.transcriptionDelay).toBeGreaterThanOrEqual(0);
      expect(metrics.memoryUsage).toBeGreaterThanOrEqual(0);
      expect(metrics.cpuUsage).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Cross-Platform Analytics Integration', () => {
    test('should track usage across all platforms', async () => {
      const platforms = ['teams', 'zoom', 'meet', 'generic'];
      const sessionIds = [];

      // Start sessions on all platforms
      for (const platform of platforms) {
        const sessionId = `session_${platform}_${Date.now()}`;
        sessionIds.push(sessionId);
        
        analytics.startSession(platform, sessionId, { testMode: true });
        
        // Track feature usage
        analytics.trackFeatureUsage('transcription', platform, sessionId);
        analytics.trackFeatureUsage('speaker_identification', platform, sessionId);
        analytics.trackFeatureUsage('summary_generation', platform, sessionId);
        
        // Track performance metrics
        analytics.trackPerformanceMetric('latency', 100, platform, sessionId);
        analytics.trackPerformanceMetric('accuracy', 0.95, platform, sessionId);
        
        // End session
        setTimeout(() => analytics.endSession(sessionId), 100);
      }

      // Wait for sessions to end
      await new Promise(resolve => setTimeout(resolve, 200));

      // Generate analytics report
      const report = analytics.generateAnalyticsReport('1h');

      expect(report.platformUsage).toBeDefined();
      expect(Object.keys(report.platformUsage)).toEqual(expect.arrayContaining(platforms));
      expect(report.featureUsage).toBeDefined();
      expect(report.performance).toBeDefined();
    });

    test('should generate cross-platform insights', async () => {
      // Simulate usage data
      const platforms = ['teams', 'zoom', 'meet'];
      
      for (const platform of platforms) {
        const sessionId = `insight_session_${platform}`;
        analytics.startSession(platform, sessionId);
        
        // Simulate different usage patterns
        if (platform === 'teams') {
          // High usage on Teams
          for (let i = 0; i < 10; i++) {
            analytics.trackFeatureUsage('transcription', platform, sessionId);
          }
        } else if (platform === 'zoom') {
          // Medium usage on Zoom
          for (let i = 0; i < 5; i++) {
            analytics.trackFeatureUsage('transcription', platform, sessionId);
          }
        } else {
          // Low usage on Meet
          analytics.trackFeatureUsage('transcription', platform, sessionId);
        }
        
        analytics.endSession(sessionId);
      }

      const report = analytics.generateAnalyticsReport('1h');
      
      expect(report.insights).toBeDefined();
      expect(report.insights.length).toBeGreaterThan(0);
      
      const platformInsight = report.insights.find(i => i.type === 'platform_adoption');
      expect(platformInsight).toBeDefined();
      expect(platformInsight.message).toContain('teams');
    });
  });

  describe('Unified Error Reporting Integration', () => {
    test('should handle errors across all platforms', async () => {
      const platforms = ['teams', 'zoom', 'meet', 'generic'];
      const errors = [];

      for (const platform of platforms) {
        // Simulate different types of errors
        const audioError = new Error('Audio capture failed');
        const transcriptionError = new Error('Transcription service unavailable');
        const networkError = new Error('Network connection lost');

        const audioReport = await errorReporting.reportError(audioError, platform, 'audio_test');
        const transcriptionReport = await errorReporting.reportError(transcriptionError, platform, 'transcription_test');
        const networkReport = await errorReporting.reportError(networkError, platform, 'network_test');

        errors.push(audioReport, transcriptionReport, networkReport);

        expect(audioReport.category).toBe('AUDIO_CAPTURE');
        expect(transcriptionReport.category).toBe('TRANSCRIPTION_FAILURE');
        expect(networkReport.category).toBe('NETWORK_ERROR');
      }

      expect(errors).toHaveLength(12); // 3 errors × 4 platforms

      // Generate diagnostic report
      const diagnosticReport = errorReporting.generateDiagnosticReport();
      
      expect(diagnosticReport.errors).toHaveLength(12);
      expect(diagnosticReport.summary.totalErrors).toBe(12);
      expect(diagnosticReport.summary.errorsByPlatform).toBeDefined();
      expect(Object.keys(diagnosticReport.summary.errorsByPlatform)).toEqual(expect.arrayContaining(platforms));
    });

    test('should collect platform-specific diagnostics', async () => {
      const platforms = ['teams', 'zoom', 'meet', 'generic'];

      for (const platform of platforms) {
        const diagnostics = await errorReporting.collectDiagnostics(platform);

        expect(diagnostics.platform).toBe(platform);
        expect(diagnostics.system).toBeDefined();
        expect(diagnostics.browser).toBeDefined();
        expect(diagnostics.audio).toBeDefined();
        expect(diagnostics.network).toBeDefined();
        expect(diagnostics.platform_specific).toBeDefined();
      }
    });

    test('should attempt error recovery', async () => {
      const platform = 'teams';
      const recoverableError = new Error('Audio capture failed');

      const errorReport = await errorReporting.reportError(recoverableError, platform, 'recovery_test');

      expect(errorReport.category).toBe('AUDIO_CAPTURE');
      
      // Check if recovery was attempted (mocked)
      expect(errorReport.recovery).toBeDefined();
    });
  });

  describe('End-to-End Platform Integration', () => {
    test('should integrate all services for complete workflow', async () => {
      const platform = 'teams';
      const sessionId = `e2e_session_${Date.now()}`;

      // Start analytics session
      analytics.startSession(platform, sessionId, { e2eTest: true });

      // Apply optimizations
      const optimizationResult = await platformOptimizations.applyOptimizations(platform, mockComponents);
      expect(optimizationResult.applied.length).toBeGreaterThan(0);

      // Track feature usage
      analytics.trackFeatureUsage('transcription', platform, sessionId);
      analytics.trackPerformanceMetric('latency', 50, platform, sessionId);

      // Simulate and handle an error
      const testError = new Error('Test integration error');
      const errorReport = await errorReporting.reportError(testError, platform, 'e2e_test');
      expect(errorReport).toBeDefined();

      // Measure performance
      const performanceMetrics = await performanceOptimizer.measurePlatformPerformance(platform, mockComponents);
      expect(performanceMetrics).toBeDefined();

      // End session
      analytics.endSession(sessionId);

      // Generate comprehensive report
      const analyticsReport = analytics.generateAnalyticsReport('1h');
      const optimizationReport = platformOptimizations.generateOptimizationReport();
      const diagnosticReport = errorReporting.generateDiagnosticReport();

      expect(analyticsReport.platformUsage[platform]).toBeDefined();
      expect(optimizationReport.activePlatforms).toContain(platform);
      expect(diagnosticReport.errors.length).toBeGreaterThan(0);
    });

    test('should handle platform switching', async () => {
      const platforms = ['teams', 'zoom', 'meet'];
      const sessionId = `switching_session_${Date.now()}`;

      for (let i = 0; i < platforms.length; i++) {
        const platform = platforms[i];
        
        // Start session on new platform
        analytics.startSession(platform, `${sessionId}_${i}`, { switchingTest: true });

        // Apply platform-specific optimizations
        const optimizationResult = await platformOptimizations.applyOptimizations(platform, mockComponents);
        expect(optimizationResult.platform).toBe(platform);

        // Track usage
        analytics.trackFeatureUsage('transcription', platform, `${sessionId}_${i}`);

        // Measure performance
        const metrics = await performanceOptimizer.measurePlatformPerformance(platform, mockComponents);
        expect(metrics.platform).toBe(platform);

        // End session
        analytics.endSession(`${sessionId}_${i}`);
      }

      // Verify all platforms were handled
      const report = analytics.generateAnalyticsReport('1h');
      platforms.forEach(platform => {
        expect(report.platformUsage[platform]).toBeDefined();
        expect(report.platformUsage[platform].sessions).toBeGreaterThan(0);
      });
    });

    test('should maintain performance under load', async () => {
      const platform = 'teams';
      const concurrentSessions = 5;
      const promises = [];

      // Simulate concurrent sessions
      for (let i = 0; i < concurrentSessions; i++) {
        const sessionId = `load_session_${i}`;
        
        const sessionPromise = (async () => {
          analytics.startSession(platform, sessionId, { loadTest: true });
          
          // Apply optimizations
          await platformOptimizations.applyOptimizations(platform, mockComponents);
          
          // Track multiple features
          for (let j = 0; j < 10; j++) {
            analytics.trackFeatureUsage('transcription', platform, sessionId);
            analytics.trackPerformanceMetric('latency', Math.random() * 100, platform, sessionId);
          }
          
          // Measure performance
          await performanceOptimizer.measurePlatformPerformance(platform, mockComponents);
          
          analytics.endSession(sessionId);
        })();
        
        promises.push(sessionPromise);
      }

      // Wait for all sessions to complete
      await Promise.all(promises);

      // Verify system handled the load
      const report = analytics.generateAnalyticsReport('1h');
      expect(report.platformUsage[platform].sessions).toBe(concurrentSessions);
      
      const optimizationReport = platformOptimizations.generateOptimizationReport();
      expect(optimizationReport.activePlatforms).toContain(platform);
    });
  });

  describe('Data Export and Reporting', () => {
    test('should export comprehensive data across all platforms', async () => {
      const platforms = ['teams', 'zoom', 'meet', 'generic'];

      // Generate data across platforms
      for (const platform of platforms) {
        const sessionId = `export_session_${platform}`;
        analytics.startSession(platform, sessionId);
        analytics.trackFeatureUsage('transcription', platform, sessionId);
        analytics.trackPerformanceMetric('latency', 75, platform, sessionId);
        analytics.endSession(sessionId);

        await platformOptimizations.applyOptimizations(platform, mockComponents);
        
        const testError = new Error(`Test error for ${platform}`);
        await errorReporting.reportError(testError, platform, 'export_test');
      }

      // Export data in different formats
      const analyticsJSON = analytics.exportAnalyticsData('json');
      const analyticsCSV = analytics.exportAnalyticsData('csv');
      const errorReportJSON = errorReporting.exportErrorReport('json');
      const errorReportCSV = errorReporting.exportErrorReport('csv');

      expect(analyticsJSON).toContain('platformUsage');
      expect(analyticsCSV).toContain('Type,Platform,Metric,Value,Timestamp');
      expect(errorReportJSON).toContain('errors');
      expect(errorReportCSV).toContain('Timestamp,Platform,Category,Severity,Message,Recovered');
    });

    test('should generate unified cross-platform report', async () => {
      // Simulate comprehensive usage
      const platforms = ['teams', 'zoom', 'meet'];
      
      for (const platform of platforms) {
        const sessionId = `unified_session_${platform}`;
        analytics.startSession(platform, sessionId);
        
        // Different usage patterns per platform
        const featureCount = platform === 'teams' ? 10 : platform === 'zoom' ? 5 : 2;
        for (let i = 0; i < featureCount; i++) {
          analytics.trackFeatureUsage('transcription', platform, sessionId);
        }
        
        analytics.endSession(sessionId);
        await platformOptimizations.applyOptimizations(platform, mockComponents);
      }

      // Generate unified report
      const analyticsReport = analytics.generateAnalyticsReport('1h');
      const optimizationReport = platformOptimizations.generateOptimizationReport();
      const diagnosticReport = errorReporting.generateDiagnosticReport();

      const unifiedReport = {
        timestamp: new Date().toISOString(),
        analytics: analyticsReport,
        optimizations: optimizationReport,
        diagnostics: diagnosticReport,
        summary: {
          totalPlatforms: platforms.length,
          totalSessions: Object.values(analyticsReport.platformUsage)
            .reduce((sum, platform) => sum + platform.sessions, 0),
          totalErrors: diagnosticReport.summary.totalErrors,
          optimizedPlatforms: optimizationReport.activePlatforms.length
        }
      };

      expect(unifiedReport.summary.totalPlatforms).toBe(3);
      expect(unifiedReport.summary.totalSessions).toBeGreaterThan(0);
      expect(unifiedReport.analytics.platformUsage).toBeDefined();
      expect(unifiedReport.optimizations.activePlatforms).toEqual(expect.arrayContaining(platforms));
    });
  });
});