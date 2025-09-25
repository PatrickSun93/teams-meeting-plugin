// ProgressIndicator.test.js - Tests for the progress indicator component
import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import ProgressIndicator from '../ProgressIndicator';

describe('ProgressIndicator', () => {
  test('renders basic progress indicator', () => {
    render(
      <ProgressIndicator 
        status="loading"
        message="Loading data..."
      />
    );
    
    expect(screen.getByText('Loading data...')).toBeInTheDocument();
  });

  test('displays correct status icons', () => {
    const { rerender } = render(
      <ProgressIndicator status="initializing" message="Initializing..." />
    );
    expect(screen.getByText('🔄')).toBeInTheDocument();

    rerender(<ProgressIndicator status="starting" message="Starting..." />);
    expect(screen.getByText('▶️')).toBeInTheDocument();

    rerender(<ProgressIndicator status="active" message="Active..." />);
    expect(screen.getByText('🟢')).toBeInTheDocument();

    rerender(<ProgressIndicator status="error" message="Error..." />);
    expect(screen.getByText('❌')).toBeInTheDocument();

    rerender(<ProgressIndicator status="success" message="Success..." />);
    expect(screen.getByText('✅')).toBeInTheDocument();
  });

  test('shows spinner for appropriate statuses', () => {
    const { container } = render(
      <ProgressIndicator 
        status="initializing" 
        message="Initializing..."
        showSpinner={true}
      />
    );
    
    expect(container.querySelector('.spinner')).toBeInTheDocument();
    expect(container.querySelector('.spinner-circle')).toBeInTheDocument();
  });

  test('hides spinner when showSpinner is false', () => {
    const { container } = render(
      <ProgressIndicator 
        status="initializing" 
        message="Initializing..."
        showSpinner={false}
      />
    );
    
    expect(container.querySelector('.spinner')).not.toBeInTheDocument();
  });

  test('displays description when provided', () => {
    render(
      <ProgressIndicator 
        status="loading"
        message="Loading data..."
        description="Please wait while we fetch your information"
      />
    );
    
    expect(screen.getByText('Please wait while we fetch your information')).toBeInTheDocument();
  });

  test('shows progress bar with percentage', () => {
    render(
      <ProgressIndicator 
        status="processing"
        message="Processing..."
        progress={65}
      />
    );
    
    expect(screen.getByText('65%')).toBeInTheDocument();
    
    const progressFill = document.querySelector('.progress-fill');
    expect(progressFill).toHaveStyle('width: 65%');
  });

  test('handles progress bar edge cases', () => {
    const { rerender } = render(
      <ProgressIndicator 
        status="processing"
        message="Processing..."
        progress={-10}
      />
    );
    
    let progressFill = document.querySelector('.progress-fill');
    expect(progressFill).toHaveStyle('width: 0%');

    rerender(
      <ProgressIndicator 
        status="processing"
        message="Processing..."
        progress={150}
      />
    );
    
    progressFill = document.querySelector('.progress-fill');
    expect(progressFill).toHaveStyle('width: 100%');
  });

  test('applies correct CSS classes for different statuses', () => {
    const { container, rerender } = render(
      <ProgressIndicator status="error" message="Error occurred" />
    );
    
    expect(container.firstChild).toHaveClass('progress-indicator', 'default', 'error');

    rerender(<ProgressIndicator status="success" message="Success" />);
    expect(container.firstChild).toHaveClass('progress-indicator', 'default', 'success');

    rerender(<ProgressIndicator status="warning" message="Warning" />);
    expect(container.firstChild).toHaveClass('progress-indicator', 'default', 'warning');

    rerender(<ProgressIndicator status="active" message="Active" />);
    expect(container.firstChild).toHaveClass('progress-indicator', 'default', 'active');
  });

  test('applies variant classes', () => {
    const { container, rerender } = render(
      <ProgressIndicator 
        status="loading"
        message="Loading..."
        variant="compact"
      />
    );
    
    expect(container.firstChild).toHaveClass('progress-indicator', 'compact');

    rerender(
      <ProgressIndicator 
        status="loading"
        message="Loading..."
        variant="inline"
      />
    );
    
    expect(container.firstChild).toHaveClass('progress-indicator', 'inline');
  });

  test('renders without progress bar when progress is not provided', () => {
    const { container } = render(
      <ProgressIndicator 
        status="loading"
        message="Loading..."
      />
    );
    
    expect(container.querySelector('.progress-bar-container')).not.toBeInTheDocument();
  });

  test('renders with progress bar when progress is provided', () => {
    const { container } = render(
      <ProgressIndicator 
        status="loading"
        message="Loading..."
        progress={50}
      />
    );
    
    expect(container.querySelector('.progress-bar-container')).toBeInTheDocument();
    expect(container.querySelector('.progress-bar')).toBeInTheDocument();
    expect(container.querySelector('.progress-fill')).toBeInTheDocument();
  });

  test('handles zero progress correctly', () => {
    render(
      <ProgressIndicator 
        status="starting"
        message="Starting..."
        progress={0}
      />
    );
    
    expect(screen.getByText('0%')).toBeInTheDocument();
    
    const progressFill = document.querySelector('.progress-fill');
    expect(progressFill).toHaveStyle('width: 0%');
  });

  test('handles complete progress correctly', () => {
    render(
      <ProgressIndicator 
        status="success"
        message="Complete!"
        progress={100}
      />
    );
    
    expect(screen.getByText('100%')).toBeInTheDocument();
    
    const progressFill = document.querySelector('.progress-fill');
    expect(progressFill).toHaveStyle('width: 100%');
  });

  test('renders default status icon for unknown status', () => {
    render(
      <ProgressIndicator 
        status="unknown-status"
        message="Unknown status..."
      />
    );
    
    expect(screen.getByText('⏳')).toBeInTheDocument();
  });

  test('applies default class for unknown status', () => {
    const { container } = render(
      <ProgressIndicator 
        status="unknown-status"
        message="Unknown status..."
      />
    );
    
    expect(container.firstChild).toHaveClass('progress-indicator', 'default', 'default');
  });
});