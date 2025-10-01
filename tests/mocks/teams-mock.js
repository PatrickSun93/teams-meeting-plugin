// Mock Teams SDK for testing
(function() {
  'use strict';

  // Mock Microsoft Teams SDK
  window.microsoftTeams = {
    app: {
      initialize: function() {
        return Promise.resolve();
      },
      
      getContext: function() {
        return Promise.resolve({
          app: {
            host: {
              name: 'Teams',
              clientType: 'desktop'
            }
          },
          meeting: {
            id: 'mock-teams-meeting-123',
            organizer: {
              id: 'organizer-id',
              displayName: 'Meeting Organizer'
            }
          },
          user: {
            id: 'user-123',
            displayName: 'Test User',
            userPrincipalName: 'test@example.com'
          },
          page: {
            id: 'meeting-tab',
            frameContext: 'meetingTab'
          }
        });
      },

      notifySuccess: function() {},
      notifyFailure: function() {}
    },

    authentication: {
      getAuthToken: function() {
        return Promise.resolve('mock-teams-auth-token');
      }
    },

    meeting: {
      getMeetingDetails: function() {
        return Promise.resolve({
          details: {
            id: 'mock-teams-meeting-123',
            title: 'Mock Teams Meeting',
            startTime: new Date().toISOString(),
            organizer: {
              id: 'organizer-id',
              displayName: 'Meeting Organizer'
            }
          }
        });
      },

      shareAppContentToStage: function() {
        return Promise.resolve();
      }
    },

    chat: {
      sendMessage: function(message) {
        window.mockPlatformAPI = window.mockPlatformAPI || { chatMessages: [] };
        window.mockPlatformAPI.chatMessages.push({
          content: message.content || message,
          timestamp: Date.now(),
          platform: 'teams'
        });
        return Promise.resolve({ success: true });
      }
    },

    media: {
      getAudioStream: function() {
        return Promise.resolve(new MediaStream());
      }
    }
  };

  // Mock Teams meeting container
  const teamsContainer = document.createElement('div');
  teamsContainer.setAttribute('data-testid', 'teams-meeting-container');
  teamsContainer.style.display = 'block';
  teamsContainer.style.width = '100%';
  teamsContainer.style.height = '100vh';
  document.body.appendChild(teamsContainer);

  // Mock Teams-specific controls
  const teamsControls = document.createElement('div');
  teamsControls.setAttribute('data-testid', 'teams-controls');
  teamsControls.innerHTML = `
    <button data-testid="teams-mute">Mute</button>
    <button data-testid="teams-camera">Camera</button>
    <button data-testid="teams-share">Share</button>
  `;
  teamsContainer.appendChild(teamsControls);

  // Initialize Universal Transcription Plugin for Teams
  window.UniversalTranscriptionPlugin = class {
    constructor() {
      this.platform = 'teams';
      this.isInitialized = false;
    }

    detectPlatform() {
      return 'Teams';
    }

    async initialize() {
      await window.microsoftTeams.app.initialize();
      this.isInitialized = true;
      return true;
    }

    async getAudioStream() {
      return await window.microsoftTeams.media.getAudioStream();
    }

    async sendToChat(message) {
      return await window.microsoftTeams.chat.sendMessage(message);
    }
  };

  // Mock audio input functionality
  window.mockAudioInput = function(text) {
    const event = new CustomEvent('mockTranscription', {
      detail: {
        text: text,
        platform: 'teams',
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
            platform: 'teams',
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
            platform: 'teams',
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
        confidence: 0.95,
        platform: 'teams',
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

  console.log('Teams mock initialized');
})();