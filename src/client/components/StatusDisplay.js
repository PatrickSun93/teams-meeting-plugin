// Status Display Component - Shows overall plugin status
import React from 'react';
import './StatusDisplay.css';

const StatusDisplay = ({ 
  meetingState, 
  isTranscribing, 
  isHost, 
  audioQuality, 
  error, 
  onClearError 
}) => {
  const getOverallStatus = () => {
    if (error) {
      return { type: 'error', message: error, icon: '❌' };
    }
    
    if (meetingState !== 'active') {
      return { 
        type: 'inactive', 
        message: 'No active meeting', 
        icon: '⚪' 
      };
    }
    
    if (isTranscribing) {
      return { 
        type: 'active', 
        message: 'Transcription active', 
        icon: '🔴' 
      };
    }
    
    if (isHost) {
      return { 
        type: 'ready', 
        message: 'Ready to start transcription', 
        icon: '🟢' 
      };
    }
    
    return { 
      type: 'waiting', 
      message: 'Waiting for host to start transcription', 
      icon: '🟡' 
    };
  };

  const status = getOverallStatus();

  const getAudioQualityStatus = () => {
    if (!audioQuality || !isTranscribing) return null;
    
    const isGoodQuality = audioQuality.averageVolume > 0.01 && 
                         audioQuality.signalToNoiseRatio > 2;
    
    return {
      isGood: isGoodQuality,
      volume: (audioQuality.averageVolume * 100).toFixed(1),
      snr: audioQuality.signalToNoiseRatio?.toFixed(1) || 'N/A'
    };
  };

  const audioStatus = getAudioQualityStatus();

  return (
    <div className={`status-display ${status.type}`}>
      <div className="status-main">
        <div className="status-indicator">
          <span className="status-icon">{status.icon}</span>
          <div className="status-text">
            <span className="status-message">{status.message}</span>
            {status.type === 'active' && (
              <span className="status-detail">Recording and processing audio</span>
            )}
          </div>
        </div>
        
        {error && (
          <button 
            className="error-dismiss"
            onClick={onClearError}
            title="Dismiss error"
          >
            ×
          </button>
        )}
      </div>
      
      {audioStatus && (
        <div className="audio-status">
          <div className="audio-metrics">
            <div className="metric">
              <span className="metric-label">Volume:</span>
              <span className={`metric-value ${audioStatus.volume > 1 ? 'good' : 'poor'}`}>
                {audioStatus.volume}%
              </span>
            </div>
            <div className="metric">
              <span className="metric-label">S/N Ratio:</span>
              <span className={`metric-value ${audioStatus.snr !== 'N/A' && parseFloat(audioStatus.snr) > 2 ? 'good' : 'poor'}`}>
                {audioStatus.snr}
              </span>
            </div>
            <div className="metric">
              <span className="metric-label">Quality:</span>
              <span className={`metric-value ${audioStatus.isGood ? 'good' : 'poor'}`}>
                {audioStatus.isGood ? 'Good' : 'Poor'}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StatusDisplay;