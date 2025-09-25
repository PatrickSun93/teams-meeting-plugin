// PluginInterface.test.js - Tests for the main plugin interface
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import PluginInterface from '../PluginInterface';

// Mock the MeetingController hook
jest.mock('../MeetingController', () => {
  return jest.fn(() => ({
    isInitialized: true,
    meetingInfo: {
      id: 'test-meeting-123',
      title: 'Test Meeting',
      startTime: new Date('2024-01-15T10:00:00Z')
    },
    isHost: true,
    participants: [
      { id: '1', name: 'John Doe', isCurrentUser: true, role: 'host' },
      { id: '2', name: 'Jane Smith', role: 'participant' }
    ],
    meetingState: 'active',
    error: null,
    isAudioCapturing: false,
    audioQuality: null,
    startTranscription: jest.fn(),
    stopTranscription: jest.fn(),
    getPlatformCapabilities: () => ({
      supportsChatIntegration: true,
      supportsAgendaAccess: true,
      supportsParticipantInfo: true,
      supportsHostDetection: true,
      audioQuality: 'high'
    }),
    getAudioStatus: jest.fn(),
    transcriptionEngine: null,
    teamsAdapter: {}
  }));
});

// Mock other components
jest.mock('../MeetingStatus', () => {
  return function MockMeetingStatus(props) {
    return <div data-testid="meeting-status">Meeting Status Component</div>;
  };
});

jest.mock('../TranscriptionControls', () => {
  return function MockTranscriptionControls(props) {
    return (
      <div data-testid="transcription-controls">
        <button onClick={props.onStartTranscription}>Start Transcription</button>
        <button onClick={props.onStopTranscription}>Stop Transcription</button>
      </div>
    );
  };
});

jest.mock('../RealTimeTranscription', () => {
  return function MockRealTimeTranscription(props) {
    return <div data-testid="real-time-transcription">Real Time Transcription</div>;
  };
});

jest.mock('../ConfigurationPanel', () => {
  return function MockConfigurationPanel({ isOpen, onClose }) {
    return isOpen ? (
      <div data-testid="configuration-panel">
        <button onClick={onClose}>Close Config</button>
      </div>
    ) : null;
  };
});

jest.mock('../HelpPanel', () => {
  return function MockHelpPanel({ isOpen, onClose }) {
    return isOpen ? (
      <div data-testid="help-panel">
        <button onClick={onClose}>Close Help</button>
      </div>
    ) : null;
  };
});

jest.mock('../DiagnosticPanel', () => {
  return function MockDiagnosticPanel({ isOpen, onClose }) {
    return isOpen ? (
      <div data-testid="diagnostic-panel">
        <button onClick={onClose}>Close Diagnostics</button>
      </div>
    ) : null;
  };
});

jest.mock('../StatusDisplay', () => {
  return function MockStatusDisplay(props) {
    return <div data-testid="status-display">Status: {props.meetingState}</div>;
  };
});

jest.mock('../ProgressIndicator', () => {
  return function MockProgressIndicator(props) {
    return props.status ? (
      <div data-testid="progress-indicator">
        Progress: {props.status} - {props.message}
      </div>
    ) : null;
  };
});

// Mock other components that might be used
jest.mock('../TranscriptManager', () => {
  return function MockTranscriptManager() {
    return <div data-testid="transcript-manager">Transcript Manager</div>;
  };
});

jest.mock('../SummaryDisplay', () => {
  return function MockSummaryDisplay() {
    return <div data-testid="summary-display">Summary Display</div>;
  };
});

jest.mock('../PromptManager', () => {
  return function MockPromptManager() {
    return <div data-testid="prompt-manager">Prompt Manager</div>;
  };
});

jest.mock('../AgendaIntegration', () => {
  return function MockAgendaIntegration() {
    return <div data-testid="agenda-integration">Agenda Integration</div>;
  };
});

jest.mock('../SpeakerIdentification', () => {
  return function MockSpeakerIdentification() {
    return <div data-testid="speaker-identification">Speaker Identification</div>;
  };
});

jest.mock('../ChatIntegration', () => {
  return function MockChatIntegration() {
    return <div data-testid="chat-integration">Chat Integration</div>;
  };
});

jest.mock('../NotificationSystem', () => {
  return function MockNotificationSystem() {
    return <div data-testid="notification-system">Notification System</div>;
  };
});

// Mock the configuration hook
jest.mock('../../hooks/useConfiguration', () => {
  return jest.fn(() => ({
    config: { sttProvider: 'local', aiProvider: 'openai' },
    hasValidConfiguration: () => true,
    requiresConsent: () => false
  }));
});

// Mock the error handler
jest.mock('../../services/ErrorHandler', () => ({
  errorHandler: {
    handleError: jest.fn().mockResolvedValue({ success: true })
  }
}));

describe('PluginInterface', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('renders main interface elements', () => {
    render(<PluginInterface />);
    
    // Check header
    expect(screen.getByText('🎤 Meeting Transcription')).toBeInTheDocument();
    expect(screen.getByText('Real-time transcription and AI summaries')).toBeInTheDocument();
    
    // Check navigation tabs
    expect(screen.getByText('Meeting')).toBeInTheDocument();
    expect(screen.getByText('Transcription')).toBeInTheDocument();
    expect(screen.getByText('Summary')).toBeInTheDocument();
    expect(screen.getByText('History')).toBeInTheDocument();
    expect(screen.getByText('Speakers')).toBeInTheDocument();
    expect(screen.getByText('Agenda')).toBeInTheDocument();
    
    // Check action buttons
    expect(screen.getByTitle('Settings')).toBeInTheDocument();
    expect(screen.getByTitle('Diagnostics')).toBeInTheDocument();
    expect(screen.getByTitle('Help')).toBeInTheDocument();
  });

  test('shows loading state when not initialized', () => {
    const MeetingController = require('../MeetingController');
    MeetingController.mockReturnValue({
      isInitialized: false,
      meetingInfo: null,
      isHost: false,
      participants: [],
      meetingState: 'unknown',
      error: null,
      isAudioCapturing: false,
      audioQuality: null,
      startTranscription: jest.fn(),
      stopTranscription: jest.fn(),
      getPlatformCapabilities: null,
      getAudioStatus: jest.fn(),
      transcriptionEngine: null,
      teamsAdapter: null
    });

    render(<PluginInterface />);
    
    expect(screen.getByText(/Initializing Teams Integration/)).toBeInTheDocument();
  });

  test('displays status information', () => {
    const MeetingController = require('../MeetingController');
    MeetingController.mockReturnValue({
      isInitialized: true,
      meetingInfo: { id: 'test', title: 'Test' },
      isHost: true,
      participants: [],
      meetingState: 'active',
      error: null,
      isAudioCapturing: false,
      audioQuality: null,
      startTranscription: jest.fn(),
      stopTranscription: jest.fn(),
      getPlatformCapabilities: () => ({}),
      getAudioStatus: jest.fn(),
      transcriptionEngine: null,
      teamsAdapter: {}
    });

    render(<PluginInterface />);
    
    expect(screen.getByTestId('status-display')).toBeInTheDocument();
    expect(screen.getByText('Status: active')).toBeInTheDocument();
  });

  test('navigation between tabs works', () => {
    const MeetingController = require('../MeetingController');
    MeetingController.mockReturnValue({
      isInitialized: true,
      meetingInfo: { id: 'test', title: 'Test' },
      isHost: true,
      participants: [],
      meetingState: 'active',
      error: null,
      isAudioCapturing: false,
      audioQuality: null,
      startTranscription: jest.fn(),
      stopTranscription: jest.fn(),
      getPlatformCapabilities: () => ({}),
      getAudioStatus: jest.fn(),
      transcriptionEngine: null,
      teamsAdapter: {}
    });

    render(<PluginInterface />);
    
    // Default tab should be meeting
    expect(screen.getByTestId('meeting-status')).toBeInTheDocument();
    
    // Click transcription tab
    fireEvent.click(screen.getByText('Transcription'));
    expect(screen.getByTestId('real-time-transcription')).toBeInTheDocument();
    
    // Click history tab
    fireEvent.click(screen.getByText('History'));
    expect(screen.getByTestId('transcript-manager')).toBeInTheDocument();
    
    // Click summary tab
    fireEvent.click(screen.getByText('Summary'));
    expect(screen.getByTestId('summary-display')).toBeInTheDocument();
    
    // Click speakers tab
    fireEvent.click(screen.getByText('Speakers'));
    expect(screen.getByTestId('speaker-identification')).toBeInTheDocument();
    
    // Click agenda tab
    fireEvent.click(screen.getByText('Agenda'));
    expect(screen.getByTestId('agenda-integration')).toBeInTheDocument();
  });

  test('opens and closes configuration panel', () => {
    const MeetingController = require('../MeetingController');
    MeetingController.mockReturnValue({
      isInitialized: true,
      meetingInfo: { id: 'test', title: 'Test' },
      isHost: true,
      participants: [],
      meetingState: 'active',
      error: null,
      isAudioCapturing: false,
      audioQuality: null,
      startTranscription: jest.fn(),
      stopTranscription: jest.fn(),
      getPlatformCapabilities: () => ({}),
      getAudioStatus: jest.fn(),
      transcriptionEngine: null,
      teamsAdapter: {}
    });

    render(<PluginInterface />);
    
    // Configuration panel should not be visible initially
    expect(screen.queryByTestId('configuration-panel')).not.toBeInTheDocument();
    
    // Click settings button
    fireEvent.click(screen.getByTitle('Settings'));
    expect(screen.getByTestId('configuration-panel')).toBeInTheDocument();
    
    // Close configuration panel
    fireEvent.click(screen.getByText('Close Config'));
    expect(screen.queryByTestId('configuration-panel')).not.toBeInTheDocument();
  });

  test('opens and closes help panel', () => {
    const MeetingController = require('../MeetingController');
    MeetingController.mockReturnValue({
      isInitialized: true,
      meetingInfo: { id: 'test', title: 'Test' },
      isHost: true,
      participants: [],
      meetingState: 'active',
      error: null,
      isAudioCapturing: false,
      audioQuality: null,
      startTranscription: jest.fn(),
      stopTranscription: jest.fn(),
      getPlatformCapabilities: () => ({}),
      getAudioStatus: jest.fn(),
      transcriptionEngine: null,
      teamsAdapter: {}
    });

    render(<PluginInterface />);
    
    // Help panel should not be visible initially
    expect(screen.queryByTestId('help-panel')).not.toBeInTheDocument();
    
    // Click help button
    fireEvent.click(screen.getByTitle('Help'));
    expect(screen.getByTestId('help-panel')).toBeInTheDocument();
    
    // Close help panel
    fireEvent.click(screen.getByText('Close Help'));
    expect(screen.queryByTestId('help-panel')).not.toBeInTheDocument();
  });

  test('opens and closes diagnostic panel', () => {
    const MeetingController = require('../MeetingController');
    MeetingController.mockReturnValue({
      isInitialized: true,
      meetingInfo: { id: 'test', title: 'Test' },
      isHost: true,
      participants: [],
      meetingState: 'active',
      error: null,
      isAudioCapturing: false,
      audioQuality: null,
      startTranscription: jest.fn(),
      stopTranscription: jest.fn(),
      getPlatformCapabilities: () => ({}),
      getAudioStatus: jest.fn(),
      transcriptionEngine: null,
      teamsAdapter: {}
    });

    render(<PluginInterface />);
    
    // Diagnostic panel should not be visible initially
    expect(screen.queryByTestId('diagnostic-panel')).not.toBeInTheDocument();
    
    // Click diagnostics button
    fireEvent.click(screen.getByTitle('Diagnostics'));
    expect(screen.getByTestId('diagnostic-panel')).toBeInTheDocument();
    
    // Close diagnostic panel
    fireEvent.click(screen.getByText('Close Diagnostics'));
    expect(screen.queryByTestId('diagnostic-panel')).not.toBeInTheDocument();
  });

  test('displays platform capabilities', () => {
    const MeetingController = require('../MeetingController');
    MeetingController.mockReturnValue({
      isInitialized: true,
      meetingInfo: { id: 'test', title: 'Test' },
      isHost: true,
      participants: [],
      meetingState: 'active',
      error: null,
      isAudioCapturing: false,
      audioQuality: null,
      startTranscription: jest.fn(),
      stopTranscription: jest.fn(),
      getPlatformCapabilities: () => ({
        supportsChatIntegration: true,
        supportsAgendaAccess: true
      }),
      getAudioStatus: jest.fn(),
      transcriptionEngine: null,
      teamsAdapter: {}
    });

    render(<PluginInterface />);
    
    // Should show platform capabilities section
    expect(screen.getByText('Platform Capabilities')).toBeInTheDocument();
    expect(screen.getByText('supportsChatIntegration')).toBeInTheDocument();
    expect(screen.getByText('supportsAgendaAccess')).toBeInTheDocument();
  });

  test('handles transcription start and stop', async () => {
    const mockStartTranscription = jest.fn().mockResolvedValue({ success: true });
    const mockStopTranscription = jest.fn().mockResolvedValue({ success: true });
    
    const MeetingController = require('../MeetingController');
    MeetingController.mockReturnValue({
      isInitialized: true,
      meetingInfo: { id: 'test', title: 'Test' },
      isHost: true,
      participants: [],
      meetingState: 'active',
      error: null,
      isAudioCapturing: false,
      audioQuality: null,
      startTranscription: mockStartTranscription,
      stopTranscription: mockStopTranscription,
      getPlatformCapabilities: () => ({}),
      getAudioStatus: jest.fn(),
      transcriptionEngine: null,
      teamsAdapter: {}
    });

    render(<PluginInterface />);
    
    // Click start transcription
    fireEvent.click(screen.getByText('Start Transcription'));
    
    await waitFor(() => {
      expect(mockStartTranscription).toHaveBeenCalled();
    });
  });

  test('shows progress indicator during transcription operations', async () => {
    const mockStartTranscription = jest.fn().mockImplementation(() => {
      return new Promise(resolve => {
        setTimeout(() => resolve({ success: true }), 100);
      });
    });
    
    const MeetingController = require('../MeetingController');
    MeetingController.mockReturnValue({
      isInitialized: true,
      meetingInfo: { id: 'test', title: 'Test' },
      isHost: true,
      participants: [],
      meetingState: 'active',
      error: null,
      isAudioCapturing: false,
      audioQuality: null,
      startTranscription: mockStartTranscription,
      stopTranscription: jest.fn(),
      getPlatformCapabilities: () => ({}),
      getAudioStatus: jest.fn(),
      transcriptionEngine: null,
      teamsAdapter: {}
    });

    render(<PluginInterface />);
    
    // Click start transcription
    fireEvent.click(screen.getByText('Start Transcription'));
    
    // Should show progress indicator
    expect(screen.getByTestId('progress-indicator')).toBeInTheDocument();
    expect(screen.getByText(/Progress: starting/)).toBeInTheDocument();
    
    // Wait for completion
    await waitFor(() => {
      expect(mockStartTranscription).toHaveBeenCalled();
    });
  });

  test('handles configuration validation', () => {
    const useConfiguration = require('../../hooks/useConfiguration');
    useConfiguration.mockReturnValue({
      config: null,
      hasValidConfiguration: () => false,
      requiresConsent: () => true
    });

    render(<PluginInterface />);
    
    // Click start transcription without valid config
    fireEvent.click(screen.getByText('Start Transcription'));
    
    // Should open configuration panel
    expect(screen.getByTestId('configuration-panel')).toBeInTheDocument();
  });

  test('renders notification system', () => {
    render(<PluginInterface />);
    
    expect(screen.getByTestId('notification-system')).toBeInTheDocument();
  });

  test('handles responsive design classes', () => {
    render(<PluginInterface />);
    
    const pluginInterface = screen.getByText('🎤 Meeting Transcription').closest('.plugin-interface');
    expect(pluginInterface).toHaveClass('plugin-interface');
  });
});