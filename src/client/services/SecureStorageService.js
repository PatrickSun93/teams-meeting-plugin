/**
 * SecureStorageService - Handles secure storage of API keys and sensitive configuration
 * Uses encryption and secure storage practices for sensitive data
 */

import EncryptionService from './EncryptionService.js';

class SecureStorageService {
  constructor() {
    this.encryptionService = new EncryptionService();
    this.storagePrefix = 'teams_transcription_secure_';
    this.keyStorageKey = this.storagePrefix + 'master_key';
    this.saltStorageKey = this.storagePrefix + 'salt';
    this.masterKey = null;
  }

  /**
   * Initialize secure storage with user password
   * @param {string} password - User password for encryption
   * @returns {Promise<boolean>} Success status
   */
  async initialize(password) {
    try {
      let salt = this.getSalt();
      if (!salt) {
        salt = this.encryptionService.generateSalt();
        this.storeSalt(salt);
      }

      this.masterKey = await this.encryptionService.deriveKeyFromPassword(password, salt);
      return true;
    } catch (error) {
      console.error('Failed to initialize secure storage:', error);
      return false;
    }
  }

  /**
   * Check if secure storage is initialized
   * @returns {boolean} Initialization status
   */
  isInitialized() {
    return this.masterKey !== null;
  }

  /**
   * Store salt in localStorage
   * @param {Uint8Array} salt - Salt to store
   */
  storeSalt(salt) {
    const saltArray = Array.from(salt);
    localStorage.setItem(this.saltStorageKey, JSON.stringify(saltArray));
  }

  /**
   * Retrieve salt from localStorage
   * @returns {Uint8Array|null} Retrieved salt or null if not found
   */
  getSalt() {
    const saltData = localStorage.getItem(this.saltStorageKey);
    if (!saltData) return null;
    
    try {
      const saltArray = JSON.parse(saltData);
      return new Uint8Array(saltArray);
    } catch (error) {
      console.error('Failed to parse salt:', error);
      return null;
    }
  }

  /**
   * Securely store API key
   * @param {string} provider - API provider name (openai, claude, azure)
   * @param {string} apiKey - API key to store
   * @returns {Promise<boolean>} Success status
   */
  async storeApiKey(provider, apiKey) {
    if (!this.isInitialized()) {
      throw new Error('Secure storage not initialized');
    }

    try {
      const { encryptedData, iv } = await this.encryptionService.encrypt(apiKey, this.masterKey);
      
      const storageData = {
        encryptedData: Array.from(new Uint8Array(encryptedData)),
        iv: Array.from(iv),
        timestamp: Date.now(),
        provider: provider
      };

      const storageKey = this.storagePrefix + 'api_key_' + provider;
      localStorage.setItem(storageKey, JSON.stringify(storageData));
      
      return true;
    } catch (error) {
      console.error('Failed to store API key:', error);
      return false;
    }
  }

  /**
   * Retrieve and decrypt API key
   * @param {string} provider - API provider name
   * @returns {Promise<string|null>} Decrypted API key or null if not found
   */
  async getApiKey(provider) {
    if (!this.isInitialized()) {
      throw new Error('Secure storage not initialized');
    }

    try {
      const storageKey = this.storagePrefix + 'api_key_' + provider;
      const storageData = localStorage.getItem(storageKey);
      
      if (!storageData) return null;

      const data = JSON.parse(storageData);
      const encryptedData = new Uint8Array(data.encryptedData).buffer;
      const iv = new Uint8Array(data.iv);

      return await this.encryptionService.decrypt(encryptedData, iv, this.masterKey);
    } catch (error) {
      console.error('Failed to retrieve API key:', error);
      return null;
    }
  }

  /**
   * Remove API key from storage
   * @param {string} provider - API provider name
   * @returns {boolean} Success status
   */
  removeApiKey(provider) {
    try {
      const storageKey = this.storagePrefix + 'api_key_' + provider;
      localStorage.removeItem(storageKey);
      return true;
    } catch (error) {
      console.error('Failed to remove API key:', error);
      return false;
    }
  }

  /**
   * List all stored API key providers
   * @returns {string[]} Array of provider names
   */
  getStoredProviders() {
    const providers = [];
    const prefix = this.storagePrefix + 'api_key_';
    
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(prefix)) {
        const provider = key.substring(prefix.length);
        providers.push(provider);
      }
    }
    
    return providers;
  }

  /**
   * Securely store configuration data
   * @param {string} configKey - Configuration key
   * @param {object} configData - Configuration data to store
   * @returns {Promise<boolean>} Success status
   */
  async storeSecureConfig(configKey, configData) {
    if (!this.isInitialized()) {
      throw new Error('Secure storage not initialized');
    }

    try {
      const { encryptedData, iv } = await this.encryptionService.encrypt(configData, this.masterKey);
      
      const storageData = {
        encryptedData: Array.from(new Uint8Array(encryptedData)),
        iv: Array.from(iv),
        timestamp: Date.now(),
        configKey: configKey
      };

      const storageKey = this.storagePrefix + 'config_' + configKey;
      localStorage.setItem(storageKey, JSON.stringify(storageData));
      
      return true;
    } catch (error) {
      console.error('Failed to store secure config:', error);
      return false;
    }
  }

  /**
   * Retrieve and decrypt configuration data
   * @param {string} configKey - Configuration key
   * @returns {Promise<object|null>} Decrypted configuration or null if not found
   */
  async getSecureConfig(configKey) {
    if (!this.isInitialized()) {
      throw new Error('Secure storage not initialized');
    }

    try {
      const storageKey = this.storagePrefix + 'config_' + configKey;
      const storageData = localStorage.getItem(storageKey);
      
      if (!storageData) return null;

      const data = JSON.parse(storageData);
      const encryptedData = new Uint8Array(data.encryptedData).buffer;
      const iv = new Uint8Array(data.iv);

      const decryptedString = await this.encryptionService.decrypt(encryptedData, iv, this.masterKey);
      return JSON.parse(decryptedString);
    } catch (error) {
      console.error('Failed to retrieve secure config:', error);
      return null;
    }
  }

  /**
   * Clear all secure storage data
   * @returns {boolean} Success status
   */
  clearAll() {
    try {
      const keysToRemove = [];
      
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(this.storagePrefix)) {
          keysToRemove.push(key);
        }
      }
      
      keysToRemove.forEach(key => localStorage.removeItem(key));
      this.masterKey = null;
      
      return true;
    } catch (error) {
      console.error('Failed to clear secure storage:', error);
      return false;
    }
  }

  /**
   * Change master password
   * @param {string} oldPassword - Current password
   * @param {string} newPassword - New password
   * @returns {Promise<boolean>} Success status
   */
  async changePassword(oldPassword, newPassword) {
    try {
      // Verify old password
      const salt = this.getSalt();
      if (!salt) return false;

      const oldKey = await this.encryptionService.deriveKeyFromPassword(oldPassword, salt);
      
      // Test decryption with old key
      const testProviders = this.getStoredProviders();
      if (testProviders.length > 0) {
        const testKey = await this.getApiKeyWithKey(testProviders[0], oldKey);
        if (!testKey) return false;
      }

      // Generate new salt and key
      const newSalt = this.encryptionService.generateSalt();
      const newKey = await this.encryptionService.deriveKeyFromPassword(newPassword, newSalt);

      // Re-encrypt all data with new key
      const providers = this.getStoredProviders();
      const reencryptedData = {};

      for (const provider of providers) {
        const apiKey = await this.getApiKeyWithKey(provider, oldKey);
        if (apiKey) {
          reencryptedData[provider] = apiKey;
        }
      }

      // Update storage
      this.storeSalt(newSalt);
      this.masterKey = newKey;

      // Store re-encrypted data
      for (const [provider, apiKey] of Object.entries(reencryptedData)) {
        await this.storeApiKey(provider, apiKey);
      }

      return true;
    } catch (error) {
      console.error('Failed to change password:', error);
      return false;
    }
  }

  /**
   * Get API key with specific key (internal helper)
   * @param {string} provider - Provider name
   * @param {CryptoKey} key - Decryption key
   * @returns {Promise<string|null>} Decrypted API key
   */
  async getApiKeyWithKey(provider, key) {
    try {
      const storageKey = this.storagePrefix + 'api_key_' + provider;
      const storageData = localStorage.getItem(storageKey);
      
      if (!storageData) return null;

      const data = JSON.parse(storageData);
      const encryptedData = new Uint8Array(data.encryptedData).buffer;
      const iv = new Uint8Array(data.iv);

      return await this.encryptionService.decrypt(encryptedData, iv, key);
    } catch (error) {
      return null;
    }
  }
}

export default SecureStorageService;