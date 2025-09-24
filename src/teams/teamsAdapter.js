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
   * Send message to Teams chat (if permissions allow)
   */
  async sendMessageToChat(message) {
    try {
      // Note: Sending messages requires specific permissions and context
      // This is a placeholder for the chat integration functionality
      console.log('Attempting to send message to chat:', message);
      
      // For now, we'll use the Teams SDK's sharing capability
      // In a full implementation, this would use Microsoft Graph API
      
      return {
        success: false,
        message: 'Chat integration not yet implemented - requires Graph API setup'
      };
    } catch (error) {
      console.error('Error sending message to chat:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get meeting agenda (if available)
   */
  async getMeetingAgenda() {
    try {
      // Note: Getting meeting agenda requires Microsoft Graph API integration
      // This is a placeholder implementation
      console.log('Attempting to get meeting agenda');
      
      return {
        available: false,
        message: 'Agenda access requires Graph API integration'
      };
    } catch (error) {
      console.error('Error getting meeting agenda:', error);
      return null;
    }
  }

  /**
   * Request audio stream access
   */
  async requestAudioAccess() {
    try {
      // Request microphone permissions through Teams
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });
      
      console.log('Audio access granted');
      return stream;
    } catch (error) {
      console.error('Error requesting audio access:', error);
      throw new Error(`Audio access denied: ${error.message}`);
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