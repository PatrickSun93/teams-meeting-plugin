/**
 * Google Meet UI Injection Content Script
 * Injects transcription controls and display into Google Meet interface
 */

class MeetUIInjector {
  constructor() {
    this.transcriptionPanel = null;
    this.controlsPanel = null;
    this.isTranscribing = false;
    this.transcriptText = '';
    this.config = {};
    
    this.init();
  }

  async init() {
    console.log('UI injector initialized');
    
    // Load configuration
    await this.loadConfiguration();
    
    // Wait for Meet UI to load
    this.waitForMeetUI().then(() => {
      this.injectUI();
    });
    
    // Listen for messages from background
    chrome.runtime.onMessage.addListener(this.handleMessage.bind(this));
  }

  async loadConfiguration() {
    try {
      const response = await chrome.runtime.sendMessage({ type: 'GET_CONFIGURATION' });
      if (response.success) {
        this.config = response.config;
      }
    } catch (error) {
      console.error('Failed to load configuration:', error);
    }
  }

  async waitForMeetUI() {
    return new Promise((resolve) => {
      const checkForUI = () => {
        // Look for Meet's main controls container
        const controlsContainer = document.querySelector('[jsname="BOHaEe"]') || 
                                 document.querySelector('.meeting-controls') ||
                                 document.querySelector('[data-meeting-controls]');
        
        if (controlsContainer) {
          console.log('Meet UI detected');
          resolve();
        } else {
          setTimeout(checkForUI, 500);
        }
      };
      
      checkForUI();
    });
  }

  injectUI() {
    this.injectControlsPanel();
    this.injectTranscriptionPanel();
    this.injectStyles();
  }

  injectControlsPanel() {
    // Find the Meet controls container
    const controlsContainer = document.querySelector('[jsname="BOHaEe"]') || 
                             document.querySelector('.meeting-controls');
    
    if (!controlsContainer) {
      console.warn('Could not find controls container');
      return;
    }

    // Create transcription controls
    this.controlsPanel = document.createElement('div');
    this.controlsPanel.className = 'transcription-controls';
    this.controlsPanel.innerHTML = `
      <button id="transcription-toggle" class="transcription-btn" title="Toggle Transcription">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/>
          <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/>
        </svg>
        <span>Transcribe</span>
      </button>
      
      <button id="transcription-settings" class="transcription-btn" title="Transcription Settings">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
          <path d="M19.14,12.94c0.04-0.3,0.06-0.61,0.06-0.94c0-0.32-0.02-0.64-0.07-0.94l2.03-1.58c0.18-0.14,0.23-0.41,0.12-0.61 l-1.92-3.32c-0.12-0.22-0.37-0.29-0.59-0.22l-2.39,0.96c-0.5-0.38-1.03-0.7-1.62-0.94L14.4,2.81c-0.04-0.24-0.24-0.41-0.48-0.41 h-3.84c-0.24,0-0.43,0.17-0.47,0.41L9.25,5.35C8.66,5.59,8.12,5.92,7.63,6.29L5.24,5.33c-0.22-0.08-0.47,0-0.59,0.22L2.74,8.87 C2.62,9.08,2.66,9.34,2.86,9.48l2.03,1.58C4.84,11.36,4.8,11.69,4.8,12s0.02,0.64,0.07,0.94l-2.03,1.58 c-0.18,0.14-0.23,0.41-0.12,0.61l1.92,3.32c0.12,0.22,0.37,0.29,0.59,0.22l2.39-0.96c0.5,0.38,1.03,0.7,1.62,0.94l0.36,2.54 c0.05,0.24,0.24,0.41,0.48,0.41h3.84c0.24,0,0.44-0.17,0.47-0.41l0.36-2.54c0.59-0.24,1.13-0.56,1.62-0.94l2.39,0.96 c0.22,0.08,0.47,0,0.59-0.22l1.92-3.32c0.12-0.22,0.07-0.47-0.12-0.61L19.14,12.94z M12,15.6c-1.98,0-3.6-1.62-3.6-3.6 s1.62-3.6,3.6-3.6s3.6,1.62,3.6,3.6S13.98,15.6,12,15.6z"/>
        </svg>
      </button>
    `;

    // Insert controls into Meet UI
    controlsContainer.appendChild(this.controlsPanel);

    // Add event listeners
    this.setupControlsEventListeners();
  }

  injectTranscriptionPanel() {
    // Create transcription display panel
    this.transcriptionPanel = document.createElement('div');
    this.transcriptionPanel.className = 'transcription-panel';
    this.transcriptionPanel.innerHTML = `
      <div class="transcription-header">
        <h3>Live Transcription</h3>
        <div class="transcription-status">
          <span class="status-indicator"></span>
          <span class="status-text">Ready</span>
        </div>
        <button class="panel-close" title="Close Panel">×</button>
      </div>
      
      <div class="transcription-content">
        <div class="transcript-display" id="transcript-display">
          <p class="transcript-placeholder">Transcription will appear here when you start recording...</p>
        </div>
        
        <div class="transcription-controls-bottom">
          <button id="clear-transcript" class="control-btn">Clear</button>
          <button id="export-transcript" class="control-btn">Export</button>
          <button id="copy-transcript" class="control-btn">Copy</button>
        </div>
      </div>
    `;

    // Position panel on the right side of the screen
    this.transcriptionPanel.style.cssText = `
      position: fixed;
      top: 80px;
      right: 20px;
      width: 350px;
      height: 400px;
      z-index: 10000;
      display: none;
    `;

    document.body.appendChild(this.transcriptionPanel);
    this.setupPanelEventListeners();
  }

  injectStyles() {
    const styles = document.createElement('style');
    styles.textContent = `
      .transcription-controls {
        display: flex;
        gap: 8px;
        margin-left: 8px;
      }
      
      .transcription-btn {
        display: flex;
        align-items: center;
        gap: 4px;
        padding: 8px 12px;
        background: rgba(255, 255, 255, 0.1);
        border: 1px solid rgba(255, 255, 255, 0.2);
        border-radius: 20px;
        color: white;
        font-size: 14px;
        cursor: pointer;
        transition: all 0.2s ease;
      }
      
      .transcription-btn:hover {
        background: rgba(255, 255, 255, 0.2);
      }
      
      .transcription-btn.active {
        background: #1a73e8;
        border-color: #1a73e8;
      }
      
      .transcription-panel {
        background: white;
        border-radius: 8px;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
        font-family: 'Google Sans', Roboto, Arial, sans-serif;
        overflow: hidden;
      }
      
      .transcription-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 16px;
        background: #f8f9fa;
        border-bottom: 1px solid #e0e0e0;
      }
      
      .transcription-header h3 {
        margin: 0;
        font-size: 16px;
        font-weight: 500;
        color: #202124;
      }
      
      .transcription-status {
        display: flex;
        align-items: center;
        gap: 6px;
      }
      
      .status-indicator {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: #34a853;
      }
      
      .status-indicator.recording {
        background: #ea4335;
        animation: pulse 1s infinite;
      }
      
      @keyframes pulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.5; }
      }
      
      .status-text {
        font-size: 12px;
        color: #5f6368;
      }
      
      .panel-close {
        background: none;
        border: none;
        font-size: 20px;
        cursor: pointer;
        color: #5f6368;
        padding: 0;
        width: 24px;
        height: 24px;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      
      .transcription-content {
        height: calc(100% - 60px);
        display: flex;
        flex-direction: column;
      }
      
      .transcript-display {
        flex: 1;
        padding: 16px;
        overflow-y: auto;
        font-size: 14px;
        line-height: 1.4;
        color: #202124;
      }
      
      .transcript-placeholder {
        color: #5f6368;
        font-style: italic;
        margin: 0;
      }
      
      .transcript-segment {
        margin-bottom: 12px;
        padding: 8px;
        border-radius: 4px;
        background: #f8f9fa;
      }
      
      .speaker-label {
        font-weight: 500;
        color: #1a73e8;
        margin-bottom: 4px;
      }
      
      .transcript-text {
        margin: 0;
      }
      
      .confidence-score {
        font-size: 11px;
        color: #5f6368;
        margin-top: 4px;
      }
      
      .transcription-controls-bottom {
        display: flex;
        gap: 8px;
        padding: 12px 16px;
        border-top: 1px solid #e0e0e0;
        background: #f8f9fa;
      }
      
      .control-btn {
        flex: 1;
        padding: 8px 12px;
        background: white;
        border: 1px solid #dadce0;
        border-radius: 4px;
        font-size: 12px;
        cursor: pointer;
        transition: all 0.2s ease;
      }
      
      .control-btn:hover {
        background: #f8f9fa;
        border-color: #1a73e8;
      }
    `;
    
    document.head.appendChild(styles);
  }

  setupControlsEventListeners() {
    const toggleBtn = this.controlsPanel.querySelector('#transcription-toggle');
    const settingsBtn = this.controlsPanel.querySelector('#transcription-settings');

    toggleBtn.addEventListener('click', () => {
      this.toggleTranscription();
    });

    settingsBtn.addEventListener('click', () => {
      this.openSettings();
    });
  }

  setupPanelEventListeners() {
    const closeBtn = this.transcriptionPanel.querySelector('.panel-close');
    const clearBtn = this.transcriptionPanel.querySelector('#clear-transcript');
    const exportBtn = this.transcriptionPanel.querySelector('#export-transcript');
    const copyBtn = this.transcriptionPanel.querySelector('#copy-transcript');

    closeBtn.addEventListener('click', () => {
      this.hideTranscriptionPanel();
    });

    clearBtn.addEventListener('click', () => {
      this.clearTranscript();
    });

    exportBtn.addEventListener('click', () => {
      this.exportTranscript();
    });

    copyBtn.addEventListener('click', () => {
      this.copyTranscript();
    });
  }

  async toggleTranscription() {
    const toggleBtn = this.controlsPanel.querySelector('#transcription-toggle');
    const statusIndicator = this.transcriptionPanel.querySelector('.status-indicator');
    const statusText = this.transcriptionPanel.querySelector('.status-text');

    if (!this.isTranscribing) {
      // Start transcription
      try {
        const response = await chrome.runtime.sendMessage({ type: 'START_TRANSCRIPTION' });
        
        if (response.success) {
          this.isTranscribing = true;
          toggleBtn.classList.add('active');
          toggleBtn.querySelector('span').textContent = 'Stop';
          
          statusIndicator.classList.add('recording');
          statusText.textContent = 'Recording...';
          
          this.showTranscriptionPanel();
        } else {
          this.showError('Failed to start transcription: ' + response.error);
        }
      } catch (error) {
        this.showError('Failed to start transcription: ' + error.message);
      }
    } else {
      // Stop transcription
      try {
        const response = await chrome.runtime.sendMessage({ type: 'STOP_TRANSCRIPTION' });
        
        this.isTranscribing = false;
        toggleBtn.classList.remove('active');
        toggleBtn.querySelector('span').textContent = 'Transcribe';
        
        statusIndicator.classList.remove('recording');
        statusText.textContent = 'Stopped';
      } catch (error) {
        this.showError('Failed to stop transcription: ' + error.message);
      }
    }
  }

  showTranscriptionPanel() {
    this.transcriptionPanel.style.display = 'block';
  }

  hideTranscriptionPanel() {
    this.transcriptionPanel.style.display = 'none';
  }

  openSettings() {
    // Open extension options page
    chrome.runtime.sendMessage({ type: 'OPEN_OPTIONS_PAGE' });
  }

  addTranscriptSegment(segment) {
    const transcriptDisplay = this.transcriptionPanel.querySelector('#transcript-display');
    const placeholder = transcriptDisplay.querySelector('.transcript-placeholder');
    
    if (placeholder) {
      placeholder.remove();
    }

    const segmentElement = document.createElement('div');
    segmentElement.className = 'transcript-segment';
    segmentElement.innerHTML = `
      <div class="speaker-label">${segment.speaker || 'Unknown Speaker'}</div>
      <p class="transcript-text">${segment.text}</p>
      ${segment.confidence ? `<div class="confidence-score">Confidence: ${Math.round(segment.confidence * 100)}%</div>` : ''}
    `;

    transcriptDisplay.appendChild(segmentElement);
    transcriptDisplay.scrollTop = transcriptDisplay.scrollHeight;
  }

  clearTranscript() {
    const transcriptDisplay = this.transcriptionPanel.querySelector('#transcript-display');
    transcriptDisplay.innerHTML = '<p class="transcript-placeholder">Transcription will appear here when you start recording...</p>';
    this.transcriptText = '';
  }

  async exportTranscript() {
    if (!this.transcriptText) {
      this.showError('No transcript to export');
      return;
    }

    try {
      const response = await chrome.runtime.sendMessage({
        type: 'EXPORT_TRANSCRIPT',
        data: {
          transcript: this.transcriptText,
          meetingId: this.getMeetingId(),
          format: this.config.exportFormat || 'txt'
        }
      });

      if (response.success) {
        this.showSuccess('Transcript exported successfully');
      } else {
        this.showError('Failed to export transcript: ' + response.error);
      }
    } catch (error) {
      this.showError('Failed to export transcript: ' + error.message);
    }
  }

  async copyTranscript() {
    if (!this.transcriptText) {
      this.showError('No transcript to copy');
      return;
    }

    try {
      await navigator.clipboard.writeText(this.transcriptText);
      this.showSuccess('Transcript copied to clipboard');
    } catch (error) {
      this.showError('Failed to copy transcript: ' + error.message);
    }
  }

  handleMessage(message, sender, sendResponse) {
    switch (message.type) {
      case 'TRANSCRIPT_SEGMENT':
        this.addTranscriptSegment(message.data);
        this.transcriptText += `${message.data.speaker}: ${message.data.text}\n`;
        break;
      
      case 'CONFIG_CHANGED':
        this.loadConfiguration();
        break;
    }
  }

  getMeetingId() {
    const url = window.location.href;
    const meetingIdMatch = url.match(/meet\.google\.com\/([a-z0-9-]+)/);
    return meetingIdMatch ? meetingIdMatch[1] : null;
  }

  showError(message) {
    this.showNotification(message, 'error');
  }

  showSuccess(message) {
    this.showNotification(message, 'success');
  }

  showNotification(message, type) {
    const notification = document.createElement('div');
    notification.className = `transcription-notification ${type}`;
    notification.textContent = message;
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      padding: 12px 16px;
      background: ${type === 'error' ? '#ea4335' : '#34a853'};
      color: white;
      border-radius: 4px;
      z-index: 10001;
      font-size: 14px;
      box-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
    `;

    document.body.appendChild(notification);

    setTimeout(() => {
      notification.remove();
    }, 3000);
  }
}

// Initialize UI injector
const uiInjector = new MeetUIInjector();