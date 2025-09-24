// Transcription Controls Component - UI for start/stop transcription
import React, { useState } from 'react';
import './TranscriptionControls.css';

const TranscriptionControls = ({ 
  isHost, 
  meetingState, 
  onStartTranscription, 
  onStopTranscription,
  isTranscribing = false 
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState('');

  const handleStartTranscription = async () => {
    setIsLoading(true);
    setMessage('');
    
    try {
      const result = await onStartTranscription();
      if (result.success) {
        setMessage('Transcription started successfully');
      } else {
        setMessage(`Error: ${result.error}`);
      }
    } catch (error) {
      setMessage(`Error: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleStopTranscription = async () => {
    setIsLoading(true);
    setMessage('');
    
    try {
      const result = await onStopTranscription();
      if (result.success) {
        setMessage('Transcription stopped');
      } else {
        setMessage(`Error: ${result.error}`);
      }
    } catch (error) {
      setMessage(`Error: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Show different UI based on user role and meeting state
  if (meetingState !== 'active') {
    return (
      <div className="transcription-controls disabled">
        <div className="status-message">
          <span className="status-icon">⚠️</span>
          Not currently in an active meeting
        </div>
      </div>
    );
  }

  if (!isHost) {
    return (
      <div className="transcription-controls participant-view">
        <div className="status-message">
          <span className="status-icon">👥</span>
          Transcription can only be controlled by the meeting host
        </div>
        {isTranscribing && (
          <div className="transcription-status active">
            <span className="recording-indicator">🔴</span>
            Transcription is active
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="transcription-controls host-view">
      <div className="control-header">
        <h3>Transcription Controls</h3>
        <span className="host-badge">Host</span>
      </div>
      
      <div className="control-buttons">
        {!isTranscribing ? (
          <button 
            className="start-button"
            onClick={handleStartTranscription}
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <span className="spinner">⏳</span>
                Starting...
              </>
            ) : (
              <>
                <span className="icon">▶️</span>
                Start Transcription
              </>
            )}
          </button>
        ) : (
          <button 
            className="stop-button"
            onClick={handleStopTranscription}
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <span className="spinner">⏳</span>
                Stopping...
              </>
            ) : (
              <>
                <span className="icon">⏹️</span>
                Stop Transcription
              </>
            )}
          </button>
        )}
      </div>

      {isTranscribing && (
        <div className="transcription-status active">
          <span className="recording-indicator">🔴</span>
          Recording and transcribing meeting audio
        </div>
      )}

      {message && (
        <div className={`message ${message.includes('Error') ? 'error' : 'success'}`}>
          {message}
        </div>
      )}

      <div className="permissions-notice">
        <small>
          ℹ️ Transcription requires microphone access and will process meeting audio
        </small>
      </div>
    </div>
  );
};

export default TranscriptionControls;