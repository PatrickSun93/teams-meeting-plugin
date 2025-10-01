/**
 * Zoom Platform Adapter
 * Integrates with Zoom Web SDK for browser-based meetings
 */

import { 
  PlatformAdapter, 
  MeetingPlatform, 
  MeetingInfo, 
  ParticipantInfo, 
  PlatformEvents,
  AudioQuality 
} from './PlatformAdapter.js';
import ZoomOAuthService from './ZoomOAuthService.js';
import ZoomRecordingService from './ZoomRecordingService.js';
import ZoomErrorHandler from './ZoomErrorHandler.js';

/**
 * Zoom-specific error types
 */
export const ZoomErrorTypes = {
  SDK_NOT_LOADED: 'SDK_NOT_LOADED',
  NOT_IN_MEETING: 'NOT_IN_MEETING',
  PERMISSION_DENIED: 'PERMISSION_DENIED',
  API_ERROR: 'API_ERROR',
  CHAT_DISABLED: 'CHAT_DISABLED',
  AUDIO_ACCESS_DENIED: 'AUDIO_ACCESS_DENIED'
};

/**
 * Zoom meeting states
 */
export const ZoomMeetingState = {
  NOT_STARTED: 'not_started',
  CONNECTING: 'connecting',
  CONNECTED: 'connected',
  DISCONNECTED: 'disconnected',
  FAILED: 'failed'
};

/**
 * ZoomAdapter class for Zoom Web SDK integration
 */
export class ZoomAdapter extends PlatformAdapter {
  constructor() {
    super();
    this.platform = MeetingPlatform.ZOOM;
    this.zoomClient = null;
    this.meetingState = ZoomMeetingState.NOT_STARTED;
    this.currentMeeting = null;
    this.audioStream = null;
    this.participants = new Map();
    this.isHostUser = false;
    this.chatEnabled = false;
    
    // Zoom App Marketplace integration
    this.oauthService = new ZoomOAuthService();
    this.recordingService = new ZoomRecordingService(this.oauthService);
    this.errorHandler = new ZoomErrorHandler();
    this.isAppMarketplaceMode = false;
    
    this._setupErrorHandling();
    
    // Zoom SDK configuration
    this.sdkConfig = {
      debug: false,
      leaveUrl: window.location.origin,
      showMeetingTime: true,
      disableInvite: false,
      disableCallOut: false,
      disableRecord: false,
      disableJoinAudio: false,
      audioPanelAlwaysOpen: true,
      showPureSharingContent: false,
      enableLoggerSync: false,
      enableLogDirSuffixTimestamp: true,
      logLevel: 'info'
    };
  }

  /**
   * Setup error handling for Zoom App Marketplace integration
   * @private
   */
  _setupErrorHandling() {
    // Handle token refresh needed
    this.errorHandler.onError('token_refresh_needed', async (errorInfo) => {
      try {
        await this.oauthService.refreshAccessToken();
        console.log('Zoom OAuth token refreshed successfully');
      } catch (error) {
        console.error('Failed to refresh Zoom OAuth token:', error);
        this._emitEvent(PlatformEvents.ERROR, {
          type: 'auth_error',
          message: 'Authentication expired. Please reconnect to Zoom.',
          error: error
        });
      }
    });

    // Handle rate limit notifications
    this.errorHandler.onError('rate_limit', (errorInfo) => {
      this._emitEvent(PlatformEvents.ERROR, {
        type: 'rate_limit',
        message: 'Zoom API rate limit reached. Some features may be temporarily unavailable.',
        retryAfter: errorInfo.retryAfter
      });
    });
  }

  /**
   * Enable Zoom App Marketplace mode
   * @returns {Promise<boolean>} Success status
   */
  async enableAppMarketplaceMode() {
    try {
      if (this.oauthService.isAuthenticated()) {
        this.isAppMarketplaceMode = true;
        console.log('Zoom App Marketplace mode enabled');
        return true;
      } else {
        console.warn('Zoom OAuth not authenticated. App Marketplace features unavailable.');
        return false;
      }
    } catch (error) {
      console.error('Failed to enable App Marketplace mode:', error);
      return false;
    }
  }

  /**
   * Get OAuth service for authentication
   * @returns {ZoomOAuthService} OAuth service instance
   */
  getOAuthService() {
    return this.oauthService;
  }

  /**
   * Get recording service for cloud recordings
   * @returns {ZoomRecordingService} Recording service instance
   */
  getRecordingService() {
    return this.recordingService;
  }

  /**
   * Initialize Zoom Web SDK
   * @returns {Promise<boolean>} Success status
   */
  async initialize() {
    try {
      // Check if Zoom Web SDK is available
      if (typeof window.ZoomMtg === 'undefined') {
        throw new Error('Zoom Web SDK not loaded. Please include the Zoom Web SDK script.');
      }

      // Initialize Zoom SDK
      await new Promise((resolve, reject) => {
        window.ZoomMtg.setZoomJSLib('https://source.zoom.us/2.18.0/lib', '/av');
        
        window.ZoomMtg.preLoadWasm();
        window.ZoomMtg.prepareWebSDK();
        
        window.ZoomMtg.init({
          ...this.sdkConfig,
          success: () => {
            console.log('Zoom SDK initialized successfully');
            resolve();
          },
          error: (error) => {
            console.error('Zoom SDK initialization failed:', error);
            reject(new Error(`Zoom SDK initialization failed: ${error.reason || error}`));
          }
        });
      });

      // Set up event listeners
      this._setupEventListeners();
      
      this.initialized = true;
      return true;
    } catch (error) {
      console.error('ZoomAdapter initialization failed:', error);
      throw error;
    }
  }

  /**
   * Set up Zoom SDK event listeners
   * @private
   */
  _setupEventListeners() {
    if (!window.ZoomMtg) return;

    // Meeting connection events
    window.ZoomMtg.inMeetingServiceListener('onMeetingStatus', (data) => {
      this._handleMeetingStatusChange(data);
    });

    // Participant events
    window.ZoomMtg.inMeetingServiceListener('onUserJoin', (data) => {
      this._handleParticipantJoined(data);
    });

    window.ZoomMtg.inMeetingServiceListener('onUserLeave', (data) => {
      this._handleParticipantLeft(data);
    });

    // Audio events
    window.ZoomMtg.inMeetingServiceListener('onAudioChange', (data) => {
      this._handleAudioStateChange(data);
    });

    // Host change events
    window.ZoomMtg.inMeetingServiceListener('onHostChange', (data) => {
      this._handleHostChange(data);
    });

    // Chat events
    window.ZoomMtg.inMeetingServiceListener('onChatPrivilegeChange', (data) => {
      this.chatEnabled = data.chatPrivilege !== 'Disabled';
    });
  }

  /**
   * Handle meeting status changes
   * @private
   */
  _handleMeetingStatusChange(data) {
    const previousState = this.meetingState;
    
    switch (data.meetingStatus) {
      case 1: // Connecting
        this.meetingState = ZoomMeetingState.CONNECTING;
        break;
      case 2: // Connected
        this.meetingState = ZoomMeetingState.CONNECTED;
        this.meetingActive = true;
        if (previousState !== ZoomMeetingState.CONNECTED) {
          this._emitEvent(PlatformEvents.MEETING_STARTED, { platform: this.platform });
        }
        break;
      case 3: // Disconnected
        this.meetingState = ZoomMeetingState.DISCONNECTED;
        this.meetingActive = false;
        this._emitEvent(PlatformEvents.MEETING_ENDED, { platform: this.platform });
        break;
      case 4: // Failed
        this.meetingState = ZoomMeetingState.FAILED;
        this.meetingActive = false;
        break;
    }
  }

  /**
   * Handle participant joined event
   * @private
   */
  _handleParticipantJoined(data) {
    const participant = new ParticipantInfo({
      id: data.userId?.toString(),
      name: data.displayName || `User ${data.userId}`,
      email: data.email || '',
      isHost: data.isHost || false,
      isMuted: data.muted || false,
      isVideoOn: data.video || false,
      joinTime: new Date()
    });

    this.participants.set(participant.id, participant);
    this._emitEvent(PlatformEvents.PARTICIPANT_JOINED, participant);
  }

  /**
   * Handle participant left event
   * @private
   */
  _handleParticipantLeft(data) {
    const participantId = data.userId?.toString();
    const participant = this.participants.get(participantId);
    
    if (participant) {
      this.participants.delete(participantId);
      this._emitEvent(PlatformEvents.PARTICIPANT_LEFT, participant);
    }
  }

  /**
   * Handle audio state change
   * @private
   */
  _handleAudioStateChange(data) {
    this._emitEvent(PlatformEvents.AUDIO_STATE_CHANGED, {
      userId: data.userId?.toString(),
      muted: data.muted,
      audioType: data.audioType
    });
  }

  /**
   * Handle host change event
   * @private
   */
  _handleHostChange(data) {
    this.isHostUser = data.isHost || false;
    this._emitEvent(PlatformEvents.HOST_CHANGED, {
      newHostId: data.userId?.toString(),
      isCurrentUserHost: this.isHostUser
    });
  }

  /**
   * Get current meeting information
   * @returns {Promise<MeetingInfo>} Meeting details
   */
  async getMeetingInfo() {
    if (!this.initialized) {
      throw new Error('ZoomAdapter not initialized');
    }

    try {
      // Get meeting info from Zoom SDK
      const meetingInfo = await this._getZoomMeetingInfo();
      
      this.currentMeeting = new MeetingInfo({
        id: meetingInfo.meetingId || meetingInfo.meetingNumber?.toString(),
        title: meetingInfo.meetingTopic || 'Zoom Meeting',
        platform: this.platform,
        startTime: meetingInfo.startTime ? new Date(meetingInfo.startTime) : new Date(),
        participants: Array.from(this.participants.values()),
        agenda: null, // Zoom doesn't provide agenda through Web SDK
        isHost: this.isHostUser,
        meetingUrl: meetingInfo.meetingUrl || window.location.href
      });

      return this.currentMeeting;
    } catch (error) {
      console.error('Failed to get Zoom meeting info:', error);
      throw new Error(`Failed to get meeting info: ${error.message}`);
    }
  }

  /**
   * Get meeting info from Zoom SDK
   * @private
   * @returns {Promise<object>} Raw meeting info
   */
  async _getZoomMeetingInfo() {
    return new Promise((resolve, reject) => {
      if (!window.ZoomMtg || this.meetingState !== ZoomMeetingState.CONNECTED) {
        reject(new Error('Not connected to Zoom meeting'));
        return;
      }

      try {
        // Get current meeting info
        const meetingInfo = window.ZoomMtg.getCurrentMeetingInfo();
        resolve(meetingInfo || {});
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Get audio stream from Zoom meeting
   * @returns {Promise<MediaStream>} Audio stream
   */
  async getAudioStream() {
    if (!this.initialized) {
      throw new Error('ZoomAdapter not initialized');
    }

    if (this.meetingState !== ZoomMeetingState.CONNECTED) {
      throw new Error('Not connected to Zoom meeting');
    }

    try {
      // For Zoom Web SDK, we need to use getUserMedia to capture system audio
      // The Zoom SDK doesn't provide direct access to meeting audio streams
      if (!this.audioStream) {
        this.audioStream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
            sampleRate: 44100,
            channelCount: 1
          }
        });
      }

      return this.audioStream;
    } catch (error) {
      console.error('Failed to get audio stream:', error);
      throw new Error(`Audio access denied: ${error.message}`);
    }
  }

  /**
   * Get list of meeting participants
   * @returns {Promise<ParticipantInfo[]>} Participant array
   */
  async getParticipants() {
    if (!this.initialized) {
      throw new Error('ZoomAdapter not initialized');
    }

    if (this.meetingState !== ZoomMeetingState.CONNECTED) {
      return [];
    }

    try {
      // Update participants from Zoom SDK
      await this._updateParticipantsList();
      return Array.from(this.participants.values());
    } catch (error) {
      console.error('Failed to get participants:', error);
      return Array.from(this.participants.values());
    }
  }

  /**
   * Update participants list from Zoom SDK
   * @private
   */
  async _updateParticipantsList() {
    return new Promise((resolve) => {
      if (!window.ZoomMtg) {
        resolve();
        return;
      }

      try {
        // Get participant list from Zoom SDK
        const participantList = window.ZoomMtg.getAttendeeslist();
        
        if (participantList && Array.isArray(participantList)) {
          // Clear existing participants
          this.participants.clear();
          
          // Add current participants
          participantList.forEach(participant => {
            const participantInfo = new ParticipantInfo({
              id: participant.userId?.toString(),
              name: participant.displayName || participant.screenName || `User ${participant.userId}`,
              email: participant.email || '',
              isHost: participant.isHost || false,
              isMuted: participant.muted || false,
              isVideoOn: participant.video || false,
              joinTime: participant.joinTime ? new Date(participant.joinTime) : new Date()
            });
            
            this.participants.set(participantInfo.id, participantInfo);
          });
        }
      } catch (error) {
        console.error('Error updating participants list:', error);
      }
      
      resolve();
    });
  }

  /**
   * Send message to Zoom meeting chat
   * @param {string} message - Message to send
   * @returns {Promise<boolean>} Success status
   */
  async sendMessageToChat(message) {
    if (!this.initialized) {
      throw new Error('ZoomAdapter not initialized');
    }

    if (this.meetingState !== ZoomMeetingState.CONNECTED) {
      throw new Error('Not connected to Zoom meeting');
    }

    // Try App Marketplace API first if available
    if (this.isAppMarketplaceMode && this.currentMeeting?.id) {
      try {
        const result = await this.errorHandler.handleError(
          null,
          'send_chat_message',
          async () => {
            return await this.oauthService.makeAuthenticatedRequest(
              `/meetings/${this.currentMeeting.id}/events`,
              {
                method: 'PATCH',
                body: JSON.stringify({
                  method: 'chat.send',
                  params: {
                    message: message,
                    to_all: true
                  }
                })
              }
            );
          }
        );

        if (result) {
          console.log('Message sent to Zoom chat via API successfully');
          return true;
        }
      } catch (error) {
        console.warn('Failed to send message via API, falling back to Web SDK:', error.message);
      }
    }

    // Fallback to Web SDK method
    if (!this.chatEnabled) {
      throw new Error('Chat is disabled in this meeting');
    }

    try {
      return new Promise((resolve, reject) => {
        window.ZoomMtg.sendChat({
          text: message,
          type: 'everyone', // Send to everyone
          success: () => {
            console.log('Message sent to Zoom chat successfully');
            resolve(true);
          },
          error: (error) => {
            console.error('Failed to send message to Zoom chat:', error);
            reject(new Error(`Failed to send chat message: ${error.reason || error}`));
          }
        });
      });
    } catch (error) {
      console.error('Error sending message to chat:', error);
      return false;
    }
  }

  /**
   * Get meeting agenda information
   * @returns {Promise<object|null>} Agenda object or null
   */
  async getMeetingAgenda() {
    // Try to get agenda via App Marketplace integration first
    if (this.isAppMarketplaceMode && this.currentMeeting?.id) {
      try {
        const meetingDetails = await this.errorHandler.handleError(
          null,
          'get_meeting_details',
          async () => {
            return await this.oauthService.makeAuthenticatedRequest(
              `/meetings/${this.currentMeeting.id}`
            );
          }
        );

        if (meetingDetails && meetingDetails.agenda) {
          return {
            title: meetingDetails.topic || 'Zoom Meeting',
            description: meetingDetails.agenda,
            items: this._parseAgendaItems(meetingDetails.agenda),
            duration: meetingDetails.duration || 60
          };
        }
      } catch (error) {
        console.warn('Failed to get meeting agenda via API:', error.message);
      }
    }

    // Fallback: Zoom Web SDK doesn't provide agenda information
    console.warn('Zoom Web SDK does not provide agenda access. Enable App Marketplace mode for agenda support.');
    return null;
  }

  /**
   * Parse agenda text into structured items
   * @private
   */
  _parseAgendaItems(agendaText) {
    if (!agendaText) return [];

    // Simple parsing - split by lines and look for numbered items or bullet points
    const lines = agendaText.split('\n').filter(line => line.trim());
    const items = [];

    lines.forEach(line => {
      const trimmed = line.trim();
      if (trimmed.match(/^\d+\./) || trimmed.match(/^[-*•]/)) {
        items.push({
          title: trimmed.replace(/^\d+\.\s*/, '').replace(/^[-*•]\s*/, ''),
          description: '',
          estimatedDuration: null
        });
      }
    });

    return items.length > 0 ? items : [{ title: agendaText, description: '', estimatedDuration: null }];
  }

  /**
   * Check if current user is meeting host
   * @returns {Promise<boolean>} Host status
   */
  async isHost() {
    if (!this.initialized) {
      return false;
    }

    if (this.meetingState !== ZoomMeetingState.CONNECTED) {
      return false;
    }

    try {
      // Get current user info from Zoom SDK
      const userInfo = window.ZoomMtg.getCurrentUser();
      this.isHostUser = userInfo?.isHost || false;
      return this.isHostUser;
    } catch (error) {
      console.error('Failed to check host status:', error);
      return this.isHostUser;
    }
  }

  /**
   * Get Zoom platform capabilities
   * @returns {object} Capabilities object
   */
  getCapabilities() {
    return {
      chatIntegration: true,
      agendaAccess: this.isAppMarketplaceMode, // Available via App Marketplace API
      participantInfo: true,
      hostDetection: true,
      audioQuality: AudioQuality.HIGH,
      meetingEvents: true,
      recordingAccess: this.isAppMarketplaceMode, // Available via App Marketplace API
      realTimeTranscription: true,
      speakerIdentification: true,
      fileExport: true,
      cloudRecordings: this.isAppMarketplaceMode,
      enhancedChat: this.isAppMarketplaceMode,
      webhookSupport: this.isAppMarketplaceMode
    };
  }

  /**
   * Join a Zoom meeting
   * @param {object} meetingConfig - Meeting configuration
   * @returns {Promise<boolean>} Success status
   */
  async joinMeeting(meetingConfig) {
    if (!this.initialized) {
      throw new Error('ZoomAdapter not initialized');
    }

    const {
      meetingNumber,
      password = '',
      userName = 'Transcription User',
      userEmail = '',
      signature,
      apiKey,
      role = 0 // 0 for participant, 1 for host
    } = meetingConfig;

    if (!meetingNumber || !signature || !apiKey) {
      throw new Error('Missing required meeting configuration: meetingNumber, signature, and apiKey are required');
    }

    try {
      return new Promise((resolve, reject) => {
        window.ZoomMtg.join({
          meetingNumber: meetingNumber,
          password: password,
          userName: userName,
          userEmail: userEmail,
          signature: signature,
          apiKey: apiKey,
          role: role,
          success: (result) => {
            console.log('Successfully joined Zoom meeting:', result);
            this.meetingState = ZoomMeetingState.CONNECTED;
            this.meetingActive = true;
            resolve(true);
          },
          error: (error) => {
            console.error('Failed to join Zoom meeting:', error);
            reject(new Error(`Failed to join meeting: ${error.reason || error}`));
          }
        });
      });
    } catch (error) {
      console.error('Error joining Zoom meeting:', error);
      throw error;
    }
  }

  /**
   * Leave the current Zoom meeting
   * @returns {Promise<boolean>} Success status
   */
  async leaveMeeting() {
    if (!this.initialized || this.meetingState !== ZoomMeetingState.CONNECTED) {
      return true;
    }

    try {
      return new Promise((resolve) => {
        window.ZoomMtg.leave({
          success: () => {
            console.log('Successfully left Zoom meeting');
            this.meetingState = ZoomMeetingState.DISCONNECTED;
            this.meetingActive = false;
            resolve(true);
          },
          error: (error) => {
            console.error('Error leaving Zoom meeting:', error);
            // Still consider it successful since we're leaving
            this.meetingState = ZoomMeetingState.DISCONNECTED;
            this.meetingActive = false;
            resolve(true);
          }
        });
      });
    } catch (error) {
      console.error('Error leaving meeting:', error);
      return true;
    }
  }

  /**
   * Get current meeting state
   * @returns {string} Meeting state
   */
  getMeetingState() {
    return this.meetingState;
  }

  /**
   * Check if chat is enabled in the meeting
   * @returns {boolean} Chat enabled status
   */
  isChatEnabled() {
    return this.chatEnabled;
  }

  /**
   * Cleanup resources and leave meeting
   */
  async cleanup() {
    try {
      // Stop audio stream
      if (this.audioStream) {
        this.audioStream.getTracks().forEach(track => track.stop());
        this.audioStream = null;
      }

      // Leave meeting if connected
      if (this.meetingState === ZoomMeetingState.CONNECTED) {
        await this.leaveMeeting();
      }

      // Clear participants
      this.participants.clear();
      
      // Reset state
      this.meetingState = ZoomMeetingState.NOT_STARTED;
      this.currentMeeting = null;
      this.isHostUser = false;
      this.chatEnabled = false;

      await super.cleanup();
    } catch (error) {
      console.error('Error during ZoomAdapter cleanup:', error);
    }
  }
}

export default ZoomAdapter;