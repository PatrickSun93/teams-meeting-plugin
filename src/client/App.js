// Main React App component
import React, { useState, useCallback } from 'react';
import MeetingController from './components/MeetingController.js';
import MeetingStatus from './components/MeetingStatus.js';
import TranscriptionControls from './components/TranscriptionControls.js';
import ConfigurationPanel from './components/ConfigurationPanel.js';
import useConfiguration from './hooks/useConfiguration.js';
import './App.css';

function App() {
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [error, setError] = useState(null);
  const [meetingEvents, setMeetingEvents] = useState([]);
  const [showConfigPanel, setShowConfigPanel] = useState(false);

  // Configuration hook
  const { config, hasValidConfiguration, requiresConsent } = useConfiguration();

  // Handle meeting state changes
  const handleMeetingStateChange = useCallback((event) => {
    console.log('Meeting state changed in App:', event);
    setMeetingEvents(prev => [...prev, event]);
    
    // Stop transcription if meeting ends
    if (event.newState === 'ended' && isTranscribing) {
      setIsTranscribing(false);
    }
  }, [isTranscribing]);

  // Handle errors from meeting controller
  const handleError = useCallback((error) => {
    console.error('Meeting controller error:', error);
    setError(error.message);
  }, []);

  // Use the meeting controller hook
  const {
    isInitialized,
    meetingInfo,
    isHost,
    participants,
    meetingState,
    error: controllerError,
    isAudioCapturing,
    audioQuality,
    startTranscription,
    stopTranscription,
    getPlatformCapabilities,
    getAudioStatus
  } = MeetingController({ 
    onMeetingStateChange: handleMeetingStateChange, 
    onError: handleError 
  });

  // Handle start transcription
  const handleStartTranscription = useCallback(async () => {
    const result = await startTranscription();
    if (result.success) {
      setIsTranscribing(true);
    }
    return result;
  }, [startTranscription]);

  // Handle stop transcription
  const handleStopTranscription = useCallback(async () => {
    const result = await stopTranscription();
    if (result.success) {
      setIsTranscribing(false);
    }
    return result;
  }, [stopTranscription]);

  // Clear error message
  const clearError = () => {
    setError(null);
  };

  // Handle configuration changes
  const handleConfigChange = useCallback((newConfig) => {
    console.log('Configuration updated:', newConfig);
    // Configuration is automatically updated through the hook
  }, []);

  // Check if configuration is needed before starting transcription
  const handleStartTranscriptionWithConfig = useCallback(async () => {
    // Check if configuration is valid
    if (!hasValidConfiguration()) {
      setError('Please configure the plugin before starting transcription');
      setShowConfigPanel(true);
      return { success: false, error: 'Configuration required' };
    }

    // Check consent for cloud services
    if (requiresConsent() && !config?.consentGiven) {
      setError('Please provide consent for cloud services in configuration');
      setShowConfigPanel(true);
      return { success: false, error: 'Consent required' };
    }

    return await handleStartTranscription();
  }, [hasValidConfiguration, requiresConsent, config, handleStartTranscription]);

  if (!isInitialized) {
    return (
      <div className="App loading">
        <div className="loading-container">
          <div className="spinner">⏳</div>
          <h2>Initializing Teams Integration...</h2>
          <p>Please wait while we connect to Microsoft Teams</p>
        </div>
      </div>
    );
  }

  const displayError = error || controllerError;

  return (
    <div className="App">
      <header className="App-header">
        <div className="header-content">
          <div className="header-text">
            <h1>🎤 Meeting Transcription</h1>
            <p>Real-time transcription and AI summaries for Teams meetings</p>
          </div>
          <button 
            className="config-button"
            onClick={() => setShowConfigPanel(true)}
            title="Open Configuration"
          >
            ⚙️ Settings
          </button>
        </div>
      </header>

      <main className="App-main">
        {displayError && (
          <div className="error-banner">
            <span className="error-icon">⚠️</span>
            <span className="error-message">{displayError}</span>
            <button className="error-close" onClick={clearError}>×</button>
          </div>
        )}

        <MeetingStatus 
          meetingInfo={meetingInfo}
          participants={participants}
          isHost={isHost}
          meetingState={meetingState}
        />

        <TranscriptionControls
          isHost={isHost}
          meetingState={meetingState}
          onStartTranscription={handleStartTranscriptionWithConfig}
          onStopTranscription={handleStopTranscription}
          isTranscribing={isTranscribing}
        />

        {isTranscribing && (
          <div className="transcription-display">
            <h3>Live Transcription</h3>
            
            {isAudioCapturing && (
              <div className="audio-status">
                <div className="audio-indicator">
                  <span className="recording-dot">🔴</span>
                  <span>Audio Capture Active</span>
                </div>
                
                {audioQuality && (
                  <div className="audio-quality">
                    <h4>Audio Quality</h4>
                    <div className="quality-metrics">
                      <div className="metric">
                        <span>Volume:</span>
                        <span className={audioQuality.averageVolume > 0.01 ? 'good' : 'poor'}>
                          {(audioQuality.averageVolume * 100).toFixed(1)}%
                        </span>
                      </div>
                      <div className="metric">
                        <span>Signal/Noise:</span>
                        <span className={audioQuality.signalToNoiseRatio > 2 ? 'good' : 'poor'}>
                          {audioQuality.signalToNoiseRatio?.toFixed(1) || 'N/A'}
                        </span>
                      </div>
                      <div className="metric">
                        <span>Quality:</span>
                        <span className={getAudioStatus()?.isQualitySufficient ? 'good' : 'poor'}>
                          {getAudioStatus()?.isQualitySufficient ? '✅ Good' : '⚠️ Poor'}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
            
            <div className="transcript-area">
              <div className="placeholder-message">
                🎯 Transcription engine will be implemented in the next task
                <br />
                <small>Audio capture is {isAudioCapturing ? 'active and ready' : 'not active'} for processing</small>
              </div>
            </div>
          </div>
        )}

        {getPlatformCapabilities && (
          <div className="platform-info">
            <h4>Platform Capabilities</h4>
            <div className="capabilities-grid">
              {Object.entries(getPlatformCapabilities()).map(([key, value]) => (
                <div key={key} className="capability-item">
                  <span className="capability-name">{key}:</span>
                  <span className={`capability-value ${value === true ? 'supported' : value === false ? 'unsupported' : 'info'}`}>
                    {value === true ? '✅' : value === false ? '❌' : value}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {meetingEvents.length > 0 && (
          <details className="debug-info">
            <summary>Debug: Meeting Events ({meetingEvents.length})</summary>
            <div className="events-list">
              {meetingEvents.slice(-5).map((event, index) => (
                <div key={index} className="event-item">
                  <span className="event-time">
                    {new Date(event.timestamp).toLocaleTimeString()}
                  </span>
                  <span className="event-type">{event.type}</span>
                  <span className="event-details">
                    {event.previousState} → {event.newState}
                  </span>
                </div>
              ))}
            </div>
          </details>
        )}
      </main>

      <ConfigurationPanel
        isOpen={showConfigPanel}
        onClose={() => setShowConfigPanel(false)}
        onConfigChange={handleConfigChange}
      />
    </div>
  );
}

export default App;