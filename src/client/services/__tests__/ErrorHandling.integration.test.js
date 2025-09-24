/**
 * Integration tests for error handling across the entire system
 */

import ErrorHandler, { ErrorSeverity, ErrorCategory, ErrorCode } from '../ErrorHandler';
import RecoveryStrategies from '../RecoveryStrategies';
import TranscriptionEngine from '../TranscriptionEngine';
import AudioProcessor from '../../components/AudioProcessor';
import ConfigurationManager from '../ConfigurationManager';

// Mock browser APIs
global.navigator = {
  mediaDevices: {
    getUserMedia: jest.fn()
  },
  permissions: {
    query: jest.fn()
  },
  onLine: true
};

global.window = {
  AudioContext: jest.fn(),
  webkitAudioContext: jest.fn(),
  SpeechRecognition: jest.fn(),
  webkitSpeechRecognition: jest.fn(),
  indexedDB: {
    open: jest.fn()
  }
};

global.fetch = jest.fn();

describe('Error Handling Integration', () => {
  let errorHandler;
  let configManager;
  let transcriptionEngine;
  let audioProcessor;
  let recoveryStrategies;

  beforeEach(() => {
    jest.clearAllMocks();
    
    errorHandler = new ErrorHandler();
    configManager = new ConfigurationManager();
    transcriptionEngine = new TranscriptionEngine();
    audioProcessor = new AudioProcessor();
    recoveryStrategies = new RecoveryStrategies(
      configManager,
      transcriptionEngine,
      audioProcessor
    );

    // Mock console methods
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('End-to-End Error Scenarios', () => {
    test('should handle microphone access denied with user guidance', async () => {
      const mockListener = jest.fn();
      errorHandler.addErrorListener(mockListener);

      // Simulate microphone access denied
      const error = new Error('Permission denied');
      error.name = 'NotAllowedError';

      const result = await errorHandler.handleAudioError(error, {
        component: 'audio-processor'
      });

      expect(result.success).toBe(false);
      expect(result.action).toBe('user_intervention_required');
      
      // Should notify user with helpful actions
      expect(mockListener).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('Microphone access denied'),
          severity: ErrorSeverity.ERROR,
          actions: expect.arrayContaining([
            expect.objectContaining({ label: 'Refresh Page' }),
            expect.objectContaining({ label: 'Help' })
          ])
        })
      );
    });

    test('should handle STT service failure with automatic fallback', async () => {
      const mockListener = jest.fn();
      errorHandler.addErrorListener(mockListener);

      // Mock local STT availability
      global.window.webkitSpeechRecognition = function() {};

      // Simulate STT service failure
      const error = new Error('Service unavailable');
      error.code = 'SERVICE_UNAVAILABLE';

      const result = await errorHandler.handleTranscriptionError(error, {
        component: 'transcription'
      });

      expect(result.success).toBe(true);
      expect(result.action).toBe('fallback_enabled');
      expect(errorHandler.isInFallbackMode('transcription')).toBe(true);

      // Should notify user about fallback
      expect(mockListener).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('Switched to local processing'),
          severity: ErrorSeverity.WARNING
        })
      );
    });

    test('should handle network failure with retry logic', async () => {
      const mockListener = jest.fn();
      errorHandler.addErrorListener(mockListener);

      // Mock network failure then recovery
      global.fetch
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({ ok: true });

      const error = new Error('Network connection lost');
      error.name = 'NetworkError';

      const result = await errorHandler.handleError(error, {
        component: 'transcription'
      });

      expect(result.success).toBe(true);
      expect(result.action).toBe('network_restored');
    });

    test('should handle multiple cascading failures', async () => {
      const mockListener = jest.fn();
      errorHandler.addErrorListener(mockListener);

      // Simulate cascading failures: STT fails, then network fails, then storage fails
      
      // 1. STT service fails
      const sttError = new Error('STT service unavailable');
      await errorHandler.handleTranscriptionError(sttError, {
        component: 'transcription'
      });

      // 2. Network fails during fallback attempt
      const networkError = new Error('Network error');
      networkError.name = 'NetworkError';
      global.fetch.mockRejectedValue(networkError);
      
      await errorHandler.handleError(networkError, {
        component: 'network'
      });

      // 3. Storage quota exceeded
      const storageError = new Error('Storage quota exceeded');
      await errorHandler.handleError(storageError, {
        component: 'storage'
      });

      // Should have multiple notifications
      expect(mockListener).toHaveBeenCalledTimes(3);
      
      // Should have fallback modes enabled
      expect(errorHandler.isInFallbackMode('transcription')).toBe(true);
    });
  });

  describe('Recovery Strategy Integration', () => {
    test('should execute recovery strategies through error handler', async () => {
      // Mock successful audio stream recovery
      global.navigator.mediaDevices.getUserMedia.mockResolvedValue({
        active: true,
        getTracks: () => [{ stop: jest.fn() }]
      });

      const error = new Error('Audio stream interrupted');
      
      const result = await errorHandler.handleAudioError(error, {
        component: 'audio-processor'
      });

      expect(result.success).toBe(true);
      expect(result.action).toBe('audio_stream_restored');
    });

    test('should handle recovery strategy failures gracefully', async () => {
      // Mock audio recovery failure
      global.navigator.mediaDevices.getUserMedia.mockRejectedValue(
        new Error('Still no access')
      );

      const error = new Error('Audio stream interrupted');
      
      const result = await errorHandler.handleAudioError(error, {
        component: 'audio-processor'
      });

      expect(result.success).toBe(false);
      expect(result.action).toBe('audio_restart_failed');
    });
  });

  describe('Fallback Mode Management', () => {
    test('should manage multiple fallback modes simultaneously', () => {
      errorHandler.enableFallbackMode('transcription', 'local-only');
      errorHandler.enableFallbackMode('summary', 'basic-summary');
      errorHandler.enableFallbackMode('speaker-identification', 'disabled');

      expect(errorHandler.isInFallbackMode('transcription')).toBe(true);
      expect(errorHandler.isInFallbackMode('summary')).toBe(true);
      expect(errorHandler.isInFallbackMode('speaker-identification')).toBe(true);

      const fallbackModes = errorHandler.fallbackModes;
      expect(fallbackModes.get('transcription')).toBe('local-only');
      expect(fallbackModes.get('summary')).toBe('basic-summary');
      expect(fallbackModes.get('speaker-identification')).toBe('disabled');
    });

    test('should restore normal operation when fallback is no longer needed', () => {
      errorHandler.enableFallbackMode('transcription', 'local-only');
      expect(errorHandler.isInFallbackMode('transcription')).toBe(true);

      // Simulate service recovery
      errorHandler.fallbackModes.delete('transcription');
      expect(errorHandler.isInFallbackMode('transcription')).toBe(false);
    });
  });

  describe('Error Notification System', () => {
    test('should provide contextual error messages', async () => {
      const mockListener = jest.fn();
      errorHandler.addErrorListener(mockListener);

      const error = new Error('Rate limit exceeded');
      await errorHandler.handleTranscriptionError(error, {
        component: 'transcription',
        provider: 'openai',
        requestCount: 100
      });

      expect(mockListener).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('Rate limit'),
          severity: ErrorSeverity.WARNING
        })
      );
    });

    test('should provide actionable error recovery options', async () => {
      const mockListener = jest.fn();
      errorHandler.addErrorListener(mockListener);

      const error = new Error('Authentication failed');
      error.status = 401;

      await errorHandler.handleTranscriptionError(error, {
        component: 'transcription'
      });

      expect(mockListener).toHaveBeenCalledWith(
        expect.objectContaining({
          actions: expect.arrayContaining([
            expect.objectContaining({ label: 'Update API Key' })
          ])
        })
      );
    });
  });

  describe('Diagnostic Data Collection', () => {
    test('should collect comprehensive diagnostic information', async () => {
      // Generate various errors
      await errorHandler.handleError(new Error('Test error 1'));
      await errorHandler.handleError(new Error('Test error 2'));
      
      errorHandler.enableFallbackMode('transcription', 'local-only');

      const diagnosticInfo = errorHandler.getDiagnosticInfo();

      expect(diagnosticInfo.recentErrors).toHaveLength(2);
      expect(diagnosticInfo.fallbackModes).toHaveProperty('transcription', 'local-only');
      expect(diagnosticInfo.timestamp).toBeInstanceOf(Date);
    });

    test('should limit diagnostic data size', async () => {
      // Generate many errors
      for (let i = 0; i < 150; i++) {
        await errorHandler.handleError(new Error(`Error ${i}`));
      }

      const diagnosticInfo = errorHandler.getDiagnosticInfo();
      expect(diagnosticInfo.recentErrors.length).toBeLessThanOrEqual(100);
    });
  });

  describe('Performance Under Error Conditions', () => {
    test('should handle high error rates without degrading performance', async () => {
      const startTime = Date.now();
      
      // Generate many errors quickly
      const promises = [];
      for (let i = 0; i < 50; i++) {
        promises.push(errorHandler.handleError(new Error(`Rapid error ${i}`)));
      }
      
      await Promise.all(promises);
      
      const endTime = Date.now();
      const processingTime = endTime - startTime;
      
      // Should process all errors within reasonable time (< 5 seconds)
      expect(processingTime).toBeLessThan(5000);
    });

    test('should not leak memory during extended error handling', async () => {
      const initialErrorCount = errorHandler.diagnosticData.length;
      
      // Generate many errors
      for (let i = 0; i < 200; i++) {
        await errorHandler.handleError(new Error(`Memory test error ${i}`));
      }
      
      // Should maintain reasonable memory usage (max 100 errors stored)
      expect(errorHandler.diagnosticData.length).toBeLessThanOrEqual(100);
      expect(errorHandler.diagnosticData.length).toBeGreaterThan(initialErrorCount);
    });
  });

  describe('Error Handler Resilience', () => {
    test('should handle errors in error listeners gracefully', async () => {
      const faultyListener = jest.fn().mockImplementation(() => {
        throw new Error('Listener error');
      });
      const goodListener = jest.fn();

      errorHandler.addErrorListener(faultyListener);
      errorHandler.addErrorListener(goodListener);

      // Should not throw and should still call good listener
      await expect(errorHandler.handleError(new Error('Test error'))).resolves.toBeDefined();
      expect(goodListener).toHaveBeenCalled();
    });

    test('should handle circular error conditions', async () => {
      let errorCount = 0;
      const circularListener = jest.fn().mockImplementation(() => {
        errorCount++;
        if (errorCount < 5) {
          // Simulate error in error handler causing another error
          errorHandler.handleError(new Error(`Circular error ${errorCount}`));
        }
      });

      errorHandler.addErrorListener(circularListener);

      await errorHandler.handleError(new Error('Initial error'));

      // Should eventually stop the circular errors
      expect(errorCount).toBeLessThan(10);
    });
  });

  describe('Integration with Real Components', () => {
    test('should integrate with TranscriptionEngine error handling', async () => {
      const mockListener = jest.fn();
      errorHandler.addErrorListener(mockListener);

      // Mock transcription engine failure
      jest.spyOn(transcriptionEngine, 'transcribeWithLocal').mockRejectedValue(
        new Error('Local STT failed')
      );

      try {
        await transcriptionEngine.transcribeWithLocal(new ArrayBuffer(1024));
      } catch (error) {
        // Error should have been handled by error handler
        expect(mockListener).toHaveBeenCalled();
      }
    });

    test('should integrate with AudioProcessor error handling', async () => {
      const mockListener = jest.fn();
      errorHandler.addErrorListener(mockListener);

      // Mock audio processor failure
      global.navigator.mediaDevices.getUserMedia.mockRejectedValue(
        new Error('Microphone access denied')
      );

      try {
        await audioProcessor.startCapture();
      } catch (error) {
        // Error should have been handled by error handler
        expect(mockListener).toHaveBeenCalled();
      }
    });
  });
});