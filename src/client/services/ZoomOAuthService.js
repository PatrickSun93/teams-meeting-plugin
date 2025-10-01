/**
 * Zoom OAuth Service
 * Handles OAuth authentication flow for Zoom App Marketplace integration
 */

class ZoomOAuthService {
  constructor() {
    this.clientId = process.env.ZOOM_CLIENT_ID;
    this.clientSecret = process.env.ZOOM_CLIENT_SECRET;
    this.redirectUri = process.env.ZOOM_REDIRECT_URI || 'http://localhost:3000/oauth/zoom/callback';
    this.baseUrl = 'https://zoom.us/oauth';
    this.apiBaseUrl = 'https://api.zoom.us/v2';
    
    this.accessToken = null;
    this.refreshToken = null;
    this.tokenExpiry = null;
  }

  /**
   * Generate OAuth authorization URL
   * @param {string} state - CSRF protection state parameter
   * @returns {string} Authorization URL
   */
  getAuthorizationUrl(state) {
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      state: state,
      scope: 'meeting:read meeting:write user:read chat_message:write recording:read webinar:read'
    });

    return `${this.baseUrl}/authorize?${params.toString()}`;
  }

  /**
   * Exchange authorization code for access token
   * @param {string} code - Authorization code from callback
   * @returns {Promise<Object>} Token response
   */
  async exchangeCodeForToken(code) {
    try {
      const response = await fetch(`${this.baseUrl}/token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': `Basic ${btoa(`${this.clientId}:${this.clientSecret}`)}`
        },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          code: code,
          redirect_uri: this.redirectUri
        })
      });

      if (!response.ok) {
        throw new Error(`OAuth token exchange failed: ${response.status}`);
      }

      const tokenData = await response.json();
      
      this.accessToken = tokenData.access_token;
      this.refreshToken = tokenData.refresh_token;
      this.tokenExpiry = new Date(Date.now() + (tokenData.expires_in * 1000));

      // Store tokens securely
      await this._storeTokens(tokenData);

      return tokenData;
    } catch (error) {
      console.error('Error exchanging code for token:', error);
      throw error;
    }
  }

  /**
   * Refresh access token using refresh token
   * @returns {Promise<Object>} New token data
   */
  async refreshAccessToken() {
    if (!this.refreshToken) {
      throw new Error('No refresh token available');
    }

    try {
      const response = await fetch(`${this.baseUrl}/token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': `Basic ${btoa(`${this.clientId}:${this.clientSecret}`)}`
        },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: this.refreshToken
        })
      });

      if (!response.ok) {
        throw new Error(`Token refresh failed: ${response.status}`);
      }

      const tokenData = await response.json();
      
      this.accessToken = tokenData.access_token;
      this.tokenExpiry = new Date(Date.now() + (tokenData.expires_in * 1000));

      // Update stored tokens
      await this._storeTokens(tokenData);

      return tokenData;
    } catch (error) {
      console.error('Error refreshing token:', error);
      throw error;
    }
  }

  /**
   * Get valid access token, refreshing if necessary
   * @returns {Promise<string>} Valid access token
   */
  async getValidAccessToken() {
    // Load tokens from storage if not in memory
    if (!this.accessToken) {
      await this._loadTokens();
    }

    // Check if token needs refresh
    if (this.tokenExpiry && new Date() >= this.tokenExpiry) {
      await this.refreshAccessToken();
    }

    return this.accessToken;
  }

  /**
   * Make authenticated API request to Zoom
   * @param {string} endpoint - API endpoint
   * @param {Object} options - Fetch options
   * @returns {Promise<Object>} API response
   */
  async makeAuthenticatedRequest(endpoint, options = {}) {
    const token = await this.getValidAccessToken();
    
    const response = await fetch(`${this.apiBaseUrl}${endpoint}`, {
      ...options,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...options.headers
      }
    });

    if (!response.ok) {
      if (response.status === 401) {
        // Token might be invalid, try refreshing
        await this.refreshAccessToken();
        const newToken = await this.getValidAccessToken();
        
        const retryResponse = await fetch(`${this.apiBaseUrl}${endpoint}`, {
          ...options,
          headers: {
            'Authorization': `Bearer ${newToken}`,
            'Content-Type': 'application/json',
            ...options.headers
          }
        });

        if (!retryResponse.ok) {
          throw new Error(`Zoom API request failed: ${retryResponse.status}`);
        }

        return await retryResponse.json();
      }

      throw new Error(`Zoom API request failed: ${response.status}`);
    }

    return await response.json();
  }

  /**
   * Revoke access token
   * @returns {Promise<void>}
   */
  async revokeToken() {
    if (!this.accessToken) {
      return;
    }

    try {
      await fetch(`${this.baseUrl}/revoke`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': `Basic ${btoa(`${this.clientId}:${this.clientSecret}`)}`
        },
        body: new URLSearchParams({
          token: this.accessToken
        })
      });

      // Clear stored tokens
      this.accessToken = null;
      this.refreshToken = null;
      this.tokenExpiry = null;
      await this._clearStoredTokens();

    } catch (error) {
      console.error('Error revoking token:', error);
    }
  }

  /**
   * Check if user is authenticated
   * @returns {boolean} Authentication status
   */
  isAuthenticated() {
    return !!(this.accessToken && this.tokenExpiry && new Date() < this.tokenExpiry);
  }

  /**
   * Store tokens securely
   * @private
   */
  async _storeTokens(tokenData) {
    try {
      const encryptedData = {
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token,
        expires_at: this.tokenExpiry.toISOString()
      };

      localStorage.setItem('zoom_oauth_tokens', JSON.stringify(encryptedData));
    } catch (error) {
      console.error('Error storing tokens:', error);
    }
  }

  /**
   * Load tokens from storage
   * @private
   */
  async _loadTokens() {
    try {
      const storedData = localStorage.getItem('zoom_oauth_tokens');
      if (storedData) {
        const tokenData = JSON.parse(storedData);
        this.accessToken = tokenData.access_token;
        this.refreshToken = tokenData.refresh_token;
        this.tokenExpiry = new Date(tokenData.expires_at);
      }
    } catch (error) {
      console.error('Error loading tokens:', error);
    }
  }

  /**
   * Clear stored tokens
   * @private
   */
  async _clearStoredTokens() {
    try {
      localStorage.removeItem('zoom_oauth_tokens');
    } catch (error) {
      console.error('Error clearing tokens:', error);
    }
  }
}

export default ZoomOAuthService;