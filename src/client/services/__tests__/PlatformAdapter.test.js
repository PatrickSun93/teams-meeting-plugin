/**
 * Platform Adapter Tests
 * Tests for the base PlatformAdapter class and related functionality
 */

import { 
  PlatformAdapter, 
  MeetingPlatform, 
  PlatformCapabilities, 
  AudioQuality, 
  MeetingInfo, 
  ParticipantInfo,
  PlatformEvents 
} from '../PlatformAdapter.js';

// Mock window object for testing
const mockWindow = {
  location: {
    hostname: 'example.com',
    href: 'https://example.com/meeting'
  },
  navigator: {
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
  }
};

// Mock implementation for testing
class MockPlatformAdapter extends PlatformAdapter {
  constructor() {
    super();
    this.platform = MeetingPlatform.TEAMS;
  }

  async initialize() {
    this.initialized = true;
    return true;
  }

  async getMeetingInfo() {
    return new MeetingInfo({
      id: 'test-meeting',
      title: 'Test Meeting',
      platform: this.platform
    });
  }

  async getAudioStream() {
    return new MediaStream();
  }

  async getParticipants() {
    return [new ParticipantInfo({ id: 'user1', name: 'Test User' })];
  }

  async sendMessageToChat(message) {
    return true;
  }

  async getMeetingAgenda() {
    return { items: [] };
  }

  async isHost() {
    return true;
  }

  getCapabilities() {
    return {
      [PlatformCapabilities.CHAT_INTEGRATION]: true,
      [PlatformCapabilities.AUDIO_QUALITY]: AudioQuality.HIGH
    };
  }
}

describe('PlatformAdapter', () => {
  let adapter;

  beforeEach(() => {
    // Setup global mocks
    global.window = mockWindow;
    adapter = new MockPlatformAdapter();
  });

  afterEach(() => {
    delete global.window;
  });

  describe('Base Class', () => {
    test('should not allow direct instantiation', () => {
      expect(() => new PlatformAdapter()).toThrow('PlatformAdapter is an abstract class');
    });

    test('should initialize with default values', () => {
      expect(adapter.platform).toBe(MeetingPlatform.TEAMS);
      expect(adapter.initialized).toBe(false);
      expect(adapter.meetingActive).toBe(false);
      expect(adapter.eventListeners).toBeInstanceOf(Map);
    });
  });

  describe('Platform Detection', () => {
    test('should detect Teams platform', () => {
      global.window.location.hostname = 'teams.microsoft.com';
      expect(PlatformAdapter.detectPlatform()).toBe(MeetingPlatform.TEAMS);
    });

    test('should detect Zoom platform', () => {
      global.window.location.hostname = 'zoom.us';
      expect(PlatformAdapter.detectPlatform()).toBe(MeetingPlatform.ZOOM);
    });

    test('should detect Google Meet platform', () => {
      global.window.location.hostname = 'meet.google.com';
      expect(PlatformAdapter.detectPlatform()).toBe(MeetingPlatform.GOOGLE_MEET);
    });

    test('should detect Webex platform', () => {
      global.window.location.hostname = 'webex.com';
      expect(PlatformAdapter.detectPlatform()).toBe(MeetingPlatform.WEBEX);
    });

    test('should return unknown for unrecognized platforms', () => {
      global.window.location.hostname = 'unknown-platform.com';
      expect(PlatformAdapter.detectPlatform()).toBe(MeetingPlatform.UNKNOWN);
    });

    test('should handle missing window object', () => {
      delete global.window;
      expect(PlatformAdapter.detectPlatform()).toBe(MeetingPlatform.UNKNOWN);
    });
  });

  describe('Initialization', () => {
    test('should initialize successfully', async () => {
      const result = await adapter.initialize();
      expect(result).toBe(true);
      expect(adapter.isInitialized()).toBe(true);
    });

    test('should track initialization state', () => {
      expect(adapter.isInitialized()).toBe(false);
      adapter.initialized = true;
      expect(adapter.isInitialized()).toBe(true);
    });
  });

  describe('Meeting Information', () => {
    beforeEach(async () => {
      await adapter.initialize();
    });

    test('should get meeting info', async () => {
      const meetingInfo = await adapter.getMeetingInfo();
      expect(meetingInfo).toBeInstanceOf(MeetingInfo);
      expect(meetingInfo.id).toBe('test-meeting');
      expect(meetingInfo.title).toBe('Test Meeting');
      expect(meetingInfo.platform).toBe(MeetingPlatform.TEAMS);
    });

    test('should get participants', async () => {
      const participants = await adapter.getParticipants();
      expect(Array.isArray(participants)).toBe(true);
      expect(participants[0]).toBeInstanceOf(ParticipantInfo);
      expect(participants[0].id).toBe('user1');
    });

    test('should check host status', async () => {
      const isHost = await adapter.isHost();
      expect(isHost).toBe(true);
    });
  });

  describe('Audio Stream', () => {
    beforeEach(async () => {
      await adapter.initialize();
    });

    test('should get audio stream', async () => {
      const stream = await adapter.getAudioStream();
      expect(stream).toBeInstanceOf(MediaStream);
    });
  });

  describe('Chat Integration', () => {
    beforeEach(async () => {
      await adapter.initialize();
    });

    test('should send message to chat', async () => {
      const result = await adapter.sendMessageToChat('Test message');
      expect(result).toBe(true);
    });
  });

  describe('Meeting Agenda', () => {
    beforeEach(async () => {
      await adapter.initialize();
    });

    test('should get meeting agenda', async () => {
      const agenda = await adapter.getMeetingAgenda();
      expect(agenda).toEqual({ items: [] });
    });
  });

  describe('Platform Capabilities', () => {
    test('should get platform capabilities', () => {
      const capabilities = adapter.getCapabilities();
      expect(capabilities).toHaveProperty(PlatformCapabilities.CHAT_INTEGRATION);
      expect(capabilities).toHaveProperty(PlatformCapabilities.AUDIO_QUALITY);
      expect(capabilities[PlatformCapabilities.CHAT_INTEGRATION]).toBe(true);
      expect(capabilities[PlatformCapabilities.AUDIO_QUALITY]).toBe(AudioQuality.HIGH);
    });
  });

  describe('Event Handling', () => {
    test('should add event listeners', () => {
      const callback = jest.fn();
      adapter.addEventListener('test-event', callback);
      
      expect(adapter.eventListeners.has('test-event')).toBe(true);
      expect(adapter.eventListeners.get('test-event')).toContain(callback);
    });

    test('should remove event listeners', () => {
      const callback = jest.fn();
      adapter.addEventListener('test-event', callback);
      adapter.removeEventListener('test-event', callback);
      
      const listeners = adapter.eventListeners.get('test-event');
      expect(listeners).not.toContain(callback);
    });

    test('should emit events to listeners', () => {
      const callback = jest.fn();
      adapter.addEventListener('test-event', callback);
      
      adapter._emitEvent('test-event', { data: 'test' });
      
      expect(callback).toHaveBeenCalledWith({ data: 'test' });
    });

    test('should handle errors in event listeners', () => {
      const errorCallback = jest.fn(() => {
        throw new Error('Test error');
      });
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      
      adapter.addEventListener('test-event', errorCallback);
      adapter._emitEvent('test-event', {});
      
      expect(consoleErrorSpy).toHaveBeenCalled();
      consoleErrorSpy.mockRestore();
    });
  });

  describe('Meeting State', () => {
    test('should track meeting active state', () => {
      expect(adapter.isMeetingActive()).toBe(false);
      
      adapter.meetingActive = true;
      expect(adapter.isMeetingActive()).toBe(true);
    });

    test('should get platform identifier', () => {
      expect(adapter.getPlatform()).toBe(MeetingPlatform.TEAMS);
    });
  });

  describe('Cleanup', () => {
    test('should cleanup resources', async () => {
      const callback = jest.fn();
      adapter.addEventListener('test-event', callback);
      adapter.initialized = true;
      adapter.meetingActive = true;
      
      await adapter.cleanup();
      
      expect(adapter.eventListeners.size).toBe(0);
      expect(adapter.initialized).toBe(false);
      expect(adapter.meetingActive).toBe(false);
    });
  });
});

describe('MeetingInfo', () => {
  test('should create with default values', () => {
    const meetingInfo = new MeetingInfo();
    
    expect(meetingInfo.id).toBeNull();
    expect(meetingInfo.title).toBe('');
    expect(meetingInfo.platform).toBe(MeetingPlatform.UNKNOWN);
    expect(meetingInfo.participants).toEqual([]);
    expect(meetingInfo.agenda).toBeNull();
    expect(meetingInfo.isHost).toBe(false);
  });

  test('should create with provided values', () => {
    const meetingInfo = new MeetingInfo({
      id: 'test-123',
      title: 'Test Meeting',
      platform: MeetingPlatform.TEAMS,
      isHost: true
    });
    
    expect(meetingInfo.id).toBe('test-123');
    expect(meetingInfo.title).toBe('Test Meeting');
    expect(meetingInfo.platform).toBe(MeetingPlatform.TEAMS);
    expect(meetingInfo.isHost).toBe(true);
  });
});

describe('ParticipantInfo', () => {
  test('should create with default values', () => {
    const participant = new ParticipantInfo();
    
    expect(participant.id).toBeNull();
    expect(participant.name).toBe('');
    expect(participant.email).toBe('');
    expect(participant.isHost).toBe(false);
    expect(participant.isMuted).toBe(false);
    expect(participant.isVideoOn).toBe(false);
    expect(participant.joinTime).toBeNull();
  });

  test('should create with provided values', () => {
    const joinTime = new Date();
    const participant = new ParticipantInfo({
      id: 'user-123',
      name: 'John Doe',
      email: 'john@example.com',
      isHost: true,
      isMuted: true,
      joinTime
    });
    
    expect(participant.id).toBe('user-123');
    expect(participant.name).toBe('John Doe');
    expect(participant.email).toBe('john@example.com');
    expect(participant.isHost).toBe(true);
    expect(participant.isMuted).toBe(true);
    expect(participant.joinTime).toBe(joinTime);
  });
});

describe('Constants', () => {
  test('should have correct MeetingPlatform values', () => {
    expect(MeetingPlatform.TEAMS).toBe('teams');
    expect(MeetingPlatform.ZOOM).toBe('zoom');
    expect(MeetingPlatform.GOOGLE_MEET).toBe('google_meet');
    expect(MeetingPlatform.WEBEX).toBe('webex');
    expect(MeetingPlatform.UNKNOWN).toBe('unknown');
  });

  test('should have correct PlatformCapabilities values', () => {
    expect(PlatformCapabilities.CHAT_INTEGRATION).toBe('chatIntegration');
    expect(PlatformCapabilities.AGENDA_ACCESS).toBe('agendaAccess');
    expect(PlatformCapabilities.PARTICIPANT_INFO).toBe('participantInfo');
    expect(PlatformCapabilities.HOST_DETECTION).toBe('hostDetection');
    expect(PlatformCapabilities.AUDIO_QUALITY).toBe('audioQuality');
  });

  test('should have correct AudioQuality values', () => {
    expect(AudioQuality.HIGH).toBe('high');
    expect(AudioQuality.MEDIUM).toBe('medium');
    expect(AudioQuality.LOW).toBe('low');
  });

  test('should have correct PlatformEvents values', () => {
    expect(PlatformEvents.MEETING_STARTED).toBe('meetingStarted');
    expect(PlatformEvents.MEETING_ENDED).toBe('meetingEnded');
    expect(PlatformEvents.PARTICIPANT_JOINED).toBe('participantJoined');
    expect(PlatformEvents.PARTICIPANT_LEFT).toBe('participantLeft');
  });
});