/**
 * Comprehensive tests for the ErrorHandler service
 */

import ErrorHandler, { ErrorSeverity, ErrorCategory, ErrorCode } from '../ErrorHandler';

// Mock dependencies
const mockConfigManager = {
  getConfiguration: jest.fn(),
  saveConfiguration: jest.fn()
};

const mockTranscriptionEngine = {
  switchToLocalSTT: jest.fn(),
  switchSTTProvider: jest.fn()
};

const mockAudioProcessor = {
  startCapture: jest.fn(),
  stopCapture: jest.fn()
};

describe('ErrorHandler', () => {
  let errorHandler;
  let mockListener;

  beforeEach(() => {
    errorHandler = new ErrorHandler();
    mockListener = jest.fn();
    
    // Reset mocks
    jest.clearAllMocks();
    
    // Mock console methods
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Error Listener Management', () => {
    test('should add and remove error listeners', () => {
      errorHandler.addErrorListener(mockListener);
      expect(errorHandler.errorListeners.has(mockListener)).toBe(true);

      errorHandler.removeErrorListener(mockListener);
      expect(errorHandler.errorListeners.has(mockListener)).toBe(false);
    });

    test('should notify listeners when error occurs', async () => {
      errorHandler.addErrorListener(mockListener);
      
      const testError = new Error('Test error');
      await errorHandler.handleError(testError);

      expect(mockListener).toHaveBeenCalled();
      const notification = mockListener.mock.calls[0][0];
      expect(notification.type).toBe('error');
      expect(notification.errorInfo).toBeDefined();
    });
  });

  describe('Error Categorization', () => {
    test('should categorize microphone access denied error', async () => {
      const error = new Error('Permission denied');
      error.name = 'NotAllowedError';
      
      await errorHandler.handleError(error);
      
      expect(console.error).toHaveBeenCalledWith(
        'Error handled:',
        expect.objectContaining({
          code: ErrorCode.MICROPHONE_ACCESS_DENIED,
          severity: ErrorSeverity.ERROR
        })
      );
    });

    test('should categorize rate limit error', async () => {
      const error = new Error('Rate limit exceeded');
      
      await errorHandler.handleError(error);
      
      expect(console.error).toHaveBeenCalledWith(
        'Error handled:',
        expect.objectContaining({
          code: ErrorCode.STT_API_RATE_LIMIT,
          severity: ErrorSeverity.WARNING
        })
      );
    });

    test('should categorize authentication error', async () => {
      const error = new Error('Authentication failed');
      error.status = 401;
      
      await errorHandler.handleError(error);
      
      expect(console.error).toHaveBeenCalledWith(
        'Error handled:',
        expect.objectContaining({
          code: ErrorCode.STT_AUTHENTICATION_FAILED,
          severity: ErrorSeverity.ERROR
        })
      );
    });

    test('should categorize network error', async () => {
      const error = new Error('Network connection failed');
      error.name = 'NetworkError';
      
      await errorHandler.handleError(error);
      
      expect(console.error).toHaveBeenCalledWith(
        'Error handled:',
        expect.objectContaining({
          code: ErrorCode.NETWORK_CONNECTION_LOST,
          severity: ErrorSeverity.WARNING
        })
      );
    });
  });

  describe('Audio Error Handling', () => {
    test('should handle microphone access denied', async () => {
      const error = new Error('Permission denied');
      error.name = 'NotAllowedError';
      
      errorHandler.addErrorListener(mockListener);
      const result = await errorHandler.handleAudioError(error);

      expect(result.success).toBe(false);
      expect(result.action).toBe('user_intervention_required');
      expect(mockListener).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('Microphone access denied'),
          severity: ErrorSeverity.ERROR
        })
      );
    });

    test('should handle audio stream interruption', async () => {
      const error = new Error('Audio stream interrupted');
      
      // Mock successful audio recovery
      global.navigator = {
        mediaDevices: {
          getUserMedia: jest.fn().mockResolvedValue({
            getTracks: () => [{ stop: jest.fn() }]
          })
        }
      };

      const result = await errorHandler.handleAudioError(error, {
        component: 'audio'
      });

      expect(result.success).toBe(true);
      expect(result.action).toBe('audio_stream_restored');
    });

    test('should handle poor audio quality', async () => {
      const error = new Error('Poor audio quality detected');
      
      errorHandler.addErrorListener(mockListener);
      const result = await errorHandler.handleAudioError(error);

      expect(result.success).toBe(true);
      expect(result.action).toBe('quality_warning_shown');
      expect(mockListener).toHaveBeenCalledWith(
        expect.objectContaining({
          severity: ErrorSeverity.WARNING
        })
      );
    });
  });

  describe('Transcription Error Handling', () => {
    test('should handle STT service unavailable with fallback', async () => {
      const error = new Error('STT service unavailable');
      
      // Mock local STT availability
      global.window = {
        webkitSpeechRecognition: function() {}
      };

      errorHandler.addErrorListener(mockListener);
      const result = await errorHandler.handleTranscriptionError(error, {
        component: 'transcription'
      });

      expect(result.success).toBe(true);
      expect(result.action).toBe('fallback_enabled');
      expect(errorHandler.isInFallbackMode('transcription')).toBe(true);
    });

    test('should handle STT rate limit', async () => {
      const error = new Error('Rate limit exceeded');
      
      // Mock local STT availability
      global.window = {
        webkitSpeechRecognition: function() {}
      };

      const result = await errorHandler.handleTranscriptionError(error);

      expect(result.success).toBe(true);
      expect(result.action).toBe('switched_to_local_stt');
    });

    test('should handle STT authentication failure', async () => {
      const error = new Error('Authentication failed');
      error.status = 401;
      
      errorHandler.addErrorListener(mockListener);
      const result = await errorHandler.handleTranscriptionError(error);

      expect(result.success).toBe(false);
      expect(result.action).toBe('authentication_failed');
      expect(mockListener).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('authentication failed'),
          actions: expect.arrayContaining([
            expect.objectContaining({ label: 'Update API Key' })
          ])
        })
      );
    });
  });

  describe('Summary Error Handling', () => {
    test('should handle AI service unavailable', async () => {
      const error = new Error('AI service unavailable');
      
      errorHandler.addErrorListener(mockListener);
      const result = await errorHandler.handleSummaryError(error, {
        component: 'summary'
      });

      expect(result.success).toBe(true);
      expect(result.action).toBe('basic_summary_fallback');
      expect(errorHandler.isInFallbackMode('summary')).toBe(true);
    });

    test('should handle invalid custom prompt', async () => {
      const error = new Error('Invalid prompt format');
      
      errorHandler.addErrorListener(mockListener);
      const result = await errorHandler.handleSummaryError(error);

      expect(result.success).toBe(true);
      expect(result.action).toBe('default_prompt_used');
      expect(mockListener).toHaveBeenCalledWith(
        expect.objectContaining({
          actions: expect.arrayContaining([
            expect.objectContaining({ label: 'Edit Prompt' })
          ])
        })
      );
    });
  });

  describe('Retry Logic', () => {
    test('should implement exponential backoff for retries', async () => {
      const error = new Error('Temporary failure');
      
      // Mock Date.now for consistent timing
      const originalNow = Date.now;
      let mockTime = 1000;
      Date.now = jest.fn(() => mockTime);

      // Mock setTimeout to track delays
      const originalSetTimeout = global.setTimeout;
      const delays = [];
      global.setTimeout = jest.fn((callback, delay) => {
        delays.push(delay);
        callback();
      });

      try {
        // First attempt
        await errorHandler.handleError(error, { component: 'test' });
        
        // Second attempt (should have delay)
        mockTime += 2000;
        await errorHandler.handleError(error, { component: 'test' });
        
        // Third attempt (should have longer delay)
        mockTime += 4000;
        await errorHandler.handleError(error, { component: 'test' });

        expect(delays).toHaveLength(2);
        expect(delays[0]).toBe(1000); // Base delay
        expect(delays[1]).toBe(2000); // Exponential backoff
      } finally {
        Date.now = originalNow;
        global.setTimeout = originalSetTimeout;
      }
    });

    test('should stop retrying after max attempts', async () => {
      const error = new Error('Persistent failure');
      
      // Set max retry attempts to 2 for testing
      errorHandler.maxRetryAttempts = 2;

      let attempts = 0;
      for (let i = 0; i < 5; i++) {
        const result = await errorHandler.handleError(error, { component: 'test' });
        if (result.action !== 'max_retries_exceeded') {
          attempts++;
        } else {
          break;
        }
      }

      expect(attempts).toBeLessThanOrEqual(2);
    });
  });

  describe('Fallback Mode Management', () => {
    test('should enable and disable fallback modes', () => {
      expect(errorHandler.isInFallbackMode('transcription')).toBe(false);
      
      errorHandler.enableFallbackMode('transcription', 'local-only');
      expect(errorHandler.isInFallbackMode('transcription')).toBe(true);
      
      const fallbackModes = errorHandler.fallbackModes;
      expect(fallbackModes.get('transcription')).toBe('local-only');
    });

    test('should notify listeners when fallback mode is enabled', () => {
      errorHandler.addErrorListener(mockListener);
      
      errorHandler.enableFallbackMode('transcription', 'local-only');
      
      expect(mockListener).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('Switched to local-only mode'),
          severity: ErrorSeverity.WARNING
        })
      );
    });
  });

  describe('Diagnostic Data', () => {
    test('should collect diagnostic information', async () => {
      const error1 = new Error('First error');
      const error2 = new Error('Second error');
      
      await errorHandler.handleError(error1);
      await errorHandler.handleError(error2);
      
      const diagnosticInfo = errorHandler.getDiagnosticInfo();
      
      expect(diagnosticInfo.recentErrors).toHaveLength(2);
      expect(diagnosticInfo.recentErrors[0].message).toBe('First error');
      expect(diagnosticInfo.recentErrors[1].message).toBe('Second error');
      expect(diagnosticInfo.timestamp).toBeInstanceOf(Date);
    });

    test('should limit diagnostic data to 100 entries', async () => {
      // Add 150 errors
      for (let i = 0; i < 150; i++) {
        await errorHandler.handleError(new Error(`Error ${i}`));
      }
      
      const diagnosticInfo = errorHandler.getDiagnosticInfo();
      expect(diagnosticInfo.recentErrors).toHaveLength(100);
      
      // Should keep the most recent 100
      expect(diagnosticInfo.recentErrors[0].message).toBe('Error 50');
      expect(diagnosticInfo.recentErrors[99].message).toBe('Error 149');
    });

    test('should clear diagnostic data', async () => {
      await errorHandler.handleError(new Error('Test error'));
      
      expect(errorHandler.getDiagnosticInfo().recentErrors).toHaveLength(1);
      
      errorHandler.clearDiagnosticData();
      
      expect(errorHandler.getDiagnosticInfo().recentErrors).toHaveLength(0);
    });
  });

  describe('User Notifications', () => {
    test('should send user notifications with correct format', () => {
      errorHandler.addErrorListener(mockListener);
      
      const actions = [
        { label: 'Retry', action: jest.fn() },
        { label: 'Cancel', action: jest.fn() }
      ];
      
      errorHandler.notifyUser('Test message', ErrorSeverity.WARNING, actions);
      
      expect(mockListener).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Test message',
          severity: ErrorSeverity.WARNING,
          actions,
          timestamp: expect.any(Date),
          id: expect.any(String)
        })
      );
    });

    test('should handle listener errors gracefully', () => {
      const faultyListener = jest.fn().mockImplementation(() => {
        throw new Error('Listener error');
      });
      
      errorHandler.addErrorListener(faultyListener);
      errorHandler.addErrorListener(mockListener);
      
      // Should not throw and should still call other listeners
      expect(() => {
        errorHandler.notifyUser('Test message');
      }).not.toThrow();
      
      expect(mockListener).toHaveBeenCalled();
    });
  });

  describe('Network Recovery', () => {
    test('should test network connectivity', async () => {
      // Mock successful fetch
      global.fetch = jest.fn().mockResolvedValue({ ok: true });
      
      const error = new Error('Network error');
      error.name = 'NetworkError';
      
      const result = await errorHandler.handleError(error);
      
      expect(result.success).toBe(true);
      expect(result.action).toBe('network_restored');
    });

    test('should handle network connectivity failure', async () => {
      // Mock failed fetch
      global.fetch = jest.fn().mockRejectedValue(new Error('Network failed'));
      
      const error = new Error('Network error');
      error.name = 'NetworkError';
      
      const result = await errorHandler.handleError(error);
      
      expect(result.success).toBe(false);
      expect(result.action).toBe('network_still_down');
    });
  });

  describe('Integration with Recovery Strategies', () => {
    test('should execute recovery strategies for specific errors', async () => {
      const error = new Error('Rate limit exceeded');
      
      // Mock local STT availability
      global.window = {
        webkitSpeechRecognition: function() {}
      };

      const result = await errorHandler.handleError(error, {
        component: 'transcription'
      });

      expect(result.success).toBe(true);
      expect(result.action).toBe('switched_to_local_stt');
    });
  });
});

describe('Error Constants', () => {
  test('should have all required error severities', () => {
    expect(ErrorSeverity.INFO).toBe('info');
    expect(ErrorSeverity.WARNING).toBe('warning');
    expect(ErrorSeverity.ERROR).toBe('error');
    expect(ErrorSeverity.CRITICAL).toBe('critical');
  });

  test('should have all required error categories', () => {
    expect(ErrorCategory.AUDIO_CAPTURE).toBe('audio_capture');
    expect(ErrorCategory.TRANSCRIPTION).toBe('transcription');
    expect(ErrorCategory.SPEAKER_IDENTIFICATION).toBe('speaker_identification');
    expect(ErrorCategory.SUMMARY_GENERATION).toBe('summary_generation');
    expect(ErrorCategory.CHAT_INTEGRATION).toBe('chat_integration');
    expect(ErrorCategory.CONFIGURATION).toBe('configuration');
    expect(ErrorCategory.NETWORK).toBe('network');
    expect(ErrorCategory.AUTHENTICATION).toBe('authentication');
    expect(ErrorCategory.STORAGE).toBe('storage');
    expect(ErrorCategory.PLATFORM).toBe('platform');
  });

  test('should have comprehensive error codes', () => {
    // Test a few key error codes
    expect(ErrorCode.MICROPHONE_ACCESS_DENIED).toBe('MICROPHONE_ACCESS_DENIED');
    expect(ErrorCode.STT_SERVICE_UNAVAILABLE).toBe('STT_SERVICE_UNAVAILABLE');
    expect(ErrorCode.NETWORK_CONNECTION_LOST).toBe('NETWORK_CONNECTION_LOST');
    expect(ErrorCode.CHAT_PERMISSION_DENIED).toBe('CHAT_PERMISSION_DENIED');
  });
});