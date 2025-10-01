/**
 * Zoom Installation Flow Component
 * Handles Zoom app installation and permission management
 */

import React, { useState, useEffect } from 'react';
import './ZoomInstallationFlow.css';

const ZoomInstallationFlow = ({ 
  zoomOAuthService, 
  onInstallationComplete, 
  onInstallationError 
}) => {
  const [installationStep, setInstallationStep] = useState('welcome');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [permissions, setPermissions] = useState([]);
  const [userInfo, setUserInfo] = useState(null);

  const requiredPermissions = [
    {
      scope: 'meeting:read',
      title: 'Read Meeting Information',
      description: 'Access basic meeting details and participant information',
      required: true
    },
    {
      scope: 'meeting:write', 
      title: 'Manage Meetings',
      description: 'Send messages to meeting chat and manage meeting features',
      required: true
    },
    {
      scope: 'user:read',
      title: 'Read User Profile',
      description: 'Access your Zoom profile information for personalization',
      required: true
    },
    {
      scope: 'chat_message:write',
      title: 'Send Chat Messages',
      description: 'Send transcripts and summaries to meeting chat',
      required: false
    },
    {
      scope: 'recording:read',
      title: 'Access Recordings',
      description: 'Process cloud recordings for enhanced transcription accuracy',
      required: false
    }
  ];

  useEffect(() => {
    // Check if already authenticated
    if (zoomOAuthService.isAuthenticated()) {
      setInstallationStep('complete');
      loadUserInfo();
    }
  }, [zoomOAuthService]);

  const startInstallation = () => {
    setInstallationStep('permissions');
    setError(null);
  };

  const handlePermissionReview = () => {
    setInstallationStep('oauth');
    initiateOAuthFlow();
  };

  const initiateOAuthFlow = () => {
    try {
      setIsLoading(true);
      const state = generateRandomState();
      sessionStorage.setItem('zoom_oauth_state', state);
      
      const authUrl = zoomOAuthService.getAuthorizationUrl(state);
      
      // Open OAuth flow in popup window
      const popup = window.open(
        authUrl,
        'zoom_oauth',
        'width=500,height=600,scrollbars=yes,resizable=yes'
      );

      // Listen for OAuth completion
      const checkClosed = setInterval(() => {
        if (popup.closed) {
          clearInterval(checkClosed);
          setIsLoading(false);
          checkAuthenticationStatus();
        }
      }, 1000);

      // Handle OAuth callback via postMessage
      window.addEventListener('message', handleOAuthCallback, false);

    } catch (error) {
      setIsLoading(false);
      setError('Failed to start OAuth flow: ' + error.message);
      onInstallationError?.(error);
    }
  };

  const handleOAuthCallback = async (event) => {
    if (event.origin !== window.location.origin) {
      return;
    }

    if (event.data.type === 'zoom_oauth_success') {
      try {
        setIsLoading(true);
        
        // Verify state parameter
        const storedState = sessionStorage.getItem('zoom_oauth_state');
        if (event.data.state !== storedState) {
          throw new Error('Invalid OAuth state parameter');
        }

        // Exchange code for token
        await zoomOAuthService.exchangeCodeForToken(event.data.code);
        
        setInstallationStep('success');
        await loadUserInfo();
        
        setTimeout(() => {
          setInstallationStep('complete');
          onInstallationComplete?.();
        }, 2000);

      } catch (error) {
        setError('Authentication failed: ' + error.message);
        setInstallationStep('error');
        onInstallationError?.(error);
      } finally {
        setIsLoading(false);
        sessionStorage.removeItem('zoom_oauth_state');
      }
    } else if (event.data.type === 'zoom_oauth_error') {
      setError('OAuth authorization failed: ' + event.data.error);
      setInstallationStep('error');
      setIsLoading(false);
      onInstallationError?.(new Error(event.data.error));
    }
  };

  const checkAuthenticationStatus = async () => {
    try {
      if (zoomOAuthService.isAuthenticated()) {
        setInstallationStep('success');
        await loadUserInfo();
        
        setTimeout(() => {
          setInstallationStep('complete');
          onInstallationComplete?.();
        }, 2000);
      } else {
        setError('Authentication was not completed successfully');
        setInstallationStep('error');
      }
    } catch (error) {
      setError('Failed to verify authentication: ' + error.message);
      setInstallationStep('error');
    }
  };

  const loadUserInfo = async () => {
    try {
      const response = await zoomOAuthService.makeAuthenticatedRequest('/users/me');
      setUserInfo(response);
    } catch (error) {
      console.error('Failed to load user info:', error);
    }
  };

  const retryInstallation = () => {
    setError(null);
    setInstallationStep('welcome');
  };

  const uninstallApp = async () => {
    try {
      setIsLoading(true);
      await zoomOAuthService.revokeToken();
      setInstallationStep('welcome');
      setUserInfo(null);
    } catch (error) {
      setError('Failed to uninstall app: ' + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const generateRandomState = () => {
    return Math.random().toString(36).substring(2, 15) + 
           Math.random().toString(36).substring(2, 15);
  };

  const renderWelcomeStep = () => (
    <div className="zoom-install-step">
      <div className="zoom-install-header">
        <h2>Connect to Zoom</h2>
        <p>Enable real-time transcription for your Zoom meetings</p>
      </div>
      
      <div className="zoom-install-features">
        <div className="feature-item">
          <span className="feature-icon">🎤</span>
          <div>
            <h4>Real-time Transcription</h4>
            <p>Get live transcripts during your Zoom meetings</p>
          </div>
        </div>
        <div className="feature-item">
          <span className="feature-icon">👥</span>
          <div>
            <h4>Speaker Identification</h4>
            <p>Automatically identify who is speaking</p>
          </div>
        </div>
        <div className="feature-item">
          <span className="feature-icon">🤖</span>
          <div>
            <h4>AI Summaries</h4>
            <p>Generate intelligent meeting summaries</p>
          </div>
        </div>
        <div className="feature-item">
          <span className="feature-icon">💬</span>
          <div>
            <h4>Chat Integration</h4>
            <p>Send transcripts directly to Zoom chat</p>
          </div>
        </div>
      </div>

      <button 
        className="zoom-install-button primary"
        onClick={startInstallation}
        disabled={isLoading}
      >
        Connect to Zoom
      </button>
    </div>
  );

  const renderPermissionsStep = () => (
    <div className="zoom-install-step">
      <div className="zoom-install-header">
        <h2>Required Permissions</h2>
        <p>The app needs these permissions to provide transcription services</p>
      </div>

      <div className="permissions-list">
        {requiredPermissions.map((permission, index) => (
          <div key={index} className={`permission-item ${permission.required ? 'required' : 'optional'}`}>
            <div className="permission-header">
              <span className="permission-title">{permission.title}</span>
              {permission.required && <span className="required-badge">Required</span>}
            </div>
            <p className="permission-description">{permission.description}</p>
          </div>
        ))}
      </div>

      <div className="zoom-install-actions">
        <button 
          className="zoom-install-button secondary"
          onClick={() => setInstallationStep('welcome')}
        >
          Back
        </button>
        <button 
          className="zoom-install-button primary"
          onClick={handlePermissionReview}
          disabled={isLoading}
        >
          Continue to Authorization
        </button>
      </div>
    </div>
  );

  const renderOAuthStep = () => (
    <div className="zoom-install-step">
      <div className="zoom-install-header">
        <h2>Authorizing...</h2>
        <p>Please complete the authorization in the popup window</p>
      </div>

      <div className="oauth-loading">
        <div className="loading-spinner"></div>
        <p>Connecting to Zoom...</p>
      </div>

      <div className="oauth-instructions">
        <h4>If the popup didn't open:</h4>
        <ol>
          <li>Check if your browser blocked the popup</li>
          <li>Allow popups for this site</li>
          <li>Try the installation again</li>
        </ol>
      </div>

      <button 
        className="zoom-install-button secondary"
        onClick={() => setInstallationStep('permissions')}
        disabled={isLoading}
      >
        Back
      </button>
    </div>
  );

  const renderSuccessStep = () => (
    <div className="zoom-install-step">
      <div className="zoom-install-header success">
        <div className="success-icon">✅</div>
        <h2>Successfully Connected!</h2>
        <p>Your Zoom account is now connected to Meeting Transcription Pro</p>
      </div>

      {userInfo && (
        <div className="user-info">
          <h4>Connected Account:</h4>
          <p><strong>{userInfo.first_name} {userInfo.last_name}</strong></p>
          <p>{userInfo.email}</p>
        </div>
      )}

      <div className="next-steps">
        <h4>Next Steps:</h4>
        <ul>
          <li>Join a Zoom meeting to start using transcription</li>
          <li>Configure your STT and AI preferences in settings</li>
          <li>Set up custom summary prompts if desired</li>
        </ul>
      </div>
    </div>
  );

  const renderErrorStep = () => (
    <div className="zoom-install-step">
      <div className="zoom-install-header error">
        <div className="error-icon">❌</div>
        <h2>Connection Failed</h2>
        <p>There was an error connecting to your Zoom account</p>
      </div>

      {error && (
        <div className="error-details">
          <h4>Error Details:</h4>
          <p>{error}</p>
        </div>
      )}

      <div className="error-actions">
        <button 
          className="zoom-install-button secondary"
          onClick={retryInstallation}
        >
          Try Again
        </button>
      </div>
    </div>
  );

  const renderCompleteStep = () => (
    <div className="zoom-install-step">
      <div className="zoom-install-header">
        <h2>Zoom Integration Active</h2>
        <p>Your Zoom account is connected and ready for transcription</p>
      </div>

      {userInfo && (
        <div className="user-info">
          <h4>Connected Account:</h4>
          <p><strong>{userInfo.first_name} {userInfo.last_name}</strong></p>
          <p>{userInfo.email}</p>
        </div>
      )}

      <div className="management-actions">
        <button 
          className="zoom-install-button secondary"
          onClick={uninstallApp}
          disabled={isLoading}
        >
          Disconnect Zoom
        </button>
      </div>
    </div>
  );

  return (
    <div className="zoom-installation-flow">
      {installationStep === 'welcome' && renderWelcomeStep()}
      {installationStep === 'permissions' && renderPermissionsStep()}
      {installationStep === 'oauth' && renderOAuthStep()}
      {installationStep === 'success' && renderSuccessStep()}
      {installationStep === 'error' && renderErrorStep()}
      {installationStep === 'complete' && renderCompleteStep()}
    </div>
  );
};

export default ZoomInstallationFlow;