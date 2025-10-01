/**
 * Generic Adapter Tests
 * Tests for the GenericAdapter class
 */

import { GenericAdapter } from '../GenericAdapter.js';
import { MeetingPlatform, PlatformCapabilities, AudioQuality } from '../PlatformAdapter.js';

// Mock MediaStream
class MockMediaStream {
  constructor() {
    this.tracks = [];
  }
  
  getTracks() {
    return this.tracks;
  }
}

describe('GenericAdapter', () => {
  let adapter;
  let mockWindow;

  beforeEach(() => {
    mockWindow = {
      location: {
        href: 'https://example.com/meeting'
      }
    };
    global.window = mockWindow;
    global.document = {
      title: 'Meeting - Example Platform'
    };
    global.navigator = {
      mediaDevices: {
        getUserMedia: jest.fn().mockResolvedValue(new MockMediaStream())
      }
    };

    adapter = new GenericAdapter();
    jest.clearAllMocks();
  });

  afterEach(() => {
    delete global.window;
    delete global.document;
    delete global.navigator;
  });

  describe('Initialization', () => {
    test('should initialize successfully', async () => {
      const result = await adapter.initialize();

      expect(result).toBe(true);
      expect(adapter.isInitialized()).toBe(true);
      expect(adapter.getPlatform()).toBe(MeetingPlatform.UNKNOWN);
    });

    test('should detect platform during initialization', async () => {
      global.window.location.href = 'https://teams.microsoft.com/meeting';
      
      await adapter.initialize();

      expect(adapter.detectedPlatform).toBe(MeetingPlatform.TEAMS);
    });

    test('should fail initialization without navigator', async () => {
      delete global.navigator;

      const result = await adapter.initialize();

      expect(result).toBe(false);
      expect(adapter.isInitialized()).toBe(false);
    });

    test('should continue initialization even without microphone access', async () => {
      global.navigator.mediaDevices.getUserMedia.mockRejectedValue(new Error('Permission denied'));

      const result = await adapter.initialize();

      expect(result).toBe(true);
      expect(adapter.isInitialized()).toBe(true);
    });

    test('should detect meeting state on initialization', async () => {
      global.window.location.href = 'https://example.com/meeting-room';
      global.document.title = 'Conference Call';

      await adapter.initialize();

      expect(adapter.isMeetingActive()).toBe(true);
    });
  });

  describe('Meeting Information', () => {
    beforeEach(async () => {
      await adapter.initialize();
    });

    test('should get meeting info', async () => {
      const meetingInfo = await adapter.getMeetingInfo();

      expect(meetingInfo.platform).toBe(MeetingPlatform.UNKNOWN);
      expect(meetingInfo.title).toBe('Meeting');
      expect(meetingInfo.meetingUrl).toBe('https://example.com/meeting');
      expect(meetingInfo.agenda).toBeNull();
      expect(meetingInfo.isHost).toBe(false);
    });

    test('should generate meeting ID from URL', async () => {
      const meetingInfo = await adapter.getMeetingInfo();

      expect(meetingInfo.id).toMatch(/^generic-.*-\d+$/);
    });

    test('should extract meeting title from document title', async () => {
      global.document.title = 'Weekly Team Meeting - Microsoft Teams';

      const meetingInfo = await adapter.getMeetingInfo();

      expect(meetingInfo.title).toBe('Weekly Team Meeting');
    });

    test('should clean up meeting title patterns', async () => {
      global.document.title = 'Meeting - Important Discussion - Zoom';

      const meetingInfo = await adapter.getMeetingInfo();

      expect(meetingInfo.title).toBe('Meeting - Important Discussion');
    });

    test('should throw error if not initialized', async () => {
      adapter.initialized = false;

      await expect(adapter.getMeetingInfo()).rejects.toThrow('Generic adapter not initialized');
    });
  });

  describe('Audio Stream', () => {
    beforeEach(async () => {
      await adapter.initialize();
    });

    test('should get audio stream using WebRTC', async () => {
      const mockStream = new MockMediaStream();
      global.navigator.mediaDevices.getUserMedia.mockResolvedValue(mockStream);

      const stream = await adapter.getAudioStream();

      expect(stream).toBe(mockStream);
      expect(global.navigator.mediaDevices.getUserMedia).toHaveBeenCalledWith({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 16000
        }
      });
    });

    test('should throw error if not initialized', async () => {
      adapter.initialized = false;

      await expect(adapter.getAudioStream()).rejects.toThrow('Generic adapter not initialized');
    });

    test('should handle getUserMedia errors', async () => {
      global.navigator.mediaDevices.getUserMedia.mockRejectedValue(new Error('Permission denied'));

      await expect(adapter.getAudioStream()).rejects.toThrow('Permission denied');
    });
  });

  describe('Participants', () => {
    beforeEach(async () => {
      await adapter.initialize();
    });

    test('should return empty participants array by default', async () => {
      const participants = await adapter.getParticipants();

      expect(participants).toEqual([]);
    });

    test('should include current user if extractable', async () => {
      // Mock user info extraction
      adapter._extractUserInfo = jest.fn().mockReturnValue({
        name: 'John Doe',
        email: 'john@example.com'
      });

      const participants = await adapter.getParticipants();

      expect(participants).toHaveLength(1);
      expect(participants[0].id).toBe('current-user');
      expect(participants[0].name).toBe('John Doe');
      expect(participants[0].email).toBe('john@example.com');
      expect(participants[0].isHost).toBe(false);
    });

    test('should handle errors in user info extraction', async () => {
      adapter._extractUserInfo = jest.fn().mockImplementation(() => {
        throw new Error('Extraction error');
      });

      const participants = await adapter.getParticipants();

      expect(participants).toEqual([]);
    });
  });

  describe('Chat Integration', () => {
    test('should not support chat integration', async () => {
      const result = await adapter.sendMessageToChat('Test message');
      expect(result).toBe(false);
    });
  });

  describe('Meeting Agenda', () => {
    test('should not support agenda access', async () => {
      const agenda = await adapter.getMeetingAgenda();
      expect(agenda).toBeNull();
    });
  });

  describe('Host Detection', () => {
    test('should not support host detection', async () => {
      const isHost = await adapter.isHost();
      expect(isHost).toBe(false);
    });
  });

  describe('Platform Capabilities', () => {
    test('should return limited capabilities', () => {
      const capabilities = adapter.getCapabilities();

      expect(capabilities[PlatformCapabilities.CHAT_INTEGRATION]).toBe(false);
      expect(capabilities[PlatformCapabilities.AGENDA_ACCESS]).toBe(false);
      expect(capabilities[PlatformCapabilities.PARTICIPANT_INFO]).toBe(false);
      expect(capabilities[PlatformCapabilities.HOST_DETECTION]).toBe(false);
      expect(capabilities[PlatformCapabilities.AUDIO_QUALITY]).toBe(AudioQuality.MEDIUM);
      expect(capabilities[PlatformCapabilities.MEETING_EVENTS]).toBe(false);
      expect(capabilities[PlatformCapabilities.RECORDING_ACCESS]).toBe(false);
    });
  });

  describe('Meeting State Detection', () => {
    test('should detect meeting from URL indicators', () => {
      global.window.location.href = 'https://example.com/meeting-room';
      
      const isActive = adapter._detectMeetingState();
      expect(isActive).toBe(true);
    });

    test('should detect meeting from title indicators', () => {
      global.document.title = 'Conference Call - Important';
      
      const isActive = adapter._detectMeetingState();
      expect(isActive).toBe(true);
    });

    test('should detect meeting from platform URLs', () => {
      global.window.location.href = 'https://teams.microsoft.com/l/meetup-join/';
      
      const isActive = adapter._detectMeetingState();
      expect(isActive).toBe(true);
    });

    test('should not detect meeting without indicators', () => {
      global.window.location.href = 'https://example.com/home';
      global.document.title = 'Home Page';
      
      const isActive = adapter._detectMeetingState();
      expect(isActive).toBe(false);
    });
  });

  describe('Meeting State Monitoring', () => {
    beforeEach(async () => {
      jest.useFakeTimers();
      await adapter.initialize();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    test('should monitor URL changes', () => {
      const eventSpy = jest.spyOn(adapter, '_emitEvent');
      
      // Change URL to indicate meeting
      global.window.location.href = 'https://example.com/meeting-room';
      
      jest.advanceTimersByTime(3000);
      
      expect(eventSpy).toHaveBeenCalledWith('meetingStarted', expect.any(Object));
    });

    test('should monitor title changes', () => {
      const eventSpy = jest.spyOn(adapter, '_emitEvent');
      
      // Change title to indicate meeting
      global.document.title = 'Conference Call';
      
      jest.advanceTimersByTime(3000);
      
      expect(eventSpy).toHaveBeenCalledWith('meetingStarted', expect.any(Object));
    });

    test('should emit meeting ended event', () => {
      const eventSpy = jest.spyOn(adapter, '_emitEvent');
      
      // Start with meeting active
      adapter.meetingActive = true;
      global.window.location.href = 'https://example.com/home';
      global.document.title = 'Home Page';
      
      jest.advanceTimersByTime(3000);
      
      expect(eventSpy).toHaveBeenCalledWith('meetingEnded', expect.any(Object));
    });
  });

  describe('Meeting ID Generation', () => {
    test('should generate unique meeting ID', () => {
      const id1 = adapter._generateMeetingId();
      const id2 = adapter._generateMeetingId();
      
      expect(id1).toMatch(/^generic-.*-\d+$/);
      expect(id2).toMatch(/^generic-.*-\d+$/);
      expect(id1).not.toBe(id2);
    });
  });

  describe('Title Extraction', () => {
    test('should extract clean meeting title', () => {
      global.document.title = 'Weekly Standup - Microsoft Teams';
      
      const title = adapter._extractMeetingTitle();
      expect(title).toBe('Weekly Standup');
    });

    test('should remove meeting prefixes', () => {
      global.document.title = 'Meeting - Project Discussion';
      
      const title = adapter._extractMeetingTitle();
      expect(title).toBe('Project Discussion');
    });

    test('should handle empty title', () => {
      global.document.title = '';
      
      const title = adapter._extractMeetingTitle();
      expect(title).toBe('Meeting');
    });

    test('should handle title with only platform name', () => {
      global.document.title = 'Zoom';
      
      const title = adapter._extractMeetingTitle();
      expect(title).toBe('Meeting');
    });
  });

  describe('User Info Extraction', () => {
    test('should return null by default', () => {
      const userInfo = adapter._extractUserInfo();
      expect(userInfo).toBeNull();
    });
  });

  describe('Cleanup', () => {
    beforeEach(async () => {
      await adapter.initialize();
    });

    test('should cleanup resources', async () => {
      const mockStream = new MockMediaStream();
      const mockTrack = { stop: jest.fn() };
      mockStream.tracks = [mockTrack];
      adapter.audioStream = mockStream;

      await adapter.cleanup();

      expect(mockTrack.stop).toHaveBeenCalled();
      expect(adapter.audioStream).toBeNull();
      expect(adapter.meetingInfo).toBeNull();
      expect(adapter.isInitialized()).toBe(false);
    });

    test('should handle cleanup without audio stream', async () => {
      await expect(adapter.cleanup()).resolves.not.toThrow();
    });
  });
});