// Mock Google Meet environment for testing
(function() {
  'use strict';

  // Mock Chrome extension API
  window.chrome = {
    runtime: {
      id: 'mock-extension-id-123',
      sendMessage: function(message, callback) {
        setTimeout(() => {
          if (callback) {
            callback({
              success: true,
              data: message
            });
          }
        }, 50);
      },
      onMessage: {
        addListener: function(callback) {
          // Mock message listener
        }
      }
    },
    storage: {
      local: {
        get: function(keys, callback) {
          const mockData = {
            'meet-config': {
              transcriptionEnabled: true,
              language: 'en-US'
            }
          };
          callback(mockData);
        },
        set: function(data, callback) {
          if (callback) callback();
        }
      }
    },
    tabs: {
      query: function(queryInfo, callback) {
        callback([{
          id: 1,
          url: 'https://meet.google.com/abc-defg-hij',
          title: 'Mock Google Meet'
        }]);
      }
    }
  };

  // Mock Google APIs
  window.gapi = {
    load: function(api, callback) {
      setTimeout(() => {
        if (callback.callback) {
          callback.callback();
        } else if (typeof callback === 'function') {
          callback();
        }
      }, 100);
    },
    client: {
      init: function(config) {
        return Promise.resolve();
      },
      calendar: {
        events: {
          get: function(params) {
            return Promise.resolve({
              result: {
                id: 'calendar-event-123',
                summary: 'Mock Meeting from Calendar',
                description: 'Meeting agenda:\n1. Project updates\n2. Budget review\n3. Next steps',
                start: { dateTime: new Date().toISOString() },
                end: { dateTime: new Date(Date.now() + 3600000).toISOString() },
                attendees: [
                  { email: 'user1@example.com', displayName: 'John Doe' },
                  { email: 'user2@example.com', displayName: 'Jane Smith' }
                ]
              }
            });
          }
        }
      }
    }
  };

  // Mock Google Meet container
  const meetContainer = document.createElement('div');
  meetContainer.setAttribute('data-testid', 'meet-container');
  meetContainer.style.display = 'block';
  meetContainer.style.width = '100%';
  meetContainer.style.height = '100vh';
  document.body.appendChild(meetContainer);

  // Mock Google Meet UI elements
  const meetUI = document.createElement('div');
  meetUI.innerHTML = `
    <div data-testid="meet-controls">
      <button data-testid="meet-mute">Mute</button>
      <button data-testid="meet-camera">Camera</button>
      <button data-testid="meet-present">Present</button>
    </div>
    <div data-testid="meet-participants">
      <div class="participant" data-name="John Doe">John Doe</div>
      <div class="participant" data-name="Jane Smith">Jane Smith</div>
      <div class="participant" data-name="Bob Wilson">Bob Wilson</div>
    </div>
  `;
  meetContainer.appendChild(meetUI);

  // Mock MediaDevices for audio capture
  if (!navigator.mediaDevices) {
    navigator.mediaDevices = {};
  }
  
  navigator.mediaDevices.getUserMedia = function(constraints) {
    return Promise.resolve(new MediaStream());
  };

  // Initialize Universal Transcription Plugin for Google Meet
  window.UniversalTranscriptionPlugin = class {
    constructor() {
      this.platform = 'meet';
      this.isInitialized = false;
    }

    detectPlatform() {
      return 'Google Meet';
    }

    async initialize() {
      // Simulate extension initialization
      if (window.chrome && window.chrome.runtime) {
        this.isInitialized = true;
        return true;
      }
      return false;
    }

    async getAudioStream() {
      return await navigator.mediaDevices.getUserMedia({ audio: true });
    }

    async sendToChat(message) {
      // Google Meet doesn't have chat API, so this would fail
      throw new Error('Chat integration not available for Google Meet');
    }

    async exportTranscript(format) {
      // Mock export functionality
      const blob = new Blob(['Mock transcript content'], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      
      const a = document.createElement('a');
      a.href = url;
      a.download = `transcript.${format}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      return { success: true, format };
    }

    async getMeetingAgenda() {
      // Mock calendar integration
      return await window.gapi.client.calendar.events.get({
        calendarId: 'primary',
        eventId: 'mock-event-id'
      });
    }
  };

  // Mock audio input functionality
  window.mockAudioInput = function(text) {
    const event = new CustomEvent('mockTranscription', {
      detail: {
        text: text,
        platform: 'meet',
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
            platform: 'meet',
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
            platform: 'meet',
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
        confidence: 0.88,
        platform: 'meet',
        timestamp: Date.now()
      }
    });
    document.dispatchEvent(event);
  };

  // Mock platform API for testing (no chat for Meet)
  window.mockPlatformAPI = {
    chatMessages: [], // Empty for Meet since no chat API
    getChatMessages: function() {
      return this.chatMessages;
    },
    clearChatMessages: function() {
      this.chatMessages = [];
    },
    exportOptions: ['pdf', 'docx', 'txt'],
    getExportOptions: function() {
      return this.exportOptions;
    }
  };

  // Mock DOM manipulation for extension
  window.mockDOMInjection = function() {
    const transcriptionPanel = document.createElement('div');
    transcriptionPanel.setAttribute('data-testid', 'meet-transcription-panel');
    transcriptionPanel.innerHTML = `
      <div class="transcription-header">Live Transcription</div>
      <div class="transcription-content" data-testid="transcript-text"></div>
      <div class="transcription-controls">
        <button data-testid="start-transcription">Start</button>
        <button data-testid="stop-transcription">Stop</button>
        <button data-testid="export-transcript">Export</button>
      </div>
    `;
    meetContainer.appendChild(transcriptionPanel);
  };

  // Auto-inject transcription panel
  setTimeout(() => {
    window.mockDOMInjection();
  }, 500);

  console.log('Google Meet mock initialized');
})();