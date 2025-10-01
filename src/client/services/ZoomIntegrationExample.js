/**
 * Zoom Integration Example
 * Demonstrates how to use ZoomAdapter for meeting transcription
 */

import { ZoomAdapter } from './ZoomAdapter.js';
import { platformDetectionService } from './PlatformDetectionService.js';
import { PlatformConfigurationManager } from './PlatformConfigurationManager.js';
import { MeetingPlatform } from './PlatformAdapter.js';

/**
 * Example Zoom Integration Class
 * Shows how to integrate ZoomAdapter with the transcription system
 */
export class ZoomIntegrationExample {
  constructor() {
    this.zoomAdapter = null;
    this.configManager = new PlatformConfigurationManager();
    this.isTranscribing = false;
    this.audioStream = null;
    this.transcriptionCallback = null;
  }

  /**
   * Initialize Zoom integration
   * @returns {Promise<boolean>} Success status
   */
  async initialize() {
    try {
      // Initialize configuration manager
      await this.configManager.initialize();

      // Register ZoomAdapter with platform detection service
      platformDetectionService.registerAdapter(MeetingPlatform.ZOOM, ZoomAdapter);

      // Set up platform detection callback
      platformDetectionService.onPlatformDetected(this._handlePlatformChange.bind(this));

      console.log('Zoom integration initialized successfully');
      return true;
    } catch (error) {
      console.error('Failed to initialize Zoom integration:', error);
      return false;
    }
  }

  /**
   * Start Zoom meeting transcription
   * @param {object} meetingConfig - Zoom meeting configuration
   * @param {function} transcriptionCallback - Callback for transcription results
   * @returns {Promise<boolean>} Success status
   */
  async startTranscription(meetingConfig, transcriptionCallback) {
    try {
      // Detect and get Zoom adapter
      this.zoomAdapter = await platformDetectionService.detectAndGetAdapter();
      
      if (!this.zoomAdapter || this.zoomAdapter.getPlatform() !== MeetingPlatform.ZOOM) {
        throw new Error('Zoom platform not detected or adapter not available');
      }

      // Join meeting if configuration provided
      if (meetingConfig) {
        await this.zoomAdapter.joinMeeting(meetingConfig);
      }

      // Get audio stream
      this.audioStream = await this.zoomAdapter.getAudioStream();
      
      // Set up transcription callback
      this.transcriptionCallback = transcriptionCallback;
      
      // Start audio processing (this would integrate with your transcription engine)
      this._startAudioProcessing();
      
      this.isTranscribing = true;
      console.log('Zoom transcription started successfully');
      return true;
    } catch (error) {
      console.error('Failed to start Zoom transcription:', error);
      return false;
    }
  }

  /**
   * Stop transcription
   * @returns {Promise<boolean>} Success status
   */
  async stopTranscription() {
    try {
      this.isTranscribing = false;
      
      if (this.audioStream) {
        this.audioStream.getTracks().forEach(track => track.stop());
        this.audioStream = null;
      }
      
      console.log('Zoom transcription stopped');
      return true;
    } catch (error) {
      console.error('Error stopping transcription:', error);
      return false;
    }
  }

  /**
   * Send transcript to Zoom chat
   * @param {string} transcript - Transcript text
   * @returns {Promise<boolean>} Success status
   */
  async sendTranscriptToChat(transcript) {
    if (!this.zoomAdapter) {
      console.error('Zoom adapter not available');
      return false;
    }

    try {
      const capabilities = this.zoomAdapter.getCapabilities();
      if (!capabilities.chatIntegration) {
        console.warn('Chat integration not supported');
        return false;
      }

      // Format transcript for chat
      const formattedTranscript = this._formatTranscriptForChat(transcript);
      
      // Send to chat
      const success = await this.zoomAdapter.sendMessageToChat(formattedTranscript);
      
      if (success) {
        console.log('Transcript sent to Zoom chat successfully');
      }
      
      return success;
    } catch (error) {
      console.error('Failed to send transcript to chat:', error);
      return false;
    }
  }

  /**
   * Get meeting participants
   * @returns {Promise<Array>} Participants list
   */
  async getParticipants() {
    if (!this.zoomAdapter) {
      return [];
    }

    try {
      return await this.zoomAdapter.getParticipants();
    } catch (error) {
      console.error('Failed to get participants:', error);
      return [];
    }
  }

  /**
   * Get meeting information
   * @returns {Promise<object|null>} Meeting info
   */
  async getMeetingInfo() {
    if (!this.zoomAdapter) {
      return null;
    }

    try {
      return await this.zoomAdapter.getMeetingInfo();
    } catch (error) {
      console.error('Failed to get meeting info:', error);
      return null;
    }
  }

  /**
   * Check if current user is host
   * @returns {Promise<boolean>} Host status
   */
  async isHost() {
    if (!this.zoomAdapter) {
      return false;
    }

    try {
      return await this.zoomAdapter.isHost();
    } catch (error) {
      console.error('Failed to check host status:', error);
      return false;
    }
  }

  /**
   * Get Zoom platform capabilities
   * @returns {object} Capabilities
   */
  getCapabilities() {
    if (!this.zoomAdapter) {
      return {};
    }

    return this.zoomAdapter.getCapabilities();
  }

  /**
   * Handle platform change events
   * @private
   * @param {object} event - Platform change event
   */
  _handlePlatformChange(event) {
    const { oldPlatform, newPlatform } = event;
    
    console.log(`Platform changed from ${oldPlatform} to ${newPlatform}`);
    
    if (newPlatform === MeetingPlatform.ZOOM) {
      console.log('Zoom platform detected - ready for transcription');
    } else if (oldPlatform === MeetingPlatform.ZOOM && this.isTranscribing) {
      console.log('Left Zoom platform - stopping transcription');
      this.stopTranscription();
    }
  }

  /**
   * Start audio processing for transcription
   * @private
   */
  _startAudioProcessing() {
    if (!this.audioStream) {
      return;
    }

    // This is a simplified example - in real implementation,
    // you would integrate with your transcription engine
    console.log('Starting audio processing for transcription...');
    
    // Example: Set up audio context and processing
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const source = audioContext.createMediaStreamSource(this.audioStream);
    
    // Add audio processing nodes here
    // Connect to your transcription engine
    
    console.log('Audio processing started');
  }

  /**
   * Format transcript for Zoom chat
   * @private
   * @param {string} transcript - Raw transcript
   * @returns {string} Formatted transcript
   */
  _formatTranscriptForChat(transcript) {
    const timestamp = new Date().toLocaleTimeString();
    const header = `📝 Meeting Transcript (${timestamp})`;
    const separator = '─'.repeat(40);
    
    // Split long transcripts into chunks if needed
    const maxLength = 4000; // Zoom chat message limit
    if (transcript.length <= maxLength) {
      return `${header}\n${separator}\n${transcript}`;
    }
    
    // Return first chunk with indication of more content
    const truncated = transcript.substring(0, maxLength - 100);
    return `${header}\n${separator}\n${truncated}\n\n[Transcript truncated - full version available via export]`;
  }

  /**
   * Cleanup resources
   */
  async cleanup() {
    await this.stopTranscription();
    
    if (this.zoomAdapter) {
      await this.zoomAdapter.cleanup();
      this.zoomAdapter = null;
    }
    
    await this.configManager.cleanup();
    
    console.log('Zoom integration cleaned up');
  }
}

/**
 * Example usage function
 */
export async function exampleZoomIntegration() {
  const zoomIntegration = new ZoomIntegrationExample();
  
  try {
    // Initialize
    await zoomIntegration.initialize();
    
    // Example meeting configuration (you would get these from your Zoom app)
    const meetingConfig = {
      meetingNumber: '123456789',
      password: 'meeting-password',
      userName: 'Transcription Bot',
      signature: 'your-zoom-signature', // Generated using Zoom SDK
      apiKey: 'your-zoom-api-key'
    };
    
    // Start transcription with callback
    const transcriptionCallback = (transcriptionResult) => {
      console.log('Transcription result:', transcriptionResult);
      // Process transcription result here
    };
    
    await zoomIntegration.startTranscription(meetingConfig, transcriptionCallback);
    
    // Example: Send transcript after meeting
    setTimeout(async () => {
      const sampleTranscript = 'This is a sample meeting transcript...';
      await zoomIntegration.sendTranscriptToChat(sampleTranscript);
    }, 10000);
    
  } catch (error) {
    console.error('Zoom integration example failed:', error);
  }
}

export default ZoomIntegrationExample;