/**
 * Tests for ZoomErrorHandler
 */

import ZoomErrorHandler from '../ZoomErrorHandler';

describe('ZoomErrorHandler', () => {
  let handler;
  
  beforeEach(() => {
    jest.clearAllMocks();
    handler = new ZoomErrorHandler();
  });

  describe('constructor', () => {
    it('should initialize with default values', () => {
      expect(handler.rateLimitInfo).toBeInstanceOf(Map);
      expect(handler.retryQueue).toBeInstanceOf(Map);
      expect(handler.errorCallbacks).toBeInstanceOf(Map);
      expect(handler.maxRetries).toBe(3);
      expect(handler.baseRetryDelay).toBe(1000);
    });
  });

  describe('_parseZoomError', () => {
    it('should parse 400 bad request error', () => {
      const error = {
        response: {
          status: 400,
          data: { message: 'Invalid request' }
        }
      };

      const result = handler._parseZoomError(error);

      expect(result.type).toBe('bad_request');
      expect(result.code).toBe(400);
      expect(result.message).toBe('Invalid request');
      expect(result.retryable).toBe(false);
    });

    it('should parse 401 unauthorized error', () => {
      const error = {
        response: {
          status: 401,
          data: {}
        }
      };

      const result = handler._parseZoomError(error);

      expect(result.type).toBe('unauthorized');
      expect(result.retryable).toBe(true);
    });

    it('should parse 429 rate limit error', () => {
      const error = {
        response: {
          status: 429,
          headers: { 'retry-after': '60' }
        }
      };

      const result = handler._parseZoomError(error);

      expect(result.type).toBe('rate_limit');
      expect(result.retryable).toBe(true);
      expect(result.retryAfter).toBe(60000); // 60 seconds in ms
    });

    it('should parse 500 server error', () => {
      const error = {
        response: {
          status: 500,
          data: {}
        }
      };

      const result = handler._parseZoomError(error);

      expect(result.type).toBe('server_error');
      expect(result.retryable).toBe(true);
    });

    it('should parse network error', () => {
      const error = {
        code: 'NETWORK_ERROR',
        message: 'Network connection failed'
      };

      const result = handler._parseZoomError(error);

      expect(result.type).toBe('network_error');
      expect(result.retryable).toBe(true);
    });

    it('should parse timeout error', () => {
      const error = {
        message: 'Request timeout'
      };

      const result = handler._parseZoomError(error);

      expect(result.type).toBe('timeout');
      expect(result.retryable).toBe(true);
    });

    it('should handle unknown error', () => {
      const error = {
        message: 'Unknown error'
      };

      const result = handler._parseZoomError(error);

      expect(result.type).toBe('unknown');
      expect(result.retryable).toBe(false);
    });
  });

  describe('_parseRetryAfter', () => {
    it('should parse retry-after header as seconds', () => {
      const headers = { 'retry-after': '120' };

      const result = handler._parseRetryAfter(headers);

      expect(result).toBe(120000); // 120 seconds in ms
    });

    it('should parse Retry-After header (case insensitive)', () => {
      const headers = { 'Retry-After': '60' };

      const result = handler._parseRetryAfter(headers);

      expect(result).toBe(60000);
    });

    it('should parse retry-after header as date', () => {
      const futureDate = new Date(Date.now() + 30000); // 30 seconds from now
      const headers = { 'retry-after': futureDate.toISOString() };

      const result = handler._parseRetryAfter(headers);

      expect(result).toBeGreaterThan(25000); // Should be around 30 seconds
      expect(result).toBeLessThan(35000);
    });

    it('should return null for missing header', () => {
      const headers = {};

      const result = handler._parseRetryAfter(headers);

      expect(result).toBeNull();
    });

    it('should return null for invalid header', () => {
      const headers = { 'retry-after': 'invalid' };

      const result = handler._parseRetryAfter(headers);

      expect(result).toBeNull();
    });
  });

  describe('_getRecoveryStrategy', () => {
    it('should return wait_and_retry for rate limit', () => {
      const errorInfo = { type: 'rate_limit' };

      const strategy = handler._getRecoveryStrategy(errorInfo);

      expect(strategy).toBe('wait_and_retry');
    });

    it('should return refresh_token_and_retry for unauthorized', () => {
      const errorInfo = { type: 'unauthorized' };

      const strategy = handler._getRecoveryStrategy(errorInfo);

      expect(strategy).toBe('refresh_token_and_retry');
    });

    it('should return exponential_backoff_retry for server error', () => {
      const errorInfo = { type: 'server_error' };

      const strategy = handler._getRecoveryStrategy(errorInfo);

      expect(strategy).toBe('exponential_backoff_retry');
    });

    it('should return fail_immediately for bad request', () => {
      const errorInfo = { type: 'bad_request' };

      const strategy = handler._getRecoveryStrategy(errorInfo);

      expect(strategy).toBe('fail_immediately');
    });

    it('should return simple_retry for unknown error', () => {
      const errorInfo = { type: 'unknown' };

      const strategy = handler._getRecoveryStrategy(errorInfo);

      expect(strategy).toBe('simple_retry');
    });
  });

  describe('handleError', () => {
    it('should handle rate limit error with retry', async () => {
      const error = {
        response: {
          status: 429,
          headers: { 'retry-after': '1' } // 1 second
        }
      };

      const retryFunction = jest.fn().mockResolvedValue('success');
      
      // Mock sleep to resolve immediately
      jest.spyOn(handler, '_sleep').mockResolvedValue();

      const result = await handler.handleError(error, 'test_operation', retryFunction);

      expect(handler._sleep).toHaveBeenCalledWith(1000);
      expect(retryFunction).toHaveBeenCalled();
      expect(result).toBe('success');
    });

    it('should handle unauthorized error', async () => {
      const error = {
        response: {
          status: 401,
          data: {}
        }
      };

      const retryFunction = jest.fn().mockResolvedValue('success');
      
      // Mock sleep for token refresh wait
      jest.spyOn(handler, '_sleep').mockResolvedValue();

      const result = await handler.handleError(error, 'test_operation', retryFunction);

      expect(handler._sleep).toHaveBeenCalledWith(2000);
      expect(retryFunction).toHaveBeenCalled();
      expect(result).toBe('success');
    });

    it('should handle server error with exponential backoff', async () => {
      const error = {
        response: {
          status: 500,
          data: {}
        }
      };

      const retryFunction = jest.fn().mockResolvedValue('success');
      
      jest.spyOn(handler, '_sleep').mockResolvedValue();

      const result = await handler.handleError(error, 'test_operation', retryFunction);

      expect(handler._sleep).toHaveBeenCalledWith(1000); // Base delay
      expect(retryFunction).toHaveBeenCalled();
      expect(result).toBe('success');
    });

    it('should fail immediately for bad request', async () => {
      const error = {
        response: {
          status: 400,
          data: { message: 'Bad request' }
        }
      };

      await expect(handler.handleError(error, 'test_operation'))
        .rejects.toThrow('Zoom API error: Bad request');
    });

    it('should respect max retries', async () => {
      const error = {
        response: {
          status: 500,
          data: {}
        }
      };

      const retryFunction = jest.fn().mockRejectedValue(error);
      
      jest.spyOn(handler, '_sleep').mockResolvedValue();

      await expect(handler.handleError(error, 'test_operation', retryFunction))
        .rejects.toThrow('Max retries exceeded');

      expect(retryFunction).toHaveBeenCalledTimes(4); // Initial + 3 retries
    });
  });

  describe('onError', () => {
    it('should register error callback', () => {
      const callback = jest.fn();

      handler.onError('rate_limit', callback);

      expect(handler.errorCallbacks.get('rate_limit')).toContain(callback);
    });

    it('should call error callbacks when error occurs', async () => {
      const callback = jest.fn();
      handler.onError('rate_limit', callback);

      const error = {
        response: {
          status: 429,
          headers: { 'retry-after': '1' }
        }
      };

      const retryFunction = jest.fn().mockResolvedValue('success');
      jest.spyOn(handler, '_sleep').mockResolvedValue();

      await handler.handleError(error, 'test_operation', retryFunction);

      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'rate_limit'
        })
      );
    });
  });

  describe('shouldRateLimit', () => {
    it('should return false when no rate limit info exists', () => {
      const result = handler.shouldRateLimit('/meetings/123');

      expect(result).toBe(false);
    });

    it('should return true when rate limited', () => {
      const futureTime = Date.now() + 60000; // 1 minute from now
      handler.rateLimitInfo.set('meetings', { resetTime: futureTime });

      const result = handler.shouldRateLimit('/meetings/123');

      expect(result).toBe(true);
    });

    it('should return false when rate limit has expired', () => {
      const pastTime = Date.now() - 1000; // 1 second ago
      handler.rateLimitInfo.set('meetings', { resetTime: pastTime });

      const result = handler.shouldRateLimit('/meetings/123');

      expect(result).toBe(false);
    });
  });

  describe('getRecommendedDelay', () => {
    it('should return 0 when no rate limit info exists', () => {
      const result = handler.getRecommendedDelay('/meetings/123');

      expect(result).toBe(0);
    });

    it('should return remaining time when rate limited', () => {
      const futureTime = Date.now() + 30000; // 30 seconds from now
      handler.rateLimitInfo.set('meetings', { resetTime: futureTime });

      const result = handler.getRecommendedDelay('/meetings/123');

      expect(result).toBeGreaterThan(25000);
      expect(result).toBeLessThan(35000);
    });

    it('should return 0 when rate limit has expired', () => {
      const pastTime = Date.now() - 1000; // 1 second ago
      handler.rateLimitInfo.set('meetings', { resetTime: pastTime });

      const result = handler.getRecommendedDelay('/meetings/123');

      expect(result).toBe(0);
    });
  });

  describe('_getRateLimitKey', () => {
    it('should return meetings for meeting endpoints', () => {
      const result = handler._getRateLimitKey('/meetings/123/recordings');

      expect(result).toBe('meetings');
    });

    it('should return users for user endpoints', () => {
      const result = handler._getRateLimitKey('/users/me/recordings');

      expect(result).toBe('users');
    });

    it('should return recordings for recording endpoints', () => {
      const result = handler._getRateLimitKey('/recordings/123');

      expect(result).toBe('recordings');
    });

    it('should return general for other endpoints', () => {
      const result = handler._getRateLimitKey('/other/endpoint');

      expect(result).toBe('general');
    });
  });

  describe('getRateLimitStatus', () => {
    it('should return status for all rate limit keys', () => {
      const now = Date.now();
      handler.rateLimitInfo.set('meetings', { 
        resetTime: now + 30000, 
        lastHit: now - 5000 
      });
      handler.rateLimitInfo.set('users', { 
        resetTime: now - 1000, 
        lastHit: now - 10000 
      });

      const status = handler.getRateLimitStatus();

      expect(status.meetings.isLimited).toBe(true);
      expect(status.meetings.resetIn).toBeGreaterThan(25000);
      expect(status.users.isLimited).toBe(false);
      expect(status.users.resetIn).toBe(0);
    });
  });

  describe('clearRateLimitInfo', () => {
    it('should clear all rate limit info', () => {
      handler.rateLimitInfo.set('test', {});
      
      handler.clearRateLimitInfo();
      
      expect(handler.rateLimitInfo.size).toBe(0);
    });
  });

  describe('clearRetryQueue', () => {
    it('should clear retry queue', () => {
      handler.retryQueue.set('test', 1);
      
      handler.clearRetryQueue();
      
      expect(handler.retryQueue.size).toBe(0);
    });
  });
});