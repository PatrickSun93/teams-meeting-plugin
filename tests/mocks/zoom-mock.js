// Mock Zoom SDK for testing
(function() {
  'use strict';

  // Mock Zoom Meeting SDK
  window.ZoomMtg = {
    init: function(config) {
      setTimeout(() => {
        if (config.success) {
          config.success();
        }
      }, 100);
    },

    join: function(config) {
      setTimeout(() => {
        if (config.success) {
          config.success();
        }
      }, 200);
    },

    getMeetingInfo: function() {
      return Promise.resolve({
        meetingId: 'mock-zoom-meeting-456',
        meetingTopic: 'Mock Zoom Meeting',
        hostId: 'zoom-host-123',
        participants: [
          { userId: 'user1', displayName: 'John Doe' },
          { userId: 'user2', displayName: 'Jane Smith' }
        ]
      });
    },

    getAudioStream: function() {
      return Promise.resolve(new MediaStream());
    },

    sendChatMessage: function(message) {
      window.mockPlatformAPI = window.mockPlatformAPI || { chatMessages: [] };
      window.mockPlatformAPI.chatMessages.push({
        content: message,
        timestamp: Date.now(),
        platform: 'zoom'
      });
      return Promise.resolve({ success: true });
    },

    getCurrentUser: function() {
      return Promise.resolve({
        userId: 'current-user-123',
        displayName: 'Current User',
        isHost: false
      });
    },

    getParticipantsList: function() {
      return Promise.resolve([
        { userId: 'user1', displayName: 'John Doe', isHost: true },
        { userId: 'user2', displayName: 'Jane Smith', isHost: false },
        { userId: 'user3', displayName: 'Bob Wilson', isHost: false }
      ]);
    }
  };

  // Mock Zoom REST API
  window.ZoomAPI = {
    getMeeting: function(meetingId) {
      return Promise.resolve({
        id: meetingId,
        topic: 'Mock Zoom Meeting',
        start_time: new Date().toISOString(),
        duration: 60,
        host_id: 'zoom-host-123'
      });
    },

    getRecordings: function(meetingId) {
      return Promise.resolve({
        meetings: [{
          meeting_id: meetingId,
          recording_files: [
            {
              id: 'recording-123',
              file_type: 'MP4',
              file_size: 1024000,
              download_url: 'https://zoom.us/rec/download/recording-123'
            }
          ]
        }]
      });
    }
  };

  // Mock Zoom meeting container
  const zoomContainer = document.createElement('div');
  zoomContainer.setAttribute('data-testid', 'zoom-meeting-container');
  zoomContainer.style.display = 'block';
  zoomContainer.style.width = '100%';
  zoomContainer.style.height = '100vh';
  document.body.appendChild(zoomContainer);

  // Mock Zoom-specific controls
  const zoomControls = document.createElement('div');
  zoomControls.setAttribute('data-testid', 'zoom-controls');
  zoomControls.innerHTML = `
    <button data-testid="zoom-mute">Mute</button>
    <button data-testid="zoom-video">Video</button>
    <button data-testid="zoom-share">Share Screen</button>
    <button data-testid="zoom-record">Record</button>
  `;
  zoomContainer.appendChild(zoomControls);

  // Initialize Universal Transcription Plugin for Zoom
  window.UniversalTranscriptionPlugin = class {
    constructor() {
      this.platform = 'zoom';
      this.isInitialized = false;
    }

    detectPlatform() {
      return 'Zoom';
    }

    async initialize() {
      return new Promise((resolve) => {
        window.ZoomMtg.init({
          success: () => {
            this.isInitialized = true;
            resolve(true);
          },
          error: (error) => {
            console.error('Zoom initialization failed:', error);
            resolve(false);
          }
        });
      });
    }

    async getAudioStream() {
      return await window.ZoomMtg.getAudioStream();
    }

    async sendToChat(message) {
      return await window.ZoomMtg.sendChatMessage(message);
    }

    async getMeetingInfo() {
      return await window.ZoomMtg.getMeetingInfo();
    }
  };

  // Mock audio input functionality
  window.mockAudioInput = function(text) {
    const event = new CustomEvent('mockTranscription', {
      detail: {
        text: text,
        platform: 'zoom',
        timestamp: Date.now()
      }
    });
    document.dispatchEvent(event);
  };

  // Mock multiple speakers
  window.mockMultipleSpeakers = function(speakers) {
    speakers.forEach((speaker, index) => {
      setTimeout(() => {
        const event = new CustomEvent('mockTranscription', {
          detail: {
            text: speaker.text,
            speaker: speaker.name,
            platform: 'zoom',
            timestamp: Date.now()
          }
        });
        document.dispatchEvent(event);
      }, index * 1000);
    });
  };

  // Mock meeting content
  window.mockMeetingContent = function(contentArray) {
    contentArray.forEach((content, index) => {
      setTimeout(() => {
        const event = new CustomEvent('mockTranscription', {
          detail: {
            text: content,
            speaker: `Speaker ${(index % 3) + 1}`,
            platform: 'zoom',
            timestamp: Date.now()
          }
        });
        document.dispatchEvent(event);
      }, index * 500);
    });
  };

  // Mock standardized audio for consistency testing
  window.mockStandardizedAudio = function(text) {
    const event = new CustomEvent('mockTranscription', {
      detail: {
        text: text,
        confidence: 0.92,
        platform: 'zoom',
        timestamp: Date.now()
      }
    });
    document.dispatchEvent(event);
  };

  // Mock platform API for testing
  window.mockPlatformAPI = {
    chatMessages: [],
    getChatMessages: function() {
      return this.chatMessages;
    },
    clearChatMessages: function() {
      this.chatMessages = [];
    }
  };

  console.log('Zoom mock initialized');
})();