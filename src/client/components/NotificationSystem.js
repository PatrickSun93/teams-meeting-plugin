/**
 * User notification system for displaying errors, warnings, and status messages
 */

import React, { useState, useEffect, useCallback } from 'react';
import { errorHandler, ErrorSeverity } from '../services/ErrorHandler';
import './NotificationSystem.css';

const NotificationSystem = () => {
  const [notifications, setNotifications] = useState([]);
  const [isVisible, setIsVisible] = useState(false);

  const addNotification = useCallback((notification) => {
    const id = notification.id || Date.now().toString();
    const newNotification = {
      ...notification,
      id,
      timestamp: notification.timestamp || new Date()
    };

    setNotifications(prev => [...prev, newNotification]);
    setIsVisible(true);

    // Auto-dismiss info and warning notifications
    if (notification.severity === ErrorSeverity.INFO || 
        notification.severity === ErrorSeverity.WARNING) {
      setTimeout(() => {
        dismissNotification(id);
      }, 5000);
    }
  }, []);

  const dismissNotification = useCallback((id) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  }, []);

  const dismissAll = useCallback(() => {
    setNotifications([]);
    setIsVisible(false);
  }, []);

  const handleErrorNotification = useCallback((errorData) => {
    if (errorData.type === 'error') {
      const { errorInfo, recoveryResult } = errorData;
      
      let message = errorInfo.message;
      let severity = errorInfo.severity;
      let actions = [];

      // Customize message based on recovery result
      if (recoveryResult?.success) {
        message += ` (Automatically recovered: ${recoveryResult.action})`;
        severity = ErrorSeverity.WARNING;
      } else if (recoveryResult?.fallbackEnabled) {
        message += ' (Switched to fallback mode)';
        severity = ErrorSeverity.WARNING;
      }

      // Add retry action for failed recoveries
      if (!recoveryResult?.success && recoveryResult?.action !== 'max_retries_exceeded') {
        actions.push({
          label: 'Retry',
          action: () => {
            // Trigger retry through error handler
            console.log('Manual retry requested');
          }
        });
      }

      addNotification({
        message,
        severity,
        actions,
        category: errorInfo.category,
        code: errorInfo.code
      });
    }
  }, [addNotification]);

  useEffect(() => {
    // Register with error handler
    errorHandler.addErrorListener(addNotification);
    errorHandler.addErrorListener(handleErrorNotification);

    return () => {
      errorHandler.removeErrorListener(addNotification);
      errorHandler.removeErrorListener(handleErrorNotification);
    };
  }, [addNotification, handleErrorNotification]);

  const getSeverityIcon = (severity) => {
    switch (severity) {
      case ErrorSeverity.INFO:
        return 'ℹ️';
      case ErrorSeverity.WARNING:
        return '⚠️';
      case ErrorSeverity.ERROR:
        return '❌';
      case ErrorSeverity.CRITICAL:
        return '🚨';
      default:
        return 'ℹ️';
    }
  };

  const getSeverityClass = (severity) => {
    return `notification-${severity}`;
  };

  if (notifications.length === 0) {
    return null;
  }

  return (
    <div className={`notification-system ${isVisible ? 'visible' : ''}`}>
      <div className="notification-header">
        <h3>Notifications</h3>
        <div className="notification-actions">
          <button 
            className="dismiss-all-btn"
            onClick={dismissAll}
            title="Dismiss all notifications"
          >
            Clear All
          </button>
          <button 
            className="toggle-btn"
            onClick={() => setIsVisible(!isVisible)}
            title={isVisible ? 'Minimize' : 'Show notifications'}
          >
            {isVisible ? '−' : '+'}
          </button>
        </div>
      </div>

      {isVisible && (
        <div className="notification-list">
          {notifications.map((notification) => (
            <div 
              key={notification.id}
              className={`notification ${getSeverityClass(notification.severity)}`}
            >
              <div className="notification-content">
                <div className="notification-header-row">
                  <span className="notification-icon">
                    {getSeverityIcon(notification.severity)}
                  </span>
                  <span className="notification-severity">
                    {notification.severity.toUpperCase()}
                  </span>
                  <span className="notification-time">
                    {notification.timestamp.toLocaleTimeString()}
                  </span>
                  <button 
                    className="notification-dismiss"
                    onClick={() => dismissNotification(notification.id)}
                    title="Dismiss notification"
                  >
                    ×
                  </button>
                </div>
                
                <div className="notification-message">
                  {notification.message}
                </div>

                {notification.category && (
                  <div className="notification-category">
                    Category: {notification.category}
                  </div>
                )}

                {notification.code && (
                  <div className="notification-code">
                    Code: {notification.code}
                  </div>
                )}

                {notification.actions && notification.actions.length > 0 && (
                  <div className="notification-actions">
                    {notification.actions.map((action, index) => (
                      <button
                        key={index}
                        className="notification-action-btn"
                        onClick={() => {
                          action.action();
                          dismissNotification(notification.id);
                        }}
                      >
                        {action.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default NotificationSystem;