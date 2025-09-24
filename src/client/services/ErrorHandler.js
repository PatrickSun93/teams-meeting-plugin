/**
 * Comprehensive error handling service for the Teams transcription plugin
 * Provides centralized error management, recovery strategies, and user notifications
 */

export const ErrorSeverity = {
  INFO: 'info',
  WARNING: 'warning',
  ERROR: 'error',
  CRITICAL: 'critical'
};

export const ErrorCategory = {
  AUDIO_CAPTURE: 'audio_capture',
  TRANSCRIPTION: 'transcription',
  SPEAKER_IDENTIFICATION: 'speaker_identification',
  SUMMARY_GENERATION: 'summary_generation',
  CHAT_INTEGRATION: 'chat_integration',
  CONFIGURATION: 'configuration',
  NETWORK: 'network',
  AUTHENTICATION: 'authentication',
  STORAGE: 'storage',
  PLATFORM: 'platform'
};

export const ErrorCode = {
  // Audio errors
  MICROPHONE_ACCESS_DENIED: 'MICROPHONE_ACCESS_DENIED',
  AUDIO_STREAM_INTERRUPTED: 'AUDIO_STREAM_INTERRUPTED',
  POOR_AUDIO_QUALITY: 'POOR_AUDIO_QUALITY',
  AUDIO_PROCESSING_FAILED: 'AUDIO_PROCESSING_FAILED',
  
  // Transcription errors
  STT_SERVICE_UNAVAILABLE: 'STT_SERVICE_UNAVAILABLE',
  STT_API_RATE_LIMIT: 'STT_API_RATE_LIMIT',
  STT_AUTHENTICATION_FAILED: 'STT_AUTHENTICATION_FAILED',
  STT_QUOTA_EXCEEDED: 'STT_QUOTA_EXCEEDED',
  
  // Speaker identification errors
  SPEAKER_ENROLLMENT_FAILED: 'SPEAKER_ENROLLMENT_FAILED',
  INSUFFICIENT_AUDIO_SAMPLES: 'INSUFFICIENT_AUDIO_SAMPLES',
  OVERLAPPING_SPEECH_DETECTED: 'OVERLAPPING_SPEECH_DETECTED',
  
  // Summary generation errors
  AI_SERVICE_UNAVAILABLE: 'AI_SERVICE_UNAVAILABLE',
  INVALID_CUSTOM_PROMPT: 'INVALID_CUSTOM_PROMPT',
  SUMMARY_GENERATION_FAILED: 'SUMMARY_GENERATION_FAILED',
  
  // Chat integration errors
  CHAT_PERMISSION_DENIED: 'CHAT_PERMISSION_DENIED',
  CHAT_MESSAGE_TOO_LONG: 'CHAT_MESSAGE_TOO_LONG',
  CHAT_SERVICE_UNAVAILABLE: 'CHAT_SERVICE_UNAVAILABLE',
  
  // Network errors
  NETWORK_CONNECTION_LOST: 'NETWORK_CONNECTION_LOST',
  API_TIMEOUT: 'API_TIMEOUT',
  
  // Configuration errors
  INVALID_API_KEY: 'INVALID_API_KEY',
  MISSING_CONFIGURATION: 'MISSING_CONFIGURATION',
  
  // Storage errors
  STORAGE_QUOTA_EXCEEDED: 'STORAGE_QUOTA_EXCEEDED',
  STORAGE_ACCESS_DENIED: 'STORAGE_ACCESS_DENIED',
  
  // Platform errors
  TEAMS_SDK_ERROR: 'TEAMS_SDK_ERROR',
  PLATFORM_NOT_SUPPORTED: 'PLATFORM_NOT_SUPPORTED'
};

class ErrorHandler {
  constructor() {
    this.errorListeners = new Set();
    this.retryAttempts = new Map();
    this.maxRetryAttempts = 3;
    this.retryDelay = 1000; // Base delay in ms
    this.fallbackModes = new Map();
    this.diagnosticData = [];
  }

  /**
   * Register an error listener for notifications
   */
  addErrorListener(listener) {
    this.errorListeners.add(listener);
  }

  /**
   * Remove an error listener
   */
  removeErrorListener(listener) {
    this.errorListeners.delete(listener);
  }

  /**
   * Handle an error with automatic recovery strategies
   */
  async handleError(error, context = {}) {
    const errorInfo = this._categorizeError(error, context);
    
    // Log error for diagnostics
    this._logError(errorInfo);
    
    // Attempt recovery
    const recoveryResult = await this._attemptRecovery(errorInfo);
    
    // Notify listeners
    this._notifyListeners(errorInfo, recoveryResult);
    
    return recoveryResult;
  }

  /**
   * Handle audio capture errors
   */
  async handleAudioError(error, context = {}) {
    const errorInfo = {
      ...this._categorizeError(error, context),
      category: ErrorCategory.AUDIO_CAPTURE
    };

    switch (errorInfo.code) {
      case ErrorCode.MICROPHONE_ACCESS_DENIED:
        return this._handleMicrophoneAccessDenied(errorInfo);
      
      case ErrorCode.AUDIO_STREAM_INTERRUPTED:
        return this._handleAudioStreamInterrupted(errorInfo);
      
      case ErrorCode.POOR_AUDIO_QUALITY:
        return this._handlePoorAudioQuality(errorInfo);
      
      default:
        return this._handleGenericAudioError(errorInfo);
    }
  }

  /**
   * Handle transcription errors
   */
  async handleTranscriptionError(error, context = {}) {
    const errorInfo = {
      ...this._categorizeError(error, context),
      category: ErrorCategory.TRANSCRIPTION
    };

    switch (errorInfo.code) {
      case ErrorCode.STT_SERVICE_UNAVAILABLE:
        return this._handleSTTServiceUnavailable(errorInfo);
      
      case ErrorCode.STT_API_RATE_LIMIT:
        return this._handleSTTRateLimit(errorInfo);
      
      case ErrorCode.STT_AUTHENTICATION_FAILED:
        return this._handleSTTAuthenticationFailed(errorInfo);
      
      default:
        return this._handleGenericTranscriptionError(errorInfo);
    }
  }

  /**
   * Handle summary generation errors
   */
  async handleSummaryError(error, context = {}) {
    const errorInfo = {
      ...this._categorizeError(error, context),
      category: ErrorCategory.SUMMARY_GENERATION
    };

    switch (errorInfo.code) {
      case ErrorCode.AI_SERVICE_UNAVAILABLE:
        return this._handleAIServiceUnavailable(errorInfo);
      
      case ErrorCode.INVALID_CUSTOM_PROMPT:
        return this._handleInvalidCustomPrompt(errorInfo);
      
      default:
        return this._handleGenericSummaryError(errorInfo);
    }
  }

  /**
   * Notify user of error with appropriate severity
   */
  notifyUser(message, severity = ErrorSeverity.ERROR, actions = []) {
    const notification = {
      message,
      severity,
      actions,
      timestamp: new Date(),
      id: this._generateId()
    };

    this.errorListeners.forEach(listener => {
      if (typeof listener === 'function') {
        listener(notification);
      }
    });
  }

  /**
   * Enable fallback mode for a specific component
   */
  enableFallbackMode(component, mode) {
    this.fallbackModes.set(component, mode);
    this.notifyUser(
      `Switched to ${mode} mode for ${component} due to service issues`,
      ErrorSeverity.WARNING
    );
  }

  /**
   * Check if component is in fallback mode
   */
  isInFallbackMode(component) {
    return this.fallbackModes.has(component);
  }

  /**
   * Get diagnostic information
   */
  getDiagnosticInfo() {
    return {
      recentErrors: this.diagnosticData.slice(-10),
      fallbackModes: Object.fromEntries(this.fallbackModes),
      retryAttempts: Object.fromEntries(this.retryAttempts),
      timestamp: new Date()
    };
  }

  /**
   * Clear diagnostic data
   */
  clearDiagnosticData() {
    this.diagnosticData = [];
    this.retryAttempts.clear();
  }

  // Private methods

  _categorizeError(error, context) {
    const errorInfo = {
      originalError: error,
      message: error.message || 'Unknown error',
      stack: error.stack,
      context,
      timestamp: new Date(),
      id: this._generateId()
    };

    // Determine error code and severity
    if (error.name === 'NotAllowedError' || error.message?.includes('microphone')) {
      errorInfo.code = ErrorCode.MICROPHONE_ACCESS_DENIED;
      errorInfo.severity = ErrorSeverity.ERROR;
    } else if (error.message?.includes('rate limit')) {
      errorInfo.code = ErrorCode.STT_API_RATE_LIMIT;
      errorInfo.severity = ErrorSeverity.WARNING;
    } else if (error.message?.includes('authentication') || error.status === 401) {
      errorInfo.code = ErrorCode.STT_AUTHENTICATION_FAILED;
      errorInfo.severity = ErrorSeverity.ERROR;
    } else if (error.message?.includes('network') || error.name === 'NetworkError') {
      errorInfo.code = ErrorCode.NETWORK_CONNECTION_LOST;
      errorInfo.severity = ErrorSeverity.WARNING;
    } else {
      errorInfo.code = 'UNKNOWN_ERROR';
      errorInfo.severity = ErrorSeverity.ERROR;
    }

    return errorInfo;
  }

  _logError(errorInfo) {
    this.diagnosticData.push({
      ...errorInfo,
      // Remove circular references for storage
      originalError: {
        name: errorInfo.originalError.name,
        message: errorInfo.originalError.message
      }
    });

    // Keep only last 100 errors
    if (this.diagnosticData.length > 100) {
      this.diagnosticData = this.diagnosticData.slice(-100);
    }

    console.error('Error handled:', errorInfo);
  }

  async _attemptRecovery(errorInfo) {
    const recoveryKey = `${errorInfo.code}_${errorInfo.context.component || 'unknown'}`;
    const attempts = this.retryAttempts.get(recoveryKey) || 0;

    if (attempts >= this.maxRetryAttempts) {
      return {
        success: false,
        action: 'max_retries_exceeded',
        fallbackEnabled: this._enableFallbackIfAvailable(errorInfo)
      };
    }

    // Increment retry count
    this.retryAttempts.set(recoveryKey, attempts + 1);

    // Wait before retry with exponential backoff
    const delay = this.retryDelay * Math.pow(2, attempts);
    await new Promise(resolve => setTimeout(resolve, delay));

    try {
      // Attempt recovery based on error type
      const recoveryResult = await this._executeRecovery(errorInfo);
      
      if (recoveryResult.success) {
        // Reset retry count on success
        this.retryAttempts.delete(recoveryKey);
      }
      
      return recoveryResult;
    } catch (recoveryError) {
      console.error('Recovery attempt failed:', recoveryError);
      return {
        success: false,
        action: 'recovery_failed',
        error: recoveryError
      };
    }
  }

  async _executeRecovery(errorInfo) {
    switch (errorInfo.code) {
      case ErrorCode.NETWORK_CONNECTION_LOST:
        return this._recoverNetworkConnection();
      
      case ErrorCode.STT_API_RATE_LIMIT:
        return this._recoverFromRateLimit();
      
      case ErrorCode.AUDIO_STREAM_INTERRUPTED:
        return this._recoverAudioStream();
      
      default:
        return { success: false, action: 'no_recovery_strategy' };
    }
  }

  async _recoverNetworkConnection() {
    // Test network connectivity
    try {
      await fetch('https://api.github.com/zen', { 
        method: 'HEAD',
        timeout: 5000 
      });
      return { success: true, action: 'network_restored' };
    } catch {
      return { success: false, action: 'network_still_down' };
    }
  }

  async _recoverFromRateLimit() {
    // Switch to local STT if available
    if (this._isLocalSTTAvailable()) {
      this.enableFallbackMode('transcription', 'local-only');
      return { success: true, action: 'switched_to_local_stt' };
    }
    return { success: false, action: 'no_local_fallback' };
  }

  async _recoverAudioStream() {
    // Attempt to reinitialize audio capture
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach(track => track.stop()); // Test and cleanup
      return { success: true, action: 'audio_stream_restored' };
    } catch {
      return { success: false, action: 'audio_access_still_denied' };
    }
  }

  _enableFallbackIfAvailable(errorInfo) {
    const component = errorInfo.context.component;
    
    switch (component) {
      case 'transcription':
        if (this._isLocalSTTAvailable()) {
          this.enableFallbackMode(component, 'local-only');
          return true;
        }
        break;
      
      case 'summary':
        this.enableFallbackMode(component, 'basic-summary');
        return true;
      
      case 'speaker-identification':
        this.enableFallbackMode(component, 'no-speaker-id');
        return true;
    }
    
    return false;
  }

  _isLocalSTTAvailable() {
    // Check if local STT service is configured and available
    return typeof window !== 'undefined' && 
           ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window);
  }

  // Specific error handlers

  async _handleMicrophoneAccessDenied(errorInfo) {
    this.notifyUser(
      'Microphone access denied. Please allow microphone permissions and refresh the page.',
      ErrorSeverity.ERROR,
      [
        { label: 'Refresh Page', action: () => window.location.reload() },
        { label: 'Help', action: () => this._showMicrophoneHelp() }
      ]
    );
    
    return { success: false, action: 'user_intervention_required' };
  }

  async _handleAudioStreamInterrupted(errorInfo) {
    this.notifyUser(
      'Audio stream was interrupted. Attempting to reconnect...',
      ErrorSeverity.WARNING
    );
    
    return this._recoverAudioStream();
  }

  async _handlePoorAudioQuality(errorInfo) {
    this.notifyUser(
      'Poor audio quality detected. Transcription accuracy may be reduced.',
      ErrorSeverity.WARNING,
      [
        { label: 'Check Microphone', action: () => this._showAudioHelp() }
      ]
    );
    
    return { success: true, action: 'quality_warning_shown' };
  }

  async _handleGenericAudioError(errorInfo) {
    this.notifyUser(
      'Audio processing error occurred. Please check your microphone settings.',
      ErrorSeverity.ERROR
    );
    
    return { success: false, action: 'generic_audio_error' };
  }

  async _handleSTTServiceUnavailable(errorInfo) {
    const fallbackEnabled = this._enableFallbackIfAvailable(errorInfo);
    
    if (fallbackEnabled) {
      this.notifyUser(
        'Cloud transcription service unavailable. Switched to local processing.',
        ErrorSeverity.WARNING
      );
      return { success: true, action: 'fallback_enabled' };
    } else {
      this.notifyUser(
        'Transcription service unavailable and no fallback available.',
        ErrorSeverity.ERROR
      );
      return { success: false, action: 'no_fallback_available' };
    }
  }

  async _handleSTTRateLimit(errorInfo) {
    this.notifyUser(
      'Transcription rate limit reached. Switching to local processing or waiting...',
      ErrorSeverity.WARNING
    );
    
    return this._recoverFromRateLimit();
  }

  async _handleSTTAuthenticationFailed(errorInfo) {
    this.notifyUser(
      'Transcription service authentication failed. Please check your API key.',
      ErrorSeverity.ERROR,
      [
        { label: 'Update API Key', action: () => this._showConfigurationPanel() }
      ]
    );
    
    return { success: false, action: 'authentication_failed' };
  }

  async _handleGenericTranscriptionError(errorInfo) {
    this.notifyUser(
      'Transcription error occurred. Attempting recovery...',
      ErrorSeverity.WARNING
    );
    
    return this._enableFallbackIfAvailable(errorInfo) 
      ? { success: true, action: 'fallback_enabled' }
      : { success: false, action: 'no_recovery_possible' };
  }

  async _handleAIServiceUnavailable(errorInfo) {
    this.enableFallbackMode('summary', 'basic-summary');
    this.notifyUser(
      'AI summary service unavailable. Using basic summary generation.',
      ErrorSeverity.WARNING
    );
    
    return { success: true, action: 'basic_summary_fallback' };
  }

  async _handleInvalidCustomPrompt(errorInfo) {
    this.notifyUser(
      'Custom prompt is invalid. Using default prompt for summary generation.',
      ErrorSeverity.WARNING,
      [
        { label: 'Edit Prompt', action: () => this._showPromptEditor() }
      ]
    );
    
    return { success: true, action: 'default_prompt_used' };
  }

  async _handleGenericSummaryError(errorInfo) {
    this.enableFallbackMode('summary', 'basic-summary');
    this.notifyUser(
      'Summary generation failed. Using basic summary.',
      ErrorSeverity.WARNING
    );
    
    return { success: true, action: 'basic_summary_fallback' };
  }

  _notifyListeners(errorInfo, recoveryResult) {
    const notification = {
      type: 'error',
      errorInfo,
      recoveryResult,
      timestamp: new Date()
    };

    this.errorListeners.forEach(listener => {
      try {
        listener(notification);
      } catch (listenerError) {
        console.error('Error in error listener:', listenerError);
      }
    });
  }

  _generateId() {
    return Math.random().toString(36).substr(2, 9);
  }

  _showMicrophoneHelp() {
    // Implementation would show help dialog
    console.log('Showing microphone help');
  }

  _showAudioHelp() {
    // Implementation would show audio troubleshooting
    console.log('Showing audio help');
  }

  _showConfigurationPanel() {
    // Implementation would open configuration
    console.log('Opening configuration panel');
  }

  _showPromptEditor() {
    // Implementation would open prompt editor
    console.log('Opening prompt editor');
  }
}

// Create singleton instance
export const errorHandler = new ErrorHandler();

export default ErrorHandler;