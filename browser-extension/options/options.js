/**
 * Options Page JavaScript for Google Meet Extension
 * Handles settings configuration and storage
 */

class OptionsController {
  constructor() {
    this.config = {};
    this.hasUnsavedChanges = false;
    
    this.init();
  }

  async init() {
    console.log('Options page initialized');
    
    // Load current configuration
    await this.loadConfiguration();
    
    // Set up event listeners
    this.setupEventListeners();
    
    // Update UI with current settings
    this.updateUI();
  }

  async loadConfiguration() {
    try {
      const response = await chrome.runtime.sendMessage({ type: 'GET_CONFIGURATION' });
      if (response.success) {
        this.config = response.config;
      } else {
        // Set default configuration
        this.config = {
          extensionEnabled: true,
          autoStartTranscription: false,
          showConfidenceScores: true,
          sttProvider: 'local_whisper',
          aiProvider: 'openai_gpt',
          transcriptionLanguage: 'auto',
          exportFormat: 'txt',
          storageDuration: 30,
          autoExport: false,
          privacyMode: false,
          encryptStorage: true,
          calendarIntegration: false
        };
      }
    } catch (error) {
      console.error('Failed to load configuration:', error);
      this.showStatus('Failed to load settings', 'error');
    }
  }

  setupEventListeners() {
    // Save button
    document.getElementById('save-settings').addEventListener('click', () => {
      this.saveConfiguration();
    });

    // Form inputs
    const inputs = document.querySelectorAll('input, select, textarea');
    inputs.forEach(input => {
      input.addEventListener('change', () => {
        this.markUnsavedChanges();
        this.updateProviderConfigs();
      });
    });

    // Provider-specific configs
    document.getElementById('stt-provider').addEventListener('change', () => {
      this.updateSTTProviderConfig();
    });

    document.getElementById('ai-provider').addEventListener('change', () => {
      this.updateAIProviderConfig();
    });

    // Calendar integration
    document.getElementById('calendar-integration').addEventListener('change', () => {
      this.updateCalendarIntegration();
    });

    document.getElementById('calendar-auth-btn').addEventListener('click', () => {
      this.authorizeCalendar();
    });

    // Clear data button
    document.getElementById('clear-data').addEventListener('click', () => {
      this.clearAllData();
    });

    // Footer links
    document.getElementById('help-link').addEventListener('click', (e) => {
      e.preventDefault();
      this.openHelp();
    });

    document.getElementById('privacy-link').addEventListener('click', (e) => {
      e.preventDefault();
      this.openPrivacy();
    });

    document.getElementById('feedback-link').addEventListener('click', (e) => {
      e.preventDefault();
      this.openFeedback();
    });

    // Warn about unsaved changes
    window.addEventListener('beforeunload', (e) => {
      if (this.hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = 'You have unsaved changes. Are you sure you want to leave?';
      }
    });
  }

  updateUI() {
    // General settings
    document.getElementById('extension-enabled').checked = this.config.extensionEnabled;
    document.getElementById('auto-start-transcription').checked = this.config.autoStartTranscription;
    document.getElementById('show-confidence-scores').checked = this.config.showConfidenceScores;

    // STT settings
    document.getElementById('stt-provider').value = this.config.sttProvider || 'local_whisper';
    document.getElementById('transcription-language').value = this.config.transcriptionLanguage || 'auto';

    // AI settings
    document.getElementById('ai-provider').value = this.config.aiProvider || 'openai_gpt';
    document.getElementById('custom-prompt').value = this.config.customPrompt || '';

    // Export settings
    document.getElementById('export-format').value = this.config.exportFormat || 'txt';
    document.getElementById('storage-duration').value = this.config.storageDuration || 30;
    document.getElementById('auto-export').checked = this.config.autoExport;

    // Privacy settings
    document.getElementById('privacy-mode').checked = this.config.privacyMode;
    document.getElementById('encrypt-storage').checked = this.config.encryptStorage;

    // Calendar integration
    document.getElementById('calendar-integration').checked = this.config.calendarIntegration;

    // API keys (don't show actual values for security)
    if (this.config.openaiSTTKey) {
      document.getElementById('openai-stt-key').placeholder = '••••••••••••••••';
    }
    if (this.config.azureSTTKey) {
      document.getElementById('azure-stt-key').placeholder = '••••••••••••••••';
    }
    if (this.config.openaiAIKey) {
      document.getElementById('openai-ai-key').placeholder = '••••••••••••••••';
    }
    if (this.config.claudeAIKey) {
      document.getElementById('claude-ai-key').placeholder = '••••••••••••••••';
    }
    if (this.config.azureAIKey) {
      document.getElementById('azure-ai-key').placeholder = '••••••••••••••••';
    }

    // Update provider-specific configs
    this.updateSTTProviderConfig();
    this.updateAIProviderConfig();
    this.updateCalendarIntegration();
  }

  updateSTTProviderConfig() {
    const provider = document.getElementById('stt-provider').value;
    
    // Hide all provider configs
    document.getElementById('openai-stt-config').style.display = 'none';
    document.getElementById('azure-stt-config').style.display = 'none';

    // Show relevant config
    switch (provider) {
      case 'openai_whisper':
        document.getElementById('openai-stt-config').style.display = 'block';
        break;
      case 'azure_speech':
        document.getElementById('azure-stt-config').style.display = 'block';
        break;
    }
  }

  updateAIProviderConfig() {
    const provider = document.getElementById('ai-provider').value;
    
    // Hide all provider configs
    document.getElementById('openai-ai-config').style.display = 'none';
    document.getElementById('claude-ai-config').style.display = 'none';
    document.getElementById('azure-ai-config').style.display = 'none';

    // Show relevant config
    switch (provider) {
      case 'openai_gpt':
        document.getElementById('openai-ai-config').style.display = 'block';
        break;
      case 'claude':
        document.getElementById('claude-ai-config').style.display = 'block';
        break;
      case 'azure_openai':
        document.getElementById('azure-ai-config').style.display = 'block';
        break;
    }
  }

  updateCalendarIntegration() {
    const enabled = document.getElementById('calendar-integration').checked;
    const authSection = document.getElementById('calendar-auth');
    
    if (enabled) {
      authSection.style.display = 'block';
    } else {
      authSection.style.display = 'none';
    }
  }

  updateProviderConfigs() {
    this.updateSTTProviderConfig();
    this.updateAIProviderConfig();
    this.updateCalendarIntegration();
  }

  markUnsavedChanges() {
    this.hasUnsavedChanges = true;
    const saveBtn = document.getElementById('save-settings');
    saveBtn.textContent = 'Save Changes';
    saveBtn.style.background = '#ea4335';
  }

  async saveConfiguration() {
    const saveBtn = document.getElementById('save-settings');
    saveBtn.disabled = true;
    saveBtn.classList.add('loading');

    try {
      // Collect all form data
      const newConfig = {
        extensionEnabled: document.getElementById('extension-enabled').checked,
        autoStartTranscription: document.getElementById('auto-start-transcription').checked,
        showConfidenceScores: document.getElementById('show-confidence-scores').checked,
        sttProvider: document.getElementById('stt-provider').value,
        aiProvider: document.getElementById('ai-provider').value,
        transcriptionLanguage: document.getElementById('transcription-language').value,
        customPrompt: document.getElementById('custom-prompt').value,
        exportFormat: document.getElementById('export-format').value,
        storageDuration: parseInt(document.getElementById('storage-duration').value),
        autoExport: document.getElementById('auto-export').checked,
        privacyMode: document.getElementById('privacy-mode').checked,
        encryptStorage: document.getElementById('encrypt-storage').checked,
        calendarIntegration: document.getElementById('calendar-integration').checked
      };

      // Add API keys if provided
      const openaiSTTKey = document.getElementById('openai-stt-key').value;
      if (openaiSTTKey && !openaiSTTKey.startsWith('••')) {
        newConfig.openaiSTTKey = openaiSTTKey;
      }

      const azureSTTKey = document.getElementById('azure-stt-key').value;
      const azureSTTRegion = document.getElementById('azure-stt-region').value;
      if (azureSTTKey && !azureSTTKey.startsWith('••')) {
        newConfig.azureSTTKey = azureSTTKey;
        newConfig.azureSTTRegion = azureSTTRegion;
      }

      const openaiAIKey = document.getElementById('openai-ai-key').value;
      if (openaiAIKey && !openaiAIKey.startsWith('••')) {
        newConfig.openaiAIKey = openaiAIKey;
      }

      const claudeAIKey = document.getElementById('claude-ai-key').value;
      if (claudeAIKey && !claudeAIKey.startsWith('••')) {
        newConfig.claudeAIKey = claudeAIKey;
      }

      const azureAIKey = document.getElementById('azure-ai-key').value;
      const azureAIEndpoint = document.getElementById('azure-ai-endpoint').value;
      if (azureAIKey && !azureAIKey.startsWith('••')) {
        newConfig.azureAIKey = azureAIKey;
        newConfig.azureAIEndpoint = azureAIEndpoint;
      }

      // Save configuration
      const response = await chrome.runtime.sendMessage({
        type: 'UPDATE_CONFIGURATION',
        data: newConfig
      });

      if (response.success) {
        this.config = { ...this.config, ...newConfig };
        this.hasUnsavedChanges = false;
        this.showStatus('Settings saved successfully', 'success');
        
        saveBtn.textContent = 'Save Settings';
        saveBtn.style.background = '#1a73e8';
      } else {
        throw new Error(response.error || 'Failed to save settings');
      }

    } catch (error) {
      console.error('Failed to save configuration:', error);
      this.showStatus('Failed to save settings: ' + error.message, 'error');
    } finally {
      saveBtn.disabled = false;
      saveBtn.classList.remove('loading');
    }
  }

  async authorizeCalendar() {
    const authBtn = document.getElementById('calendar-auth-btn');
    authBtn.disabled = true;
    authBtn.textContent = 'Authorizing...';

    try {
      const token = await chrome.identity.getAuthToken({ interactive: true });
      
      if (token) {
        this.showStatus('Google Calendar authorized successfully', 'success');
        authBtn.textContent = 'Reauthorize Google Calendar';
      } else {
        throw new Error('Authorization failed');
      }

    } catch (error) {
      console.error('Calendar authorization failed:', error);
      this.showStatus('Failed to authorize Google Calendar: ' + error.message, 'error');
      authBtn.textContent = 'Authorize Google Calendar';
    } finally {
      authBtn.disabled = false;
    }
  }

  async clearAllData() {
    const confirmed = confirm(
      'This will permanently delete all stored transcripts, settings, and cached data. ' +
      'This action cannot be undone. Are you sure you want to continue?'
    );

    if (!confirmed) return;

    try {
      // Clear all storage
      await chrome.storage.local.clear();
      await chrome.storage.sync.clear();

      // Revoke calendar token if exists
      try {
        const token = await chrome.identity.getAuthToken({ interactive: false });
        if (token) {
          await chrome.identity.removeCachedAuthToken({ token });
        }
      } catch (error) {
        console.log('No calendar token to revoke');
      }

      this.showStatus('All data cleared successfully', 'success');
      
      // Reset form to defaults
      setTimeout(() => {
        window.location.reload();
      }, 1500);

    } catch (error) {
      console.error('Failed to clear data:', error);
      this.showStatus('Failed to clear data: ' + error.message, 'error');
    }
  }

  openHelp() {
    chrome.tabs.create({ 
      url: 'https://support.google.com/meet/answer/transcription-help' 
    });
  }

  openPrivacy() {
    chrome.tabs.create({ 
      url: 'https://example.com/privacy-policy' 
    });
  }

  openFeedback() {
    chrome.tabs.create({ 
      url: 'mailto:feedback@example.com?subject=Meeting Transcription Extension Feedback' 
    });
  }

  showStatus(message, type = 'success') {
    const statusElement = document.getElementById('status-message');
    statusElement.textContent = message;
    statusElement.className = `status-message ${type}`;
    statusElement.style.display = 'block';

    // Auto-hide after 4 seconds
    setTimeout(() => {
      statusElement.style.display = 'none';
    }, 4000);
  }
}

// Initialize options controller when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  new OptionsController();
});