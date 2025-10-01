/**
 * Generic Platform Adapter
 * Fallback adapter for unsupported platforms or when platform detection fails
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
 * Generic Platform Adapter
 * Provides basic functionality using standard web APIs
 */
export class GenericAdapter extends PlatformAdapter {
  constructor() {
    super();
    this.platform = MeetingPlatform.UNKNOWN;
    this.audioStream = null;
    this.meetingInfo = null;
    this.detectedPlatform = MeetingPlatform.UNKNOWN;
  }

  /**
   * Initialize generic adapter
   * @returns {Promise<boolean>} Success status
   */
  async initialize() {
    try {
      // Detect what platform we might be on
      this.detectedPlatform = PlatformAdapter.detectPlatform();
      
      // Check for basic web API support
      if (typeof navigator === 'undefined' || !navigator.mediaDevices) {
        console.warn('Media devices not supported');
        return false;
      }

      // Test microphone access
      try {
        const testStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        testStream.getTracks().forEach(track => track.stop());
      } catch (error) {
        console.warn('Microphone access not available:', error);
        // Continue initialization even without mic access
      }

      this.initialized = true;
      this.meetingActive = this._detectMeetingState();

      // Start monitoring for meeting state changes
      this._startMeetingStateMonitoring();

      return true;
    } catch (error) {
      console.error('Error initializing generic adapter:', error);
      return false;
    }
  }

  /**
   * Get current meeting information
   * @returns {Promise<MeetingInfo>} Meeting details
   */
  async getMeetingInfo() {
    if (!this.initialized) {
      throw new Error('Generic adapter not initialized');
    }

    try {
      this.meetingInfo = new MeetingInfo({
        id: this._generateMeetingId(),
        title: this._extractMeetingTitle(),
        platform: this.detectedPlatform,
        startTime: new Date(),
        participants: await this.getParticipants(),
        agenda: null, // Not available in generic mode
        isHost: false, // Cannot determine host status
        meetingUrl: window.location.href
      });

      return this.meetingInfo;
    } catch (error) {
      console.error('Error getting generic meeting info:', error);
      throw error;
    }
  }

  /**
   * Get audio stream using standard WebRTC
   * @returns {Promise<MediaStream>} Audio stream
   */
  async getAudioStream() {
    if (!this.initialized) {
      throw new Error('Generic adapter not initialized');
    }

    try {
      this.audioStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 16000 // Optimize for speech recognition
        }
      });

      return this.audioStream;
    } catch (error) {
      console.error('Error getting generic audio stream:', error);
      throw error;
    }
  }

  /**
   * Get meeting participants (limited in generic mode)
   * @returns {Promise<ParticipantInfo[]>} Participant array
   */
  async getParticipants() {
    // Generic adapter cannot detect other participants
    // Return only current user if possible
    const participants = [];
    
    try {
      // Try to extract user info from page if available
      const userInfo = this._extractUserInfo();
      if (userInfo) {
        participants.push(new ParticipantInfo({
          id: 'current-user',
          name: userInfo.name || 'Current User',
          email: userInfo.email || '',
          isHost: false,
          joinTime: new Date()
        }));
      }
    } catch (error) {
      console.error('Error getting generic participants:', error);
    }

    return participants;
  }

  /**
   * Send message to chat (not supported in generic mode)
   * @param {string} message - Message to send
   * @returns {Promise<boolean>} Success status (always false)
   */
  async sendMessageToChat(message) {
    console.warn('Chat integration not available in generic mode');
    return false;
  }

  /**
   * Get meeting agenda (not available in generic mode)
   * @returns {Promise<object|null>} Always returns null
   */
  async getMeetingAgenda() {
    return null;
  }

  /**
   * Check if current user is host (cannot determine in generic mode)
   * @returns {Promise<boolean>} Always returns false
   */
  async isHost() {
    return false;
  }

  /**
   * Get generic platform capabilities
   * @returns {object} Capabilities object
   */
  getCapabilities() {
    return {
      [PlatformCapabilities.CHAT_INTEGRATION]: false,
      [PlatformCapabilities.AGENDA_ACCESS]: false,
      [PlatformCapabilities.PARTICIPANT_INFO]: false,
      [PlatformCapabilities.HOST_DETECTION]: false,
      [PlatformCapabilities.AUDIO_QUALITY]: AudioQuality.MEDIUM,
      [PlatformCapabilities.MEETING_EVENTS]: false,
      [PlatformCapabilities.RECORDING_ACCESS]: false
    };
  }

  /**
   * Generate a meeting ID based on URL and timestamp
   * @private
   * @returns {string} Generated meeting ID
   */
  _generateMeetingId() {
    const url = window.location?.href || 'unknown';
    const timestamp = Date.now();
    return `generic-${btoa(url).slice(0, 10)}-${timestamp}`;
  }

  /**
   * Extract meeting title from page
   * @private
   * @returns {string} Meeting title
   */
  _extractMeetingTitle() {
    // Try to get title from document title
    let title = (typeof document !== 'undefined' ? document.title : '') || '';
    
    // Clean up common meeting platform patterns
    title = title.replace(/\s*-\s*(Microsoft Teams|Zoom|Google Meet|Webex).*$/i, '');
    title = title.replace(/^(Meeting|Call|Conference)\s*-\s*/i, '');
    
    // If title is empty or just a platform name, return default
    if (!title || /^(Microsoft Teams|Zoom|Google Meet|Webex)$/i.test(title)) {
      return 'Meeting';
    }
    
    return title;
  }

  /**
   * Extract user information from page if available
   * @private
   * @returns {object|null} User info object
   */
  _extractUserInfo() {
    // This is a best-effort attempt to extract user info
    // Implementation would depend on specific platform patterns
    return null;
  }

  /**
   * Detect if we're currently in a meeting
   * @private
   * @returns {boolean} Meeting state
   */
  _detectMeetingState() {
    const url = (window.location?.href || '').toLowerCase();
    const title = (typeof document !== 'undefined' ? document.title : '').toLowerCase();
    
    // Look for meeting indicators in URL or title
    const meetingIndicators = [
      'meeting', 'call', 'conference', 'room', 'session',
      'teams.microsoft.com', 'zoom.us', 'meet.google.com', 'webex.com'
    ];
    
    return meetingIndicators.some(indicator => 
      url.includes(indicator) || title.includes(indicator)
    );
  }

  /**
   * Start monitoring for meeting state changes
   * @private
   */
  _startMeetingStateMonitoring() {
    // Monitor URL changes
    let lastUrl = window.location?.href || '';
    let lastTitle = (typeof document !== 'undefined' ? document.title : '') || '';
    
    setInterval(() => {
      const currentUrl = window.location?.href || '';
      const currentTitle = (typeof document !== 'undefined' ? document.title : '') || '';
      
      if (currentUrl !== lastUrl || currentTitle !== lastTitle) {
        const wasActive = this.meetingActive;
        const isActive = this._detectMeetingState();
        
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
        
        lastUrl = currentUrl;
        lastTitle = currentTitle;
      }
    }, 3000);
  }

  /**
   * Cleanup generic adapter resources
   */
  async cleanup() {
    if (this.audioStream) {
      this.audioStream.getTracks().forEach(track => track.stop());
      this.audioStream = null;
    }
    
    this.meetingInfo = null;
    
    await super.cleanup();
  }
}