// Real-time Transcription Component Tests
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import RealTimeTranscription from '../RealTimeTranscription.js';

// Mock transcription engine
class MockTranscriptionEngine {
  constructor() {
    this.eventListeners = new Map();
  }

  addEventListener(eventType, listener) {
    if (!this.eventListeners.has(eventType)) {
      this.eventListeners.set(eventType, []);
    }
    this.eventListeners.get(eventType).push(listener);
  }

  removeEventListener(eventType, listener) {
    const listeners = this.eventListeners.get(eventType);
    if (listeners) {
      const index = listeners.indexOf(listener);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }
  }

  notifyListeners(eventType, data) {
    const listeners = this.eventListeners.get(eventType) || [];
    listeners.forEach(listener => listener(data));
  }

  pauseTranscription() {
    this.notifyListeners('transcriptionPaused', { timestamp: Date.now() });
  }

  resumeTranscription() {
    this.notifyListeners('transcriptionResumed', { timestamp: Date.now() });
  }

  clearTranscriptionBuffer() {
    this.notifyListeners('transcriptionCleared', { 
      clearedSegments: [],
      timestamp: Date.now() 
    });
  }
}

// Mock clipboard API
Object.assign(navigator, {
  clipboard: {
    writeText: jest.fn(() => Promise.resolve())
  }
});

// Mock URL.createObjectURL
global.URL.createObjectURL = jest.fn(() => 'mock-url');
global.URL.revokeObjectURL = jest.fn();

describe('RealTimeTranscription Component', () => {
  let mockEngine;
  let mockOnPause;
  let mockOnResume;
  let mockOnClear;

  beforeEach(() => {
    mockEngine = new MockTranscriptionEngine();
    mockOnPause = jest.fn();
    mockOnResume = jest.fn();
    mockOnClear = jest.fn();
    
    // Clear clipboard mock
    navigator.clipboard.writeText.mockClear();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Inactive State', () => {
    test('renders inactive message when not active', () => {
      render(
        <RealTimeTranscription
          transcriptionEngine={mockEngine}
          isActive={false}
          onPause={mockOnPause}
          onResume={mockOnResume}
          onClear={mockOnClear}
        />
      );

      expect(screen.getByText('Start transcription to see real-time text')).toBeInTheDocument();
    });

    test('does not show transcription controls when inactive', () => {
      render(
        <RealTimeTranscription
          transcriptionEngine={mockEngine}
          isActive={false}
          onPause={mockOnPause}
          onResume={mockOnResume}
          onClear={mockOnClear}
        />
      );

      expect(screen.queryByText('Live Transcription')).not.toBeInTheDocument();
    });
  });

  describe('Active State', () => {
    test('renders transcription interface when active', () => {
      render(
        <RealTimeTranscription
          transcriptionEngine={mockEngine}
          isActive={true}
          onPause={mockOnPause}
          onResume={mockOnResume}
          onClear={mockOnClear}
        />
      );

      expect(screen.getByText('Live Transcription')).toBeInTheDocument();
      expect(screen.getByText('🔴 Live')).toBeInTheDocument();
      expect(screen.getByText('Listening for speech...')).toBeInTheDocument();
    });

    test('shows control buttons when active', () => {
      render(
        <RealTimeTranscription
          transcriptionEngine={mockEngine}
          isActive={true}
          onPause={mockOnPause}
          onResume={mockOnResume}
          onClear={mockOnClear}
        />
      );

      expect(screen.getByTitle('Pause transcription')).toBeInTheDocument();
      expect(screen.getByTitle('Clear transcription')).toBeInTheDocument();
      expect(screen.getByTitle('Show history')).toBeInTheDocument();
    });

    test('displays stats in footer', () => {
      render(
        <RealTimeTranscription
          transcriptionEngine={mockEngine}
          isActive={true}
          onPause={mockOnPause}
          onResume={mockOnResume}
          onClear={mockOnClear}
        />
      );

      expect(screen.getByText('Segments: 0')).toBeInTheDocument();
      expect(screen.getByText('Words: 0')).toBeInTheDocument();
      expect(screen.getByText('Avg Confidence: 0%')).toBeInTheDocument();
    });
  });

  describe('Transcription Results', () => {
    test('displays transcription segments', async () => {
      render(
        <RealTimeTranscription
          transcriptionEngine={mockEngine}
          isActive={true}
          onPause={mockOnPause}
          onResume={mockOnResume}
          onClear={mockOnClear}
        />
      );

      // Simulate transcription result
      const result = {
        id: 'test-segment-1',
        text: 'Hello world',
        confidence: 0.95,
        timestamp: Date.now(),
        provider: 'local'
      };

      mockEngine.notifyListeners('transcriptionResult', result);

      await waitFor(() => {
        expect(screen.getByText('Hello world')).toBeInTheDocument();
        expect(screen.getByText('95%')).toBeInTheDocument();
        expect(screen.getByText('local')).toBeInTheDocument();
      });
    });

    test('displays partial results', async () => {
      render(
        <RealTimeTranscription
          transcriptionEngine={mockEngine}
          isActive={true}
          onPause={mockOnPause}
          onResume={mockOnResume}
          onClear={mockOnClear}
        />
      );

      // Simulate partial result
      const partialResult = {
        text: 'This is partial...',
        confidence: 0.7,
        timestamp: Date.now(),
        isPartial: true
      };

      mockEngine.notifyListeners('partialResult', partialResult);

      await waitFor(() => {
        expect(screen.getByText('This is partial...')).toBeInTheDocument();
        expect(screen.getByText('Processing...')).toBeInTheDocument();
      });
    });

    test('handles low confidence results', async () => {
      render(
        <RealTimeTranscription
          transcriptionEngine={mockEngine}
          isActive={true}
          onPause={mockOnPause}
          onResume={mockOnResume}
          onClear={mockOnClear}
        />
      );

      // Simulate low confidence result
      const lowConfidenceResult = {
        id: 'low-confidence-1',
        text: 'Uncertain text',
        confidence: 0.3,
        timestamp: Date.now(),
        provider: 'local',
        isLowConfidence: true,
        warning: 'low_confidence'
      };

      mockEngine.notifyListeners('lowConfidenceResult', lowConfidenceResult);

      await waitFor(() => {
        expect(screen.getByText('Uncertain text')).toBeInTheDocument();
        expect(screen.getByText('30%')).toBeInTheDocument();
      });
    });

    test('handles transcription errors', async () => {
      render(
        <RealTimeTranscription
          transcriptionEngine={mockEngine}
          isActive={true}
          onPause={mockOnPause}
          onResume={mockOnResume}
          onClear={mockOnClear}
        />
      );

      // Simulate transcription error
      const error = {
        id: 'error-1',
        error: 'Network timeout',
        timestamp: Date.now(),
        provider: 'cloud'
      };

      mockEngine.notifyListeners('transcriptionError', error);

      await waitFor(() => {
        expect(screen.getByText('[Error: Network timeout]')).toBeInTheDocument();
      });
    });
  });

  describe('Pause/Resume Functionality', () => {
    test('pauses transcription when pause button clicked', async () => {
      render(
        <RealTimeTranscription
          transcriptionEngine={mockEngine}
          isActive={true}
          onPause={mockOnPause}
          onResume={mockOnResume}
          onClear={mockOnClear}
        />
      );

      const pauseButton = screen.getByTitle('Pause transcription');
      fireEvent.click(pauseButton);

      expect(mockOnPause).toHaveBeenCalled();
      
      await waitFor(() => {
        expect(screen.getByText('⏸️ Paused')).toBeInTheDocument();
        expect(screen.getByTitle('Resume transcription')).toBeInTheDocument();
      });
    });

    test('resumes transcription when resume button clicked', async () => {
      render(
        <RealTimeTranscription
          transcriptionEngine={mockEngine}
          isActive={true}
          onPause={mockOnPause}
          onResume={mockOnResume}
          onClear={mockOnClear}
        />
      );

      // First pause
      const pauseButton = screen.getByTitle('Pause transcription');
      fireEvent.click(pauseButton);

      await waitFor(() => {
        expect(screen.getByTitle('Resume transcription')).toBeInTheDocument();
      });

      // Then resume
      const resumeButton = screen.getByTitle('Resume transcription');
      fireEvent.click(resumeButton);

      expect(mockOnResume).toHaveBeenCalled();
      
      await waitFor(() => {
        expect(screen.getByText('🔴 Live')).toBeInTheDocument();
        expect(screen.getByTitle('Pause transcription')).toBeInTheDocument();
      });
    });

    test('ignores transcription results when paused', async () => {
      render(
        <RealTimeTranscription
          transcriptionEngine={mockEngine}
          isActive={true}
          onPause={mockOnPause}
          onResume={mockOnResume}
          onClear={mockOnClear}
        />
      );

      // Pause transcription
      const pauseButton = screen.getByTitle('Pause transcription');
      fireEvent.click(pauseButton);

      // Try to send transcription result while paused
      const result = {
        id: 'paused-segment',
        text: 'This should be ignored',
        confidence: 0.9,
        timestamp: Date.now(),
        provider: 'local'
      };

      mockEngine.notifyListeners('transcriptionResult', result);

      // Should not appear in the UI
      expect(screen.queryByText('This should be ignored')).not.toBeInTheDocument();
    });
  });

  describe('Clear Functionality', () => {
    test('clears transcription when clear button clicked', async () => {
      render(
        <RealTimeTranscription
          transcriptionEngine={mockEngine}
          isActive={true}
          onPause={mockOnPause}
          onResume={mockOnResume}
          onClear={mockOnClear}
        />
      );

      // Add some transcription first
      const result = {
        id: 'test-segment',
        text: 'Text to be cleared',
        confidence: 0.9,
        timestamp: Date.now(),
        provider: 'local'
      };

      mockEngine.notifyListeners('transcriptionResult', result);

      await waitFor(() => {
        expect(screen.getByText('Text to be cleared')).toBeInTheDocument();
      });

      // Clear transcription
      const clearButton = screen.getByTitle('Clear transcription');
      fireEvent.click(clearButton);

      expect(mockOnClear).toHaveBeenCalled();

      await waitFor(() => {
        expect(screen.queryByText('Text to be cleared')).not.toBeInTheDocument();
        expect(screen.getByText('Listening for speech...')).toBeInTheDocument();
      });
    });
  });

  describe('Segment Editing', () => {
    test('allows editing transcription segments', async () => {
      render(
        <RealTimeTranscription
          transcriptionEngine={mockEngine}
          isActive={true}
          onPause={mockOnPause}
          onResume={mockOnResume}
          onClear={mockOnClear}
        />
      );

      // Add transcription segment
      const result = {
        id: 'editable-segment',
        text: 'Original text',
        confidence: 0.9,
        timestamp: Date.now(),
        provider: 'local'
      };

      mockEngine.notifyListeners('transcriptionResult', result);

      await waitFor(() => {
        expect(screen.getByText('Original text')).toBeInTheDocument();
      });

      // Click edit button
      const editButton = screen.getByTitle('Edit segment');
      fireEvent.click(editButton);

      // Should show textarea
      const textarea = screen.getByDisplayValue('Original text');
      expect(textarea).toBeInTheDocument();

      // Edit the text
      fireEvent.change(textarea, { target: { value: 'Edited text' } });

      // Save changes
      const saveButton = screen.getByText('Save');
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(screen.getByText('Edited text')).toBeInTheDocument();
        expect(screen.getByText('✏️ Edited')).toBeInTheDocument();
      });
    });

    test('allows deleting transcription segments', async () => {
      render(
        <RealTimeTranscription
          transcriptionEngine={mockEngine}
          isActive={true}
          onPause={mockOnPause}
          onResume={mockOnResume}
          onClear={mockOnClear}
        />
      );

      // Add transcription segment
      const result = {
        id: 'deletable-segment',
        text: 'Text to delete',
        confidence: 0.9,
        timestamp: Date.now(),
        provider: 'local'
      };

      mockEngine.notifyListeners('transcriptionResult', result);

      await waitFor(() => {
        expect(screen.getByText('Text to delete')).toBeInTheDocument();
      });

      // Click delete button
      const deleteButton = screen.getByTitle('Delete segment');
      fireEvent.click(deleteButton);

      await waitFor(() => {
        expect(screen.queryByText('Text to delete')).not.toBeInTheDocument();
      });
    });
  });

  describe('Export Functionality', () => {
    test('copies transcript to clipboard', async () => {
      render(
        <RealTimeTranscription
          transcriptionEngine={mockEngine}
          isActive={true}
          onPause={mockOnPause}
          onResume={mockOnResume}
          onClear={mockOnClear}
        />
      );

      // Add some transcription
      const result1 = {
        id: 'segment-1',
        text: 'First segment',
        confidence: 0.9,
        timestamp: Date.now(),
        provider: 'local'
      };

      const result2 = {
        id: 'segment-2',
        text: 'Second segment',
        confidence: 0.8,
        timestamp: Date.now() + 1000,
        provider: 'local'
      };

      mockEngine.notifyListeners('transcriptionResult', result1);
      mockEngine.notifyListeners('transcriptionResult', result2);

      await waitFor(() => {
        expect(screen.getByText('First segment')).toBeInTheDocument();
        expect(screen.getByText('Second segment')).toBeInTheDocument();
      });

      // Click copy button
      const copyButton = screen.getByTitle('Copy to clipboard');
      fireEvent.click(copyButton);

      expect(navigator.clipboard.writeText).toHaveBeenCalledWith('First segment Second segment');
    });

    test('downloads transcript as text file', async () => {
      // Mock document.createElement and click
      const mockAnchor = document.createElement('a');
      mockAnchor.click = jest.fn();
      jest.spyOn(document, 'createElement').mockReturnValue(mockAnchor);

      render(
        <RealTimeTranscription
          transcriptionEngine={mockEngine}
          isActive={true}
          onPause={mockOnPause}
          onResume={mockOnResume}
          onClear={mockOnClear}
        />
      );

      // Add transcription
      const result = {
        id: 'download-segment',
        text: 'Download this text',
        confidence: 0.9,
        timestamp: Date.now(),
        provider: 'local'
      };

      mockEngine.notifyListeners('transcriptionResult', result);

      await waitFor(() => {
        expect(screen.getByText('Download this text')).toBeInTheDocument();
      });

      // Click save button
      const saveButton = screen.getByTitle('Download as text file');
      fireEvent.click(saveButton);

      expect(mockAnchor.click).toHaveBeenCalled();
      expect(mockAnchor.download).toMatch(/transcript_\d{4}-\d{2}-\d{2}\.txt/);

      // Restore createElement
      document.createElement.mockRestore();
    });
  });

  describe('History Management', () => {
    test('shows history panel when history button clicked', async () => {
      render(
        <RealTimeTranscription
          transcriptionEngine={mockEngine}
          isActive={true}
          onPause={mockOnPause}
          onResume={mockOnResume}
          onClear={mockOnClear}
        />
      );

      const historyButton = screen.getByTitle('Show history');
      fireEvent.click(historyButton);

      await waitFor(() => {
        expect(screen.getByText('Transcription History')).toBeInTheDocument();
        expect(screen.getByText('No previous transcriptions')).toBeInTheDocument();
      });
    });

    test('saves transcription to history when cleared', async () => {
      render(
        <RealTimeTranscription
          transcriptionEngine={mockEngine}
          isActive={true}
          onPause={mockOnPause}
          onResume={mockOnResume}
          onClear={mockOnClear}
        />
      );

      // Add transcription
      const result = {
        id: 'history-segment',
        text: 'Text for history',
        confidence: 0.9,
        timestamp: Date.now(),
        provider: 'local'
      };

      mockEngine.notifyListeners('transcriptionResult', result);

      await waitFor(() => {
        expect(screen.getByText('Text for history')).toBeInTheDocument();
      });

      // Clear transcription (should save to history)
      const clearButton = screen.getByTitle('Clear transcription');
      fireEvent.click(clearButton);

      // Open history
      const historyButton = screen.getByTitle('Show history');
      fireEvent.click(historyButton);

      await waitFor(() => {
        expect(screen.getByText('Text for history')).toBeInTheDocument();
        expect(screen.getByText('1 segments')).toBeInTheDocument();
      });
    });
  });

  describe('Processing Status', () => {
    test('shows processing indicator when processing', async () => {
      render(
        <RealTimeTranscription
          transcriptionEngine={mockEngine}
          isActive={true}
          onPause={mockOnPause}
          onResume={mockOnResume}
          onClear={mockOnClear}
        />
      );

      // Simulate processing status change
      mockEngine.notifyListeners('processingStatusChanged', {
        isProcessing: true
      });

      await waitFor(() => {
        expect(screen.getByText('⚡ Processing')).toBeInTheDocument();
      });

      // Stop processing
      mockEngine.notifyListeners('processingStatusChanged', {
        isProcessing: false
      });

      await waitFor(() => {
        expect(screen.queryByText('⚡ Processing')).not.toBeInTheDocument();
      });
    });
  });

  describe('Statistics Updates', () => {
    test('updates statistics as segments are added', async () => {
      render(
        <RealTimeTranscription
          transcriptionEngine={mockEngine}
          isActive={true}
          onPause={mockOnPause}
          onResume={mockOnResume}
          onClear={mockOnClear}
        />
      );

      // Add first segment
      const result1 = {
        id: 'stats-segment-1',
        text: 'First segment with five words',
        confidence: 0.9,
        timestamp: Date.now(),
        provider: 'local'
      };

      mockEngine.notifyListeners('transcriptionResult', result1);

      await waitFor(() => {
        expect(screen.getByText('Segments: 1')).toBeInTheDocument();
        expect(screen.getByText('Words: 5')).toBeInTheDocument();
        expect(screen.getByText('Avg Confidence: 90%')).toBeInTheDocument();
      });

      // Add second segment
      const result2 = {
        id: 'stats-segment-2',
        text: 'Second segment with three words',
        confidence: 0.8,
        timestamp: Date.now() + 1000,
        provider: 'local'
      };

      mockEngine.notifyListeners('transcriptionResult', result2);

      await waitFor(() => {
        expect(screen.getByText('Segments: 2')).toBeInTheDocument();
        expect(screen.getByText('Words: 10')).toBeInTheDocument();
        expect(screen.getByText('Avg Confidence: 85%')).toBeInTheDocument();
      });
    });
  });
});