// Configuration Panel Component Tests
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ConfigurationPanel from '../ConfigurationPanel.js';
import ConfigurationManager from '../../services/ConfigurationManager.js';

// Mock the ConfigurationManager
jest.mock('../../services/ConfigurationManager.js');

describe('ConfigurationPanel', () => {
  let mockConfigManager;
  let mockProps;

  beforeEach(() => {
    mockConfigManager = {
      getUserConfig: jest.fn(),
      saveUserConfig: jest.fn(),
      getApiKey: jest.fn(),
      saveApiKey: jest.fn(),
      deleteApiKey: jest.fn(),
      getUserPrompt: jest.fn(),
      saveUserPrompt: jest.fn(),
      getDefaultPrompt: jest.fn(),
      getAvailableSTTProviders: jest.fn(),
      getAvailableAIProviders: jest.fn(),
      requiresConsent: jest.fn(),
      clearAllData: jest.fn(),
      validateConfig: jest.fn()
    };

    ConfigurationManager.mockImplementation(() => mockConfigManager);

    mockProps = {
      isOpen: true,
      onClose: jest.fn(),
      onConfigChange: jest.fn()
    };

    // Default mock implementations
    mockConfigManager.getUserConfig.mockResolvedValue({
      userId: 'default',
      sttProvider: 'local_whisper',
      aiProvider: 'openai_gpt',
      language: 'en-US',
      transcriptionQuality: 'high',
      enableSpeakerIdentification: true,
      autoSendToChat: true,
      enableSummaryGeneration: true,
      privacyMode: false,
      dataRetentionDays: 30,
      consentGiven: false
    });

    mockConfigManager.getApiKey.mockResolvedValue('');
    mockConfigManager.getUserPrompt.mockResolvedValue('Default prompt');
    mockConfigManager.getDefaultPrompt.mockReturnValue('Default prompt text');
    
    mockConfigManager.getAvailableSTTProviders.mockReturnValue([
      { id: 'local_whisper', name: 'Local Whisper', requiresApiKey: false, isCloud: false },
      { id: 'openai_whisper', name: 'OpenAI Whisper API', requiresApiKey: true, isCloud: true }
    ]);

    mockConfigManager.getAvailableAIProviders.mockReturnValue([
      { id: 'openai_gpt', name: 'OpenAI GPT', requiresApiKey: true, isCloud: true },
      { id: 'claude', name: 'Claude (Anthropic)', requiresApiKey: true, isCloud: true }
    ]);

    mockConfigManager.requiresConsent.mockReturnValue(false);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test('should not render when isOpen is false', () => {
    render(<ConfigurationPanel {...mockProps} isOpen={false} />);
    expect(screen.queryByText('Configuration Settings')).not.toBeInTheDocument();
  });

  test('should show loading state initially', () => {
    render(<ConfigurationPanel {...mockProps} />);
    expect(screen.getByText('Loading configuration...')).toBeInTheDocument();
  });

  test('should render configuration panel when loaded', async () => {
    render(<ConfigurationPanel {...mockProps} />);

    await waitFor(() => {
      expect(screen.getByText('⚙️ Configuration Settings')).toBeInTheDocument();
    });

    expect(screen.getByText('General')).toBeInTheDocument();
    expect(screen.getByText('Services & API Keys')).toBeInTheDocument();
    expect(screen.getByText('Custom Prompts')).toBeInTheDocument();
    expect(screen.getByText('Privacy & Data')).toBeInTheDocument();
  });

  test('should close panel when close button is clicked', async () => {
    render(<ConfigurationPanel {...mockProps} />);

    await waitFor(() => {
      expect(screen.getByText('⚙️ Configuration Settings')).toBeInTheDocument();
    });

    const closeButton = screen.getByText('×');
    fireEvent.click(closeButton);

    expect(mockProps.onClose).toHaveBeenCalledTimes(1);
  });

  test('should switch between tabs', async () => {
    render(<ConfigurationPanel {...mockProps} />);

    await waitFor(() => {
      expect(screen.getByText('⚙️ Configuration Settings')).toBeInTheDocument();
    });

    // Click on Services tab
    const servicesTab = screen.getByText('Services & API Keys');
    fireEvent.click(servicesTab);

    expect(screen.getByText('Speech-to-Text Service')).toBeInTheDocument();
    expect(screen.getByText('AI Summary Service')).toBeInTheDocument();
  });

  test('should update language setting', async () => {
    render(<ConfigurationPanel {...mockProps} />);

    await waitFor(() => {
      expect(screen.getByDisplayValue('en-US')).toBeInTheDocument();
    });

    const languageSelect = screen.getByDisplayValue('en-US');
    fireEvent.change(languageSelect, { target: { value: 'es-ES' } });

    expect(languageSelect.value).toBe('es-ES');
  });

  test('should update transcription quality setting', async () => {
    render(<ConfigurationPanel {...mockProps} />);

    await waitFor(() => {
      expect(screen.getByDisplayValue('high')).toBeInTheDocument();
    });

    const qualitySelect = screen.getByDisplayValue('high');
    fireEvent.change(qualitySelect, { target: { value: 'medium' } });

    expect(qualitySelect.value).toBe('medium');
  });

  test('should toggle checkbox settings', async () => {
    render(<ConfigurationPanel {...mockProps} />);

    await waitFor(() => {
      expect(screen.getByLabelText('Enable Speaker Identification')).toBeInTheDocument();
    });

    const speakerIdCheckbox = screen.getByLabelText('Enable Speaker Identification');
    expect(speakerIdCheckbox).toBeChecked();

    fireEvent.click(speakerIdCheckbox);
    expect(speakerIdCheckbox).not.toBeChecked();
  });

  test('should show API key fields for cloud services', async () => {
    render(<ConfigurationPanel {...mockProps} />);

    await waitFor(() => {
      expect(screen.getByText('Services & API Keys')).toBeInTheDocument();
    });

    // Switch to services tab
    const servicesTab = screen.getByText('Services & API Keys');
    fireEvent.click(servicesTab);

    // Change to OpenAI Whisper (cloud service)
    const sttSelect = screen.getByDisplayValue('local_whisper');
    fireEvent.change(sttSelect, { target: { value: 'openai_whisper' } });

    await waitFor(() => {
      expect(screen.getByLabelText(/API Key for OpenAI Whisper API/)).toBeInTheDocument();
    });
  });

  test('should show consent warning for cloud services', async () => {
    mockConfigManager.requiresConsent.mockReturnValue(true);

    render(<ConfigurationPanel {...mockProps} />);

    await waitFor(() => {
      expect(screen.getByText('Services & API Keys')).toBeInTheDocument();
    });

    // Switch to services tab
    const servicesTab = screen.getByText('Services & API Keys');
    fireEvent.click(servicesTab);

    // Change to cloud service
    const sttSelect = screen.getByDisplayValue('local_whisper');
    fireEvent.change(sttSelect, { target: { value: 'openai_whisper' } });

    await waitFor(() => {
      expect(screen.getByText(/Cloud Service Notice/)).toBeInTheDocument();
      expect(screen.getByText(/I understand and consent to sending audio data to cloud services/)).toBeInTheDocument();
    });
  });

  test('should update custom prompt', async () => {
    render(<ConfigurationPanel {...mockProps} />);

    await waitFor(() => {
      expect(screen.getByText('Custom Prompts')).toBeInTheDocument();
    });

    // Switch to prompts tab
    const promptsTab = screen.getByText('Custom Prompts');
    fireEvent.click(promptsTab);

    const promptTextarea = screen.getByLabelText('Custom Summary Prompt');
    fireEvent.change(promptTextarea, { target: { value: 'Custom prompt text' } });

    expect(promptTextarea.value).toBe('Custom prompt text');
  });

  test('should save configuration successfully', async () => {
    mockConfigManager.saveUserConfig.mockResolvedValue({});
    mockConfigManager.saveApiKey.mockResolvedValue(true);
    mockConfigManager.saveUserPrompt.mockResolvedValue('prompt');

    render(<ConfigurationPanel {...mockProps} />);

    await waitFor(() => {
      expect(screen.getByText('Save Configuration')).toBeInTheDocument();
    });

    const saveButton = screen.getByText('Save Configuration');
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(screen.getByText('Configuration saved successfully!')).toBeInTheDocument();
    });

    expect(mockConfigManager.saveUserConfig).toHaveBeenCalledTimes(1);
    expect(mockProps.onConfigChange).toHaveBeenCalledTimes(1);
  });

  test('should handle save configuration error', async () => {
    mockConfigManager.saveUserConfig.mockRejectedValue(new Error('Save failed'));

    render(<ConfigurationPanel {...mockProps} />);

    await waitFor(() => {
      expect(screen.getByText('Save Configuration')).toBeInTheDocument();
    });

    const saveButton = screen.getByText('Save Configuration');
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(screen.getByText(/Failed to save configuration: Save failed/)).toBeInTheDocument();
    });
  });

  test('should disable save button when consent is required but not given', async () => {
    mockConfigManager.requiresConsent.mockReturnValue(true);
    
    // Mock config without consent
    mockConfigManager.getUserConfig.mockResolvedValue({
      userId: 'default',
      sttProvider: 'openai_whisper',
      aiProvider: 'openai_gpt',
      consentGiven: false
    });

    render(<ConfigurationPanel {...mockProps} />);

    await waitFor(() => {
      expect(screen.getByText('Save Configuration')).toBeInTheDocument();
    });

    const saveButton = screen.getByText('Save Configuration');
    expect(saveButton).toBeDisabled();
  });

  test('should show data retention settings in privacy tab', async () => {
    render(<ConfigurationPanel {...mockProps} />);

    await waitFor(() => {
      expect(screen.getByText('Privacy & Data')).toBeInTheDocument();
    });

    // Switch to privacy tab
    const privacyTab = screen.getByText('Privacy & Data');
    fireEvent.click(privacyTab);

    expect(screen.getByLabelText('Data Retention (Days)')).toBeInTheDocument();
    expect(screen.getByLabelText(/Privacy Mode/)).toBeInTheDocument();
  });

  test('should handle clear all data action', async () => {
    mockConfigManager.clearAllData.mockResolvedValue(true);
    
    // Mock window.confirm
    const originalConfirm = window.confirm;
    window.confirm = jest.fn(() => true);

    render(<ConfigurationPanel {...mockProps} />);

    await waitFor(() => {
      expect(screen.getByText('Privacy & Data')).toBeInTheDocument();
    });

    // Switch to privacy tab
    const privacyTab = screen.getByText('Privacy & Data');
    fireEvent.click(privacyTab);

    const clearButton = screen.getByText('Clear All Data');
    fireEvent.click(clearButton);

    await waitFor(() => {
      expect(screen.getByText('All data cleared successfully')).toBeInTheDocument();
    });

    expect(mockConfigManager.clearAllData).toHaveBeenCalledTimes(1);
    expect(window.confirm).toHaveBeenCalledWith(
      'Are you sure you want to delete all configuration data? This cannot be undone.'
    );

    // Restore window.confirm
    window.confirm = originalConfirm;
  });

  test('should handle loading error', async () => {
    mockConfigManager.getUserConfig.mockRejectedValue(new Error('Load failed'));

    render(<ConfigurationPanel {...mockProps} />);

    await waitFor(() => {
      expect(screen.getByText(/Failed to load configuration: Load failed/)).toBeInTheDocument();
    });
  });

  test('should show default prompt preview', async () => {
    render(<ConfigurationPanel {...mockProps} />);

    await waitFor(() => {
      expect(screen.getByText('Custom Prompts')).toBeInTheDocument();
    });

    // Switch to prompts tab
    const promptsTab = screen.getByText('Custom Prompts');
    fireEvent.click(promptsTab);

    expect(screen.getByText('Default Prompt Preview:')).toBeInTheDocument();
    expect(screen.getByText('Default prompt text')).toBeInTheDocument();
  });
});