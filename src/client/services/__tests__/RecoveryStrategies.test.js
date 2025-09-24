/**
 * Tests for recovery strategies
 */

import RecoveryStrategies from '../RecoveryStrategies';
import { ErrorCode, ErrorCategory } from '../ErrorHandler';

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

describe('RecoveryStrategies', () => {
  let recoveryStrategies;

  beforeEach(() => {
    recoveryStrategies = new RecoveryStrategies(
      mockConfigManager,
      mockTranscriptionEngine,
      mockAudioProcessor
    );
    
    jest.clearAllMocks();
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Strategy Selection', () => {
    test('should select correct strategy for microphone access denied', () => {
      const errorInfo = {
        code: ErrorCode.MICROPHONE_ACCESS_DENIED,
        category: ErrorCategory.AUDIO_CAPTURE
      };

      const strategy = recoveryStrategies.getRecoveryStrategy(errorInfo);
      expect(strategy).toBeDefined();
      expect(strategy.constructor.name).toBe('MicrophoneAccessRecovery');
    });

    test('should select correct strategy for STT service unavailable', () => {
      const errorInfo = {
        code: ErrorCode.STT_SERVICE_UNAVAILABLE,
        category: ErrorCategory.TRANSCRIPTION
      };

      const strategy = recoveryStrategies.getRecoveryStrategy(errorInfo);
      expect(strategy).toBeDefined();
      expect(strategy.constructor.name).toBe('STTServiceRecovery');
    });

    test('should select correct strategy for network errors', () => {
      const errorInfo = {
        code: ErrorCode.NETWORK_CONNECTION_LOST,
        category: ErrorCategory.NETWORK
      };

      const strategy = recoveryStrategies.getRecoveryStrategy(errorInfo);
      expect(strategy).toBeDefined();
      expect(strategy.constructor.name).toBe('NetworkRecovery');
    });

    test('should return null for unknown error codes', () => {
      const errorInfo = {
        code: 'UNKNOWN_ERROR_CODE',
        category: ErrorCategory.TRANSCRIPTION
      };

      const strategy = recoveryStrategies.getRecoveryStrategy(errorInfo);
      expect(strategy).toBeUndefined();
    });
  });

  describe('Strategy Execution', () => {
    test('should execute recovery strategy successfully', async () => {
      const errorInfo = {
        code: ErrorCode.NETWORK_CONNECTION_LOST,
        category: ErrorCategory.NETWORK,
        context: {}
      };

      // Mock successful network test
      global.fetch = jest.fn().mockResolvedValue({ ok: true });

      const result = await recoveryStrategies.executeRecovery(errorInfo);

      expect(result.success).toBe(true);
      expect(result.action).toBe('network_restored');
    });

    test('should handle strategy execution failure', async () => {
      const errorInfo = {
        code: ErrorCode.NETWORK_CONNECTION_LOST,
        category: ErrorCategory.NETWORK,
        context: {}
      };

      // Mock network test failure
      global.fetch = jest.fn().mockRejectedValue(new Error('Network failed'));
      global.navigator = { onLine: false };

      const result = await recoveryStrategies.executeRecovery(errorInfo);

      expect(result.success).toBe(false);
      expect(result.action).toBe('network_still_offline');
    });

    test('should handle missing strategy gracefully', async () => {
      const errorInfo = {
        code: 'UNKNOWN_ERROR',
        category: ErrorCategory.TRANSCRIPTION,
        context: {}
      };

      const result = await recoveryStrategies.executeRecovery(errorInfo);

      expect(result.success).toBe(false);
      expect(result.action).toBe('no_strategy_available');
    });

    test('should handle strategy execution exception', async () => {
      const errorInfo = {
        code: ErrorCode.STT_SERVICE_UNAVAILABLE,
        category: ErrorCategory.TRANSCRIPTION,
        context: {}
      };

      // Mock transcription engine to throw error
      mockTranscriptionEngine.switchToLocalSTT.mockRejectedValue(
        new Error('Switch failed')
      );

      const result = await recoveryStrategies.executeRecovery(errorInfo);

      expect(result.success).toBe(false);
      expect(result.action).toBe('strategy_execution_failed');
      expect(result.error).toBeDefined();
    });
  });

  describe('Fallback Mode Management', () => {
    test('should enable fallback mode', () => {
      const component = 'transcription';
      const mode = 'local-only';
      const reason = 'Cloud service unavailable';

      recoveryStrategies.enableFallbackMode(component, mode, reason);

      expect(recoveryStrategies.isInFallbackMode(component)).toBe(true);
      
      const fallbackInfo = recoveryStrategies.getFallbackInfo(component);
      expect(fallbackInfo.mode).toBe(mode);
      expect(fallbackInfo.reason).toBe(reason);
      expect(fallbackInfo.enabledAt).toBeInstanceOf(Date);
    });

    test('should disable fallback mode', () => {
      const component = 'transcription';
      
      recoveryStrategies.enableFallbackMode(component, 'local-only', 'test');
      expect(recoveryStrategies.isInFallbackMode(component)).toBe(true);

      const disabled = recoveryStrategies.disableFallbackMode(component);
      expect(disabled).toBe(true);
      expect(recoveryStrategies.isInFallbackMode(component)).toBe(false);
    });

    test('should return false when disabling non-existent fallback', () => {
      const disabled = recoveryStrategies.disableFallbackMode('nonexistent');
      expect(disabled).toBe(false);
    });

    test('should get all active fallback modes', () => {
      recoveryStrategies.enableFallbackMode('transcription', 'local-only', 'test1');
      recoveryStrategies.enableFallbackMode('summary', 'basic-summary', 'test2');

      const activeModes = recoveryStrategies.getActiveFallbackModes();
      
      expect(Object.keys(activeModes)).toHaveLength(2);
      expect(activeModes.transcription.mode).toBe('local-only');
      expect(activeModes.summary.mode).toBe('basic-summary');
    });
  });

  describe('Audio Stream Recovery', () => {
    test('should recover audio stream successfully', async () => {
      const errorInfo = {
        code: ErrorCode.AUDIO_STREAM_INTERRUPTED,
        category: ErrorCategory.AUDIO_CAPTURE,
        context: {}
      };

      // Mock successful audio restart
      mockAudioProcessor.stopCapture.mockResolvedValue();
      mockAudioProcessor.startCapture.mockResolvedValue({
        active: true,
        getTracks: () => [{ stop: jest.fn() }]
      });

      const result = await recoveryStrategies.executeRecovery(errorInfo);

      expect(result.success).toBe(true);
      expect(result.action).toBe('audio_stream_restored');
      expect(mockAudioProcessor.stopCapture).toHaveBeenCalled();
      expect(mockAudioProcessor.startCapture).toHaveBeenCalled();
    });

    test('should handle audio stream recovery failure', async () => {
      const errorInfo = {
        code: ErrorCode.AUDIO_STREAM_INTERRUPTED,
        category: ErrorCategory.AUDIO_CAPTURE,
        context: {}
      };

      // Mock audio restart failure
      mockAudioProcessor.stopCapture.mockResolvedValue();
      mockAudioProcessor.startCapture.mockRejectedValue(
        new Error('Audio access denied')
      );

      const result = await recoveryStrategies.executeRecovery(errorInfo);

      expect(result.success).toBe(false);
      expect(result.action).toBe('audio_restart_failed');
    });
  });

  describe('STT Service Recovery', () => {
    test('should switch to local STT when cloud service fails', async () => {
      const errorInfo = {
        code: ErrorCode.STT_SERVICE_UNAVAILABLE,
        category: ErrorCategory.TRANSCRIPTION,
        context: {}
      };

      // Mock local STT availability
      global.window = {
        webkitSpeechRecognition: function() {}
      };

      mockTranscriptionEngine.switchToLocalSTT.mockResolvedValue();

      const result = await recoveryStrategies.executeRecovery(errorInfo);

      expect(result.success).toBe(true);
      expect(result.action).toBe('switched_to_local_stt');
      expect(mockTranscriptionEngine.switchToLocalSTT).toHaveBeenCalled();
    });

    test('should switch to alternative cloud service', async () => {
      const errorInfo = {
        code: ErrorCode.STT_SERVICE_UNAVAILABLE,
        category: ErrorCategory.TRANSCRIPTION,
        context: {}
      };

      // Mock no local STT but alternative service available
      global.window = {};
      
      mockConfigManager.getConfiguration.mockResolvedValue({
        sttProvider: 'openai',
        azureApiKey: 'test-key'
      });

      mockTranscriptionEngine.switchSTTProvider.mockResolvedValue();

      const result = await recoveryStrategies.executeRecovery(errorInfo);

      expect(result.success).toBe(true);
      expect(result.action).toBe('switched_to_alternative_service');
      expect(mockTranscriptionEngine.switchSTTProvider).toHaveBeenCalledWith('azure');
    });

    test('should fail when no alternatives available', async () => {
      const errorInfo = {
        code: ErrorCode.STT_SERVICE_UNAVAILABLE,
        category: ErrorCategory.TRANSCRIPTION,
        context: {}
      };

      // Mock no local STT and no alternative services
      global.window = {};
      
      mockConfigManager.getConfiguration.mockResolvedValue({
        sttProvider: 'openai'
        // No other API keys
      });

      const result = await recoveryStrategies.executeRecovery(errorInfo);

      expect(result.success).toBe(false);
      expect(result.action).toBe('no_stt_alternatives');
    });
  });

  describe('Rate Limit Recovery', () => {
    test('should switch to local STT on rate limit', async () => {
      const errorInfo = {
        code: ErrorCode.STT_API_RATE_LIMIT,
        category: ErrorCategory.TRANSCRIPTION,
        context: {}
      };

      // Mock local STT availability
      global.window = {
        webkitSpeechRecognition: function() {}
      };

      mockTranscriptionEngine.switchToLocalSTT.mockResolvedValue();

      const result = await recoveryStrategies.executeRecovery(errorInfo);

      expect(result.success).toBe(true);
      expect(result.action).toBe('switched_to_local_due_to_rate_limit');
    });

    test('should implement backoff when no local STT available', async () => {
      const errorInfo = {
        code: ErrorCode.STT_API_RATE_LIMIT,
        category: ErrorCategory.TRANSCRIPTION,
        context: { retryAttempt: 1 }
      };

      // Mock no local STT
      global.window = {};

      const result = await recoveryStrategies.executeRecovery(errorInfo);

      expect(result.success).toBe(false);
      expect(result.action).toBe('rate_limit_backoff');
      expect(result.retryAfter).toBeDefined();
      expect(result.retryAfter).toBeGreaterThan(0);
    });

    test('should calculate exponential backoff correctly', async () => {
      const errorInfo = {
        code: ErrorCode.STT_API_RATE_LIMIT,
        category: ErrorCategory.TRANSCRIPTION,
        context: { retryAttempt: 2 }
      };

      global.window = {};

      const result = await recoveryStrategies.executeRecovery(errorInfo);

      // Should be 5000 * 2^2 = 20000ms
      expect(result.retryAfter).toBe(20000);
    });
  });

  describe('Network Recovery', () => {
    test('should detect network restoration', async () => {
      const errorInfo = {
        code: ErrorCode.NETWORK_CONNECTION_LOST,
        category: ErrorCategory.NETWORK,
        context: {}
      };

      // Mock successful connectivity test
      global.fetch = jest.fn().mockResolvedValue({ ok: true });

      const result = await recoveryStrategies.executeRecovery(errorInfo);

      expect(result.success).toBe(true);
      expect(result.action).toBe('network_restored');
    });

    test('should handle persistent network issues', async () => {
      const errorInfo = {
        code: ErrorCode.NETWORK_CONNECTION_LOST,
        category: ErrorCategory.NETWORK,
        context: {}
      };

      // Mock failed connectivity test
      global.fetch = jest.fn().mockRejectedValue(new Error('Network error'));
      global.navigator = { onLine: false };

      const result = await recoveryStrategies.executeRecovery(errorInfo);

      expect(result.success).toBe(false);
      expect(result.action).toBe('network_still_offline');
      expect(result.fallbackSuggestion).toContain('local-only');
    });
  });

  describe('Storage Recovery', () => {
    test('should attempt storage cleanup', async () => {
      const errorInfo = {
        code: ErrorCode.STORAGE_QUOTA_EXCEEDED,
        category: ErrorCategory.STORAGE,
        context: {}
      };

      const result = await recoveryStrategies.executeRecovery(errorInfo);

      // Since cleanup is mocked to return 0, should fail
      expect(result.success).toBe(false);
      expect(result.action).toBe('storage_cleanup_insufficient');
      expect(result.userActions).toBeDefined();
    });
  });

  describe('AI Service Recovery', () => {
    test('should switch to basic summary on AI service failure', async () => {
      const errorInfo = {
        code: ErrorCode.AI_SERVICE_UNAVAILABLE,
        category: ErrorCategory.SUMMARY_GENERATION,
        context: {}
      };

      const result = await recoveryStrategies.executeRecovery(errorInfo);

      expect(result.success).toBe(true);
      expect(result.action).toBe('switched_to_basic_summary');
      expect(result.fallbackMode).toBe('basic-summary');
    });
  });

  describe('Chat Integration Recovery', () => {
    test('should handle chat permission denied', async () => {
      const errorInfo = {
        code: ErrorCode.CHAT_PERMISSION_DENIED,
        category: ErrorCategory.CHAT_INTEGRATION,
        context: {}
      };

      const result = await recoveryStrategies.executeRecovery(errorInfo);

      expect(result.success).toBe(false);
      expect(result.action).toBe('chat_permission_denied');
      expect(result.alternativeActions).toBeDefined();
      expect(result.alternativeActions).toContain('Download transcript');
    });

    test('should handle long chat messages', async () => {
      const errorInfo = {
        code: ErrorCode.CHAT_MESSAGE_TOO_LONG,
        category: ErrorCategory.CHAT_INTEGRATION,
        context: {}
      };

      const result = await recoveryStrategies.executeRecovery(errorInfo);

      expect(result.success).toBe(true);
      expect(result.action).toBe('split_long_message');
      expect(result.fallbackMode).toBe('split-messages');
    });
  });

  describe('Platform Recovery', () => {
    test('should handle Teams SDK errors', async () => {
      const errorInfo = {
        code: ErrorCode.TEAMS_SDK_ERROR,
        category: ErrorCategory.PLATFORM,
        context: {}
      };

      const result = await recoveryStrategies.executeRecovery(errorInfo);

      expect(result.success).toBe(false);
      expect(result.action).toBe('teams_sdk_error');
      expect(result.userActions).toContain('Refresh Teams app');
    });

    test('should handle unsupported platforms', async () => {
      const errorInfo = {
        code: ErrorCode.PLATFORM_NOT_SUPPORTED,
        category: ErrorCategory.PLATFORM,
        context: {}
      };

      const result = await recoveryStrategies.executeRecovery(errorInfo);

      expect(result.success).toBe(false);
      expect(result.action).toBe('platform_not_supported');
      expect(result.fallbackMode).toBe('limited-functionality');
    });
  });
});