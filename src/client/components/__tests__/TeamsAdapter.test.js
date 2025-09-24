// Tests for Teams Adapter
import TeamsAdapter from '../../teams/teamsAdapter.js';

// Mock the Microsoft Teams SDK
jest.mock('@microsoft/teams-js', () => ({
  app: {
    initialize: jest.fn(() => Promise.resolve()),
    getContext: jest.fn(() => Promise.resolve({
      user: {
        id: 'test-user-id',
        displayName: 'Test User',
        userPrincipalName: 'test@example.com'
      },
      meeting: {
        id: 'test-meeting-id',
        title: 'Test Meeting',
        organizer: {
          id: 'organizer-id',
          displayName: 'Meeting Organizer'
        }
      }
    }))
  }
}));

// Mock navigator.mediaDevices
Object.defineProperty(navigator, 'mediaDevices', {
  writable: true,
  value: {
    getUserMedia: jest.fn(() => Promise.resolve({
      getTracks: () => [],
      getAudioTracks: () => []
    }))
  }
});

describe('TeamsAdapter', () => {
  let teamsAdapter;

  beforeEach(() => {
    teamsAdapter = new TeamsAdapter();
    jest.clearAllMocks();
  });

  afterEach(() => {
    if (teamsAdapter) {
      teamsAdapter.cleanup();
    }
  });

  describe('initialization', () => {
    test('should initialize Teams SDK successfully', async () => {
      const result = await teamsAdapter.initialize();
      
      expect(result).toBe(true);
      expect(teamsAdapter.isInitialized).toBe(true);
      expect(teamsAdapter.context).toBeDefined();
    });

    test('should detect meeting state after initialization', async () => {
      await teamsAdapter.initialize();
      
      expect(teamsAdapter.meetingState).toBe('active');
      expect(teamsAdapter.meetingInfo).toBeDefined();
      expect(teamsAdapter.meetingInfo.id).toBe('test-meeting-id');
    });
  });

  describe('meeting detection', () => {
    beforeEach(async () => {
      await teamsAdapter.initialize();
    });

    test('should detect meeting information correctly', () => {
      const meetingInfo = teamsAdapter.getMeetingInfo();
      
      expect(meetingInfo.id).toBe('test-meeting-id');
      expect(meetingInfo.title).toBe('Test Meeting');
      expect(meetingInfo.platform).toBe('teams');
      expect(meetingInfo.state).toBe('active');
    });

    test('should detect host status', () => {
      // In this test, user is not the organizer
      expect(teamsAdapter.getHostStatus()).toBe(false);
    });

    test('should get participants list', () => {
      const participants = teamsAdapter.getMeetingParticipants();
      
      expect(participants).toHaveLength(2); // Current user + organizer
      expect(participants[0].isCurrentUser).toBe(true);
      expect(participants[1].role).toBe('organizer');
    });
  });

  describe('audio access', () => {
    beforeEach(async () => {
      await teamsAdapter.initialize();
    });

    test('should request audio access successfully', async () => {
      const stream = await teamsAdapter.requestAudioAccess();
      
      expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledWith({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });
      expect(stream).toBeDefined();
    });
  });

  describe('platform capabilities', () => {
    test('should return correct platform capabilities', () => {
      const capabilities = teamsAdapter.getPlatformCapabilities();
      
      expect(capabilities.platform).toBe('teams');
      expect(capabilities.supportsChatIntegration).toBe(true);
      expect(capabilities.supportsHostDetection).toBe(true);
      expect(capabilities.audioQuality).toBe('high');
    });
  });

  describe('event handling', () => {
    beforeEach(async () => {
      await teamsAdapter.initialize();
    });

    test('should register and notify event listeners', (done) => {
      const mockListener = jest.fn((event) => {
        expect(event.type).toBe('meetingStateChange');
        done();
      });

      teamsAdapter.addEventListener('meetingStateChange', mockListener);
      
      // Simulate state change
      teamsAdapter.notifyStateChange('active', 'ended');
      
      expect(mockListener).toHaveBeenCalled();
    });

    test('should remove event listeners', () => {
      const mockListener = jest.fn();
      
      teamsAdapter.addEventListener('meetingStateChange', mockListener);
      teamsAdapter.removeEventListener('meetingStateChange', mockListener);
      
      // Simulate state change
      teamsAdapter.notifyStateChange('active', 'ended');
      
      expect(mockListener).not.toHaveBeenCalled();
    });
  });

  describe('cleanup', () => {
    test('should cleanup resources properly', async () => {
      await teamsAdapter.initialize();
      
      // Start the interval
      expect(teamsAdapter.meetingStateInterval).toBeDefined();
      
      teamsAdapter.cleanup();
      
      expect(teamsAdapter.eventListeners.size).toBe(0);
    });
  });
});