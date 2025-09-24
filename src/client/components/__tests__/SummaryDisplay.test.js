import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SummaryDisplay from '../SummaryDisplay.js';

// Mock clipboard API
Object.assign(navigator, {
  clipboard: {
    writeText: jest.fn()
  }
});

describe('SummaryDisplay', () => {
  const mockSummary = {
    meetingId: 'test-meeting-123',
    rawSummary: 'This is the raw AI-generated summary text.',
    keyPoints: [
      'Discussed project timeline and milestones',
      'Reviewed budget allocation for Q2',
      'Addressed team resource concerns'
    ],
    decisions: [
      'Approved additional budget for development team',
      'Extended project deadline by 2 weeks'
    ],
    actionItems: [
      {
        task: 'Update project timeline document',
        assignee: 'John',
        dueDate: 'next Friday',
        priority: 'high'
      },
      {
        task: 'Schedule follow-up meeting with stakeholders',
        assignee: 'Sarah',
        priority: 'normal'
      },
      {
        task: 'Prepare budget proposal for review'
      }
    ],
    nextSteps: [
      'Review updated timeline with team',
      'Submit budget proposal to finance'
    ],
    agendaItems: [
      {
        id: 'item1',
        title: 'Project Status Review',
        discussed: true,
        status: 'completed',
        summary: 'Reviewed current progress and identified blockers'
      },
      {
        id: 'item2',
        title: 'Budget Planning',
        discussed: false,
        status: 'not_discussed'
      }
    ],
    participants: ['John Doe', 'Sarah Smith', 'Mike Johnson'],
    metadata: {
      generatedAt: '2024-01-15T10:30:00Z',
      provider: 'openai_gpt',
      model: 'gpt-4',
      meetingDuration: 45
    }
  };

  const defaultProps = {
    summary: mockSummary,
    isGenerating: false,
    onRegenerateSummary: jest.fn(),
    onExportSummary: jest.fn(),
    onSendToChat: jest.fn()
  };

  beforeEach(() => {
    jest.clearAllMocks();
    navigator.clipboard.writeText.mockResolvedValue();
  });

  describe('Rendering States', () => {
    test('should render generating state', () => {
      render(<SummaryDisplay {...defaultProps} isGenerating={true} summary={null} />);

      expect(screen.getByText('Generating Summary...')).toBeInTheDocument();
      expect(screen.getByText('AI is analyzing the meeting transcript and creating your summary.')).toBeInTheDocument();
      expect(document.querySelector('.spinner')).toBeInTheDocument();
    });

    test('should render empty state', () => {
      render(<SummaryDisplay {...defaultProps} summary={null} />);

      expect(screen.getByText('No Summary Available')).toBeInTheDocument();
      expect(screen.getByText('Generate a summary after the meeting ends to see AI-powered insights.')).toBeInTheDocument();
    });

    test('should render complete summary', () => {
      render(<SummaryDisplay {...defaultProps} />);

      expect(screen.getByText('Meeting Summary')).toBeInTheDocument();
      expect(screen.getByText('Participants')).toBeInTheDocument();
      expect(screen.getByText('Key Discussion Points')).toBeInTheDocument();
      expect(screen.getByText('Decisions Made')).toBeInTheDocument();
      expect(screen.getByText('Action Items')).toBeInTheDocument();
      expect(screen.getByText('Next Steps')).toBeInTheDocument();
      expect(screen.getByText('Agenda Items Status')).toBeInTheDocument();
    });
  });

  describe('Summary Header', () => {
    test('should display metadata information', () => {
      render(<SummaryDisplay {...defaultProps} />);

      expect(screen.getByText(/Generated:/)).toBeInTheDocument();
      expect(screen.getByText(/Provider: openai_gpt/)).toBeInTheDocument();
      expect(screen.getByText(/Duration: 45 min/)).toBeInTheDocument();
    });

    test('should render action buttons', () => {
      render(<SummaryDisplay {...defaultProps} />);

      expect(screen.getByText('📋 Copy')).toBeInTheDocument();
      expect(screen.getByText('📄 Export')).toBeInTheDocument();
      expect(screen.getByText('💬 Send to Chat')).toBeInTheDocument();
      expect(screen.getByText('🔄 Regenerate')).toBeInTheDocument();
    });

    test('should not render optional action buttons when handlers not provided', () => {
      render(<SummaryDisplay summary={mockSummary} isGenerating={false} />);

      expect(screen.getByText('📋 Copy')).toBeInTheDocument();
      expect(screen.queryByText('📄 Export')).not.toBeInTheDocument();
      expect(screen.queryByText('💬 Send to Chat')).not.toBeInTheDocument();
      expect(screen.queryByText('🔄 Regenerate')).not.toBeInTheDocument();
    });
  });

  describe('Participants Section', () => {
    test('should display participants', () => {
      render(<SummaryDisplay {...defaultProps} />);

      expect(screen.getByText('John Doe')).toBeInTheDocument();
      expect(screen.getByText('Sarah Smith')).toBeInTheDocument();
      expect(screen.getByText('Mike Johnson')).toBeInTheDocument();
    });

    test('should not render participants section when empty', () => {
      const summaryWithoutParticipants = { ...mockSummary, participants: [] };
      render(<SummaryDisplay {...defaultProps} summary={summaryWithoutParticipants} />);

      expect(screen.queryByText('Participants')).not.toBeInTheDocument();
    });
  });

  describe('Section Expansion', () => {
    test('should expand and collapse sections', async () => {
      const user = userEvent.setup();
      render(<SummaryDisplay {...defaultProps} />);

      // Key Points should be expanded by default
      expect(screen.getByText('Discussed project timeline and milestones')).toBeInTheDocument();

      // Click to collapse
      const keyPointsHeader = screen.getByText('Key Discussion Points');
      await user.click(keyPointsHeader);

      expect(screen.queryByText('Discussed project timeline and milestones')).not.toBeInTheDocument();

      // Click to expand again
      await user.click(keyPointsHeader);

      expect(screen.getByText('Discussed project timeline and milestones')).toBeInTheDocument();
    });

    test('should show expand/collapse icons', () => {
      render(<SummaryDisplay {...defaultProps} />);

      const expandIcons = document.querySelectorAll('.expand-icon');
      expect(expandIcons.length).toBeGreaterThan(0);

      // Key Points should be expanded (rotated icon)
      const keyPointsIcon = expandIcons[0];
      expect(keyPointsIcon).toHaveClass('expanded');
    });
  });

  describe('Action Items Display', () => {
    test('should display action items with metadata', () => {
      render(<SummaryDisplay {...defaultProps} />);

      // Expand action items section
      const actionItemsHeader = screen.getByText('Action Items');
      fireEvent.click(actionItemsHeader);

      expect(screen.getByText('Update project timeline document')).toBeInTheDocument();
      expect(screen.getByText('👤 John')).toBeInTheDocument();
      expect(screen.getByText('📅 next Friday')).toBeInTheDocument();
      expect(screen.getByText('🔴 high')).toBeInTheDocument();

      expect(screen.getByText('Schedule follow-up meeting with stakeholders')).toBeInTheDocument();
      expect(screen.getByText('👤 Sarah')).toBeInTheDocument();

      expect(screen.getByText('Prepare budget proposal for review')).toBeInTheDocument();
    });

    test('should handle action items without metadata', () => {
      const summaryWithSimpleActions = {
        ...mockSummary,
        actionItems: ['Simple action item', 'Another simple action']
      };

      render(<SummaryDisplay {...defaultProps} summary={summaryWithSimpleActions} />);

      const actionItemsHeader = screen.getByText('Action Items');
      fireEvent.click(actionItemsHeader);

      expect(screen.getByText('Simple action item')).toBeInTheDocument();
      expect(screen.getByText('Another simple action')).toBeInTheDocument();
    });
  });

  describe('Agenda Items Display', () => {
    test('should display agenda items with status', () => {
      render(<SummaryDisplay {...defaultProps} />);

      const agendaHeader = screen.getByText('Agenda Items Status');
      fireEvent.click(agendaHeader);

      expect(screen.getByText('Project Status Review')).toBeInTheDocument();
      expect(screen.getByText('✅')).toBeInTheDocument(); // Completed status
      expect(screen.getByText('Reviewed current progress and identified blockers')).toBeInTheDocument();

      expect(screen.getByText('Budget Planning')).toBeInTheDocument();
      expect(screen.getByText('⏸️')).toBeInTheDocument(); // Not discussed status
    });
  });

  describe('Copy to Clipboard', () => {
    test('should copy formatted summary to clipboard', async () => {
      const user = userEvent.setup();
      render(<SummaryDisplay {...defaultProps} />);

      const copyButton = screen.getByText('📋 Copy');
      await user.click(copyButton);

      expect(navigator.clipboard.writeText).toHaveBeenCalled();
      
      const copiedText = navigator.clipboard.writeText.mock.calls[0][0];
      expect(copiedText).toContain('Meeting Summary');
      expect(copiedText).toContain('KEY DISCUSSION POINTS:');
      expect(copiedText).toContain('DECISIONS MADE:');
      expect(copiedText).toContain('ACTION ITEMS:');
      expect(copiedText).toContain('Update project timeline document (John)');
    });

    test('should show copy success feedback', async () => {
      const user = userEvent.setup();
      render(<SummaryDisplay {...defaultProps} />);

      const copyButton = screen.getByText('📋 Copy');
      await user.click(copyButton);

      await waitFor(() => {
        expect(screen.getByText('📋 Copied!')).toBeInTheDocument();
      });

      // Should revert back to "Copy" after timeout
      await waitFor(() => {
        expect(screen.getByText('📋 Copy')).toBeInTheDocument();
      }, { timeout: 3000 });
    });

    test('should handle copy failure', async () => {
      const user = userEvent.setup();
      navigator.clipboard.writeText.mockRejectedValue(new Error('Copy failed'));
      
      render(<SummaryDisplay {...defaultProps} />);

      const copyButton = screen.getByText('📋 Copy');
      await user.click(copyButton);

      await waitFor(() => {
        expect(screen.getByText('📋 Copy failed')).toBeInTheDocument();
      });
    });
  });

  describe('Action Button Handlers', () => {
    test('should call onRegenerateSummary when regenerate button is clicked', async () => {
      const user = userEvent.setup();
      render(<SummaryDisplay {...defaultProps} />);

      const regenerateButton = screen.getByText('🔄 Regenerate');
      await user.click(regenerateButton);

      expect(defaultProps.onRegenerateSummary).toHaveBeenCalled();
    });

    test('should call onExportSummary when export button is clicked', async () => {
      const user = userEvent.setup();
      render(<SummaryDisplay {...defaultProps} />);

      const exportButton = screen.getByText('📄 Export');
      await user.click(exportButton);

      expect(defaultProps.onExportSummary).toHaveBeenCalledWith(mockSummary);
    });

    test('should call onSendToChat when send to chat button is clicked', async () => {
      const user = userEvent.setup();
      render(<SummaryDisplay {...defaultProps} />);

      const chatButton = screen.getByText('💬 Send to Chat');
      await user.click(chatButton);

      expect(defaultProps.onSendToChat).toHaveBeenCalledWith(mockSummary);
    });
  });

  describe('Raw Summary Fallback', () => {
    test('should display raw summary when structured data is not available', () => {
      const rawSummary = {
        meetingId: 'test',
        rawSummary: 'This is a raw summary without structured data.',
        keyPoints: [],
        decisions: [],
        actionItems: [],
        nextSteps: []
      };

      render(<SummaryDisplay {...defaultProps} summary={rawSummary} />);

      expect(screen.getByText('Summary')).toBeInTheDocument();
      expect(screen.getByText('This is a raw summary without structured data.')).toBeInTheDocument();
    });

    test('should not show raw summary when structured data exists', () => {
      render(<SummaryDisplay {...defaultProps} />);

      expect(screen.queryByText('This is the raw AI-generated summary text.')).not.toBeInTheDocument();
    });
  });

  describe('Responsive Design', () => {
    test('should handle missing metadata gracefully', () => {
      const summaryWithoutMetadata = { ...mockSummary, metadata: null };
      render(<SummaryDisplay {...defaultProps} summary={summaryWithoutMetadata} />);

      expect(screen.getByText('Meeting Summary')).toBeInTheDocument();
      expect(screen.queryByText(/Generated:/)).not.toBeInTheDocument();
    });

    test('should handle empty sections gracefully', () => {
      const emptySummary = {
        meetingId: 'test',
        keyPoints: [],
        decisions: [],
        actionItems: [],
        nextSteps: [],
        agendaItems: [],
        participants: []
      };

      render(<SummaryDisplay {...defaultProps} summary={emptySummary} />);

      expect(screen.getByText('Meeting Summary')).toBeInTheDocument();
      expect(screen.queryByText('Key Discussion Points')).not.toBeInTheDocument();
      expect(screen.queryByText('Decisions Made')).not.toBeInTheDocument();
      expect(screen.queryByText('Action Items')).not.toBeInTheDocument();
    });
  });
});