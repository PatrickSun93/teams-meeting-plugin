/**
 * Tests for TranscriptManager component
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TranscriptManager from '../TranscriptManager';

// Mock the services
jest.mock('../../services/TranscriptStorageService');
jest.mock('../../services/TranscriptExportService');
jest.mock('../../services/TranscriptSharingService');

const mockStorageService = {
  initialize: jest.fn(),
  getAllTranscripts: jest.fn(),
  searchTranscripts: jest.fn(),
  deleteTranscripts: jest.fn(),
  cleanupOldTranscripts: jest.fn(),
  getStorageStats: jest.fn()
};

const mockExportService = {
  exportTranscript: jest.fn(),
  exportBatch: jest.fn(),
  downloadFile: jest.fn()
};

const mockSharingService = {
  initialize: jest.fn(),
  createShare: jest.fn()
};

// Mock navigator.clipboard
Object.assign(navigator, {
  clipboard: {
    writeText: jest.fn()
  }
});

// Mock window.confirm and window.alert
global.confirm = jest.fn();
global.alert = jest.fn();
global.prompt = jest.fn();

describe('TranscriptManager', () => {
  let mockTranscripts;

  beforeEach(() => {
    mockTranscripts = [
      {
        id: 'transcript-1',
        meetingId: 'meeting-123',
        title: 'Weekly Team Meeting',
        platform: 'teams',
        createdAt: new Date('2024-01-15T10:00:00Z'),
        size: 1024,
        encrypted: false,
        tags: ['weekly', 'team'],
        content: {
          segments: [
            {
              id: 'seg1',
              speakerId: 'speaker1',
              speakerName: 'John Doe',
              text: 'Hello everyone',
              startTime: 0,
              endTime: 3
            }
          ]
        }
      },
      {
        id: 'transcript-2',
        meetingId: 'meeting-456',
        title: 'Project Review',
        platform: 'zoom',
        createdAt: new Date('2024-01-14T14:00:00Z'),
        size: 2048,
        encrypted: true,
        tags: ['project', 'review'],
        content: {
          segments: [
            {
              id: 'seg2',
              speakerId: 'speaker2',
              speakerName: 'Jane Smith',
              text: 'Let\'s review the project status',
              startTime: 0,
              endTime: 5
            }
          ]
        }
      }
    ];

    const mockStats = {
      totalTranscripts: 2,
      totalSize: 3072,
      encryptedCount: 1,
      platformBreakdown: { teams: 1, zoom: 1 }
    };

    // Reset mocks
    jest.clearAllMocks();

    // Setup default mock implementations
    mockStorageService.initialize.mockResolvedValue();
    mockStorageService.getAllTranscripts.mockResolvedValue(mockTranscripts);
    mockStorageService.searchTranscripts.mockResolvedValue(mockTranscripts);
    mockStorageService.getStorageStats.mockResolvedValue(mockStats);
    mockStorageService.deleteTranscripts.mockResolvedValue([
      { id: 'transcript-1', success: true }
    ]);
    mockStorageService.cleanupOldTranscripts.mockResolvedValue([]);

    mockSharingService.initialize.mockResolvedValue();
    mockSharingService.createShare.mockResolvedValue({
      shareId: 'share-123',
      shareUrl: 'https://example.com/share/share-123',
      expiresAt: new Date('2024-02-15T10:00:00Z'),
      permissions: { canView: true, canDownload: true }
    });

    mockExportService.exportTranscript.mockResolvedValue({
      blob: new Blob(['test content']),
      filename: 'test.txt',
      mimeType: 'text/plain'
    });

    mockExportService.exportBatch.mockResolvedValue([
      { transcript: 'transcript-1', success: true, data: { blob: new Blob(['test']) } }
    ]);

    // Mock the service constructors
    require('../../services/TranscriptStorageService').mockImplementation(() => mockStorageService);
    require('../../services/TranscriptExportService').mockImplementation(() => mockExportService);
    require('../../services/TranscriptSharingService').mockImplementation(() => mockSharingService);
  });

  describe('initialization', () => {
    it('should render loading state initially', () => {
      render(<TranscriptManager />);
      
      expect(screen.getByText('Loading transcripts...')).toBeInTheDocument();
    });

    it('should initialize services and load data', async () => {
      render(<TranscriptManager />);
      
      await waitFor(() => {
        expect(mockStorageService.initialize).toHaveBeenCalled();
        expect(mockSharingService.initialize).toHaveBeenCalled();
        expect(mockStorageService.getAllTranscripts).toHaveBeenCalled();
        expect(mockStorageService.getStorageStats).toHaveBeenCalled();
      });
    });

    it('should display transcripts after loading', async () => {
      render(<TranscriptManager />);
      
      await waitFor(() => {
        expect(screen.getByText('Weekly Team Meeting')).toBeInTheDocument();
        expect(screen.getByText('Project Review')).toBeInTheDocument();
      });
    });

    it('should display storage stats', async () => {
      render(<TranscriptManager />);
      
      await waitFor(() => {
        expect(screen.getByText('2 transcripts')).toBeInTheDocument();
        expect(screen.getByText('3.00 KB')).toBeInTheDocument();
        expect(screen.getByText('1 encrypted')).toBeInTheDocument();
      });
    });

    it('should handle initialization errors', async () => {
      mockStorageService.initialize.mockRejectedValue(new Error('Init failed'));
      
      render(<TranscriptManager />);
      
      await waitFor(() => {
        expect(screen.getByText(/Failed to initialize: Init failed/)).toBeInTheDocument();
      });
    });
  });

  describe('search functionality', () => {
    it('should search transcripts', async () => {
      const user = userEvent.setup();
      render(<TranscriptManager />);
      
      await waitFor(() => {
        expect(screen.getByText('Weekly Team Meeting')).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText('Search transcripts...');
      await user.type(searchInput, 'weekly');
      
      await waitFor(() => {
        expect(mockStorageService.searchTranscripts).toHaveBeenCalledWith('weekly', { limit: 100 });
      });
    });

    it('should clear search results when query is empty', async () => {
      const user = userEvent.setup();
      render(<TranscriptManager />);
      
      await waitFor(() => {
        expect(screen.getByText('Weekly Team Meeting')).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText('Search transcripts...');
      await user.type(searchInput, 'test');
      await user.clear(searchInput);
      
      // Should show all transcripts again
      await waitFor(() => {
        expect(screen.getByText('Weekly Team Meeting')).toBeInTheDocument();
        expect(screen.getByText('Project Review')).toBeInTheDocument();
      });
    });

    it('should handle search errors', async () => {
      const user = userEvent.setup();
      mockStorageService.searchTranscripts.mockRejectedValue(new Error('Search failed'));
      
      render(<TranscriptManager />);
      
      await waitFor(() => {
        expect(screen.getByText('Weekly Team Meeting')).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText('Search transcripts...');
      await user.type(searchInput, 'error');
      
      await waitFor(() => {
        expect(screen.getByText(/Search failed: Search failed/)).toBeInTheDocument();
      });
    });
  });

  describe('filtering', () => {
    it('should show and hide filters panel', async () => {
      const user = userEvent.setup();
      render(<TranscriptManager />);
      
      await waitFor(() => {
        expect(screen.getByText('Weekly Team Meeting')).toBeInTheDocument();
      });

      const filterToggle = screen.getByText(/Filters/);
      await user.click(filterToggle);
      
      expect(screen.getByDisplayValue('All Platforms')).toBeInTheDocument();
      
      await user.click(filterToggle);
      
      expect(screen.queryByDisplayValue('All Platforms')).not.toBeInTheDocument();
    });

    it('should filter by platform', async () => {
      const user = userEvent.setup();
      render(<TranscriptManager />);
      
      await waitFor(() => {
        expect(screen.getByText('Weekly Team Meeting')).toBeInTheDocument();
      });

      // Open filters
      const filterToggle = screen.getByText(/Filters/);
      await user.click(filterToggle);
      
      // Select Teams platform
      const platformSelect = screen.getByDisplayValue('All Platforms');
      await user.selectOptions(platformSelect, 'teams');
      
      // Should only show Teams transcripts
      await waitFor(() => {
        expect(screen.getByText('Weekly Team Meeting')).toBeInTheDocument();
        expect(screen.queryByText('Project Review')).not.toBeInTheDocument();
      });
    });

    it('should filter by encryption status', async () => {
      const user = userEvent.setup();
      render(<TranscriptManager />);
      
      await waitFor(() => {
        expect(screen.getByText('Weekly Team Meeting')).toBeInTheDocument();
      });

      // Open filters
      const filterToggle = screen.getByText(/Filters/);
      await user.click(filterToggle);
      
      // Select encrypted only
      const encryptionSelect = screen.getByDisplayValue('All Types');
      await user.selectOptions(encryptionSelect, 'true');
      
      // Should only show encrypted transcripts
      await waitFor(() => {
        expect(screen.queryByText('Weekly Team Meeting')).not.toBeInTheDocument();
        expect(screen.getByText('Project Review')).toBeInTheDocument();
      });
    });
  });

  describe('selection management', () => {
    it('should select and deselect transcripts', async () => {
      const user = userEvent.setup();
      render(<TranscriptManager />);
      
      await waitFor(() => {
        expect(screen.getByText('Weekly Team Meeting')).toBeInTheDocument();
      });

      const checkboxes = screen.getAllByRole('checkbox');
      await user.click(checkboxes[0]);
      
      expect(screen.getByText('1 selected')).toBeInTheDocument();
      
      await user.click(checkboxes[0]);
      
      expect(screen.queryByText('1 selected')).not.toBeInTheDocument();
    });

    it('should select all transcripts', async () => {
      const user = userEvent.setup();
      render(<TranscriptManager />);
      
      await waitFor(() => {
        expect(screen.getByText('Weekly Team Meeting')).toBeInTheDocument();
      });

      const selectAllButton = screen.getByText('Select All');
      await user.click(selectAllButton);
      
      expect(screen.getByText('2 selected')).toBeInTheDocument();
    });

    it('should clear selection', async () => {
      const user = userEvent.setup();
      render(<TranscriptManager />);
      
      await waitFor(() => {
        expect(screen.getByText('Weekly Team Meeting')).toBeInTheDocument();
      });

      // Select all first
      const selectAllButton = screen.getByText('Select All');
      await user.click(selectAllButton);
      
      expect(screen.getByText('2 selected')).toBeInTheDocument();
      
      // Clear selection
      const clearButton = screen.getByText('Clear');
      await user.click(clearButton);
      
      expect(screen.queryByText('2 selected')).not.toBeInTheDocument();
    });
  });

  describe('view modes', () => {
    it('should toggle between list and grid view', async () => {
      const user = userEvent.setup();
      render(<TranscriptManager />);
      
      await waitFor(() => {
        expect(screen.getByText('Weekly Team Meeting')).toBeInTheDocument();
      });

      const viewToggle = screen.getByText('Grid View');
      await user.click(viewToggle);
      
      expect(screen.getByText('List View')).toBeInTheDocument();
      
      await user.click(screen.getByText('List View'));
      
      expect(screen.getByText('Grid View')).toBeInTheDocument();
    });
  });

  describe('export functionality', () => {
    it('should open export modal for selected transcripts', async () => {
      const user = userEvent.setup();
      render(<TranscriptManager />);
      
      await waitFor(() => {
        expect(screen.getByText('Weekly Team Meeting')).toBeInTheDocument();
      });

      // Select a transcript
      const checkboxes = screen.getAllByRole('checkbox');
      await user.click(checkboxes[0]);
      
      // Click export button
      const exportButton = screen.getByText(/Export \(1\)/);
      await user.click(exportButton);
      
      expect(screen.getByText('Export Transcript')).toBeInTheDocument();
    });

    it('should export single transcript', async () => {
      const user = userEvent.setup();
      render(<TranscriptManager />);
      
      await waitFor(() => {
        expect(screen.getByText('Weekly Team Meeting')).toBeInTheDocument();
      });

      // Click export button on transcript item
      const exportButtons = screen.getAllByTitle('Export');
      await user.click(exportButtons[0]);
      
      expect(screen.getByText('Export Transcript')).toBeInTheDocument();
      
      // Click export in modal
      const exportModalButton = screen.getByText('Export');
      await user.click(exportModalButton);
      
      await waitFor(() => {
        expect(mockExportService.exportTranscript).toHaveBeenCalled();
        expect(mockExportService.downloadFile).toHaveBeenCalled();
      });
    });

    it('should export multiple transcripts', async () => {
      const user = userEvent.setup();
      render(<TranscriptManager />);
      
      await waitFor(() => {
        expect(screen.getByText('Weekly Team Meeting')).toBeInTheDocument();
      });

      // Select multiple transcripts
      const selectAllButton = screen.getByText('Select All');
      await user.click(selectAllButton);
      
      // Click export button
      const exportButton = screen.getByText(/Export \(2\)/);
      await user.click(exportButton);
      
      // Click export in modal
      const exportModalButton = screen.getByText('Export');
      await user.click(exportModalButton);
      
      await waitFor(() => {
        expect(mockExportService.exportBatch).toHaveBeenCalled();
      });
    });

    it('should handle export errors', async () => {
      const user = userEvent.setup();
      mockExportService.exportTranscript.mockRejectedValue(new Error('Export failed'));
      
      render(<TranscriptManager />);
      
      await waitFor(() => {
        expect(screen.getByText('Weekly Team Meeting')).toBeInTheDocument();
      });

      // Click export button on transcript item
      const exportButtons = screen.getAllByTitle('Export');
      await user.click(exportButtons[0]);
      
      // Click export in modal
      const exportModalButton = screen.getByText('Export');
      await user.click(exportModalButton);
      
      await waitFor(() => {
        expect(screen.getByText(/Export failed: Export failed/)).toBeInTheDocument();
      });
    });
  });

  describe('sharing functionality', () => {
    it('should open share modal', async () => {
      const user = userEvent.setup();
      render(<TranscriptManager />);
      
      await waitFor(() => {
        expect(screen.getByText('Weekly Team Meeting')).toBeInTheDocument();
      });

      // Click share button on transcript item
      const shareButtons = screen.getAllByTitle('Share');
      await user.click(shareButtons[0]);
      
      expect(screen.getByText('Share Transcript: Weekly Team Meeting')).toBeInTheDocument();
    });

    it('should create share link', async () => {
      const user = userEvent.setup();
      navigator.clipboard.writeText.mockResolvedValue();
      
      render(<TranscriptManager />);
      
      await waitFor(() => {
        expect(screen.getByText('Weekly Team Meeting')).toBeInTheDocument();
      });

      // Click share button
      const shareButtons = screen.getAllByTitle('Share');
      await user.click(shareButtons[0]);
      
      // Click create share in modal
      const createShareButton = screen.getByText('Create Share Link');
      await user.click(createShareButton);
      
      await waitFor(() => {
        expect(mockSharingService.createShare).toHaveBeenCalled();
        expect(navigator.clipboard.writeText).toHaveBeenCalledWith('https://example.com/share/share-123');
      });
    });

    it('should handle sharing errors', async () => {
      const user = userEvent.setup();
      mockSharingService.createShare.mockRejectedValue(new Error('Share failed'));
      
      render(<TranscriptManager />);
      
      await waitFor(() => {
        expect(screen.getByText('Weekly Team Meeting')).toBeInTheDocument();
      });

      // Click share button
      const shareButtons = screen.getAllByTitle('Share');
      await user.click(shareButtons[0]);
      
      // Click create share in modal
      const createShareButton = screen.getByText('Create Share Link');
      await user.click(createShareButton);
      
      await waitFor(() => {
        expect(screen.getByText(/Share failed: Share failed/)).toBeInTheDocument();
      });
    });
  });

  describe('deletion functionality', () => {
    it('should delete single transcript', async () => {
      const user = userEvent.setup();
      global.confirm.mockReturnValue(true);
      
      render(<TranscriptManager />);
      
      await waitFor(() => {
        expect(screen.getByText('Weekly Team Meeting')).toBeInTheDocument();
      });

      // Click delete button on transcript item
      const deleteButtons = screen.getAllByTitle('Delete');
      await user.click(deleteButtons[0]);
      
      await waitFor(() => {
        expect(global.confirm).toHaveBeenCalledWith('Delete 1 transcript(s)? This cannot be undone.');
        expect(mockStorageService.deleteTranscripts).toHaveBeenCalledWith(['transcript-1']);
      });
    });

    it('should delete multiple transcripts', async () => {
      const user = userEvent.setup();
      global.confirm.mockReturnValue(true);
      
      render(<TranscriptManager />);
      
      await waitFor(() => {
        expect(screen.getByText('Weekly Team Meeting')).toBeInTheDocument();
      });

      // Select all transcripts
      const selectAllButton = screen.getByText('Select All');
      await user.click(selectAllButton);
      
      // Click delete button
      const deleteButton = screen.getByText(/Delete \(2\)/);
      await user.click(deleteButton);
      
      await waitFor(() => {
        expect(global.confirm).toHaveBeenCalledWith('Delete 2 transcript(s)? This cannot be undone.');
        expect(mockStorageService.deleteTranscripts).toHaveBeenCalledWith(['transcript-1', 'transcript-2']);
      });
    });

    it('should cancel deletion when user declines', async () => {
      const user = userEvent.setup();
      global.confirm.mockReturnValue(false);
      
      render(<TranscriptManager />);
      
      await waitFor(() => {
        expect(screen.getByText('Weekly Team Meeting')).toBeInTheDocument();
      });

      // Click delete button on transcript item
      const deleteButtons = screen.getAllByTitle('Delete');
      await user.click(deleteButtons[0]);
      
      expect(mockStorageService.deleteTranscripts).not.toHaveBeenCalled();
    });
  });

  describe('cleanup functionality', () => {
    it('should cleanup old transcripts', async () => {
      const user = userEvent.setup();
      global.prompt.mockReturnValue('90');
      
      render(<TranscriptManager />);
      
      await waitFor(() => {
        expect(screen.getByText('Weekly Team Meeting')).toBeInTheDocument();
      });

      const cleanupButton = screen.getByText('Cleanup Old');
      await user.click(cleanupButton);
      
      await waitFor(() => {
        expect(global.prompt).toHaveBeenCalledWith('Delete transcripts older than how many days?', '90');
        expect(mockStorageService.cleanupOldTranscripts).toHaveBeenCalledWith(90);
      });
    });

    it('should cancel cleanup when user cancels prompt', async () => {
      const user = userEvent.setup();
      global.prompt.mockReturnValue(null);
      
      render(<TranscriptManager />);
      
      await waitFor(() => {
        expect(screen.getByText('Weekly Team Meeting')).toBeInTheDocument();
      });

      const cleanupButton = screen.getByText('Cleanup Old');
      await user.click(cleanupButton);
      
      expect(mockStorageService.cleanupOldTranscripts).not.toHaveBeenCalled();
    });
  });

  describe('error handling', () => {
    it('should display and dismiss error messages', async () => {
      const user = userEvent.setup();
      mockStorageService.searchTranscripts.mockRejectedValue(new Error('Test error'));
      
      render(<TranscriptManager />);
      
      await waitFor(() => {
        expect(screen.getByText('Weekly Team Meeting')).toBeInTheDocument();
      });

      // Trigger an error
      const searchInput = screen.getByPlaceholderText('Search transcripts...');
      await user.type(searchInput, 'error');
      
      await waitFor(() => {
        expect(screen.getByText(/Search failed: Test error/)).toBeInTheDocument();
      });

      // Dismiss error
      const dismissButton = screen.getByText('×');
      await user.click(dismissButton);
      
      expect(screen.queryByText(/Search failed: Test error/)).not.toBeInTheDocument();
    });
  });

  describe('empty state', () => {
    it('should show empty state when no transcripts', async () => {
      mockStorageService.getAllTranscripts.mockResolvedValue([]);
      
      render(<TranscriptManager />);
      
      await waitFor(() => {
        expect(screen.getByText('No transcripts stored yet.')).toBeInTheDocument();
      });
    });

    it('should show no results message when search returns empty', async () => {
      const user = userEvent.setup();
      mockStorageService.searchTranscripts.mockResolvedValue([]);
      
      render(<TranscriptManager />);
      
      await waitFor(() => {
        expect(screen.getByText('Weekly Team Meeting')).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText('Search transcripts...');
      await user.type(searchInput, 'nonexistent');
      
      await waitFor(() => {
        expect(screen.getByText('No transcripts found matching your search.')).toBeInTheDocument();
      });
    });
  });
});