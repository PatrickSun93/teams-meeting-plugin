/**
 * Tests for CrossPlatformSummaryService
 */

import CrossPlatformSummaryService from '../CrossPlatformSummaryService.js';

// Mock dependencies
const mockSummaryService = {
  generateSummary: jest.fn()
};

const mockTranscriptStorage = {
  getTranscript: jest.fn()
};

const mockSecurityManager = {
  checkSummaryDeliveryPermissions: jest.fn(),
  logActivity: jest.fn()
};

// Mock localStorage
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  clear: jest.fn()
};
global.localStorage = localStorageMock;

describe('CrossPlatformSummaryService', () => {
  let summaryService;

  beforeEach(() => {
    summaryService = new CrossPlatformSummaryService(
      mockSummaryService,
      mockTranscriptStorage,
      mockSecurityManager
    );
    jest.clearAllMocks();
    localStorageMock.getItem.mockReturnValue(null);
  });

  describe('generateAndDeliverSummary', () => {
    it('should generate and deliver summary for Teams platform', async () => {
      const mockTranscript = {
        id: 'teams-transcript',
        platform: 'teams',
        title: 'Teams Meeting',
        content: { segments: [] },
        agenda: { items: [] },
        platformMetadata: {
          chatThreadId: 'thread-123',
          organizationId: 'org-456',
          participantRoles: [{ id: 'user1', role: 'presenter' }]
        }
      };

      const mockSummary = {
        keyPoints: ['Point 1', 'Point 2'],
        actionItems: [{ description: 'Task 1', assignee: 'user1' }],
        decisions: ['Decision 1']
      };

      mockTranscriptStorage.getTranscript.mockResolvedValue(mockTranscript);
      mockSummaryService.generateSummary.mockResolvedValue(mockSummary);
      mockSecurityManager.checkSummaryDeliveryPermissions.mockResolvedValue(true);

      const result = await summaryService.generateAndDeliverSummary('teams-transcript', {
        method: 'teams-chat',
        userId: 'user123'
      });

      expect(result).toHaveProperty('summary');
      expect(result).toHaveProperty('delivery');
      expect(result).toHaveProperty('platform', 'teams');
      expect(result.summary).toHaveProperty('teamsSpecific');
      expect(result.summary.teamsSpecific.chatThreadId).toBe('thread-123');
      expect(result.delivery.success).toBe(true);
      expect(result.delivery.method).toBe('teams-chat');
    });

    it('should generate and deliver summary for Zoom platform', async () => {
      const mockTranscript = {
        id: 'zoom-transcript',
        platform: 'zoom',
        title: 'Zoom Meeting',
        content: { segments: [] },
        platformMetadata: {
          zoomMeetingId: 'zoom-123',
          recordingId: 'rec-456'
        }
      };

      const mockSummary = {
        keyPoints: ['Zoom point 1'],
        actionItems: [],
        decisions: []
      };

      mockTranscriptStorage.getTranscript.mockResolvedValue(mockTranscript);
      mockSummaryService.generateSummary.mockResolvedValue(mockSummary);
      mockSecurityManager.checkSummaryDeliveryPermissions.mockResolvedValue(true);

      const result = await summaryService.generateAndDeliverSummary('zoom-transcript', {
        method: 'zoom-chat'
      });

      expect(result.summary).toHaveProperty('zoomSpecific');
      expect(result.summary.zoomSpecific.meetingId).toBe('zoom-123');
      expect(result.summary.zoomSpecific.recordingId).toBe('rec-456');
    });

    it('should generate and deliver summary for Google Meet platform', async () => {
      const mockTranscript = {
        id: 'meet-transcript',
        platform: 'meet',
        title: 'Google Meet Session',
        content: { segments: [] },
        platformMetadata: {
          meetCode: 'abc-defg-hij',
          calendarEventId: 'cal-123',
          organizerEmail: 'organizer@example.com'
        }
      };

      const mockSummary = {
        keyPoints: ['Meet point 1'],
        actionItems: [],
        decisions: []
      };

      mockTranscriptStorage.getTranscript.mockResolvedValue(mockTranscript);
      mockSummaryService.generateSummary.mockResolvedValue(mockSummary);
      mockSecurityManager.checkSummaryDeliveryPermissions.mockResolvedValue(true);

      const result = await summaryService.generateAndDeliverSummary('meet-transcript', {
        method: 'google-drive'
      });

      expect(result.summary).toHaveProperty('meetSpecific');
      expect(result.summary.meetSpecific.meetCode).toBe('abc-defg-hij');
      expect(result.summary.meetSpecific.calendarEventId).toBe('cal-123');
    });

    it('should handle transcript not found', async () => {
      mockTranscriptStorage.getTranscript.mockResolvedValue(null);

      await expect(
        summaryService.generateAndDeliverSummary('nonexistent')
      ).rejects.toThrow('Transcript not found');
    });

    it('should handle security permission denial', async () => {
      const mockTranscript = {
        id: 'test-transcript',
        platform: 'teams'
      };

      mockTranscriptStorage.getTranscript.mockResolvedValue(mockTranscript);
      mockSecurityManager.checkSummaryDeliveryPermissions.mockRejectedValue(
        new Error('Permission denied')
      );

      await expect(
        summaryService.generateAndDeliverSummary('test-transcript')
      ).rejects.toThrow('Summary delivery failed: Permission denied');
    });

    it('should handle unsupported platform', async () => {
      const mockTranscript = {
        id: 'unknown-transcript',
        platform: 'unknown-platform'
      };

      mockTranscriptStorage.getTranscript.mockResolvedValue(mockTranscript);
      mockSecurityManager.checkSummaryDeliveryPermissions.mockResolvedValue(true);

      await expect(
        summaryService.generateAndDeliverSummary('unknown-transcript')
      ).rejects.toThrow('No delivery handler for platform: unknown-platform');
    });
  });

  describe('getAvailableDeliveryMethods', () => {
    it('should return Teams-specific delivery methods', async () => {
      mockTranscriptStorage.getTranscript.mockResolvedValue({
        id: 'teams-transcript',
        platform: 'teams'
      });

      const methods = await summaryService.getAvailableDeliveryMethods('teams-transcript');

      expect(methods).toContain('email');
      expect(methods).toContain('teams-chat');
      expect(methods).toContain('sharepoint');
      expect(methods).toContain('onenote');
      expect(methods).toContain('outlook');
    });

    it('should return Zoom-specific delivery methods', async () => {
      mockTranscriptStorage.getTranscript.mockResolvedValue({
        id: 'zoom-transcript',
        platform: 'zoom'
      });

      const methods = await summaryService.getAvailableDeliveryMethods('zoom-transcript');

      expect(methods).toContain('email');
      expect(methods).toContain('zoom-chat');
      expect(methods).toContain('cloud-recording-attachment');
    });

    it('should return Google Meet delivery methods', async () => {
      mockTranscriptStorage.getTranscript.mockResolvedValue({
        id: 'meet-transcript',
        platform: 'meet'
      });

      const methods = await summaryService.getAvailableDeliveryMethods('meet-transcript');

      expect(methods).toContain('email');
      expect(methods).toContain('google-drive');
      expect(methods).toContain('calendar-update');
      expect(methods).toContain('gmail');
    });

    it('should return basic methods for unknown platform', async () => {
      mockTranscriptStorage.getTranscript.mockResolvedValue({
        id: 'unknown-transcript',
        platform: 'unknown'
      });

      const methods = await summaryService.getAvailableDeliveryMethods('unknown-transcript');

      expect(methods).toEqual(['email']);
    });
  });

  describe('getSummaryTemplates', () => {
    it('should return platform-specific templates', async () => {
      const teamsTemplates = await summaryService.getSummaryTemplates('teams');
      
      expect(teamsTemplates).toContainEqual(
        expect.objectContaining({
          id: 'teams-meeting-notes',
          name: 'Teams Meeting Notes'
        })
      );
      expect(teamsTemplates).toContainEqual(
        expect.objectContaining({
          id: 'executive-brief',
          name: 'Executive Brief'
        })
      );
    });

    it('should return base templates for unsupported platform', async () => {
      const templates = await summaryService.getSummaryTemplates('unknown');
      
      expect(templates).toEqual([]);
    });
  });

  describe('batchDeliverSummaries', () => {
    it('should deliver summaries for multiple transcripts', async () => {
      const transcriptIds = ['transcript1', 'transcript2', 'transcript3'];
      
      mockTranscriptStorage.getTranscript.mockImplementation((id) => 
        Promise.resolve({
          id,
          platform: 'teams',
          title: `Meeting ${id}`,
          content: { segments: [] }
        })
      );
      
      mockSummaryService.generateSummary.mockResolvedValue({
        keyPoints: ['Point 1'],
        actionItems: [],
        decisions: []
      });
      
      mockSecurityManager.checkSummaryDeliveryPermissions.mockResolvedValue(true);

      const result = await summaryService.batchDeliverSummaries(transcriptIds, {
        method: 'email'
      });

      expect(result.summary.total).toBe(3);
      expect(result.summary.successful).toBe(3);
      expect(result.summary.failed).toBe(0);
      expect(result.results).toHaveLength(3);
      expect(result.errors).toHaveLength(0);
    });

    it('should handle partial failures in batch delivery', async () => {
      const transcriptIds = ['transcript1', 'transcript2', 'transcript3'];
      
      mockTranscriptStorage.getTranscript.mockImplementation((id) => {
        if (id === 'transcript2') {
          return Promise.resolve(null); // Simulate not found
        }
        return Promise.resolve({
          id,
          platform: 'teams',
          title: `Meeting ${id}`,
          content: { segments: [] }
        });
      });
      
      mockSummaryService.generateSummary.mockResolvedValue({
        keyPoints: ['Point 1'],
        actionItems: [],
        decisions: []
      });
      
      mockSecurityManager.checkSummaryDeliveryPermissions.mockResolvedValue(true);

      const result = await summaryService.batchDeliverSummaries(transcriptIds, {
        method: 'email'
      });

      expect(result.summary.total).toBe(3);
      expect(result.summary.successful).toBe(2);
      expect(result.summary.failed).toBe(1);
      expect(result.results).toHaveLength(2);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].transcriptId).toBe('transcript2');
    });
  });

  describe('scheduleSummaryDelivery', () => {
    it('should schedule summary delivery', async () => {
      const deliveryTime = Date.now() + 60000; // 1 minute from now
      
      const scheduleId = await summaryService.scheduleSummaryDelivery(
        'test-transcript',
        { method: 'email' },
        { deliveryTime }
      );

      expect(scheduleId).toMatch(/^schedule_\d+_[a-z0-9]+$/);
      
      // Check that it was stored
      const stored = localStorage.getItem('scheduledSummaryDeliveries');
      expect(stored).toBeTruthy();
      
      const deliveries = JSON.parse(stored);
      expect(deliveries).toHaveLength(1);
      expect(deliveries[0].id).toBe(scheduleId);
      expect(deliveries[0].status).toBe('scheduled');
    });

    it('should handle immediate delivery for past times', async () => {
      const pastTime = Date.now() - 60000; // 1 minute ago
      
      const scheduleId = await summaryService.scheduleSummaryDelivery(
        'test-transcript',
        { method: 'email' },
        { deliveryTime: pastTime }
      );

      expect(scheduleId).toMatch(/^schedule_\d+_[a-z0-9]+$/);
    });
  });

  describe('Platform-specific delivery handlers', () => {
    describe('TeamsSummaryDelivery', () => {
      it('should format summary for Teams chat with proper markdown', () => {
        const summary = {
          keyPoints: ['Key point 1', 'Key point 2'],
          actionItems: [
            { description: 'Task 1', assignee: 'john.doe' },
            { description: 'Task 2', assignee: 'jane.smith', dueDate: '2024-01-15' }
          ],
          decisions: ['Decision 1', 'Decision 2']
        };

        const transcript = {
          id: 'teams-test',
          title: 'Teams Meeting'
        };

        const handler = summaryService.deliveryHandlers.get('teams');
        const message = handler._formatSummaryForTeamsChat(summary, transcript, {});

        expect(message).toContain('📋 **Meeting Summary: Teams Meeting**');
        expect(message).toContain('**🎯 Key Points:**');
        expect(message).toContain('• Key point 1');
        expect(message).toContain('• Key point 2');
        expect(message).toContain('**✅ Action Items:**');
        expect(message).toContain('• Task 1 (@john.doe)');
        expect(message).toContain('• Task 2 (@jane.smith) 📅 2024-01-15');
        expect(message).toContain('**🎯 Decisions:**');
        expect(message).toContain('• Decision 1');
        expect(message).toContain('• Decision 2');
      });

      it('should handle empty summary sections', () => {
        const summary = {
          keyPoints: [],
          actionItems: [],
          decisions: []
        };

        const transcript = {
          id: 'teams-empty',
          title: 'Empty Meeting'
        };

        const handler = summaryService.deliveryHandlers.get('teams');
        const message = handler._formatSummaryForTeamsChat(summary, transcript, {});

        expect(message).toContain('📋 **Meeting Summary: Empty Meeting**');
        expect(message).not.toContain('**🎯 Key Points:**');
        expect(message).not.toContain('**✅ Action Items:**');
        expect(message).not.toContain('**🎯 Decisions:**');
      });
    });

    describe('ZoomSummaryDelivery', () => {
      it('should format summary for Zoom chat', () => {
        const summary = {
          keyPoints: ['Zoom point 1', 'Zoom point 2'],
          actionItems: [
            { description: 'Zoom task 1', assignee: 'user1' }
          ],
          decisions: []
        };

        const transcript = {
          id: 'zoom-test',
          title: 'Zoom Meeting'
        };

        const handler = summaryService.deliveryHandlers.get('zoom');
        const message = handler._formatSummaryForZoomChat(summary, transcript);

        expect(message).toContain('Meeting Summary: Zoom Meeting');
        expect(message).toContain('Key Points:');
        expect(message).toContain('1. Zoom point 1');
        expect(message).toContain('2. Zoom point 2');
        expect(message).toContain('Action Items:');
        expect(message).toContain('1. Zoom task 1 (user1)');
      });
    });

    describe('BaseSummaryDelivery', () => {
      it('should format summary for email', () => {
        const summary = {
          keyPoints: ['Email point 1'],
          actionItems: [
            { 
              description: 'Email task 1', 
              assignee: 'user1',
              dueDate: '2024-01-15'
            }
          ],
          decisions: ['Email decision 1']
        };

        const transcript = {
          id: 'email-test',
          title: 'Email Meeting',
          createdAt: new Date('2024-01-01T10:00:00Z'),
          platform: 'teams',
          platformMetadata: { duration: 3600 }
        };

        const handler = summaryService.deliveryHandlers.get('teams');
        const content = handler._formatSummaryForEmail(summary, transcript);

        expect(content).toContain('Meeting Summary: Email Meeting');
        expect(content).toContain('Date: 1/1/2024');
        expect(content).toContain('Platform: teams');
        expect(content).toContain('Duration: 3600');
        expect(content).toContain('Key Points:');
        expect(content).toContain('1. Email point 1');
        expect(content).toContain('Action Items:');
        expect(content).toContain('1. Email task 1 (Assigned to: user1) (Due: 2024-01-15)');
        expect(content).toContain('Decisions Made:');
        expect(content).toContain('1. Email decision 1');
      });

      it('should handle missing summary sections in email format', () => {
        const summary = {};
        const transcript = {
          id: 'minimal-test',
          title: 'Minimal Meeting',
          createdAt: new Date(),
          platform: 'teams'
        };

        const handler = summaryService.deliveryHandlers.get('teams');
        const content = handler._formatSummaryForEmail(summary, transcript);

        expect(content).toContain('Meeting Summary: Minimal Meeting');
        expect(content).not.toContain('Key Points:');
        expect(content).not.toContain('Action Items:');
        expect(content).not.toContain('Decisions Made:');
      });
    });
  });

  describe('Summary enhancement', () => {
    it('should enhance summary with platform metadata', async () => {
      const mockTranscript = {
        id: 'test-transcript',
        platform: 'teams',
        title: 'Test Meeting',
        createdAt: new Date('2024-01-01T10:00:00Z'),
        content: { segments: [] },
        platformMetadata: {
          duration: 3600,
          participantCount: 5,
          meetingType: 'scheduled',
          chatThreadId: 'thread-123'
        },
        exportFormats: ['json', 'docx'],
        sharingCapabilities: { chatIntegration: true }
      };

      const mockSummary = {
        keyPoints: ['Point 1'],
        actionItems: [],
        decisions: []
      };

      const enhanced = await summaryService._enhanceSummaryWithPlatformData(mockSummary, mockTranscript);

      expect(enhanced).toHaveProperty('platform', 'teams');
      expect(enhanced).toHaveProperty('meetingMetadata');
      expect(enhanced.meetingMetadata).toEqual({
        title: 'Test Meeting',
        date: mockTranscript.createdAt,
        duration: 3600,
        participantCount: 5,
        meetingType: 'scheduled',
        platform: 'teams'
      });
      expect(enhanced).toHaveProperty('deliveryMetadata');
      expect(enhanced.deliveryMetadata.supportedFormats).toEqual(['json', 'docx']);
      expect(enhanced).toHaveProperty('teamsSpecific');
      expect(enhanced.teamsSpecific.chatThreadId).toBe('thread-123');
    });

    it('should handle missing platform metadata gracefully', async () => {
      const mockTranscript = {
        id: 'minimal-transcript',
        platform: 'generic',
        title: 'Minimal Meeting',
        createdAt: new Date(),
        content: { segments: [] }
      };

      const mockSummary = {
        keyPoints: ['Point 1']
      };

      const enhanced = await summaryService._enhanceSummaryWithPlatformData(mockSummary, mockTranscript);

      expect(enhanced).toHaveProperty('platform', 'generic');
      expect(enhanced).toHaveProperty('meetingMetadata');
      expect(enhanced.meetingMetadata.duration).toBe(0);
      expect(enhanced.meetingMetadata.participantCount).toBe(0);
      expect(enhanced).not.toHaveProperty('teamsSpecific');
      expect(enhanced).not.toHaveProperty('zoomSpecific');
      expect(enhanced).not.toHaveProperty('meetSpecific');
    });
  });

  describe('Logging and audit', () => {
    it('should log summary delivery activities', async () => {
      const mockTranscript = {
        id: 'test-transcript',
        platform: 'teams',
        content: { segments: [] }
      };

      mockTranscriptStorage.getTranscript.mockResolvedValue(mockTranscript);
      mockSummaryService.generateSummary.mockResolvedValue({ keyPoints: [] });
      mockSecurityManager.checkSummaryDeliveryPermissions.mockResolvedValue(true);

      await summaryService.generateAndDeliverSummary('test-transcript', {
        method: 'email',
        userId: 'user123'
      });

      expect(mockSecurityManager.logActivity).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'summary_delivery',
          transcriptId: 'test-transcript',
          deliveryMethod: 'email',
          userId: 'user123'
        })
      );
    });

    it('should handle logging when security manager is not available', async () => {
      const summaryServiceWithoutSecurity = new CrossPlatformSummaryService(
        mockSummaryService,
        mockTranscriptStorage,
        null // No security manager
      );

      const mockTranscript = {
        id: 'test-transcript',
        platform: 'teams',
        content: { segments: [] }
      };

      mockTranscriptStorage.getTranscript.mockResolvedValue(mockTranscript);
      mockSummaryService.generateSummary.mockResolvedValue({ keyPoints: [] });

      // Should not throw error when security manager is null
      await expect(
        summaryServiceWithoutSecurity.generateAndDeliverSummary('test-transcript')
      ).resolves.toBeDefined();
    });
  });

  describe('Scheduled delivery management', () => {
    beforeEach(() => {
      localStorage.clear();
    });

    it('should store and retrieve scheduled deliveries', async () => {
      const deliveryTime = Date.now() + 60000;
      
      const scheduleId = await summaryService.scheduleSummaryDelivery(
        'test-transcript',
        { method: 'email' },
        { deliveryTime }
      );

      // Verify storage
      const stored = localStorage.getItem('scheduledSummaryDeliveries');
      const deliveries = JSON.parse(stored);
      
      expect(deliveries).toHaveLength(1);
      expect(deliveries[0].id).toBe(scheduleId);
      expect(deliveries[0].transcriptId).toBe('test-transcript');
      expect(deliveries[0].status).toBe('scheduled');
    });

    it('should update scheduled delivery status', async () => {
      const scheduleId = 'test-schedule-123';
      
      // Store initial delivery
      const delivery = {
        id: scheduleId,
        transcriptId: 'test-transcript',
        status: 'scheduled',
        createdAt: new Date()
      };
      
      localStorage.setItem('scheduledSummaryDeliveries', JSON.stringify([delivery]));

      // Update status
      await summaryService._updateScheduledDeliveryStatus(scheduleId, 'completed');

      // Verify update
      const stored = localStorage.getItem('scheduledSummaryDeliveries');
      const deliveries = JSON.parse(stored);
      
      expect(deliveries[0].status).toBe('completed');
      expect(deliveries[0]).toHaveProperty('completedAt');
    });

    it('should handle error in scheduled delivery status update', async () => {
      const scheduleId = 'test-schedule-456';
      const errorMessage = 'Delivery failed';
      
      // Store initial delivery
      const delivery = {
        id: scheduleId,
        transcriptId: 'test-transcript',
        status: 'scheduled',
        createdAt: new Date()
      };
      
      localStorage.setItem('scheduledSummaryDeliveries', JSON.stringify([delivery]));

      // Update with error
      await summaryService._updateScheduledDeliveryStatus(scheduleId, 'failed', errorMessage);

      // Verify error handling
      const stored = localStorage.getItem('scheduledSummaryDeliveries');
      const deliveries = JSON.parse(stored);
      
      expect(deliveries[0].status).toBe('failed');
      expect(deliveries[0].error).toBe(errorMessage);
    });
  });
});