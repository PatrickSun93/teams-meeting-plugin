// Security tests for data handling and protection
import CryptoJS from 'crypto-js';

describe('Data Security Tests', () => {
  let encryptionService;
  let secureStorageService;
  let auditLogService;

  beforeEach(() => {
    const EncryptionService = require('../../src/client/services/EncryptionService');
    const SecureStorageService = require('../../src/client/services/SecureStorageService');
    const AuditLogService = require('../../src/client/services/AuditLogService');
    
    encryptionService = new EncryptionService();
    secureStorageService = new SecureStorageService();
    auditLogService = new AuditLogService();
  });

  describe('Encryption Security Tests', () => {
    test('should use strong encryption algorithms', () => {
      const testData = 'Sensitive meeting transcript data';
      const encrypted = encryptionService.encrypt(testData);
      
      // Should not contain plaintext
      expect(encrypted).not.toContain(testData);
      
      // Should be properly encrypted
      expect(encrypted).toMatch(/^[A-Za-z0-9+/]+=*$/); // Base64 pattern
      
      // Should decrypt correctly
      const decrypted = encryptionService.decrypt(encrypted);
      expect(decrypted).toBe(testData);
    });

    test('should generate unique encryption keys', () => {
      const key1 = encryptionService.generateKey();
      const key2 = encryptionService.generateKey();
      
      expect(key1).not.toBe(key2);
      expect(key1.length).toBeGreaterThanOrEqual(32); // Minimum 256-bit key
      expect(key2.length).toBeGreaterThanOrEqual(32);
    });

    test('should use proper key derivation', () => {
      const password = 'user-password-123';
      const salt = encryptionService.generateSalt();
      
      const derivedKey1 = encryptionService.deriveKey(password, salt);
      const derivedKey2 = encryptionService.deriveKey(password, salt);
      
      // Same password and salt should produce same key
      expect(derivedKey1).toBe(derivedKey2);
      
      // Different salt should produce different key
      const differentSalt = encryptionService.generateSalt();
      const derivedKey3 = encryptionService.deriveKey(password, differentSalt);
      expect(derivedKey1).not.toBe(derivedKey3);
    });

    test('should protect against timing attacks', async () => {
      const correctKey = 'correct-key-12345';
      const wrongKey = 'wrong-key-67890';
      const testData = 'encrypted-data';
      
      const encrypted = encryptionService.encrypt(testData, correctKey);
      
      // Measure decryption time for correct key
      const start1 = performance.now();
      try {
        encryptionService.decrypt(encrypted, correctKey);
      } catch (e) {}
      const time1 = performance.now() - start1;
      
      // Measure decryption time for wrong key
      const start2 = performance.now();
      try {
        encryptionService.decrypt(encrypted, wrongKey);
      } catch (e) {}
      const time2 = performance.now() - start2;
      
      // Time difference should be minimal (< 10ms) to prevent timing attacks
      expect(Math.abs(time1 - time2)).toBeLessThan(10);
    });
  });

  describe('Secure Storage Tests', () => {
    test('should encrypt data before storage', async () => {
      const sensitiveData = {
        apiKey: 'sk-1234567890abcdef',
        transcript: 'Confidential meeting content',
        userInfo: { email: 'user@company.com' }
      };
      
      await secureStorageService.store('test-key', sensitiveData);
      
      // Check that raw storage doesn't contain plaintext
      const rawData = localStorage.getItem('test-key');
      expect(rawData).not.toContain(sensitiveData.apiKey);
      expect(rawData).not.toContain(sensitiveData.transcript);
      expect(rawData).not.toContain(sensitiveData.userInfo.email);
    });

    test('should validate data integrity', async () => {
      const originalData = { message: 'Important data' };
      
      await secureStorageService.store('integrity-test', originalData);
      
      // Tamper with stored data
      const storedData = localStorage.getItem('integrity-test');
      const tamperedData = storedData.replace(/.$/, 'X'); // Change last character
      localStorage.setItem('integrity-test', tamperedData);
      
      // Should detect tampering
      await expect(secureStorageService.retrieve('integrity-test'))
        .rejects.toThrow('Data integrity check failed');
    });

    test('should handle key rotation securely', async () => {
      const testData = { secret: 'confidential-info' };
      
      // Store with old key
      await secureStorageService.store('rotation-test', testData);
      
      // Rotate key
      await secureStorageService.rotateKey();
      
      // Should still be able to retrieve data
      const retrieved = await secureStorageService.retrieve('rotation-test');
      expect(retrieved).toEqual(testData);
    });

    test('should securely delete sensitive data', async () => {
      const sensitiveData = { password: 'secret123' };
      
      await secureStorageService.store('delete-test', sensitiveData);
      await secureStorageService.secureDelete('delete-test');
      
      // Data should be completely removed
      const rawData = localStorage.getItem('delete-test');
      expect(rawData).toBeNull();
      
      // Should not be retrievable
      const retrieved = await secureStorageService.retrieve('delete-test');
      expect(retrieved).toBeNull();
    });
  });

  describe('API Key Security Tests', () => {
    test('should mask API keys in logs', () => {
      const apiKey = 'sk-1234567890abcdefghijklmnopqrstuvwxyz';
      const logMessage = `Using API key: ${apiKey}`;
      
      const maskedLog = auditLogService.maskSensitiveData(logMessage);
      
      expect(maskedLog).not.toContain(apiKey);
      expect(maskedLog).toContain('sk-****');
    });

    test('should validate API key format', () => {
      const validKeys = [
        'sk-1234567890abcdef',
        'ak-abcdef1234567890',
        'claude-key-xyz123'
      ];
      
      const invalidKeys = [
        'invalid-key',
        'sk-',
        '',
        'sk-short'
      ];
      
      validKeys.forEach(key => {
        expect(secureStorageService.validateApiKey(key)).toBe(true);
      });
      
      invalidKeys.forEach(key => {
        expect(secureStorageService.validateApiKey(key)).toBe(false);
      });
    });

    test('should prevent API key exposure in error messages', () => {
      const apiKey = 'sk-secret123456789';
      
      try {
        // Simulate API call with invalid key
        throw new Error(`Authentication failed with key: ${apiKey}`);
      } catch (error) {
        const sanitizedError = auditLogService.sanitizeError(error);
        
        expect(sanitizedError.message).not.toContain(apiKey);
        expect(sanitizedError.message).toContain('Authentication failed');
      }
    });
  });

  describe('Input Validation and Sanitization Tests', () => {
    test('should sanitize user input to prevent XSS', () => {
      const maliciousInputs = [
        '<script>alert("xss")</script>',
        'javascript:alert("xss")',
        '<img src="x" onerror="alert(1)">',
        '"><script>alert("xss")</script>',
        'data:text/html,<script>alert("xss")</script>'
      ];
      
      maliciousInputs.forEach(input => {
        const sanitized = secureStorageService.sanitizeInput(input);
        
        expect(sanitized).not.toContain('<script>');
        expect(sanitized).not.toContain('javascript:');
        expect(sanitized).not.toContain('onerror=');
        expect(sanitized).not.toContain('data:text/html');
      });
    });

    test('should validate transcript content', () => {
      const validTranscript = {
        segments: [
          { speaker: 'John Doe', text: 'Hello everyone', timestamp: 1234567890 }
        ],
        meetingId: 'meeting-123',
        duration: 3600
      };
      
      const invalidTranscripts = [
        { segments: null }, // Missing required fields
        { segments: [], meetingId: '<script>alert(1)</script>' }, // XSS attempt
        { segments: 'not-an-array' }, // Wrong data type
        { segments: [{ text: 'x'.repeat(10000) }] } // Excessive length
      ];
      
      expect(secureStorageService.validateTranscript(validTranscript)).toBe(true);
      
      invalidTranscripts.forEach(transcript => {
        expect(secureStorageService.validateTranscript(transcript)).toBe(false);
      });
    });

    test('should prevent SQL injection in search queries', () => {
      const maliciousQueries = [
        "'; DROP TABLE transcripts; --",
        "' OR '1'='1",
        "'; INSERT INTO users VALUES ('hacker', 'password'); --",
        "' UNION SELECT * FROM sensitive_data --"
      ];
      
      maliciousQueries.forEach(query => {
        const sanitized = secureStorageService.sanitizeSearchQuery(query);
        
        expect(sanitized).not.toContain('DROP');
        expect(sanitized).not.toContain('INSERT');
        expect(sanitized).not.toContain('UNION');
        expect(sanitized).not.toContain('--');
        expect(sanitized).not.toContain("'");
      });
    });
  });

  describe('Audit Logging Security Tests', () => {
    test('should log security events', async () => {
      const securityEvents = [
        'user_login',
        'api_key_changed',
        'data_export',
        'encryption_key_rotation',
        'failed_authentication'
      ];
      
      for (const event of securityEvents) {
        await auditLogService.logSecurityEvent(event, { userId: 'test-user' });
      }
      
      const logs = await auditLogService.getSecurityLogs();
      
      expect(logs).toHaveLength(securityEvents.length);
      logs.forEach(log => {
        expect(log.timestamp).toBeDefined();
        expect(log.event).toBeDefined();
        expect(log.userId).toBe('test-user');
      });
    });

    test('should protect audit logs from tampering', async () => {
      const originalLog = {
        event: 'data_access',
        userId: 'user123',
        timestamp: Date.now()
      };
      
      await auditLogService.logEvent(originalLog);
      
      // Attempt to tamper with log
      const logs = await auditLogService.getLogs();
      const tamperedLog = { ...logs[0], userId: 'hacker' };
      
      // Should detect tampering
      const isValid = await auditLogService.validateLogIntegrity(tamperedLog);
      expect(isValid).toBe(false);
    });

    test('should anonymize sensitive data in logs', () => {
      const logData = {
        event: 'transcript_created',
        transcript: 'Confidential meeting discussion about Project X',
        participants: ['john.doe@company.com', 'jane.smith@company.com'],
        apiKey: 'sk-1234567890abcdef'
      };
      
      const anonymizedLog = auditLogService.anonymizeLogData(logData);
      
      expect(anonymizedLog.transcript).toContain('[REDACTED]');
      expect(anonymizedLog.participants).toEqual(['user1@***', 'user2@***']);
      expect(anonymizedLog.apiKey).toBe('sk-****');
    });
  });

  describe('Memory Security Tests', () => {
    test('should clear sensitive data from memory', () => {
      const sensitiveBuffer = new ArrayBuffer(1024);
      const sensitiveView = new Uint8Array(sensitiveBuffer);
      
      // Fill with sensitive data
      for (let i = 0; i < sensitiveView.length; i++) {
        sensitiveView[i] = Math.floor(Math.random() * 256);
      }
      
      // Clear memory
      secureStorageService.secureClearMemory(sensitiveBuffer);
      
      // Verify memory is cleared
      for (let i = 0; i < sensitiveView.length; i++) {
        expect(sensitiveView[i]).toBe(0);
      }
    });

    test('should prevent memory dumps of sensitive data', () => {
      const apiKey = 'sk-very-secret-key-123';
      
      // Store in secure container
      const secureContainer = secureStorageService.createSecureContainer();
      secureContainer.store('apiKey', apiKey);
      
      // Attempt to access via different methods
      expect(JSON.stringify(secureContainer)).not.toContain(apiKey);
      expect(Object.keys(secureContainer)).not.toContain('apiKey');
      expect(secureContainer.toString()).not.toContain(apiKey);
    });
  });

  describe('Network Security Tests', () => {
    test('should validate SSL/TLS certificates', async () => {
      const mockFetch = jest.fn();
      global.fetch = mockFetch;
      
      // Mock secure response
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ result: 'success' })
      });
      
      const apiClient = secureStorageService.createSecureApiClient();
      
      // Should only allow HTTPS URLs
      await expect(apiClient.request('http://insecure-api.com'))
        .rejects.toThrow('Insecure protocol not allowed');
      
      // Should allow HTTPS URLs
      await expect(apiClient.request('https://secure-api.com'))
        .resolves.toBeDefined();
    });

    test('should implement request signing', async () => {
      const apiClient = secureStorageService.createSecureApiClient();
      const requestData = { message: 'test request' };
      
      const signedRequest = await apiClient.signRequest(requestData);
      
      expect(signedRequest.signature).toBeDefined();
      expect(signedRequest.timestamp).toBeDefined();
      expect(signedRequest.nonce).toBeDefined();
      
      // Verify signature
      const isValid = await apiClient.verifySignature(signedRequest);
      expect(isValid).toBe(true);
    });

    test('should prevent replay attacks', async () => {
      const apiClient = secureStorageService.createSecureApiClient();
      const requestData = { message: 'test request' };
      
      const signedRequest = await apiClient.signRequest(requestData);
      
      // First request should succeed
      const result1 = await apiClient.sendSignedRequest(signedRequest);
      expect(result1.success).toBe(true);
      
      // Replay of same request should fail
      await expect(apiClient.sendSignedRequest(signedRequest))
        .rejects.toThrow('Request replay detected');
    });
  });
});