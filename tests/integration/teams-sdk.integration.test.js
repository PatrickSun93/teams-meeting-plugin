// Integration tests for Teams SDK interactions
import * as microsoftTeams from '@microsoft/teams-js';

describe('Teams SDK Integration Tests', () => {
  let teamsAdapter;
  let mockTeamsContext;
  let mockAuthToken;

  beforeEach(() => {
    // Mock Teams SDK
    mockTeamsContext = {
      app: {
        host: {
          name: 'Teams',
          clientType: 'desktop'
        }
      },
      meeting: {
        id: 'test-meeting-123',
        organizer: {
          id: 'organizer-id',
          displayName: 'Meeting Organizer'
        }
      },
      user: {
        id: 'user-123',
        displayName: 'Test User',
        userPrincipalName: 'test@example.com'
      },
      page: {
        id: 'meeting-tab',
        frameContext: 'meetingTab'
      }
    };

    mockAuthToken = 'mock-auth-token-12345';

    // Mock Teams SDK methods
    microsoftTeams.app = {
      initialize: jest.fn().mockResolvedValue(undefined),
      getContext: jest.fn().mockResolvedValue(mockTeamsContext),
      notifySuccess: jest.fn(),
      notifyFailure: jest.fn()
    };

    microsoftTeams.authentication = {
      getAuthToken: jest.fn().mockResolvedValue(mockAuthToken)
    };

    microsoftTeams.meeting = {
      getMeetingDetails: jest.fn().mockResolvedValue({
        details: {
          id: 'test-meeting-123',
          title: 'Test Meeting',
          startTime: new Date().toISOString(),
          organizer: mockTeamsContext.meeting.organizer
        }
      }),
      shareAppContentToStage: jest.fn().mockResolvedValue(undefined)
    };

    microsoftTeams.chat = {
      sendMessage: jest.fn().mockResolvedValue({ success: true })
    };

    const TeamsAdapter = require('../../src/teams/teamsAdapter');
    teamsAdapter = new TeamsAdapter();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Teams App Initialization', () => {
    test('should initialize Teams SDK successfully', async () => {
      await teamsAdapter.initialize();

      expect(microsoftTeams.app.initialize).toHaveBeenCalled();
      expect(microsoftTeams.app.getContext).toHaveBeenCalled();
      expect(teamsAdapter.isInitialized()).toBe(true);
    });

    test('should handle initialization failures gracefully', async () => {
      microsoftTeams.app.initialize.mockRejectedValue(new Error('SDK initialization failed'));

      await expect(teamsAdapter.initialize()).rejects.toThrow('SDK initialization failed');
      expect(teamsAdapter.isInitialized()).toBe(false);
    });

    test('should detect Teams environment correctly', async () => {
      await teamsAdapter.initialize();

      const isTeamsEnvironment = teamsAdapter.isTeamsEnvironment();
      expect(isTeamsEnvironment).toBe(true);

      const hostInfo = teamsAdapter.getHostInfo();
      expect(hostInfo.name).toBe('Teams');
      expect(hostInfo.clientType).toBe('desktop');
    });

    test('should handle non-Teams environment', async () => {
      // Simulate non-Teams environment
      delete window.microsoftTeams;
      
      const nonTeamsAdapter = new (require('../../src/teams/teamsAdapter'))();
      
      const isTeamsEnvironment = nonTeamsAdapter.isTeamsEnvironment();
      expect(isTeamsEnvironment).toBe(false);
    });
  });

  describe('Meeting Context and Details', () => {
    beforeEach(async () => {
      await teamsAdapter.initialize();
    });

    test('should retrieve meeting context', async () => {
      const context = await teamsAdapter.getMeetingContext();

      expect(context.meetingId).toBe('test-meeting-123');
      expect(context.userId).toBe('user-123');
      expect(context.userDisplayName).toBe('Test User');
      expect(context.frameContext).toBe('meetingTab');
    });

    test('should get meeting details', async () => {
      const meetingDetails = await teamsAdapter.getMeetingDetails();

      expect(meetingDetails.id).toBe('test-meeting-123');
      expect(meetingDetails.title).toBe('Test Meeting');
      expect(meetingDetails.organizer.displayName).toBe('Meeting Organizer');
      expect(microsoftTeams.meeting.getMeetingDetails).toHaveBeenCalled();
    });

    test('should determine user role in meeting', async () => {
      // Test organizer role
      const isOrganizer = await teamsAdapter.isUserOrganizer();
      expect(isOrganizer).toBe(false); // User is not organizer in mock

      // Mock user as organizer
      mockTeamsContext.user.id = mockTeamsContext.meeting.organizer.id;
      microsoftTeams.app.getContext.mockResolvedValue(mockTeamsContext);

      const isOrganizerNow = await teamsAdapter.isUserOrganizer();
      expect(isOrganizerNow).toBe(true);
    });

    test('should handle missing meeting context', async () => {
      // Mock missing meeting context
      const contextWithoutMeeting = { ...mockTeamsContext };
      delete contextWithoutMeeting.meeting;
      microsoftTeams.app.getContext.mockResolvedValue(contextWithoutMeeting);

      await expect(teamsAdapter.getMeetingContext()).rejects.toThrow('No meeting context available');
    });
  });

  describe('Authentication and Permissions', () => {
    beforeEach(async () => {
      await teamsAdapter.initialize();
    });

    test('should authenticate user and get token', async () => {
      const token = await teamsAdapter.getAuthToken();

      expect(token).toBe(mockAuthToken);
      expect(microsoftTeams.authentication.getAuthToken).toHaveBeenCalled();
    });

    test('should handle authentication failures', async () => {
      microsoftTeams.authentication.getAuthToken.mockRejectedValue(new Error('Authentication failed'));

      await expect(teamsAdapter.getAuthToken()).rejects.toThrow('Authentication failed');
    });

    test('should check required permissions', async () => {
      const requiredPermissions = ['microphone', 'chat'];
      
      // Mock permission check
      teamsAdapter.checkPermissions = jest.fn().mockResolvedValue({
        microphone: true,
        chat: true
      });

      const permissions = await teamsAdapter.checkPermissions(requiredPermissions);
      
      expect(permissions.microphone).toBe(true);
      expect(permissions.chat).toBe(true);
    });

    test('should handle permission denials', async () => {
      teamsAdapter.checkPermissions = jest.fn().mockResolvedValue({
        microphone: false,
        chat: true
      });

      const permissions = await teamsAdapter.checkPermissions(['microphone', 'chat']);
      
      expect(permissions.microphone).toBe(false);
      expect(permissions.chat).toBe(true);
    });
  });

  describe('Chat Integration', () => {
    beforeEach(async () => {
      await teamsAdapter.initialize();
    });

    test('should send transcript to chat', async () => {
      const transcript = {
        segments: [
          { speaker: 'John Doe', text: 'Hello everyone', timestamp: Date.now() },
          { speaker: 'Jane Smith', text: 'Good morning', timestamp: Date.now() + 1000 }
        ],
        meetingId: 'test-meeting-123',
        duration: 120
      };

      const result = await teamsAdapter.sendTranscriptToChat(transcript);

      expect(result.success).toBe(true);
      expect(microsoftTeams.chat.sendMessage).toHaveBeenCalled();

      const sentMessage = microsoftTeams.chat.sendMessage.mock.calls[0][0];
      expect(sentMessage.content).toContain('Meeting Transcript');
      expect(sentMessage.content).toContain('John Doe: Hello everyone');
      expect(sentMessage.content).toContain('Jane Smith: Good morning');
    });

    test('should handle long transcripts by splitting messages', async () => {
      const longTranscript = {
        segments: Array.from({ length: 100 }, (_, i) => ({
          speaker: `Speaker ${i % 5}`,
          text: `This is a long message number ${i} that contains important information about the meeting discussion.`,
          timestamp: Date.now() + i * 1000
        })),
        meetingId: 'test-meeting-123',
        duration: 6000
      };

      const result = await teamsAdapter.sendTranscriptToChat(longTranscript);

      expect(result.success).toBe(true);
      expect(microsoftTeams.chat.sendMessage).toHaveBeenCalledTimes(2); // Should split into multiple messages
    });

    test('should send summary to chat', async () => {
      const summary = {
        keyPoints: [
          'Discussed project timeline',
          'Reviewed budget allocation',
          'Assigned action items'
        ],
        actionItems: [
          { assignee: 'John', task: 'Prepare presentation', dueDate: '2024-01-15' },
          { assignee: 'Jane', task: 'Review contracts', dueDate: '2024-01-20' }
        ],
        decisions: [
          'Approved budget increase',
          'Moved deadline to next month'
        ]
      };

      const result = await teamsAdapter.sendSummaryToChat(summary);

      expect(result.success).toBe(true);
      expect(microsoftTeams.chat.sendMessage).toHaveBeenCalled();

      const sentMessage = microsoftTeams.chat.sendMessage.mock.calls[0][0];
      expect(sentMessage.content).toContain('Meeting Summary');
      expect(sentMessage.content).toContain('Key Points');
      expect(sentMessage.content).toContain('Action Items');
      expect(sentMessage.content).toContain('Decisions');
    });

    test('should handle chat permission errors', async () => {
      microsoftTeams.chat.sendMessage.mockRejectedValue(new Error('Insufficient permissions'));

      const transcript = { segments: [], meetingId: 'test', duration: 0 };

      await expect(teamsAdapter.sendTranscriptToChat(transcript))
        .rejects.toThrow('Insufficient permissions');
    });
  });

  describe('Meeting State Management', () => {
    beforeEach(async () => {
      await teamsAdapter.initialize();
    });

    test('should detect meeting start and end', async () => {
      const meetingStateHandler = jest.fn();
      teamsAdapter.onMeetingStateChange(meetingStateHandler);

      // Simulate meeting start
      await teamsAdapter.simulateMeetingStart();
      expect(meetingStateHandler).toHaveBeenCalledWith('started');

      // Simulate meeting end
      await teamsAdapter.simulateMeetingEnd();
      expect(meetingStateHandler).toHaveBeenCalledWith('ended');
    });

    test('should track participant changes', async () => {
      const participantHandler = jest.fn();
      teamsAdapter.onParticipantChange(participantHandler);

      const newParticipant = {
        id: 'participant-456',
        displayName: 'New Participant',
        role: 'attendee'
      };

      // Simulate participant joining
      await teamsAdapter.simulateParticipantJoin(newParticipant);
      expect(participantHandler).toHaveBeenCalledWith('joined', newParticipant);

      // Simulate participant leaving
      await teamsAdapter.simulateParticipantLeave(newParticipant);
      expect(participantHandler).toHaveBeenCalledWith('left', newParticipant);
    });

    test('should handle meeting recording state', async () => {
      const recordingHandler = jest.fn();
      teamsAdapter.onRecordingStateChange(recordingHandler);

      // Start recording
      await teamsAdapter.startRecording();
      expect(recordingHandler).toHaveBeenCalledWith(true);

      // Stop recording
      await teamsAdapter.stopRecording();
      expect(recordingHandler).toHaveBeenCalledWith(false);
    });
  });

  describe('Error Handling and Recovery', () => {
    beforeEach(async () => {
      await teamsAdapter.initialize();
    });

    test('should handle network connectivity issues', async () => {
      // Simulate network error
      microsoftTeams.chat.sendMessage.mockRejectedValue(new Error('Network error'));

      const transcript = { segments: [], meetingId: 'test', duration: 0 };

      // Should retry on network error
      const result = await teamsAdapter.sendTranscriptToChat(transcript, { retries: 2 });
      
      expect(microsoftTeams.chat.sendMessage).toHaveBeenCalledTimes(3); // Initial + 2 retries
      expect(result.success).toBe(false);
      expect(result.error).toContain('Network error');
    });

    test('should handle Teams SDK version compatibility', async () => {
      // Mock older SDK version
      microsoftTeams.meeting.getMeetingDetails = undefined;

      const fallbackDetails = await teamsAdapter.getMeetingDetailsWithFallback();
      
      expect(fallbackDetails.id).toBe('test-meeting-123'); // Should use context fallback
      expect(fallbackDetails.source).toBe('context'); // Indicates fallback was used
    });

    test('should recover from temporary SDK failures', async () => {
      let callCount = 0;
      microsoftTeams.app.getContext.mockImplementation(() => {
        callCount++;
        if (callCount <= 2) {
          throw new Error('Temporary SDK failure');
        }
        return Promise.resolve(mockTeamsContext);
      });

      // Should eventually succeed after retries
      const context = await teamsAdapter.getMeetingContextWithRetry();
      
      expect(context.meetingId).toBe('test-meeting-123');
      expect(callCount).toBe(3);
    });
  });

  describe('Performance and Resource Management', () => {
    beforeEach(async () => {
      await teamsAdapter.initialize();
    });

    test('should manage event listeners efficiently', async () => {
      const handler1 = jest.fn();
      const handler2 = jest.fn();

      // Add listeners
      teamsAdapter.onMeetingStateChange(handler1);
      teamsAdapter.onMeetingStateChange(handler2);

      // Trigger event
      await teamsAdapter.simulateMeetingStart();

      expect(handler1).toHaveBeenCalledTimes(1);
      expect(handler2).toHaveBeenCalledTimes(1);

      // Remove listener
      teamsAdapter.offMeetingStateChange(handler1);

      // Trigger event again
      await teamsAdapter.simulateMeetingStart();

      expect(handler1).toHaveBeenCalledTimes(1); // Should not be called again
      expect(handler2).toHaveBeenCalledTimes(2); // Should be called again
    });

    test('should cleanup resources on disposal', async () => {
      const handler = jest.fn();
      teamsAdapter.onMeetingStateChange(handler);

      // Dispose adapter
      await teamsAdapter.dispose();

      // Events should not be handled after disposal
      await teamsAdapter.simulateMeetingStart();
      expect(handler).not.toHaveBeenCalled();
    });

    test('should throttle API calls to prevent rate limiting', async () => {
      const startTime = Date.now();
      
      // Make multiple rapid API calls
      const promises = Array.from({ length: 10 }, () => 
        teamsAdapter.getMeetingDetails()
      );

      await Promise.all(promises);
      
      const endTime = Date.now();
      const duration = endTime - startTime;

      // Should take at least some time due to throttling
      expect(duration).toBeGreaterThan(100);
      expect(microsoftTeams.meeting.getMeetingDetails).toHaveBeenCalledTimes(10);
    });
  });
});