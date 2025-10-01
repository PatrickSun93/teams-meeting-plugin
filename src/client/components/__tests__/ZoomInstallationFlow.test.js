/**
 * Tests for ZoomInstallationFlow component
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import ZoomInstallationFlow from '../ZoomInstallationFlow';

// Mock ZoomOAuthService
const mockZoomOAuthService = {
  isAuthenticated: jest.fn(),
  getAuthorizationUrl: jest.fn(),
  exchangeCodeForToken: jest.fn(),
  makeAuthenticatedRequest: jest.fn(),
  revokeToken: jest.fn()
};

// Mock window.open
global.open = jest.fn();

// Mock sessionStorage
const sessionStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn()
};
global.sessionStorage = sessionStorageMock;

describe('ZoomInstallationFlow', () => {
  const defaultProps = {
    zoomOAuthService: mockZoomOAuthService,
    onInstallationComplete: jest.fn(),
    onInstallationError: jest.fn()
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockZoomOAuthService.isAuthenticated.mockReturnValue(false);
  });

  describe('initial render', () => {
    it('should render welcome step by default', () => {
      render(<ZoomInstallationFlow {...defaultProps} />);

      expect(screen.getByText('Connect to Zoom')).toBeInTheDocument();
      expect(screen.getByText('Enable real-time transcription for your Zoom meetings')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Connect to Zoom' })).toBeInTheDocument();
    });

    it('should show complete step if already authenticated', () => {
      mockZoomOAuthService.isAuthenticated.mockReturnValue(true);
      mockZoomOAuthService.makeAuthenticatedRequest.mockResolvedValue({
        first_name: 'John',
        last_name: 'Doe',
        email: 'john.doe@example.com'
      });

      render(<ZoomInstallationFlow {...defaultProps} />);

      expect(screen.getByText('Zoom Integration Active')).toBeInTheDocument();
    });
  });

  describe('welcome step', () => {
    it('should display all features', () => {
      render(<ZoomInstallationFlow {...defaultProps} />);

      expect(screen.getByText('Real-time Transcription')).toBeInTheDocument();
      expect(screen.getByText('Speaker Identification')).toBeInTheDocument();
      expect(screen.getByText('AI Summaries')).toBeInTheDocument();
      expect(screen.getByText('Chat Integration')).toBeInTheDocument();
    });

    it('should navigate to permissions step when connect button clicked', () => {
      render(<ZoomInstallationFlow {...defaultProps} />);

      fireEvent.click(screen.getByRole('button', { name: 'Connect to Zoom' }));

      expect(screen.getByText('Required Permissions')).toBeInTheDocument();
    });
  });

  describe('permissions step', () => {
    beforeEach(() => {
      render(<ZoomInstallationFlow {...defaultProps} />);
      fireEvent.click(screen.getByRole('button', { name: 'Connect to Zoom' }));
    });

    it('should display all required permissions', () => {
      expect(screen.getByText('Read Meeting Information')).toBeInTheDocument();
      expect(screen.getByText('Manage Meetings')).toBeInTheDocument();
      expect(screen.getByText('Read User Profile')).toBeInTheDocument();
      expect(screen.getByText('Send Chat Messages')).toBeInTheDocument();
      expect(screen.getByText('Access Recordings')).toBeInTheDocument();
    });

    it('should show required badges for mandatory permissions', () => {
      const requiredBadges = screen.getAllByText('Required');
      expect(requiredBadges).toHaveLength(3); // First 3 permissions are required
    });

    it('should navigate back to welcome step', () => {
      fireEvent.click(screen.getByRole('button', { name: 'Back' }));

      expect(screen.getByText('Connect to Zoom')).toBeInTheDocument();
    });

    it('should navigate to OAuth step when continue clicked', () => {
      mockZoomOAuthService.getAuthorizationUrl.mockReturnValue('https://zoom.us/oauth/authorize?test=1');

      fireEvent.click(screen.getByRole('button', { name: 'Continue to Authorization' }));

      expect(screen.getByText('Authorizing...')).toBeInTheDocument();
      expect(global.open).toHaveBeenCalled();
    });
  });

  describe('OAuth step', () => {
    beforeEach(() => {
      render(<ZoomInstallationFlow {...defaultProps} />);
      fireEvent.click(screen.getByRole('button', { name: 'Connect to Zoom' }));
      
      mockZoomOAuthService.getAuthorizationUrl.mockReturnValue('https://zoom.us/oauth/authorize?test=1');
      fireEvent.click(screen.getByRole('button', { name: 'Continue to Authorization' }));
    });

    it('should display authorization in progress', () => {
      expect(screen.getByText('Authorizing...')).toBeInTheDocument();
      expect(screen.getByText('Please complete the authorization in the popup window')).toBeInTheDocument();
      expect(screen.getByText('Connecting to Zoom...')).toBeInTheDocument();
    });

    it('should show popup instructions', () => {
      expect(screen.getByText('If the popup didn\'t open:')).toBeInTheDocument();
      expect(screen.getByText('Check if your browser blocked the popup')).toBeInTheDocument();
    });

    it('should open OAuth popup', () => {
      expect(global.open).toHaveBeenCalledWith(
        'https://zoom.us/oauth/authorize?test=1',
        'zoom_oauth',
        'width=500,height=600,scrollbars=yes,resizable=yes'
      );
    });

    it('should handle successful OAuth callback', async () => {
      mockZoomOAuthService.exchangeCodeForToken.mockResolvedValue({});
      mockZoomOAuthService.makeAuthenticatedRequest.mockResolvedValue({
        first_name: 'John',
        last_name: 'Doe',
        email: 'john.doe@example.com'
      });
      sessionStorageMock.getItem.mockReturnValue('test_state');

      // Simulate OAuth success message
      const event = new MessageEvent('message', {
        data: {
          type: 'zoom_oauth_success',
          code: 'auth_code',
          state: 'test_state'
        },
        origin: window.location.origin
      });

      window.dispatchEvent(event);

      await waitFor(() => {
        expect(screen.getByText('Successfully Connected!')).toBeInTheDocument();
      });

      expect(mockZoomOAuthService.exchangeCodeForToken).toHaveBeenCalledWith('auth_code');
    });

    it('should handle OAuth error callback', async () => {
      const event = new MessageEvent('message', {
        data: {
          type: 'zoom_oauth_error',
          error: 'access_denied'
        },
        origin: window.location.origin
      });

      window.dispatchEvent(event);

      await waitFor(() => {
        expect(screen.getByText('Connection Failed')).toBeInTheDocument();
      });

      expect(defaultProps.onInstallationError).toHaveBeenCalled();
    });

    it('should ignore messages from other origins', () => {
      const event = new MessageEvent('message', {
        data: {
          type: 'zoom_oauth_success',
          code: 'auth_code'
        },
        origin: 'https://malicious-site.com'
      });

      window.dispatchEvent(event);

      // Should still be on OAuth step
      expect(screen.getByText('Authorizing...')).toBeInTheDocument();
    });
  });

  describe('success step', () => {
    beforeEach(async () => {
      mockZoomOAuthService.makeAuthenticatedRequest.mockResolvedValue({
        first_name: 'John',
        last_name: 'Doe',
        email: 'john.doe@example.com'
      });

      render(<ZoomInstallationFlow {...defaultProps} />);
      fireEvent.click(screen.getByRole('button', { name: 'Connect to Zoom' }));
      fireEvent.click(screen.getByRole('button', { name: 'Continue to Authorization' }));

      sessionStorageMock.getItem.mockReturnValue('test_state');
      
      const event = new MessageEvent('message', {
        data: {
          type: 'zoom_oauth_success',
          code: 'auth_code',
          state: 'test_state'
        },
        origin: window.location.origin
      });

      window.dispatchEvent(event);

      await waitFor(() => {
        expect(screen.getByText('Successfully Connected!')).toBeInTheDocument();
      });
    });

    it('should display success message and user info', () => {
      expect(screen.getByText('Successfully Connected!')).toBeInTheDocument();
      expect(screen.getByText('John Doe')).toBeInTheDocument();
      expect(screen.getByText('john.doe@example.com')).toBeInTheDocument();
    });

    it('should show next steps', () => {
      expect(screen.getByText('Next Steps:')).toBeInTheDocument();
      expect(screen.getByText(/Join a Zoom meeting to start using transcription/)).toBeInTheDocument();
    });

    it('should automatically transition to complete step', async () => {
      await waitFor(() => {
        expect(screen.getByText('Zoom Integration Active')).toBeInTheDocument();
      }, { timeout: 3000 });

      expect(defaultProps.onInstallationComplete).toHaveBeenCalled();
    });
  });

  describe('error step', () => {
    beforeEach(async () => {
      render(<ZoomInstallationFlow {...defaultProps} />);
      fireEvent.click(screen.getByRole('button', { name: 'Connect to Zoom' }));
      fireEvent.click(screen.getByRole('button', { name: 'Continue to Authorization' }));

      const event = new MessageEvent('message', {
        data: {
          type: 'zoom_oauth_error',
          error: 'access_denied'
        },
        origin: window.location.origin
      });

      window.dispatchEvent(event);

      await waitFor(() => {
        expect(screen.getByText('Connection Failed')).toBeInTheDocument();
      });
    });

    it('should display error message', () => {
      expect(screen.getByText('Connection Failed')).toBeInTheDocument();
      expect(screen.getByText('There was an error connecting to your Zoom account')).toBeInTheDocument();
    });

    it('should show error details', () => {
      expect(screen.getByText('Error Details:')).toBeInTheDocument();
      expect(screen.getByText(/access_denied/)).toBeInTheDocument();
    });

    it('should allow retry', () => {
      fireEvent.click(screen.getByRole('button', { name: 'Try Again' }));

      expect(screen.getByText('Connect to Zoom')).toBeInTheDocument();
    });
  });

  describe('complete step', () => {
    beforeEach(() => {
      mockZoomOAuthService.isAuthenticated.mockReturnValue(true);
      mockZoomOAuthService.makeAuthenticatedRequest.mockResolvedValue({
        first_name: 'John',
        last_name: 'Doe',
        email: 'john.doe@example.com'
      });

      render(<ZoomInstallationFlow {...defaultProps} />);
    });

    it('should display active integration status', () => {
      expect(screen.getByText('Zoom Integration Active')).toBeInTheDocument();
      expect(screen.getByText('Your Zoom account is connected and ready for transcription')).toBeInTheDocument();
    });

    it('should show connected user info', () => {
      expect(screen.getByText('Connected Account:')).toBeInTheDocument();
      expect(screen.getByText('John Doe')).toBeInTheDocument();
      expect(screen.getByText('john.doe@example.com')).toBeInTheDocument();
    });

    it('should allow disconnection', async () => {
      mockZoomOAuthService.revokeToken.mockResolvedValue();

      fireEvent.click(screen.getByRole('button', { name: 'Disconnect Zoom' }));

      await waitFor(() => {
        expect(mockZoomOAuthService.revokeToken).toHaveBeenCalled();
      });
    });
  });

  describe('error handling', () => {
    it('should handle token exchange failure', async () => {
      render(<ZoomInstallationFlow {...defaultProps} />);
      fireEvent.click(screen.getByRole('button', { name: 'Connect to Zoom' }));
      fireEvent.click(screen.getByRole('button', { name: 'Continue to Authorization' }));

      mockZoomOAuthService.exchangeCodeForToken.mockRejectedValue(new Error('Token exchange failed'));
      sessionStorageMock.getItem.mockReturnValue('test_state');

      const event = new MessageEvent('message', {
        data: {
          type: 'zoom_oauth_success',
          code: 'auth_code',
          state: 'test_state'
        },
        origin: window.location.origin
      });

      window.dispatchEvent(event);

      await waitFor(() => {
        expect(screen.getByText('Connection Failed')).toBeInTheDocument();
      });

      expect(defaultProps.onInstallationError).toHaveBeenCalled();
    });

    it('should handle invalid state parameter', async () => {
      render(<ZoomInstallationFlow {...defaultProps} />);
      fireEvent.click(screen.getByRole('button', { name: 'Connect to Zoom' }));
      fireEvent.click(screen.getByRole('button', { name: 'Continue to Authorization' }));

      sessionStorageMock.getItem.mockReturnValue('different_state');

      const event = new MessageEvent('message', {
        data: {
          type: 'zoom_oauth_success',
          code: 'auth_code',
          state: 'test_state'
        },
        origin: window.location.origin
      });

      window.dispatchEvent(event);

      await waitFor(() => {
        expect(screen.getByText('Connection Failed')).toBeInTheDocument();
      });
    });

    it('should handle user info loading failure gracefully', async () => {
      mockZoomOAuthService.exchangeCodeForToken.mockResolvedValue({});
      mockZoomOAuthService.makeAuthenticatedRequest.mockRejectedValue(new Error('API Error'));

      render(<ZoomInstallationFlow {...defaultProps} />);
      fireEvent.click(screen.getByRole('button', { name: 'Connect to Zoom' }));
      fireEvent.click(screen.getByRole('button', { name: 'Continue to Authorization' }));

      sessionStorageMock.getItem.mockReturnValue('test_state');

      const event = new MessageEvent('message', {
        data: {
          type: 'zoom_oauth_success',
          code: 'auth_code',
          state: 'test_state'
        },
        origin: window.location.origin
      });

      window.dispatchEvent(event);

      await waitFor(() => {
        expect(screen.getByText('Successfully Connected!')).toBeInTheDocument();
      });

      // Should still show success even if user info fails to load
    });
  });
});