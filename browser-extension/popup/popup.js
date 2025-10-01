/**
 * Popup JavaScript for Google Meet Extension
 * Handles popup UI interactions and communication with background script
 */

class PopupController {
  constructor() {
    this.isTranscribing = false;
    this.meetingStatus = 'not-in-meeting';
    this.config = {};
    this.recentTranscripts = [];
    
    this.init();
  }

  async init() {
    console.log('Popup initialized');
    
    // Load initial data
    await this.loadConfiguration();
    await this.loadMeetingStatus();
    await this.loadRecentTranscripts();
    
    // Set up event listeners
    this.setupEventListeners();
    
    // Update UI
    this.updateUI();
  }

  setupEventListeners() {
    // Settings button
    document.getElementById('settings-btn').addEventListener('click', () => {
      this.openSettings();
    });

    // Transcription toggle
    document.getElementById('transcription-toggle').addEventListener('click', () => {
      this.toggleTranscription();
    });

    // Show panel button
    document.getElementById('show-panel').addEventListener('click', () => {
      this.showTranscriptionPanel();
    });

    // Footer buttons
    document.getElementById('help-btn').addEventListener('click', () => {
      this.openHelp();
    });

    document.getElementById('feedback-btn').addEventListener('click', () => {
      this.openFeedback();
    });

    document.getElementById('privacy-btn').addEventListener('click', () => {
      this.openPrivacy();
    });

    // Listen for background messages
    chrome.runtime.onMessage.addListener(this.handleMessage.bind(this));
  }

  async loadConfiguration() {
    try {
      const response = await chrome.runtime.sendMessage({ type: 'GET_CONFIGURATION' });
      if (response.success) {
        this.config = response.config;
        this.updateConfigurationDisplay();
      }
    } catch (error) {
      console.error('Failed to load configuration:', error);
    }
  }

  async loadMeetingStatus() {
    try {
      // Check if we're on a Meet page
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      const currentTab = tabs[0];
      
      if (currentTab && currentTab.url && currentTab.url.includes('meet.google.com')) {
        this.meetingStatus = 'in-meeting';
        
        // Try to get meeting info from content script
        try {
          const response = await chrome.tabs.sendMessage(currentTab.id, { type: 'GET_MEETING_INFO' });
          if (response && response.success) {
            this.updateMeetingInfo(response.meetingInfo);
          }
        } catch (error) {
          console.log('Could not get meeting info from content script');
        }
      } else {
        this.meetingStatus = 'not-in-meeting';
      }
    } catch (error) {
      console.error('Failed to load meeting status:', error);
    }
  }

  async loadRecentTranscripts() {
    try {
      const storage = await chrome.storage.local.get();
      const transcripts = [];
      
      // Find transcript entries
      Object.keys(storage).forEach(key => {
        if (key.startsWith('transcript_')) {
          transcripts.push(storage[key]);
        }
      });
      
      // Sort by date (newest first)
      transcripts.sort((a, b) => new Date(b.savedAt) - new Date(a.savedAt));
      
      this.recentTranscripts = transcripts.slice(0, 5); // Keep only 5 most recent
      this.updateTranscriptsList();
    } catch (error) {
      console.error('Failed to load recent transcripts:', error);
    }
  }

  updateUI() {
    this.updateMeetingStatus();
    this.updateTranscriptionButton();
    this.updateConfigurationDisplay();
    this.updateTranscriptsList();
  }

  updateMeetingStatus() {
    const statusIndicator = document.getElementById('status-indicator');
    const statusText = document.getElementById('status-text');
    const meetingInfo = document.getElementById('meeting-info');

    statusIndicator.className = 'status-indicator';
    
    switch (this.meetingStatus) {
      case 'in-meeting':
        statusIndicator.classList.add('in-meeting');
        statusText.textContent = 'In Google Meet';
        meetingInfo.textContent = 'Ready to transcribe';
        break;
      
      case 'recording':
        statusIndicator.classList.add('recording');
        statusText.textContent = 'Recording';
        meetingInfo.textContent = 'Transcription active';
        break;
      
      default:
        statusText.textContent = 'Not in meeting';
        meetingInfo.textContent = 'Join a Google Meet to start';
        break;
    }
  }

  updateTranscriptionButton() {
    const toggleBtn = document.getElementById('transcription-toggle');
    const btnText = toggleBtn.querySelector('span');
    
    toggleBtn.disabled = this.meetingStatus === 'not-in-meeting';
    
    if (this.isTranscribing) {
      toggleBtn.classList.add('active');
      btnText.textContent = 'Stop Transcription';
    } else {
      toggleBtn.classList.remove('active');
      btnText.textContent = 'Start Transcription';
    }
  }

  updateConfigurationDisplay() {
    const sttProvider = document.getElementById('stt-provider');
    const aiProvider = document.getElementById('ai-provider');
    const autoStart = document.getElementById('auto-start');

    sttProvider.textContent = this.formatProviderName(this.config.sttProvider || 'local_whisper');
    aiProvider.textContent = this.formatProviderName(this.config.aiProvider || 'openai_gpt');
    autoStart.textContent = this.config.autoStartTranscription ? 'Enabled' : 'Disabled';
  }

  updateTranscriptsList() {
    const transcriptList = document.getElementById('transcript-list');
    
    if (this.recentTranscripts.length === 0) {
      transcriptList.innerHTML = '<div class="no-transcripts">No recent transcripts</div>';
      return;
    }

    transcriptList.innerHTML = this.recentTranscripts.map(transcript => `
      <div class="transcript-item" data-transcript-id="${transcript.meetingId}">
        <div class="transcript-title">${transcript.meetingTitle || 'Google Meet'}</div>
        <div class="transcript-meta">${this.formatDate(transcript.savedAt)}</div>
      </div>
    `).join('');

    // Add click listeners to transcript items
    transcriptList.querySelectorAll('.transcript-item').forEach(item => {
      item.addEventListener('click', () => {
        const transcriptId = item.dataset.transcriptId;
        this.openTranscript(transcriptId);
      });
    });
  }

  updateMeetingInfo(meetingInfo) {
    const meetingInfoElement = document.getElementById('meeting-info');
    if (meetingInfo && meetingInfo.title) {
      meetingInfoElement.textContent = meetingInfo.title;
    }
  }

  async toggleTranscription() {
    if (this.meetingStatus === 'not-in-meeting') {
      return;
    }

    try {
      if (!this.isTranscribing) {
        // Start transcription
        const response = await chrome.runtime.sendMessage({ type: 'START_TRANSCRIPTION' });
        
        if (response.success) {
          this.isTranscribing = true;
          this.meetingStatus = 'recording';
          this.updateUI();
        } else {
          this.showError('Failed to start transcription: ' + response.error);
        }
      } else {
        // Stop transcription
        const response = await chrome.runtime.sendMessage({ type: 'STOP_TRANSCRIPTION' });
        
        this.isTranscribing = false;
        this.meetingStatus = 'in-meeting';
        this.updateUI();
      }
    } catch (error) {
      this.showError('Failed to toggle transcription: ' + error.message);
    }
  }

  async showTranscriptionPanel() {
    try {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      const currentTab = tabs[0];
      
      if (currentTab && currentTab.url && currentTab.url.includes('meet.google.com')) {
        await chrome.tabs.sendMessage(currentTab.id, { type: 'SHOW_TRANSCRIPTION_PANEL' });
        window.close(); // Close popup
      } else {
        this.showError('Please navigate to a Google Meet page first');
      }
    } catch (error) {
      this.showError('Failed to show transcription panel: ' + error.message);
    }
  }

  openSettings() {
    chrome.runtime.openOptionsPage();
    window.close();
  }

  openHelp() {
    chrome.tabs.create({ url: 'https://support.google.com/meet/answer/transcription' });
    window.close();
  }

  openFeedback() {
    chrome.tabs.create({ url: 'mailto:feedback@example.com?subject=Meeting Transcription Feedback' });
    window.close();
  }

  openPrivacy() {
    chrome.tabs.create({ url: 'https://example.com/privacy-policy' });
    window.close();
  }

  async openTranscript(transcriptId) {
    try {
      // Get transcript data from storage
      const storage = await chrome.storage.local.get();
      const transcriptKey = Object.keys(storage).find(key => 
        key.startsWith('transcript_') && storage[key].meetingId === transcriptId
      );
      
      if (transcriptKey) {
        const transcript = storage[transcriptKey];
        
        // Create a new tab with transcript viewer
        const transcriptUrl = chrome.runtime.getURL(`transcript-viewer.html?id=${transcriptId}`);
        chrome.tabs.create({ url: transcriptUrl });
        window.close();
      }
    } catch (error) {
      this.showError('Failed to open transcript: ' + error.message);
    }
  }

  handleMessage(message, sender, sendResponse) {
    switch (message.type) {
      case 'MEETING_STATUS_CHANGED':
        this.meetingStatus = message.data.status;
        this.updateUI();
        break;
      
      case 'TRANSCRIPTION_STATUS_CHANGED':
        this.isTranscribing = message.data.isTranscribing;
        this.updateUI();
        break;
      
      case 'CONFIG_CHANGED':
        this.loadConfiguration();
        break;
      
      case 'NEW_TRANSCRIPT_SAVED':
        this.loadRecentTranscripts();
        break;
    }
  }

  formatProviderName(provider) {
    const providerNames = {
      'local_whisper': 'Local Whisper',
      'openai_whisper': 'OpenAI Whisper',
      'azure_speech': 'Azure Speech',
      'openai_gpt': 'OpenAI GPT',
      'claude': 'Claude',
      'azure_openai': 'Azure OpenAI'
    };
    
    return providerNames[provider] || provider;
  }

  formatDate(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) {
      return 'Just now';
    } else if (diffMins < 60) {
      return `${diffMins} min ago`;
    } else if (diffHours < 24) {
      return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    } else if (diffDays < 7) {
      return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    } else {
      return date.toLocaleDateString();
    }
  }

  showError(message) {
    // Create temporary error display
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error';
    errorDiv.textContent = message;
    errorDiv.style.cssText = `
      position: fixed;
      top: 10px;
      left: 10px;
      right: 10px;
      background: #fce8e6;
      color: #d93025;
      padding: 8px 12px;
      border-radius: 4px;
      font-size: 12px;
      z-index: 1000;
    `;
    
    document.body.appendChild(errorDiv);
    
    setTimeout(() => {
      errorDiv.remove();
    }, 3000);
  }
}

// Initialize popup when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  new PopupController();
});