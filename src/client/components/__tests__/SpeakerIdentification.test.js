// SpeakerIdentification Component Tests
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import SpeakerIdentification from '../SpeakerIdentification.js';
import SpeakerIdentificationService from '../../services/SpeakerIdentificationService.js';

// Mock the SpeakerIdentificationService
jest.mock('../../services/SpeakerIdentificationService.js');

// Mock Web Audio API
global.AudioContext = jest.fn().mockImplementation(() => ({
  sampleRate: 16000,
  state: 'running',
  close: jest.fn()
}));

describe('SpeakerIdentification Component', () => {
  let mockSpeakerService;
  let mockAudioProcessor;
  let mockOnSpeakerIdentified;
  let mockOnSpeakerChanged;

  beforeEach(() => {
    // Create mock service instance
    mockSpeakerService = {
      initialize: jest.fn().mockResolvedValue(true),
      cleanup: jest.fn(),
      isInitialized: false, // Start as false, will be set to true after initialize
      identifySpeaker: jest.fn(),
      enrollSpeaker: jest.fn(),
      getAllSpeakerProfiles: jest.fn().mockReturnValue([]),
      getSpeakerProfile: jest.fn(),
      updateSpeakerName: jest.fn().mockReturnValue(true),
      removeSpeaker: jest.fn().mockReturnValue(true),
      clearAllProfiles: jest.fn(),
      getStatus: jest.fn().mockReturnValue({
        speakerCount: 0,
        unknownSpeakerCount: 0,
        historyLength: 0,
        currentSpeaker: null
      }),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn()
    };

    // Mock the constructor to return our mock instance
    SpeakerIdentificationService.mockImplementation(() => {
      // Set up initialize to update isInitialized
      mockSpeakerService.initialize.mockImplementation(async () => {
        mockSpeakerService.isInitialized = true;
        return true;
      });
      return mockSpeakerService;
    });

    // Create mock audio processor
    mockAudioProcessor = {
      addEventListener: jest.fn(),
      removeEventListener: jest.fn()
    };

    // Create mock callbacks
    mockOnSpeakerIdentified = jest.fn();
    mockOnSpeakerChanged = jest.fn();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Initialization', () => {
    test('should render loading state initially', () => {
      // Override the mock to never resolve
      SpeakerIdentificationService.mockImplementation(() => ({
        ...mockSpeakerService,
        initialize: jest.fn(() => new Promise(() => {})), // Never resolves
        isInitialized: false
      }));
      
      render(
        <SpeakerIdentification 
          audioProcessor={mockAudioProcessor}
          isActive={true}
          onSpeakerIdentified={mockOnSpeakerIdentified}
          onSpeakerChanged={mockOnSpeakerChanged}
        />
      );

      expect(screen.getByText('Initializing speaker identification...')).toBeInTheDocument();
      expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();
    });

    test('should initialize service on mount', async () => {
      render(
        <SpeakerIdentification 
          audioProcessor={mockAudioProcessor}
          isActive={true}
        />
      );

      await waitFor(() => {
        expect(mockSpeakerService.initialize).toHaveBeenCalled();
      });
    });

    test('should render main interface after initialization', async () => {
      render(
        <SpeakerIdentification 
          audioProcessor={mockAudioProcessor}
          isActive={true}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Speaker Identification')).toBeInTheDocument();
        expect(screen.getByText('Current Speaker')).toBeInTheDocument();
        expect(screen.getByText('Speaker Management')).toBeInTheDocument();
      });
    });
  });

  describe('Status Display', () => {
    beforeEach(async () => {
      render(
        <SpeakerIdentification 
          audioProcessor={mockAudioProcessor}
          isActive={true}
        />
      );
      
      await waitFor(() => {
        expect(mockSpeakerService.initialize).toHaveBeenCalled();
      });
    });

    test('should show active status when active', () => {
      expect(screen.getByText('Active')).toBeInTheDocument();
      expect(screen.getByText('Active')).toHaveClass('active');
    });

    test('should show inactive status when inactive', () => {
      render(
        <SpeakerIdentification 
          audioProcessor={mockAudioProcessor}
          isActive={false}
        />
      );

      expect(screen.getByText('Inactive')).toBeInTheDocument();
      expect(screen.getByText('Inactive')).toHaveClass('inactive');
    });

    test('should display speaker statistics', () => {
      expect(screen.getByText('Known Speakers:')).toBeInTheDocument();
      expect(screen.getByText('Unknown Speakers:')).toBeInTheDocument();
      expect(screen.getByText('0')).toBeInTheDocument(); // Default count
    });
  });

  describe('Current Speaker Display', () => {
    beforeEach(async () => {
      render(
        <SpeakerIdentification 
          audioProcessor={mockAudioProcessor}
          isActive={true}
        />
      );
      
      await waitFor(() => {
        expect(mockSpeakerService.initialize).toHaveBeenCalled();
      });
    });

    test('should show listening message when no current speaker', () => {
      expect(screen.getByText('Listening for speakers...')).toBeInTheDocument();
    });

    test('should display current speaker information', async () => {
      // Simulate speaker identification event
      const speakerData = {
        speakerId: 'Speaker_1',
        confidence: 0.85,
        isNewSpeaker: true
      };

      // Find the addEventListener call for 'speakerIdentified'
      const addEventListenerCalls = mockSpeakerService.addEventListener.mock.calls;
      const speakerIdentifiedCall = addEventListenerCalls.find(call => call[0] === 'speakerIdentified');
      
      if (speakerIdentifiedCall) {
        const handler = speakerIdentifiedCall[1];
        handler(speakerData);
      }

      await waitFor(() => {
        expect(screen.getByText('Speaker_1')).toBeInTheDocument();
        expect(screen.getByText('NEW')).toBeInTheDocument();
        expect(screen.getByText('85% confidence')).toBeInTheDocument();
      });
    });
  });

  describe('Speaker Enrollment', () => {
    beforeEach(async () => {
      render(
        <SpeakerIdentification 
          audioProcessor={mockAudioProcessor}
          isActive={true}
        />
      );
      
      await waitFor(() => {
        expect(mockSpeakerService.initialize).toHaveBeenCalled();
      });
    });

    test('should show enrollment form when enroll button clicked', () => {
      const enrollButton = screen.getByText('Enroll Speaker');
      fireEvent.click(enrollButton);

      expect(screen.getByText('Enroll New Speaker')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('Enter unique speaker ID')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('Enter speaker name')).toBeInTheDocument();
    });

    test('should hide enrollment form when cancel clicked', () => {
      const enrollButton = screen.getByText('Enroll Speaker');
      fireEvent.click(enrollButton);

      const cancelButton = screen.getByText('Cancel');
      fireEvent.click(cancelButton);

      expect(screen.queryByText('Enroll New Speaker')).not.toBeInTheDocument();
    });

    test('should update form fields', () => {
      const enrollButton = screen.getByText('Enroll Speaker');
      fireEvent.click(enrollButton);

      const speakerIdInput = screen.getByPlaceholderText('Enter unique speaker ID');
      const speakerNameInput = screen.getByPlaceholderText('Enter speaker name');

      fireEvent.change(speakerIdInput, { target: { value: 'test_speaker' } });
      fireEvent.change(speakerNameInput, { target: { value: 'Test Speaker' } });

      expect(speakerIdInput.value).toBe('test_speaker');
      expect(speakerNameInput.value).toBe('Test Speaker');
    });

    test('should disable enroll button when form incomplete', () => {
      const enrollButton = screen.getByText('Enroll Speaker');
      fireEvent.click(enrollButton);

      const submitButton = screen.getByRole('button', { name: 'Enroll Speaker' });
      expect(submitButton).toBeDisabled();
    });

    test('should call enrollSpeaker when form submitted', async () => {
      mockSpeakerService.enrollSpeaker.mockResolvedValue({
        id: 'test_speaker',
        name: 'Test Speaker'
      });

      const enrollButton = screen.getByText('Enroll Speaker');
      fireEvent.click(enrollButton);

      const speakerIdInput = screen.getByPlaceholderText('Enter unique speaker ID');
      fireEvent.change(speakerIdInput, { target: { value: 'test_speaker' } });

      // Simulate having audio samples
      const component = screen.getByText('Enroll New Speaker').closest('.enrollment-form');
      const submitButton = component.querySelector('button[class*="btn-primary"]');
      
      // Mock that we have audio samples
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(mockSpeakerService.enrollSpeaker).toHaveBeenCalledWith(
          'test_speaker',
          expect.any(Array),
          ''
        );
      });
    });
  });

  describe('Speaker Management', () => {
    beforeEach(async () => {
      const mockProfiles = [
        {
          id: 'speaker1',
          name: 'John Doe',
          sampleCount: 5,
          enrollmentDate: Date.now()
        },
        {
          id: 'speaker2',
          name: 'Jane Smith',
          sampleCount: 3,
          enrollmentDate: Date.now()
        }
      ];

      mockSpeakerService.getAllSpeakerProfiles.mockReturnValue(mockProfiles);

      render(
        <SpeakerIdentification 
          audioProcessor={mockAudioProcessor}
          isActive={true}
        />
      );
      
      await waitFor(() => {
        expect(mockSpeakerService.initialize).toHaveBeenCalled();
      });
    });

    test('should display known speakers list', () => {
      expect(screen.getByText('Known Speakers (2)')).toBeInTheDocument();
      expect(screen.getByText('speaker1')).toBeInTheDocument();
      expect(screen.getByText('John Doe')).toBeInTheDocument();
      expect(screen.getByText('speaker2')).toBeInTheDocument();
      expect(screen.getByText('Jane Smith')).toBeInTheDocument();
    });

    test('should show edit and remove buttons for each speaker', () => {
      const editButtons = screen.getAllByText('Edit');
      const removeButtons = screen.getAllByText('Remove');

      expect(editButtons).toHaveLength(2);
      expect(removeButtons).toHaveLength(2);
    });

    test('should call updateSpeakerName when edit clicked', () => {
      // Mock prompt
      window.prompt = jest.fn().mockReturnValue('New Name');

      const editButtons = screen.getAllByText('Edit');
      fireEvent.click(editButtons[0]);

      expect(mockSpeakerService.updateSpeakerName).toHaveBeenCalledWith('speaker1', 'New Name');
    });

    test('should call removeSpeaker when remove clicked', () => {
      // Mock confirm
      window.confirm = jest.fn().mockReturnValue(true);

      const removeButtons = screen.getAllByText('Remove');
      fireEvent.click(removeButtons[0]);

      expect(mockSpeakerService.removeSpeaker).toHaveBeenCalledWith('speaker1');
    });

    test('should call clearAllProfiles when clear all clicked', () => {
      // Mock confirm
      window.confirm = jest.fn().mockReturnValue(true);

      const clearButton = screen.getByText('Clear All Profiles');
      fireEvent.click(clearButton);

      expect(mockSpeakerService.clearAllProfiles).toHaveBeenCalled();
    });
  });

  describe('Audio Processing Integration', () => {
    test('should set up audio processor listeners when active', async () => {
      render(
        <SpeakerIdentification 
          audioProcessor={mockAudioProcessor}
          isActive={true}
        />
      );

      await waitFor(() => {
        expect(mockAudioProcessor.addEventListener).toHaveBeenCalledWith(
          'audioReady',
          expect.any(Function)
        );
      });
    });

    test('should not set up listeners when inactive', async () => {
      render(
        <SpeakerIdentification 
          audioProcessor={mockAudioProcessor}
          isActive={false}
        />
      );

      await waitFor(() => {
        expect(mockSpeakerService.initialize).toHaveBeenCalled();
      });

      expect(mockAudioProcessor.addEventListener).not.toHaveBeenCalled();
    });

    test('should remove listeners on cleanup', async () => {
      const { unmount } = render(
        <SpeakerIdentification 
          audioProcessor={mockAudioProcessor}
          isActive={true}
        />
      );

      await waitFor(() => {
        expect(mockAudioProcessor.addEventListener).toHaveBeenCalled();
      });

      unmount();

      expect(mockAudioProcessor.removeEventListener).toHaveBeenCalled();
    });
  });

  describe('Event Handling', () => {
    test('should call onSpeakerIdentified callback', async () => {
      render(
        <SpeakerIdentification 
          audioProcessor={mockAudioProcessor}
          isActive={true}
          onSpeakerIdentified={mockOnSpeakerIdentified}
        />
      );

      await waitFor(() => {
        expect(mockSpeakerService.initialize).toHaveBeenCalled();
      });

      // Simulate speaker identification event
      const speakerData = { speakerId: 'Speaker_1', confidence: 0.8 };
      const addEventListenerCalls = mockSpeakerService.addEventListener.mock.calls;
      const speakerIdentifiedCall = addEventListenerCalls.find(call => call[0] === 'speakerIdentified');
      
      if (speakerIdentifiedCall) {
        const handler = speakerIdentifiedCall[1];
        handler(speakerData);
      }

      expect(mockOnSpeakerIdentified).toHaveBeenCalledWith(speakerData);
    });

    test('should call onSpeakerChanged callback', async () => {
      render(
        <SpeakerIdentification 
          audioProcessor={mockAudioProcessor}
          isActive={true}
          onSpeakerChanged={mockOnSpeakerChanged}
        />
      );

      await waitFor(() => {
        expect(mockSpeakerService.initialize).toHaveBeenCalled();
      });

      // Simulate speaker change event
      const changeData = { 
        previousSpeaker: 'Speaker_1', 
        currentSpeaker: 'Speaker_2' 
      };
      
      const addEventListenerCalls = mockSpeakerService.addEventListener.mock.calls;
      const speakerChangedCall = addEventListenerCalls.find(call => call[0] === 'speakerChanged');
      
      if (speakerChangedCall) {
        const handler = speakerChangedCall[1];
        handler(changeData);
      }

      expect(mockOnSpeakerChanged).toHaveBeenCalledWith(changeData);
    });
  });

  describe('Confidence Display', () => {
    test('should show correct confidence color for high confidence', async () => {
      render(
        <SpeakerIdentification 
          audioProcessor={mockAudioProcessor}
          isActive={true}
        />
      );

      await waitFor(() => {
        expect(mockSpeakerService.initialize).toHaveBeenCalled();
      });

      // Simulate high confidence speaker identification
      const speakerData = { speakerId: 'Speaker_1', confidence: 0.9 };
      const addEventListenerCalls = mockSpeakerService.addEventListener.mock.calls;
      const speakerIdentifiedCall = addEventListenerCalls.find(call => call[0] === 'speakerIdentified');
      
      if (speakerIdentifiedCall) {
        const handler = speakerIdentifiedCall[1];
        handler(speakerData);
      }

      await waitFor(() => {
        const confidenceFill = document.querySelector('.confidence-fill');
        expect(confidenceFill).toHaveStyle('background-color: #4CAF50'); // Green
      });
    });

    test('should show correct confidence color for low confidence', async () => {
      render(
        <SpeakerIdentification 
          audioProcessor={mockAudioProcessor}
          isActive={true}
        />
      );

      await waitFor(() => {
        expect(mockSpeakerService.initialize).toHaveBeenCalled();
      });

      // Simulate low confidence speaker identification
      const speakerData = { speakerId: 'Speaker_1', confidence: 0.3 };
      const addEventListenerCalls = mockSpeakerService.addEventListener.mock.calls;
      const speakerIdentifiedCall = addEventListenerCalls.find(call => call[0] === 'speakerIdentified');
      
      if (speakerIdentifiedCall) {
        const handler = speakerIdentifiedCall[1];
        handler(speakerData);
      }

      await waitFor(() => {
        const confidenceFill = document.querySelector('.confidence-fill');
        expect(confidenceFill).toHaveStyle('background-color: #F44336'); // Red
      });
    });
  });

  describe('Error Handling', () => {
    test('should handle service initialization failure', async () => {
      mockSpeakerService.initialize.mockRejectedValue(new Error('Init failed'));

      render(
        <SpeakerIdentification 
          audioProcessor={mockAudioProcessor}
          isActive={true}
        />
      );

      // Should not crash and should show loading state
      expect(screen.getByText('Initializing speaker identification...')).toBeInTheDocument();
    });

    test('should handle enrollment failure', async () => {
      mockSpeakerService.enrollSpeaker.mockRejectedValue(new Error('Enrollment failed'));
      
      // Mock alert
      window.alert = jest.fn();

      render(
        <SpeakerIdentification 
          audioProcessor={mockAudioProcessor}
          isActive={true}
        />
      );

      await waitFor(() => {
        expect(mockSpeakerService.initialize).toHaveBeenCalled();
      });

      const enrollButton = screen.getByText('Enroll Speaker');
      fireEvent.click(enrollButton);

      const speakerIdInput = screen.getByPlaceholderText('Enter unique speaker ID');
      fireEvent.change(speakerIdInput, { target: { value: 'test_speaker' } });

      const submitButton = screen.getByRole('button', { name: 'Enroll Speaker' });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(window.alert).toHaveBeenCalledWith('Enrollment failed: Enrollment failed');
      });
    });
  });
});