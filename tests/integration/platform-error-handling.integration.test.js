// Platform-specific error handling and recovery integration tests
import { jest } from '@jest/globals';

describe('Platform Error Handling and Recovery Integration Tests', () => {
  let platformAdapters;
  let errorHandler;
  let recoveryStrategies;

  beforeEach(() => {
    // Import services
    const TeamsAdapter = require('../../src/client/services/TeamsAdapter');
    const ZoomAdapter = require('../../src/client/services/ZoomAdapter');
    const MeetAdapter = require('../../src/client/services/MeetAdapter');
    const GenericAdapter = require('../../src/client/services/GenericAdapter');
    const ErrorHandler = require('../../src/client/services/ErrorHandler');
    const RecoveryStrategies = require('../../src/client/services/RecoveryStrategies');

    platformAdapters = {
      teams: new TeamsAdapter(),
      zoom: new ZoomAdapter(),
      meet: new MeetAdapter(),
      generic: new GenericAdapter()
    };

    errorHandler = new ErrorHandler();
    recoveryStrategies = new RecoveryStrategies();

    // Mock console to capture error logs
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Platform-Specific Error Scenarios', () => {
    describe('Teams Platform Errors', () => {
      test('should handle Teams SDK initialization failures', async () => {
        const teamsAdapter = platformAdapters.teams;

        // Mock Teams SDK failure
        global.microsoftTeams = {
          app: {
            initialize: jest.fn().mockRejectedValue(new Error('Teams SDK not available'))
          }
        };

        const result = await errorHandler.handlePlatformError(
          () => teamsAdapter.initialize(),
          'teams',
          'initialization'
        );

        expect(result.success).toBe(false);
        expect(result.error).toContain('Teams SDK not available');
        expect(result.fallbackApplied).toBe(true);
        expect(result.fallbackPlatform).toBe('generic');
      });

      test('should handle Teams authentication failures', async () => {
        const teamsAdapter = platformAdapters.teams;

        // Mock authentication failure
        global.microsoftTeams = {
          app: { initialize: jest.fn().mockResolvedValue() },
          authentication: {
            getAuthToken: jest.fn().mockRejectedValue(new Error('Authentication failed'))
          }
        };

        await teamsAdapter.initialize();

        const result = await errorHandler.handlePlatformError(
          () => teamsAdapter.getAuthToken(),
          'teams',
          'authentication'
        );

        expect(result.success).toBe(false);
        expect(result.error).toContain('Authentication failed');
        expect(result.retryAttempted).toBe(true);
        expect(result.recoveryStrategy).toBe('reauthenticate');
      });

      test('should handle Teams chat permission errors', async () => {
        const teamsAdapter = platformAdapters.teams;

        // Mock chat permission error
        global.microsoftTeams = {
          app: { initialize: jest.fn().mockResolvedValue() },
          chat: {
            sendMessage: jest.fn().mockRejectedValue(new Error('Insufficient permissions'))
          }
        };

        await teamsAdapter.initialize();

        const result = await errorHandler.handlePlatformError(
          () => teamsAdapter.sendMessageToChat('test message'),
          'teams',
          'chat'
        );

        expect(result.success).toBe(false);
        expect(result.error).toContain('Insufficient permissions');
        expect(result.alternativeProvided).toBe(true);
        expect(result.alternative).toBe('file_export');
      });

      test('should handle Teams meeting context errors', async () => {
        const teamsAdapter = platformAdapters.teams;

        // Mock missing meeting context
        global.microsoftTeams = {
          app: {
            initialize: jest.fn().mockResolvedValue(),
            getContext: jest.fn().mockResolvedValue({
              // Missing meeting context
              user: { id: 'user123' }
            })
          }
        };

        await teamsAdapter.initialize();

        const result = await errorHandler.handlePlatformError(
          () => teamsAdapter.getMeetingInfo(),
          'teams',
          'meeting_context'
        );

        expect(result.success).toBe(false);
        expect(result.error).toContain('No meeting context');
        expect(result.gracefulDegradation).toBe(true);
        expect(result.limitedFunctionality).toBe(true);
      });
    });

    describe('Zoom Platform Errors', () => {
      test('should handle Zoom SDK initialization failures', async () => {
        const zoomAdapter = platformAdapters.zoom;

        // Mock Zoom SDK failure
        global.ZoomMtg = {
          init: jest.fn().mockImplementation((config) => {
            config.error('SDK initialization failed');
          })
        };

        const result = await errorHandler.handlePlatformError(
          () => zoomAdapter.initialize(),
          'zoom',
          'initialization'
        );

        expect(result.success).toBe(false);
        expect(result.error).toContain('SDK initialization failed');
        expect(result.fallbackApplied).toBe(true);
        expect(result.fallbackPlatform).toBe('generic');
      });

      test('should handle Zoom API rate limiting', async () => {
        const zoomAdapter = platformAdapters.zoom;

        // Mock rate limiting error
        global.ZoomMtg = {
          init: jest.fn().mockImplementation((config) => config.success()),
          getMeetingInfo: jest.fn().mockRejectedValue(new Error('Rate limit exceeded'))
        };

        await zoomAdapter.initialize();

        const result = await errorHandler.handlePlatformError(
          () => zoomAdapter.getMeetingInfo(),
          'zoom',
          'api_call'
        );

        expect(result.success).toBe(false);
        expect(result.error).toContain('Rate limit exceeded');
        expect(result.retryScheduled).toBe(true);
        expect(result.retryDelay).toBeGreaterThan(0);
      });

      test('should handle Zoom meeting join failures', async () => {
        const zoomAdapter = platformAdapters.zoom;

        // Mock meeting join failure
        global.ZoomMtg = {
          init: jest.fn().mockImplementation((config) => config.success()),
          join: jest.fn().mockImplementation((config) => {
            config.error('Meeting not found');
          })
        };

        await zoomAdapter.initialize();

        const result = await errorHandler.handlePlatformError(
          () => zoomAdapter.joinMeeting('invalid-meeting-id'),
          'zoom',
          'meeting_join'
        );

        expect(result.success).toBe(false);
        expect(result.error).toContain('Meeting not found');
        expect(result.userNotified).toBe(true);
        expect(result.suggestedAction).toBe('verify_meeting_id');
      });

      test('should handle Zoom webhook failures', async () => {
        const zoomAdapter = platformAdapters.zoom;

        // Mock webhook registration failure
        const mockWebhookError = new Error('Webhook registration failed');

        const result = await errorHandler.handlePlatformError(
          () => zoomAdapter.registerWebhooks(),
          'zoom',
          'webhook'
        );

        expect(result.success).toBe(false);
        expect(result.gracefulDegradation).toBe(true);
        expect(result.alternativeMethod).toBe('polling');
      });
    });

    describe('Google Meet Platform Errors', () => {
      test('should handle browser extension not installed', async () => {
        const meetAdapter = platformAdapters.meet;

        // Mock missing extension
        global.chrome = undefined;

        const result = await errorHandler.handlePlatformError(
          () => meetAdapter.initialize(),
          'meet',
          'extension'
        );

        expect(result.success).toBe(false);
        expect(result.error).toContain('Extension not available');
        expect(result.installationPrompt).toBe(true);
        expect(result.fallbackMode).toBe('manual');
      });

      test('should handle Google Calendar API failures', async () => {
        const meetAdapter = platformAdapters.meet;

        // Mock Calendar API failure
        global.chrome = {
          runtime: { id: 'test-extension' }
        };

        global.gapi = {
          load: jest.fn().mockImplementation((api, callback) => {
            callback.onerror('Calendar API failed to load');
          })
        };

        await meetAdapter.initialize();

        const result = await errorHandler.handlePlatformError(
          () => meetAdapter.getMeetingAgenda(),
          'meet',
          'calendar_api'
        );

        expect(result.success).toBe(false);
        expect(result.error).toContain('Calendar API failed');
        expect(result.featureDisabled).toBe(true);
        expect(result.disabledFeature).toBe('agenda_integration');
      });

      test('should handle DOM injection failures', async () => {
        const meetAdapter = platformAdapters.meet;

        // Mock DOM injection failure
        global.document = {
          querySelector: jest.fn().mockReturnValue(null),
          createElement: jest.fn().mockImplementation(() => {
            throw new Error('DOM manipulation blocked');
          })
        };

        const result = await errorHandler.handlePlatformError(
          () => meetAdapter.injectUI(),
          'meet',
          'dom_injection'
        );

        expect(result.success).toBe(false);
        expect(result.error).toContain('DOM manipulation blocked');
        expect(result.alternativeUI).toBe(true);
        expect(result.uiMode).toBe('popup');
      });

      test('should handle content script communication failures', async () => {
        const meetAdapter = platformAdapters.meet;

        // Mock communication failure
        global.chrome = {
          runtime: {
            id: 'test-extension',
            sendMessage: jest.fn().mockImplementation((message, callback) => {
              callback({ error: 'Communication failed' });
            })
          }
        };

        await meetAdapter.initialize();

        const result = await errorHandler.handlePlatformError(
          () => meetAdapter.sendMessageToContentScript({ action: 'test' }),
          'meet',
          'communication'
        );

        expect(result.success).toBe(false);
        expect(result.error).toContain('Communication failed');
        expect(result.retryAttempted).toBe(true);
        expect(result.fallbackCommunication).toBe(true);
      });
    });

    describe('Generic Platform Errors', () => {
      test('should handle system audio capture failures', async () => {
        const genericAdapter = platformAdapters.generic;

        // Mock audio capture failure
        global.navigator = {
          mediaDevices: {
            getUserMedia: jest.fn().mockRejectedValue(new Error('Audio access denied'))
          }
        };

        const result = await errorHandler.handlePlatformError(
          () => genericAdapter.getAudioStream(),
          'generic',
          'audio_capture'
        );

        expect(result.success).toBe(false);
        expect(result.error).toContain('Audio access denied');
        expect(result.permissionPrompt).toBe(true);
        expect(result.instructionsProvided).toBe(true);
      });

      test('should handle screen capture failures', async () => {
        const genericAdapter = platformAdapters.generic;

        // Mock screen capture failure
        global.navigator = {
          mediaDevices: {
            getDisplayMedia: jest.fn().mockRejectedValue(new Error('Screen access denied'))
          }
        };

        const result = await errorHandler.handlePlatformError(
          () => genericAdapter.captureScreen(),
          'generic',
          'screen_capture'
        );

        expect(result.success).toBe(false);
        expect(result.error).toContain('Screen access denied');
        expect(result.alternativeMethod).toBe('manual_upload');
        expect(result.userGuidance).toBe(true);
      });
    });
  });

  describe('Cross-Platform Error Recovery', () => {
    test('should implement progressive fallback strategy', async () => {
      const fallbackChain = ['teams', 'zoom', 'meet', 'generic'];
      const errors = {
        teams: new Error('Teams SDK unavailable'),
        zoom: new Error('Zoom API rate limited'),
        meet: new Error('Extension not installed')
      };

      const result = await recoveryStrategies.progressiveFallback(
        fallbackChain,
        errors,
        'audio_capture'
      );

      expect(result.finalPlatform).toBe('generic');
      expect(result.fallbacksAttempted).toBe(3);
      expect(result.success).toBe(true);
      expect(result.degradedFunctionality).toBe(true);
    });

    test('should implement retry with exponential backoff', async () => {
      let attemptCount = 0;
      const mockOperation = jest.fn().mockImplementation(() => {
        attemptCount++;
        if (attemptCount < 3) {
          throw new Error('Temporary failure');
        }
        return { success: true };
      });

      const startTime = Date.now();
      const result = await recoveryStrategies.retryWithBackoff(
        mockOperation,
        { maxRetries: 3, baseDelay: 100 }
      );
      const totalTime = Date.now() - startTime;

      expect(result.success).toBe(true);
      expect(mockOperation).toHaveBeenCalledTimes(3);
      expect(totalTime).toBeGreaterThan(300); // 100 + 200 + operation time
    });

    test('should implement circuit breaker pattern', async () => {
      const circuitBreaker = recoveryStrategies.createCircuitBreaker({
        failureThreshold: 3,
        resetTimeout: 1000
      });

      // Cause failures to trip the circuit breaker
      for (let i = 0; i < 3; i++) {
        try {
          await circuitBreaker.execute(() => {
            throw new Error('Service unavailable');
          });
        } catch (error) {
          // Expected failures
        }
      }

      expect(circuitBreaker.getState()).toBe('OPEN');

      // Next call should fail fast
      const startTime = Date.now();
      try {
        await circuitBreaker.execute(() => Promise.resolve());
      } catch (error) {
        const failTime = Date.now() - startTime;
        expect(failTime).toBeLessThan(10); // Should fail immediately
        expect(error.message).toContain('Circuit breaker is OPEN');
      }
    });

    test('should implement graceful degradation', async () => {
      const degradationConfig = {
        features: {
          chat_integration: { priority: 1, fallback: 'file_export' },
          speaker_identification: { priority: 2, fallback: 'generic_labels' },
          agenda_integration: { priority: 3, fallback: 'manual_topics' },
          real_time_transcription: { priority: 4, fallback: 'batch_processing' }
        }
      };

      const availableCapabilities = {
        audio_capture: true,
        transcription: true,
        chat_integration: false,
        speaker_identification: false,
        agenda_integration: false
      };

      const result = await recoveryStrategies.gracefulDegradation(
        degradationConfig,
        availableCapabilities
      );

      expect(result.enabledFeatures).toContain('real_time_transcription');
      expect(result.disabledFeatures).toContain('chat_integration');
      expect(result.fallbacks.chat_integration).toBe('file_export');
      expect(result.fallbacks.speaker_identification).toBe('generic_labels');
    });
  });

  describe('Error Reporting and Analytics', () => {
    test('should collect comprehensive error metrics', async () => {
      const errorMetrics = errorHandler.createMetricsCollector();

      // Simulate various errors across platforms
      const errorScenarios = [
        { platform: 'teams', type: 'authentication', count: 5 },
        { platform: 'zoom', type: 'rate_limit', count: 3 },
        { platform: 'meet', type: 'extension', count: 2 },
        { platform: 'generic', type: 'audio_capture', count: 1 }
      ];

      for (const scenario of errorScenarios) {
        for (let i = 0; i < scenario.count; i++) {
          errorMetrics.recordError({
            platform: scenario.platform,
            type: scenario.type,
            timestamp: Date.now(),
            userAgent: 'test-browser',
            context: { meetingId: 'test-meeting' }
          });
        }
      }

      const metrics = errorMetrics.getMetrics();

      expect(metrics.totalErrors).toBe(11);
      expect(metrics.errorsByPlatform.teams).toBe(5);
      expect(metrics.errorsByType.authentication).toBe(5);
      expect(metrics.mostCommonError).toEqual({
        platform: 'teams',
        type: 'authentication',
        count: 5
      });
    });

    test('should generate error reports for debugging', async () => {
      const errorReporter = errorHandler.createErrorReporter();

      const testError = new Error('Test error for reporting');
      testError.stack = 'Error: Test error\n    at test.js:123:45';

      const report = await errorReporter.generateReport({
        error: testError,
        platform: 'teams',
        context: {
          meetingId: 'meeting-123',
          userId: 'user-456',
          timestamp: Date.now(),
          userAgent: 'Mozilla/5.0...',
          platformVersion: '1.2.3'
        }
      });

      expect(report).toHaveProperty('errorId');
      expect(report).toHaveProperty('timestamp');
      expect(report).toHaveProperty('platform', 'teams');
      expect(report).toHaveProperty('errorMessage', 'Test error for reporting');
      expect(report).toHaveProperty('stackTrace');
      expect(report).toHaveProperty('context');
      expect(report.context).toHaveProperty('meetingId', 'meeting-123');
    });

    test('should sanitize sensitive data in error reports', async () => {
      const errorReporter = errorHandler.createErrorReporter();

      const sensitiveError = new Error('Authentication failed with token: sk-1234567890abcdef');
      
      const report = await errorReporter.generateReport({
        error: sensitiveError,
        platform: 'teams',
        context: {
          apiKey: 'sk-secret-key-123',
          userEmail: 'user@company.com',
          meetingUrl: 'https://teams.microsoft.com/l/meetup-join/...'
        }
      });

      expect(report.errorMessage).not.toContain('sk-1234567890abcdef');
      expect(report.errorMessage).toContain('sk-****');
      expect(report.context.apiKey).toBe('[REDACTED]');
      expect(report.context.userEmail).toBe('user@***');
      expect(report.context.meetingUrl).toContain('[REDACTED]');
    });
  });

  describe('User Experience During Errors', () => {
    test('should provide helpful error messages to users', async () => {
      const userErrorHandler = errorHandler.createUserErrorHandler();

      const errorScenarios = [
        {
          error: new Error('Microphone access denied'),
          expectedMessage: 'Please allow microphone access to enable transcription',
          expectedActions: ['grant_permission', 'try_again']
        },
        {
          error: new Error('Network connection failed'),
          expectedMessage: 'Check your internet connection and try again',
          expectedActions: ['check_connection', 'retry', 'offline_mode']
        },
        {
          error: new Error('Teams SDK not available'),
          expectedMessage: 'Teams integration unavailable. Using fallback mode',
          expectedActions: ['continue_limited', 'install_teams']
        }
      ];

      for (const scenario of errorScenarios) {
        const userMessage = userErrorHandler.formatUserMessage(scenario.error);
        
        expect(userMessage.message).toBe(scenario.expectedMessage);
        expect(userMessage.actions).toEqual(scenario.expectedActions);
        expect(userMessage.severity).toBeOneOf(['info', 'warning', 'error']);
      }
    });

    test('should provide recovery guidance', async () => {
      const recoveryGuide = errorHandler.createRecoveryGuide();

      const guidanceScenarios = [
        {
          platform: 'teams',
          error: 'authentication',
          expectedSteps: [
            'Sign out of Teams',
            'Clear browser cache',
            'Sign back into Teams',
            'Refresh the page'
          ]
        },
        {
          platform: 'zoom',
          error: 'meeting_join',
          expectedSteps: [
            'Verify meeting ID is correct',
            'Check meeting time and timezone',
            'Try joining from Zoom app',
            'Contact meeting organizer'
          ]
        },
        {
          platform: 'meet',
          error: 'extension',
          expectedSteps: [
            'Install browser extension',
            'Enable extension permissions',
            'Refresh Google Meet page',
            'Try transcription again'
          ]
        }
      ];

      for (const scenario of guidanceScenarios) {
        const guidance = recoveryGuide.getRecoverySteps(
          scenario.platform,
          scenario.error
        );
        
        expect(guidance.steps).toEqual(scenario.expectedSteps);
        expect(guidance.estimatedTime).toBeGreaterThan(0);
        expect(guidance.difficulty).toBeOneOf(['easy', 'medium', 'hard']);
      }
    });

    test('should track error resolution success rates', async () => {
      const resolutionTracker = errorHandler.createResolutionTracker();

      // Simulate error resolutions
      const resolutions = [
        { errorType: 'audio_access', resolved: true, method: 'permission_grant' },
        { errorType: 'audio_access', resolved: false, method: 'permission_grant' },
        { errorType: 'audio_access', resolved: true, method: 'permission_grant' },
        { errorType: 'network_error', resolved: true, method: 'retry' },
        { errorType: 'network_error', resolved: true, method: 'retry' }
      ];

      for (const resolution of resolutions) {
        resolutionTracker.recordResolution(resolution);
      }

      const stats = resolutionTracker.getResolutionStats();

      expect(stats.audio_access.successRate).toBe(0.67); // 2/3
      expect(stats.audio_access.mostEffectiveMethod).toBe('permission_grant');
      expect(stats.network_error.successRate).toBe(1.0); // 2/2
      expect(stats.overall.successRate).toBe(0.8); // 4/5
    });
  });
});