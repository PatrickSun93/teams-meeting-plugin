/**
 * Tests for the DiagnosticPanel component
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import DiagnosticPanel from '../DiagnosticPanel';
import { errorHandler } from '../../services/ErrorHandler';

// Mock the error handler
jest.mock('../../services/ErrorHandler', () => ({
  errorHandler: {
    getDiagnosticInfo: jest.fn(),
    clearDiagnosticData: jest.fn()
  }
}));

// Mock browser APIs
const mockMediaDevices = {
  getUserMedia: jest.fn()
};

const mockPermissions = {
  query: jest.fn()
};

Object.defineProperty(global.navigator, 'mediaDevices', {
  value: mockMediaDevices,
  writable: true
});

Object.defineProperty(global.navigator, 'permissions', {
  value: mockPermissions,
  writable: true
});

// Mock IndexedDB
const mockIndexedDB = {
  open: jest.fn(),
  deleteDatabase: jest.fn()
};

Object.defineProperty(global, 'indexedDB', {
  value: mockIndexedDB,
  writable: true
});

// Mock fetch
global.fetch = jest.fn();

describe('DiagnosticPanel', () => {
  const mockOnClose = jest.fn();
  
  const mockDiagnosticData = {
    recentErrors: [
      {
        id: '1',
        code: 'STT_SERVICE_UNAVAILABLE',
        message: 'Service unavailable',
        category: 'transcription',
        timestamp: new Date('2023-01-01T12:00:00Z')
      },
      {
        id: '2',
        code: 'MICROPHONE_ACCESS_DENIED',
        message: 'Microphone access denied',
        category: 'audio_capture',
        timestamp: new Date('2023-01-01T12:05:00Z')
      }
    ],
    fallbackModes: {
      transcription: 'local-only',
      summary: 'basic-summary'
    },
    retryAttempts: {
      'STT_SERVICE_UNAVAILABLE_transcription': 2
    },
    timestamp: new Date()
  };

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup default mocks
    errorHandler.getDiagnosticInfo.mockReturnValue(mockDiagnosticData);
    
    // Mock navigator properties
    Object.defineProperty(global.navigator, 'userAgent', {
      value: 'Mozilla/5.0 (Test Browser)',
      writable: true
    });
    
    Object.defineProperty(global.navigator, 'platform', {
      value: 'Test Platform',
      writable: true
    });
    
    Object.defineProperty(global.navigator, 'language', {
      value: 'en-US',
      writable: true
    });
    
    Object.defineProperty(global.navigator, 'onLine', {
      value: true,
      writable: true
    });

    mockPermissions.query.mockResolvedValue({ state: 'granted' });
  });

  describe('Rendering', () => {
    test('should not render when closed', () => {
      const { container } = render(
        <DiagnosticPanel isOpen={false} onClose={mockOnClose} />
      );
      
      expect(container.firstChild).toBeNull();
    });

    test('should render when open', () => {
      render(<DiagnosticPanel isOpen={true} onClose={mockOnClose} />);
      
      expect(screen.getByText('Diagnostic & Troubleshooting')).toBeInTheDocument();
      expect(screen.getByText('System Information')).toBeInTheDocument();
      expect(screen.getByText('Recent Errors')).toBeInTheDocument();
      expect(screen.getByText('Fallback Modes')).toBeInTheDocument();
      expect(screen.getByText('System Tests')).toBeInTheDocument();
    });

    test('should call onClose when close button is clicked', () => {
      render(<DiagnosticPanel isOpen={true} onClose={mockOnClose} />);
      
      fireEvent.click(screen.getByText('×'));
      expect(mockOnClose).toHaveBeenCalled();
    });
  });

  describe('System Information', () => {
    test('should display system information', () => {
      render(<DiagnosticPanel isOpen={true} onClose={mockOnClose} />);
      
      expect(screen.getByText('Test Platform')).toBeInTheDocument();
      expect(screen.getByText('en-US')).toBeInTheDocument();
      expect(screen.getByText('Yes')).toBeInTheDocument(); // Online status
    });

    test('should display API support status', async () => {
      // Mock API availability
      global.window.SpeechRecognition = function() {};
      global.window.AudioContext = function() {};
      global.window.indexedDB = {};
      
      render(<DiagnosticPanel isOpen={true} onClose={mockOnClose} />);
      
      await waitFor(() => {
        expect(screen.getByText('speechRecognition')).toBeInTheDocument();
        expect(screen.getByText('audioContext')).toBeInTheDocument();
        expect(screen.getByText('indexedDB')).toBeInTheDocument();
      });
    });

    test('should display permissions status', async () => {
      render(<DiagnosticPanel isOpen={true} onClose={mockOnClose} />);
      
      await waitFor(() => {
        expect(screen.getByText('microphone:')).toBeInTheDocument();
        expect(screen.getByText('granted')).toBeInTheDocument();
      });
    });
  });

  describe('Recent Errors', () => {
    test('should display recent errors', () => {
      render(<DiagnosticPanel isOpen={true} onClose={mockOnClose} />);
      
      expect(screen.getByText('STT_SERVICE_UNAVAILABLE')).toBeInTheDocument();
      expect(screen.getByText('Service unavailable')).toBeInTheDocument();
      expect(screen.getByText('Category: transcription')).toBeInTheDocument();
      
      expect(screen.getByText('MICROPHONE_ACCESS_DENIED')).toBeInTheDocument();
      expect(screen.getByText('Microphone access denied')).toBeInTheDocument();
      expect(screen.getByText('Category: audio_capture')).toBeInTheDocument();
    });

    test('should display no errors message when no recent errors', () => {
      errorHandler.getDiagnosticInfo.mockReturnValue({
        ...mockDiagnosticData,
        recentErrors: []
      });
      
      render(<DiagnosticPanel isOpen={true} onClose={mockOnClose} />);
      
      expect(screen.getByText('No recent errors')).toBeInTheDocument();
    });

    test('should clear error history when clear button is clicked', () => {
      render(<DiagnosticPanel isOpen={true} onClose={mockOnClose} />);
      
      fireEvent.click(screen.getByText('Clear Error History'));
      
      expect(errorHandler.clearDiagnosticData).toHaveBeenCalled();
    });
  });

  describe('Fallback Modes', () => {
    test('should display active fallback modes', () => {
      render(<DiagnosticPanel isOpen={true} onClose={mockOnClose} />);
      
      expect(screen.getByText('transcription:')).toBeInTheDocument();
      expect(screen.getByText('local-only')).toBeInTheDocument();
      expect(screen.getByText('summary:')).toBeInTheDocument();
      expect(screen.getByText('basic-summary')).toBeInTheDocument();
    });

    test('should display no fallback modes message when none active', () => {
      errorHandler.getDiagnosticInfo.mockReturnValue({
        ...mockDiagnosticData,
        fallbackModes: {}
      });
      
      render(<DiagnosticPanel isOpen={true} onClose={mockOnClose} />);
      
      expect(screen.getByText('No active fallback modes')).toBeInTheDocument();
    });
  });

  describe('Diagnostic Tests', () => {
    test('should run diagnostic tests when button is clicked', async () => {
      // Mock successful tests
      mockMediaDevices.getUserMedia.mockResolvedValue({
        getAudioTracks: () => [{
          stop: jest.fn(),
          getSettings: () => ({
            deviceId: 'test-device',
            sampleRate: 44100,
            channelCount: 2
          })
        }]
      });
      
      global.fetch.mockResolvedValue({ ok: true, status: 200 });
      
      // Mock localStorage
      const mockLocalStorage = {
        setItem: jest.fn(),
        getItem: jest.fn().mockReturnValue('test_data'),
        removeItem: jest.fn()
      };
      Object.defineProperty(global, 'localStorage', {
        value: mockLocalStorage,
        writable: true
      });
      
      // Mock IndexedDB
      mockIndexedDB.open.mockImplementation(() => {
        const request = {
          onsuccess: null,
          onerror: null,
          onupgradeneeded: null,
          result: { close: jest.fn() }
        };
        setTimeout(() => {
          if (request.onsuccess) request.onsuccess();
        }, 0);
        return request;
      });
      
      // Mock AudioContext
      global.window.AudioContext = jest.fn().mockImplementation(() => ({
        createOscillator: jest.fn().mockReturnValue({
          connect: jest.fn(),
          start: jest.fn(),
          stop: jest.fn(),
          frequency: { setValueAtTime: jest.fn() }
        }),
        createGain: jest.fn().mockReturnValue({
          connect: jest.fn(),
          gain: { setValueAtTime: jest.fn() }
        }),
        destination: {},
        currentTime: 0,
        sampleRate: 44100,
        state: 'running',
        close: jest.fn().mockResolvedValue()
      }));
      
      render(<DiagnosticPanel isOpen={true} onClose={mockOnClose} />);
      
      fireEvent.click(screen.getByText('Run Diagnostic Tests'));
      
      expect(screen.getByText('Running Tests...')).toBeInTheDocument();
      
      await waitFor(() => {
        expect(screen.getByText('Run Diagnostic Tests')).toBeInTheDocument();
      });
      
      // Should show test results
      await waitFor(() => {
        expect(screen.getByText('microphoneTest')).toBeInTheDocument();
        expect(screen.getByText('networkTest')).toBeInTheDocument();
        expect(screen.getByText('storageTest')).toBeInTheDocument();
        expect(screen.getByText('audioProcessingTest')).toBeInTheDocument();
        expect(screen.getByText('speechRecognitionTest')).toBeInTheDocument();
      });
    });

    test('should handle microphone test failure', async () => {
      mockMediaDevices.getUserMedia.mockRejectedValue(
        new Error('Permission denied')
      );
      
      render(<DiagnosticPanel isOpen={true} onClose={mockOnClose} />);
      
      fireEvent.click(screen.getByText('Run Diagnostic Tests'));
      
      await waitFor(() => {
        expect(screen.getByText('microphoneTest')).toBeInTheDocument();
      });
      
      // Should show failure status
      const testResults = screen.getByText('microphoneTest').closest('.test-result');
      expect(testResults).toHaveTextContent('✗');
      expect(testResults).toHaveTextContent('Permission denied');
    });

    test('should handle network test with mixed results', async () => {
      // Mock mixed network results
      global.fetch
        .mockResolvedValueOnce({ ok: true, status: 200 }) // First URL succeeds
        .mockRejectedValueOnce(new Error('Network error')) // Second URL fails
        .mockResolvedValueOnce({ ok: true, status: 200 }); // Third URL succeeds
      
      render(<DiagnosticPanel isOpen={true} onClose={mockOnClose} />);
      
      fireEvent.click(screen.getByText('Run Diagnostic Tests'));
      
      await waitFor(() => {
        expect(screen.getByText('networkTest')).toBeInTheDocument();
      });
      
      // Should show success because at least one URL succeeded
      const testResults = screen.getByText('networkTest').closest('.test-result');
      expect(testResults).toHaveTextContent('✓');
    });

    test('should test speech recognition availability', async () => {
      // Mock SpeechRecognition availability
      global.window.webkitSpeechRecognition = jest.fn().mockImplementation(() => ({
        continuous: false,
        interimResults: false,
        maxAlternatives: 1
      }));
      
      render(<DiagnosticPanel isOpen={true} onClose={mockOnClose} />);
      
      fireEvent.click(screen.getByText('Run Diagnostic Tests'));
      
      await waitFor(() => {
        expect(screen.getByText('speechRecognitionTest')).toBeInTheDocument();
      });
      
      const testResults = screen.getByText('speechRecognitionTest').closest('.test-result');
      expect(testResults).toHaveTextContent('✓');
      expect(testResults).toHaveTextContent('Speech Recognition API is available');
    });
  });

  describe('Export Functionality', () => {
    test('should export diagnostic report when button is clicked', () => {
      // Mock URL.createObjectURL and related APIs
      global.URL.createObjectURL = jest.fn().mockReturnValue('blob:test-url');
      global.URL.revokeObjectURL = jest.fn();
      
      // Mock document.createElement and appendChild/removeChild
      const mockAnchor = {
        href: '',
        download: '',
        click: jest.fn()
      };
      
      jest.spyOn(document, 'createElement').mockReturnValue(mockAnchor);
      jest.spyOn(document.body, 'appendChild').mockImplementation(() => {});
      jest.spyOn(document.body, 'removeChild').mockImplementation(() => {});
      
      render(<DiagnosticPanel isOpen={true} onClose={mockOnClose} />);
      
      fireEvent.click(screen.getByText('Export Diagnostic Report'));
      
      expect(document.createElement).toHaveBeenCalledWith('a');
      expect(mockAnchor.click).toHaveBeenCalled();
      expect(global.URL.createObjectURL).toHaveBeenCalled();
      expect(global.URL.revokeObjectURL).toHaveBeenCalled();
    });
  });

  describe('Refresh Functionality', () => {
    test('should refresh diagnostic data when button is clicked', () => {
      render(<DiagnosticPanel isOpen={true} onClose={mockOnClose} />);
      
      fireEvent.click(screen.getByText('Refresh Data'));
      
      // Should call getDiagnosticInfo again
      expect(errorHandler.getDiagnosticInfo).toHaveBeenCalledTimes(2); // Once on mount, once on refresh
    });
  });

  describe('Error Handling', () => {
    test('should handle permission query failure gracefully', async () => {
      mockPermissions.query.mockRejectedValue(new Error('Permission query failed'));
      
      render(<DiagnosticPanel isOpen={true} onClose={mockOnClose} />);
      
      await waitFor(() => {
        expect(screen.getByText('microphone:')).toBeInTheDocument();
        expect(screen.getByText('unknown')).toBeInTheDocument();
      });
    });

    test('should handle missing navigator APIs gracefully', () => {
      // Remove some navigator properties
      delete global.navigator.deviceMemory;
      delete global.navigator.connection;
      
      render(<DiagnosticPanel isOpen={true} onClose={mockOnClose} />);
      
      expect(screen.getByText('Unknown GB')).toBeInTheDocument();
    });
  });
});