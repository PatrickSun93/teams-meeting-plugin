// Configuration Hook - React hook for managing configuration state
import { useState, useEffect, useCallback } from 'react';
import ConfigurationManager from '../services/ConfigurationManager.js';

const useConfiguration = () => {
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [configManager] = useState(() => new ConfigurationManager());

  // Load configuration on mount
  useEffect(() => {
    loadConfiguration();
  }, []);

  const loadConfiguration = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const userConfig = await configManager.getUserConfig();
      setConfig(userConfig);
    } catch (err) {
      setError(err.message);
      console.error('Failed to load configuration:', err);
    } finally {
      setLoading(false);
    }
  }, [configManager]);

  const updateConfiguration = useCallback(async (newConfig) => {
    try {
      setError(null);
      const savedConfig = await configManager.saveUserConfig(newConfig);
      setConfig(savedConfig);
      return { success: true, config: savedConfig };
    } catch (err) {
      setError(err.message);
      console.error('Failed to update configuration:', err);
      return { success: false, error: err.message };
    }
  }, [configManager]);

  const getApiKey = useCallback(async (service) => {
    try {
      return await configManager.getApiKey(service);
    } catch (err) {
      console.error(`Failed to get API key for ${service}:`, err);
      return null;
    }
  }, [configManager]);

  const saveApiKey = useCallback(async (service, apiKey) => {
    try {
      await configManager.saveApiKey(service, apiKey);
      return { success: true };
    } catch (err) {
      console.error(`Failed to save API key for ${service}:`, err);
      return { success: false, error: err.message };
    }
  }, [configManager]);

  const getUserPrompt = useCallback(async () => {
    try {
      return await configManager.getUserPrompt();
    } catch (err) {
      console.error('Failed to get user prompt:', err);
      return configManager.getDefaultPrompt();
    }
  }, [configManager]);

  const saveUserPrompt = useCallback(async (prompt) => {
    try {
      await configManager.saveUserPrompt(config?.userId || 'default', prompt);
      return { success: true };
    } catch (err) {
      console.error('Failed to save user prompt:', err);
      return { success: false, error: err.message };
    }
  }, [configManager, config]);

  const isCloudServiceConfigured = useCallback((service) => {
    if (!config) return false;
    
    const provider = configManager.getAvailableSTTProviders().find(p => p.id === service) ||
                    configManager.getAvailableAIProviders().find(p => p.id === service);
    
    return provider && !provider.requiresApiKey; // Local services don't need API keys
  }, [config, configManager]);

  const requiresConsent = useCallback(() => {
    if (!config) return false;
    return configManager.requiresConsent(config.sttProvider) || 
           configManager.requiresConsent(config.aiProvider);
  }, [config, configManager]);

  const hasValidConfiguration = useCallback(() => {
    if (!config) return false;
    
    // Check if consent is given for cloud services
    if (requiresConsent() && !config.consentGiven) {
      return false;
    }
    
    // Validate configuration
    const validation = configManager.validateConfig(config);
    return validation.isValid;
  }, [config, configManager, requiresConsent]);

  const getSTTProviders = useCallback(() => {
    return configManager.getAvailableSTTProviders();
  }, [configManager]);

  const getAIProviders = useCallback(() => {
    return configManager.getAvailableAIProviders();
  }, [configManager]);

  const resetConfiguration = useCallback(async () => {
    try {
      await configManager.clearAllData();
      await loadConfiguration();
      return { success: true };
    } catch (err) {
      setError(err.message);
      return { success: false, error: err.message };
    }
  }, [configManager, loadConfiguration]);

  return {
    // State
    config,
    loading,
    error,
    
    // Actions
    loadConfiguration,
    updateConfiguration,
    getApiKey,
    saveApiKey,
    getUserPrompt,
    saveUserPrompt,
    resetConfiguration,
    
    // Utilities
    isCloudServiceConfigured,
    requiresConsent,
    hasValidConfiguration,
    getSTTProviders,
    getAIProviders,
    
    // Manager instance (for advanced usage)
    configManager
  };
};

export default useConfiguration;