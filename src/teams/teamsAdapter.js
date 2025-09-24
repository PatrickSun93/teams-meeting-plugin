// Teams Platform Adapter - Handles Teams-specific integration
import * as microsoftTeams from '@microsoft/teams-js';

class TeamsAdapter {
  constructor() {
    this.isInitialized = false;
    this.context = null;
    this.meetingInfo = null;
    this.participants = [];
    this.isHost = false;
    this.meetingState = 'unknown'; // 'unknown', 'active', 'ended'
    this.eventListeners = new Map();
  }

  /**
   * Initialize Teams SDK and get context
   */
  async initialize() {
    try {
      await microsoftTeams.app.initialize();
      this.context = await microsoftTeams.app.getContext();
      this.isInitialized = true;
      
      // Check if we're in a meeting
      await this.detectMeetingState();
      
      // Set up meeting event listeners
      this.setupMeetingEventListeners();
      
      console.log('Teams SDK initialized successfully', this.context);
      return true;
    } catch (error) {
      console.error('Failed to initialize Teams SDK:', error);
      throw new Error(`Teams initialization failed: ${error.message}`);
    }
  }

  /**
   * Detect current meeting state and information
   */
  async detectMeetingState() {
    if (!this.isInitialized) {
      throw new Error('Teams SDK not initialized');
    }

    try {
      // Check if we're in a meeting context
      if (this.context.meeting && this.context.meeting.id) {
        this.meetingInfo = {
          id: this.context.meeting.id,
          title: this.context.meeting.title || 'Teams Meeting',
          platform: 'teams',
          startTime: new Date(),
          organizer: this.context.meeting.organizer
        };
        
        this.meetingState = 'active';
        
        // Detect if user is host/organizer
        await this.detectHostStatus();
        
        // Get participant information
        await this.getParticipants();
        
        console.log('Meeting detected:', this.meetingInfo);
      } else {
        this.meetingState = 'unknown';
        console.log('Not currently in a meeting');
      }
    } catch (error) {
      console.error('Error detecting meeting state:', error);
      this.meetingState = 'unknown';
    }
  }

  /**
   * Detect if current user is meeting host/organizer
   */
  async detectHostStatus() {
    try {
      // Check if user is organizer based on context
      if (this.context.meeting && this.context.meeting.organizer) {
        this.isHost = this.context.user.id === this.context.meeting.organizer.id;
      }
      
      // Alternative: Check user role in meeting
      if (this.context.meeting && this.context.meeting.role) {
        this.isHost = this.context.meeting.role === 'Organizer' || 
                     this.context.meeting.role === 'Presenter';
      }
      
      console.log('Host status detected:', this.isHost);
    } catch (error) {
      console.error('Error detecting host status:', error);
      this.isHost = false;
    }
  }

  /**
   * Get meeting participants information
   */
  async getParticipants() {
    try {
      // Note: Teams SDK has limited participant access for privacy
      // This is a basic implementation that gets available participant info
      this.participants = [];
      
      if (this.context.meeting) {
        // Add current user as a participant
        this.participants.push({
          id: this.context.user.id,
          name: this.context.user.displayName || this.context.user.userPrincipalName,
          role: this.isHost ? 'host' : 'participant',
          isCurrentUser: true
        });
        
        // Add organizer if different from current user
        if (this.context.meeting.organizer && 
            this.context.meeting.organizer.id !== this.context.user.id) {
          this.participants.push({
            id: this.context.meeting.organizer.id,
            name: this.context.meeting.organizer.displayName,
            role: 'organizer',
            isCurrentUser: false
          });
        }
      }
      
      console.log('Participants detected:', this.participants);
    } catch (error) {
      console.error('Error getting participants:', error);
      this.participants = [];
    }
  }

  /**
   * Set up event listeners for meeting state changes
   */
  setupMeetingEventListeners() {
    try {
      // Listen for meeting state changes (if supported by Teams SDK)
      // Note: Teams SDK has limited real-time event support
      
      // Set up periodic meeting state check
      this.meetingStateInterval = setInterval(() => {
        this.checkMeetingStateChange();
      }, 5000); // Check every 5 seconds
      
    } catch (error) {
      console.error('Error setting up meeting event listeners:', error);
    }
  }

  /**
   * Check for meeting state changes
   */
  async checkMeetingStateChange() {
    try {
      const previousState = this.meetingState;
      await this.detectMeetingState();
      
      if (previousState !== this.meetingState) {
        this.notifyStateChange(previousState, this.meetingState);
      }
    } catch (error) {
      console.error('Error checking meeting state change:', error);
    }
  }

  /**
   * Notify listeners of state changes
   */
  notifyStateChange(previousState, newState) {
    const event = {
      type: 'meetingStateChange',
      previousState,
      newState,
      meetingInfo: this.meetingInfo,
      timestamp: new Date()
    };
    
    console.log('Meeting state changed:', event);
    
    // Notify registered listeners
    const listeners = this.eventListeners.get('meetingStateChange') || [];
    listeners.forEach(listener => {
      try {
        listener(event);
      } catch (error) {
        console.error('Error in meeting state change listener:', error);
      }
    });
  }

  /**
   * Register event listener
   */
  addEventListener(eventType, listener) {
    if (!this.eventListeners.has(eventType)) {
      this.eventListeners.set(eventType, []);
    }
    this.eventListeners.get(eventType).push(listener);
  }

  /**
   * Remove event listener
   */
  removeEventListener(eventType, listener) {
    const listeners = this.eventListeners.get(eventType);
    if (listeners) {
      const index = listeners.indexOf(listener);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }
  }

  /**
   * Get current meeting information
   */
  getMeetingInfo() {
    return {
      ...this.meetingInfo,
      state: this.meetingState,
      isHost: this.isHost,
      participants: this.participants,
      context: this.context
    };
  }

  /**
   * Check if user has host privileges
   */
  getHostStatus() {
    return this.isHost;
  }

  /**
   * Get meeting participants
   */
  getMeetingParticipants() {
    return [...this.participants];
  }

  /**
   * Send message to Teams chat using Microsoft Graph API
   */
  async sendMessageToChat(message) {
    try {
      console.log('Attempting to send message to chat:', message.substring(0, 100) + '...');
      
      // Check if we have the required context
      if (!this.context || !this.context.meeting) {
        return {
          success: false,
          error: 'Not in a meeting context'
        };
      }

      // Get access token for Microsoft Graph
      const accessToken = await this.getGraphAccessToken();
      if (!accessToken) {
        return {
          success: false,
          error: 'Unable to obtain Graph API access token'
        };
      }

      // Try to send message using Graph API
      const result = await this.sendMessageViaGraph(message, accessToken);
      
      if (result.success) {
        console.log('Message sent successfully to Teams chat');
        return {
          success: true,
          messageId: result.messageId,
          timestamp: new Date().toISOString()
        };
      } else {
        // Fallback: Try using Teams SDK sharing
        console.log('Graph API failed, trying Teams SDK sharing...');
        const fallbackResult = await this.sendMessageViaTeamsSDK(message);
        return fallbackResult;
      }
      
    } catch (error) {
      console.error('Error sending message to chat:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Send message using Microsoft Graph API
   */
  async sendMessageViaGraph(message, accessToken) {
    try {
      // Get the chat/channel ID from meeting context
      const chatId = this.getChatIdFromContext();
      if (!chatId) {
        throw new Error('Unable to determine chat ID from meeting context');
      }

      // Prepare the message payload
      const messagePayload = {
        body: {
          contentType: 'text',
          content: message
        }
      };

      // Send message via Graph API
      const response = await fetch(`https://graph.microsoft.com/v1.0/chats/${chatId}/messages`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(messagePayload)
      });

      if (response.ok) {
        const result = await response.json();
        return {
          success: true,
          messageId: result.id,
          chatId: chatId
        };
      } else {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`Graph API error: ${response.status} - ${errorData.error?.message || 'Unknown error'}`);
      }

    } catch (error) {
      console.error('Graph API message send failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Fallback: Send message using Teams SDK sharing capability
   */
  async sendMessageViaTeamsSDK(message) {
    try {
      // Use Teams SDK sharing functionality as fallback
      const shareContent = {
        content: [
          {
            type: 'message',
            preview: true,
            message: {
              text: message
            }
          }
        ]
      };

      // Try to share content
      await microsoftTeams.sharing.shareWebContent(shareContent);
      
      return {
        success: true,
        method: 'teams_sdk_sharing',
        note: 'Message shared via Teams SDK - user needs to confirm sending'
      };

    } catch (error) {
      console.error('Teams SDK sharing failed:', error);
      return {
        success: false,
        error: `Teams SDK sharing failed: ${error.message}`,
        suggestion: 'Please copy the transcript manually and paste it in the chat'
      };
    }
  }

  /**
   * Get chat ID from meeting context
   */
  getChatIdFromContext() {
    try {
      // Try different ways to get chat ID from Teams context
      if (this.context.meeting?.conversationId) {
        return this.context.meeting.conversationId;
      }
      
      if (this.context.chat?.id) {
        return this.context.chat.id;
      }
      
      if (this.context.channel?.id) {
        return this.context.channel.id;
      }

      // Try to extract from meeting URL or other context properties
      if (this.context.meeting?.joinUrl) {
        const urlMatch = this.context.meeting.joinUrl.match(/conversations\/([^\/\?]+)/);
        if (urlMatch) {
          return urlMatch[1];
        }
      }

      console.warn('Unable to determine chat ID from context:', this.context);
      return null;

    } catch (error) {
      console.error('Error getting chat ID from context:', error);
      return null;
    }
  }

  /**
   * Get meeting agenda (if available)
   */
  async getMeetingAgenda() {
    try {
      console.log('Attempting to get meeting agenda');
      
      // Import AgendaService dynamically to avoid circular dependencies
      const { default: AgendaService } = await import('../src/client/services/AgendaService.js');
      const agendaService = new AgendaService();
      
      // Try to get access token from Teams context
      const accessToken = await this.getGraphAccessToken();
      if (accessToken) {
        agendaService.setAccessToken(accessToken);
      }
      
      // Fetch agenda using meeting ID
      const meetingId = this.meetingInfo?.id;
      if (meetingId) {
        const agenda = await agendaService.fetchMeetingAgenda(meetingId);
        console.log('Meeting agenda retrieved:', agenda);
        return agenda;
      }
      
      // Return fallback agenda if no meeting ID
      return agendaService.createFallbackAgenda();
    } catch (error) {
      console.error('Error getting meeting agenda:', error);
      
      // Return fallback agenda on error
      try {
        const { default: AgendaService } = await import('../src/client/services/AgendaService.js');
        const agendaService = new AgendaService();
        return agendaService.createFallbackAgenda();
      } catch (fallbackError) {
        console.error('Error creating fallback agenda:', fallbackError);
        return null;
      }
    }
  }

  /**
   * Get Microsoft Graph access token from Teams context
   */
  async getGraphAccessToken() {
    try {
      if (!this.isInitialized) {
        return null;
      }

      // Try to get access token using Teams SDK
      // Note: This requires proper app registration and permissions
      const token = await microsoftTeams.authentication.getAuthToken({
        resources: ['https://graph.microsoft.com'],
        silent: true
      });
      
      console.log('Graph access token obtained');
      return token;
    } catch (error) {
      console.warn('Could not obtain Graph access token:', error.message);
      return null;
    }
  }

  /**
   * Request audio stream access with optimal settings for transcription
   */
  async requestAudioAccess() {
    try {
      // Request microphone permissions with optimal settings for speech recognition
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 16000, // Optimal for speech recognition
          channelCount: 1,    // Mono audio
          sampleSize: 16      // 16-bit samples
        }
      });
      
      console.log('Audio access granted with stream:', stream);
      
      // Validate audio stream
      const audioTracks = stream.getAudioTracks();
      if (audioTracks.length === 0) {
        throw new Error('No audio tracks available in stream');
      }
      
      // Log audio track settings
      const audioTrack = audioTracks[0];
      const settings = audioTrack.getSettings();
      console.log('Audio track settings:', settings);
      
      return stream;
    } catch (error) {
      console.error('Error requesting audio access:', error);
      
      // Provide more specific error messages
      if (error.name === 'NotAllowedError') {
        throw new Error('Microphone access denied. Please allow microphone permissions and try again.');
      } else if (error.name === 'NotFoundError') {
        throw new Error('No microphone found. Please connect a microphone and try again.');
      } else if (error.name === 'NotReadableError') {
        throw new Error('Microphone is already in use by another application.');
      } else {
        throw new Error(`Audio access failed: ${error.message}`);
      }
    }
  }

  /**
   * Get available audio input devices
   */
  async getAudioInputDevices() {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const audioInputs = devices.filter(device => device.kind === 'audioinput');
      
      console.log('Available audio input devices:', audioInputs);
      return audioInputs;
    } catch (error) {
      console.error('Error enumerating audio devices:', error);
      return [];
    }
  }

  /**
   * Request audio access with specific device
   */
  async requestAudioAccessWithDevice(deviceId) {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          deviceId: deviceId ? { exact: deviceId } : undefined,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 16000,
          channelCount: 1,
          sampleSize: 16
        }
      });
      
      console.log('Audio access granted for device:', deviceId);
      return stream;
    } catch (error) {
      console.error('Error requesting audio access for device:', deviceId, error);
      throw new Error(`Audio access failed for device: ${error.message}`);
    }
  }

  /**
   * Clean up resources
   */
  cleanup() {
    if (this.meetingStateInterval) {
      clearInterval(this.meetingStateInterval);
    }
    
    this.eventListeners.clear();
    console.log('Teams adapter cleaned up');
  }

  /**
   * Get platform capabilities
   */
  getPlatformCapabilities() {
    return {
      supportsChatIntegration: true, // Requires Graph API setup
      supportsAgendaAccess: true,    // Requires Graph API setup
      supportsParticipantInfo: true, // Limited by Teams privacy settings
      supportsHostDetection: true,
      audioQuality: 'high',
      platform: 'teams'
    };
  }
}

export default TeamsAdapter;