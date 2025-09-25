// StatusDisplay.test.js - Tests for the status display component
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import StatusDisplay from '../StatusDisplay';

describe('StatusDisplay', () => {
  const mockOnClearError = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('displays error status', () => {
    render(
      <StatusDisplay 
        meetingState="active"
        isTranscribing={false}
        isHost={true}
        error="Something went wrong"
        onClearError={mockOnClearError}
      />
    );
    
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    expect(screen.getByText('❌')).toBeInTheDocument();
  });

  test('displays inactive meeting status', () => {
    render(
      <StatusDisplay 
        meetingState="ended"
        isTranscribing={false}
        isHost={false}
        onClearError={mockOnClearError}
      />
    );
    
    expect(screen.getByText('No active meeting')).toBeInTheDocument();
    expect(screen.getByText('⚪')).toBeInTheDocument();
  });

  test('displays active transcription status', () => {
    render(
      <StatusDisplay 
        meetingState="active"
        isTranscribing={true}
        isHost={true}
        onClearError={mockOnClearError}
      />
    );
    
    expect(screen.getByText('Transcription active')).toBeInTheDocument();
    expect(screen.getByText('🔴')).toBeInTheDocument();
    expect(screen.getByText('Recording and processing audio')).toBeInTheDocument();
  });

  test('displays ready status for host', () => {
    render(
      <StatusDisplay 
        meetingState="active"
        isTranscribing={false}
        isHost={true}
        onClearError={mockOnClearError}
      />
    );
    
    expect(screen.getByText('Ready to start transcription')).toBeInTheDocument();
    expect(screen.getByText('🟢')).toBeInTheDocument();
  });

  test('displays waiting status for participant', () => {
    render(
      <StatusDisplay 
        meetingState="active"
        isTranscribing={false}
        isHost={false}
        onClearError={mockOnClearError}
      />
    );
    
    expect(screen.getByText('Waiting for host to start transcription')).toBeInTheDocument();
    expect(screen.getByText('🟡')).toBeInTheDocument();
  });

  test('shows audio quality metrics when transcribing', () => {
    const audioQuality = {
      averageVolume: 0.05,
      signalToNoiseRatio: 3.2
    };

    render(
      <StatusDisplay 
        meetingState="active"
        isTranscribing={true}
        isHost={true}
        audioQuality={audioQuality}
        onClearError={mockOnClearError}
      />
    );
    
    expect(screen.getByText('Volume:')).toBeInTheDocument();
    expect(screen.getByText('5.0%')).toBeInTheDocument();
    expect(screen.getByText('S/N Ratio:')).toBeInTheDocument();
    expect(screen.getByText('3.2')).toBeInTheDocument();
    expect(screen.getByText('Quality:')).toBeInTheDocument();
    expect(screen.getByText('Good')).toBeInTheDocument();
  });

  test('shows poor audio quality indicators', () => {
    const audioQuality = {
      averageVolume: 0.005,
      signalToNoiseRatio: 1.5
    };

    render(
      <StatusDisplay 
        meetingState="active"
        isTranscribing={true}
        isHost={true}
        audioQuality={audioQuality}
        onClearError={mockOnClearError}
      />
    );
    
    expect(screen.getByText('0.5%')).toBeInTheDocument();
    expect(screen.getByText('1.5')).toBeInTheDocument();
    expect(screen.getByText('Poor')).toBeInTheDocument();
  });

  test('handles missing signal to noise ratio', () => {
    const audioQuality = {
      averageVolume: 0.02,
      signalToNoiseRatio: null
    };

    render(
      <StatusDisplay 
        meetingState="active"
        isTranscribing={true}
        isHost={true}
        audioQuality={audioQuality}
        onClearError={mockOnClearError}
      />
    );
    
    expect(screen.getByText('N/A')).toBeInTheDocument();
  });

  test('does not show audio metrics when not transcribing', () => {
    const audioQuality = {
      averageVolume: 0.05,
      signalToNoiseRatio: 3.2
    };

    render(
      <StatusDisplay 
        meetingState="active"
        isTranscribing={false}
        isHost={true}
        audioQuality={audioQuality}
        onClearError={mockOnClearError}
      />
    );
    
    expect(screen.queryByText('Volume:')).not.toBeInTheDocument();
  });

  test('error dismiss button works', () => {
    render(
      <StatusDisplay 
        meetingState="active"
        isTranscribing={false}
        isHost={true}
        error="Test error"
        onClearError={mockOnClearError}
      />
    );
    
    const dismissButton = screen.getByText('×');
    fireEvent.click(dismissButton);
    
    expect(mockOnClearError).toHaveBeenCalledTimes(1);
  });

  test('does not show dismiss button when no error', () => {
    render(
      <StatusDisplay 
        meetingState="active"
        isTranscribing={false}
        isHost={true}
        onClearError={mockOnClearError}
      />
    );
    
    expect(screen.queryByText('×')).not.toBeInTheDocument();
  });

  test('applies correct CSS classes for different states', () => {
    const { container, rerender } = render(
      <StatusDisplay 
        meetingState="active"
        isTranscribing={false}
        isHost={true}
        error="Test error"
        onClearError={mockOnClearError}
      />
    );
    
    expect(container.firstChild).toHaveClass('status-display', 'error');

    rerender(
      <StatusDisplay 
        meetingState="active"
        isTranscribing={true}
        isHost={true}
        onClearError={mockOnClearError}
      />
    );
    
    expect(container.firstChild).toHaveClass('status-display', 'active');

    rerender(
      <StatusDisplay 
        meetingState="active"
        isTranscribing={false}
        isHost={true}
        onClearError={mockOnClearError}
      />
    );
    
    expect(container.firstChild).toHaveClass('status-display', 'ready');

    rerender(
      <StatusDisplay 
        meetingState="active"
        isTranscribing={false}
        isHost={false}
        onClearError={mockOnClearError}
      />
    );
    
    expect(container.firstChild).toHaveClass('status-display', 'waiting');

    rerender(
      <StatusDisplay 
        meetingState="ended"
        isTranscribing={false}
        isHost={false}
        onClearError={mockOnClearError}
      />
    );
    
    expect(container.firstChild).toHaveClass('status-display', 'inactive');
  });

  test('audio quality metrics have correct CSS classes', () => {
    const audioQuality = {
      averageVolume: 0.05,
      signalToNoiseRatio: 1.5
    };

    const { container } = render(
      <StatusDisplay 
        meetingState="active"
        isTranscribing={true}
        isHost={true}
        audioQuality={audioQuality}
        onClearError={mockOnClearError}
      />
    );
    
    const volumeValue = screen.getByText('5.0%');
    const snrValue = screen.getByText('1.5');
    const qualityValue = screen.getByText('Poor');
    
    expect(volumeValue).toHaveClass('metric-value', 'good');
    expect(snrValue).toHaveClass('metric-value', 'poor');
    expect(qualityValue).toHaveClass('metric-value', 'poor');
  });

  test('handles edge case with zero volume', () => {
    const audioQuality = {
      averageVolume: 0,
      signalToNoiseRatio: 5
    };

    render(
      <StatusDisplay 
        meetingState="active"
        isTranscribing={true}
        isHost={true}
        audioQuality={audioQuality}
        onClearError={mockOnClearError}
      />
    );
    
    expect(screen.getByText('0.0%')).toBeInTheDocument();
    expect(screen.getByText('Poor')).toBeInTheDocument();
  });
});