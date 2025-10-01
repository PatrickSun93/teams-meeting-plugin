/**
 * Zoom Error Handler
 * Handles Zoom API errors, rate limits, and recovery strategies
 */

class ZoomErrorHandler {
  constructor() {
    this.rateLimitInfo = new Map();
    this.retryQueue = new Map();
    this.errorCallbacks = new Map();
    this.maxRetries = 3;
    this.baseRetryDelay = 1000; // 1 second
  }

  /**
   * Handle Zoom API error with appropriate recovery strategy
   * @param {Error} error - The error to handle
   * @param {string} operation - The operation that failed
   * @param {Function} retryFunction - Function to retry the operation
   * @returns {Promise<any>} Result of recovery attempt
   */
  async handleError(error, operation, retryFunction = null) {
    const errorInfo = this._parseZoomError(error);
    
    console.error(`Zoom API error in ${operation}:`, errorInfo);

    // Update rate limit tracking
    if (errorInfo.type === 'rate_limit') {
      this._updateRateLimitInfo(errorInfo);
    }

    // Determine recovery strategy
    const strategy = this._getRecoveryStrategy(errorInfo);
    
    // Execute recovery strategy
    return await this._executeRecoveryStrategy(
      strategy, 
      errorInfo, 
      operation, 
      retryFunction
    );
  }

  /**
   * Register error callback for specific error types
   * @param {string} errorType - Type of error to listen for
   * @param {Function} callback - Callback function
   */
  onError(errorType, callback) {
    if (!this.errorCallbacks.has(errorType)) {
      this.errorCallbacks.set(errorType, []);
    }
    this.errorCallbacks.get(errorType).push(callback);
  }

  /**
   * Check if operation should be rate limited
   * @param {string} endpoint - API endpoint
   * @returns {boolean} Whether to rate limit
   */
  shouldRateLimit(endpoint) {
    const rateLimitKey = this._getRateLimitKey(endpoint);
    const rateLimitInfo = this.rateLimitInfo.get(rateLimitKey);
    
    if (!rateLimitInfo) {
      return false;
    }

    const now = Date.now();
    return now < rateLimitInfo.resetTime;
  }

  /**
   * Get recommended delay before next request
   * @param {string} endpoint - API endpoint
   * @returns {number} Delay in milliseconds
   */
  getRecommendedDelay(endpoint) {
    const rateLimitKey = this._getRateLimitKey(endpoint);
    const rateLimitInfo = this.rateLimitInfo.get(rateLimitKey);
    
    if (!rateLimitInfo) {
      return 0;
    }

    const now = Date.now();
    return Math.max(0, rateLimitInfo.resetTime - now);
  }

  /**
   * Parse Zoom API error response
   * @private
   */
  _parseZoomError(error) {
    const errorInfo = {
      type: 'unknown',
      code: null,
      message: error.message,
      retryable: false,
      retryAfter: null,
      originalError: error
    };

    // Handle HTTP response errors
    if (error.response) {
      const status = error.response.status;
      const data = error.response.data;

      errorInfo.code = status;

      switch (status) {
        case 400:
          errorInfo.type = 'bad_request';
          errorInfo.message = data?.message || 'Bad request';
          break;

        case 401:
          errorInfo.type = 'unauthorized';
          errorInfo.message = 'Authentication failed';
          errorInfo.retryable = true;
          break;

        case 403:
          errorInfo.type = 'forbidden';
          errorInfo.message = data?.message || 'Access forbidden';
          break;

        case 404:
          errorInfo.type = 'not_found';
          errorInfo.message = data?.message || 'Resource not found';
          break;

        case 429:
          errorInfo.type = 'rate_limit';
          errorInfo.message = 'Rate limit exceeded';
          errorInfo.retryable = true;
          errorInfo.retryAfter = this._parseRetryAfter(error.response.headers);
          break;

        case 500:
        case 502:
        case 503:
        case 504:
          errorInfo.type = 'server_error';
          errorInfo.message = 'Zoom server error';
          errorInfo.retryable = true;
          break;

        default:
          errorInfo.type = 'http_error';
          errorInfo.message = `HTTP ${status}: ${data?.message || 'Unknown error'}`;
      }
    }
    // Handle network errors
    else if (error.code === 'NETWORK_ERROR' || error.message.includes('Network')) {
      errorInfo.type = 'network_error';
      errorInfo.message = 'Network connection failed';
      errorInfo.retryable = true;
    }
    // Handle timeout errors
    else if (error.code === 'TIMEOUT' || error.message.includes('timeout')) {
      errorInfo.type = 'timeout';
      errorInfo.message = 'Request timeout';
      errorInfo.retryable = true;
    }

    return errorInfo;
  }

  /**
   * Get recovery strategy for error type
   * @private
   */
  _getRecoveryStrategy(errorInfo) {
    switch (errorInfo.type) {
      case 'rate_limit':
        return 'wait_and_retry';
      
      case 'unauthorized':
        return 'refresh_token_and_retry';
      
      case 'server_error':
      case 'network_error':
      case 'timeout':
        return 'exponential_backoff_retry';
      
      case 'bad_request':
      case 'forbidden':
      case 'not_found':
        return 'fail_immediately';
      
      default:
        return 'simple_retry';
    }
  }

  /**
   * Execute recovery strategy
   * @private
   */
  async _executeRecoveryStrategy(strategy, errorInfo, operation, retryFunction) {
    // Notify error callbacks
    this._notifyErrorCallbacks(errorInfo.type, errorInfo);

    switch (strategy) {
      case 'wait_and_retry':
        return await this._waitAndRetry(errorInfo, operation, retryFunction);
      
      case 'refresh_token_and_retry':
        return await this._refreshTokenAndRetry(errorInfo, operation, retryFunction);
      
      case 'exponential_backoff_retry':
        return await this._exponentialBackoffRetry(errorInfo, operation, retryFunction);
      
      case 'simple_retry':
        return await this._simpleRetry(errorInfo, operation, retryFunction);
      
      case 'fail_immediately':
      default:
        throw new Error(`Zoom API error: ${errorInfo.message}`);
    }
  }

  /**
   * Wait for rate limit reset and retry
   * @private
   */
  async _waitAndRetry(errorInfo, operation, retryFunction) {
    if (!retryFunction) {
      throw new Error('Rate limit exceeded and no retry function provided');
    }

    const delay = errorInfo.retryAfter || 60000; // Default 1 minute
    console.log(`Rate limited. Waiting ${delay}ms before retry...`);

    await this._sleep(delay);
    
    try {
      return await retryFunction();
    } catch (error) {
      // If retry also fails, handle recursively (with limit)
      const retryKey = `${operation}_${Date.now()}`;
      const retryCount = this.retryQueue.get(retryKey) || 0;
      
      if (retryCount < this.maxRetries) {
        this.retryQueue.set(retryKey, retryCount + 1);
        return await this.handleError(error, operation, retryFunction);
      } else {
        this.retryQueue.delete(retryKey);
        throw error;
      }
    }
  }

  /**
   * Refresh OAuth token and retry
   * @private
   */
  async _refreshTokenAndRetry(errorInfo, operation, retryFunction) {
    if (!retryFunction) {
      throw new Error('Authentication failed and no retry function provided');
    }

    try {
      // Notify that token refresh is needed
      this._notifyErrorCallbacks('token_refresh_needed', errorInfo);
      
      // Wait a bit for token refresh to complete
      await this._sleep(2000);
      
      return await retryFunction();
    } catch (error) {
      throw new Error('Authentication failed after token refresh attempt');
    }
  }

  /**
   * Retry with exponential backoff
   * @private
   */
  async _exponentialBackoffRetry(errorInfo, operation, retryFunction) {
    if (!retryFunction) {
      throw errorInfo.originalError;
    }

    const retryKey = `${operation}_${Date.now()}`;
    const retryCount = this.retryQueue.get(retryKey) || 0;
    
    if (retryCount >= this.maxRetries) {
      this.retryQueue.delete(retryKey);
      throw new Error(`Max retries exceeded for ${operation}`);
    }

    const delay = this.baseRetryDelay * Math.pow(2, retryCount);
    console.log(`Retrying ${operation} in ${delay}ms (attempt ${retryCount + 1}/${this.maxRetries})`);

    await this._sleep(delay);
    this.retryQueue.set(retryKey, retryCount + 1);

    try {
      const result = await retryFunction();
      this.retryQueue.delete(retryKey);
      return result;
    } catch (error) {
      return await this.handleError(error, operation, retryFunction);
    }
  }

  /**
   * Simple retry with fixed delay
   * @private
   */
  async _simpleRetry(errorInfo, operation, retryFunction) {
    if (!retryFunction) {
      throw errorInfo.originalError;
    }

    await this._sleep(this.baseRetryDelay);
    
    try {
      return await retryFunction();
    } catch (error) {
      throw error; // Don't retry again for simple retry
    }
  }

  /**
   * Update rate limit tracking information
   * @private
   */
  _updateRateLimitInfo(errorInfo) {
    const rateLimitKey = 'zoom_api'; // Could be more specific per endpoint
    const resetTime = Date.now() + (errorInfo.retryAfter || 60000);
    
    this.rateLimitInfo.set(rateLimitKey, {
      resetTime: resetTime,
      lastHit: Date.now()
    });
  }

  /**
   * Parse retry-after header
   * @private
   */
  _parseRetryAfter(headers) {
    const retryAfter = headers['retry-after'] || headers['Retry-After'];
    
    if (!retryAfter) {
      return null;
    }

    // If it's a number, it's seconds
    const seconds = parseInt(retryAfter, 10);
    if (!isNaN(seconds)) {
      return seconds * 1000; // Convert to milliseconds
    }

    // If it's a date string, parse it
    const date = new Date(retryAfter);
    if (!isNaN(date.getTime())) {
      return Math.max(0, date.getTime() - Date.now());
    }

    return null;
  }

  /**
   * Get rate limit key for endpoint
   * @private
   */
  _getRateLimitKey(endpoint) {
    // Zoom has different rate limits for different endpoint categories
    if (endpoint.includes('/meetings/')) {
      return 'meetings';
    } else if (endpoint.includes('/users/')) {
      return 'users';
    } else if (endpoint.includes('/recordings/')) {
      return 'recordings';
    }
    return 'general';
  }

  /**
   * Notify error callbacks
   * @private
   */
  _notifyErrorCallbacks(errorType, errorInfo) {
    const callbacks = this.errorCallbacks.get(errorType) || [];
    callbacks.forEach(callback => {
      try {
        callback(errorInfo);
      } catch (error) {
        console.error('Error in error callback:', error);
      }
    });
  }

  /**
   * Sleep for specified milliseconds
   * @private
   */
  _sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get current rate limit status
   * @returns {Object} Rate limit status
   */
  getRateLimitStatus() {
    const status = {};
    
    for (const [key, info] of this.rateLimitInfo.entries()) {
      const now = Date.now();
      status[key] = {
        isLimited: now < info.resetTime,
        resetIn: Math.max(0, info.resetTime - now),
        lastHit: info.lastHit
      };
    }
    
    return status;
  }

  /**
   * Clear rate limit information
   */
  clearRateLimitInfo() {
    this.rateLimitInfo.clear();
  }

  /**
   * Clear retry queue
   */
  clearRetryQueue() {
    this.retryQueue.clear();
  }
}

export default ZoomErrorHandler;