/**
 * Platform Detection Service
 * Handles automatic detection and instantiation of platform adapters
 */

import { PlatformAdapter, MeetingPlatform } from './PlatformAdapter.js';
import { TeamsAdapter } from './TeamsAdapter.js';
import { ZoomAdapter } from './ZoomAdapter.js';
import { MeetAdapter } from './MeetAdapter.js';
import { GenericAdapter } from './GenericAdapter.js';

/**
 * Platform Detection Service Class
 */
export class PlatformDetectionService {
  constructor() {
    this.currentPlatform = MeetingPlatform.UNKNOWN;
    this.currentAdapter = null;
    this.detectionInterval = null;
    this.detectionCallbacks = [];
    this.platformAdapters = new Map();
  }

  /**
   * Register a platform adapter class
   * @param {string} platform - Platform identifier
   * @param {class} AdapterClass - Adapter class constructor
   */
  registerAdapter(platform, AdapterClass) {
    this.platformAdapters.set(platform, AdapterClass);
  }

  /**
   * Detect current platform and return adapter
   * @param {boolean} forceDetection - Force re-detection
   * @returns {Promise<PlatformAdapter|null>} Platform adapter instance
   */
  async detectAndGetAdapter(forceDetection = false) {
    const detectedPlatform = this._detectCurrentPlatform();
    
    // If platform hasn't changed and we have an adapter, return it
    if (!forceDetection && 
        detectedPlatform === this.currentPlatform && 
        this.currentAdapter && 
        this.currentAdapter.isInitialized()) {
      return this.currentAdapter;
    }

    // Platform changed or force detection requested
    if (detectedPlatform !== this.currentPlatform || forceDetection) {
      await this._handlePlatformChange(detectedPlatform);
    }

    // Create new adapter if needed
    if (!this.currentAdapter && detectedPlatform !== MeetingPlatform.UNKNOWN) {
      this.currentAdapter = await this._createAdapter(detectedPlatform);
    }

    return this.currentAdapter;
  }

  /**
   * Get current platform without creating adapter
   * @returns {string} Current platform identifier
   */
  getCurrentPlatform() {
    return this._detectCurrentPlatform();
  }

  /**
   * Get current adapter instance
   * @returns {PlatformAdapter|null} Current adapter
   */
  getCurrentAdapter() {
    return this.currentAdapter;
  }

  /**
   * Start continuous platform detection
   * @param {number} interval - Detection interval in milliseconds (default: 5000)
   */
  startContinuousDetection(interval = 5000) {
    this.stopContinuousDetection();
    
    this.detectionInterval = setInterval(async () => {
      try {
        await this.detectAndGetAdapter();
      } catch (error) {
        console.error('Error during continuous platform detection:', error);
      }
    }, interval);
  }

  /**
   * Stop continuous platform detection
   */
  stopContinuousDetection() {
    if (this.detectionInterval) {
      clearInterval(this.detectionInterval);
      this.detectionInterval = null;
    }
  }

  /**
   * Add callback for platform detection events
   * @param {function} callback - Callback function
   */
  onPlatformDetected(callback) {
    this.detectionCallbacks.push(callback);
  }

  /**
   * Remove platform detection callback
   * @param {function} callback - Callback function to remove
   */
  removeDetectionCallback(callback) {
    const index = this.detectionCallbacks.indexOf(callback);
    if (index > -1) {
      this.detectionCallbacks.splice(index, 1);
    }
  }

  /**
   * Get platform capabilities for current or specified platform
   * @param {string} platform - Platform identifier (optional)
   * @returns {object|null} Platform capabilities
   */
  async getPlatformCapabilities(platform = null) {
    const targetPlatform = platform || this.currentPlatform;
    
    if (targetPlatform === MeetingPlatform.UNKNOWN) {
      return null;
    }

    // If we have current adapter for the target platform, use it
    if (this.currentAdapter && this.currentAdapter.getPlatform() === targetPlatform) {
      return this.currentAdapter.getCapabilities();
    }

    // Create temporary adapter to get capabilities
    try {
      const tempAdapter = await this._createAdapter(targetPlatform);
      const capabilities = tempAdapter.getCapabilities();
      await tempAdapter.cleanup();
      return capabilities;
    } catch (error) {
      console.error(`Error getting capabilities for platform ${targetPlatform}:`, error);
      return null;
    }
  }

  /**
   * Check if platform is supported
   * @param {string} platform - Platform identifier
   * @returns {boolean} Support status
   */
  isPlatformSupported(platform) {
    return this.platformAdapters.has(platform) || platform === MeetingPlatform.UNKNOWN;
  }

  /**
   * Get list of supported platforms
   * @returns {string[]} Array of supported platform identifiers
   */
  getSupportedPlatforms() {
    return Array.from(this.platformAdapters.keys());
  }

  /**
   * Cleanup resources
   */
  async cleanup() {
    this.stopContinuousDetection();
    
    if (this.currentAdapter) {
      await this.currentAdapter.cleanup();
      this.currentAdapter = null;
    }
    
    this.detectionCallbacks = [];
    this.currentPlatform = MeetingPlatform.UNKNOWN;
  }

  /**
   * Detect current platform based on environment
   * @private
   * @returns {string} Platform identifier
   */
  _detectCurrentPlatform() {
    return PlatformAdapter.detectPlatform();
  }

  /**
   * Handle platform change
   * @private
   * @param {string} newPlatform - New platform identifier
   */
  async _handlePlatformChange(newPlatform) {
    const oldPlatform = this.currentPlatform;
    
    // Cleanup old adapter
    if (this.currentAdapter) {
      await this.currentAdapter.cleanup();
      this.currentAdapter = null;
    }
    
    this.currentPlatform = newPlatform;
    
    // Notify callbacks
    this._notifyDetectionCallbacks({
      oldPlatform,
      newPlatform,
      timestamp: new Date()
    });
  }

  /**
   * Create adapter for specified platform
   * @private
   * @param {string} platform - Platform identifier
   * @returns {Promise<PlatformAdapter|null>} Adapter instance
   */
  async _createAdapter(platform) {
    if (!this.platformAdapters.has(platform)) {
      console.warn(`No adapter registered for platform: ${platform}`);
      return null;
    }

    try {
      const AdapterClass = this.platformAdapters.get(platform);
      const adapter = new AdapterClass();
      
      // Initialize the adapter
      const initialized = await adapter.initialize();
      if (!initialized) {
        console.warn(`Failed to initialize adapter for platform: ${platform}`);
        await adapter.cleanup();
        return null;
      }
      
      return adapter;
    } catch (error) {
      console.error(`Error creating adapter for platform ${platform}:`, error);
      return null;
    }
  }

  /**
   * Notify detection callbacks
   * @private
   * @param {object} eventData - Event data
   */
  _notifyDetectionCallbacks(eventData) {
    this.detectionCallbacks.forEach(callback => {
      try {
        callback(eventData);
      } catch (error) {
        console.error('Error in platform detection callback:', error);
      }
    });
  }
}

// Create and configure singleton instance
const platformDetectionService = new PlatformDetectionService();

// Register platform adapters
platformDetectionService.registerAdapter(MeetingPlatform.TEAMS, TeamsAdapter);
platformDetectionService.registerAdapter(MeetingPlatform.ZOOM, ZoomAdapter);
platformDetectionService.registerAdapter(MeetingPlatform.GOOGLE_MEET, MeetAdapter);
platformDetectionService.registerAdapter(MeetingPlatform.UNKNOWN, GenericAdapter);

export { platformDetectionService };