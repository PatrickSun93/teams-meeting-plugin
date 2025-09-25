// Performance Optimization Integration Tests
import PerformanceOptimizer from '../PerformanceOptimizer.js';
import MemoryManager from '../MemoryManager.js';
import PerformanceMonitor from '../PerformanceMonitor.js';
import STTCacheOptimizer from '../STTCacheOptimizer.js';
import ProductionLogger from '../ProductionLogger.js';
import IntegrationTester from '../IntegrationTester.js';

// Mock performance.memory for testing
Object.defineProperty(performance, 'memory', {
  value: {
    usedJSHeapSize: 50 * 1024 * 1024, // 50MB
    totalJSHeapSize: 100 * 1024 * 1024, // 100MB
    jsHeapSizeLimit: 2 * 1024 * 1024 * 1024 // 2GB
  },
  configurable: true
});

// Mock PerformanceObserver
global.PerformanceObserver = class MockPerformanceObserver {
  constructor(callback) {
    this.callback = callback;
  }
  
  observe() {
    // Mock implementation
  }
  
  disconnect() {
    // Mock implementation
  }
};

describe('Performance Optimization Integration', () => {
  let performanceOptimizer;
  let memoryManager;
  let performanceMonitor;
  let sttCacheOptimizer;
  let productionLogger;
  let integrationTester;

  beforeEach(() => {
    performanceOptimizer = new PerformanceOptimizer();
    memoryManager = new MemoryManager();
    performanceMonitor = new PerformanceMonitor();
    sttCacheOptimizer = new STTCacheOptimizer();
    productionLogger = new ProductionLogger();
    integrationTester = new IntegrationTester();
  });

  afterEach(() => {
    performanceOptimizer.cleanup();
    memoryManager.stop();
    performanceMonitor.cleanup();
    sttCacheOptimizer.cleanup();
    productionLogger.cleanup();
    integrationTester.cleanup();
  });

  describe('PerformanceOptimizer', () => {
    test('should initialize and start optimization', async () => {
      await performanceOptimizer.startOptimization('balanced');
      
      const status = performanceOptimizer.getOptimizationStatus();
      expect(status.isOptimizing).toBe(true);
      expect(status.performanceMode).toBe('balanced');
      expect(status.enabledStrategies.length).toBeGreaterThan(0);
    });

    test('should apply different performance modes', async () => {
      // Test performance mode
      await performanceOptimizer.startOptimization('performance');
      let status = performanceOptimizer.getOptimizationStatus();
      expect(status.performanceMode).toBe('performance');
      
      performanceOptimizer.stopOptimization();
      
      // Test battery mode
      await performanceOptimizer.startOptimization('battery');
      status = performanceOptimizer.getOptimizationStatus();
      expect(status.performanceMode).toBe('battery');
    });

    test('should collect and report performance metrics', async () => {
      await performanceOptimizer.startOptimization('balanced');
      
      // Wait for metrics collection
      await new Promise(resolve => setTimeout(resolve, 1100));
      
      const metrics = performanceOptimizer.getPerformanceMetrics();
      expect(metrics).toBeDefined();
      expect(typeof metrics.memoryUsage).toBe('number');
    });

    test('should trigger optimizations based on thresholds', async () => {
      const eventPromise = new Promise(resolve => {
        performanceOptimizer.addEventListener('memoryOptimizationTriggered', resolve);
      });
      
      await performanceOptimizer.startOptimization('balanced');
      
      // Simulate high memory usage
      performanceOptimizer.performanceMetrics.memoryUsage = 90;
      performanceOptimizer.triggerMemoryOptimization();
      
      const event = await eventPromise;
      expect(event).toBeDefined();
    });
  });

  describe('MemoryManager', () => {
    test('should start and manage memory pools', () => {
      memoryManager.start();
      
      expect(memoryManager.isActive).toBe(true);
      expect(memoryManager.memoryPools.size).toBeGreaterThan(0);
    });

    test('should provide object pooling functionality', () => {
      memoryManager.start();
      
      // Get object from pool
      const audioBuffer = memoryManager.getFromPool('audioBuffers');
      expect(audioBuffer).toBeDefined();
      expect(audioBuffer instanceof Float32Array).toBe(true);
      
      // Return object to pool
      const returned = memoryManager.returnToPool('audioBuffers', audioBuffer);
      expect(returned).toBe(true);
    });

    test('should manage weak references', () => {
      memoryManager.start();
      
      const testObject = { test: 'data' };
      const weakRef = memoryManager.createWeakReference('test', testObject);
      
      expect(weakRef).toBeDefined();
      
      const retrieved = memoryManager.getWeakReference('test');
      expect(retrieved).toBe(testObject);
    });

    test('should perform memory cleanup', () => {
      memoryManager.start();
      
      const initialStats = memoryManager.getMemoryStats();
      
      memoryManager.performCleanup();
      
      const finalStats = memoryManager.getMemoryStats();
      expect(finalStats.gcCount).toBeGreaterThan(initialStats.gcCount);
    });

    test('should handle memory pressure events', () => {
      memoryManager.start();
      
      const eventPromise = new Promise(resolve => {
        memoryManager.addEventListener('aggressiveCleanup', resolve);
      });
      
      memoryManager.handleMemoryPressure('critical');
      
      return eventPromise;
    });
  });

  describe('PerformanceMonitor', () => {
    test('should start monitoring and collect metrics', async () => {
      performanceMonitor.start();
      
      expect(performanceMonitor.isMonitoring).toBe(true);
      
      // Wait for metrics collection
      await new Promise(resolve => setTimeout(resolve, 1100));
      
      const metrics = performanceMonitor.getAllMetrics();
      expect(Object.keys(metrics).length).toBeGreaterThan(0);
    });

    test('should record different metric types', () => {
      performanceMonitor.start();
      
      // Test gauge metric
      performanceMonitor.recordGauge('test.gauge', 50);
      const gaugeValue = performanceMonitor.getMetric('test.gauge');
      expect(gaugeValue).toBe(50);
      
      // Test histogram metric
      performanceMonitor.recordHistogram('test.histogram', 100);
      const histogramStats = performanceMonitor.getMetricStats('test.histogram');
      expect(histogramStats.value).toBeNull(); // Histograms don't have single values
      expect(histogramStats.count).toBe(1);
      
      // Test counter metric
      performanceMonitor.incrementCounter('test.counter', 5);
      const counterValue = performanceMonitor.getMetric('test.counter');
      expect(counterValue).toBe(5);
    });

    test('should handle custom timers', () => {
      performanceMonitor.start();
      
      performanceMonitor.startTimer('test-operation');
      
      // Simulate some work
      const start = Date.now();
      while (Date.now() - start < 10) {
        // Busy wait for 10ms
      }
      
      const duration = performanceMonitor.endTimer('test-operation');
      expect(duration).toBeGreaterThan(0);
    });

    test('should export metrics in different formats', () => {
      performanceMonitor.start();
      
      performanceMonitor.recordGauge('test.metric', 42);
      
      const jsonExport = performanceMonitor.exportMetrics('json');
      expect(typeof jsonExport).toBe('string');
      expect(JSON.parse(jsonExport)).toBeDefined();
      
      const csvExport = performanceMonitor.exportMetrics('csv');
      expect(typeof csvExport).toBe('string');
      expect(csvExport.includes('test.metric')).toBe(true);
    });
  });

  describe('STTCacheOptimizer', () => {
    test('should start and manage cache', () => {
      sttCacheOptimizer.start();
      
      expect(sttCacheOptimizer.isActive).toBe(true);
      expect(sttCacheOptimizer.cache).toBeDefined();
    });

    test('should cache and retrieve STT results', () => {
      sttCacheOptimizer.start();
      
      const mockAudioData = {
        data: new Float32Array([0.1, 0.2, 0.3]),
        sampleRate: 16000
      };
      
      const mockResult = {
        text: 'test transcription',
        confidence: 0.9
      };
      
      const cacheKey = sttCacheOptimizer.generateCacheKey(mockAudioData, {});
      sttCacheOptimizer.addToCache(cacheKey, mockResult);
      
      const retrieved = sttCacheOptimizer.getFromCache(cacheKey);
      expect(retrieved).toEqual(mockResult);
    });

    test('should deduplicate similar requests', () => {
      sttCacheOptimizer.start();
      
      const mockAudioData = {
        data: new Float32Array([0.1, 0.2, 0.3]),
        sampleRate: 16000
      };
      
      const requests = [
        { audioData: mockAudioData, provider: 'local', config: {} },
        { audioData: mockAudioData, provider: 'local', config: {} }
      ];
      
      const deduplicated = sttCacheOptimizer.deduplicateRequests(requests);
      expect(deduplicated.length).toBe(1);
      expect(deduplicated[0].similarRequests.length).toBe(2);
    });

    test('should compress audio data', () => {
      sttCacheOptimizer.start();
      
      const originalAudio = {
        data: new Float32Array(1000),
        sampleRate: 16000
      };
      
      const compressed = sttCacheOptimizer.compressAudioData(originalAudio);
      expect(compressed.data.length).toBeLessThan(originalAudio.data.length);
      expect(compressed.compressed).toBe(true);
    });

    test('should provide cache statistics', () => {
      sttCacheOptimizer.start();
      
      const stats = sttCacheOptimizer.getCacheStats();
      expect(stats).toBeDefined();
      expect(typeof stats.cacheSize).toBe('number');
      expect(typeof stats.hitRate).toBe('number');
    });
  });

  describe('ProductionLogger', () => {
    test('should start logging and capture events', () => {
      productionLogger.start();
      
      expect(productionLogger.isActive).toBe(true);
      expect(productionLogger.config.sessionId).toBeDefined();
    });

    test('should log different message types', () => {
      productionLogger.start();
      
      productionLogger.log('info', 'test', 'Test message', { data: 'test' });
      productionLogger.logError('Test error', new Error('Test error'));
      productionLogger.logPerformance('test-metric', 100);
      
      const logs = productionLogger.getStoredLogs();
      expect(logs.length).toBeGreaterThan(0);
    });

    test('should filter logs by criteria', () => {
      productionLogger.start();
      
      productionLogger.log('info', 'test', 'Info message');
      productionLogger.log('error', 'test', 'Error message');
      
      const errorLogs = productionLogger.getStoredLogs({ level: 'error' });
      expect(errorLogs.length).toBe(1);
      expect(errorLogs[0].level).toBe('error');
    });

    test('should export logs in different formats', () => {
      productionLogger.start();
      
      productionLogger.log('info', 'test', 'Test message');
      
      const jsonExport = productionLogger.exportLogs('json');
      expect(typeof jsonExport).toBe('string');
      
      const csvExport = productionLogger.exportLogs('csv');
      expect(typeof csvExport).toBe('string');
      expect(csvExport.includes('Test message')).toBe(true);
    });

    test('should provide logging statistics', () => {
      productionLogger.start();
      
      productionLogger.log('info', 'test', 'Info message');
      productionLogger.log('error', 'test', 'Error message');
      
      const stats = productionLogger.getStats();
      expect(stats.totalLogs).toBe(2);
      expect(stats.errorCount).toBe(1);
    });
  });

  describe('IntegrationTester', () => {
    test('should initialize test suites', () => {
      expect(integrationTester.testSuites.size).toBeGreaterThan(0);
      expect(integrationTester.testSuites.has('audio')).toBe(true);
      expect(integrationTester.testSuites.has('transcription')).toBe(true);
    });

    test('should run individual tests', async () => {
      const mockTest = {
        name: 'Mock Test',
        fn: jest.fn().mockResolvedValue({ success: true })
      };
      
      const result = await integrationTester.runSingleTest(mockTest);
      
      expect(result.name).toBe('Mock Test');
      expect(result.status).toBe('passed');
      expect(result.duration).toBeGreaterThan(0);
      expect(mockTest.fn).toHaveBeenCalled();
    });

    test('should handle test failures', async () => {
      const mockTest = {
        name: 'Failing Test',
        fn: jest.fn().mockRejectedValue(new Error('Test failed'))
      };
      
      const result = await integrationTester.runSingleTest(mockTest);
      
      expect(result.status).toBe('failed');
      expect(result.error).toBe('Test failed');
    });

    test('should generate test reports', async () => {
      // Add a simple test suite
      integrationTester.testSuites.set('mock', {
        name: 'Mock Test Suite',
        tests: [
          { name: 'Mock Test', fn: () => Promise.resolve({ success: true }) }
        ]
      });
      
      const results = await integrationTester.runAllTests();
      
      expect(results.summary).toBeDefined();
      expect(results.summary.totalTests).toBeGreaterThan(0);
      expect(results.suites).toBeDefined();
    });

    test('should export results in different formats', () => {
      integrationTester.testResults.set('mock', {
        name: 'Mock Suite',
        tests: [{ name: 'Mock Test', status: 'passed', duration: 100 }],
        passed: 1,
        failed: 0,
        skipped: 0
      });
      
      integrationTester.stats.totalTests = 1;
      integrationTester.stats.passedTests = 1;
      
      const jsonExport = integrationTester.exportResults('json');
      expect(typeof jsonExport).toBe('string');
      
      const htmlExport = integrationTester.exportResults('html');
      expect(typeof htmlExport).toBe('string');
      expect(htmlExport.includes('<!DOCTYPE html>')).toBe(true);
    });
  });

  describe('Integration Scenarios', () => {
    test('should coordinate performance optimization across services', async () => {
      // Start all services
      await performanceOptimizer.startOptimization('balanced');
      memoryManager.start();
      performanceMonitor.start();
      sttCacheOptimizer.start();
      productionLogger.start();
      
      // Simulate performance issue
      performanceOptimizer.performanceMetrics.memoryUsage = 90;
      
      // Trigger coordinated response
      performanceOptimizer.triggerMemoryOptimization();
      memoryManager.performCleanup();
      
      // Verify services are working together
      expect(performanceOptimizer.isOptimizing).toBe(true);
      expect(memoryManager.isActive).toBe(true);
      expect(performanceMonitor.isMonitoring).toBe(true);
      expect(sttCacheOptimizer.isActive).toBe(true);
      expect(productionLogger.isActive).toBe(true);
    });

    test('should handle cascading performance optimizations', async () => {
      await performanceOptimizer.startOptimization('performance');
      memoryManager.start();
      
      // Set up event listeners to track cascading effects
      const events = [];
      
      performanceOptimizer.addEventListener('memoryOptimizationTriggered', () => {
        events.push('memory-optimization');
      });
      
      memoryManager.addEventListener('aggressiveCleanup', () => {
        events.push('aggressive-cleanup');
      });
      
      // Trigger cascading optimization
      performanceOptimizer.performanceMetrics.memoryUsage = 95;
      performanceOptimizer.triggerMemoryOptimization();
      memoryManager.handleMemoryPressure('critical');
      
      expect(events).toContain('memory-optimization');
      expect(events).toContain('aggressive-cleanup');
    });

    test('should maintain performance under load', async () => {
      await performanceOptimizer.startOptimization('performance');
      memoryManager.start();
      sttCacheOptimizer.start();
      
      // Simulate high load
      const promises = [];
      for (let i = 0; i < 10; i++) {
        const mockAudio = {
          data: new Float32Array(1000),
          sampleRate: 16000
        };
        
        promises.push(
          sttCacheOptimizer.queueSTTRequest(mockAudio, 'local', {})
            .catch(() => {}) // Ignore expected failures
        );
      }
      
      // Wait for processing
      await Promise.allSettled(promises);
      
      // Verify system stability
      const optimizationStatus = performanceOptimizer.getOptimizationStatus();
      const memoryStats = memoryManager.getMemoryStats();
      
      expect(optimizationStatus.isOptimizing).toBe(true);
      expect(memoryStats.currentUsage).toBeLessThan(100);
    });

    test('should recover from performance degradation', async () => {
      await performanceOptimizer.startOptimization('balanced');
      memoryManager.start();
      
      // Simulate performance degradation
      performanceOptimizer.performanceMetrics.memoryUsage = 95;
      performanceOptimizer.performanceMetrics.frameRate = 15;
      
      // Trigger recovery mechanisms
      performanceOptimizer.triggerMemoryOptimization();
      performanceOptimizer.triggerRenderingOptimization();
      memoryManager.performAggressiveCleanup();
      
      // Wait for recovery
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Verify recovery actions were taken
      const memoryStats = memoryManager.getMemoryStats();
      expect(memoryStats.gcCount).toBeGreaterThan(0);
    });
  });

  describe('Error Handling and Edge Cases', () => {
    test('should handle service initialization failures gracefully', async () => {
      // Mock a service that fails to initialize
      const mockService = {
        start: jest.fn().mockRejectedValue(new Error('Initialization failed'))
      };
      
      // Should not throw when a service fails
      await expect(async () => {
        try {
          await mockService.start();
        } catch (error) {
          // Log error but continue
          console.warn('Service failed to start:', error.message);
        }
      }).not.toThrow();
    });

    test('should handle memory pressure gracefully', () => {
      memoryManager.start();
      
      // Simulate extreme memory pressure
      memoryManager.performanceMetrics = { memoryUsage: 99 };
      
      expect(() => {
        memoryManager.handleCriticalMemory();
      }).not.toThrow();
    });

    test('should handle cache overflow', () => {
      sttCacheOptimizer.start();
      sttCacheOptimizer.config.maxCacheSize = 2;
      
      // Add more items than cache can hold
      for (let i = 0; i < 5; i++) {
        sttCacheOptimizer.addToCache(`key${i}`, { text: `result${i}` });
      }
      
      expect(sttCacheOptimizer.cache.size).toBeLessThanOrEqual(2);
    });

    test('should handle logging buffer overflow', () => {
      productionLogger.start();
      productionLogger.maxBufferSize = 2;
      
      // Add more logs than buffer can hold
      for (let i = 0; i < 5; i++) {
        productionLogger.log('info', 'test', `Message ${i}`);
      }
      
      expect(productionLogger.logBuffer.length).toBeLessThanOrEqual(2);
    });
  });
});

// Helper function to wait for async operations
const waitFor = (ms) => new Promise(resolve => setTimeout(resolve, ms));