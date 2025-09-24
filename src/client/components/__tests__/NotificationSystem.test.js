/**
 * Tests for the NotificationSystem component
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import NotificationSystem from '../NotificationSystem';
import { errorHandler, ErrorSeverity } from '../../services/ErrorHandler';

// Mock the error handler
jest.mock('../../services/ErrorHandler', () => ({
  errorHandler: {
    addErrorListener: jest.fn(),
    removeErrorListener: jest.fn()
  },
  ErrorSeverity: {
    INFO: 'info',
    WARNING: 'warning',
    ERROR: 'error',
    CRITICAL: 'critical'
  }
}));

describe('NotificationSystem', () => {
  let mockErrorListener;
  let mockNotificationListener;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Capture the listeners that get registered
    errorHandler.addErrorListener.mockImplementation((listener) => {
      if (!mockErrorListener) {
        mockErrorListener = listener;
      } else {
        mockNotificationListener = listener;
      }
    });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('Rendering', () => {
    test('should not render when no notifications', () => {
      const { container } = render(<NotificationSystem />);
      expect(container.firstChild).toBeNull();
    });

    test('should render notification system when notifications exist', () => {
      render(<NotificationSystem />);
      
      // Simulate adding a notification
      const notification = {
        id: '1',
        message: 'Test notification',
        severity: ErrorSeverity.INFO,
        timestamp: new Date()
      };
      
      mockErrorListener(notification);
      
      expect(screen.getByText('Notifications')).toBeInTheDocument();
      expect(screen.getByText('Test notification')).toBeInTheDocument();
    });

    test('should register and unregister error listeners', () => {
      const { unmount } = render(<NotificationSystem />);
      
      expect(errorHandler.addErrorListener).toHaveBeenCalledTimes(2);
      
      unmount();
      
      expect(errorHandler.removeErrorListener).toHaveBeenCalledTimes(2);
    });
  });

  describe('Notification Display', () => {
    test('should display notification with correct severity styling', () => {
      render(<NotificationSystem />);
      
      const notification = {
        id: '1',
        message: 'Error notification',
        severity: ErrorSeverity.ERROR,
        timestamp: new Date()
      };
      
      mockErrorListener(notification);
      
      const notificationElement = screen.getByText('Error notification').closest('.notification');
      expect(notificationElement).toHaveClass('notification-error');
      expect(screen.getByText('ERROR')).toBeInTheDocument();
    });

    test('should display notification with timestamp', () => {
      render(<NotificationSystem />);
      
      const testTime = new Date('2023-01-01T12:00:00Z');
      const notification = {
        id: '1',
        message: 'Test notification',
        severity: ErrorSeverity.INFO,
        timestamp: testTime
      };
      
      mockErrorListener(notification);
      
      expect(screen.getByText(testTime.toLocaleTimeString())).toBeInTheDocument();
    });

    test('should display notification with category and code', () => {
      render(<NotificationSystem />);
      
      const notification = {
        id: '1',
        message: 'Test notification',
        severity: ErrorSeverity.WARNING,
        category: 'audio_capture',
        code: 'MICROPHONE_ACCESS_DENIED',
        timestamp: new Date()
      };
      
      mockErrorListener(notification);
      
      expect(screen.getByText('Category: audio_capture')).toBeInTheDocument();
      expect(screen.getByText('Code: MICROPHONE_ACCESS_DENIED')).toBeInTheDocument();
    });

    test('should display notification actions', () => {
      render(<NotificationSystem />);
      
      const mockAction = jest.fn();
      const notification = {
        id: '1',
        message: 'Test notification',
        severity: ErrorSeverity.ERROR,
        actions: [
          { label: 'Retry', action: mockAction },
          { label: 'Cancel', action: jest.fn() }
        ],
        timestamp: new Date()
      };
      
      mockErrorListener(notification);
      
      expect(screen.getByText('Retry')).toBeInTheDocument();
      expect(screen.getByText('Cancel')).toBeInTheDocument();
      
      fireEvent.click(screen.getByText('Retry'));
      expect(mockAction).toHaveBeenCalled();
    });
  });

  describe('Auto-dismiss Functionality', () => {
    test('should auto-dismiss info notifications after 5 seconds', async () => {
      jest.useFakeTimers();
      
      render(<NotificationSystem />);
      
      const notification = {
        id: '1',
        message: 'Info notification',
        severity: ErrorSeverity.INFO,
        timestamp: new Date()
      };
      
      mockErrorListener(notification);
      
      expect(screen.getByText('Info notification')).toBeInTheDocument();
      
      // Fast-forward 5 seconds
      jest.advanceTimersByTime(5000);
      
      await waitFor(() => {
        expect(screen.queryByText('Info notification')).not.toBeInTheDocument();
      });
    });

    test('should auto-dismiss warning notifications after 5 seconds', async () => {
      jest.useFakeTimers();
      
      render(<NotificationSystem />);
      
      const notification = {
        id: '1',
        message: 'Warning notification',
        severity: ErrorSeverity.WARNING,
        timestamp: new Date()
      };
      
      mockErrorListener(notification);
      
      expect(screen.getByText('Warning notification')).toBeInTheDocument();
      
      jest.advanceTimersByTime(5000);
      
      await waitFor(() => {
        expect(screen.queryByText('Warning notification')).not.toBeInTheDocument();
      });
    });

    test('should not auto-dismiss error notifications', async () => {
      jest.useFakeTimers();
      
      render(<NotificationSystem />);
      
      const notification = {
        id: '1',
        message: 'Error notification',
        severity: ErrorSeverity.ERROR,
        timestamp: new Date()
      };
      
      mockErrorListener(notification);
      
      expect(screen.getByText('Error notification')).toBeInTheDocument();
      
      jest.advanceTimersByTime(10000);
      
      // Should still be there after 10 seconds
      expect(screen.getByText('Error notification')).toBeInTheDocument();
    });

    test('should not auto-dismiss critical notifications', async () => {
      jest.useFakeTimers();
      
      render(<NotificationSystem />);
      
      const notification = {
        id: '1',
        message: 'Critical notification',
        severity: ErrorSeverity.CRITICAL,
        timestamp: new Date()
      };
      
      mockErrorListener(notification);
      
      expect(screen.getByText('Critical notification')).toBeInTheDocument();
      
      jest.advanceTimersByTime(10000);
      
      expect(screen.getByText('Critical notification')).toBeInTheDocument();
    });
  });

  describe('Manual Dismiss', () => {
    test('should dismiss individual notification when X is clicked', () => {
      render(<NotificationSystem />);
      
      const notification = {
        id: '1',
        message: 'Test notification',
        severity: ErrorSeverity.ERROR,
        timestamp: new Date()
      };
      
      mockErrorListener(notification);
      
      expect(screen.getByText('Test notification')).toBeInTheDocument();
      
      const dismissButton = screen.getByTitle('Dismiss notification');
      fireEvent.click(dismissButton);
      
      expect(screen.queryByText('Test notification')).not.toBeInTheDocument();
    });

    test('should dismiss all notifications when Clear All is clicked', () => {
      render(<NotificationSystem />);
      
      // Add multiple notifications
      mockErrorListener({
        id: '1',
        message: 'First notification',
        severity: ErrorSeverity.INFO,
        timestamp: new Date()
      });
      
      mockErrorListener({
        id: '2',
        message: 'Second notification',
        severity: ErrorSeverity.ERROR,
        timestamp: new Date()
      });
      
      expect(screen.getByText('First notification')).toBeInTheDocument();
      expect(screen.getByText('Second notification')).toBeInTheDocument();
      
      fireEvent.click(screen.getByText('Clear All'));
      
      expect(screen.queryByText('First notification')).not.toBeInTheDocument();
      expect(screen.queryByText('Second notification')).not.toBeInTheDocument();
    });

    test('should dismiss notification when action is clicked', () => {
      render(<NotificationSystem />);
      
      const notification = {
        id: '1',
        message: 'Test notification',
        severity: ErrorSeverity.ERROR,
        actions: [
          { label: 'Fix', action: jest.fn() }
        ],
        timestamp: new Date()
      };
      
      mockErrorListener(notification);
      
      expect(screen.getByText('Test notification')).toBeInTheDocument();
      
      fireEvent.click(screen.getByText('Fix'));
      
      expect(screen.queryByText('Test notification')).not.toBeInTheDocument();
    });
  });

  describe('Visibility Toggle', () => {
    test('should toggle visibility when minimize/show button is clicked', () => {
      render(<NotificationSystem />);
      
      const notification = {
        id: '1',
        message: 'Test notification',
        severity: ErrorSeverity.INFO,
        timestamp: new Date()
      };
      
      mockErrorListener(notification);
      
      // Should be visible initially
      expect(screen.getByText('Test notification')).toBeInTheDocument();
      
      // Click minimize
      fireEvent.click(screen.getByTitle('Minimize'));
      
      // Notification content should be hidden
      expect(screen.queryByText('Test notification')).not.toBeInTheDocument();
      
      // Click show
      fireEvent.click(screen.getByTitle('Show notifications'));
      
      // Should be visible again
      expect(screen.getByText('Test notification')).toBeInTheDocument();
    });
  });

  describe('Error Notification Handling', () => {
    test('should handle error notifications with recovery results', () => {
      render(<NotificationSystem />);
      
      const errorData = {
        type: 'error',
        errorInfo: {
          message: 'STT service failed',
          severity: ErrorSeverity.ERROR,
          category: 'transcription',
          code: 'STT_SERVICE_UNAVAILABLE'
        },
        recoveryResult: {
          success: true,
          action: 'switched_to_local_stt'
        }
      };
      
      mockNotificationListener(errorData);
      
      expect(screen.getByText(/STT service failed.*switched_to_local_stt/)).toBeInTheDocument();
    });

    test('should handle error notifications with failed recovery', () => {
      render(<NotificationSystem />);
      
      const errorData = {
        type: 'error',
        errorInfo: {
          message: 'Network connection lost',
          severity: ErrorSeverity.ERROR,
          category: 'network',
          code: 'NETWORK_CONNECTION_LOST'
        },
        recoveryResult: {
          success: false,
          action: 'network_still_down'
        }
      };
      
      mockNotificationListener(errorData);
      
      expect(screen.getByText('Network connection lost')).toBeInTheDocument();
      expect(screen.getByText('Retry')).toBeInTheDocument();
    });

    test('should handle error notifications with fallback enabled', () => {
      render(<NotificationSystem />);
      
      const errorData = {
        type: 'error',
        errorInfo: {
          message: 'Service unavailable',
          severity: ErrorSeverity.ERROR,
          category: 'transcription'
        },
        recoveryResult: {
          success: false,
          fallbackEnabled: true
        }
      };
      
      mockNotificationListener(errorData);
      
      expect(screen.getByText(/Service unavailable.*Switched to fallback mode/)).toBeInTheDocument();
    });
  });

  describe('Severity Icons', () => {
    test('should display correct icons for each severity level', () => {
      render(<NotificationSystem />);
      
      const severities = [
        { severity: ErrorSeverity.INFO, icon: 'ℹ️' },
        { severity: ErrorSeverity.WARNING, icon: '⚠️' },
        { severity: ErrorSeverity.ERROR, icon: '❌' },
        { severity: ErrorSeverity.CRITICAL, icon: '🚨' }
      ];
      
      severities.forEach(({ severity, icon }, index) => {
        mockErrorListener({
          id: `${index}`,
          message: `${severity} notification`,
          severity,
          timestamp: new Date()
        });
        
        expect(screen.getByText(icon)).toBeInTheDocument();
      });
    });
  });

  describe('Multiple Notifications', () => {
    test('should handle multiple notifications correctly', () => {
      render(<NotificationSystem />);
      
      // Add multiple notifications
      for (let i = 0; i < 5; i++) {
        mockErrorListener({
          id: `${i}`,
          message: `Notification ${i}`,
          severity: ErrorSeverity.INFO,
          timestamp: new Date()
        });
      }
      
      // All should be visible
      for (let i = 0; i < 5; i++) {
        expect(screen.getByText(`Notification ${i}`)).toBeInTheDocument();
      }
    });

    test('should maintain notification order', () => {
      render(<NotificationSystem />);
      
      // Add notifications in sequence
      mockErrorListener({
        id: '1',
        message: 'First notification',
        severity: ErrorSeverity.INFO,
        timestamp: new Date()
      });
      
      mockErrorListener({
        id: '2',
        message: 'Second notification',
        severity: ErrorSeverity.INFO,
        timestamp: new Date()
      });
      
      const notifications = screen.getAllByText(/notification/);
      expect(notifications[0]).toHaveTextContent('First notification');
      expect(notifications[1]).toHaveTextContent('Second notification');
    });
  });
});