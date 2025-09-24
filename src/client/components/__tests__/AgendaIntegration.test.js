/**
 * Tests for AgendaIntegration component
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import AgendaIntegration from '../AgendaIntegration';
import AgendaService from '../../services/AgendaService';

// Mock the AgendaService
jest.mock('../../services/AgendaService');

describe('AgendaIntegration', () => {
  let mockAgendaService;
  let mockProps;

  beforeEach(() => {
    // Create mock agenda service instance
    mockAgendaService = {
      fetchMeetingAgenda: jest.fn(),
      trackAgendaProgress: jest.fn(),
      filterContentByAgenda: jest.fn(),
      resetTracking: jest.fn(),
      generateAgendaSummaryPrompt: jest.fn(),
      getTrackedItems: jest.fn(() => new Map()),
      createFallbackAgenda: jest.fn()
    };

    // Mock the AgendaService constructor
    AgendaService.mockImplementation(() => mockAgendaService);

    // Default props
    mockProps = {
      meetingInfo: {
        id: 'test-meeting-123',
        title: 'Test Meeting'
      },
      transcriptionText: '',
      onAgendaUpdate: jest.fn(),
      onContentFilter: jest.fn()
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering', () => {
    test('should render loading state initially', () => {
      mockAgendaService.fetchMeetingAgenda.mockImplementation(
        () => new Promise(() => {}) // Never resolves
      );

      render(<AgendaIntegration {...mockProps} />);
      
      expect(screen.getByText('Loading meeting agenda...')).toBeInTheDocument();
      expect(screen.getByText('Loading meeting agenda...')).toBeInTheDocument();
    });

    test('should render error state when agenda loading fails', async () => {
      const errorMessage = 'Failed to load agenda';
      mockAgendaService.fetchMeetingAgenda.mockRejectedValue(new Error(errorMessage));

      render(<AgendaIntegration {...mockProps} />);

      await waitFor(() => {
        expect(screen.getByText(`Failed to load agenda: ${errorMessage}`)).toBeInTheDocument();
      });

      expect(screen.getByText('Retry')).toBeInTheDocument();
    });

    test('should render empty state when no agenda available', async () => {
      mockAgendaService.fetchMeetingAgenda.mockResolvedValue(null);

      render(<AgendaIntegration {...mockProps} />);

      await waitFor(() => {
        expect(screen.getByText('No agenda available')).toBeInTheDocument();
      });

      expect(screen.getByText('Check for Agenda')).toBeInTheDocument();
    });

    test('should render agenda when successfully loaded', async () => {
      const mockAgenda = {
        title: 'Team Meeting',
        items: [
          {
            id: 'item_1',
            title: 'Project Update',
            description: 'Discuss current project status',
            estimatedDuration: 15,
            keywords: ['project', 'update']
          },
          {
            id: 'item_2',
            title: 'Budget Review',
            description: 'Review quarterly budget',
            estimatedDuration: 20,
            keywords: ['budget', 'review']
          }
        ]
      };

      mockAgendaService.fetchMeetingAgenda.mockResolvedValue(mockAgenda);

      render(<AgendaIntegration {...mockProps} />);

      await waitFor(() => {
        expect(screen.getByText('Team Meeting')).toBeInTheDocument();
      });

      expect(screen.getByText('0% Complete')).toBeInTheDocument();
      expect(screen.getByText('Show Details')).toBeInTheDocument();
    });

    test('should show fallback indicator for fallback agenda', async () => {
      const mockFallbackAgenda = {
        title: 'Meeting Discussion',
        isFallback: true,
        items: [{
          id: 'fallback_1',
          title: 'General Discussion',
          keywords: []
        }]
      };

      mockAgendaService.fetchMeetingAgenda.mockResolvedValue(mockFallbackAgenda);

      render(<AgendaIntegration {...mockProps} />);

      await waitFor(() => {
        expect(screen.getByText('No agenda found')).toBeInTheDocument();
      });
    });
  });

  describe('Agenda Details', () => {
    let mockAgenda;

    beforeEach(() => {
      mockAgenda = {
        title: 'Team Meeting',
        items: [
          {
            id: 'item_1',
            title: 'Project Update',
            description: 'Discuss current project status',
            estimatedDuration: 15,
            timeSlot: '10:00',
            keywords: ['project', 'update']
          },
          {
            id: 'item_2',
            title: 'Budget Review',
            estimatedDuration: 20,
            keywords: ['budget', 'review']
          }
        ]
      };

      mockAgendaService.fetchMeetingAgenda.mockResolvedValue(mockAgenda);
    });

    test('should toggle agenda details visibility', async () => {
      render(<AgendaIntegration {...mockProps} />);

      await waitFor(() => {
        expect(screen.getByText('Show Details')).toBeInTheDocument();
      });

      // Details should not be visible initially
      expect(screen.queryByText('Project Update')).not.toBeInTheDocument();

      // Click to show details
      fireEvent.click(screen.getByText('Show Details'));

      expect(screen.getByText('Hide Details')).toBeInTheDocument();
      expect(screen.getByText('Project Update')).toBeInTheDocument();
      expect(screen.getByText('Budget Review')).toBeInTheDocument();

      // Click to hide details
      fireEvent.click(screen.getByText('Hide Details'));

      expect(screen.getByText('Show Details')).toBeInTheDocument();
      expect(screen.queryByText('Project Update')).not.toBeInTheDocument();
    });

    test('should display agenda item details correctly', async () => {
      render(<AgendaIntegration {...mockProps} />);

      await waitFor(() => {
        fireEvent.click(screen.getByText('Show Details'));
      });

      // Check item details
      expect(screen.getByText('Project Update')).toBeInTheDocument();
      expect(screen.getByText('Discuss current project status')).toBeInTheDocument();
      expect(screen.getByText('⏱️ 15 min')).toBeInTheDocument();
      expect(screen.getByText('🕐 10:00')).toBeInTheDocument();
      expect(screen.getByText('project')).toBeInTheDocument();
      expect(screen.getByText('update')).toBeInTheDocument();
    });

    test('should show item status correctly', async () => {
      // Mock tracked items
      const trackedItems = new Map();
      trackedItems.set('item_1', { item: mockAgenda.items[0] });
      mockAgendaService.getTrackedItems.mockReturnValue(trackedItems);

      render(<AgendaIntegration {...mockProps} />);

      await waitFor(() => {
        fireEvent.click(screen.getByText('Show Details'));
      });

      // First item should be marked as tracked (✅), second as pending (⏳)
      const statusElements = screen.getAllByText(/⏳|✅/);
      expect(statusElements).toHaveLength(2);
    });
  });

  describe('Progress Tracking', () => {
    beforeEach(() => {
      const mockAgenda = {
        title: 'Team Meeting',
        items: [
          { id: 'item_1', title: 'Project Update', keywords: ['project'] },
          { id: 'item_2', title: 'Budget Review', keywords: ['budget'] }
        ]
      };

      mockAgendaService.fetchMeetingAgenda.mockResolvedValue(mockAgenda);
    });

    test('should update progress when transcription changes', async () => {
      const mockTracking = {
        progress: 50,
        currentItem: { id: 'item_1', title: 'Project Update' },
        matchedTopics: ['project'],
        confidence: 0.8
      };

      mockAgendaService.trackAgendaProgress.mockReturnValue(mockTracking);

      const { rerender } = render(<AgendaIntegration {...mockProps} />);

      await waitFor(() => {
        expect(screen.getByText('0% Complete')).toBeInTheDocument();
      });

      // Update transcription
      rerender(
        <AgendaIntegration 
          {...mockProps} 
          transcriptionText="Let's discuss the project update"
        />
      );

      await waitFor(() => {
        expect(screen.getByText('50% Complete')).toBeInTheDocument();
      });

      expect(screen.getByText('Currently Discussing:')).toBeInTheDocument();
      expect(screen.getByText('Project Update')).toBeInTheDocument();
      expect(screen.getByText('Active Topics:')).toBeInTheDocument();
      expect(screen.getByText('project')).toBeInTheDocument();
    });

    test('should call content filter callback', async () => {
      const mockFilterResult = {
        isRelevant: true,
        relevanceScore: 0.8,
        matchedTopics: ['project']
      };

      mockAgendaService.trackAgendaProgress.mockReturnValue({
        progress: 25,
        currentItem: null,
        matchedTopics: []
      });
      mockAgendaService.filterContentByAgenda.mockReturnValue(mockFilterResult);

      const { rerender } = render(<AgendaIntegration {...mockProps} />);

      await waitFor(() => {
        expect(screen.getByText('Team Meeting')).toBeInTheDocument();
      });

      // Update transcription
      rerender(
        <AgendaIntegration 
          {...mockProps} 
          transcriptionText="Project discussion"
        />
      );

      await waitFor(() => {
        expect(mockProps.onContentFilter).toHaveBeenCalledWith(mockFilterResult);
      });
    });
  });

  describe('User Actions', () => {
    beforeEach(() => {
      const mockAgenda = {
        title: 'Team Meeting',
        items: [{ id: 'item_1', title: 'Project Update', keywords: [] }]
      };

      mockAgendaService.fetchMeetingAgenda.mockResolvedValue(mockAgenda);
    });

    test('should refresh agenda when refresh button clicked', async () => {
      render(<AgendaIntegration {...mockProps} />);

      await waitFor(() => {
        expect(screen.getByText('🔄')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('🔄'));

      expect(mockAgendaService.fetchMeetingAgenda).toHaveBeenCalledTimes(2);
    });

    test('should reset tracking when reset button clicked', async () => {
      render(<AgendaIntegration {...mockProps} />);

      await waitFor(() => {
        expect(screen.getByText('Reset Tracking')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Reset Tracking'));

      expect(mockAgendaService.resetTracking).toHaveBeenCalled();
    });

    test('should copy summary prompt when button clicked', async () => {
      const mockPrompt = 'Test summary prompt';
      mockAgendaService.generateAgendaSummaryPrompt.mockReturnValue(mockPrompt);

      // Mock clipboard API
      Object.assign(navigator, {
        clipboard: {
          writeText: jest.fn().mockResolvedValue()
        }
      });

      // Mock alert
      window.alert = jest.fn();

      render(<AgendaIntegration {...mockProps} />);

      await waitFor(() => {
        expect(screen.getByText('Copy Summary Prompt')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Copy Summary Prompt'));

      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(mockPrompt);
      expect(window.alert).toHaveBeenCalledWith('Agenda summary prompt copied to clipboard!');
    });

    test('should retry loading agenda after error', async () => {
      mockAgendaService.fetchMeetingAgenda
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({
          title: 'Retry Success',
          items: []
        });

      render(<AgendaIntegration {...mockProps} />);

      await waitFor(() => {
        expect(screen.getByText('Retry')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Retry'));

      await waitFor(() => {
        expect(screen.getByText('Retry Success')).toBeInTheDocument();
      });
    });
  });

  describe('Callbacks', () => {
    test('should call onAgendaUpdate when agenda is loaded', async () => {
      const mockAgenda = {
        title: 'Team Meeting',
        items: []
      };

      mockAgendaService.fetchMeetingAgenda.mockResolvedValue(mockAgenda);

      render(<AgendaIntegration {...mockProps} />);

      await waitFor(() => {
        expect(mockProps.onAgendaUpdate).toHaveBeenCalledWith(mockAgenda);
      });
    });

    test('should not call callbacks when they are not provided', async () => {
      const mockAgenda = {
        title: 'Team Meeting',
        items: []
      };

      mockAgendaService.fetchMeetingAgenda.mockResolvedValue(mockAgenda);

      render(
        <AgendaIntegration 
          meetingInfo={mockProps.meetingInfo}
          transcriptionText=""
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Team Meeting')).toBeInTheDocument();
      });

      // Should not throw errors when callbacks are undefined
    });
  });

  describe('Meeting Info Changes', () => {
    test('should reload agenda when meeting info changes', async () => {
      const mockAgenda = {
        title: 'First Meeting',
        items: []
      };

      mockAgendaService.fetchMeetingAgenda.mockResolvedValue(mockAgenda);

      const { rerender } = render(<AgendaIntegration {...mockProps} />);

      await waitFor(() => {
        expect(mockAgendaService.fetchMeetingAgenda).toHaveBeenCalledWith('test-meeting-123');
      });

      // Change meeting info
      const newMeetingInfo = {
        id: 'new-meeting-456',
        title: 'New Meeting'
      };

      rerender(<AgendaIntegration {...mockProps} meetingInfo={newMeetingInfo} />);

      await waitFor(() => {
        expect(mockAgendaService.fetchMeetingAgenda).toHaveBeenCalledWith('new-meeting-456');
      });
    });

    test('should not reload agenda when meeting info is null', () => {
      render(<AgendaIntegration {...mockProps} meetingInfo={null} />);

      expect(mockAgendaService.fetchMeetingAgenda).not.toHaveBeenCalled();
    });
  });
});