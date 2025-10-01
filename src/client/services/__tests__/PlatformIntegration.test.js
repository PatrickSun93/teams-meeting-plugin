/**
 * Platform Integration Tests
 * Tests the integration between platform detection and adapters
 */

import { PlatformDetectionService } from '../PlatformDetectionService.js';
import { TeamsAdapter } from '../TeamsAdapter.js';
import { GenericAdapter } from '../GenericAdapter.js';
import { MeetingPlatform } from '../PlatformAdapter.js';

// Mock MediaStream
class MockMediaStream {
  constructor() {
    this.tracks = [];
  }
  getTracks() {
    return this.tracks;
  }
}

describe('Platform Integration', () => {
  let service;

  beforeEach(() => {
    // Setup clean environment
    global.window = {
      location: {
        hostname: 'teams.microsoft.com',
        href: 'https://teams.microsoft.com/meeting'
      }
    };
    global.navigator = {
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      mediaDevices: {
        getUserMedia: jest.fn().mockResolvedValue(new MockMediaStream())
      }
    };
    global.MediaStream = MockMediaStream;

    service = new PlatformDetectionService();
    service.registerAdapter(MeetingPlatform.TEAMS, TeamsAdapter);
    service.registerAdapter(MeetingPlatform.UNKNOWN, GenericAdapter);
  });

  afterEach(async () => {
    if (service && service.cleanup) {
      await service.cleanup();
    }
    delete global.window;
    delete global.navigator;
    delete global.MediaStream;
  });

  test('should detect Teams platform and create appropriate adapter', () => {
    const platform = service.getCurrentPlatform();
    expect(platform).toBe(MeetingPlatform.TEAMS);
  });

  test('should detect unknown platform for unsupported sites', () => {
    // Create new window object for unknown platform
    global.window = {
      location: {
        hostname: 'example.com',
        href: 'https://example.com/meeting'
      }
    };
    
    const platform = service.getCurrentPlatform();
    expect(platform).toBe(MeetingPlatform.UNKNOWN);
  });

  test('should handle platform changes', async () => {
    // Start with Teams
    let platform = service.getCurrentPlatform();
    expect(platform).toBe(MeetingPlatform.TEAMS);

    // Change to unknown platform
    global.window = {
      location: {
        hostname: 'example.com',
        href: 'https://example.com/meeting'
      }
    };
    platform = service.getCurrentPlatform();
    expect(platform).toBe(MeetingPlatform.UNKNOWN);
  });

  test('should return supported platforms list', () => {
    const supported = service.getSupportedPlatforms();
    expect(supported).toContain(MeetingPlatform.TEAMS);
    expect(supported).toContain(MeetingPlatform.UNKNOWN);
  });

  test('should check platform support correctly', () => {
    expect(service.isPlatformSupported(MeetingPlatform.TEAMS)).toBe(true);
    expect(service.isPlatformSupported(MeetingPlatform.UNKNOWN)).toBe(true);
    expect(service.isPlatformSupported('unsupported')).toBe(false);
  });
});