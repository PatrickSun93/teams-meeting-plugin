// HelpPanel.test.js - Tests for the help panel component
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import HelpPanel from '../HelpPanel';

describe('HelpPanel', () => {
  const mockOnClose = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('does not render when isOpen is false', () => {
    render(<HelpPanel isOpen={false} onClose={mockOnClose} />);
    
    expect(screen.queryByText('Help & Documentation')).not.toBeInTheDocument();
  });

  test('renders when isOpen is true', () => {
    render(<HelpPanel isOpen={true} onClose={mockOnClose} />);
    
    expect(screen.getByText('Help & Documentation')).toBeInTheDocument();
  });

  test('renders all navigation sections', () => {
    render(<HelpPanel isOpen={true} onClose={mockOnClose} />);
    
    expect(screen.getByText('Getting Started')).toBeInTheDocument();
    expect(screen.getByText('Configuration')).toBeInTheDocument();
    expect(screen.getByText('Features')).toBeInTheDocument();
    expect(screen.getByText('Troubleshooting')).toBeInTheDocument();
    expect(screen.getByText('Privacy & Security')).toBeInTheDocument();
    expect(screen.getByText('Keyboard Shortcuts')).toBeInTheDocument();
  });

  test('displays getting started content by default', () => {
    render(<HelpPanel isOpen={true} onClose={mockOnClose} />);
    
    expect(screen.getByText('Welcome to Meeting Transcription')).toBeInTheDocument();
    expect(screen.getByText('Quick Start Guide')).toBeInTheDocument();
  });

  test('navigation between sections works', () => {
    render(<HelpPanel isOpen={true} onClose={mockOnClose} />);
    
    // Click configuration section
    fireEvent.click(screen.getByText('Configuration'));
    expect(screen.getByText('Plugin Configuration')).toBeInTheDocument();
    expect(screen.getByText('Transcription Services')).toBeInTheDocument();
    
    // Click features section
    fireEvent.click(screen.getByText('Features'));
    expect(screen.getByText('Plugin Features')).toBeInTheDocument();
    expect(screen.getByText('Real-time Transcription')).toBeInTheDocument();
    
    // Click troubleshooting section
    fireEvent.click(screen.getByText('Troubleshooting'));
    expect(screen.getByText('Common Issues')).toBeInTheDocument();
    expect(screen.getByText('Transcription Not Starting')).toBeInTheDocument();
    
    // Click privacy section
    fireEvent.click(screen.getByText('Privacy & Security'));
    expect(screen.getByText('Data Processing')).toBeInTheDocument();
    expect(screen.getByText('Local Processing:')).toBeInTheDocument();
    
    // Click keyboard shortcuts section
    fireEvent.click(screen.getByText('Keyboard Shortcuts'));
    expect(screen.getByText('Global Shortcuts')).toBeInTheDocument();
    expect(screen.getByText('Navigation Shortcuts')).toBeInTheDocument();
  });

  test('close button works', () => {
    render(<HelpPanel isOpen={true} onClose={mockOnClose} />);
    
    const closeButton = screen.getByText('×');
    fireEvent.click(closeButton);
    
    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  test('displays keyboard shortcuts correctly', () => {
    render(<HelpPanel isOpen={true} onClose={mockOnClose} />);
    
    // Navigate to keyboard shortcuts
    fireEvent.click(screen.getByText('Keyboard Shortcuts'));
    
    // Check for keyboard shortcut elements
    expect(screen.getAllByText('Ctrl')).toHaveLength(6); // Multiple Ctrl keys expected
    expect(screen.getAllByText('Shift')).toHaveLength(4); // Multiple Shift keys expected
    expect(screen.getByText('Toggle transcription (host only)')).toBeInTheDocument();
    expect(screen.getByText('Open settings')).toBeInTheDocument();
  });

  test('displays configuration information', () => {
    render(<HelpPanel isOpen={true} onClose={mockOnClose} />);
    
    // Navigate to configuration
    fireEvent.click(screen.getByText('Configuration'));
    
    expect(screen.getByText('Local STT:')).toBeInTheDocument();
    expect(screen.getByText('OpenAI Whisper:')).toBeInTheDocument();
    expect(screen.getByText('Azure Speech:')).toBeInTheDocument();
    expect(screen.getAllByText('Claude:')).toHaveLength(2); // Appears in both STT and AI sections
  });

  test('displays features information', () => {
    render(<HelpPanel isOpen={true} onClose={mockOnClose} />);
    
    // Navigate to features
    fireEvent.click(screen.getByText('Features'));
    
    expect(screen.getByText('Live speech-to-text conversion')).toBeInTheDocument();
    expect(screen.getByText('Speaker identification and labeling')).toBeInTheDocument();
    expect(screen.getByText('Automatic meeting summaries')).toBeInTheDocument();
    expect(screen.getByText('Action item extraction')).toBeInTheDocument();
  });

  test('displays troubleshooting information', () => {
    render(<HelpPanel isOpen={true} onClose={mockOnClose} />);
    
    // Navigate to troubleshooting
    fireEvent.click(screen.getByText('Troubleshooting'));
    
    expect(screen.getByText('Ensure you\'re the meeting host')).toBeInTheDocument();
    expect(screen.getByText('Check microphone permissions')).toBeInTheDocument();
    expect(screen.getByText('Poor Audio Quality')).toBeInTheDocument();
    expect(screen.getByText('Missing Transcripts')).toBeInTheDocument();
  });

  test('displays privacy and security information', () => {
    render(<HelpPanel isOpen={true} onClose={mockOnClose} />);
    
    // Navigate to privacy section
    fireEvent.click(screen.getByText('Privacy & Security'));
    
    expect(screen.getByText('When using local STT, audio never leaves your device')).toBeInTheDocument();
    expect(screen.getByText('Audio is sent to configured cloud providers')).toBeInTheDocument();
    expect(screen.getByText('All stored data is encrypted locally')).toBeInTheDocument();
  });

  test('navigation items have correct icons', () => {
    render(<HelpPanel isOpen={true} onClose={mockOnClose} />);
    
    expect(screen.getByText('🚀')).toBeInTheDocument(); // Getting Started
    expect(screen.getByText('⚙️')).toBeInTheDocument(); // Configuration
    expect(screen.getByText('✨')).toBeInTheDocument(); // Features
    expect(screen.getByText('🔧')).toBeInTheDocument(); // Troubleshooting
    expect(screen.getByText('🔒')).toBeInTheDocument(); // Privacy & Security
    expect(screen.getByText('⌨️')).toBeInTheDocument(); // Keyboard Shortcuts
  });

  test('active navigation item has correct class', () => {
    const { container } = render(<HelpPanel isOpen={true} onClose={mockOnClose} />);
    
    // Getting started should be active by default
    const gettingStartedButton = screen.getByText('Getting Started').closest('button');
    expect(gettingStartedButton).toHaveClass('active');
    
    // Click configuration
    fireEvent.click(screen.getByText('Configuration'));
    
    const configButton = screen.getByText('Configuration').closest('button');
    expect(configButton).toHaveClass('active');
    expect(gettingStartedButton).not.toHaveClass('active');
  });

  test('footer contains help text', () => {
    render(<HelpPanel isOpen={true} onClose={mockOnClose} />);
    
    expect(screen.getByText(/Need more help\?/)).toBeInTheDocument();
    expect(screen.getByText('troubleshooting guide')).toBeInTheDocument();
  });

  test('troubleshooting link in footer works', () => {
    render(<HelpPanel isOpen={true} onClose={mockOnClose} />);
    
    const troubleshootingLink = screen.getByText('troubleshooting guide');
    fireEvent.click(troubleshootingLink);
    
    // Should navigate to troubleshooting section
    expect(screen.getByText('Common Issues')).toBeInTheDocument();
  });

  test('external links have correct attributes', () => {
    render(<HelpPanel isOpen={true} onClose={mockOnClose} />);
    
    // Navigate to configuration to find external links
    fireEvent.click(screen.getByText('Configuration'));
    
    const openAILink = screen.getByText('OpenAI Platform');
    expect(openAILink).toHaveAttribute('href', 'https://platform.openai.com/api-keys');
    expect(openAILink).toHaveAttribute('target', '_blank');
    expect(openAILink).toHaveAttribute('rel', 'noopener noreferrer');
  });

  test('renders help notes and warnings correctly', () => {
    render(<HelpPanel isOpen={true} onClose={mockOnClose} />);
    
    // Check getting started note
    expect(screen.getByText('Note:')).toBeInTheDocument();
    expect(screen.getByText(/Only meeting hosts can start and stop transcription/)).toBeInTheDocument();
    
    // Navigate to configuration for privacy warning
    fireEvent.click(screen.getByText('Configuration'));
    expect(screen.getByText('Privacy:')).toBeInTheDocument();
    expect(screen.getByText(/When using cloud services, audio data is sent to external providers/)).toBeInTheDocument();
  });
});