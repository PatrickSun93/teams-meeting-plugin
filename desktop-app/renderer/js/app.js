// Main application controller
class DesktopApp {
  constructor() {
    this.isRecording = false;
    this.currentMeeting = null;
    this.config = null;
    this.platformInfo = null;
    this.audioDevices = [];
    this.transcript = [];
    
    this.init();
  }

  async init() {
    try {
      // Load configuration
      await this.loadConfig();
      
      // Initialize UI
      this.initializeUI();
      
      // Set up event listeners
      this.setupEventListeners();
      
      // Load audio devices
      await this.loadAudioDevices();
      
      // Detect platform
      await this.detectPlatform();
      
      // Set up menu handlers
      this.setupMenuHandlers();
      
      console.log('Desktop app initialized');
    } catch (error) {
      console.error('Failed to initialize app:', error);
      this.showNotification('Failed to initialize application', 'error');
    }
  }

  async loadConfig() {
    try {
      this.config = await window.electronAPI.getConfig();
      this.applyConfigToUI();
    } catch (error) {
      console.error('Failed to load configuration:', error);
    }
  }

  initializeUI() {
    // Set app version
    const versionElement = document.getElementById('appVersion');
    if (versionElement) {
      window.electronAPI.getAppVersion().then(version => {
        versionElement.textContent = `v${version}`;
      });
    }

    // Initialize platform indicator
    this.updatePlatformIndicator();
    
    // Initialize recording status
    this.updateRecordingStatus();
    
    // Initialize transcription provider display
    this.updateTranscriptionProvider();
  }

  setupEventListeners() {
    // Recording controls
    document.getElementById('startBtn').addEventListener('click', () => this.startRecording());
    document.getElementById('stopBtn').addEventListener('click', () => this.stopRecording());
    
    // Platform controls
    document.getElementById('platformSelect').addEventListener('change', (e) => this.handlePlatformChange(e));
    document.getElementById('detectBtn').addEventListener('click', () => this.detectPlatform());
    
    // Audio device selection
    document.getElementById('audioDeviceSelect').addEventListener('change', (e) => this.handleAudioDeviceChange(e));
    
    // Transcript controls
    document.getElementById('clearTranscriptBtn').addEventListener('click', () => this.clearTranscript());
    document.getElementById('exportTranscriptBtn').addEventListener('click', () => this.exportTranscript());
    
    // Settings
    document.getElementById('settingsBtn').addEventListener('click', () => this.openSettings());
    
    // Electron API event listeners
    window.electronAPI.onTranscriptUpdate((transcript) => this.handleTranscriptUpdate(transcript));
    window.electronAPI.onUpdateAvailable(() => this.handleUpdateAvailable());
    window.electronAPI.onUpdateDownloaded(() => this.handleUpdateDownloaded());
  }

  setupMenuHandlers() {
    // Menu action handlers
    window.electronAPI.onMenuAction('new-meeting', () => this.startRecording());
    window.electronAPI.onMenuAction('start-recording', () => this.startRecording());
    window.electronAPI.onMenuAction('stop-recording', () => this.stopRecording());
    window.electronAPI.onMenuAction('export', () => this.exportTranscript());
    window.electronAPI.onMenuAction('platform-settings', () => this.openSettings());
    
    window.electronAPI.onOpenMeeting((meetingId) => this.openMeeting(meetingId));
  }

  async loadAudioDevices() {
    try {
      this.audioDevices = await window.electronAPI.getAudioDevices();
      this.populateAudioDeviceSelect();
    } catch (error) {
      console.error('Failed to load audio devices:', error);
    }
  }

  populateAudioDeviceSelect() {
    const select = document.getElementById('audioDeviceSelect');
    select.innerHTML = '';
    
    this.audioDevices.forEach(device => {
      const option = document.createElement('option');
      option.value = device.id;
      option.textContent = device.name;
      if (device.isDefault) {
        option.selected = true;
      }
      select.appendChild(option);
    });
  }

  async detectPlatform() {
    try {
      this.platformInfo = await window.electronAPI.detectPlatform();
      this.updatePlatformIndicator();
      this.updatePlatformSelect();
    } catch (error) {
      console.error('Platform detection failed:', error);
      this.showNotification('Platform detection failed', 'warning');
    }
  }

  updatePlatformIndicator() {
    const indicator = document.getElementById('platformIndicator');
    const nameElement = indicator.querySelector('.platform-name');
    const statusElement = indicator.querySelector('.platform-status');
    
    if (this.platformInfo) {
      nameElement.textContent = this.platformInfo.name;
      statusElement.className = 'platform-status detected';
      statusElement.title = `Confidence: ${Math.round(this.platformInfo.confidence * 100)}%`;
    } else {
      nameElement.textContent = 'No Platform Detected';
      statusElement.className = 'platform-status';
      statusElement.title = 'No meeting platform detected';
    }
  }

  updatePlatformSelect() {
    const select = document.getElementById('platformSelect');
    if (this.platformInfo && !this.platformInfo.isManual) {
      select.value = this.platformInfo.id;
    }
  }

  updateRecordingStatus() {
    const statusElement = document.getElementById('recordingStatus');
    const startBtn = document.getElementById('startBtn');
    const stopBtn = document.getElementById('stopBtn');
    
    if (this.isRecording) {
      statusElement.textContent = 'Recording';
      statusElement.className = 'status-item recording';
      startBtn.disabled = true;
      stopBtn.disabled = false;
    } else {
      statusElement.textContent = 'Ready';
      statusElement.className = 'status-item';
      startBtn.disabled = false;
      stopBtn.disabled = true;
    }
  }

  updateTranscriptionProvider() {
    const providerElement = document.getElementById('transcriptionProvider');
    if (this.config && this.config.transcription) {
      const provider = this.config.transcription.provider;
      const providerNames = {
        local: 'Local STT',
        openai: 'OpenAI',
        azure: 'Azure',
        claude: 'Claude'
      };
      providerElement.textContent = providerNames[provider] || provider;
    }
  }

  async startRecording() {
    if (this.isRecording) {
      return;
    }

    try {
      const options = {
        platform: this.platformInfo?.id || 'generic',
        enableScreenAnalysis: this.config?.advanced?.enableScreenAnalysis || false
      };

      const result = await window.electronAPI.startMeetingTranscription(options);
      
      if (result.success) {
        this.isRecording = true;
        this.currentMeeting = { id: result.meetingId };
        this.updateRecordingStatus();
        this.showNotification('Recording started', 'success');
      } else {
        this.showNotification(`Failed to start recording: ${result.error}`, 'error');
      }
    } catch (error) {
      console.error('Failed to start recording:', error);
      this.showNotification('Failed to start recording', 'error');
    }
  }

  async stopRecording() {
    if (!this.isRecording) {
      return;
    }

    try {
      const result = await window.electronAPI.stopMeetingTranscription();
      
      if (result.success) {
        this.isRecording = false;
        this.currentMeeting = null;
        this.updateRecordingStatus();
        this.showNotification('Recording stopped', 'success');
        
        if (result.meeting) {
          this.showMeetingSummary(result.meeting);
        }
      } else {
        this.showNotification(`Failed to stop recording: ${result.error}`, 'error');
      }
    } catch (error) {
      console.error('Failed to stop recording:', error);
      this.showNotification('Failed to stop recording', 'error');
    }
  }

  handleTranscriptUpdate(transcript) {
    this.transcript.push(transcript);
    this.displayTranscript(transcript);
  }

  displayTranscript(transcript) {
    const container = document.getElementById('transcriptContainer');
    
    // Remove placeholder if it exists
    const placeholder = container.querySelector('.transcript-placeholder');
    if (placeholder) {
      placeholder.remove();
    }

    // Create transcript item
    const item = document.createElement('div');
    item.className = 'transcript-item';
    item.innerHTML = `
      <div class="transcript-header">
        <span class="speaker-name">${transcript.speaker}</span>
        <span class="timestamp">${new Date(transcript.timestamp).toLocaleTimeString()}</span>
        <span class="confidence">Confidence: ${Math.round(transcript.confidence * 100)}%</span>
      </div>
      <div class="transcript-text">${transcript.text}</div>
    `;

    container.appendChild(item);
    
    // Auto-scroll to bottom
    container.scrollTop = container.scrollHeight;
  }

  clearTranscript() {
    this.transcript = [];
    const container = document.getElementById('transcriptContainer');
    container.innerHTML = `
      <div class="transcript-placeholder">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="currentColor" opacity="0.3">
          <path d="M12,2A3,3 0 0,1 15,5V11A3,3 0 0,1 12,14A3,3 0 0,1 9,11V5A3,3 0 0,1 12,2M19,11C19,14.53 16.39,17.44 13,17.93V21H11V17.93C7.61,17.44 5,14.53 5,11H7A5,5 0 0,0 12,16A5,5 0 0,0 17,11H19Z"/>
        </svg>
        <p>Start recording to see live transcription</p>
      </div>
    `;
  }

  async exportTranscript() {
    if (this.transcript.length === 0) {
      this.showNotification('No transcript to export', 'warning');
      return;
    }

    try {
      const options = {
        meetingId: this.currentMeeting?.id || 'current',
        format: this.config?.export?.defaultFormat || 'txt'
      };

      const result = await window.electronAPI.exportTranscript(options);
      
      if (result.success) {
        this.showNotification('Transcript exported successfully', 'success');
        
        // Option to show in folder
        const showInFolder = confirm('Transcript exported successfully. Would you like to show it in the folder?');
        if (showInFolder) {
          window.electronAPI.showInFolder(result.filePath);
        }
      } else {
        this.showNotification(`Export failed: ${result.error}`, 'error');
      }
    } catch (error) {
      console.error('Export failed:', error);
      this.showNotification('Export failed', 'error');
    }
  }

  async handlePlatformChange(event) {
    const selectedPlatform = event.target.value;
    
    if (selectedPlatform === 'auto') {
      await this.detectPlatform();
    } else {
      try {
        this.platformInfo = await window.electronAPI.setManualPlatform(selectedPlatform);
        this.updatePlatformIndicator();
      } catch (error) {
        console.error('Failed to set manual platform:', error);
        this.showNotification('Failed to set platform', 'error');
      }
    }
  }

  async handleAudioDeviceChange(event) {
    const deviceId = event.target.value;
    // TODO: Implement audio device change
    console.log('Audio device changed to:', deviceId);
  }

  openSettings() {
    const modal = document.getElementById('settingsModal');
    modal.classList.add('active');
    
    // Load current settings into the modal
    this.loadSettingsIntoModal();
  }

  loadSettingsIntoModal() {
    if (!this.config) return;

    // Transcription settings
    document.getElementById('sttProvider').value = this.config.transcription?.provider || 'local';
    document.getElementById('language').value = this.config.transcription?.language || 'en';
    document.getElementById('enableSpeakerDiarization').checked = this.config.transcription?.enableSpeakerDiarization || false;

    // Audio settings
    document.getElementById('sampleRate').value = this.config.audio?.sampleRate || 16000;
    document.getElementById('enableNoiseReduction').checked = this.config.audio?.enableNoiseReduction || false;
    document.getElementById('audioQuality').value = this.config.audio?.audioQuality || 'high';

    // Platform settings
    document.getElementById('autoDetection').checked = this.config.platform?.autoDetection || true;
    document.getElementById('enableScreenAnalysis').checked = this.config.advanced?.enableScreenAnalysis || false;
    document.getElementById('detectionInterval').value = this.config.platform?.detectionInterval || 5000;

    // Export settings
    document.getElementById('defaultFormat').value = this.config.export?.defaultFormat || 'txt';
    document.getElementById('includeTimestamps').checked = this.config.export?.includeTimestamps || true;
    document.getElementById('includeSpeakerLabels').checked = this.config.export?.includeSpeakerLabels || true;

    // Privacy settings
    document.getElementById('enableLocalProcessing').checked = this.config.privacy?.enableLocalProcessing || true;
    document.getElementById('dataRetentionDays').value = this.config.privacy?.dataRetentionDays || 30;
    document.getElementById('enableAnalytics').checked = this.config.privacy?.enableAnalytics || false;

    // Advanced settings
    document.getElementById('enableDebugLogging').checked = this.config.advanced?.enableDebugLogging || false;
    document.getElementById('maxConcurrentTranscriptions').value = this.config.advanced?.maxConcurrentTranscriptions || 1;
  }

  applyConfigToUI() {
    this.updateTranscriptionProvider();
    // Apply other config-based UI updates
  }

  showMeetingSummary(meeting) {
    const transcriptCount = meeting.transcript?.length || 0;
    const duration = meeting.endTime ? 
      Math.round((new Date(meeting.endTime) - new Date(meeting.startTime)) / 1000 / 60) : 0;
    
    const message = `Meeting completed!\n\nDuration: ${duration} minutes\nTranscript segments: ${transcriptCount}\n\nWould you like to export the transcript?`;
    
    if (confirm(message)) {
      this.exportTranscript();
    }
  }

  async openMeeting(meetingId) {
    try {
      const meetings = await window.electronAPI.getMeetingHistory();
      const meeting = meetings.find(m => m.id === meetingId);
      
      if (meeting) {
        // Load meeting transcript
        this.transcript = meeting.transcript || [];
        this.displayMeetingTranscript();
      }
    } catch (error) {
      console.error('Failed to open meeting:', error);
      this.showNotification('Failed to open meeting', 'error');
    }
  }

  displayMeetingTranscript() {
    const container = document.getElementById('transcriptContainer');
    container.innerHTML = '';
    
    this.transcript.forEach(transcript => {
      this.displayTranscript(transcript);
    });
  }

  handleUpdateAvailable() {
    this.showNotification('Update available! It will be downloaded in the background.', 'info');
  }

  handleUpdateDownloaded() {
    const restart = confirm('Update downloaded. Restart now to apply the update?');
    if (restart) {
      // The main process will handle the restart
      window.electronAPI.checkForUpdates();
    }
  }

  showNotification(message, type = 'info') {
    const container = document.getElementById('notifications');
    
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `
      <span class="notification-message">${message}</span>
      <button class="notification-close">&times;</button>
    `;
    
    // Add close handler
    notification.querySelector('.notification-close').addEventListener('click', () => {
      notification.remove();
    });
    
    container.appendChild(notification);
    
    // Auto-remove after 5 seconds
    setTimeout(() => {
      if (notification.parentNode) {
        notification.remove();
      }
    }, 5000);
  }
}

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  window.app = new DesktopApp();
});