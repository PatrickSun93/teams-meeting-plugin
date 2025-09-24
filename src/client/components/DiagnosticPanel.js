/**
 * Diagnostic and troubleshooting panel for the Teams transcription plugin
 */

import React, { useState, useEffect } from 'react';
import { errorHandler } from '../services/ErrorHandler';
import './DiagnosticPanel.css';

const DiagnosticPanel = ({ isOpen, onClose }) => {
  const [diagnosticData, setDiagnosticData] = useState(null);
  const [systemInfo, setSystemInfo] = useState({});
  const [isRunningTests, setIsRunningTests] = useState(false);
  const [testResults, setTestResults] = useState({});

  useEffect(() => {
    if (isOpen) {
      loadDiagnosticData();
      loadSystemInfo();
    }
  }, [isOpen]);

  const loadDiagnosticData = () => {
    const data = errorHandler.getDiagnosticInfo();
    setDiagnosticData(data);
  };

  const loadSystemInfo = async () => {
    const info = {
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      language: navigator.language,
      cookieEnabled: navigator.cookieEnabled,
      onLine: navigator.onLine,
      hardwareConcurrency: navigator.hardwareConcurrency,
      maxTouchPoints: navigator.maxTouchPoints,
      deviceMemory: navigator.deviceMemory || 'Unknown',
      connection: navigator.connection ? {
        effectiveType: navigator.connection.effectiveType,
        downlink: navigator.connection.downlink,
        rtt: navigator.connection.rtt
      } : 'Unknown'
    };

    // Check for required APIs
    info.apis = {
      mediaDevices: !!navigator.mediaDevices,
      getUserMedia: !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia),
      speechRecognition: !!(window.SpeechRecognition || window.webkitSpeechRecognition),
      audioContext: !!(window.AudioContext || window.webkitAudioContext),
      indexedDB: !!window.indexedDB,
      fetch: !!window.fetch,
      webRTC: !!(window.RTCPeerConnection || window.webkitRTCPeerConnection)
    };

    // Check permissions
    try {
      const micPermission = await navigator.permissions.query({ name: 'microphone' });
      info.permissions = {
        microphone: micPermission.state
      };
    } catch (error) {
      info.permissions = {
        microphone: 'unknown'
      };
    }

    setSystemInfo(info);
  };

  const runDiagnosticTests = async () => {
    setIsRunningTests(true);
    const results = {};

    try {
      // Test microphone access
      results.microphoneTest = await testMicrophoneAccess();
      
      // Test network connectivity
      results.networkTest = await testNetworkConnectivity();
      
      // Test local storage
      results.storageTest = await testLocalStorage();
      
      // Test audio processing
      results.audioProcessingTest = await testAudioProcessing();
      
      // Test speech recognition
      results.speechRecognitionTest = await testSpeechRecognition();

    } catch (error) {
      console.error('Diagnostic tests failed:', error);
    }

    setTestResults(results);
    setIsRunningTests(false);
  };

  const testMicrophoneAccess = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const tracks = stream.getAudioTracks();
      
      if (tracks.length > 0) {
        const track = tracks[0];
        const settings = track.getSettings();
        
        // Clean up
        tracks.forEach(t => t.stop());
        
        return {
          success: true,
          message: 'Microphone access granted',
          details: {
            deviceId: settings.deviceId,
            sampleRate: settings.sampleRate,
            channelCount: settings.channelCount
          }
        };
      } else {
        return {
          success: false,
          message: 'No audio tracks available'
        };
      }
    } catch (error) {
      return {
        success: false,
        message: `Microphone access failed: ${error.message}`,
        error: error.name
      };
    }
  };

  const testNetworkConnectivity = async () => {
    const testUrls = [
      'https://api.openai.com',
      'https://api.anthropic.com',
      'https://speech.platform.bing.com'
    ];

    const results = {};

    for (const url of testUrls) {
      try {
        const startTime = Date.now();
        const response = await fetch(url, { 
          method: 'HEAD', 
          mode: 'no-cors',
          timeout: 5000 
        });
        const endTime = Date.now();
        
        results[url] = {
          success: true,
          responseTime: endTime - startTime,
          status: response.status || 'no-cors'
        };
      } catch (error) {
        results[url] = {
          success: false,
          error: error.message
        };
      }
    }

    return {
      success: Object.values(results).some(r => r.success),
      message: 'Network connectivity test completed',
      details: results
    };
  };

  const testLocalStorage = async () => {
    try {
      // Test localStorage
      const testKey = 'diagnostic_test';
      const testValue = 'test_data';
      
      localStorage.setItem(testKey, testValue);
      const retrieved = localStorage.getItem(testKey);
      localStorage.removeItem(testKey);
      
      if (retrieved !== testValue) {
        throw new Error('localStorage read/write failed');
      }

      // Test IndexedDB
      const dbTest = await new Promise((resolve, reject) => {
        const request = indexedDB.open('diagnostic_test', 1);
        
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const db = request.result;
          db.close();
          indexedDB.deleteDatabase('diagnostic_test');
          resolve(true);
        };
        
        request.onupgradeneeded = (event) => {
          const db = event.target.result;
          db.createObjectStore('test', { keyPath: 'id' });
        };
      });

      return {
        success: true,
        message: 'Local storage is working correctly',
        details: {
          localStorage: true,
          indexedDB: dbTest
        }
      };
    } catch (error) {
      return {
        success: false,
        message: `Local storage test failed: ${error.message}`,
        error: error.name
      };
    }
  };

  const testAudioProcessing = async () => {
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      const audioContext = new AudioContext();
      
      // Create a test oscillator
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      oscillator.frequency.setValueAtTime(440, audioContext.currentTime);
      gainNode.gain.setValueAtTime(0, audioContext.currentTime); // Silent
      
      oscillator.start();
      oscillator.stop(audioContext.currentTime + 0.1);
      
      await audioContext.close();
      
      return {
        success: true,
        message: 'Audio processing is working correctly',
        details: {
          sampleRate: audioContext.sampleRate,
          state: audioContext.state
        }
      };
    } catch (error) {
      return {
        success: false,
        message: `Audio processing test failed: ${error.message}`,
        error: error.name
      };
    }
  };

  const testSpeechRecognition = async () => {
    try {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      
      if (!SpeechRecognition) {
        return {
          success: false,
          message: 'Speech Recognition API not available'
        };
      }

      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      
      return {
        success: true,
        message: 'Speech Recognition API is available',
        details: {
          continuous: recognition.continuous,
          interimResults: recognition.interimResults,
          maxAlternatives: recognition.maxAlternatives
        }
      };
    } catch (error) {
      return {
        success: false,
        message: `Speech Recognition test failed: ${error.message}`,
        error: error.name
      };
    }
  };

  const clearDiagnosticData = () => {
    errorHandler.clearDiagnosticData();
    loadDiagnosticData();
  };

  const exportDiagnosticReport = () => {
    const report = {
      timestamp: new Date().toISOString(),
      diagnosticData,
      systemInfo,
      testResults,
      userAgent: navigator.userAgent
    };

    const blob = new Blob([JSON.stringify(report, null, 2)], { 
      type: 'application/json' 
    });
    
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `diagnostic-report-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (!isOpen) return null;

  return (
    <div className="diagnostic-panel-overlay">
      <div className="diagnostic-panel">
        <div className="diagnostic-header">
          <h2>Diagnostic & Troubleshooting</h2>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>

        <div className="diagnostic-content">
          <div className="diagnostic-section">
            <h3>System Information</h3>
            <div className="system-info">
              <div className="info-grid">
                <div className="info-item">
                  <label>Platform:</label>
                  <span>{systemInfo.platform}</span>
                </div>
                <div className="info-item">
                  <label>Language:</label>
                  <span>{systemInfo.language}</span>
                </div>
                <div className="info-item">
                  <label>Online:</label>
                  <span className={systemInfo.onLine ? 'status-good' : 'status-bad'}>
                    {systemInfo.onLine ? 'Yes' : 'No'}
                  </span>
                </div>
                <div className="info-item">
                  <label>Device Memory:</label>
                  <span>{systemInfo.deviceMemory} GB</span>
                </div>
              </div>

              <h4>API Support</h4>
              <div className="api-support">
                {systemInfo.apis && Object.entries(systemInfo.apis).map(([api, supported]) => (
                  <div key={api} className="api-item">
                    <span className={`status-indicator ${supported ? 'supported' : 'not-supported'}`}>
                      {supported ? '✓' : '✗'}
                    </span>
                    <span>{api}</span>
                  </div>
                ))}
              </div>

              <h4>Permissions</h4>
              <div className="permissions">
                {systemInfo.permissions && Object.entries(systemInfo.permissions).map(([permission, state]) => (
                  <div key={permission} className="permission-item">
                    <span>{permission}:</span>
                    <span className={`permission-state ${state}`}>{state}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="diagnostic-section">
            <h3>Recent Errors</h3>
            <div className="error-list">
              {diagnosticData?.recentErrors?.length > 0 ? (
                diagnosticData.recentErrors.map((error, index) => (
                  <div key={index} className="error-item">
                    <div className="error-header">
                      <span className="error-code">{error.code}</span>
                      <span className="error-time">
                        {new Date(error.timestamp).toLocaleString()}
                      </span>
                    </div>
                    <div className="error-message">{error.message}</div>
                    {error.category && (
                      <div className="error-category">Category: {error.category}</div>
                    )}
                  </div>
                ))
              ) : (
                <div className="no-errors">No recent errors</div>
              )}
            </div>
            <button className="clear-btn" onClick={clearDiagnosticData}>
              Clear Error History
            </button>
          </div>

          <div className="diagnostic-section">
            <h3>Fallback Modes</h3>
            <div className="fallback-modes">
              {diagnosticData?.fallbackModes && Object.keys(diagnosticData.fallbackModes).length > 0 ? (
                Object.entries(diagnosticData.fallbackModes).map(([component, mode]) => (
                  <div key={component} className="fallback-item">
                    <span className="component">{component}:</span>
                    <span className="mode">{mode}</span>
                  </div>
                ))
              ) : (
                <div className="no-fallbacks">No active fallback modes</div>
              )}
            </div>
          </div>

          <div className="diagnostic-section">
            <h3>System Tests</h3>
            <div className="test-controls">
              <button 
                className="run-tests-btn"
                onClick={runDiagnosticTests}
                disabled={isRunningTests}
              >
                {isRunningTests ? 'Running Tests...' : 'Run Diagnostic Tests'}
              </button>
            </div>

            {Object.keys(testResults).length > 0 && (
              <div className="test-results">
                {Object.entries(testResults).map(([testName, result]) => (
                  <div key={testName} className="test-result">
                    <div className="test-header">
                      <span className={`test-status ${result.success ? 'success' : 'failure'}`}>
                        {result.success ? '✓' : '✗'}
                      </span>
                      <span className="test-name">{testName}</span>
                    </div>
                    <div className="test-message">{result.message}</div>
                    {result.details && (
                      <div className="test-details">
                        <pre>{JSON.stringify(result.details, null, 2)}</pre>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="diagnostic-actions">
            <button className="export-btn" onClick={exportDiagnosticReport}>
              Export Diagnostic Report
            </button>
            <button className="refresh-btn" onClick={loadDiagnosticData}>
              Refresh Data
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DiagnosticPanel;