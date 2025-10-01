/**
 * ZoomAdapter Integration Tests
 * Tests Zoom Web SDK integration functionality
 */

import { ZoomAdapter, ZoomErrorTypes, ZoomMeetingState } from '../ZoomAdapter.js';
import { 
  MeetingPlatform, 
  PlatformEvents, 
  AudioQuality 
} from '../PlatformAdapter.js';

// Mock Zoom Web SDK
const mockZoomMtg = {
  setZoomJSLib: jest.fn(),
  preLoadWasm: jest.fn(),
  prepareWebSDK: jest.fn(),
  init: jest.fn(),
  join: jest.fn(),
  leave: jest.fn(),
  sendChat: jest.fn(),
  getCurrentMeetingInfo: jest.fn(),
  getCurrentUser: jest.fn(),
  getAttendeeslist: jest.fn(),
  inMeetingServiceListener: jest.fn()
};

// Mock navigator.mediaDevices
const mockGetUserMedia = jest.fn();
Object.defineProperty(navigator, 'mediaDevices', {
  value: {
    getUserMedia: mockGetUserMedia
  },
  writable: true
});

describe('ZoomAdapter', () => {
  let zoomAdapter;
  let mockAudioStream;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Setup global Zoom SDK mock
    global.window = {
      ZoomMtg: mockZoomMtg,
      location: {
        origin: 'https://test.com',
        href: 'https://zoom.us/j/123456789'
      }
    };

    // Mock audio stream
    mockAudioStream = {
      getTracks: jest.fn(() => [
        { stop: jest.fn() }
      ])
    };
    mockGetUserMedia.mockResolvedValue(mockAudioStream);

    zoomAdapter = new ZoomAdapter();
  });

  afterEach(async () => {
    if (zoomAdapter) {
      try {
        await zoomAdapter.cleanup();
      } catch (error) {
        // Ignore cleanup errors in tests
      }
    }
  }, 10000);

  describe('Constructor', () => {
    test('should initialize with correct platform and default state', () => {
      expect(zoomAdapter.platform).toBe(MeetingPlatform.ZOOM);
      expect(zoomAdapter.initialized).toBe(false);
      expect(zoomAdapter.meetingActive).toBe(false);
      expect(zoomAdapter.meetingState).toBe(ZoomMeetingState.NOT_STARTED);
      expect(zoomAdapter.isHostUser).toBe(false);
      expect(zoomAdapter.chatEnabled).toBe(false);
    });

    test('should have default SDK configuration', () => {
      expect(zoomAdapter.sdkConfig).toEqual({
        debug: false,
        leaveUrl: 'https://test.com',
        showMeetingTime: true,
        disableInvite: false,
        disableCallOut: false,
        disableRecord: false,
        disableJoinAudio: false,
        audioPanelAlwaysOpen: true,
        showPureSharingContent: false,
        enableLoggerSync: false,
        enableLogDirSuffixTimestamp: true,
        logLevel: 'info'
      });
    });
  });

  describe('initialize()', () => {
    test('should initialize Zoom SDK successfully', async () => {
      mockZoomMtg.init.mockImplementation(({ success }) => {
        setTimeout(success, 0);
      });

      const result = await zoomAdapter.initialize();

      expect(result).toBe(true);
      expect(zoomAdapter.initialized).toBe(true);
      expect(mockZoomMtg.setZoomJSLib).toHaveBeenCalledWith(
        'https://source.zoom.us/2.18.0/lib',
        '/av'
      );
      expect(mockZoomMtg.preLoadWasm).toHaveBeenCalled();
      expect(mockZoomMtg.prepareWebSDK).toHaveBeenCalled();
      expect(mockZoomMtg.init).toHaveBeenCalledWith(
        expect.objectContaining(zoomAdapter.sdkConfig)
      );
    });

    test('should throw error if Zoom SDK not available', async () => {
      delete global.window.ZoomMtg;

      await expect(zoomAdapter.initialize()).rejects.toThrow(
        'Zoom Web SDK not loaded. Please include the Zoom Web SDK script.'
      );
    });

    test('should handle SDK initialization failure', async () => {
      const errorMessage = 'SDK initialization failed';
      mockZoomMtg.init.mockImplementation(({ error }) => {
        setTimeout(() => error({ reason: errorMessage }), 0);
      });

      await expect(zoomAdapter.initialize()).rejects.toThrow(
        `Zoom SDK initialization failed: ${errorMessage}`
      );
      expect(zoomAdapter.initialized).toBe(false);
    });

    test('should set up event listeners after initialization', async () => {
      mockZoomMtg.init.mockImplementation(({ success }) => {
        setTimeout(success, 0);
      });

      await zoomAdapter.initialize();

      expect(mockZoomMtg.inMeetingServiceListener).toHaveBeenCalledWith(
        'onMeetingStatus',
        expect.any(Function)
      );
      expect(mockZoomMtg.inMeetingServiceListener).toHaveBeenCalledWith(
        'onUserJoin',
        expect.any(Function)
      );
      expect(mockZoomMtg.inMeetingServiceListener).toHaveBeenCalledWith(
        'onUserLeave',
        expect.any(Function)
      );
    });
  });

  describe('getMeetingInfo()', () => {
    beforeEach(async () => {
      mockZoomMtg.init.mockImplementation(({ success }) => success());
      await zoomAdapter.initialize();
      zoomAdapter.meetingState = ZoomMeetingState.CONNECTED;
    });

    test('should return meeting information successfully', async () => {
      const mockMeetingInfo = {
        meetingId: '123456789',
        meetingTopic: 'Test Meeting',
        startTime: Date.now(),
        meetingUrl: 'https://zoom.us/j/123456789'
      };
      mockZoomMtg.getCurrentMeetingInfo.mockReturnValue(mockMeetingInfo);

      const meetingInfo = await zoomAdapter.getMeetingInfo();

      expect(meetingInfo.id).toBe('123456789');
      expect(meetingInfo.title).toBe('Test Meeting');
      expect(meetingInfo.platform).toBe(MeetingPlatform.ZOOM);
      expect(meetingInfo.isHost).toBe(false);
      expect(meetingInfo.agenda).toBeNull();
    });

    test('should throw error if not initialized', async () => {
      zoomAdapter.initialized = false;

      await expect(zoomAdapter.getMeetingInfo()).rejects.toThrow(
        'ZoomAdapter not initialized'
      );
    });

    test('should handle missing meeting info gracefully', async () => {
      mockZoomMtg.getCurrentMeetingInfo.mockReturnValue(null);

      const meetingInfo = await zoomAdapter.getMeetingInfo();

      expect(meetingInfo.title).toBe('Zoom Meeting');
      expect(meetingInfo.platform).toBe(MeetingPlatform.ZOOM);
    });
  });

  describe('getAudioStream()', () => {
    beforeEach(async () => {
      mockZoomMtg.init.mockImplementation(({ success }) => success());
      await zoomAdapter.initialize();
      zoomAdapter.meetingState = ZoomMeetingState.CONNECTED;
    });

    test('should get audio stream successfully', async () => {
      const audioStream = await zoomAdapter.getAudioStream();

      expect(audioStream).toBe(mockAudioStream);
      expect(mockGetUserMedia).toHaveBeenCalledWith({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 44100,
          channelCount: 1
        }
      });
    });

    test('should reuse existing audio stream', async () => {
      await zoomAdapter.getAudioStream();
      const audioStream2 = await zoomAdapter.getAudioStream();

      expect(audioStream2).toBe(mockAudioStream);
      expect(mockGetUserMedia).toHaveBeenCalledTimes(1);
    });

    test('should throw error if not initialized', async () => {
      zoomAdapter.initialized = false;

      await expect(zoomAdapter.getAudioStream()).rejects.toThrow(
        'ZoomAdapter not initialized'
      );
    });

    test('should throw error if not in meeting', async () => {
      zoomAdapter.meetingState = ZoomMeetingState.NOT_STARTED;

      await expect(zoomAdapter.getAudioStream()).rejects.toThrow(
        'Not connected to Zoom meeting'
      );
    });

    test('should handle audio access denied', async () => {
      const error = new Error('Permission denied');
      mockGetUserMedia.mockRejectedValue(error);

      await expect(zoomAdapter.getAudioStream()).rejects.toThrow(
        'Audio access denied: Permission denied'
      );
    });
  });

  describe('getParticipants()', () => {
    beforeEach(async () => {
      mockZoomMtg.init.mockImplementation(({ success }) => success());
      await zoomAdapter.initialize();
      zoomAdapter.meetingState = ZoomMeetingState.CONNECTED;
    });

    test('should return participants list', async () => {
      const mockParticipants = [
        {
          userId: 1,
          displayName: 'John Doe',
          email: 'john@example.com',
          isHost: true,
          muted: false,
          video: true
        },
        {
          userId: 2,
          displayName: 'Jane Smith',
          email: 'jane@example.com',
          isHost: false,
          muted: true,
          video: false
        }
      ];
      mockZoomMtg.getAttendeeslist.mockReturnValue(mockParticipants);

      const participants = await zoomAdapter.getParticipants();

      expect(participants).toHaveLength(2);
      expect(participants[0].name).toBe('John Doe');
      expect(participants[0].isHost).toBe(true);
      expect(participants[1].name).toBe('Jane Smith');
      expect(participants[1].isMuted).toBe(true);
    });

    test('should return empty array if not in meeting', async () => {
      zoomAdapter.meetingState = ZoomMeetingState.NOT_STARTED;

      const participants = await zoomAdapter.getParticipants();

      expect(participants).toEqual([]);
    });

    test('should handle API errors gracefully', async () => {
      mockZoomMtg.getAttendeeslist.mockImplementation(() => {
        throw new Error('API Error');
      });

      const participants = await zoomAdapter.getParticipants();

      expect(participants).toEqual([]);
    });
  });

  describe('sendMessageToChat()', () => {
    beforeEach(async () => {
      mockZoomMtg.init.mockImplementation(({ success }) => success());
      await zoomAdapter.initialize();
      zoomAdapter.meetingState = ZoomMeetingState.CONNECTED;
      zoomAdapter.chatEnabled = true;
    });

    test('should send message to chat successfully', async () => {
      mockZoomMtg.sendChat.mockImplementation(({ success }) => {
        setTimeout(success, 0);
      });

      const result = await zoomAdapter.sendMessageToChat('Test message');

      expect(result).toBe(true);
      expect(mockZoomMtg.sendChat).toHaveBeenCalledWith({
        text: 'Test message',
        type: 'everyone',
        success: expect.any(Function),
        error: expect.any(Function)
      });
    });

    test('should throw error if chat disabled', async () => {
      zoomAdapter.chatEnabled = false;

      await expect(zoomAdapter.sendMessageToChat('Test')).rejects.toThrow(
        'Chat is disabled in this meeting'
      );
    });

    test('should handle chat API errors', async () => {
      mockZoomMtg.sendChat.mockImplementation(({ error }) => {
        setTimeout(() => error({ reason: 'Chat failed' }), 0);
      });

      await expect(zoomAdapter.sendMessageToChat('Test')).rejects.toThrow(
        'Failed to send chat message: Chat failed'
      );
    });
  });

  describe('isHost()', () => {
    beforeEach(async () => {
      mockZoomMtg.init.mockImplementation(({ success }) => success());
      await zoomAdapter.initialize();
      zoomAdapter.meetingState = ZoomMeetingState.CONNECTED;
    });

    test('should return host status correctly', async () => {
      mockZoomMtg.getCurrentUser.mockReturnValue({ isHost: true });

      const isHost = await zoomAdapter.isHost();

      expect(isHost).toBe(true);
      expect(zoomAdapter.isHostUser).toBe(true);
    });

    test('should return false if not host', async () => {
      mockZoomMtg.getCurrentUser.mockReturnValue({ isHost: false });

      const isHost = await zoomAdapter.isHost();

      expect(isHost).toBe(false);
    });

    test('should return false if not in meeting', async () => {
      zoomAdapter.meetingState = ZoomMeetingState.NOT_STARTED;

      const isHost = await zoomAdapter.isHost();

      expect(isHost).toBe(false);
    });
  });

  describe('getCapabilities()', () => {
    test('should return correct capabilities', () => {
      const capabilities = zoomAdapter.getCapabilities();

      expect(capabilities).toEqual({
        chatIntegration: true,
        agendaAccess: false,
        participantInfo: true,
        hostDetection: true,
        audioQuality: AudioQuality.HIGH,
        meetingEvents: true,
        recordingAccess: false,
        realTimeTranscription: true,
        speakerIdentification: true,
        fileExport: true
      });
    });
  });

  describe('joinMeeting()', () => {
    beforeEach(async () => {
      mockZoomMtg.init.mockImplementation(({ success }) => success());
      await zoomAdapter.initialize();
    });

    test('should join meeting successfully', async () => {
      mockZoomMtg.join.mockImplementation(({ success }) => {
        setTimeout(() => success({ meetingId: '123456789' }), 0);
      });

      const meetingConfig = {
        meetingNumber: '123456789',
        password: 'password123',
        userName: 'Test User',
        signature: 'test-signature',
        apiKey: 'test-api-key'
      };

      const result = await zoomAdapter.joinMeeting(meetingConfig);

      expect(result).toBe(true);
      expect(zoomAdapter.meetingState).toBe(ZoomMeetingState.CONNECTED);
      expect(zoomAdapter.meetingActive).toBe(true);
    });

    test('should throw error for missing configuration', async () => {
      const incompleteConfig = {
        meetingNumber: '123456789'
        // Missing signature and apiKey
      };

      await expect(zoomAdapter.joinMeeting(incompleteConfig)).rejects.toThrow(
        'Missing required meeting configuration'
      );
    });

    test('should handle join meeting failure', async () => {
      mockZoomMtg.join.mockImplementation(({ error }) => {
        setTimeout(() => error({ reason: 'Invalid meeting number' }), 0);
      });

      const meetingConfig = {
        meetingNumber: '123456789',
        signature: 'test-signature',
        apiKey: 'test-api-key'
      };

      await expect(zoomAdapter.joinMeeting(meetingConfig)).rejects.toThrow(
        'Failed to join meeting: Invalid meeting number'
      );
    });
  });

  describe('Event Handling', () => {
    beforeEach(async () => {
      mockZoomMtg.init.mockImplementation(({ success }) => success());
      await zoomAdapter.initialize();
    });

    test('should handle meeting status changes', () => {
      const eventSpy = jest.fn();
      zoomAdapter.addEventListener(PlatformEvents.MEETING_STARTED, eventSpy);

      // Simulate meeting connected event
      const statusHandler = mockZoomMtg.inMeetingServiceListener.mock.calls
        .find(call => call[0] === 'onMeetingStatus')[1];
      
      statusHandler({ meetingStatus: 2 }); // Connected

      expect(zoomAdapter.meetingState).toBe(ZoomMeetingState.CONNECTED);
      expect(zoomAdapter.meetingActive).toBe(true);
      expect(eventSpy).toHaveBeenCalledWith({ platform: MeetingPlatform.ZOOM });
    });

    test('should handle participant join events', () => {
      const eventSpy = jest.fn();
      zoomAdapter.addEventListener(PlatformEvents.PARTICIPANT_JOINED, eventSpy);

      const joinHandler = mockZoomMtg.inMeetingServiceListener.mock.calls
        .find(call => call[0] === 'onUserJoin')[1];
      
      joinHandler({
        userId: 123,
        displayName: 'New User',
        email: 'user@example.com',
        isHost: false
      });

      expect(zoomAdapter.participants.has('123')).toBe(true);
      expect(eventSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          id: '123',
          name: 'New User',
          email: 'user@example.com'
        })
      );
    });

    test('should handle host change events', () => {
      const eventSpy = jest.fn();
      zoomAdapter.addEventListener(PlatformEvents.HOST_CHANGED, eventSpy);

      const hostHandler = mockZoomMtg.inMeetingServiceListener.mock.calls
        .find(call => call[0] === 'onHostChange')[1];
      
      hostHandler({ userId: 456, isHost: true });

      expect(zoomAdapter.isHostUser).toBe(true);
      expect(eventSpy).toHaveBeenCalledWith({
        newHostId: '456',
        isCurrentUserHost: true
      });
    });
  });

  describe('cleanup()', () => {
    beforeEach(async () => {
      mockZoomMtg.init.mockImplementation(({ success }) => success());
      mockZoomMtg.leave.mockImplementation(({ success }) => success());
      await zoomAdapter.initialize();
      zoomAdapter.meetingState = ZoomMeetingState.CONNECTED;
      zoomAdapter.audioStream = mockAudioStream;
    });

    test('should cleanup resources properly', async () => {
      // Set up audio stream first
      zoomAdapter.audioStream = mockAudioStream;
      
      await zoomAdapter.cleanup();

      expect(mockAudioStream.getTracks()[0].stop).toHaveBeenCalled();
      expect(zoomAdapter.audioStream).toBeNull();
      expect(zoomAdapter.meetingState).toBe(ZoomMeetingState.NOT_STARTED);
      expect(zoomAdapter.participants.size).toBe(0);
      expect(zoomAdapter.initialized).toBe(false);
    });

    test('should leave meeting during cleanup', async () => {
      await zoomAdapter.cleanup();

      expect(mockZoomMtg.leave).toHaveBeenCalled();
    });
  });

  describe('Edge Cases', () => {
    test('should handle missing Zoom SDK gracefully', async () => {
      delete global.window.ZoomMtg;
      
      await expect(zoomAdapter.initialize()).rejects.toThrow(
        'Zoom Web SDK not loaded'
      );
    });

    test('should handle null participant list', async () => {
      mockZoomMtg.init.mockImplementation(({ success }) => success());
      await zoomAdapter.initialize();
      zoomAdapter.meetingState = ZoomMeetingState.CONNECTED;
      
      mockZoomMtg.getAttendeeslist.mockReturnValue(null);

      const participants = await zoomAdapter.getParticipants();
      expect(participants).toEqual([]);
    });

    test('should handle agenda access limitation', async () => {
      mockZoomMtg.init.mockImplementation(({ success }) => success());
      await zoomAdapter.initialize();

      const agenda = await zoomAdapter.getMeetingAgenda();
      expect(agenda).toBeNull();
    });
  });
});