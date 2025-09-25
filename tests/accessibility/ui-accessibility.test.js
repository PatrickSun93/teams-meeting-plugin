// Accessibility tests for UI components
import { render, screen } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import userEvent from '@testing-library/user-event';

// Extend Jest matchers
expect.extend(toHaveNoViolations);

// Import components to test
import PluginInterface from '../../src/client/components/PluginInterface';
import ConfigurationPanel from '../../src/client/components/ConfigurationPanel';
import TranscriptionControls from '../../src/client/components/TranscriptionControls';
import RealTimeTranscription from '../../src/client/components/RealTimeTranscription';
import SummaryDisplay from '../../src/client/components/SummaryDisplay';

describe('UI Accessibility Tests', () => {
  test('PluginInterface should be accessible', async () => {
    const { container } = render(<PluginInterface />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  test('ConfigurationPanel should be accessible', async () => {
    const { container } = render(<ConfigurationPanel />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  test('TranscriptionControls should be accessible', async () => {
    const mockProps = {
      isRecording: false,
      onStartRecording: jest.fn(),
      onStopRecording: jest.fn(),
      onPauseRecording: jest.fn()
    };
    
    const { container } = render(<TranscriptionControls {...mockProps} />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  test('RealTimeTranscription should be accessible', async () => {
    const mockProps = {
      transcript: [
        { id: '1', text: 'Hello world', speaker: 'Speaker 1', timestamp: Date.now() },
        { id: '2', text: 'How are you?', speaker: 'Speaker 2', timestamp: Date.now() + 1000 }
      ],
      isActive: true
    };
    
    const { container } = render(<RealTimeTranscription {...mockProps} />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  test('SummaryDisplay should be accessible', async () => {
    const mockProps = {
      summary: {
        keyPoints: ['Point 1', 'Point 2'],
        actionItems: ['Action 1', 'Action 2'],
        decisions: ['Decision 1']
      },
      isLoading: false
    };
    
    const { container } = render(<SummaryDisplay {...mockProps} />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});

describe('Keyboard Navigation Tests', () => {
  test('should support keyboard navigation through main interface', async () => {
    const user = userEvent.setup();
    render(<PluginInterface />);

    // Test Tab navigation
    await user.tab();
    expect(document.activeElement).toHaveAttribute('data-testid', 'start-transcription');

    await user.tab();
    expect(document.activeElement).toHaveAttribute('data-testid', 'config-button');

    await user.tab();
    expect(document.activeElement).toHaveAttribute('data-testid', 'help-button');
  });

  test('should support Enter and Space key activation', async () => {
    const user = userEvent.setup();
    const mockStart = jest.fn();
    
    render(<TranscriptionControls onStartRecording={mockStart} isRecording={false} />);

    const startButton = screen.getByTestId('start-transcription');
    startButton.focus();

    // Test Enter key
    await user.keyboard('{Enter}');
    expect(mockStart).toHaveBeenCalledTimes(1);

    // Test Space key
    await user.keyboard(' ');
    expect(mockStart).toHaveBeenCalledTimes(2);
  });

  test('should support Escape key to close modals', async () => {
    const user = userEvent.setup();
    const mockClose = jest.fn();
    
    render(<ConfigurationPanel isOpen={true} onClose={mockClose} />);

    await user.keyboard('{Escape}');
    expect(mockClose).toHaveBeenCalled();
  });

  test('should support arrow keys for navigation in lists', async () => {
    const user = userEvent.setup();
    const mockTranscript = [
      { id: '1', text: 'First item', speaker: 'Speaker 1' },
      { id: '2', text: 'Second item', speaker: 'Speaker 2' },
      { id: '3', text: 'Third item', speaker: 'Speaker 1' }
    ];
    
    render(<RealTimeTranscription transcript={mockTranscript} />);

    const firstItem = screen.getByTestId('transcript-item-1');
    firstItem.focus();

    // Test down arrow
    await user.keyboard('{ArrowDown}');
    expect(document.activeElement).toHaveAttribute('data-testid', 'transcript-item-2');

    // Test up arrow
    await user.keyboard('{ArrowUp}');
    expect(document.activeElement).toHaveAttribute('data-testid', 'transcript-item-1');
  });
});

describe('Screen Reader Support Tests', () => {
  test('should have proper ARIA labels and roles', () => {
    render(<PluginInterface />);

    // Check main container has proper role
    const main = screen.getByRole('main');
    expect(main).toBeInTheDocument();

    // Check buttons have proper labels
    const startButton = screen.getByRole('button', { name: /start transcription/i });
    expect(startButton).toHaveAttribute('aria-label');

    // Check status indicators have proper roles
    const status = screen.getByRole('status');
    expect(status).toBeInTheDocument();
  });

  test('should announce transcription updates to screen readers', () => {
    const mockTranscript = [
      { id: '1', text: 'New transcription text', speaker: 'Speaker 1', timestamp: Date.now() }
    ];
    
    render(<RealTimeTranscription transcript={mockTranscript} />);

    const liveRegion = screen.getByRole('log');
    expect(liveRegion).toHaveAttribute('aria-live', 'polite');
    expect(liveRegion).toHaveAttribute('aria-label', 'Live transcription');
  });

  test('should provide proper form labels and descriptions', () => {
    render(<ConfigurationPanel />);

    // Check form controls have labels
    const sttSelect = screen.getByLabelText(/speech-to-text provider/i);
    expect(sttSelect).toBeInTheDocument();

    const apiKeyInput = screen.getByLabelText(/api key/i);
    expect(apiKeyInput).toBeInTheDocument();
    expect(apiKeyInput).toHaveAttribute('aria-describedby');
  });

  test('should announce errors and status changes', () => {
    const mockError = 'Failed to start transcription';
    
    render(<PluginInterface error={mockError} />);

    const errorAlert = screen.getByRole('alert');
    expect(errorAlert).toHaveTextContent(mockError);
    expect(errorAlert).toHaveAttribute('aria-live', 'assertive');
  });
});

describe('Color Contrast and Visual Accessibility Tests', () => {
  test('should meet WCAG color contrast requirements', async () => {
    const { container } = render(<PluginInterface />);
    
    // Test with axe-core color contrast rules
    const results = await axe(container, {
      rules: {
        'color-contrast': { enabled: true }
      }
    });
    
    expect(results).toHaveNoViolations();
  });

  test('should be usable without color alone', () => {
    render(<TranscriptionControls isRecording={true} />);

    // Recording status should be indicated by more than just color
    const recordingIndicator = screen.getByTestId('recording-status');
    expect(recordingIndicator).toHaveTextContent(/recording/i);
    expect(recordingIndicator).toHaveAttribute('aria-label');
  });

  test('should support high contrast mode', () => {
    // Mock high contrast media query
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: jest.fn().mockImplementation(query => ({
        matches: query === '(prefers-contrast: high)',
        media: query,
        onchange: null,
        addListener: jest.fn(),
        removeListener: jest.fn(),
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        dispatchEvent: jest.fn(),
      })),
    });

    render(<PluginInterface />);
    
    // Component should adapt to high contrast mode
    const container = screen.getByTestId('plugin-interface');
    expect(container).toHaveClass('high-contrast');
  });
});

describe('Focus Management Tests', () => {
  test('should trap focus in modal dialogs', async () => {
    const user = userEvent.setup();
    
    render(<ConfigurationPanel isOpen={true} />);

    const modal = screen.getByRole('dialog');
    const firstFocusable = screen.getByTestId('stt-provider-select');
    const lastFocusable = screen.getByTestId('save-config-button');

    // Focus should start on first focusable element
    expect(document.activeElement).toBe(firstFocusable);

    // Tab from last element should cycle to first
    lastFocusable.focus();
    await user.tab();
    expect(document.activeElement).toBe(firstFocusable);

    // Shift+Tab from first element should cycle to last
    await user.tab({ shift: true });
    expect(document.activeElement).toBe(lastFocusable);
  });

  test('should restore focus after modal closes', async () => {
    const user = userEvent.setup();
    
    render(<PluginInterface />);

    const configButton = screen.getByTestId('config-button');
    configButton.focus();
    
    // Open modal
    await user.click(configButton);
    
    // Close modal
    const closeButton = screen.getByTestId('close-config');
    await user.click(closeButton);
    
    // Focus should return to config button
    expect(document.activeElement).toBe(configButton);
  });

  test('should provide skip links for keyboard users', () => {
    render(<PluginInterface />);

    const skipLink = screen.getByText(/skip to main content/i);
    expect(skipLink).toBeInTheDocument();
    expect(skipLink).toHaveAttribute('href', '#main-content');
  });
});

describe('Reduced Motion Support Tests', () => {
  test('should respect prefers-reduced-motion setting', () => {
    // Mock reduced motion media query
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: jest.fn().mockImplementation(query => ({
        matches: query === '(prefers-reduced-motion: reduce)',
        media: query,
        onchange: null,
        addListener: jest.fn(),
        removeListener: jest.fn(),
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        dispatchEvent: jest.fn(),
      })),
    });

    render(<PluginInterface />);
    
    // Animations should be disabled
    const animatedElement = screen.getByTestId('progress-indicator');
    expect(animatedElement).toHaveClass('reduced-motion');
  });
});