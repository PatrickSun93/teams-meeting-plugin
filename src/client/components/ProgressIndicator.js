// Progress Indicator Component - Shows loading states and progress
import React from 'react';
import './ProgressIndicator.css';

const ProgressIndicator = ({ 
  status, 
  message, 
  description, 
  progress, 
  showSpinner = true,
  variant = 'default' 
}) => {
  const getStatusIcon = (status) => {
    switch (status) {
      case 'initializing':
        return '🔄';
      case 'starting':
        return '▶️';
      case 'active':
        return '🟢';
      case 'stopping':
        return '⏹️';
      case 'processing':
        return '⚙️';
      case 'uploading':
        return '📤';
      case 'downloading':
        return '📥';
      case 'error':
        return '❌';
      case 'success':
        return '✅';
      case 'warning':
        return '⚠️';
      default:
        return '⏳';
    }
  };

  const getStatusClass = (status) => {
    switch (status) {
      case 'error':
        return 'error';
      case 'success':
        return 'success';
      case 'warning':
        return 'warning';
      case 'active':
        return 'active';
      default:
        return 'default';
    }
  };

  return (
    <div className={`progress-indicator ${variant} ${getStatusClass(status)}`}>
      <div className="progress-content">
        <div className="progress-header">
          <span className="status-icon">
            {getStatusIcon(status)}
          </span>
          {showSpinner && (status === 'initializing' || status === 'starting' || status === 'processing') && (
            <div className="spinner">
              <div className="spinner-circle"></div>
            </div>
          )}
          <div className="progress-text">
            <div className="progress-message">{message}</div>
            {description && (
              <div className="progress-description">{description}</div>
            )}
          </div>
        </div>
        
        {typeof progress === 'number' && (
          <div className="progress-bar-container">
            <div className="progress-bar">
              <div 
                className="progress-fill"
                style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
              />
            </div>
            <span className="progress-percentage">
              {Math.round(progress)}%
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProgressIndicator;