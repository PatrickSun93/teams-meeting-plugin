/**
 * Base Platform Adapter Class
 * Provides unified interface for different video conferencing platforms
 */

/**
 * Supported meeting platforms
 */
export const MeetingPlatform = {
  TEAMS: 'teams',
  ZOOM: 'zoom',
  GOOGLE_MEET: 'google_meet',
  WEBEX: 'webex',
  UNKNOWN: 'unknown'
};

/**
 * Platform capabilities structure
 */
export const PlatformCapabilities = {
  CHAT_INTEGRATION: 'chatIntegration',
  AGENDA_ACCESS: 'agendaAccess',
  PARTICIPANT_INFO: 'participantInfo',
  HOST_DETECTION: 'hostDetection',
  AUDIO_QUALITY: 'audioQuality',
  MEETING_EVENTS: 'meetingEvents',
  RECORDING_ACCESS: 'recordingAccess'
};

/**
 * Audio quality levels
 */
export const AudioQuality = {
  HIGH: 'high',
  MEDIUM: 'medium',
  LOW: 'low'
};

/**
 * Meeting information structure
 */
export class MeetingInfo {
  constructor({
    id = null,
    title = '',
    platform = MeetingPlatform.UNKNOWN,
    startTime = null,
    endTime = null,
    participants = [],
    agenda = null,
    isHost = false,
    meetingUrl = ''
  } = {}) {
    this.id = id;
    this.title = title;
    this.platform = platform;
    this.startTime = startTime;
    this.endTime = endTime;
    this.participants = participants;
    this.agenda = agenda;
    this.isHost = isHost;
    this.meetingUrl = meetingUrl;
  }
}

/**
 * Participant information structure
 */
export class ParticipantInfo {
  constructor({
    id = null,
    name = '',
    email = '',
    isHost = false,
    isMuted = false,
    isVideoOn = false,
    joinTime = null
  } = {}) {
    this.id = id;
    this.name = name;
    this.email = email;
    this.isHost = isHost;
    this.isMuted = isMuted;
    this.isVideoOn = isVideoOn;
    this.joinTime = joinTime;
  }
}

/**
 * Base Platform Adapter Class
 * Abstract class that defines the interface for platform-specific implementations
 */
export class PlatformAdapter {
  constructor() {
    if (this.constructor === PlatformAdapter) {
      throw new Error('PlatformAdapter is an abstract class and cannot be instantiated directly');
    }
    this.platform = MeetingPlatform.UNKNOWN;
    this.initialized = false;
    this.meetingActive = false;
    this.eventListeners = new Map();
  }

  /**
   * Static method to detect the current platform
   * @returns {string} Platform identifier
   */
  static detectPlatform() {
    if (typeof window === 'undefined') {
      return MeetingPlatform.UNKNOWN;
    }

    const hostname = window.location?.hostname?.toLowerCase() || '';
    const userAgent = (typeof navigator !== 'undefined' ? navigator.userAgent : '').toLowerCase();
    const url = window.location?.href?.toLowerCase() || '';

    // Microsoft Teams detection
    if (hostname.includes('teams.microsoft.com') || 
        hostname.includes('teams.live.com') ||
        url.includes('teams.microsoft.com') ||
        userAgent.includes('teams/')) {
      return MeetingPlatform.TEAMS;
    }

    // Zoom detection
    if (hostname.includes('zoom.us') || 
        hostname.includes('zoom.com') ||
        url.includes('zoom.us') ||
        userAgent.includes('zoom')) {
      return MeetingPlatform.ZOOM;
    }

    // Google Meet detection
    if (hostname.includes('meet.google.com') ||
        url.includes('meet.google.com')) {
      return MeetingPlatform.GOOGLE_MEET;
    }

    // Webex detection
    if (hostname.includes('webex.com') ||
        hostname.includes('webex.cisco.com') ||
        url.includes('webex.com')) {
      return MeetingPlatform.WEBEX;
    }

    return MeetingPlatform.UNKNOWN;
  }

  /**
   * Initialize the platform adapter
   * @returns {Promise<boolean>} Success status
   */
  async initialize() {
    throw new Error('initialize() must be implemented by subclass');
  }

  /**
   * Get current meeting information
   * @returns {Promise<MeetingInfo>} Meeting details
   */
  async getMeetingInfo() {
    throw new Error('getMeetingInfo() must be implemented by subclass');
  }

  /**
   * Get audio stream from the meeting
   * @returns {Promise<MediaStream>} Audio stream
   */
  async getAudioStream() {
    throw new Error('getAudioStream() must be implemented by subclass');
  }

  /**
   * Get list of meeting participants
   * @returns {Promise<ParticipantInfo[]>} Participant array
   */
  async getParticipants() {
    throw new Error('getParticipants() must be implemented by subclass');
  }

  /**
   * Send message to meeting chat
   * @param {string} message - Message to send
   * @returns {Promise<boolean>} Success status
   */
  async sendMessageToChat(message) {
    throw new Error('sendMessageToChat() must be implemented by subclass');
  }

  /**
   * Get meeting agenda information
   * @returns {Promise<object|null>} Agenda object or null
   */
  async getMeetingAgenda() {
    throw new Error('getMeetingAgenda() must be implemented by subclass');
  }

  /**
   * Check if current user is meeting host
   * @returns {Promise<boolean>} Host status
   */
  async isHost() {
    throw new Error('isHost() must be implemented by subclass');
  }

  /**
   * Get platform capabilities
   * @returns {object} Capabilities object
   */
  getCapabilities() {
    throw new Error('getCapabilities() must be implemented by subclass');
  }

  /**
   * Check if meeting is currently active
   * @returns {boolean} Meeting active status
   */
  isMeetingActive() {
    return this.meetingActive;
  }

  /**
   * Check if adapter is initialized
   * @returns {boolean} Initialization status
   */
  isInitialized() {
    return this.initialized;
  }

  /**
   * Get platform identifier
   * @returns {string} Platform identifier
   */
  getPlatform() {
    return this.platform;
  }

  /**
   * Add event listener for platform events
   * @param {string} event - Event name
   * @param {function} callback - Event callback
   */
  addEventListener(event, callback) {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    this.eventListeners.get(event).push(callback);
  }

  /**
   * Remove event listener
   * @param {string} event - Event name
   * @param {function} callback - Event callback
   */
  removeEventListener(event, callback) {
    if (this.eventListeners.has(event)) {
      const listeners = this.eventListeners.get(event);
      const index = listeners.indexOf(callback);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }
  }

  /**
   * Emit platform event
   * @param {string} event - Event name
   * @param {*} data - Event data
   */
  _emitEvent(event, data) {
    if (this.eventListeners.has(event)) {
      this.eventListeners.get(event).forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`Error in event listener for ${event}:`, error);
        }
      });
    }
  }

  /**
   * Cleanup resources
   */
  async cleanup() {
    this.eventListeners.clear();
    this.initialized = false;
    this.meetingActive = false;
  }
}

/**
 * Platform Events
 */
export const PlatformEvents = {
  MEETING_STARTED: 'meetingStarted',
  MEETING_ENDED: 'meetingEnded',
  PARTICIPANT_JOINED: 'participantJoined',
  PARTICIPANT_LEFT: 'participantLeft',
  AUDIO_STATE_CHANGED: 'audioStateChanged',
  HOST_CHANGED: 'hostChanged',
  MEETING_INFO_UPDATED: 'meetingInfoUpdated'
};