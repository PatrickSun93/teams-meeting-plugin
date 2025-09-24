// Configuration Panel Component - UI for managing user settings
import React, { useState, useEffect } from 'react';
import ConfigurationManager from '../services/ConfigurationManager.js';
import './ConfigurationPanel.css';

const ConfigurationPanel = ({ isOpen, onClose, onConfigChange }) => {
  const [config, setConfig] = useState(null);
  const [apiKeys, setApiKeys] = useState({});
  const [customPrompt, setCustomPrompt] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [activeTab, setActiveTab] = useState('general');

  const configManager = new ConfigurationManager();

  useEffect(() => {
    if (isOpen) {
      loadConfiguration();
    }
  }, [isOpen]);

  const loadConfiguration = async () => {
    try {
      setLoading(true);
      setError(null);

      // Load user configuration
      const userConfig = await configManager.getUserConfig();
      setConfig(userConfig);

      // Load API keys for each service
      const sttProviders = configManager.getAvailableSTTProviders();
      const aiProviders = configManager.getAvailableAIProviders();
      const allProviders = [...sttProviders, ...aiProviders];
      
      const keys = {};
      for (const provider of allProviders) {
        if (provider.requiresApiKey) {
          const key = await configManager.getApiKey(provider.id);
          keys[provider.id] = key || '';
        }
      }
      setApiKeys(keys);

      // Load custom prompt
      const prompt = await configManager.getUserPrompt();
      setCustomPrompt(prompt);

    } catch (err) {
      setError(`Failed to load configuration: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleConfigChange = (field, value) => {
    setConfig(prev => ({
      ...prev,
      [field]: value,
      updatedAt: new Date().toISOString()
    }));
    setError(null);
    setSuccess(null);
  };

  const handleApiKeyChange = (service, value) => {
    setApiKeys(prev => ({
      ...prev,
      [service]: value
    }));
    setError(null);
    setSuccess(null);
  };

  const handleSaveConfiguration = async () => {
    try {
      setSaving(true);
      setError(null);

      // Save user configuration
      await configManager.saveUserConfig(config);

      // Save API keys
      for (const [service, key] of Object.entries(apiKeys)) {
        if (key.trim()) {
          await configManager.saveApiKey(service, key.trim());
        } else {
          await configManager.deleteApiKey(service);
        }
      }

      // Save custom prompt
      if (customPrompt.trim()) {
        await configManager.saveUserPrompt(config.userId, customPrompt.trim());
      }

      setSuccess('Configuration saved successfully!');
      
      // Notify parent component of config change
      if (onConfigChange) {
        onConfigChange(config);
      }

    } catch (err) {
      setError(`Failed to save configuration: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleConsentChange = (value) => {
    handleConfigChange('consentGiven', value);
    if (!value) {
      // If consent is revoked, switch to local providers
      handleConfigChange('sttProvider', 'local_whisper');
    }
  };

  const requiresCloudConsent = () => {
    return configManager.requiresConsent(config?.sttProvider) || 
           configManager.requiresConsent(config?.aiProvider);
  };

  if (!isOpen) return null;

  if (loading) {
    return (
      <div className="configuration-overlay">
        <div className="configuration-panel">
          <div className="loading-state">
            <div className="spinner">⏳</div>
            <p>Loading configuration...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="configuration-overlay">
      <div className="configuration-panel">
        <div className="panel-header">
          <h2>⚙️ Configuration Settings</h2>
          <button className="close-button" onClick={onClose}>×</button>
        </div>

        <div className="panel-tabs">
          <button 
            className={`tab ${activeTab === 'general' ? 'active' : ''}`}
            onClick={() => setActiveTab('general')}
          >
            General
          </button>
          <button 
            className={`tab ${activeTab === 'services' ? 'active' : ''}`}
            onClick={() => setActiveTab('services')}
          >
            Services & API Keys
          </button>
          <button 
            className={`tab ${activeTab === 'prompts' ? 'active' : ''}`}
            onClick={() => setActiveTab('prompts')}
          >
            Custom Prompts
          </button>
          <button 
            className={`tab ${activeTab === 'privacy' ? 'active' : ''}`}
            onClick={() => setActiveTab('privacy')}
          >
            Privacy & Data
          </button>
        </div>

        <div className="panel-content">
          {error && (
            <div className="message error">
              <span className="icon">⚠️</span>
              {error}
            </div>
          )}

          {success && (
            <div className="message success">
              <span className="icon">✅</span>
              {success}
            </div>
          )}

          {activeTab === 'general' && (
            <div className="tab-content">
              <div className="form-group">
                <label htmlFor="language">Language</label>
                <select
                  id="language"
                  value={config?.language || 'en-US'}
                  onChange={(e) => handleConfigChange('language', e.target.value)}
                >
                  <option value="en-US">English (US)</option>
                  <option value="en-GB">English (UK)</option>
                  <option value="es-ES">Spanish</option>
                  <option value="fr-FR">French</option>
                  <option value="de-DE">German</option>
                  <option value="it-IT">Italian</option>
                  <option value="pt-BR">Portuguese (Brazil)</option>
                  <option value="ja-JP">Japanese</option>
                  <option value="ko-KR">Korean</option>
                  <option value="zh-CN">Chinese (Simplified)</option>
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="quality">Transcription Quality</label>
                <select
                  id="quality"
                  value={config?.transcriptionQuality || 'high'}
                  onChange={(e) => handleConfigChange('transcriptionQuality', e.target.value)}
                >
                  <option value="low">Low (Faster)</option>
                  <option value="medium">Medium (Balanced)</option>
                  <option value="high">High (Best Quality)</option>
                </select>
              </div>

              <div className="form-group checkbox-group">
                <label>
                  <input
                    type="checkbox"
                    checked={config?.enableSpeakerIdentification || false}
                    onChange={(e) => handleConfigChange('enableSpeakerIdentification', e.target.checked)}
                  />
                  Enable Speaker Identification
                </label>
              </div>

              <div className="form-group checkbox-group">
                <label>
                  <input
                    type="checkbox"
                    checked={config?.autoSendToChat || false}
                    onChange={(e) => handleConfigChange('autoSendToChat', e.target.checked)}
                  />
                  Automatically send transcript to meeting chat
                </label>
              </div>

              <div className="form-group checkbox-group">
                <label>
                  <input
                    type="checkbox"
                    checked={config?.enableSummaryGeneration || false}
                    onChange={(e) => handleConfigChange('enableSummaryGeneration', e.target.checked)}
                  />
                  Enable AI-powered meeting summaries
                </label>
              </div>
            </div>
          )}

          {activeTab === 'services' && (
            <div className="tab-content">
              <div className="service-section">
                <h3>Speech-to-Text Service</h3>
                <div className="form-group">
                  <label htmlFor="sttProvider">STT Provider</label>
                  <select
                    id="sttProvider"
                    value={config?.sttProvider || 'local_whisper'}
                    onChange={(e) => handleConfigChange('sttProvider', e.target.value)}
                  >
                    {configManager.getAvailableSTTProviders().map(provider => (
                      <option key={provider.id} value={provider.id}>
                        {provider.name} {provider.isCloud ? '(Cloud)' : '(Local)'}
                      </option>
                    ))}
                  </select>
                </div>

                {config?.sttProvider && config.sttProvider !== 'local_whisper' && (
                  <div className="form-group">
                    <label htmlFor={`${config.sttProvider}-key`}>
                      API Key for {configManager.getAvailableSTTProviders().find(p => p.id === config.sttProvider)?.name}
                    </label>
                    <input
                      type="password"
                      id={`${config.sttProvider}-key`}
                      value={apiKeys[config.sttProvider] || ''}
                      onChange={(e) => handleApiKeyChange(config.sttProvider, e.target.value)}
                      placeholder="Enter your API key"
                    />
                  </div>
                )}
              </div>

              <div className="service-section">
                <h3>AI Summary Service</h3>
                <div className="form-group">
                  <label htmlFor="aiProvider">AI Provider</label>
                  <select
                    id="aiProvider"
                    value={config?.aiProvider || 'openai_gpt'}
                    onChange={(e) => handleConfigChange('aiProvider', e.target.value)}
                  >
                    {configManager.getAvailableAIProviders().map(provider => (
                      <option key={provider.id} value={provider.id}>
                        {provider.name}
                      </option>
                    ))}
                  </select>
                </div>

                {config?.aiProvider && (
                  <div className="form-group">
                    <label htmlFor={`${config.aiProvider}-key`}>
                      API Key for {configManager.getAvailableAIProviders().find(p => p.id === config.aiProvider)?.name}
                    </label>
                    <input
                      type="password"
                      id={`${config.aiProvider}-key`}
                      value={apiKeys[config.aiProvider] || ''}
                      onChange={(e) => handleApiKeyChange(config.aiProvider, e.target.value)}
                      placeholder="Enter your API key"
                    />
                  </div>
                )}
              </div>

              {requiresCloudConsent() && (
                <div className="cloud-consent-section">
                  <div className="consent-warning">
                    <span className="icon">⚠️</span>
                    <p>
                      <strong>Cloud Service Notice:</strong> The selected services will send audio data to external providers. 
                      Please ensure you have permission to share meeting audio and that this complies with your organization's policies.
                    </p>
                  </div>
                  
                  <div className="form-group checkbox-group">
                    <label>
                      <input
                        type="checkbox"
                        checked={config?.consentGiven || false}
                        onChange={(e) => handleConsentChange(e.target.checked)}
                      />
                      I understand and consent to sending audio data to cloud services
                    </label>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'prompts' && (
            <div className="tab-content">
              <div className="form-group">
                <label htmlFor="customPrompt">Custom Summary Prompt</label>
                <textarea
                  id="customPrompt"
                  value={customPrompt}
                  onChange={(e) => setCustomPrompt(e.target.value)}
                  placeholder={configManager.getDefaultPrompt()}
                  rows={10}
                />
                <small>
                  Customize how AI generates meeting summaries. Leave empty to use the default prompt.
                </small>
              </div>

              <div className="prompt-preview">
                <h4>Default Prompt Preview:</h4>
                <div className="default-prompt">
                  {configManager.getDefaultPrompt()}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'privacy' && (
            <div className="tab-content">
              <div className="form-group">
                <label htmlFor="dataRetention">Data Retention (Days)</label>
                <input
                  type="number"
                  id="dataRetention"
                  min="1"
                  max="365"
                  value={config?.dataRetentionDays || 30}
                  onChange={(e) => handleConfigChange('dataRetentionDays', parseInt(e.target.value))}
                />
                <small>
                  Transcripts and recordings will be automatically deleted after this many days.
                </small>
              </div>

              <div className="form-group checkbox-group">
                <label>
                  <input
                    type="checkbox"
                    checked={config?.privacyMode || false}
                    onChange={(e) => handleConfigChange('privacyMode', e.target.checked)}
                  />
                  Privacy Mode (Local processing only)
                </label>
                <small>
                  When enabled, all processing will be done locally without sending data to cloud services.
                </small>
              </div>

              <div className="privacy-info">
                <h4>Data Storage Information:</h4>
                <ul>
                  <li>All transcripts are stored locally in your browser</li>
                  <li>API keys are encrypted before storage</li>
                  <li>No data is sent to our servers</li>
                  <li>You can delete all data at any time</li>
                </ul>
              </div>

              <div className="danger-zone">
                <h4>⚠️ Danger Zone</h4>
                <button 
                  className="danger-button"
                  onClick={async () => {
                    if (window.confirm('Are you sure you want to delete all configuration data? This cannot be undone.')) {
                      try {
                        await configManager.clearAllData();
                        setSuccess('All data cleared successfully');
                        setTimeout(() => {
                          window.location.reload();
                        }, 1000);
                      } catch (err) {
                        setError(`Failed to clear data: ${err.message}`);
                      }
                    }
                  }}
                >
                  Clear All Data
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="panel-footer">
          <button className="cancel-button" onClick={onClose}>
            Cancel
          </button>
          <button 
            className="save-button" 
            onClick={handleSaveConfiguration}
            disabled={saving || (requiresCloudConsent() && !config?.consentGiven)}
          >
            {saving ? (
              <>
                <span className="spinner">⏳</span>
                Saving...
              </>
            ) : (
              'Save Configuration'
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfigurationPanel;