/**
 * Tests for ZoomOAuthService
 */

import ZoomOAuthService from '../ZoomOAuthService';

// Mock fetch
global.fetch = jest.fn();

// Mock localStorage
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};
global.localStorage = localStorageMock;

// Mock btoa
global.btoa = jest.fn((str) => Buffer.from(str).toString('base64'));

describe('ZoomOAuthService', () => {
  let service;
  
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Set up environment variables
    process.env.ZOOM_CLIENT_ID = 'test_client_id';
    process.env.ZOOM_CLIENT_SECRET = 'test_client_secret';
    process.env.ZOOM_REDIRECT_URI = 'http://localhost:3000/oauth/zoom/callback';
    
    service = new ZoomOAuthService();
  });

  afterEach(() => {
    delete process.env.ZOOM_CLIENT_ID;
    delete process.env.ZOOM_CLIENT_SECRET;
    delete process.env.ZOOM_REDIRECT_URI;
  });

  describe('constructor', () => {
    it('should initialize with environment variables', () => {
      expect(service.clientId).toBe('test_client_id');
      expect(service.clientSecret).toBe('test_client_secret');
      expect(service.redirectUri).toBe('http://localhost:3000/oauth/zoom/callback');
    });

    it('should use default redirect URI if not provided', () => {
      delete process.env.ZOOM_REDIRECT_URI;
      const newService = new ZoomOAuthService();
      expect(newService.redirectUri).toBe('http://localhost:3000/oauth/zoom/callback');
    });
  });

  describe('getAuthorizationUrl', () => {
    it('should generate correct authorization URL', () => {
      const state = 'test_state';
      const url = service.getAuthorizationUrl(state);
      
      expect(url).toContain('https://zoom.us/oauth/authorize');
      expect(url).toContain('client_id=test_client_id');
      expect(url).toContain('redirect_uri=http%3A%2F%2Flocalhost%3A3000%2Foauth%2Fzoom%2Fcallback');
      expect(url).toContain('state=test_state');
      expect(url).toContain('response_type=code');
      expect(url).toContain('scope=meeting%3Aread%20meeting%3Awrite');
    });
  });

  describe('exchangeCodeForToken', () => {
    it('should successfully exchange code for token', async () => {
      const mockTokenResponse = {
        access_token: 'test_access_token',
        refresh_token: 'test_refresh_token',
        expires_in: 3600
      };

      fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockTokenResponse)
      });

      const result = await service.exchangeCodeForToken('test_code');

      expect(fetch).toHaveBeenCalledWith(
        'https://zoom.us/oauth/token',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/x-www-form-urlencoded',
            'Authorization': expect.stringContaining('Basic')
          })
        })
      );

      expect(result).toEqual(mockTokenResponse);
      expect(service.accessToken).toBe('test_access_token');
      expect(service.refreshToken).toBe('test_refresh_token');
      expect(localStorageMock.setItem).toHaveBeenCalled();
    });

    it('should handle token exchange failure', async () => {
      fetch.mockResolvedValueOnce({
        ok: false,
        status: 400
      });

      await expect(service.exchangeCodeForToken('invalid_code'))
        .rejects.toThrow('OAuth token exchange failed: 400');
    });
  });

  describe('refreshAccessToken', () => {
    beforeEach(() => {
      service.refreshToken = 'test_refresh_token';
    });

    it('should successfully refresh access token', async () => {
      const mockTokenResponse = {
        access_token: 'new_access_token',
        expires_in: 3600
      };

      fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockTokenResponse)
      });

      const result = await service.refreshAccessToken();

      expect(fetch).toHaveBeenCalledWith(
        'https://zoom.us/oauth/token',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/x-www-form-urlencoded'
          })
        })
      );

      expect(result).toEqual(mockTokenResponse);
      expect(service.accessToken).toBe('new_access_token');
    });

    it('should throw error if no refresh token available', async () => {
      service.refreshToken = null;

      await expect(service.refreshAccessToken())
        .rejects.toThrow('No refresh token available');
    });

    it('should handle refresh failure', async () => {
      fetch.mockResolvedValueOnce({
        ok: false,
        status: 401
      });

      await expect(service.refreshAccessToken())
        .rejects.toThrow('Token refresh failed: 401');
    });
  });

  describe('getValidAccessToken', () => {
    it('should return current token if valid', async () => {
      service.accessToken = 'valid_token';
      service.tokenExpiry = new Date(Date.now() + 3600000); // 1 hour from now

      const token = await service.getValidAccessToken();
      expect(token).toBe('valid_token');
    });

    it('should refresh token if expired', async () => {
      service.accessToken = 'expired_token';
      service.refreshToken = 'refresh_token';
      service.tokenExpiry = new Date(Date.now() - 1000); // 1 second ago

      const mockTokenResponse = {
        access_token: 'new_token',
        expires_in: 3600
      };

      fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockTokenResponse)
      });

      const token = await service.getValidAccessToken();
      expect(token).toBe('new_token');
    });

    it('should load tokens from storage if not in memory', async () => {
      service.accessToken = null;
      
      const storedTokens = {
        access_token: 'stored_token',
        refresh_token: 'stored_refresh',
        expires_at: new Date(Date.now() + 3600000).toISOString()
      };

      localStorageMock.getItem.mockReturnValue(JSON.stringify(storedTokens));

      const token = await service.getValidAccessToken();
      expect(token).toBe('stored_token');
      expect(service.accessToken).toBe('stored_token');
    });
  });

  describe('makeAuthenticatedRequest', () => {
    beforeEach(() => {
      service.accessToken = 'valid_token';
      service.tokenExpiry = new Date(Date.now() + 3600000);
    });

    it('should make successful authenticated request', async () => {
      const mockResponse = { data: 'test_data' };

      fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      });

      const result = await service.makeAuthenticatedRequest('/test/endpoint');

      expect(fetch).toHaveBeenCalledWith(
        'https://api.zoom.us/v2/test/endpoint',
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': 'Bearer valid_token',
            'Content-Type': 'application/json'
          })
        })
      );

      expect(result).toEqual(mockResponse);
    });

    it('should retry with refreshed token on 401 error', async () => {
      service.refreshToken = 'refresh_token';

      // First request fails with 401
      fetch.mockResolvedValueOnce({
        ok: false,
        status: 401
      });

      // Token refresh succeeds
      fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          access_token: 'new_token',
          expires_in: 3600
        })
      });

      // Retry request succeeds
      const mockResponse = { data: 'success' };
      fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      });

      const result = await service.makeAuthenticatedRequest('/test/endpoint');

      expect(fetch).toHaveBeenCalledTimes(3); // Original + refresh + retry
      expect(result).toEqual(mockResponse);
    });

    it('should handle non-401 errors', async () => {
      fetch.mockResolvedValueOnce({
        ok: false,
        status: 404
      });

      await expect(service.makeAuthenticatedRequest('/test/endpoint'))
        .rejects.toThrow('Zoom API request failed: 404');
    });
  });

  describe('revokeToken', () => {
    beforeEach(() => {
      service.accessToken = 'token_to_revoke';
    });

    it('should successfully revoke token', async () => {
      fetch.mockResolvedValueOnce({
        ok: true
      });

      await service.revokeToken();

      expect(fetch).toHaveBeenCalledWith(
        'https://zoom.us/oauth/revoke',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/x-www-form-urlencoded'
          })
        })
      );

      expect(service.accessToken).toBeNull();
      expect(service.refreshToken).toBeNull();
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('zoom_oauth_tokens');
    });

    it('should handle revoke errors gracefully', async () => {
      fetch.mockRejectedValueOnce(new Error('Network error'));

      // Should not throw but should still clear tokens
      await service.revokeToken();

      expect(service.accessToken).toBeNull();
    });

    it('should do nothing if no token exists', async () => {
      service.accessToken = null;

      await service.revokeToken();

      expect(fetch).not.toHaveBeenCalled();
    });
  });

  describe('isAuthenticated', () => {
    it('should return true when token is valid', () => {
      service.accessToken = 'valid_token';
      service.tokenExpiry = new Date(Date.now() + 3600000);

      expect(service.isAuthenticated()).toBe(true);
    });

    it('should return false when token is expired', () => {
      service.accessToken = 'expired_token';
      service.tokenExpiry = new Date(Date.now() - 1000);

      expect(service.isAuthenticated()).toBe(false);
    });

    it('should return false when no token exists', () => {
      service.accessToken = null;
      service.tokenExpiry = null;

      expect(service.isAuthenticated()).toBe(false);
    });
  });

  describe('token storage', () => {
    it('should store tokens in localStorage', async () => {
      const mockTokenResponse = {
        access_token: 'test_token',
        refresh_token: 'test_refresh',
        expires_in: 3600
      };

      fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockTokenResponse)
      });

      await service.exchangeCodeForToken('test_code');

      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'zoom_oauth_tokens',
        expect.stringContaining('test_token')
      );
    });

    it('should load tokens from localStorage', async () => {
      const storedTokens = {
        access_token: 'stored_token',
        refresh_token: 'stored_refresh',
        expires_at: new Date(Date.now() + 3600000).toISOString()
      };

      localStorageMock.getItem.mockReturnValue(JSON.stringify(storedTokens));

      await service._loadTokens();

      expect(service.accessToken).toBe('stored_token');
      expect(service.refreshToken).toBe('stored_refresh');
    });

    it('should handle corrupted localStorage data', async () => {
      localStorageMock.getItem.mockReturnValue('invalid_json');

      // Should not throw
      await service._loadTokens();

      expect(service.accessToken).toBeNull();
    });
  });
});