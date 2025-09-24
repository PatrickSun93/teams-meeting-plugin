/**
 * Recovery strategies for different types of failures in the transcription system
 */

import { ErrorCode, ErrorCategory } from './ErrorHandler';

export class RecoveryStrategies {
  constructor(configManager, transcriptionEngine, audioProcessor) {
    this.configManager = configManager;
    this.transcriptionEngine = transcriptionEngine;
    this.audioProcessor = audioProcessor;
    this.fallbackModes = new Map();
  }

  /**
   * Execute recovery strategy based on error type
   */
  async executeRecovery(errorInfo) {
    const strategy = this.getRecoveryStrategy(errorInfo);
    
    if (!strategy) {
      return {
        success: false,
        action: 'no_strategy_available',
        message: 'No recovery strategy available for this error'
      };
    }

    try {
      return await strategy.execute(errorInfo);
    } catch (error) {
      console.error('Recovery strategy failed:', error);
      return {
        success: false,
        action: 'strategy_execution_failed',
        message: `Recovery strategy failed: ${error.message}`,
        error
      };
    }
  }

  /**
   * Get appropriate recovery strategy for error
   */
  getRecoveryStrategy(errorInfo) {
    const strategies = {
      // Audio-related errors
      [ErrorCode.MICROPHONE_ACCESS_DENIED]: new MicrophoneAccessRecovery(),
      [ErrorCode.AUDIO_STREAM_INTERRUPTED]: new AudioStreamRecovery(this.audioProcessor),
      [ErrorCode.POOR_AUDIO_QUALITY]: new AudioQualityRecovery(),
      
      // Transcription errors
      [ErrorCode.STT_SERVICE_UNAVAILABLE]: new STTServiceRecovery(this.transcriptionEngine, this.configManager),
      [ErrorCode.STT_API_RATE_LIMIT]: new RateLimitRecovery(this.transcriptionEngine, this.configManager),
      [ErrorCode.STT_AUTHENTICATION_FAILED]: new AuthenticationRecovery(this.configManager),
      [ErrorCode.STT_QUOTA_EXCEEDED]: new QuotaRecovery(this.transcriptionEngine, this.configManager),
      
      // Network errors
      [ErrorCode.NETWORK_CONNECTION_LOST]: new NetworkRecovery(),
      [ErrorCode.API_TIMEOUT]: new TimeoutRecovery(),
      
      // Storage errors
      [ErrorCode.STORAGE_QUOTA_EXCEEDED]: new StorageRecovery(),
      [ErrorCode.STORAGE_ACCESS_DENIED]: new StorageAccessRecovery(),
      
      // Summary generation errors
      [ErrorCode.AI_SERVICE_UNAVAILABLE]: new AIServiceRecovery(this.configManager),
      [ErrorCode.INVALID_CUSTOM_PROMPT]: new PromptRecovery(),
      
      // Chat integration errors
      [ErrorCode.CHAT_PERMISSION_DENIED]: new ChatPermissionRecovery(),
      [ErrorCode.CHAT_MESSAGE_TOO_LONG]: new ChatMessageRecovery(),
      
      // Platform errors
      [ErrorCode.TEAMS_SDK_ERROR]: new TeamsSDKRecovery(),
      [ErrorCode.PLATFORM_NOT_SUPPORTED]: new PlatformRecovery()
    };

    return strategies[errorInfo.code];
  }

  /**
   * Enable fallback mode for a component
   */
  enableFallbackMode(component, mode, reason) {
    this.fallbackModes.set(component, {
      mode,
      reason,
      enabledAt: new Date(),
      originalConfig: this.getComponentConfig(component)
    });

    console.log(`Fallback mode enabled: ${component} -> ${mode} (${reason})`);
  }

  /**
   * Disable fallback mode and restore original configuration
   */
  disableFallbackMode(component) {
    const fallback = this.fallbackModes.get(component);
    
    if (fallback) {
      this.restoreComponentConfig(component, fallback.originalConfig);
      this.fallbackModes.delete(component);
      console.log(`Fallback mode disabled: ${component}`);
      return true;
    }
    
    return false;
  }

  /**
   * Check if component is in fallback mode
   */
  isInFallbackMode(component) {
    return this.fallbackModes.has(component);
  }

  /**
   * Get fallback mode info for component
   */
  getFallbackInfo(component) {
    return this.fallbackModes.get(component);
  }

  /**
   * Get all active fallback modes
   */
  getActiveFallbackModes() {
    return Object.fromEntries(this.fallbackModes);
  }

  // Private helper methods
  getComponentConfig(component) {
    // Implementation would get current configuration for component
    return {};
  }

  restoreComponentConfig(component, config) {
    // Implementation would restore original configuration
    console.log(`Restoring config for ${component}:`, config);
  }
}

// Base recovery strategy class
class BaseRecoveryStrategy {
  async execute(errorInfo) {
    throw new Error('Recovery strategy must implement execute method');
  }

  async testRecovery() {
    // Override in subclasses to test if recovery was successful
    return true;
  }
}

// Microphone access recovery
class MicrophoneAccessRecovery extends BaseRecoveryStrategy {
  async execute(errorInfo) {
    // Cannot automatically recover from denied microphone access
    // User intervention required
    return {
      success: false,
      action: 'user_intervention_required',
      message: 'Microphone access denied. User must grant permissions manually.',
      userActions: [
        'Click the microphone icon in the browser address bar',
        'Select "Allow" for microphone access',
        'Refresh the page and try again'
      ]
    };
  }
}

// Audio stream recovery
class AudioStreamRecovery extends BaseRecoveryStrategy {
  constructor(audioProcessor) {
    super();
    this.audioProcessor = audioProcessor;
  }

  async execute(errorInfo) {
    try {
      // Attempt to reinitialize audio stream
      await this.audioProcessor.stopCapture();
      await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
      
      const stream = await this.audioProcessor.startCapture();
      
      if (stream && stream.active) {
        return {
          success: true,
          action: 'audio_stream_restored',
          message: 'Audio stream successfully restored'
        };
      } else {
        throw new Error('Stream not active after restart');
      }
    } catch (error) {
      return {
        success: false,
        action: 'audio_restart_failed',
        message: `Failed to restart audio stream: ${error.message}`,
        fallbackSuggestion: 'Try refreshing the page or checking microphone settings'
      };
    }
  }
}

// Audio quality recovery
class AudioQualityRecovery extends BaseRecoveryStrategy {
  async execute(errorInfo) {
    // For poor audio quality, we continue but with warnings
    return {
      success: true,
      action: 'quality_warning_acknowledged',
      message: 'Continuing with reduced audio quality. Consider checking microphone settings.',
      recommendations: [
        'Check microphone connection',
        'Reduce background noise',
        'Move closer to microphone',
        'Check for other applications using microphone'
      ]
    };
  }
}

// STT service recovery
class STTServiceRecovery extends BaseRecoveryStrategy {
  constructor(transcriptionEngine, configManager) {
    super();
    this.transcriptionEngine = transcriptionEngine;
    this.configManager = configManager;
  }

  async execute(errorInfo) {
    try {
      // Try to switch to local STT if available
      const hasLocalSTT = this.checkLocalSTTAvailability();
      
      if (hasLocalSTT) {
        await this.transcriptionEngine.switchToLocalSTT();
        
        return {
          success: true,
          action: 'switched_to_local_stt',
          message: 'Switched to local speech recognition due to cloud service unavailability',
          fallbackMode: 'local-only'
        };
      }

      // Try alternative cloud service
      const alternativeService = await this.findAlternativeSTTService();
      
      if (alternativeService) {
        await this.transcriptionEngine.switchSTTProvider(alternativeService);
        
        return {
          success: true,
          action: 'switched_to_alternative_service',
          message: `Switched to ${alternativeService} STT service`,
          fallbackMode: 'alternative-cloud'
        };
      }

      return {
        success: false,
        action: 'no_stt_alternatives',
        message: 'No alternative STT services available'
      };
    } catch (error) {
      return {
        success: false,
        action: 'stt_recovery_failed',
        message: `STT recovery failed: ${error.message}`
      };
    }
  }

  checkLocalSTTAvailability() {
    return !!(window.SpeechRecognition || window.webkitSpeechRecognition);
  }

  async findAlternativeSTTService() {
    const config = await this.configManager.getConfiguration();
    const currentProvider = config.sttProvider;
    
    const availableProviders = ['openai', 'azure', 'local'];
    const alternatives = availableProviders.filter(p => p !== currentProvider);
    
    for (const provider of alternatives) {
      if (await this.isProviderConfigured(provider)) {
        return provider;
      }
    }
    
    return null;
  }

  async isProviderConfigured(provider) {
    const config = await this.configManager.getConfiguration();
    
    switch (provider) {
      case 'openai':
        return !!config.openaiApiKey;
      case 'azure':
        return !!config.azureApiKey;
      case 'local':
        return this.checkLocalSTTAvailability();
      default:
        return false;
    }
  }
}

// Rate limit recovery
class RateLimitRecovery extends BaseRecoveryStrategy {
  constructor(transcriptionEngine, configManager) {
    super();
    this.transcriptionEngine = transcriptionEngine;
    this.configManager = configManager;
  }

  async execute(errorInfo) {
    try {
      // First, try to switch to local STT
      const hasLocalSTT = !!(window.SpeechRecognition || window.webkitSpeechRecognition);
      
      if (hasLocalSTT) {
        await this.transcriptionEngine.switchToLocalSTT();
        
        return {
          success: true,
          action: 'switched_to_local_due_to_rate_limit',
          message: 'Switched to local STT due to rate limiting',
          fallbackMode: 'local-only'
        };
      }

      // If no local STT, implement exponential backoff
      const backoffDelay = this.calculateBackoffDelay(errorInfo);
      
      return {
        success: false,
        action: 'rate_limit_backoff',
        message: `Rate limit exceeded. Will retry in ${backoffDelay / 1000} seconds`,
        retryAfter: backoffDelay,
        fallbackMode: 'delayed-retry'
      };
    } catch (error) {
      return {
        success: false,
        action: 'rate_limit_recovery_failed',
        message: `Rate limit recovery failed: ${error.message}`
      };
    }
  }

  calculateBackoffDelay(errorInfo) {
    const baseDelay = 5000; // 5 seconds
    const maxDelay = 300000; // 5 minutes
    const attempt = errorInfo.context.retryAttempt || 0;
    
    const delay = Math.min(baseDelay * Math.pow(2, attempt), maxDelay);
    return delay;
  }
}

// Authentication recovery
class AuthenticationRecovery extends BaseRecoveryStrategy {
  constructor(configManager) {
    super();
    this.configManager = configManager;
  }

  async execute(errorInfo) {
    // Authentication failures require user intervention
    return {
      success: false,
      action: 'authentication_failed_user_action_required',
      message: 'API authentication failed. Please check your API key configuration.',
      userActions: [
        'Open configuration panel',
        'Verify API key is correct',
        'Check API key permissions',
        'Ensure API key is not expired'
      ],
      fallbackSuggestion: 'Consider using local STT as an alternative'
    };
  }
}

// Network recovery
class NetworkRecovery extends BaseRecoveryStrategy {
  async execute(errorInfo) {
    try {
      // Test network connectivity
      const isOnline = await this.testConnectivity();
      
      if (isOnline) {
        return {
          success: true,
          action: 'network_restored',
          message: 'Network connectivity restored'
        };
      }

      return {
        success: false,
        action: 'network_still_offline',
        message: 'Network connectivity not restored',
        fallbackSuggestion: 'Switch to local-only mode until connectivity is restored'
      };
    } catch (error) {
      return {
        success: false,
        action: 'network_test_failed',
        message: `Network test failed: ${error.message}`
      };
    }
  }

  async testConnectivity() {
    try {
      const response = await fetch('https://api.github.com/zen', {
        method: 'HEAD',
        mode: 'no-cors',
        cache: 'no-cache'
      });
      return true;
    } catch (error) {
      return navigator.onLine;
    }
  }
}

// Storage recovery
class StorageRecovery extends BaseRecoveryStrategy {
  async execute(errorInfo) {
    try {
      // Attempt to free up storage space
      const freedSpace = await this.cleanupOldData();
      
      if (freedSpace > 0) {
        return {
          success: true,
          action: 'storage_cleaned',
          message: `Freed ${freedSpace} bytes of storage space`,
          freedBytes: freedSpace
        };
      }

      return {
        success: false,
        action: 'storage_cleanup_insufficient',
        message: 'Unable to free sufficient storage space',
        userActions: [
          'Clear browser cache and data',
          'Delete old transcripts manually',
          'Free up disk space on device'
        ]
      };
    } catch (error) {
      return {
        success: false,
        action: 'storage_cleanup_failed',
        message: `Storage cleanup failed: ${error.message}`
      };
    }
  }

  async cleanupOldData() {
    // Implementation would clean up old transcripts, cache, etc.
    // This is a placeholder
    return 0;
  }
}

// AI service recovery
class AIServiceRecovery extends BaseRecoveryStrategy {
  constructor(configManager) {
    super();
    this.configManager = configManager;
  }

  async execute(errorInfo) {
    try {
      // Switch to basic summary generation
      return {
        success: true,
        action: 'switched_to_basic_summary',
        message: 'AI service unavailable. Using basic summary generation.',
        fallbackMode: 'basic-summary'
      };
    } catch (error) {
      return {
        success: false,
        action: 'summary_fallback_failed',
        message: `Summary fallback failed: ${error.message}`
      };
    }
  }
}

// Additional recovery strategies for other error types...
class QuotaRecovery extends RateLimitRecovery {} // Similar to rate limit
class TimeoutRecovery extends NetworkRecovery {} // Similar to network issues
class StorageAccessRecovery extends StorageRecovery {} // Similar to storage issues
class PromptRecovery extends BaseRecoveryStrategy {
  async execute(errorInfo) {
    return {
      success: true,
      action: 'using_default_prompt',
      message: 'Invalid custom prompt. Using default prompt for summary generation.'
    };
  }
}

class ChatPermissionRecovery extends BaseRecoveryStrategy {
  async execute(errorInfo) {
    return {
      success: false,
      action: 'chat_permission_denied',
      message: 'Cannot send to chat due to permissions. Transcript will be available for manual sharing.',
      alternativeActions: ['Download transcript', 'Copy to clipboard', 'Email transcript']
    };
  }
}

class ChatMessageRecovery extends BaseRecoveryStrategy {
  async execute(errorInfo) {
    return {
      success: true,
      action: 'split_long_message',
      message: 'Message too long for chat. Will split into multiple messages.',
      fallbackMode: 'split-messages'
    };
  }
}

class TeamsSDKRecovery extends BaseRecoveryStrategy {
  async execute(errorInfo) {
    return {
      success: false,
      action: 'teams_sdk_error',
      message: 'Teams SDK error occurred. Try refreshing the Teams app.',
      userActions: ['Refresh Teams app', 'Restart Teams', 'Check Teams app permissions']
    };
  }
}

class PlatformRecovery extends BaseRecoveryStrategy {
  async execute(errorInfo) {
    return {
      success: false,
      action: 'platform_not_supported',
      message: 'Current platform is not supported for full functionality.',
      fallbackMode: 'limited-functionality'
    };
  }
}

export default RecoveryStrategies;