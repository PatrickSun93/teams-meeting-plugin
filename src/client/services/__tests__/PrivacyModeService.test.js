/**
 * Tests for PrivacyModeService
 */

import PrivacyModeService from '../PrivacyModeService.js';

// Mock localStorage
const mockLocalStorage = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn()
};

Object.defineProperty(global, 'localStorage', {
  value: mockLocalStorage,
  writable: true
});

describe('PrivacyModeService', () => {
  let privacyModeService;

  beforeEach(() => {
    privacyModeService = new PrivacyModeService();
    jest.clearAllMocks();
  });

  describe('Privacy Mode Management', () => {
    test('should enable privacy mode with default settings', () => {
      const mockListener = jest.fn();
      privacyModeService.addListener(mockListener);

      privacyModeService.enablePrivacyMode();

      expect(privacyModeService.isPrivacyModeEnabled()).toBe(true);
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        'teams_transcription_privacy_mode',
        expect.stringContaining('"enabled":true')
      );
      expect(mockListener).toHaveBeenCalledWith('privacy_enabled', expect.any(Object));
    });

    test('should enable privacy mode with custom settings', () => {
      const customSettings = {
        blockCloudSTT: false,
        autoDeleteDays: 7
      };

      privacyModeService.enablePrivacyMode(customSettings);

      expect(privacyModeService.isPrivacyModeEnabled()).toBe(true);
      
      const settings = privacyModeService.getPrivacySettings();
      expect(settings.blockCloudSTT).toBe(false);
      expect(settings.autoDeleteDays).toBe(7);
    });

    test('should disable privacy mode', () => {
      const mockListener = jest.fn();
      privacyModeService.addListener(mockListener);
      
      privacyModeService.enablePrivacyMode();
      jest.clearAllMocks(); // Clear previous calls
      
      privacyModeService.disablePrivacyMode();

      expect(privacyModeService.isPrivacyModeEnabled()).toBe(false);
      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('teams_transcription_privacy_mode');
      expect(mockListener).toHaveBeenCalledWith('privacy_disabled', null);
    });

    test('should update privacy settings', () => {
      const mockListener = jest.fn();
      privacyModeService.addListener(mockListener);
      
      privacyModeService.enablePrivacyMode();
      
      const newSettings = {
        blockCloudSummary: false,
        autoDeleteDays: 14
      };

      privacyModeService.updatePrivacySettings(newSettings);

      const settings = privacyModeService.getPrivacySettings();
      expect(settings.blockCloudSummary).toBe(false);
      expect(settings.autoDeleteDays).toBe(14);
      expect(mockListener).toHaveBeenCalledWith('privacy_settings_updated', expect.any(Object));
    });
  });

  describe('Service Validation', () => {
    beforeEach(() => {
      privacyModeService.enablePrivacyMode();
    });

    test('should allow local STT services in privacy mode', () => {
      const result = privacyModeService.isServiceAllowed('stt', 'local_whisper');
      expect(result).toBe(true);
    });

    test('should block cloud STT services in privacy mode', () => {
      const result = privacyModeService.isServiceAllowed('stt', 'openai');
      expect(result).toBe(false);
    });

    test('should allow cloud STT when blockCloudSTT is disabled', () => {
      privacyModeService.updatePrivacySettings({ blockCloudSTT: false });
      
      const result = privacyModeService.isServiceAllowed('stt', 'openai');
      expect(result).toBe(true);
    });

    test('should block cloud summary services in privacy mode', () => {
      const result = privacyModeService.isServiceAllowed('summary', 'openai');
      expect(result).toBe(false);
    });

    test('should allow local summary services in privacy mode', () => {
      const result = privacyModeService.isServiceAllowed('summary', 'local_whisper');
      expect(result).toBe(true);
    });

    test('should block analytics in privacy mode', () => {
      const result = privacyModeService.isServiceAllowed('analytics', 'google_analytics');
      expect(result).toBe(false);
    });

    test('should allow analytics when blockAnalytics is disabled', () => {
      privacyModeService.updatePrivacySettings({ blockAnalytics: false });
      
      const result = privacyModeService.isServiceAllowed('analytics', 'google_analytics');
      expect(result).toBe(true);
    });

    test('should block data sharing in privacy mode', () => {
      const result = privacyModeService.isServiceAllowed('sharing', 'teams_chat');
      expect(result).toBe(false);
    });

    test('should allow all services when privacy mode is disabled', () => {
      privacyModeService.disablePrivacyMode();

      expect(privacyModeService.isServiceAllowed('stt', 'openai')).toBe(true);
      expect(privacyModeService.isServiceAllowed('summary', 'claude')).toBe(true);
      expect(privacyModeService.isServiceAllowed('analytics', 'google_analytics')).toBe(true);
      expect(privacyModeService.isServiceAllowed('sharing', 'teams_chat')).toBe(true);
    });
  });

  describe('Processing Request Validation', () => {
    beforeEach(() => {
      privacyModeService.enablePrivacyMode();
    });

    test('should validate allowed processing request', () => {
      const request = {
        serviceType: 'stt',
        provider: 'local_whisper',
        dataType: 'audio',
        destination: 'local'
      };

      const result = privacyModeService.validateProcessingRequest(request);

      expect(result.allowed).toBe(true);
      expect(result.reason).toBe('Request complies with privacy settings');
    });

    test('should reject blocked service provider', () => {
      const request = {
        serviceType: 'stt',
        provider: 'openai',
        dataType: 'audio',
        destination: 'local' // Use local destination to avoid destination check
      };

      const result = privacyModeService.validateProcessingRequest(request);

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('blocked by privacy settings');
      expect(result.alternative).toBe('Use local Whisper model or browser speech recognition');
    });

    test('should reject external data storage when localStorageOnly is enabled', () => {
      const request = {
        serviceType: 'sharing', // Use a service type that doesn't have specific provider checks
        provider: 'cloud',
        dataType: 'transcript',
        destination: 'external'
      };

      const result = privacyModeService.validateProcessingRequest(request);

      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('External data storage blocked by privacy settings');
      expect(result.alternative).toBe('Use local storage only');
    });

    test('should allow requests when privacy mode is disabled', () => {
      privacyModeService.disablePrivacyMode();

      const request = {
        serviceType: 'stt',
        provider: 'openai',
        dataType: 'audio',
        destination: 'external'
      };

      const result = privacyModeService.validateProcessingRequest(request);

      expect(result.allowed).toBe(true);
      expect(result.reason).toBe('Privacy mode disabled');
    });
  });

  describe('Privacy-Compliant Configuration', () => {
    test('should return original config when privacy mode is disabled', () => {
      const originalConfig = {
        sttProvider: 'openai',
        summaryProvider: 'claude',
        enableAnalytics: true,
        storageLocation: 'cloud'
      };

      const result = privacyModeService.getPrivacyCompliantConfig(originalConfig);

      expect(result).toEqual(originalConfig);
    });

    test('should modify config for privacy compliance', () => {
      privacyModeService.enablePrivacyMode();

      const originalConfig = {
        sttProvider: 'openai',
        summaryProvider: 'claude',
        enableAnalytics: true,
        storageLocation: 'cloud',
        enableCloudSync: true
      };

      const result = privacyModeService.getPrivacyCompliantConfig(originalConfig);

      expect(result.sttProvider).toBe('local_whisper');
      expect(result.enableSummary).toBe(false);
      expect(result.enableAnalytics).toBe(false);
      expect(result.storageLocation).toBe('local');
      expect(result.enableCloudSync).toBe(false);
    });

    test('should preserve local STT provider in privacy mode', () => {
      privacyModeService.enablePrivacyMode();

      const originalConfig = {
        sttProvider: 'local_whisper',
        summaryProvider: 'local_whisper'
      };

      const result = privacyModeService.getPrivacyCompliantConfig(originalConfig);

      expect(result.sttProvider).toBe('local_whisper');
      expect(result.summaryProvider).toBe('local_whisper');
    });
  });

  describe('Data Sanitization', () => {
    beforeEach(() => {
      privacyModeService.enablePrivacyMode();
      privacyModeService.updatePrivacySettings({ anonymizeTranscripts: true });
    });

    test('should sanitize transcript data', () => {
      const transcript = {
        id: 'transcript-123',
        participants: [
          { name: 'John Doe', email: 'john@example.com', id: 'user-1' },
          { name: 'Jane Smith', email: 'jane@example.com', id: 'user-2' }
        ],
        content: 'Meeting content'
      };

      const result = privacyModeService.sanitizeData(transcript, 'transcript');

      expect(result.participants[0].name).toBe('Speaker 1');
      expect(result.participants[0].email).toBeUndefined();
      expect(result.participants[0].id).toBe('speaker_1');
      expect(result.participants[1].name).toBe('Speaker 2');
      expect(result.participants[1].id).toBe('speaker_2');
      expect(result.content).toBe('Meeting content');
    });

    test('should sanitize config data', () => {
      const config = {
        sttProvider: 'openai',
        apiKeys: { openai: 'sk-123456' },
        userInfo: { name: 'John Doe', email: 'john@example.com' }
      };

      const result = privacyModeService.sanitizeData(config, 'config');

      expect(result.apiKeys).toEqual({});
      expect(result.userInfo).toBeUndefined();
      expect(result.sttProvider).toBe('openai');
    });

    test('should sanitize analytics data', () => {
      const analytics = {
        userId: 'user-123',
        sessionId: 'session-456',
        eventType: 'transcription_started',
        timestamp: Date.now()
      };

      const result = privacyModeService.sanitizeData(analytics, 'analytics');

      expect(result.userId).toBeUndefined();
      expect(result.sessionId).toBeUndefined();
      expect(result.eventType).toBe('transcription_started');
      expect(result.timestamp).toBeDefined();
    });

    test('should return original data when privacy mode is disabled', () => {
      privacyModeService.disablePrivacyMode();

      const data = { sensitive: 'information' };
      const result = privacyModeService.sanitizeData(data, 'transcript');

      expect(result).toEqual(data);
    });
  });

  describe('Data Retention Policy', () => {
    test('should apply retention policy when enabled', () => {
      privacyModeService.enablePrivacyMode();
      privacyModeService.updatePrivacySettings({ autoDeleteTranscripts: true });

      expect(privacyModeService.shouldApplyRetentionPolicy()).toBe(true);
    });

    test('should not apply retention policy when disabled', () => {
      privacyModeService.enablePrivacyMode();
      privacyModeService.updatePrivacySettings({ autoDeleteTranscripts: false });

      expect(privacyModeService.shouldApplyRetentionPolicy()).toBe(false);
    });

    test('should not apply retention policy when privacy mode is disabled', () => {
      privacyModeService.disablePrivacyMode();

      expect(privacyModeService.shouldApplyRetentionPolicy()).toBe(false);
    });

    test('should return correct retention period', () => {
      privacyModeService.enablePrivacyMode();
      privacyModeService.updatePrivacySettings({ autoDeleteDays: 14 });

      expect(privacyModeService.getRetentionPeriod()).toBe(14);
    });
  });

  describe('Privacy Status', () => {
    test('should return correct privacy status when enabled', () => {
      privacyModeService.enablePrivacyMode({
        blockCloudSTT: true,
        blockCloudSummary: true,
        blockAnalytics: true
      });

      const status = privacyModeService.getPrivacyStatus();

      expect(status.enabled).toBe(true);
      expect(status.allowedServices.stt).toEqual(['local_whisper', 'browser_speech']);
      expect(status.allowedServices.summary).toBe('local');
      expect(status.allowedServices.analytics).toBe('disabled');
    });

    test('should return correct privacy status when disabled', () => {
      privacyModeService.disablePrivacyMode();

      const status = privacyModeService.getPrivacyStatus();

      expect(status.enabled).toBe(false);
      expect(status.allowedServices.stt).toBe('all');
      expect(status.allowedServices.summary).toBe('all');
      expect(status.allowedServices.analytics).toBe('enabled');
    });
  });

  describe('Storage Initialization', () => {
    test('should initialize from stored state', () => {
      const storedState = {
        enabled: true,
        settings: {
          blockCloudSTT: false,
          autoDeleteDays: 7
        }
      };

      mockLocalStorage.getItem.mockReturnValueOnce(JSON.stringify(storedState));

      const newService = new PrivacyModeService();
      newService.initializeFromStorage(); // Explicitly call initialization

      expect(newService.isPrivacyModeEnabled()).toBe(true);
      expect(newService.getPrivacySettings().blockCloudSTT).toBe(false);
      expect(newService.getPrivacySettings().autoDeleteDays).toBe(7);
    });

    test('should handle invalid stored state', () => {
      mockLocalStorage.getItem.mockReturnValue('invalid json');

      const newService = new PrivacyModeService();

      expect(newService.isPrivacyModeEnabled()).toBe(false);
    });

    test('should handle missing stored state', () => {
      mockLocalStorage.getItem.mockReturnValue(null);

      const newService = new PrivacyModeService();

      expect(newService.isPrivacyModeEnabled()).toBe(false);
    });
  });

  describe('Event Listeners', () => {
    test('should add and remove listeners', () => {
      const listener1 = jest.fn();
      const listener2 = jest.fn();

      privacyModeService.addListener(listener1);
      privacyModeService.addListener(listener2);

      privacyModeService.enablePrivacyMode();

      expect(listener1).toHaveBeenCalled();
      expect(listener2).toHaveBeenCalled();

      privacyModeService.removeListener(listener1);
      jest.clearAllMocks();

      privacyModeService.disablePrivacyMode();

      expect(listener1).not.toHaveBeenCalled();
      expect(listener2).toHaveBeenCalled();
    });

    test('should handle listener errors gracefully', () => {
      const errorListener = jest.fn().mockImplementation(() => {
        throw new Error('Listener error');
      });
      const goodListener = jest.fn();

      // Mock console.error to avoid test output noise
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      privacyModeService.addListener(errorListener);
      privacyModeService.addListener(goodListener);

      // Should not throw error
      expect(() => {
        privacyModeService.enablePrivacyMode();
      }).not.toThrow();

      expect(goodListener).toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalledWith('Error in privacy mode listener:', expect.any(Error));
      
      consoleSpy.mockRestore();
    });
  });
});