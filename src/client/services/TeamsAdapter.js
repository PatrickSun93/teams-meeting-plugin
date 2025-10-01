/**
 * Microsoft Teams Platform Adapter
 * Implements platform-specific functionality for Microsoft Teams
 */

import { 
  PlatformAdapter, 
  MeetingPlatform, 
  PlatformCapabilities, 
  AudioQuality, 
  MeetingInfo, 
  ParticipantInfo,
  PlatformEvents 
} from './PlatformAdapter.js';

/**
 * Teams Platform Adapter
 */
export class TeamsAdapter extends PlatformAdapter {
  constructor() {
    super();
    this.platform = MeetingPlatform.TEAMS;
    this.teamsContext = null;
    this.teamsSDK = null;
    this.audioStream = null;
    this.meetingInfo = null;
  }

  /**
   * Initialize Teams adapter
   * @returns {Promise<boolean>} Success status
   */
  async initialize() {
    try {
      // Check if Teams SDK is available
      if (typeof window !== 'undefined' && window.microsoftTeams) {
        this.teamsSDK = window.microsoftTeams;
      } else {
        console.warn('Microsoft Teams SDK not available');
        return false;
      }

      // Initialize Teams SDK
      await new Promise((resolve, reject) => {
        this.teamsSDK.initialize(() => {
          resolve();
        });
        
        // Timeout after 10 seconds
        setTimeout(() => {
          reject(new Error('Teams SDK initialization timeout'));
        }, 10000);
      });

      // Get Teams context
      this.teamsContext = await new Promise((resolve, reject) => {
        this.teamsSDK.getContext((context) => {
          resolve(context);
        });
        
        setTimeout(() => {
          reject(new Error('Teams context retrieval timeout'));
        }, 5000);
      });

      // Set up event listeners
      this._setupEventListeners();

      this.initialized = true;
      this.meetingActive = this._isMeetingActive();

      return true;
    } catch (error) {
      console.error('Error initializing Teams adapter:', error);
      return false;
    }
  }

  /**
   * Get current meeting information
   * @returns {Promise<MeetingInfo>} Meeting details
   */
  async getMeetingInfo() {
    if (!this.initialized || !this.teamsContext) {
      throw new Error('Teams adapter not initialized');
    }

    try {
      const meetingDetails = this.teamsContext.meeting || {};
      const chatId = this.teamsContext.chatId;
      const teamId = this.teamsContext.teamId;

      this.meetingInfo = new MeetingInfo({
        id: meetingDetails.id || chatId || teamId,
        title: this.teamsContext.meetingId || 'Teams Meeting',
        platform: MeetingPlatform.TEAMS,
        startTime: new Date(), // Teams doesn't provide start time directly
        participants: await this.getParticipants(),
        agenda: await this.getMeetingAgenda(),
        isHost: await this.isHost(),
        meetingUrl: window.location.href
      });

      return this.meetingInfo;
    } catch (error) {
      console.error('Error getting Teams meeting info:', error);
      throw error;
    }
  }

  /**
   * Get audio stream from Teams meeting
   * @returns {Promise<MediaStream>} Audio stream
   */
  async getAudioStream() {
    if (!this.initialized) {
      throw new Error('Teams adapter not initialized');
    }

    try {
      // Use Teams SDK media capabilities if available
      if (this.teamsSDK.media && this.teamsSDK.media.getAudioStream) {
        this.audioStream = await this.teamsSDK.media.getAudioStream();
      } else {
        // Fallback to standard WebRTC
        this.audioStream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
          }
        });
      }

      return this.audioStream;
    } catch (error) {
      console.error('Error getting Teams audio stream:', error);
      throw error;
    }
  }

  /**
   * Get meeting participants
   * @returns {Promise<ParticipantInfo[]>} Participant array
   */
  async getParticipants() {
    if (!this.initialized || !this.teamsContext) {
      return [];
    }

    try {
      // Teams SDK doesn't provide direct participant access
      // This would need to be implemented with Microsoft Graph API
      const participants = [];
      
      // Add current user as participant
      if (this.teamsContext.userPrincipalName) {
        participants.push(new ParticipantInfo({
          id: this.teamsContext.userObjectId,
          name: this.teamsContext.userPrincipalName,
          email: this.teamsContext.userPrincipalName,
          isHost: await this.isHost(),
          joinTime: new Date()
        }));
      }

      return participants;
    } catch (error) {
      console.error('Error getting Teams participants:', error);
      return [];
    }
  }

  /**
   * Send message to Teams chat
   * @param {string} message - Message to send
   * @returns {Promise<boolean>} Success status
   */
  async sendMessageToChat(message) {
    if (!this.initialized || !this.teamsSDK) {
      return false;
    }

    try {
      // Use Teams SDK to send message
      if (this.teamsSDK.conversations && this.teamsSDK.conversations.sendMessage) {
        await this.teamsSDK.conversations.sendMessage({
          message: message,
          messageType: 'text'
        });
        return true;
      } else {
        console.warn('Teams chat API not available');
        return false;
      }
    } catch (error) {
      console.error('Error sending message to Teams chat:', error);
      return false;
    }
  }

  /**
   * Get meeting agenda from Teams
   * @returns {Promise<object|null>} Agenda object or null
   */
  async getMeetingAgenda() {
    if (!this.initialized) {
      return null;
    }

    try {
      // This would require Microsoft Graph API integration
      // For now, return null as agenda access needs additional permissions
      return null;
    } catch (error) {
      console.error('Error getting Teams meeting agenda:', error);
      return null;
    }
  }

  /**
   * Check if current user is meeting host
   * @returns {Promise<boolean>} Host status
   */
  async isHost() {
    if (!this.initialized || !this.teamsContext) {
      return false;
    }

    try {
      // Check if user has organizer role
      const userRole = this.teamsContext.userRole;
      return userRole === 'organizer' || userRole === 'presenter';
    } catch (error) {
      console.error('Error checking Teams host status:', error);
      return false;
    }
  }

  /**
   * Get Teams platform capabilities
   * @returns {object} Capabilities object
   */
  getCapabilities() {
    return {
      [PlatformCapabilities.CHAT_INTEGRATION]: true,
      [PlatformCapabilities.AGENDA_ACCESS]: false, // Requires Graph API
      [PlatformCapabilities.PARTICIPANT_INFO]: true,
      [PlatformCapabilities.HOST_DETECTION]: true,
      [PlatformCapabilities.AUDIO_QUALITY]: AudioQuality.HIGH,
      [PlatformCapabilities.MEETING_EVENTS]: true,
      [PlatformCapabilities.RECORDING_ACCESS]: false
    };
  }

  /**
   * Setup Teams event listeners
   * @private
   */
  _setupEventListeners() {
    if (!this.teamsSDK) return;

    // Listen for Teams app events
    this.teamsSDK.registerOnThemeChangeHandler((theme) => {
      this._emitEvent('themeChanged', { theme });
    });

    // Monitor meeting state changes
    this._startMeetingStateMonitoring();
  }

  /**
   * Check if currently in a meeting
   * @private
   * @returns {boolean} Meeting active status
   */
  _isMeetingActive() {
    if (!this.teamsContext) return false;
    
    // Check various indicators that suggest an active meeting
    return !!(
      this.teamsContext.meetingId ||
      this.teamsContext.chatId ||
      (this.teamsContext.frameContext === 'meetingStage')
    );
  }

  /**
   * Start monitoring meeting state
   * @private
   */
  _startMeetingStateMonitoring() {
    // Poll for meeting state changes
    setInterval(() => {
      const wasActive = this.meetingActive;
      const isActive = this._isMeetingActive();
      
      if (wasActive !== isActive) {
        this.meetingActive = isActive;
        
        if (isActive) {
          this._emitEvent(PlatformEvents.MEETING_STARTED, {
            platform: this.platform,
            timestamp: new Date()
          });
        } else {
          this._emitEvent(PlatformEvents.MEETING_ENDED, {
            platform: this.platform,
            timestamp: new Date()
          });
        }
      }
    }, 2000);
  }

  /**
   * Cleanup Teams adapter resources
   */
  async cleanup() {
    if (this.audioStream) {
      this.audioStream.getTracks().forEach(track => track.stop());
      this.audioStream = null;
    }
    
    this.teamsContext = null;
    this.teamsSDK = null;
    this.meetingInfo = null;
    
    await super.cleanup();
  }
}