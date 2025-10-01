/**
 * Google Meet Adapter Tests
 * Tests for Google Meet platform integration
 */

import { MeetAdapter } from '../MeetAdapter.js';
import { 
  MeetingPlatform, 
  MeetingInfo, 
  ParticipantInfo, 
  PlatformEvents,
  AudioQuality 
} from '../PlatformAdapter.js';

// Mock Chrome extension APIs
const mockChrome = {
  runtime: {
    id: 'test-extension-id',
    sendMessage: jest.fn(),
    onMessage: {
      addListener: jest.fn()
    }
  }
};

// Mock DOM methods
const mockDocument = {
  querySelector: jest.fn(),
  querySelectorAll: jest.fn(),
  body: {
    appendChild: jest.fn(),
    removeChild: jest.fn()
  },
  createElement: jest.fn(),
  addEventListener: jest.fn(),
  readyState: 'complete'
};

// Mock MutationObserver
const mockMutationObserver = jest.fn().mockImplementation((callback) => ({
  observe: jest.fn(),
  disconnect: jest.fn(),
  takeRecords: jest.fn()
}));

// Mock window object
const mockWindow = {
  location: {
    href: 'https://meet.google.com/abc-defg-hij',
    hostname: 'meet.google.com'
  },
  addEventListener: jest.fn(),
  URL: {
    createObjectURL: jest.fn(() => 'blob:test-url'),
    revokeObjectURL: jest.fn()
  }
};

// Mock navigator
const mockNavigator = {
  mediaDevices: {
    getUserMedia: jest.fn()
  }
};

describe('MeetAdapter', () => {
  let adapter;
  let originalChrome, originalDocument, originalWindow, originalNavigator;

  beforeEach(() => {
    // Store original globals
    originalChrome = global.chrome;
    originalDocument = global.document;
    originalWindow = global.window;
    originalNavigator = global.navigator;

    // Set up mocks
    global.chrome = mockChrome;
    global.document = mockDocument;
    global.window = mockWindow;
    global.navigator = mockNavigator;
    global.MutationObserver = mockMutationObserver;
    global.Blob = jest.fn().mockImplementation((content, options) => {
      const blob = {
        type: options?.type || 'text/plain',
        size: content[0]?.length || 0
      };
      // Make it pass instanceof check
      Object.setPrototypeOf(blob, Blob.prototype);
      return blob;
    });
    
    global.URL = mockWindow.URL;

    // Reset mocks
    jest.clearAllMocks();
    
    adapter = new MeetAdapter();
  });

  afterEach(async () => {
    if (adapter) {
      await adapter.cleanup();
    }

    // Restore original globals
    global.chrome = originalChrome;
    global.document = originalDocument;
    global.window = originalWindow;
    global.navigator = originalNavigator;
  });

  describe('Constructor', () => {
    test('should initialize with correct platform', () => {
      expect(adapter.platform).toBe(MeetingPlatform.GOOGLE_MEET);
      expect(adapter.initialized).toBe(false);
      expect(adapter.meetingActive).toBe(false);
    });
  });

  describe('Extension Availability Check', () => {
    test('should detect extension availability when chrome APIs are present', () => {
      const isAvailable = adapter._checkExtensionAvailability();
      expect(isAvailable).toBe(true);
    });

    test('should detect no extension when chrome APIs are missing', () => {
      global.chrome = undefined;
      adapter = new MeetAdapter();
      
      const isAvailable = adapter._checkExtensionAvailability();
      expect(isAvailable).toBe(false);
    });
  });

  describe('Initialization', () => {
    test('should initialize successfully with extension', async () => {
      mockChrome.runtime.sendMessage.mockResolvedValue({
        success: true,
        meetingInfo: {
          id: 'test-meeting',
          title: 'Test Meeting',
          platform: MeetingPlatform.GOOGLE_MEET
        }
      });

      const result = await adapter.initialize();
      
      expect(result).toBe(true);
      expect(adapter.initialized).toBe(true);
      expect(mockChrome.runtime.onMessage.addListener).toHaveBeenCalled();
    });

    test('should initialize successfully without extension', async () => {
      global.chrome = undefined;
      adapter = new MeetAdapter();
      
      // Mock DOM elements for meeting detection
      mockDocument.querySelector.mockReturnValue({
        textContent: 'Test Meeting'
      });

      const result = await adapter.initialize();
      
      expect(result).toBe(true);
      expect(adapter.initialized).toBe(true);
    });

    test('should handle initialization errors', async () => {
      // Mock chrome to throw error during extension initialization
      global.chrome = {
        ...mockChrome,
        runtime: {
          ...mockChrome.runtime,
          onMessage: {
            addListener: jest.fn(() => {
              throw new Error('Extension error');
            })
          }
        }
      };
      
      adapter = new MeetAdapter();
      await expect(adapter.initialize()).rejects.toThrow('Extension error');
    });
  });

  describe('Meeting Detection', () => {
    test('should detect meeting from URL', () => {
      adapter._detectMeetingFromDOM();
      
      expect(adapter.meetingInfo).toBeInstanceOf(MeetingInfo);
      expect(adapter.meetingInfo.id).toBe('abc-defg-hij');
      expect(adapter.meetingInfo.platform).toBe(MeetingPlatform.GOOGLE_MEET);
      expect(adapter.meetingActive).toBe(true);
    });

    test('should extract meeting title from DOM', () => {
      mockDocument.querySelector
        .mockReturnValueOnce(null) // First selector fails
        .mockReturnValueOnce({ textContent: 'Team Standup Meeting' }); // Second succeeds

      const title = adapter._extractMeetingTitle();
      expect(title).toBe('Team Standup Meeting');
    });

    test('should return null when no title found', () => {
      mockDocument.querySelector.mockReturnValue(null);

      const title = adapter._extractMeetingTitle();
      expect(title).toBe(null);
    });
  });

  describe('Meeting Information', () => {
    beforeEach(async () => {
      await adapter.initialize();
    });

    test('should get meeting info from extension', async () => {
      const mockMeetingInfo = {
        id: 'test-meeting',
        title: 'Test Meeting',
        platform: MeetingPlatform.GOOGLE_MEET,
        startTime: new Date().toISOString()
      };

      mockChrome.runtime.sendMessage.mockResolvedValue({
        success: true,
        meetingInfo: mockMeetingInfo
      });

      const meetingInfo = await adapter.getMeetingInfo();
      
      expect(meetingInfo).toBeInstanceOf(MeetingInfo);
      expect(meetingInfo.id).toBe('test-meeting');
      expect(meetingInfo.title).toBe('Test Meeting');
    });

    test('should return stored meeting info when extension fails', async () => {
      adapter.meetingInfo = new MeetingInfo({
        id: 'stored-meeting',
        title: 'Stored Meeting'
      });

      mockChrome.runtime.sendMessage.mockRejectedValue(new Error('Extension error'));

      const meetingInfo = await adapter.getMeetingInfo();
      
      expect(meetingInfo.id).toBe('stored-meeting');
      expect(meetingInfo.title).toBe('Stored Meeting');
    });
  });

  describe('Audio Stream', () => {
    beforeEach(async () => {
      await adapter.initialize();
    });

    test('should get audio stream successfully', async () => {
      const mockTrack = { stop: jest.fn() };
      const mockStream = { 
        id: 'test-stream',
        getTracks: jest.fn().mockReturnValue([mockTrack])
      };
      mockNavigator.mediaDevices.getUserMedia.mockResolvedValue(mockStream);

      const stream = await adapter.getAudioStream();
      
      expect(stream).toBe(mockStream);
      expect(adapter.audioStream).toBe(mockStream);
      expect(mockNavigator.mediaDevices.getUserMedia).toHaveBeenCalledWith({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });
    });

    test('should return cached audio stream', async () => {
      const mockTrack = { stop: jest.fn() };
      const mockStream = { 
        id: 'cached-stream',
        getTracks: jest.fn().mockReturnValue([mockTrack])
      };
      adapter.audioStream = mockStream;

      const stream = await adapter.getAudioStream();
      
      expect(stream).toBe(mockStream);
      expect(mockNavigator.mediaDevices.getUserMedia).not.toHaveBeenCalled();
    });

    test('should handle audio stream errors', async () => {
      mockNavigator.mediaDevices.getUserMedia.mockRejectedValue(
        new Error('Permission denied')
      );

      await expect(adapter.getAudioStream()).rejects.toThrow(
        'Unable to access microphone for audio capture'
      );
    });
  });

  describe('Participants', () => {
    beforeEach(async () => {
      await adapter.initialize();
    });

    test('should get participants from extension', async () => {
      const mockParticipants = [
        { id: 'user1', name: 'John Doe', joinTime: new Date().toISOString() },
        { id: 'user2', name: 'Jane Smith', joinTime: new Date().toISOString() }
      ];

      mockChrome.runtime.sendMessage.mockResolvedValue({
        success: true,
        participants: mockParticipants
      });

      const participants = await adapter.getParticipants();
      
      expect(participants).toHaveLength(2);
      expect(participants[0]).toBeInstanceOf(ParticipantInfo);
      expect(participants[0].name).toBe('John Doe');
      expect(participants[1].name).toBe('Jane Smith');
    });

    test('should return stored participants when extension fails', async () => {
      adapter.participants = [
        new ParticipantInfo({ id: 'stored1', name: 'Stored User' })
      ];

      mockChrome.runtime.sendMessage.mockRejectedValue(new Error('Extension error'));

      const participants = await adapter.getParticipants();
      
      expect(participants).toHaveLength(1);
      expect(participants[0].name).toBe('Stored User');
    });

    test('should update participants from DOM', () => {
      const mockElements = [
        { 
          getAttribute: jest.fn().mockReturnValue('user1'),
          textContent: 'John Doe'
        },
        { 
          getAttribute: jest.fn().mockReturnValue('user2'),
          textContent: 'Jane Smith'
        }
      ];

      mockDocument.querySelectorAll.mockReturnValue(mockElements);

      adapter._updateParticipants();
      
      expect(adapter.participants).toHaveLength(2);
      expect(adapter.participants[0].name).toBe('John Doe');
      expect(adapter.participants[1].name).toBe('Jane Smith');
    });
  });

  describe('Chat Integration', () => {
    beforeEach(async () => {
      await adapter.initialize();
    });

    test('should return false for chat integration (not supported)', async () => {
      const result = await adapter.sendMessageToChat('Test message');
      expect(result).toBe(false);
    });
  });

  describe('Meeting Agenda', () => {
    beforeEach(async () => {
      await adapter.initialize();
    });

    test('should get meeting agenda from extension', async () => {
      const mockAgenda = {
        meetingTitle: 'Team Meeting',
        items: [
          { title: 'Review progress', description: 'Weekly review' },
          { title: 'Plan next sprint', description: 'Sprint planning' }
        ]
      };

      mockChrome.runtime.sendMessage.mockResolvedValue({
        success: true,
        agenda: mockAgenda
      });

      const agenda = await adapter.getMeetingAgenda();
      
      expect(agenda).toEqual(mockAgenda);
      expect(mockChrome.runtime.sendMessage).toHaveBeenCalledWith({
        type: 'GET_MEETING_AGENDA',
        data: { meetingId: undefined }
      });
    });

    test('should return null when agenda not available', async () => {
      mockChrome.runtime.sendMessage.mockResolvedValue({
        success: false
      });

      const agenda = await adapter.getMeetingAgenda();
      expect(agenda).toBe(null);
    });
  });

  describe('Host Detection', () => {
    beforeEach(async () => {
      await adapter.initialize();
    });

    test('should return false for host detection (not supported)', async () => {
      const isHost = await adapter.isHost();
      expect(isHost).toBe(false);
    });
  });

  describe('Platform Capabilities', () => {
    test('should return correct capabilities', () => {
      const capabilities = adapter.getCapabilities();
      
      expect(capabilities).toEqual({
        chatIntegration: false,
        agendaAccess: true,
        participantInfo: false,
        hostDetection: false,
        audioQuality: AudioQuality.MEDIUM,
        meetingEvents: true,
        recordingAccess: false,
        fileExport: true,
        calendarIntegration: true,
        driveIntegration: true
      });
    });
  });

  describe('Transcript Export', () => {
    beforeEach(async () => {
      await adapter.initialize();
    });

    test('should export transcript via extension', async () => {
      const mockTranscript = {
        meetingId: 'test-meeting',
        segments: [
          { speakerId: 'user1', text: 'Hello everyone', startTime: Date.now() }
        ]
      };

      mockChrome.runtime.sendMessage.mockResolvedValue({
        success: true
      });

      const result = await adapter.exportTranscript(mockTranscript, 'pdf');
      
      expect(result).toBe(true);
      expect(mockChrome.runtime.sendMessage).toHaveBeenCalledWith({
        type: 'EXPORT_TRANSCRIPT',
        data: { transcript: mockTranscript, format: 'pdf' }
      });
    });

    test('should create download link as fallback', async () => {
      global.chrome = undefined;
      adapter = new MeetAdapter();
      await adapter.initialize();

      const mockTranscript = {
        meetingId: 'test-meeting',
        segments: [
          { speakerId: 'user1', text: 'Hello everyone', startTime: Date.now() }
        ]
      };

      const mockLink = {
        href: '',
        download: '',
        style: { display: '' },
        click: jest.fn()
      };

      mockDocument.createElement.mockReturnValue(mockLink);
      global.Blob = jest.fn().mockImplementation((content, options) => ({
        type: options.type
      }));

      const result = await adapter.exportTranscript(mockTranscript, 'txt');
      
      expect(result).toBe(true);
      expect(mockDocument.createElement).toHaveBeenCalledWith('a');
      expect(mockLink.click).toHaveBeenCalled();
    });
  });

  describe('Google Drive Integration', () => {
    beforeEach(async () => {
      await adapter.initialize();
    });

    test('should save transcript to Google Drive via extension', async () => {
      const mockTranscript = {
        meetingId: 'test-meeting',
        segments: []
      };

      mockChrome.runtime.sendMessage.mockResolvedValue({
        success: true
      });

      const result = await adapter.saveToGoogleDrive(mockTranscript);
      
      expect(result).toBe(true);
      expect(mockChrome.runtime.sendMessage).toHaveBeenCalledWith({
        type: 'SAVE_TO_DRIVE',
        data: { transcript: mockTranscript }
      });
    });

    test('should return false when extension not available', async () => {
      global.chrome = undefined;
      adapter = new MeetAdapter();
      await adapter.initialize();

      const result = await adapter.saveToGoogleDrive({});
      expect(result).toBe(false);
    });
  });

  describe('Event Handling', () => {
    beforeEach(async () => {
      await adapter.initialize();
    });

    test('should handle meeting detected event', () => {
      const eventSpy = jest.fn();
      adapter.addEventListener(PlatformEvents.MEETING_STARTED, eventSpy);

      const meetingData = {
        meetingId: 'test-meeting',
        title: 'Test Meeting',
        timestamp: new Date().toISOString(),
        url: 'https://meet.google.com/test-meeting'
      };

      adapter._handleMeetingDetected(meetingData);
      
      expect(adapter.meetingActive).toBe(true);
      expect(adapter.meetingInfo.id).toBe('test-meeting');
      expect(eventSpy).toHaveBeenCalled();
    });

    test('should handle meeting ended event', () => {
      const eventSpy = jest.fn();
      adapter.addEventListener(PlatformEvents.MEETING_ENDED, eventSpy);

      adapter.meetingInfo = new MeetingInfo({ id: 'test-meeting' });
      adapter.meetingActive = true;

      const endData = {
        meetingId: 'test-meeting',
        timestamp: new Date().toISOString()
      };

      adapter._handleMeetingEnded(endData);
      
      expect(adapter.meetingActive).toBe(false);
      expect(adapter.meetingInfo.endTime).toBeDefined();
      expect(eventSpy).toHaveBeenCalled();
    });

    test('should handle participant joined event', () => {
      const eventSpy = jest.fn();
      adapter.addEventListener(PlatformEvents.PARTICIPANT_JOINED, eventSpy);

      const participantData = {
        participantId: 'user1',
        name: 'John Doe',
        timestamp: new Date().toISOString()
      };

      adapter._handleParticipantJoined(participantData);
      
      expect(adapter.participants).toHaveLength(1);
      expect(adapter.participants[0].name).toBe('John Doe');
      expect(eventSpy).toHaveBeenCalled();
    });

    test('should handle participant left event', () => {
      const eventSpy = jest.fn();
      adapter.addEventListener(PlatformEvents.PARTICIPANT_LEFT, eventSpy);

      // Add a participant first
      adapter.participants = [
        new ParticipantInfo({ id: 'user1', name: 'John Doe' })
      ];

      const leftData = {
        participantId: 'user1',
        timestamp: new Date().toISOString()
      };

      adapter._handleParticipantLeft(leftData);
      
      expect(adapter.participants).toHaveLength(0);
      expect(eventSpy).toHaveBeenCalled();
    });
  });

  describe('Text Formatting', () => {
    test('should format transcript as text', () => {
      const mockTranscript = {
        meetingInfo: {
          title: 'Test Meeting',
          startTime: new Date('2023-01-01T10:00:00Z').toISOString()
        },
        segments: [
          {
            speakerId: 'user1',
            text: 'Hello everyone',
            startTime: new Date('2023-01-01T10:00:00Z').getTime()
          },
          {
            speakerId: 'user2',
            text: 'Good morning',
            startTime: new Date('2023-01-01T10:00:30Z').getTime()
          }
        ]
      };

      const formatted = adapter._formatTranscriptAsText(mockTranscript);
      
      expect(formatted).toContain('Meeting: Test Meeting');
      expect(formatted).toContain('Platform: Google Meet');
      expect(formatted).toContain('user1: Hello everyone');
      expect(formatted).toContain('user2: Good morning');
    });
  });

  describe('Cleanup', () => {
    test('should cleanup resources properly', async () => {
      const mockTrack = { stop: jest.fn() };
      const mockStream = { getTracks: jest.fn().mockReturnValue([mockTrack]) };
      
      adapter.audioStream = mockStream;
      adapter.initialized = true;
      adapter.meetingActive = true;
      
      await adapter.cleanup();
      
      expect(mockTrack.stop).toHaveBeenCalled();
      expect(adapter.audioStream).toBe(null);
      expect(adapter.initialized).toBe(false);
      expect(adapter.meetingActive).toBe(false);
    });
  });
});