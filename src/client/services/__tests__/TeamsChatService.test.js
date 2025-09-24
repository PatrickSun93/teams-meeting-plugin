/**
 * Teams Chat Service Tests
 * Tests for sending transcripts and summaries to Teams chat
 */

import TeamsChatService from '../TeamsChatService.js';

// Mock Teams Adapter
class MockTeamsAdapter {
  constructor(options = {}) {
    this.mockOptions = {
      hasPermission: true,
      isHost: true,
      meetingState: 'active',
      sendMessageSuccess: true,
      ...options
    };
  }

  getMeetingInfo() {
    return {
      id: 'test-meeting-123',
      title: 'Test Meeting',
      state: this.mockOptions.meetingState,
      context: { meeting: { id: 'test-meeting-123' } }
    };
  }

  getHostStatus() {
    return this.mockOptions.isHost;
  }

  getPlatformCapabilities() {
    return {
      supportsChatIntegration: true,
      supportsAgendaAccess: true,
      supportsParticipantInfo: true,
      supportsHostDetection: true,
      audioQuality: 'high',
      platform: 'teams'
    };
  }

  async sendMessageToChat(message) {
    if (this.mockOptions.sendMessageSuccess) {
      return {
        success: true,
        messageId: `msg_${Date.now()}`,
        timestamp: new Date().toISOString()
      };
    } else {
      return {
        success: false,
        error: 'Mock send failure'
      };
    }
  }
}

// Mock transcript data
const mockTranscript = {
  meetingId: 'test-meeting-123',
  meetingTitle: 'Test Meeting',
  startTime: new Date('2024-01-01T10:00:00Z'),
  endTime: new Date('2024-01-01T11:00:00Z'),
  segments: [
    {
      id: 'seg1',
      speakerId: 'John Doe',
      text: 'Hello everyone, welcome to the meeting.',
      startTime: 1704103200000,
      endTime: 1704103205000,
      confidence: 0.95
    },
    {
      id: 'seg2',
      speakerId: 'Jane Smith',
      text: 'Thank you John. Let\'s start with the agenda.',
      startTime: 1704103205000,
      endTime: 1704103210000,
      confidence: 0.92
    }
  ],
  speakers: ['John Doe', 'Jane Smith']
};

// Mock summary data
const mockSummary = {
  meetingId: 'test-meeting-123',
  keyPoints: [
    'Discussed project timeline',
    'Reviewed budget constraints'
  ],
  decisions: [
    'Approved new feature development',
    'Delayed launch by one week'
  ],
  actionItems: [
    {
      task: 'Update project documentation',
      assignee: 'John Doe',
      dueDate: 'next Friday'
    },
    {
      task: 'Schedule follow-up meeting',
      assignee: 'Jane Smith',
      dueDate: 'this week'
    }
  ],
  nextSteps: [
    'Begin development phase',
    'Prepare marketing materials'
  ],
  participants: ['John Doe', 'Jane Smith'],
  metadata: {
    generatedAt: new Date().toISOString(),
    provider: 'openai_gpt',
    model: 'gpt-4',
    meetingDuration: 60
  }
};

describe('TeamsChatService', () => {
  let chatService;
  let mockTeamsAdapter;

  beforeEach(() => {
    chatService = new TeamsChatService();
    mockTeamsAdapter = new MockTeamsAdapter();
    chatService.setTeamsAdapter(mockTeamsAdapter);
  });

  describe('Initialization', () => {
    test('should initialize with default configuration', () => {
      const service = new TeamsChatService();
      const status = service.getStatus();
      
      expect(status.maxMessageLength).toBe(4000);
      expect(status.maxMessagesPerBatch).toBe(5);
      expect(status.retryAttempts).toBe(3);
      expect(status.retryDelay).toBe(1000);
      expect(status.initialized).toBe(false);
    });

    test('should set Teams adapter correctly', () => {
      const service = new TeamsChatService();
      const adapter = new MockTeamsAdapter();
      
      service.setTeamsAdapter(adapter);
      const status = service.getStatus();
      
      expect(status.initialized).toBe(true);
    });

    test('should update configuration', () => {
      chatService.updateConfig({
        maxMessageLength: 5000,
        retryAttempts: 5
      });
      
      const status = chatService.getStatus();
      expect(status.maxMessageLength).toBe(5000);
      expect(status.retryAttempts).toBe(5);
    });
  });

  describe('Permission Checking', () => {
    test('should check permissions successfully when host', async () => {
      const permissions = await chatService.checkChatPermissions();
      
      expect(permissions.hasPermission).toBe(true);
      expect(permissions.meetingId).toBe('test-meeting-123');
      expect(permissions.capabilities.supportsChatIntegration).toBe(true);
    });

    test('should deny permissions when not host', async () => {
      mockTeamsAdapter.mockOptions.isHost = false;
      
      const permissions = await chatService.checkChatPermissions();
      
      expect(permissions.hasPermission).toBe(false);
      expect(permissions.error).toContain('Only meeting host');
    });

    test('should deny permissions when not in meeting', async () => {
      mockTeamsAdapter.mockOptions.meetingState = 'ended';
      
      const permissions = await chatService.checkChatPermissions();
      
      expect(permissions.hasPermission).toBe(false);
      expect(permissions.error).toContain('Not in an active meeting');
    });

    test('should handle adapter not initialized', async () => {
      const service = new TeamsChatService();
      
      const permissions = await service.checkChatPermissions();
      
      expect(permissions.hasPermission).toBe(false);
      expect(permissions.error).toContain('Teams adapter not initialized');
    });
  });

  describe('Transcript Formatting', () => {
    test('should format transcript with default options', () => {
      const formatted = chatService.formatTranscriptForChat(mockTranscript);
      
      expect(formatted).toContain('📝 **Meeting Transcript**');
      expect(formatted).toContain('**Meeting:** Test Meeting');
      expect(formatted).toContain('**John Doe:** Hello everyone');
      expect(formatted).toContain('**Jane Smith:** Thank you John');
      expect(formatted).toContain('📊 **Summary:**');
    });

    test('should format transcript without header', () => {
      const formatted = chatService.formatTranscriptForChat(mockTranscript, {
        includeHeader: false
      });
      
      expect(formatted).not.toContain('📝 **Meeting Transcript**');
      expect(formatted).toContain('**John Doe:** Hello everyone');
    });

    test('should format transcript without footer', () => {
      const formatted = chatService.formatTranscriptForChat(mockTranscript, {
        includeFooter: false
      });
      
      expect(formatted).toContain('**John Doe:** Hello everyone');
      expect(formatted).not.toContain('📊 **Summary:**');
    });

    test('should limit segments when maxSegments specified', () => {
      const formatted = chatService.formatTranscriptForChat(mockTranscript, {
        maxSegments: 1
      });
      
      expect(formatted).toContain('**John Doe:** Hello everyone');
      expect(formatted).not.toContain('**Jane Smith:** Thank you John');
    });

    test('should handle empty transcript', () => {
      const emptyTranscript = {
        meetingId: 'test',
        segments: [],
        speakers: []
      };
      
      const formatted = chatService.formatTranscriptForChat(emptyTranscript);
      
      expect(formatted).toContain('📝 **Meeting Transcript**');
      expect(formatted).toContain('No speakers identified');
    });
  });

  describe('Summary Formatting', () => {
    test('should format summary with all sections', () => {
      const formatted = chatService.formatSummaryForChat(mockSummary);
      
      expect(formatted).toContain('🎯 **Meeting Summary**');
      expect(formatted).toContain('📋 Key Discussion Points');
      expect(formatted).toContain('✅ Decisions Made');
      expect(formatted).toContain('📝 Action Items');
      expect(formatted).toContain('🚀 Next Steps');
      expect(formatted).toContain('John Doe, Jane Smith');
    });

    test('should format action items with assignees', () => {
      const formatted = chatService.formatSummaryForChat(mockSummary);
      
      expect(formatted).toContain('Update project documentation (John Doe)');
      expect(formatted).toContain('Due: next Friday');
    });

    test('should handle summary without optional sections', () => {
      const minimalSummary = {
        meetingId: 'test',
        keyPoints: ['Main point'],
        participants: ['John']
      };
      
      const formatted = chatService.formatSummaryForChat(minimalSummary);
      
      expect(formatted).toContain('🎯 **Meeting Summary**');
      expect(formatted).toContain('Main point');
      expect(formatted).not.toContain('📝 Action Items');
    });
  });

  describe('Message Splitting', () => {
    test('should not split short messages', () => {
      const shortMessage = 'This is a short message';
      const parts = chatService.splitLongMessage(shortMessage);
      
      expect(parts).toHaveLength(1);
      expect(parts[0]).toBe(shortMessage);
    });

    test('should split long messages', () => {
      const longMessage = 'This is a very long line that should be split. '.repeat(100);
      const parts = chatService.splitLongMessage(longMessage, 1000);
      
      expect(parts.length).toBeGreaterThan(1);
      parts.forEach(part => {
        expect(part.length).toBeLessThanOrEqual(1050); // Allow for part headers
      });
    });

    test('should add part numbers to split messages', () => {
      const longMessage = 'Line 1\n' + 'B'.repeat(3000) + '\nLine 2\n' + 'C'.repeat(3000);
      const parts = chatService.splitLongMessage(longMessage, 2000);
      
      expect(parts.length).toBeGreaterThan(1);
      expect(parts[0]).toContain('**Part 1/');
      expect(parts[1]).toContain('**Part 2/');
    });

    test('should split by sentences when lines are too long', () => {
      const longSentence = 'This is a very long sentence. '.repeat(200);
      const parts = chatService.splitBySentences(longSentence, 1000);
      
      expect(parts.length).toBeGreaterThan(1);
      parts.forEach(part => {
        expect(part.length).toBeLessThanOrEqual(1000);
      });
    });

    test('should split by words when sentences are too long', () => {
      const longWords = 'word '.repeat(500);
      const parts = chatService.splitByWords(longWords, 1000);
      
      expect(parts.length).toBeGreaterThan(1);
      parts.forEach(part => {
        expect(part.length).toBeLessThanOrEqual(1000);
      });
    });
  });

  describe('Sending Transcript', () => {
    test('should send transcript successfully', async () => {
      const result = await chatService.sendTranscriptToChat(mockTranscript);
      
      expect(result.success).toBe(true);
      expect(result.messagesSent).toBe(1);
      expect(result.results).toHaveLength(1);
    });

    test('should handle send failure with alternative methods', async () => {
      mockTeamsAdapter.mockOptions.sendMessageSuccess = false;
      
      const result = await chatService.sendTranscriptToChat(mockTranscript);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Failed to send');
      expect(result.alternativeMethod).toBeDefined();
      expect(result.alternativeMethod.alternatives.length).toBeGreaterThanOrEqual(3);
    });

    test('should handle permission denied', async () => {
      mockTeamsAdapter.mockOptions.isHost = false;
      
      const result = await chatService.sendTranscriptToChat(mockTranscript);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Only meeting host');
      expect(result.alternativeMethod).toBeDefined();
    });

    test('should split and send long transcripts', async () => {
      const longTranscript = {
        ...mockTranscript,
        segments: Array(50).fill(null).map((_, i) => ({
          id: `seg${i}`,
          speakerId: 'Speaker',
          text: 'This is a long segment with lots of text. '.repeat(10),
          startTime: Date.now(),
          endTime: Date.now(),
          confidence: 0.9
        }))
      };
      
      const result = await chatService.sendTranscriptToChat(longTranscript);
      
      expect(result.success).toBe(true);
      expect(result.messagesSent).toBeGreaterThanOrEqual(1);
    }, 10000);
  });

  describe('Sending Summary', () => {
    test('should send summary successfully', async () => {
      const result = await chatService.sendSummaryToChat(mockSummary);
      
      expect(result.success).toBe(true);
      expect(result.messagesSent).toBe(1);
      expect(result.results).toHaveLength(1);
    });

    test('should handle send failure', async () => {
      mockTeamsAdapter.mockOptions.sendMessageSuccess = false;
      
      const result = await chatService.sendSummaryToChat(mockSummary);
      
      expect(result.success).toBe(false);
      expect(result.alternativeMethod).toBeDefined();
    });

    test('should format summary with custom options', async () => {
      const result = await chatService.sendSummaryToChat(mockSummary, {
        includeMetadata: false,
        includeActionItems: false
      });
      
      expect(result.success).toBe(true);
    });
  });

  describe('Alternative Delivery Methods', () => {
    test('should provide alternative methods when chat fails', () => {
      const alternatives = chatService.getAlternativeDeliveryMethod(mockTranscript);
      
      expect(alternatives.alternatives.length).toBeGreaterThanOrEqual(3);
      expect(alternatives.alternatives.some(alt => alt.method === 'download')).toBe(true);
      expect(alternatives.alternatives.some(alt => alt.method === 'email')).toBe(true);
      expect(alternatives.alternatives.some(alt => alt.method === 'storage')).toBe(true);
    });

    test('should handle download alternative', () => {
      // Mock DOM elements
      const mockLink = {
        href: '',
        download: '',
        click: jest.fn()
      };
      
      document.createElement = jest.fn().mockReturnValue(mockLink);
      document.body.appendChild = jest.fn();
      document.body.removeChild = jest.fn();
      
      global.URL.createObjectURL = jest.fn().mockReturnValue('blob:url');
      global.URL.revokeObjectURL = jest.fn();
      
      const result = chatService.downloadAsFile(mockTranscript, 'transcript');
      
      expect(result.success).toBe(true);
      expect(mockLink.click).toHaveBeenCalled();
    });

    test('should handle clipboard alternative', async () => {
      // Mock clipboard API
      global.navigator.clipboard = {
        writeText: jest.fn().mockResolvedValue()
      };
      
      const result = await chatService.copyToClipboard(mockTranscript, 'transcript');
      
      expect(result.success).toBe(true);
      expect(navigator.clipboard.writeText).toHaveBeenCalled();
    });

    test('should handle email alternative', () => {
      global.window.open = jest.fn();
      
      const result = chatService.sendViaEmail(mockTranscript, 'transcript');
      
      expect(result.success).toBe(true);
      expect(window.open).toHaveBeenCalledWith(expect.stringContaining('mailto:'));
    });

    test('should handle local storage alternative', () => {
      const mockSetItem = jest.fn();
      
      // Mock localStorage
      Object.defineProperty(global, 'localStorage', {
        value: {
          setItem: mockSetItem
        },
        writable: true
      });
      
      const result = chatService.saveToLocalStorage(mockTranscript, 'transcript');
      
      expect(result.success).toBe(true);
      expect(mockSetItem).toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    test('should handle missing transcript', async () => {
      const result = await chatService.sendTranscriptToChat(null);
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('No transcript provided');
      expect(result.alternativeMethod).toBeDefined();
    });

    test('should handle missing summary', async () => {
      const result = await chatService.sendSummaryToChat(null);
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('No summary provided');
      expect(result.alternativeMethod).toBeDefined();
    });

    test('should handle adapter errors', async () => {
      chatService.setTeamsAdapter(null);
      
      const permissions = await chatService.checkChatPermissions();
      
      expect(permissions.hasPermission).toBe(false);
      expect(permissions.error).toContain('Teams adapter not initialized');
    });

    test('should retry failed messages', async () => {
      let attempts = 0;
      mockTeamsAdapter.sendMessageToChat = jest.fn().mockImplementation(() => {
        attempts++;
        if (attempts < 3) {
          return Promise.resolve({ success: false, error: 'Temporary failure' });
        }
        return Promise.resolve({ success: true, messageId: 'msg123' });
      });
      
      const result = await chatService.sendMessageWithRetry('Test message');
      
      expect(result.success).toBe(true);
      expect(result.attempt).toBe(3);
      expect(mockTeamsAdapter.sendMessageToChat).toHaveBeenCalledTimes(3);
    });

    test('should fail after max retry attempts', async () => {
      mockTeamsAdapter.sendMessageToChat = jest.fn().mockResolvedValue({
        success: false,
        error: 'Persistent failure'
      });
      
      const result = await chatService.sendMessageWithRetry('Test message');
      
      expect(result.success).toBe(false);
      expect(result.attempts).toBe(3);
      expect(mockTeamsAdapter.sendMessageToChat).toHaveBeenCalledTimes(3);
    });
  });

  describe('Utility Functions', () => {
    test('should calculate transcript duration', () => {
      const transcriptWithDuration = {
        segments: [
          {
            id: 'seg1',
            startTime: 0,
            endTime: 1800000 // 30 minutes
          },
          {
            id: 'seg2',
            startTime: 1800000, // 30 minutes
            endTime: 3600000 // 1 hour total
          }
        ]
      };
      
      const duration = chatService.calculateTranscriptDuration(transcriptWithDuration);
      expect(duration).toBe(60); // 1 hour in minutes
    });

    test('should format participants list', () => {
      const formatted = chatService.formatParticipantsList(['John', 'Jane']);
      expect(formatted).toBe('John, Jane');
    });

    test('should format empty participants list', () => {
      const formatted = chatService.formatParticipantsList([]);
      expect(formatted).toBe('No speakers identified');
    });

    test('should format speaker segment', () => {
      const formatted = chatService.formatSpeakerSegment('John', 'Hello world', Date.now());
      expect(formatted).toContain('**John:** Hello world');
    });

    test('should add delay', async () => {
      const start = Date.now();
      await chatService.delay(100);
      const end = Date.now();
      
      expect(end - start).toBeGreaterThanOrEqual(90); // Allow some variance
    });
  });
});

// Integration tests with real Teams SDK (when available)
describe('TeamsChatService Integration', () => {
  test('should integrate with real Teams adapter', () => {
    // This would test with actual Teams SDK when available
    // For now, we use mocks to verify the integration points
    const chatService = new TeamsChatService();
    const mockAdapter = new MockTeamsAdapter();
    
    chatService.setTeamsAdapter(mockAdapter);
    
    expect(chatService.getStatus().initialized).toBe(true);
  });
});