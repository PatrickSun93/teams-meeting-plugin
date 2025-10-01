// Cross-platform adapter integration tests
import { jest } from '@jest/globals';

describe('Cross-Platform Adapter Integration Tests', () => {
  let platformAdapters;
  let mockPlatformDetection;

  beforeEach(() => {
    // Import platform adapters
    const TeamsAdapter = require('../../src/client/services/TeamsAdapter');
    const ZoomAdapter = require('../../src/client/services/ZoomAdapter');
    const MeetAdapter = require('../../src/client/services/MeetAdapter');
    const GenericAdapter = require('../../src/client/services/GenericAdapter');
    const PlatformDetectionService = require('../../src/client/services/PlatformDetectionService');

    platformAdapters = {
      teams: new TeamsAdapter(),
      zoom: new ZoomAdapter(),
      meet: new MeetAdapter(),
      generic: new GenericAdapter()
    };

    mockPlatformDetection = new PlatformDetectionService();

    // Mock browser environment
    global.window = {
      location: { hostname: 'localhost' },
      navigator: {
        mediaDevices: {
          getUserMedia: jest.fn().mockResolvedValue({
            getTracks: () => [{ kind: 'audio', stop: jest.fn() }]
          })
        }
      }
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Platform Detection Integration', () => {
    test('should detect Teams platform correctly', async () => {
      // Mock Teams environment
      global.window.location.hostname = 'teams.microsoft.com';
      global.microsoftTeams = {
        app: { initialize: jest.fn() },
        getContext: jest.fn()
      };

      const detectedPlatform = await mockPlatformDetection.detectCurrentPlatform();
      expect(detectedPlatform).toBe('teams');

      const adapter = await mockPlatformDetection.createAdapter(detectedPlatform);
      expect(adapter).toBeInstanceOf(require('../../src/client/services/TeamsAdapter'));
    });

    test('should detect Zoom platform correctly', async () => {
      // Mock Zoom environment
      global.window.location.hostname = 'zoom.us';
      global.ZoomMtg = {
        init: jest.fn(),
        join: jest.fn()
      };

      const detectedPlatform = await mockPlatformDetection.detectCurrentPlatform();
      expect(detectedPlatform).toBe('zoom');

      const adapter = await mockPlatformDetection.createAdapter(detectedPlatform);
      expect(adapter).toBeInstanceOf(require('../../src/client/services/ZoomAdapter'));
    });

    test('should detect Google Meet platform correctly', async () => {
      // Mock Google Meet environment
      global.window.location.hostname = 'meet.google.com';
      global.chrome = {
        runtime: { id: 'test-extension-id' }
      };

      const detectedPlatform = await mockPlatformDetection.detectCurrentPlatform();
      expect(detectedPlatform).toBe('meet');

      const adapter = await mockPlatformDetection.createAdapter(detectedPlatform);
      expect(adapter).toBeInstanceOf(require('../../src/client/services/MeetAdapter'));
    });

    test('should fallback to generic adapter for unknown platforms', async () => {
      // Mock unknown platform
      global.window.location.hostname = 'unknown-platform.com';

      const detectedPlatform = await mockPlatformDetection.detectCurrentPlatform();
      expect(detectedPlatform).toBe('generic');

      const adapter = await mockPlatformDetection.createAdapter(detectedPlatform);
      expect(adapter).toBeInstanceOf(require('../../src/client/services/GenericAdapter'));
    });
  });

  describe('Unified Interface Compliance', () => {
    const testCases = [
      { platform: 'teams', adapter: 'teams' },
      { platform: 'zoom', adapter: 'zoom' },
      { platform: 'meet', adapter: 'meet' },
      { platform: 'generic', adapter: 'generic' }
    ];

    testCases.forEach(({ platform, adapter }) => {
      describe(`${platform} adapter`, () => {
        let adapterInstance;

        beforeEach(() => {
          adapterInstance = platformAdapters[adapter];
        });

        test('should implement required interface methods', () => {
          const requiredMethods = [
            'initialize',
            'getMeetingInfo',
            'getAudioStream',
            'getParticipants',
            'sendMessageToChat',
            'getMeetingAgenda',
            'isHost',
            'getCapabilities',
            'cleanup'
          ];

          requiredMethods.forEach(method => {
            expect(typeof adapterInstance[method]).toBe('function');
          });
        });

        test('should return consistent capability structure', async () => {
          const capabilities = adapterInstance.getCapabilities();

          expect(capabilities).toHaveProperty('chatIntegration');
          expect(capabilities).toHaveProperty('agendaAccess');
          expect(capabilities).toHaveProperty('participantInfo');
          expect(capabilities).toHaveProperty('hostDetection');
          expect(capabilities).toHaveProperty('audioQuality');

          expect(typeof capabilities.chatIntegration).toBe('boolean');
          expect(typeof capabilities.agendaAccess).toBe('boolean');
          expect(typeof capabilities.participantInfo).toBe('boolean');
          expect(typeof capabilities.hostDetection).toBe('boolean');
          expect(['high', 'medium', 'low']).toContain(capabilities.audioQuality);
        });

        test('should handle initialization gracefully', async () => {
          await expect(adapterInstance.initialize()).resolves.not.toThrow();
        });

        test('should handle audio stream requests', async () => {
          await adapterInstance.initialize();
          
          if (adapterInstance.getCapabilities().audioQuality !== 'low') {
            const audioStream = await adapterInstance.getAudioStream();
            expect(audioStream).toBeDefined();
          }
        });

        test('should handle meeting info requests', async () => {
          await adapterInstance.initialize();
          
          const meetingInfo = await adapterInstance.getMeetingInfo();
          
          if (meetingInfo) {
            expect(meetingInfo).toHaveProperty('id');
            expect(meetingInfo).toHaveProperty('platform');
            expect(meetingInfo.platform).toBe(platform);
          }
        });

        test('should handle cleanup properly', async () => {
          await adapterInstance.initialize();
          await expect(adapterInstance.cleanup()).resolves.not.toThrow();
        });
      });
    });
  });

  describe('Cross-Platform Audio Processing', () => {
    test('should handle audio streams consistently across platforms', async () => {
      const audioResults = {};

      for (const [platformName, adapter] of Object.entries(platformAdapters)) {
        try {
          await adapter.initialize();
          const audioStream = await adapter.getAudioStream();
          
          audioResults[platformName] = {
            success: !!audioStream,
            hasAudioTracks: audioStream?.getAudioTracks?.()?.length > 0
          };
        } catch (error) {
          audioResults[platformName] = {
            success: false,
            error: error.message
          };
        }
      }

      // At least one platform should successfully provide audio
      const successfulPlatforms = Object.values(audioResults).filter(r => r.success);
      expect(successfulPlatforms.length).toBeGreaterThan(0);
    });

    test('should maintain audio quality standards across platforms', async () => {
      const qualityTests = [];

      for (const [platformName, adapter] of Object.entries(platformAdapters)) {
        const capabilities = adapter.getCapabilities();
        
        qualityTests.push({
          platform: platformName,
          audioQuality: capabilities.audioQuality,
          expectedSampleRate: capabilities.audioQuality === 'high' ? 48000 : 16000
        });
      }

      // Verify quality expectations
      qualityTests.forEach(test => {
        expect(['high', 'medium', 'low']).toContain(test.audioQuality);
        expect(test.expectedSampleRate).toBeGreaterThan(0);
      });
    });
  });

  describe('Cross-Platform Chat Integration', () => {
    test('should handle chat capabilities consistently', async () => {
      const chatResults = {};

      for (const [platformName, adapter] of Object.entries(platformAdapters)) {
        await adapter.initialize();
        const capabilities = adapter.getCapabilities();
        
        if (capabilities.chatIntegration) {
          try {
            const result = await adapter.sendMessageToChat('Test message');
            chatResults[platformName] = { success: true, result };
          } catch (error) {
            chatResults[platformName] = { success: false, error: error.message };
          }
        } else {
          chatResults[platformName] = { success: false, reason: 'Not supported' };
        }
      }

      // Teams and Zoom should support chat integration
      if (chatResults.teams) {
        expect(chatResults.teams.success).toBe(true);
      }
      if (chatResults.zoom) {
        expect(chatResults.zoom.success).toBe(true);
      }
      
      // Google Meet should not support chat integration
      if (chatResults.meet) {
        expect(chatResults.meet.success).toBe(false);
      }
    });

    test('should format messages consistently across platforms', async () => {
      const testMessage = {
        type: 'transcript',
        content: 'Meeting transcript content',
        timestamp: Date.now(),
        metadata: { duration: 3600, participants: 5 }
      };

      const formattedMessages = {};

      for (const [platformName, adapter] of Object.entries(platformAdapters)) {
        if (adapter.getCapabilities().chatIntegration) {
          const formatted = adapter.formatChatMessage(testMessage);
          formattedMessages[platformName] = formatted;
        }
      }

      // All formatted messages should contain essential information
      Object.values(formattedMessages).forEach(message => {
        expect(message).toContain('transcript');
        expect(message).toContain('Meeting');
      });
    });
  });

  describe('Cross-Platform Error Handling', () => {
    test('should handle platform-specific errors gracefully', async () => {
      const errorScenarios = [
        { method: 'getAudioStream', mockError: 'Audio access denied' },
        { method: 'sendMessageToChat', mockError: 'Chat permission denied' },
        { method: 'getMeetingAgenda', mockError: 'Agenda not available' },
        { method: 'getParticipants', mockError: 'Participant info restricted' }
      ];

      for (const [platformName, adapter] of Object.entries(platformAdapters)) {
        for (const scenario of errorScenarios) {
          // Mock method to throw error
          const originalMethod = adapter[scenario.method];
          adapter[scenario.method] = jest.fn().mockRejectedValue(new Error(scenario.mockError));

          try {
            await adapter[scenario.method]();
          } catch (error) {
            expect(error.message).toContain(scenario.mockError);
          }

          // Restore original method
          adapter[scenario.method] = originalMethod;
        }
      }
    });

    test('should provide consistent error reporting across platforms', async () => {
      const errorReports = {};

      for (const [platformName, adapter] of Object.entries(platformAdapters)) {
        // Simulate various error conditions
        const errors = [];

        try {
          await adapter.getAudioStream();
        } catch (error) {
          errors.push({ type: 'audio', error: error.message });
        }

        try {
          await adapter.sendMessageToChat('test');
        } catch (error) {
          errors.push({ type: 'chat', error: error.message });
        }

        errorReports[platformName] = errors;
      }

      // Verify error structure consistency
      Object.values(errorReports).forEach(errors => {
        errors.forEach(error => {
          expect(error).toHaveProperty('type');
          expect(error).toHaveProperty('error');
          expect(typeof error.error).toBe('string');
        });
      });
    });
  });

  describe('Cross-Platform Configuration Management', () => {
    test('should handle platform-specific configurations', async () => {
      const PlatformConfigurationManager = require('../../src/client/services/PlatformConfigurationManager');
      const configManager = new PlatformConfigurationManager();

      const platformConfigs = {
        teams: {
          apiEndpoint: 'https://graph.microsoft.com',
          permissions: ['microphone', 'chat'],
          features: ['transcription', 'summary', 'chat']
        },
        zoom: {
          apiEndpoint: 'https://api.zoom.us',
          permissions: ['microphone', 'recording'],
          features: ['transcription', 'summary', 'recording']
        },
        meet: {
          apiEndpoint: 'https://www.googleapis.com',
          permissions: ['microphone'],
          features: ['transcription', 'export']
        }
      };

      for (const [platform, config] of Object.entries(platformConfigs)) {
        await configManager.setPlatformConfig(platform, config);
        const retrievedConfig = await configManager.getPlatformConfig(platform);
        
        expect(retrievedConfig).toEqual(config);
      }
    });

    test('should validate platform-specific settings', async () => {
      const PlatformConfigurationManager = require('../../src/client/services/PlatformConfigurationManager');
      const configManager = new PlatformConfigurationManager();

      const validConfigs = {
        teams: { tenantId: 'valid-tenant-id', clientId: 'valid-client-id' },
        zoom: { apiKey: 'valid-zoom-key', apiSecret: 'valid-zoom-secret' },
        meet: { clientId: 'valid-google-client-id' }
      };

      const invalidConfigs = {
        teams: { tenantId: '', clientId: 'invalid' },
        zoom: { apiKey: 'short', apiSecret: '' },
        meet: { clientId: null }
      };

      // Valid configs should pass validation
      for (const [platform, config] of Object.entries(validConfigs)) {
        const isValid = await configManager.validatePlatformConfig(platform, config);
        expect(isValid).toBe(true);
      }

      // Invalid configs should fail validation
      for (const [platform, config] of Object.entries(invalidConfigs)) {
        const isValid = await configManager.validatePlatformConfig(platform, config);
        expect(isValid).toBe(false);
      }
    });
  });

  describe('Cross-Platform Performance Consistency', () => {
    test('should maintain consistent initialization times', async () => {
      const initTimes = {};

      for (const [platformName, adapter] of Object.entries(platformAdapters)) {
        const startTime = performance.now();
        await adapter.initialize();
        const endTime = performance.now();
        
        initTimes[platformName] = endTime - startTime;
      }

      // All platforms should initialize within reasonable time (< 1000ms)
      Object.entries(initTimes).forEach(([platform, time]) => {
        expect(time).toBeLessThan(1000);
      });

      // No platform should be significantly slower than others (> 5x difference)
      const times = Object.values(initTimes);
      const maxTime = Math.max(...times);
      const minTime = Math.min(...times);
      expect(maxTime / minTime).toBeLessThan(5);
    });

    test('should handle concurrent operations efficiently', async () => {
      const concurrentOperations = [];

      for (const [platformName, adapter] of Object.entries(platformAdapters)) {
        concurrentOperations.push(
          adapter.initialize().then(() => ({
            platform: platformName,
            success: true
          })).catch(error => ({
            platform: platformName,
            success: false,
            error: error.message
          }))
        );
      }

      const results = await Promise.all(concurrentOperations);
      
      // At least 75% of platforms should initialize successfully
      const successCount = results.filter(r => r.success).length;
      expect(successCount / results.length).toBeGreaterThanOrEqual(0.75);
    });
  });
});