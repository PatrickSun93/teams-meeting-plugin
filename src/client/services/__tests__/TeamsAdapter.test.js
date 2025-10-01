/**
 * Teams Adapter Tests
 * Tests for the TeamsAdapter class
 */

import { TeamsAdapter } from '../TeamsAdapter.js';
import { MeetingPlatform, PlatformCapabilities, AudioQuality } from '../PlatformAdapter.js';

// Mock Microsoft Teams SDK
const mockTeamsSDK = {
  initialize: jest.fn(),
  getContext: jest.fn(),
  registerOnThemeChangeHandler: jest.fn(),
  media: {
    getAudioStream: jest.fn()
  },
  conversations: {
    sendMessage: jest.fn()
  }
};

// Mock Teams context
const mockTeamsContext = {
  meeting: {
    id: 'test-meeting-id'
  },
  chatId: 'test-chat-id',
  teamId: 'test-team-id',
  meetingId: 'test-meeting-id',
  userPrincipalName: 'test@example.com',
  userObjectId: 'user-123',
  userRole: 'organizer',
  frameContext: 'meetingStage'
};

// Mock MediaStream
class MockMediaStream {
  constructor() {
    this.tracks = [];
  }
  
  getTracks() {
    return this.tracks;
  }
}

describe('TeamsAdapter', () => {
  let adapter;
  let mockWindow;

  beforeEach(() => {
    // Setup window mock with Teams SDK
    mockWindow = {
      microsoftTeams: mockTeamsSDK,
      location: {
        href: 'https://teams.microsoft.com/meeting'
      }
    };
    global.window = mockWindow;
    global.navigator = {
      mediaDevices: {
        getUserMedia: jest.fn().mockResolvedValue(new MockMediaStream())
      }
    };

    adapter = new TeamsAdapter();

    // Reset mocks
    jest.clearAllMocks();
  });

  afterEach(() => {
    delete global.window;
    delete global.navigator;
  });

  describe('Initialization', () => {
    test('should initialize successfully with Teams SDK', async () => {
      mockTeamsSDK.initialize.mockImplementation((callback) => callback());
      mockTeamsSDK.getContext.mockImplementation((callback) => callback(mockTeamsContext));

      const result = await adapter.initialize();

      expect(result).toBe(true);
      expect(adapter.isInitialized()).toBe(true);
      expect(adapter.getPlatform()).toBe(MeetingPlatform.TEAMS);
      expect(adapter.teamsContext).toBe(mockTeamsContext);
      expect(mockTeamsSDK.initialize).toHaveBeenCalled();
      expect(mockTeamsSDK.getContext).toHaveBeenCalled();
    });

    test('should fail initialization without Teams SDK', async () => {
      delete mockWindow.microsoftTeams;

      const result = await adapter.initialize();

      expect(result).toBe(false);
      expect(adapter.isInitialized()).toBe(false);
    });

    test('should handle initialization timeout', async () => {
      jest.useFakeTimers();
      
      // Mock initialize to never call callback
      mockTeamsSDK.initialize.mockImplementation(() => {});

      const initPromise = adapter.initialize();
      
      // Fast-forward past timeout
      jest.advanceTimersByTime(11000);
      
      const result = await initPromise;
      
      expect(result).toBe(false);
      jest.useRealTimers();
    });

    test('should handle context retrieval timeout', async () => {
      jest.useFakeTimers();
      
      mockTeamsSDK.initialize.mockImplementation((callback) => callback());
      // Mock getContext to never call callback
      mockTeamsSDK.getContext.mockImplementation(() => {});

      const initPromise = adapter.initialize();
      
      // Fast-forward past timeout
      jest.advanceTimersByTime(6000);
      
      const result = await initPromise;
      
      expect(result).toBe(false);
      jest.useRealTimers();
    }, 10000);

    test('should setup event listeners on initialization', async () => {
      mockTeamsSDK.initialize.mockImplementation((callback) => callback());
      mockTeamsSDK.getContext.mockImplementation((callback) => callback(mockTeamsContext));

      await adapter.initialize();

      expect(mockTeamsSDK.registerOnThemeChangeHandler).toHaveBeenCalled();
    });
  });

  describe('Meeting Information', () => {
    beforeEach(async () => {
      mockTeamsSDK.initialize.mockImplementation((callback) => callback());
      mockTeamsSDK.getContext.mockImplementation((callback) => callback(mockTeamsContext));
      await adapter.initialize();
    });

    test('should get meeting info', async () => {
      const meetingInfo = await adapter.getMeetingInfo();

      expect(meetingInfo.id).toBe('test-meeting-id');
      expect(meetingInfo.platform).toBe(MeetingPlatform.TEAMS);
      expect(meetingInfo.isHost).toBe(true);
      expect(meetingInfo.meetingUrl).toBe('https://teams.microsoft.com/meeting');
    });

    test('should handle missing meeting details', async () => {
      adapter.teamsContext = { chatId: 'chat-123' };

      const meetingInfo = await adapter.getMeetingInfo();

      expect(meetingInfo.id).toBe('chat-123');
      expect(meetingInfo.title).toBe('Teams Meeting');
    });

    test('should throw error if not initialized', async () => {
      adapter.initialized = false;

      await expect(adapter.getMeetingInfo()).rejects.toThrow('Teams adapter not initialized');
    });
  });

  describe('Audio Stream', () => {
    beforeEach(async () => {
      mockTeamsSDK.initialize.mockImplementation((callback) => callback());
      mockTeamsSDK.getContext.mockImplementation((callback) => callback(mockTeamsContext));
      await adapter.initialize();
    });

    test('should get audio stream from Teams SDK', async () => {
      const mockStream = new MockMediaStream();
      mockTeamsSDK.media.getAudioStream.mockResolvedValue(mockStream);

      const stream = await adapter.getAudioStream();

      expect(stream).toBe(mockStream);
      expect(mockTeamsSDK.media.getAudioStream).toHaveBeenCalled();
    });

    test('should fallback to WebRTC if Teams media not available', async () => {
      delete mockTeamsSDK.media;
      const mockStream = new MockMediaStream();
      global.navigator.mediaDevices.getUserMedia.mockResolvedValue(mockStream);

      const stream = await adapter.getAudioStream();

      expect(stream).toBe(mockStream);
      expect(global.navigator.mediaDevices.getUserMedia).toHaveBeenCalledWith({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });
    });

    test('should throw error if not initialized', async () => {
      adapter.initialized = false;

      await expect(adapter.getAudioStream()).rejects.toThrow('Teams adapter not initialized');
    });
  });

  describe('Participants', () => {
    beforeEach(async () => {
      mockTeamsSDK.initialize.mockImplementation((callback) => callback());
      mockTeamsSDK.getContext.mockImplementation((callback) => callback(mockTeamsContext));
      await adapter.initialize();
    });

    test('should get participants with current user', async () => {
      const participants = await adapter.getParticipants();

      expect(participants).toHaveLength(1);
      expect(participants[0].id).toBe('user-123');
      expect(participants[0].name).toBe('test@example.com');
      expect(participants[0].email).toBe('test@example.com');
      expect(participants[0].isHost).toBe(true);
    });

    test('should return empty array if no user info', async () => {
      adapter.teamsContext = {};

      const participants = await adapter.getParticipants();

      expect(participants).toEqual([]);
    });
  });

  describe('Chat Integration', () => {
    beforeEach(async () => {
      mockTeamsSDK.initialize.mockImplementation((callback) => callback());
      mockTeamsSDK.getContext.mockImplementation((callback) => callback(mockTeamsContext));
      await adapter.initialize();
    });

    test('should send message to chat', async () => {
      mockTeamsSDK.conversations.sendMessage.mockResolvedValue();

      const result = await adapter.sendMessageToChat('Test message');

      expect(result).toBe(true);
      expect(mockTeamsSDK.conversations.sendMessage).toHaveBeenCalledWith({
        message: 'Test message',
        messageType: 'text'
      });
    });

    test('should handle missing chat API', async () => {
      delete mockTeamsSDK.conversations;

      const result = await adapter.sendMessageToChat('Test message');

      expect(result).toBe(false);
    });

    test('should handle chat API errors', async () => {
      mockTeamsSDK.conversations.sendMessage.mockRejectedValue(new Error('Chat error'));

      const result = await adapter.sendMessageToChat('Test message');

      expect(result).toBe(false);
    });

    test('should return false if not initialized', async () => {
      adapter.initialized = false;

      const result = await adapter.sendMessageToChat('Test message');

      expect(result).toBe(false);
    });
  });

  describe('Meeting Agenda', () => {
    beforeEach(async () => {
      mockTeamsSDK.initialize.mockImplementation((callback) => callback());
      mockTeamsSDK.getContext.mockImplementation((callback) => callback(mockTeamsContext));
      await adapter.initialize();
    });

    test('should return null for agenda (not implemented)', async () => {
      const agenda = await adapter.getMeetingAgenda();
      expect(agenda).toBeNull();
    });
  });

  describe('Host Detection', () => {
    beforeEach(async () => {
      mockTeamsSDK.initialize.mockImplementation((callback) => callback());
      mockTeamsSDK.getContext.mockImplementation((callback) => callback(mockTeamsContext));
      await adapter.initialize();
    });

    test('should detect organizer as host', async () => {
      const isHost = await adapter.isHost();
      expect(isHost).toBe(true);
    });

    test('should detect presenter as host', async () => {
      adapter.teamsContext.userRole = 'presenter';

      const isHost = await adapter.isHost();
      expect(isHost).toBe(true);
    });

    test('should not detect attendee as host', async () => {
      adapter.teamsContext.userRole = 'attendee';

      const isHost = await adapter.isHost();
      expect(isHost).toBe(false);
    });

    test('should return false if not initialized', async () => {
      adapter.initialized = false;

      const isHost = await adapter.isHost();
      expect(isHost).toBe(false);
    });
  });

  describe('Platform Capabilities', () => {
    test('should return correct capabilities', () => {
      const capabilities = adapter.getCapabilities();

      expect(capabilities[PlatformCapabilities.CHAT_INTEGRATION]).toBe(true);
      expect(capabilities[PlatformCapabilities.AGENDA_ACCESS]).toBe(false);
      expect(capabilities[PlatformCapabilities.PARTICIPANT_INFO]).toBe(true);
      expect(capabilities[PlatformCapabilities.HOST_DETECTION]).toBe(true);
      expect(capabilities[PlatformCapabilities.AUDIO_QUALITY]).toBe(AudioQuality.HIGH);
      expect(capabilities[PlatformCapabilities.MEETING_EVENTS]).toBe(true);
      expect(capabilities[PlatformCapabilities.RECORDING_ACCESS]).toBe(false);
    });
  });

  describe('Meeting State Monitoring', () => {
    beforeEach(async () => {
      jest.useFakeTimers();
      mockTeamsSDK.initialize.mockImplementation((callback) => callback());
      mockTeamsSDK.getContext.mockImplementation((callback) => callback(mockTeamsContext));
      await adapter.initialize();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    test('should detect meeting as active', () => {
      expect(adapter.isMeetingActive()).toBe(true);
    });

    test('should emit meeting started event', () => {
      const eventSpy = jest.spyOn(adapter, '_emitEvent');
      
      // Simulate meeting becoming active
      adapter.meetingActive = false;
      adapter.teamsContext = mockTeamsContext;
      
      jest.advanceTimersByTime(2000);
      
      expect(eventSpy).toHaveBeenCalledWith('meetingStarted', expect.any(Object));
    });

    test('should emit meeting ended event', () => {
      const eventSpy = jest.spyOn(adapter, '_emitEvent');
      
      // Simulate meeting ending
      adapter.meetingActive = true;
      adapter.teamsContext = {};
      
      jest.advanceTimersByTime(2000);
      
      expect(eventSpy).toHaveBeenCalledWith('meetingEnded', expect.any(Object));
    });
  });

  describe('Event Handling', () => {
    beforeEach(async () => {
      mockTeamsSDK.initialize.mockImplementation((callback) => callback());
      mockTeamsSDK.getContext.mockImplementation((callback) => callback(mockTeamsContext));
      await adapter.initialize();
    });

    test('should handle theme change events', () => {
      const themeHandler = mockTeamsSDK.registerOnThemeChangeHandler.mock.calls[0][0];
      const eventSpy = jest.spyOn(adapter, '_emitEvent');
      
      themeHandler('dark');
      
      expect(eventSpy).toHaveBeenCalledWith('themeChanged', { theme: 'dark' });
    });
  });

  describe('Cleanup', () => {
    beforeEach(async () => {
      mockTeamsSDK.initialize.mockImplementation((callback) => callback());
      mockTeamsSDK.getContext.mockImplementation((callback) => callback(mockTeamsContext));
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
      expect(adapter.teamsContext).toBeNull();
      expect(adapter.teamsSDK).toBeNull();
      expect(adapter.meetingInfo).toBeNull();
      expect(adapter.isInitialized()).toBe(false);
    });
  });
});