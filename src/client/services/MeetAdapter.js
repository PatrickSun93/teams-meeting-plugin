/**
 * Google Meet Platform Adapter
 * Integrates with Google Meet through browser extension
 */

import { 
  PlatformAdapter, 
  MeetingPlatform, 
  MeetingInfo, 
  ParticipantInfo, 
  PlatformEvents,
  AudioQuality 
} from './PlatformAdapter.js';

/**
 * Google Meet Adapter Class
 * Provides Google Meet integration through browser extension
 */
export class MeetAdapter extends PlatformAdapter {
  constructor() {
    super();
    this.platform = MeetingPlatform.GOOGLE_MEET;
    this.extensionId = null;
    this.audioStream = null;
    this.meetingInfo = null;
    this.participants = [];
    this.calendarAPI = null;
    this.isExtensionAvailable = false;
  }

  /**
   * Initialize the Google Meet adapter
   * @returns {Promise<boolean>} Success status
   */
  async initialize() {
    try {
      console.log('Initializing Google Meet adapter...');
      
      // Check if we're running in browser extension context
      this.isExtensionAvailable = this._checkExtensionAvailability();
      
      if (this.isExtensionAvailable) {
        await this._initializeExtensionIntegration();
      } else {
        await this._initializeWebIntegration();
      }
      
      this.initialized = true;
      console.log('Google Meet adapter initialized successfully');
      return true;
    } catch (error) {
      console.error('Failed to initialize Google Meet adapter:', error);
      throw error;
    }
  }

  /**
   * Check if browser extension APIs are available
   * @returns {boolean} Extension availability
   */
  _checkExtensionAvailability() {
    return typeof chrome !== 'undefined' && 
           chrome.runtime && 
           typeof chrome.runtime.id !== 'undefined';
  }

  /**
   * Initialize extension-based integration
   */
  async _initializeExtensionIntegration() {
    this.extensionId = chrome.runtime.id;
    
    // Set up message listener for extension communication
    chrome.runtime.onMessage.addListener(this._handleExtensionMessage.bind(this));
    
    // Get current meeting info from extension
    try {
      const response = await chrome.runtime.sendMessage({ 
        type: 'GET_MEETING_INFO' 
      });
      
      if (response.success && response.meetingInfo) {
        this.meetingInfo = new MeetingInfo(response.meetingInfo);
        this.meetingActive = true;
      }
    } catch (error) {
      console.log('No active meeting found in extension');
    }
  }

  /**
   * Initialize web-based integration (fallback)
   */
  async _initializeWebIntegration() {
    // Detect meeting from URL and DOM
    this._detectMeetingFromDOM();
    
    // Set up DOM observers for meeting state changes
    this._setupDOMObservers();
  }

  /**
   * Handle messages from browser extension
   */
  _handleExtensionMessage(message, sender, sendResponse) {
    switch (message.type) {
      case 'MEETING_DETECTED':
        this._handleMeetingDetected(message.data);
        break;
      case 'MEETING_ENDED':
        this._handleMeetingEnded(message.data);
        break;
      case 'PARTICIPANT_JOINED':
        this._handleParticipantJoined(message.data);
        break;
      case 'PARTICIPANT_LEFT':
        this._handleParticipantLeft(message.data);
        break;
      case 'CONFIG_CHANGED':
        this._handleConfigChanged(message.data);
        break;
    }
  }

  /**
   * Detect meeting information from DOM (web fallback)
   */
  _detectMeetingFromDOM() {
    const url = window.location.href;
    const meetingIdMatch = url.match(/meet\.google\.com\/([a-z0-9-]+)/);
    
    if (meetingIdMatch) {
      const meetingId = meetingIdMatch[1];
      const title = this._extractMeetingTitle();
      
      this.meetingInfo = new MeetingInfo({
        id: meetingId,
        title: title || `Google Meet - ${meetingId}`,
        platform: MeetingPlatform.GOOGLE_MEET,
        startTime: new Date(),
        meetingUrl: url
      });
      
      this.meetingActive = true;
      this._emitEvent(PlatformEvents.MEETING_STARTED, this.meetingInfo);
    }
  }

  /**
   * Extract meeting title from DOM
   */
  _extractMeetingTitle() {
    const titleSelectors = [
      '[data-meeting-title]',
      '[jsname="r4nke"]',
      '.u6vdEc',
      'h1'
    ];

    for (const selector of titleSelectors) {
      const element = document.querySelector(selector);
      if (element && element.textContent.trim()) {
        return element.textContent.trim();
      }
    }
    
    return null;
  }

  /**
   * Set up DOM observers for meeting state changes
   */
  _setupDOMObservers() {
    const observer = new MutationObserver(() => {
      this._updateMeetingState();
      this._updateParticipants();
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true
    });
  }

  /**
   * Update meeting state from DOM
   */
  _updateMeetingState() {
    const meetingIndicators = [
      () => document.querySelector('[data-is-muted]'),
      () => document.querySelector('[aria-label*="Leave call"]'),
      () => document.querySelector('video')
    ];

    const isInMeeting = meetingIndicators.some(check => check());
    
    if (isInMeeting && !this.meetingActive) {
      this.meetingActive = true;
      this._emitEvent(PlatformEvents.MEETING_STARTED, this.meetingInfo);
    } else if (!isInMeeting && this.meetingActive) {
      this.meetingActive = false;
      this._emitEvent(PlatformEvents.MEETING_ENDED, this.meetingInfo);
    }
  }

  /**
   * Update participants from DOM
   */
  _updateParticipants() {
    const participantElements = document.querySelectorAll([
      '[data-participant-id]',
      '.participant-name'
    ].join(', '));

    const currentParticipants = [];
    
    participantElements.forEach(element => {
      const id = element.getAttribute('data-participant-id') || 
                 element.textContent?.trim();
      const name = element.textContent?.trim() || 'Unknown';
      
      if (id) {
        currentParticipants.push(new ParticipantInfo({
          id,
          name,
          joinTime: new Date()
        }));
      }
    });

    this.participants = currentParticipants;
  }

  /**
   * Handle meeting detected event
   */
  _handleMeetingDetected(data) {
    this.meetingInfo = new MeetingInfo({
      id: data.meetingId,
      title: data.title,
      platform: MeetingPlatform.GOOGLE_MEET,
      startTime: new Date(data.timestamp),
      meetingUrl: data.url
    });
    
    this.meetingActive = true;
    this._emitEvent(PlatformEvents.MEETING_STARTED, this.meetingInfo);
  }

  /**
   * Handle meeting ended event
   */
  _handleMeetingEnded(data) {
    if (this.meetingInfo) {
      this.meetingInfo.endTime = new Date(data.timestamp);
    }
    
    this.meetingActive = false;
    this._emitEvent(PlatformEvents.MEETING_ENDED, this.meetingInfo);
  }

  /**
   * Handle participant joined event
   */
  _handleParticipantJoined(data) {
    const participant = new ParticipantInfo({
      id: data.participantId,
      name: data.name || 'Unknown',
      joinTime: new Date(data.timestamp)
    });
    
    this.participants.push(participant);
    this._emitEvent(PlatformEvents.PARTICIPANT_JOINED, participant);
  }

  /**
   * Handle participant left event
   */
  _handleParticipantLeft(data) {
    const index = this.participants.findIndex(p => p.id === data.participantId);
    if (index > -1) {
      const participant = this.participants.splice(index, 1)[0];
      this._emitEvent(PlatformEvents.PARTICIPANT_LEFT, participant);
    }
  }

  /**
   * Handle configuration changed event
   */
  _handleConfigChanged(data) {
    console.log('Configuration changed:', data);
    // Emit event for configuration updates
    this._emitEvent('configurationChanged', data);
  }

  /**
   * Get current meeting information
   * @returns {Promise<MeetingInfo>} Meeting details
   */
  async getMeetingInfo() {
    if (this.isExtensionAvailable) {
      try {
        const response = await chrome.runtime.sendMessage({ 
          type: 'GET_MEETING_INFO' 
        });
        
        if (response.success && response.meetingInfo) {
          return new MeetingInfo(response.meetingInfo);
        }
      } catch (error) {
        console.error('Failed to get meeting info from extension:', error);
      }
    }
    
    return this.meetingInfo || new MeetingInfo();
  }

  /**
   * Get audio stream from the meeting
   * @returns {Promise<MediaStream>} Audio stream
   */
  async getAudioStream() {
    try {
      // For Google Meet, we need to capture system audio or use WebRTC
      if (this.audioStream) {
        return this.audioStream;
      }

      // Try to get audio stream from WebRTC
      this.audioStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });

      return this.audioStream;
    } catch (error) {
      console.error('Failed to get audio stream:', error);
      throw new Error('Unable to access microphone for audio capture');
    }
  }

  /**
   * Get list of meeting participants
   * @returns {Promise<ParticipantInfo[]>} Participant array
   */
  async getParticipants() {
    if (this.isExtensionAvailable) {
      try {
        const response = await chrome.runtime.sendMessage({ 
          type: 'GET_PARTICIPANTS' 
        });
        
        if (response.success && response.participants) {
          return response.participants.map(p => new ParticipantInfo(p));
        }
      } catch (error) {
        console.error('Failed to get participants from extension:', error);
      }
    }
    
    return this.participants;
  }

  /**
   * Send message to meeting chat
   * Google Meet doesn't have a chat API, so this returns false
   * @param {string} message - Message to send
   * @returns {Promise<boolean>} Success status (always false for Google Meet)
   */
  async sendMessageToChat(message) {
    console.log('Google Meet does not support chat integration');
    return false;
  }

  /**
   * Get meeting agenda information
   * @returns {Promise<object|null>} Agenda object or null
   */
  async getMeetingAgenda() {
    if (this.isExtensionAvailable) {
      try {
        const response = await chrome.runtime.sendMessage({ 
          type: 'GET_MEETING_AGENDA',
          data: { meetingId: this.meetingInfo?.id }
        });
        
        if (response.success && response.agenda) {
          return response.agenda;
        }
      } catch (error) {
        console.error('Failed to get meeting agenda:', error);
      }
    }
    
    return null;
  }

  /**
   * Check if current user is meeting host
   * Google Meet doesn't provide reliable host detection
   * @returns {Promise<boolean>} Host status (always false)
   */
  async isHost() {
    // Google Meet doesn't provide reliable host detection through DOM
    return false;
  }

  /**
   * Get platform capabilities
   * @returns {object} Capabilities object
   */
  getCapabilities() {
    return {
      chatIntegration: false,           // No chat API available
      agendaAccess: true,              // Via Google Calendar API
      participantInfo: false,          // Limited participant info
      hostDetection: false,            // No reliable host detection
      audioQuality: AudioQuality.MEDIUM,
      meetingEvents: true,             // Basic meeting start/end
      recordingAccess: false,          // No recording API
      fileExport: true,                // Can export transcripts as files
      calendarIntegration: true,       // Google Calendar integration
      driveIntegration: true           // Google Drive storage
    };
  }

  /**
   * Export transcript to file
   * @param {object} transcript - Transcript data
   * @param {string} format - Export format (pdf, docx, txt)
   * @returns {Promise<boolean>} Success status
   */
  async exportTranscript(transcript, format = 'pdf') {
    if (this.isExtensionAvailable) {
      try {
        const response = await chrome.runtime.sendMessage({
          type: 'EXPORT_TRANSCRIPT',
          data: { transcript, format }
        });
        
        return response.success;
      } catch (error) {
        console.error('Failed to export transcript:', error);
        return false;
      }
    }
    
    // Fallback: create download link
    return this._createDownloadLink(transcript, format);
  }

  /**
   * Save transcript to Google Drive
   * @param {object} transcript - Transcript data
   * @returns {Promise<boolean>} Success status
   */
  async saveToGoogleDrive(transcript) {
    if (this.isExtensionAvailable) {
      try {
        const response = await chrome.runtime.sendMessage({
          type: 'SAVE_TO_DRIVE',
          data: { transcript }
        });
        
        return response.success;
      } catch (error) {
        console.error('Failed to save to Google Drive:', error);
        return false;
      }
    }
    
    return false;
  }

  /**
   * Create download link for transcript (fallback)
   */
  _createDownloadLink(transcript, format) {
    try {
      let content, mimeType, filename;
      
      switch (format) {
        case 'txt':
          content = this._formatTranscriptAsText(transcript);
          mimeType = 'text/plain';
          filename = `transcript-${transcript.meetingId || 'meeting'}.txt`;
          break;
        case 'json':
          content = JSON.stringify(transcript, null, 2);
          mimeType = 'application/json';
          filename = `transcript-${transcript.meetingId || 'meeting'}.json`;
          break;
        default:
          throw new Error(`Unsupported format: ${format}`);
      }
      
      const blob = new Blob([content], { type: mimeType });
      const url = URL.createObjectURL(blob);
      
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      link.style.display = 'none';
      
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      URL.revokeObjectURL(url);
      return true;
    } catch (error) {
      console.error('Failed to create download link:', error);
      return false;
    }
  }

  /**
   * Format transcript as plain text
   */
  _formatTranscriptAsText(transcript) {
    const lines = [];
    
    if (transcript.meetingInfo) {
      lines.push(`Meeting: ${transcript.meetingInfo.title}`);
      lines.push(`Date: ${new Date(transcript.meetingInfo.startTime).toLocaleString()}`);
      lines.push(`Platform: Google Meet`);
      lines.push('');
    }
    
    if (transcript.segments && transcript.segments.length > 0) {
      lines.push('Transcript:');
      lines.push('----------');
      
      transcript.segments.forEach(segment => {
        const timestamp = new Date(segment.startTime).toLocaleTimeString();
        const speaker = segment.speakerId || 'Unknown Speaker';
        lines.push(`[${timestamp}] ${speaker}: ${segment.text}`);
      });
    }
    
    return lines.join('\n');
  }

  /**
   * Cleanup resources
   */
  async cleanup() {
    if (this.audioStream) {
      this.audioStream.getTracks().forEach(track => track.stop());
      this.audioStream = null;
    }
    
    await super.cleanup();
  }
}