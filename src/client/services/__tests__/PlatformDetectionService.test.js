/**
 * Platform Detection Service Tests
 * Tests for the PlatformDetectionService class
 */

import { PlatformDetectionService, platformDetectionService } from '../PlatformDetectionService.js';
import { PlatformAdapter, MeetingPlatform } from '../PlatformAdapter.js';

// Mock adapter classes for testing
class MockTeamsAdapter extends PlatformAdapter {
  constructor() {
    super();
    this.platform = MeetingPlatform.TEAMS;
  }

  async initialize() {
    this.initialized = true;
    return true;
  }

  async getMeetingInfo() { return {}; }
  async getAudioStream() { return new MediaStream(); }
  async getParticipants() { return []; }
  async sendMessageToChat() { return true; }
  async getMeetingAgenda() { return null; }
  async isHost() { return false; }
  
  getCapabilities() {
    return {
      chatIntegration: true,
      audioQuality: 'high'
    };
  }
}

class MockZoomAdapter extends PlatformAdapter {
  constructor() {
    super();
    this.platform = MeetingPlatform.ZOOM;
  }

  async initialize() {
    this.initialized = true;
    return true;
  }

  async getMeetingInfo() { return {}; }
  async getAudioStream() { return new MediaStream(); }
  async getParticipants() { return []; }
  async sendMessageToChat() { return true; }
  async getMeetingAgenda() { return null; }
  async isHost() { return false; }
  
  getCapabilities() {
    return {
      chatIntegration: true,
      audioQuality: 'high'
    };
  }
}

class FailingAdapter extends PlatformAdapter {
  constructor() {
    super();
    this.platform = MeetingPlatform.GOOGLE_MEET;
  }

  async initialize() {
    throw new Error('Initialization failed');
  }

  async getMeetingInfo() { return {}; }
  async getAudioStream() { return new MediaStream(); }
  async getParticipants() { return []; }
  async sendMessageToChat() { return false; }
  async getMeetingAgenda() { return null; }
  async isHost() { return false; }
  
  getCapabilities() {
    return {};
  }
}

// Mock window object
const mockWindow = {
  location: {
    hostname: 'teams.microsoft.com',
    href: 'https://teams.microsoft.com/meeting'
  }
};

describe('PlatformDetectionService', () => {
  let service;

  beforeEach(() => {
    global.window = mockWindow;
    service = new PlatformDetectionService();
    
    // Register mock adapters
    service.registerAdapter(MeetingPlatform.TEAMS, MockTeamsAdapter);
    service.registerAdapter(MeetingPlatform.ZOOM, MockZoomAdapter);
    service.registerAdapter(MeetingPlatform.GOOGLE_MEET, FailingAdapter);
    
    // Reset platform detection state
    service.currentPlatform = MeetingPlatform.UNKNOWN;
    service.currentAdapter = null;
  });

  afterEach(async () => {
    await service.cleanup();
    delete global.window;
    jest.clearAllTimers();
  });

  describe('Initialization', () => {
    test('should create service instance', () => {
      expect(service).toBeInstanceOf(PlatformDetectionService);
      expect(service.currentPlatform).toBe(MeetingPlatform.UNKNOWN);
      expect(service.currentAdapter).toBeNull();
    });

    test('should register adapters', () => {
      expect(service.isPlatformSupported(MeetingPlatform.TEAMS)).toBe(true);
      expect(service.isPlatformSupported(MeetingPlatform.ZOOM)).toBe(true);
      expect(service.isPlatformSupported('unsupported')).toBe(false);
    });
  });

  describe('Platform Detection', () => {
    test('should detect current platform', () => {
      const platform = service.getCurrentPlatform();
      expect(platform).toBe(MeetingPlatform.TEAMS);
    });

    test('should detect and create adapter', async () => {
      const adapter = await service.detectAndGetAdapter();
      
      expect(adapter).toBeInstanceOf(MockTeamsAdapter);
      expect(adapter.getPlatform()).toBe(MeetingPlatform.TEAMS);
      expect(adapter.isInitialized()).toBe(true);
      expect(service.currentPlatform).toBe(MeetingPlatform.TEAMS);
      expect(service.currentAdapter).toBe(adapter);
    });

    test('should return existing adapter if platform unchanged', async () => {
      const adapter1 = await service.detectAndGetAdapter();
      const adapter2 = await service.detectAndGetAdapter();
      
      expect(adapter1).toBe(adapter2);
    });

    test('should force re-detection when requested', async () => {
      const adapter1 = await service.detectAndGetAdapter();
      
      // Mock cleanup to verify it's called
      const cleanupSpy = jest.spyOn(adapter1, 'cleanup');
      
      const adapter2 = await service.detectAndGetAdapter(true);
      
      // Should create new adapter instance
      expect(cleanupSpy).toHaveBeenCalled();
      expect(adapter2.getPlatform()).toBe(MeetingPlatform.TEAMS);
    });

    test('should handle platform change', async () => {
      // Start with Teams
      await service.detectAndGetAdapter();
      expect(service.currentPlatform).toBe(MeetingPlatform.TEAMS);
      
      // Change to Zoom
      global.window.location.hostname = 'zoom.us';
      const adapter = await service.detectAndGetAdapter(true);
      
      expect(service.currentPlatform).toBe(MeetingPlatform.ZOOM);
      expect(adapter.getPlatform()).toBe(MeetingPlatform.ZOOM);
    });

    test('should handle unknown platform', async () => {
      global.window.location.hostname = 'unknown-platform.com';
      const adapter = await service.detectAndGetAdapter(true);
      
      expect(service.currentPlatform).toBe(MeetingPlatform.UNKNOWN);
      expect(adapter).toBeNull();
    });
  });

  describe('Adapter Management', () => {
    test('should handle adapter initialization failure', async () => {
      global.window.location.hostname = 'meet.google.com';
      const adapter = await service.detectAndGetAdapter(true);
      
      expect(adapter).toBeNull();
      expect(service.currentAdapter).toBeNull();
    });

    test('should cleanup old adapter on platform change', async () => {
      const adapter1 = await service.detectAndGetAdapter();
      const cleanupSpy = jest.spyOn(adapter1, 'cleanup');
      
      // Change platform
      global.window.location.hostname = 'zoom.us';
      await service.detectAndGetAdapter(true);
      
      expect(cleanupSpy).toHaveBeenCalled();
    });
  });

  describe('Platform Capabilities', () => {
    test('should get capabilities for current platform', async () => {
      await service.detectAndGetAdapter();
      const capabilities = await service.getPlatformCapabilities();
      
      expect(capabilities).toEqual({
        chatIntegration: true,
        audioQuality: 'high'
      });
    });

    test('should get capabilities for specific platform', async () => {
      const capabilities = await service.getPlatformCapabilities(MeetingPlatform.ZOOM);
      
      expect(capabilities).toEqual({
        chatIntegration: true,
        audioQuality: 'high'
      });
    });

    test('should return null for unknown platform', async () => {
      const capabilities = await service.getPlatformCapabilities(MeetingPlatform.UNKNOWN);
      expect(capabilities).toBeNull();
    });

    test('should handle capability retrieval errors', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      const capabilities = await service.getPlatformCapabilities(MeetingPlatform.GOOGLE_MEET);
      
      expect(capabilities).toBeNull();
      expect(consoleErrorSpy).toHaveBeenCalled();
      consoleErrorSpy.mockRestore();
    });
  });

  describe('Continuous Detection', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    test('should start continuous detection', () => {
      service.startContinuousDetection(1000);
      expect(service.detectionInterval).not.toBeNull();
    });

    test('should stop continuous detection', () => {
      service.startContinuousDetection(1000);
      service.stopContinuousDetection();
      expect(service.detectionInterval).toBeNull();
    });

    test('should detect platform changes during continuous detection', async () => {
      const callback = jest.fn();
      service.onPlatformDetected(callback);
      
      service.startContinuousDetection(1000);
      
      // Initial detection
      jest.advanceTimersByTime(1000);
      await Promise.resolve(); // Allow async operations to complete
      
      // Change platform
      global.window.location.hostname = 'zoom.us';
      jest.advanceTimersByTime(1000);
      await Promise.resolve();
      
      expect(callback).toHaveBeenCalled();
    });

    test('should handle errors during continuous detection', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      
      // Mock detectAndGetAdapter to throw error
      const originalMethod = service.detectAndGetAdapter;
      service.detectAndGetAdapter = jest.fn().mockRejectedValue(new Error('Test error'));
      
      service.startContinuousDetection(1000);
      jest.advanceTimersByTime(1000);
      await Promise.resolve();
      
      expect(consoleErrorSpy).toHaveBeenCalled();
      
      // Restore
      service.detectAndGetAdapter = originalMethod;
      consoleErrorSpy.mockRestore();
    });
  });

  describe('Event Callbacks', () => {
    test('should add detection callbacks', () => {
      const callback = jest.fn();
      service.onPlatformDetected(callback);
      
      expect(service.detectionCallbacks).toContain(callback);
    });

    test('should remove detection callbacks', () => {
      const callback = jest.fn();
      service.onPlatformDetected(callback);
      service.removeDetectionCallback(callback);
      
      expect(service.detectionCallbacks).not.toContain(callback);
    });

    test('should notify callbacks on platform change', async () => {
      const callback = jest.fn();
      service.onPlatformDetected(callback);
      
      // Initial detection
      await service.detectAndGetAdapter();
      
      // Change platform
      global.window.location.hostname = 'zoom.us';
      await service.detectAndGetAdapter(true);
      
      expect(callback).toHaveBeenCalledWith({
        oldPlatform: MeetingPlatform.TEAMS,
        newPlatform: MeetingPlatform.ZOOM,
        timestamp: expect.any(Date)
      });
    });

    test('should handle errors in callbacks', async () => {
      const errorCallback = jest.fn(() => {
        throw new Error('Callback error');
      });
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      
      service.onPlatformDetected(errorCallback);
      
      // Trigger platform change
      global.window.location.hostname = 'zoom.us';
      await service.detectAndGetAdapter(true);
      
      expect(consoleErrorSpy).toHaveBeenCalled();
      consoleErrorSpy.mockRestore();
    });
  });

  describe('Supported Platforms', () => {
    test('should return supported platforms', () => {
      const supported = service.getSupportedPlatforms();
      expect(supported).toContain(MeetingPlatform.TEAMS);
      expect(supported).toContain(MeetingPlatform.ZOOM);
      expect(supported).toContain(MeetingPlatform.GOOGLE_MEET);
    });

    test('should check platform support', () => {
      expect(service.isPlatformSupported(MeetingPlatform.TEAMS)).toBe(true);
      expect(service.isPlatformSupported('unsupported')).toBe(false);
      expect(service.isPlatformSupported(MeetingPlatform.UNKNOWN)).toBe(true); // Always supported
    });
  });

  describe('Cleanup', () => {
    test('should cleanup all resources', async () => {
      const callback = jest.fn();
      service.onPlatformDetected(callback);
      service.startContinuousDetection(1000);
      
      const adapter = await service.detectAndGetAdapter();
      const adapterCleanupSpy = jest.spyOn(adapter, 'cleanup');
      
      await service.cleanup();
      
      expect(service.detectionInterval).toBeNull();
      expect(service.currentAdapter).toBeNull();
      expect(service.detectionCallbacks).toEqual([]);
      expect(service.currentPlatform).toBe(MeetingPlatform.UNKNOWN);
      expect(adapterCleanupSpy).toHaveBeenCalled();
    });
  });
});

describe('Singleton Instance', () => {
  test('should export singleton instance', () => {
    expect(platformDetectionService).toBeInstanceOf(PlatformDetectionService);
  });

  test('should maintain state across imports', () => {
    platformDetectionService.registerAdapter('test', MockTeamsAdapter);
    expect(platformDetectionService.isPlatformSupported('test')).toBe(true);
  });
});