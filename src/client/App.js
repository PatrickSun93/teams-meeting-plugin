// Main React App component
import React, { useState, useCallback } from 'react';
import MeetingController from './components/MeetingController.js';
import MeetingStatus from './components/MeetingStatus.js';
import TranscriptionControls from './components/TranscriptionControls.js';
import './App.css';

function App() {
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [error, setError] = useState(null);
  const [meetingEvents, setMeetingEvents] = useState([]);

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
    startTranscription,
    stopTranscription,
    getPlatformCapabilities
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
        <h1>🎤 Meeting Transcription</h1>
        <p>Real-time transcription and AI summaries for Teams meetings</p>
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
          onStartTranscription={handleStartTranscription}
          onStopTranscription={handleStopTranscription}
          isTranscribing={isTranscribing}
        />

        {isTranscribing && (
          <div className="transcription-display">
            <h3>Live Transcription</h3>
            <div className="transcript-area">
              <div className="placeholder-message">
                🎯 Transcription engine will be implemented in the next task
                <br />
                <small>Audio capture is active and ready for processing</small>
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
    </div>
  );
}

export default App;