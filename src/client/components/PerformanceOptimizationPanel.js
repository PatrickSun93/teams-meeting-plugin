// Performance Optimization Panel - UI component for managing performance optimization
import React, { useState, useEffect, useCallback } from 'react';
import PerformanceOptimizer from '../services/PerformanceOptimizer.js';
import MemoryManager from '../services/MemoryManager.js';
import PerformanceMonitor from '../services/PerformanceMonitor.js';
import STTCacheOptimizer from '../services/STTCacheOptimizer.js';
import ProductionLogger from '../services/ProductionLogger.js';
import IntegrationTester from '../services/IntegrationTester.js';
import './PerformanceOptimizationPanel.css';

const PerformanceOptimizationPanel = ({ isVisible, onClose }) => {
  const [performanceOptimizer] = useState(() => new PerformanceOptimizer());
  const [memoryManager] = useState(() => new MemoryManager());
  const [performanceMonitor] = useState(() => new PerformanceMonitor());
  const [sttCacheOptimizer] = useState(() => new STTCacheOptimizer());
  const [productionLogger] = useState(() => new ProductionLogger());
  const [integrationTester] = useState(() => new IntegrationTester());
  
  const [optimizationStatus, setOptimizationStatus] = useState({
    isOptimizing: false,
    performanceMode: 'balanced',
    enabledStrategies: []
  });
  
  const [performanceMetrics, setPerformanceMetrics] = useState({});
  const [memoryStats, setMemoryStats] = useState({});
  const [cacheStats, setCacheStats] = useState({});
  const [loggerStats, setLoggerStats] = useState({});
  const [testResults, setTestResults] = useState(null);
  
  const [activeTab, setActiveTab] = useState('overview');
  const [isRunningTests, setIsRunningTests] = useState(false);

  // Initialize services
  useEffect(() => {
    const initializeServices = async () => {
      try {
        // Set up event listeners
        setupEventListeners();
        
        // Initialize services
        await performanceMonitor.start();
        memoryManager.start();
        sttCacheOptimizer.start();
        productionLogger.start();
        
        // Update initial status
        updateStatus();
        
      } catch (error) {
        console.error('Failed to initialize performance services:', error);
      }
    };
    
    if (isVisible) {
      initializeServices();
    }
    
    return () => {
      cleanupServices();
    };
  }, [isVisible]);

  // Setup event listeners
  const setupEventListeners = useCallback(() => {
    // Performance optimizer events
    performanceOptimizer.addEventListener('optimizationStarted', updateStatus);
    performanceOptimizer.addEventListener('optimizationStopped', updateStatus);
    performanceOptimizer.addEventListener('metricsUpdated', setPerformanceMetrics);
    
    // Memory manager events
    memoryManager.addEventListener('memoryUpdate', updateMemoryStats);
    memoryManager.addEventListener('criticalMemory', handleCriticalMemory);
    
    // Performance monitor events
    performanceMonitor.addEventListener('thresholdExceeded', handleThresholdExceeded);
    performanceMonitor.addEventListener('longTask', handleLongTask);
    
    // STT cache optimizer events
    sttCacheOptimizer.addEventListener('cacheCleared', updateCacheStats);
    
    // Production logger events
    productionLogger.addEventListener('loggerStarted', updateLoggerStats);
    
    // Integration tester events
    integrationTester.addEventListener('testsCompleted', setTestResults);
  }, []);

  // Update optimization status
  const updateStatus = useCallback(() => {
    const status = performanceOptimizer.getOptimizationStatus();
    setOptimizationStatus(status);
  }, []);

  // Update memory statistics
  const updateMemoryStats = useCallback(() => {
    const stats = memoryManager.getMemoryStats();
    setMemoryStats(stats);
  }, []);

  // Update cache statistics
  const updateCacheStats = useCallback(() => {
    const stats = sttCacheOptimizer.getCacheStats();
    setCacheStats(stats);
  }, []);

  // Update logger statistics
  const updateLoggerStats = useCallback(() => {
    const stats = productionLogger.getStats();
    setLoggerStats(stats);
  }, []);

  // Handle critical memory situation
  const handleCriticalMemory = useCallback((data) => {
    console.warn('Critical memory situation detected:', data);
    // Could trigger additional optimizations or user notifications
  }, []);

  // Handle performance threshold exceeded
  const handleThresholdExceeded = useCallback((data) => {
    console.warn('Performance threshold exceeded:', data);
    // Could trigger automatic optimizations
  }, []);

  // Handle long task detection
  const handleLongTask = useCallback((data) => {
    console.warn('Long task detected:', data);
  }, []);

  // Start performance optimization
  const startOptimization = async (mode = 'balanced') => {
    try {
      await performanceOptimizer.startOptimization(mode);
      updateStatus();
    } catch (error) {
      console.error('Failed to start optimization:', error);
    }
  };

  // Stop performance optimization
  const stopOptimization = () => {
    try {
      performanceOptimizer.stopOptimization();
      updateStatus();
    } catch (error) {
      console.error('Failed to stop optimization:', error);
    }
  };

  // Trigger memory cleanup
  const triggerMemoryCleanup = () => {
    try {
      memoryManager.performCleanup();
      updateMemoryStats();
    } catch (error) {
      console.error('Failed to trigger memory cleanup:', error);
    }
  };

  // Clear STT cache
  const clearSTTCache = () => {
    try {
      sttCacheOptimizer.clearCache();
      updateCacheStats();
    } catch (error) {
      console.error('Failed to clear STT cache:', error);
    }
  };

  // Run integration tests
  const runIntegrationTests = async () => {
    try {
      setIsRunningTests(true);
      const results = await integrationTester.runAllTests();
      setTestResults(results);
    } catch (error) {
      console.error('Integration tests failed:', error);
    } finally {
      setIsRunningTests(false);
    }
  };

  // Export performance data
  const exportPerformanceData = () => {
    const data = {
      timestamp: Date.now(),
      optimizationStatus,
      performanceMetrics,
      memoryStats,
      cacheStats,
      loggerStats,
      testResults
    };
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `performance-data-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Cleanup services
  const cleanupServices = () => {
    performanceOptimizer.cleanup();
    memoryManager.stop();
    performanceMonitor.stop();
    sttCacheOptimizer.stop();
    productionLogger.stop();
    integrationTester.cleanup();
  };

  if (!isVisible) {
    return null;
  }

  return (
    <div className="performance-optimization-panel">
      <div className="panel-header">
        <h2>Performance Optimization</h2>
        <button className="close-button" onClick={onClose}>×</button>
      </div>
      
      <div className="panel-tabs">
        <button 
          className={`tab ${activeTab === 'overview' ? 'active' : ''}`}
          onClick={() => setActiveTab('overview')}
        >
          Overview
        </button>
        <button 
          className={`tab ${activeTab === 'optimization' ? 'active' : ''}`}
          onClick={() => setActiveTab('optimization')}
        >
          Optimization
        </button>
        <button 
          className={`tab ${activeTab === 'memory' ? 'active' : ''}`}
          onClick={() => setActiveTab('memory')}
        >
          Memory
        </button>
        <button 
          className={`tab ${activeTab === 'monitoring' ? 'active' : ''}`}
          onClick={() => setActiveTab('monitoring')}
        >
          Monitoring
        </button>
        <button 
          className={`tab ${activeTab === 'testing' ? 'active' : ''}`}
          onClick={() => setActiveTab('testing')}
        >
          Testing
        </button>
      </div>
      
      <div className="panel-content">
        {activeTab === 'overview' && (
          <OverviewTab
            optimizationStatus={optimizationStatus}
            performanceMetrics={performanceMetrics}
            memoryStats={memoryStats}
            cacheStats={cacheStats}
            onExportData={exportPerformanceData}
          />
        )}
        
        {activeTab === 'optimization' && (
          <OptimizationTab
            optimizationStatus={optimizationStatus}
            onStartOptimization={startOptimization}
            onStopOptimization={stopOptimization}
          />
        )}
        
        {activeTab === 'memory' && (
          <MemoryTab
            memoryStats={memoryStats}
            onTriggerCleanup={triggerMemoryCleanup}
          />
        )}
        
        {activeTab === 'monitoring' && (
          <MonitoringTab
            performanceMetrics={performanceMetrics}
            loggerStats={loggerStats}
          />
        )}
        
        {activeTab === 'testing' && (
          <TestingTab
            testResults={testResults}
            isRunningTests={isRunningTests}
            onRunTests={runIntegrationTests}
          />
        )}
      </div>
    </div>
  );
};

// Overview Tab Component
const OverviewTab = ({ optimizationStatus, performanceMetrics, memoryStats, cacheStats, onExportData }) => (
  <div className="overview-tab">
    <div className="status-grid">
      <div className="status-card">
        <h3>Optimization Status</h3>
        <div className={`status-indicator ${optimizationStatus.isOptimizing ? 'active' : 'inactive'}`}>
          {optimizationStatus.isOptimizing ? 'Active' : 'Inactive'}
        </div>
        <p>Mode: {optimizationStatus.performanceMode}</p>
        <p>Strategies: {optimizationStatus.enabledStrategies.length}</p>
      </div>
      
      <div className="status-card">
        <h3>Memory Usage</h3>
        <div className="metric-value">
          {memoryStats.currentUsage ? `${memoryStats.currentUsage.toFixed(1)}%` : 'N/A'}
        </div>
        <p>Peak: {memoryStats.peakUsage ? `${memoryStats.peakUsage.toFixed(1)}%` : 'N/A'}</p>
        <p>GC Count: {memoryStats.gcCount || 0}</p>
      </div>
      
      <div className="status-card">
        <h3>Cache Performance</h3>
        <div className="metric-value">
          {cacheStats.hitRate ? `${cacheStats.hitRate.toFixed(1)}%` : 'N/A'}
        </div>
        <p>Size: {cacheStats.cacheSize || 0}/{cacheStats.maxCacheSize || 0}</p>
        <p>Hits: {cacheStats.cacheHits || 0}</p>
      </div>
      
      <div className="status-card">
        <h3>Performance Metrics</h3>
        <div className="metric-value">
          {performanceMetrics.frameRate || 'N/A'} FPS
        </div>
        <p>Audio Latency: {performanceMetrics.audioLatency || 'N/A'}ms</p>
        <p>Memory: {performanceMetrics.memoryUsage || 'N/A'}%</p>
      </div>
    </div>
    
    <div className="actions">
      <button className="export-button" onClick={onExportData}>
        Export Performance Data
      </button>
    </div>
  </div>
);

// Optimization Tab Component
const OptimizationTab = ({ optimizationStatus, onStartOptimization, onStopOptimization }) => (
  <div className="optimization-tab">
    <div className="optimization-controls">
      <h3>Performance Mode</h3>
      <div className="mode-buttons">
        <button 
          className={`mode-button ${optimizationStatus.performanceMode === 'performance' ? 'active' : ''}`}
          onClick={() => onStartOptimization('performance')}
          disabled={optimizationStatus.isOptimizing}
        >
          Performance
        </button>
        <button 
          className={`mode-button ${optimizationStatus.performanceMode === 'balanced' ? 'active' : ''}`}
          onClick={() => onStartOptimization('balanced')}
          disabled={optimizationStatus.isOptimizing}
        >
          Balanced
        </button>
        <button 
          className={`mode-button ${optimizationStatus.performanceMode === 'battery' ? 'active' : ''}`}
          onClick={() => onStartOptimization('battery')}
          disabled={optimizationStatus.isOptimizing}
        >
          Battery
        </button>
      </div>
    </div>
    
    <div className="optimization-actions">
      {optimizationStatus.isOptimizing ? (
        <button className="stop-button" onClick={onStopOptimization}>
          Stop Optimization
        </button>
      ) : (
        <button className="start-button" onClick={() => onStartOptimization('balanced')}>
          Start Optimization
        </button>
      )}
    </div>
    
    <div className="enabled-strategies">
      <h3>Enabled Strategies</h3>
      <ul>
        {optimizationStatus.enabledStrategies.map((strategy, index) => (
          <li key={index}>{strategy.name}</li>
        ))}
      </ul>
    </div>
  </div>
);

// Memory Tab Component
const MemoryTab = ({ memoryStats, onTriggerCleanup }) => (
  <div className="memory-tab">
    <div className="memory-stats">
      <h3>Memory Statistics</h3>
      <div className="stats-grid">
        <div className="stat-item">
          <label>Current Usage:</label>
          <span>{memoryStats.currentUsage ? `${memoryStats.currentUsage.toFixed(1)}%` : 'N/A'}</span>
        </div>
        <div className="stat-item">
          <label>Peak Usage:</label>
          <span>{memoryStats.peakUsage ? `${memoryStats.peakUsage.toFixed(1)}%` : 'N/A'}</span>
        </div>
        <div className="stat-item">
          <label>GC Count:</label>
          <span>{memoryStats.gcCount || 0}</span>
        </div>
        <div className="stat-item">
          <label>Pool Efficiency:</label>
          <span>{memoryStats.poolEfficiency ? `${memoryStats.poolEfficiency.toFixed(1)}%` : 'N/A'}</span>
        </div>
      </div>
    </div>
    
    <div className="memory-actions">
      <button className="cleanup-button" onClick={onTriggerCleanup}>
        Trigger Memory Cleanup
      </button>
    </div>
  </div>
);

// Monitoring Tab Component
const MonitoringTab = ({ performanceMetrics, loggerStats }) => (
  <div className="monitoring-tab">
    <div className="metrics-display">
      <h3>Real-time Metrics</h3>
      <div className="metrics-grid">
        <div className="metric-item">
          <label>Frame Rate:</label>
          <span>{performanceMetrics.frameRate || 'N/A'} FPS</span>
        </div>
        <div className="metric-item">
          <label>Audio Latency:</label>
          <span>{performanceMetrics.audioLatency || 'N/A'}ms</span>
        </div>
        <div className="metric-item">
          <label>Memory Usage:</label>
          <span>{performanceMetrics.memoryUsage || 'N/A'}%</span>
        </div>
        <div className="metric-item">
          <label>CPU Usage:</label>
          <span>{performanceMetrics.cpuUsage || 'N/A'}%</span>
        </div>
      </div>
    </div>
    
    <div className="logger-stats">
      <h3>Logging Statistics</h3>
      <div className="stats-grid">
        <div className="stat-item">
          <label>Total Logs:</label>
          <span>{loggerStats.totalLogs || 0}</span>
        </div>
        <div className="stat-item">
          <label>Errors:</label>
          <span>{loggerStats.errorCount || 0}</span>
        </div>
        <div className="stat-item">
          <label>Warnings:</label>
          <span>{loggerStats.warnCount || 0}</span>
        </div>
        <div className="stat-item">
          <label>Session ID:</label>
          <span>{loggerStats.sessionId || 'N/A'}</span>
        </div>
      </div>
    </div>
  </div>
);

// Testing Tab Component
const TestingTab = ({ testResults, isRunningTests, onRunTests }) => (
  <div className="testing-tab">
    <div className="test-controls">
      <button 
        className="run-tests-button" 
        onClick={onRunTests}
        disabled={isRunningTests}
      >
        {isRunningTests ? 'Running Tests...' : 'Run Integration Tests'}
      </button>
    </div>
    
    {testResults && (
      <div className="test-results">
        <h3>Test Results</h3>
        <div className="test-summary">
          <div className="summary-item">
            <label>Total Tests:</label>
            <span>{testResults.summary.totalTests}</span>
          </div>
          <div className="summary-item">
            <label>Passed:</label>
            <span className="passed">{testResults.summary.passedTests}</span>
          </div>
          <div className="summary-item">
            <label>Failed:</label>
            <span className="failed">{testResults.summary.failedTests}</span>
          </div>
          <div className="summary-item">
            <label>Success Rate:</label>
            <span>{testResults.summary.successRate.toFixed(1)}%</span>
          </div>
        </div>
        
        <div className="test-suites">
          {Object.entries(testResults.suites).map(([key, suite]) => (
            <div key={key} className="test-suite">
              <h4>{suite.name}</h4>
              <div className="suite-stats">
                Passed: {suite.passed} | Failed: {suite.failed} | Skipped: {suite.skipped}
              </div>
            </div>
          ))}
        </div>
      </div>
    )}
  </div>
);

export default PerformanceOptimizationPanel;