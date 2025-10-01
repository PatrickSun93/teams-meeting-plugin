/**
 * Zoom Integration Tests
 * Tests integration between ZoomAdapter and platform detection system
 */

import { ZoomAdapter } from '../ZoomAdapter.js';
import { platformDetectionService } from '../PlatformDetectionService.js';
import { PlatformConfigurationManager } from '../PlatformConfigurationManager.js';
import { MeetingPlatform } from '../PlatformAdapter.js';

describe('Zoom Integration', () => {
  let originalLocation;
  let configManager;

  beforeEach(() => {
    // Mock window.location for Zoom detection
    originalLocation = global.window?.location;
    global.window = {
      location: {
        hostname: 'zoom.us',
        href: 'https://zoom.us/j/123456789'
      }
    };

    configManager = new PlatformConfigurationManager();
  });

  afterEach(async () => {
    // Restore original location
    if (originalLocation) {
      global.window.location = originalLocation;
    }

    // Cleanup services
    await platformDetectionService.cleanup();
    if (configManager) {
      await configManager.cleanup();
    }
  });

  describe('Platform Detection', () => {
    test('should detect Zoom platform correctly', () => {
      const detectedPlatform = platformDetectionService.getCurrentPlatform();
      expect(detectedPlatform).toBe(MeetingPlatform.ZOOM);
    });

    test('should register ZoomAdapter successfully', () => {
      platformDetectionService.registerAdapter(MeetingPlatform.ZOOM, ZoomAdapter);
      
      const supportedPlatforms = platformDetectionService.getSupportedPlatforms();
      expect(supportedPlatforms).toContain(MeetingPlatform.ZOOM);
    });

    test('should check if Zoom platform is supported', () => {
      platformDetectionService.registerAdapter(MeetingPlatform.ZOOM, ZoomAdapter);
      
      const isSupported = platformDetectionService.isPlatformSupported(MeetingPlatform.ZOOM);
      expect(isSupported).toBe(true);
    });
  });

  describe('Configuration Management', () => {
    test('should initialize configuration manager', async () => {
      const initialized = await configManager.initialize();
      expect(initialized).toBe(true);
    });

    test('should get Zoom platform configuration', async () => {
      await configManager.initialize();
      
      const zoomConfig = configManager.getPlatformConfig(MeetingPlatform.ZOOM);
      expect(zoomConfig).toBeDefined();
      expect(zoomConfig.audioQuality).toBe('high');
      expect(zoomConfig.transcriptionEnabled).toBe(true);
    });

    test('should set Zoom-specific configuration values', async () => {
      await configManager.initialize();
      
      const success = await configManager.setPlatformConfigValue(
        MeetingPlatform.ZOOM,
        'zoom.apiKey',
        'test-api-key'
      );
      
      expect(success).toBe(true);
      
      const apiKey = configManager.getPlatformConfigValue(
        MeetingPlatform.ZOOM,
        'zoom.apiKey'
      );
      expect(apiKey).toBe('test-api-key');
    });

    test('should validate Zoom configuration', async () => {
      await configManager.initialize();
      
      const validConfig = {
        'zoom.chatEnabled': true,
        'zoom.apiKey': 'valid-key'
      };
      
      const validation = configManager.validatePlatformConfig(MeetingPlatform.ZOOM, validConfig);
      expect(validation.isValid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    test('should detect invalid Zoom configuration', async () => {
      await configManager.initialize();
      
      const invalidConfig = {
        'zoom.chatEnabled': true
        // Missing required API key
      };
      
      const validation = configManager.validatePlatformConfig(MeetingPlatform.ZOOM, invalidConfig);
      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('Zoom API key required when chat is enabled');
    });
  });

  describe('ZoomAdapter Creation', () => {
    test('should create ZoomAdapter instance', () => {
      const adapter = new ZoomAdapter();
      expect(adapter).toBeInstanceOf(ZoomAdapter);
      expect(adapter.getPlatform()).toBe(MeetingPlatform.ZOOM);
    });

    test('should get correct capabilities', () => {
      const adapter = new ZoomAdapter();
      const capabilities = adapter.getCapabilities();
      
      expect(capabilities.chatIntegration).toBe(true);
      expect(capabilities.agendaAccess).toBe(false);
      expect(capabilities.participantInfo).toBe(true);
      expect(capabilities.hostDetection).toBe(true);
      expect(capabilities.audioQuality).toBe('high');
    });

    test('should have correct meeting state initially', () => {
      const adapter = new ZoomAdapter();
      expect(adapter.getMeetingState()).toBe('not_started');
      expect(adapter.isMeetingActive()).toBe(false);
      expect(adapter.isInitialized()).toBe(false);
    });
  });

  describe('Error Handling', () => {
    test('should handle missing Zoom SDK gracefully', async () => {
      const adapter = new ZoomAdapter();
      
      // Ensure no Zoom SDK is available
      delete global.window.ZoomMtg;
      
      await expect(adapter.initialize()).rejects.toThrow(
        'Zoom Web SDK not loaded'
      );
    });

    test('should handle operations when not initialized', async () => {
      const adapter = new ZoomAdapter();
      
      await expect(adapter.getMeetingInfo()).rejects.toThrow(
        'ZoomAdapter not initialized'
      );
      
      await expect(adapter.getAudioStream()).rejects.toThrow(
        'ZoomAdapter not initialized'
      );
    });

    test('should handle operations when not in meeting', async () => {
      const adapter = new ZoomAdapter();
      adapter.initialized = true; // Mock initialization
      
      const participants = await adapter.getParticipants();
      expect(participants).toEqual([]);
      
      const isHost = await adapter.isHost();
      expect(isHost).toBe(false);
    });
  });

  describe('Platform URL Detection', () => {
    test('should detect various Zoom URLs', () => {
      const testUrls = [
        'https://zoom.us/j/123456789',
        'https://us02web.zoom.us/j/123456789',
        'https://company.zoom.us/j/123456789'
      ];
      
      testUrls.forEach(url => {
        global.window.location.href = url;
        global.window.location.hostname = new URL(url).hostname;
        
        const platform = platformDetectionService.getCurrentPlatform();
        expect(platform).toBe(MeetingPlatform.ZOOM);
      });
    });

    test('should not detect non-Zoom URLs as Zoom', () => {
      const nonZoomUrls = [
        'https://teams.microsoft.com/l/meetup-join/123',
        'https://meet.google.com/abc-defg-hij',
        'https://example.com/meeting'
      ];
      
      nonZoomUrls.forEach(url => {
        global.window.location.href = url;
        global.window.location.hostname = new URL(url).hostname;
        
        const platform = platformDetectionService.getCurrentPlatform();
        expect(platform).not.toBe(MeetingPlatform.ZOOM);
      });
    });
  });
});