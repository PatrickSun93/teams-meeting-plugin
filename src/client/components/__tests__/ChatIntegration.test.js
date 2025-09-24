/**
 * Chat Integration Component Tests
 * Tests for the ChatIntegration React component
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import ChatIntegration from '../ChatIntegration.js';

// Mock the TeamsChatService
jest.mock('../../services/TeamsChatService.js', () => {
  return jest.fn().mockImplementation(() => ({
    setTeamsAdapter: jest.fn(),
    checkChatPermissions: jest.fn(),
    sendTranscriptToChat: jest.fn(),
    sendSummaryToChat: jest.fn(),
    formatTranscriptForChat: jest.fn().mockReturnValue('Formatted transcript'),
    formatSummaryForChat: jest.fn().mockReturnValue('Formatted summary'),
    getStatus: jest.fn().mockReturnValue({
      initialized: true,
      maxMessageLength: 4000
    })
  }));
});

// Mock Teams Adapter
const mockTeamsAdapter = {
  getMeetingInfo: jest.fn().mockReturnValue({
    id: 'test-meeting',
    state: 'active'
  }),
  getHostStatus: jest.fn().mockReturnValue(true),
  getPlatformCapabilities: jest.fn().mockReturnValue({
    supportsChatIntegration: true
  })
};

// Mock transcript data
const mockTranscript = {
  meetingId: 'test-meeting-123',
  segments: [
    {
      id: 'seg1',
      speakerId: 'John Doe',
      text: 'Hello everyone',
      confidence: 0.95
    }
  ],
  speakers: ['John Doe']
};

// Mock summary data
const mockSummary = {
  meetingId: 'test-meeting-123',
  keyPoints: ['Discussed project timeline'],
  actionItems: [{ task: 'Update documentation', assignee: 'John' }],
  participants: ['John Doe']
};

describe('ChatIntegration Component', () => {
  let mockChatService;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Get the mocked chat service instance
    const TeamsChatService = require('../../services/TeamsChatService.js');
    mockChatService = new TeamsChatService();

    // Set up default mock implementations
    mockChatService.checkChatPermissions.mockResolvedValue({
      hasPermission: true,
      meetingId: 'test-meeting',
      capabilities: { supportsChatIntegration: true }
    });
  });

  describe('Rendering', () => {
    test('should render loading state when no Teams adapter', () => {
      render(
        <ChatIntegration
          teamsAdapter={null}
          transcript={null}
          summary={null}
        />
      );

      expect(screen.getByText('Waiting for Teams connection...')).toBeInTheDocument();
    });

    test('should render chat integration when Teams adapter available', () => {
      render(
        <ChatIntegration
          teamsAdapter={mockTeamsAdapter}
          transcript={mockTranscript}
          summary={mockSummary}
        />
      );

      expect(screen.getByText('📤 Send to Teams Chat')).toBeInTheDocument();
      expect(screen.getByText('📝 Send Transcript')).toBeInTheDocument();
      expect(screen.getByText('🎯 Send Summary')).toBeInTheDocument();
    });

    test('should show refresh button', () => {
      render(
        <ChatIntegration
          teamsAdapter={mockTeamsAdapter}
          transcript={mockTranscript}
          summary={mockSummary}
        />
      );

      expect(screen.getByTitle('Refresh permissions')).toBeInTheDocument();
    });
  });

  describe('Permission Checking', () => {
    test('should check permissions on mount', async () => {
      mockChatService.checkChatPermissions.mockResolvedValue({
        hasPermission: true,
        meetingId: 'test-meeting'
      });

      render(
        <ChatIntegration
          teamsAdapter={mockTeamsAdapter}
          transcript={mockTranscript}
          summary={mockSummary}
        />
      );

      await waitFor(() => {
        expect(mockChatService.checkChatPermissions).toHaveBeenCalled();
      });
    });

    test('should display permission granted status', async () => {
      mockChatService.checkChatPermissions.mockResolvedValue({
        hasPermission: true,
        meetingId: 'test-meeting'
      });

      render(
        <ChatIntegration
          teamsAdapter={mockTeamsAdapter}
          transcript={mockTranscript}
          summary={mockSummary}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Chat integration available')).toBeInTheDocument();
      });
    });

    test('should display permission denied status', async () => {
      mockChatService.checkChatPermissions.mockResolvedValue({
        hasPermission: false,
        error: 'Only meeting host can send messages'
      });

      render(
        <ChatIntegration
          teamsAdapter={mockTeamsAdapter}
          transcript={mockTranscript}
          summary={mockSummary}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Only meeting host can send messages')).toBeInTheDocument();
      });
    });

    test('should refresh permissions when refresh button clicked', async () => {
      mockChatService.checkChatPermissions.mockResolvedValue({
        hasPermission: true,
        meetingId: 'test-meeting'
      });

      render(
        <ChatIntegration
          teamsAdapter={mockTeamsAdapter}
          transcript={mockTranscript}
          summary={mockSummary}
        />
      );

      const refreshButton = screen.getByTitle('Refresh permissions');
      fireEvent.click(refreshButton);

      await waitFor(() => {
        expect(mockChatService.checkChatPermissions).toHaveBeenCalledTimes(2);
      });
    });
  });

  describe('Sending Transcript', () => {
    beforeEach(() => {
      mockChatService.checkChatPermissions.mockResolvedValue({
        hasPermission: true,
        meetingId: 'test-meeting'
      });
    });

    test('should send transcript successfully', async () => {
      mockChatService.sendTranscriptToChat.mockResolvedValue({
        success: true,
        messagesSent: 1
      });

      const onChatSent = jest.fn();

      render(
        <ChatIntegration
          teamsAdapter={mockTeamsAdapter}
          transcript={mockTranscript}
          summary={mockSummary}
          onChatSent={onChatSent}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Chat integration available')).toBeInTheDocument();
      });

      const sendButton = screen.getByText('📝 Send Transcript');
      fireEvent.click(sendButton);

      await waitFor(() => {
        expect(mockChatService.sendTranscriptToChat).toHaveBeenCalledWith(
          mockTranscript,
          expect.objectContaining({
            includeTimestamps: false,
            includeSpeakerLabels: true,
            includeHeader: true,
            includeFooter: true
          })
        );
      });

      await waitFor(() => {
        expect(screen.getByText(/Transcript sent successfully/)).toBeInTheDocument();
        expect(onChatSent).toHaveBeenCalledWith({
          type: 'transcript',
          result: { success: true, messagesSent: 1 }
        });
      });
    });

    test('should handle transcript send failure', async () => {
      mockChatService.sendTranscriptToChat.mockResolvedValue({
        success: false,
        error: 'Network error',
        alternativeMethod: {
          alternatives: [
            { method: 'download', title: 'Download as file', action: jest.fn() }
          ]
        }
      });

      const onError = jest.fn();

      render(
        <ChatIntegration
          teamsAdapter={mockTeamsAdapter}
          transcript={mockTranscript}
          summary={mockSummary}
          onError={onError}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Chat integration available')).toBeInTheDocument();
      });

      const sendButton = screen.getByText('📝 Send Transcript');
      fireEvent.click(sendButton);

      await waitFor(() => {
        expect(screen.getByText('Network error')).toBeInTheDocument();
        expect(screen.getByText('Alternative Delivery Methods')).toBeInTheDocument();
        expect(screen.getByText('Download as file')).toBeInTheDocument();
        expect(onError).toHaveBeenCalled();
      });
    });

    test('should disable send button when no transcript', async () => {
      render(
        <ChatIntegration
          teamsAdapter={mockTeamsAdapter}
          transcript={null}
          summary={mockSummary}
        />
      );

      await waitFor(() => {
        const sendButton = screen.getByText('📝 Send Transcript');
        expect(sendButton).toBeDisabled();
      });
    });

    test('should disable send button when no permissions', async () => {
      mockChatService.checkChatPermissions.mockResolvedValue({
        hasPermission: false,
        error: 'Not host'
      });

      render(
        <ChatIntegration
          teamsAdapter={mockTeamsAdapter}
          transcript={mockTranscript}
          summary={mockSummary}
        />
      );

      await waitFor(() => {
        const sendButton = screen.getByText('📝 Send Transcript');
        expect(sendButton).toBeDisabled();
      });
    });

    test('should show loading state while sending', async () => {
      mockChatService.sendTranscriptToChat.mockImplementation(() =>
        new Promise(resolve => setTimeout(() => resolve({ success: true, messagesSent: 1 }), 100))
      );

      render(
        <ChatIntegration
          teamsAdapter={mockTeamsAdapter}
          transcript={mockTranscript}
          summary={mockSummary}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Chat integration available')).toBeInTheDocument();
      });

      const sendButton = screen.getByText('📝 Send Transcript');
      fireEvent.click(sendButton);

      expect(screen.getByText('Sending...')).toBeInTheDocument();
      expect(sendButton).toBeDisabled();

      await waitFor(() => {
        expect(screen.getByText(/Transcript sent successfully/)).toBeInTheDocument();
      });
    });
  });

  describe('Sending Summary', () => {
    beforeEach(() => {
      mockChatService.checkChatPermissions.mockResolvedValue({
        hasPermission: true,
        meetingId: 'test-meeting'
      });
    });

    test('should send summary successfully', async () => {
      mockChatService.sendSummaryToChat.mockResolvedValue({
        success: true,
        messagesSent: 1
      });

      const onChatSent = jest.fn();

      render(
        <ChatIntegration
          teamsAdapter={mockTeamsAdapter}
          transcript={mockTranscript}
          summary={mockSummary}
          onChatSent={onChatSent}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Chat integration available')).toBeInTheDocument();
      });

      const sendButton = screen.getByText('🎯 Send Summary');
      fireEvent.click(sendButton);

      await waitFor(() => {
        expect(mockChatService.sendSummaryToChat).toHaveBeenCalledWith(
          mockSummary,
          expect.objectContaining({
            includeMetadata: true,
            includeAgendaItems: true,
            includeActionItems: true,
            includeDecisions: true
          })
        );
      });

      await waitFor(() => {
        expect(screen.getByText(/Summary sent successfully/)).toBeInTheDocument();
        expect(onChatSent).toHaveBeenCalledWith({
          type: 'summary',
          result: { success: true, messagesSent: 1 }
        });
      });
    });

    test('should handle summary send failure', async () => {
      mockChatService.sendSummaryToChat.mockResolvedValue({
        success: false,
        error: 'API error',
        alternativeMethod: {
          alternatives: [
            { method: 'clipboard', title: 'Copy to clipboard', action: jest.fn() }
          ]
        }
      });

      render(
        <ChatIntegration
          teamsAdapter={mockTeamsAdapter}
          transcript={mockTranscript}
          summary={mockSummary}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Chat integration available')).toBeInTheDocument();
      });

      const sendButton = screen.getByText('🎯 Send Summary');
      fireEvent.click(sendButton);

      await waitFor(() => {
        expect(screen.getByText('API error')).toBeInTheDocument();
        expect(screen.getByText('Copy to clipboard')).toBeInTheDocument();
      });
    });
  });

  describe('Alternative Delivery Methods', () => {
    test('should execute alternative method when clicked', async () => {
      const mockAction = jest.fn().mockResolvedValue({ success: true });

      mockChatService.sendTranscriptToChat.mockResolvedValue({
        success: false,
        error: 'Chat unavailable',
        alternativeMethod: {
          alternatives: [
            {
              method: 'download',
              title: 'Download as file',
              action: mockAction,
              description: 'Save to computer'
            }
          ]
        }
      });

      render(
        <ChatIntegration
          teamsAdapter={mockTeamsAdapter}
          transcript={mockTranscript}
          summary={mockSummary}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Chat integration available')).toBeInTheDocument();
      });

      // Trigger transcript send to show alternatives
      const sendButton = screen.getByText('📝 Send Transcript');
      fireEvent.click(sendButton);

      await waitFor(() => {
        expect(screen.getByText('Alternative Delivery Methods')).toBeInTheDocument();
      });

      // Click alternative method
      const altButton = screen.getByText('Download as file');
      fireEvent.click(altButton);

      await waitFor(() => {
        expect(mockAction).toHaveBeenCalled();
        expect(screen.getByText(/Content delivered via download/)).toBeInTheDocument();
      });
    });

    test('should handle alternative method failure', async () => {
      const mockAction = jest.fn().mockResolvedValue({
        success: false,
        error: 'Download failed'
      });

      mockChatService.sendTranscriptToChat.mockResolvedValue({
        success: false,
        error: 'Chat unavailable',
        alternativeMethod: {
          alternatives: [
            { method: 'download', title: 'Download as file', action: mockAction }
          ]
        }
      });

      render(
        <ChatIntegration
          teamsAdapter={mockTeamsAdapter}
          transcript={mockTranscript}
          summary={mockSummary}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Chat integration available')).toBeInTheDocument();
      });

      const sendButton = screen.getByText('📝 Send Transcript');
      fireEvent.click(sendButton);

      await waitFor(() => {
        const altButton = screen.getByText('Download as file');
        fireEvent.click(altButton);
      });

      await waitFor(() => {
        expect(screen.getByText(/Failed to deliver via download/)).toBeInTheDocument();
      });
    });
  });

  describe('Content Preview', () => {
    test('should show content preview when available', () => {
      render(
        <ChatIntegration
          teamsAdapter={mockTeamsAdapter}
          transcript={mockTranscript}
          summary={mockSummary}
        />
      );

      expect(screen.getByText('Preview content to be sent')).toBeInTheDocument();
    });

    test('should expand preview when clicked', () => {
      render(
        <ChatIntegration
          teamsAdapter={mockTeamsAdapter}
          transcript={mockTranscript}
          summary={mockSummary}
        />
      );

      const previewToggle = screen.getByText('Preview content to be sent');
      fireEvent.click(previewToggle);

      expect(screen.getByText('Transcript Preview:')).toBeInTheDocument();
      expect(screen.getByText('Summary Preview:')).toBeInTheDocument();
    });
  });

  describe('Status Management', () => {
    test('should clear status when close button clicked', async () => {
      mockChatService.sendTranscriptToChat.mockResolvedValue({
        success: true,
        messagesSent: 1
      });

      render(
        <ChatIntegration
          teamsAdapter={mockTeamsAdapter}
          transcript={mockTranscript}
          summary={mockSummary}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Chat integration available')).toBeInTheDocument();
      });

      const sendButton = screen.getByText('📝 Send Transcript');
      fireEvent.click(sendButton);

      await waitFor(() => {
        expect(screen.getByText(/Transcript sent successfully/)).toBeInTheDocument();
      });

      const closeButton = screen.getByText('×');
      fireEvent.click(closeButton);

      expect(screen.queryByText(/Transcript sent successfully/)).not.toBeInTheDocument();
    });
  });

  describe('Debug Information', () => {
    test('should show debug info in development mode', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      mockChatService.checkChatPermissions.mockResolvedValue({
        hasPermission: true,
        meetingId: 'test-meeting',
        capabilities: { supportsChatIntegration: true }
      });

      render(
        <ChatIntegration
          teamsAdapter={mockTeamsAdapter}
          transcript={mockTranscript}
          summary={mockSummary}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Debug: Chat Integration Status')).toBeInTheDocument();
      });

      process.env.NODE_ENV = originalEnv;
    });

    test('should not show debug info in production mode', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      mockChatService.checkChatPermissions.mockResolvedValue({
        hasPermission: true,
        meetingId: 'test-meeting'
      });

      render(
        <ChatIntegration
          teamsAdapter={mockTeamsAdapter}
          transcript={mockTranscript}
          summary={mockSummary}
        />
      );

      await waitFor(() => {
        expect(screen.queryByText('Debug: Chat Integration Status')).not.toBeInTheDocument();
      });

      process.env.NODE_ENV = originalEnv;
    });
  });

  describe('Error Handling', () => {
    test('should handle permission check errors', async () => {
      mockChatService.checkChatPermissions.mockRejectedValue(
        new Error('Permission check failed')
      );

      render(
        <ChatIntegration
          teamsAdapter={mockTeamsAdapter}
          transcript={mockTranscript}
          summary={mockSummary}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Permission check failed')).toBeInTheDocument();
      });
    });

    test('should handle send errors', async () => {
      mockChatService.checkChatPermissions.mockResolvedValue({
        hasPermission: true,
        meetingId: 'test-meeting'
      });

      mockChatService.sendTranscriptToChat.mockRejectedValue(
        new Error('Network error')
      );

      const onError = jest.fn();

      render(
        <ChatIntegration
          teamsAdapter={mockTeamsAdapter}
          transcript={mockTranscript}
          summary={mockSummary}
          onError={onError}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Chat integration available')).toBeInTheDocument();
      });

      const sendButton = screen.getByText('📝 Send Transcript');
      fireEvent.click(sendButton);

      await waitFor(() => {
        expect(screen.getByText('Network error')).toBeInTheDocument();
        expect(onError).toHaveBeenCalledWith(expect.any(Error));
      });
    });
  });
});