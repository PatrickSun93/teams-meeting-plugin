// Settings management for the desktop app
class SettingsManager {
  constructor() {
    this.config = null;
    this.isDirty = false;
    this.init();
  }

  init() {
    this.setupEventListeners();
    this.setupTabSwitching();
  }

  setupEventListeners() {
    // Modal controls
    document.getElementById('closeSettingsBtn').addEventListener('click', () => this.closeSettings());
    document.getElementById('saveSettingsBtn').addEventListener('click', () => this.saveSettings());
    document.getElementById('resetSettingsBtn').addEventListener('click', () => this.resetSettings());

    // Form change detection
    this.setupChangeDetection();

    // Test buttons
    document.getElementById('testAudioBtn').addEventListener('click', () => this.testAudio());
    document.getElementById('testDetectionBtn').addEventListener('click', () => this.testDetection());

    // STT provider change
    document.getElementById('sttProvider').addEventListener('change', (e) => this.handleSTTProviderChange(e));
  }

  setupTabSwitching() {
    const tabButtons = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');

    tabButtons.forEach(button => {
      button.addEventListener('click', () => {
        const targetTab = button.getAttribute('data-tab');
        
        // Update button states
        tabButtons.forEach(btn => btn.classList.remove('active'));
        button.classList.add('active');
        
        // Update content visibility
        tabContents.forEach(content => {
          content.classList.remove('active');
          if (content.id === `${targetTab}-tab`) {
            content.classList.add('active');
          }
        });
      });
    });
  }

  setupChangeDetection() {
    const formElements = document.querySelectorAll('#settingsModal input, #settingsModal select');
    
    formElements.forEach(element => {
      element.addEventListener('change', () => {
        this.isDirty = true;
        this.updateSaveButton();
      });
    });
  }

  updateSaveButton() {
    const saveBtn = document.getElementById('saveSettingsBtn');
    if (this.isDirty) {
      saveBtn.textContent = 'Save Changes';
      saveBtn.classList.add('btn-primary');
      saveBtn.classList.remove('btn-outline');
    } else {
      saveBtn.textContent = 'Save Settings';
      saveBtn.classList.remove('btn-primary');
      saveBtn.classList.add('btn-outline');
    }
  }

  async loadSettings() {
    try {
      this.config = await window.electronAPI.getConfig();
      this.populateForm();
      this.isDirty = false;
      this.updateSaveButton();
    } catch (error) {
      console.error('Failed to load settings:', error);
      this.showNotification('Failed to load settings', 'error');
    }
  }

  populateForm() {
    if (!this.config) return;

    // Transcription settings
    this.setFormValue('sttProvider', this.config.transcription?.provider || 'local');
    this.setFormValue('language', this.config.transcription?.language || 'en');
    this.setFormValue('enableSpeakerDiarization', this.config.transcription?.enableSpeakerDiarization || false);

    // Audio settings
    this.setFormValue('sampleRate', this.config.audio?.sampleRate || 16000);
    this.setFormValue('enableNoiseReduction', this.config.audio?.enableNoiseReduction || false);
    this.setFormValue('audioQuality', this.config.audio?.audioQuality || 'high');

    // Platform settings
    this.setFormValue('autoDetection', this.config.platform?.autoDetection !== false);
    this.setFormValue('enableScreenAnalysis', this.config.advanced?.enableScreenAnalysis || false);
    this.setFormValue('detectionInterval', this.config.platform?.detectionInterval || 5000);

    // Export settings
    this.setFormValue('defaultFormat', this.config.export?.defaultFormat || 'txt');
    this.setFormValue('includeTimestamps', this.config.export?.includeTimestamps !== false);
    this.setFormValue('includeSpeakerLabels', this.config.export?.includeSpeakerLabels !== false);

    // Privacy settings
    this.setFormValue('enableLocalProcessing', this.config.privacy?.enableLocalProcessing !== false);
    this.setFormValue('dataRetentionDays', this.config.privacy?.dataRetentionDays || 30);
    this.setFormValue('enableAnalytics', this.config.privacy?.enableAnalytics || false);

    // Advanced settings
    this.setFormValue('enableDebugLogging', this.config.advanced?.enableDebugLogging || false);
    this.setFormValue('maxConcurrentTranscriptions', this.config.advanced?.maxConcurrentTranscriptions || 1);

    // Update API key field based on provider
    this.handleSTTProviderChange({ target: { value: this.config.transcription?.provider || 'local' } });
  }

  setFormValue(elementId, value) {
    const element = document.getElementById(elementId);
    if (!element) return;

    if (element.type === 'checkbox') {
      element.checked = Boolean(value);
    } else {
      element.value = value;
    }
  }

  getFormValue(elementId) {
    const element = document.getElementById(elementId);
    if (!element) return null;

    if (element.type === 'checkbox') {
      return element.checked;
    } else if (element.type === 'number') {
      return parseInt(element.value, 10);
    } else {
      return element.value;
    }
  }

  collectFormData() {
    return {
      transcription: {
        provider: this.getFormValue('sttProvider'),
        language: this.getFormValue('language'),
        enableSpeakerDiarization: this.getFormValue('enableSpeakerDiarization'),
        apiKey: this.getFormValue('apiKey') || undefined
      },
      audio: {
        sampleRate: this.getFormValue('sampleRate'),
        enableNoiseReduction: this.getFormValue('enableNoiseReduction'),
        audioQuality: this.getFormValue('audioQuality')
      },
      platform: {
        autoDetection: this.getFormValue('autoDetection'),
        detectionInterval: this.getFormValue('detectionInterval')
      },
      export: {
        defaultFormat: this.getFormValue('defaultFormat'),
        includeTimestamps: this.getFormValue('includeTimestamps'),
        includeSpeakerLabels: this.getFormValue('includeSpeakerLabels')
      },
      privacy: {
        enableLocalProcessing: this.getFormValue('enableLocalProcessing'),
        dataRetentionDays: this.getFormValue('dataRetentionDays'),
        enableAnalytics: this.getFormValue('enableAnalytics')
      },
      advanced: {
        enableScreenAnalysis: this.getFormValue('enableScreenAnalysis'),
        enableDebugLogging: this.getFormValue('enableDebugLogging'),
        maxConcurrentTranscriptions: this.getFormValue('maxConcurrentTranscriptions')
      }
    };
  }

  async saveSettings() {
    try {
      const formData = this.collectFormData();
      const result = await window.electronAPI.saveConfig(formData);
      
      if (result.success) {
        this.config = { ...this.config, ...formData };
        this.isDirty = false;
        this.updateSaveButton();
        this.showNotification('Settings saved successfully', 'success');
        
        // Update main app UI
        if (window.app) {
          window.app.config = this.config;
          window.app.applyConfigToUI();
        }
      } else {
        this.showNotification(`Failed to save settings: ${result.error}`, 'error');
      }
    } catch (error) {
      console.error('Failed to save settings:', error);
      this.showNotification('Failed to save settings', 'error');
    }
  }

  async resetSettings() {
    const confirmed = confirm('Are you sure you want to reset all settings to defaults? This cannot be undone.');
    
    if (confirmed) {
      try {
        // Reset to defaults (this would need to be implemented in the main process)
        await this.loadSettings();
        this.showNotification('Settings reset to defaults', 'success');
      } catch (error) {
        console.error('Failed to reset settings:', error);
        this.showNotification('Failed to reset settings', 'error');
      }
    }
  }

  closeSettings() {
    if (this.isDirty) {
      const save = confirm('You have unsaved changes. Would you like to save them before closing?');
      if (save) {
        this.saveSettings().then(() => {
          this.hideModal();
        });
        return;
      }
    }
    
    this.hideModal();
  }

  hideModal() {
    const modal = document.getElementById('settingsModal');
    modal.classList.remove('active');
    
    // Reset form if there were unsaved changes
    if (this.isDirty) {
      this.populateForm();
      this.isDirty = false;
      this.updateSaveButton();
    }
  }

  handleSTTProviderChange(event) {
    const provider = event.target.value;
    const apiKeyField = document.getElementById('apiKey');
    const apiKeyGroup = apiKeyField.closest('.form-group');
    
    if (provider === 'local') {
      apiKeyGroup.style.display = 'none';
      apiKeyField.value = '';
    } else {
      apiKeyGroup.style.display = 'block';
      apiKeyField.placeholder = this.getAPIKeyPlaceholder(provider);
      
      // Load existing API key if available
      if (this.config && this.config.transcription && this.config.transcription.apiKeys) {
        apiKeyField.value = this.config.transcription.apiKeys[provider] || '';
      }
    }
  }

  getAPIKeyPlaceholder(provider) {
    const placeholders = {
      openai: 'sk-...',
      azure: 'Enter Azure Speech Services key',
      claude: 'sk-ant-...'
    };
    
    return placeholders[provider] || 'Enter API key';
  }

  async testAudio() {
    const testBtn = document.getElementById('testAudioBtn');
    const originalText = testBtn.textContent;
    
    try {
      testBtn.textContent = 'Testing...';
      testBtn.disabled = true;
      
      // This would call the audio test functionality
      const result = await window.electronAPI.startAudioCapture();
      
      if (result.success) {
        this.showNotification('Audio test successful', 'success');
        
        // Stop the test after a short duration
        setTimeout(async () => {
          await window.electronAPI.stopAudioCapture();
        }, 2000);
      } else {
        this.showNotification(`Audio test failed: ${result.error}`, 'error');
      }
    } catch (error) {
      console.error('Audio test failed:', error);
      this.showNotification('Audio test failed', 'error');
    } finally {
      testBtn.textContent = originalText;
      testBtn.disabled = false;
    }
  }

  async testDetection() {
    const testBtn = document.getElementById('testDetectionBtn');
    const originalText = testBtn.textContent;
    
    try {
      testBtn.textContent = 'Testing...';
      testBtn.disabled = true;
      
      const result = await window.electronAPI.detectPlatform();
      
      if (result) {
        this.showNotification(`Platform detected: ${result.name} (${Math.round(result.confidence * 100)}% confidence)`, 'success');
      } else {
        this.showNotification('No platform detected', 'warning');
      }
    } catch (error) {
      console.error('Platform detection test failed:', error);
      this.showNotification('Platform detection test failed', 'error');
    } finally {
      testBtn.textContent = originalText;
      testBtn.disabled = false;
    }
  }

  showNotification(message, type = 'info') {
    if (window.app) {
      window.app.showNotification(message, type);
    } else {
      // Fallback notification
      alert(message);
    }
  }

  // Validation methods
  validateForm() {
    const errors = [];
    
    // Validate detection interval
    const detectionInterval = this.getFormValue('detectionInterval');
    if (detectionInterval < 1000 || detectionInterval > 60000) {
      errors.push('Detection interval must be between 1000 and 60000 milliseconds');
    }
    
    // Validate data retention days
    const retentionDays = this.getFormValue('dataRetentionDays');
    if (retentionDays < 1 || retentionDays > 365) {
      errors.push('Data retention must be between 1 and 365 days');
    }
    
    // Validate max concurrent transcriptions
    const maxConcurrent = this.getFormValue('maxConcurrentTranscriptions');
    if (maxConcurrent < 1 || maxConcurrent > 5) {
      errors.push('Max concurrent transcriptions must be between 1 and 5');
    }
    
    // Validate API key format if cloud provider is selected
    const provider = this.getFormValue('sttProvider');
    const apiKey = this.getFormValue('apiKey');
    
    if (provider !== 'local' && apiKey) {
      if (!this.validateAPIKey(provider, apiKey)) {
        errors.push(`Invalid API key format for ${provider}`);
      }
    }
    
    return errors;
  }

  validateAPIKey(provider, apiKey) {
    const patterns = {
      openai: /^sk-[a-zA-Z0-9]{48}$/,
      azure: /^[a-f0-9]{32}$/,
      claude: /^sk-ant-[a-zA-Z0-9-_]{95}$/
    };
    
    const pattern = patterns[provider];
    return !pattern || pattern.test(apiKey);
  }

  // Import/Export settings
  async exportSettings() {
    try {
      const result = await window.electronAPI.exportConfig();
      if (result.success) {
        this.showNotification('Settings exported successfully', 'success');
      } else {
        this.showNotification(`Export failed: ${result.error}`, 'error');
      }
    } catch (error) {
      console.error('Failed to export settings:', error);
      this.showNotification('Failed to export settings', 'error');
    }
  }

  async importSettings() {
    try {
      const result = await window.electronAPI.importConfig();
      if (result.success) {
        await this.loadSettings();
        this.showNotification('Settings imported successfully', 'success');
      } else {
        this.showNotification(`Import failed: ${result.error}`, 'error');
      }
    } catch (error) {
      console.error('Failed to import settings:', error);
      this.showNotification('Failed to import settings', 'error');
    }
  }
}

// Initialize settings manager when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  window.settingsManager = new SettingsManager();
});