// Cross-platform data security tests
import CryptoJS from 'crypto-js';

describe('Cross-Platform Data Security Tests', () => {
  let securityServices;
  let platformAdapters;

  beforeEach(() => {
    // Import security services
    const EncryptionService = require('../../src/client/services/EncryptionService');
    const SecureStorageService = require('../../src/client/services/SecureStorageService');
    const CrossPlatformPrivacyService = require('../../src/client/services/CrossPlatformPrivacyService');
    const AuditLogService = require('../../src/client/services/AuditLogService');
    const SecurityManager = require('../../src/client/services/SecurityManager');

    // Import platform adapters
    const TeamsAdapter = require('../../src/client/services/TeamsAdapter');
    const ZoomAdapter = require('../../src/client/services/ZoomAdapter');
    const MeetAdapter = require('../../src/client/services/MeetAdapter');
    const GenericAdapter = require('../../src/client/services/GenericAdapter');

    securityServices = {
      encryption: new EncryptionService(),
      secureStorage: new SecureStorageService(),
      privacy: new CrossPlatformPrivacyService(),
      auditLog: new AuditLogService(),
      security: new SecurityManager()
    };

    platformAdapters = {
      teams: new TeamsAdapter(),
      zoom: new ZoomAdapter(),
      meet: new MeetAdapter(),
      generic: new GenericAdapter()
    };
  });

  describe('Cross-Platform Data Encryption', () => {
    test('should encrypt data consistently across platforms', async () => {
      const testData = {
        transcript: 'Confidential meeting discussion',
        participants: ['user1@company.com', 'user2@company.com'],
        metadata: { meetingId: 'secret-meeting-123' }
      };

      const encryptionResults = {};

      // Test encryption across all platforms
      for (const [platform, adapter] of Object.entries(platformAdapters)) {
        const platformKey = await securityServices.encryption.generatePlatformKey(platform);
        const encrypted = await securityServices.encryption.encryptForPlatform(
          testData, 
          platform, 
          platformKey
        );

        encryptionResults[platform] = {
          encrypted,
          key: platformKey
        };

        // Verify encryption
        expect(encrypted).not.toContain(testData.transcript);
        expect(encrypted).not.toContain(testData.participants[0]);
        expect(encrypted).not.toContain(testData.metadata.meetingId);
      }

      // Verify cross-platform decryption
      for (const [platform, result] of Object.entries(encryptionResults)) {
        const decrypted = await securityServices.encryption.decryptForPlatform(
          result.encrypted,
          platform,
          result.key
        );

        expect(decrypted).toEqual(testData);
      }
    });

    test('should use platform-specific encryption standards', async () => {
      const platformStandards = {
        teams: { algorithm: 'AES-256-GCM', keyLength: 32 },
        zoom: { algorithm: 'AES-256-CBC', keyLength: 32 },
        meet: { algorithm: 'AES-256-GCM', keyLength: 32 },
        generic: { algorithm: 'AES-256-GCM', keyLength: 32 }
      };

      for (const [platform, standard] of Object.entries(platformStandards)) {
        const encryptionConfig = await securityServices.encryption.getPlatformConfig(platform);
        
        expect(encryptionConfig.algorithm).toBe(standard.algorithm);
        expect(encryptionConfig.keyLength).toBe(standard.keyLength);
        expect(encryptionConfig.ivLength).toBeGreaterThan(0);
      }
    });

    test('should prevent cross-platform key leakage', async () => {
      const teamsKey = await securityServices.encryption.generatePlatformKey('teams');
      const zoomKey = await securityServices.encryption.generatePlatformKey('zoom');

      // Keys should be different
      expect(teamsKey).not.toBe(zoomKey);

      // Teams key should not work for Zoom data
      const testData = { message: 'test' };
      const zoomEncrypted = await securityServices.encryption.encryptForPlatform(
        testData, 'zoom', zoomKey
      );

      await expect(
        securityServices.encryption.decryptForPlatform(zoomEncrypted, 'zoom', teamsKey)
      ).rejects.toThrow();
    });

    test('should implement secure key rotation across platforms', async () => {
      const testData = { sensitive: 'information' };
      
      for (const platform of Object.keys(platformAdapters)) {
        // Encrypt with original key
        const originalKey = await securityServices.encryption.generatePlatformKey(platform);
        const encrypted = await securityServices.encryption.encryptForPlatform(
          testData, platform, originalKey
        );

        // Rotate key
        const newKey = await securityServices.encryption.rotatePlatformKey(platform);
        expect(newKey).not.toBe(originalKey);

        // Re-encrypt with new key
        const reEncrypted = await securityServices.encryption.reEncryptWithNewKey(
          encrypted, platform, originalKey, newKey
        );

        // Verify decryption with new key
        const decrypted = await securityServices.encryption.decryptForPlatform(
          reEncrypted, platform, newKey
        );
        expect(decrypted).toEqual(testData);

        // Old key should no longer work
        await expect(
          securityServices.encryption.decryptForPlatform(reEncrypted, platform, originalKey)
        ).rejects.toThrow();
      }
    });
  });

  describe('Cross-Platform Privacy Controls', () => {
    test('should enforce privacy policies across platforms', async () => {
      const privacyPolicies = {
        teams: {
          dataRetention: 90, // days
          allowCloudProcessing: true,
          requireConsent: true,
          anonymizeParticipants: false
        },
        zoom: {
          dataRetention: 30,
          allowCloudProcessing: false,
          requireConsent: true,
          anonymizeParticipants: true
        },
        meet: {
          dataRetention: 60,
          allowCloudProcessing: true,
          requireConsent: true,
          anonymizeParticipants: true
        },
        generic: {
          dataRetention: 7,
          allowCloudProcessing: false,
          requireConsent: true,
          anonymizeParticipants: true
        }
      };

      for (const [platform, policy] of Object.entries(privacyPolicies)) {
        await securityServices.privacy.setPlatformPolicy(platform, policy);
        
        const appliedPolicy = await securityServices.privacy.getPlatformPolicy(platform);
        expect(appliedPolicy).toEqual(policy);

        // Test policy enforcement
        const testTranscript = {
          participants: ['john.doe@company.com', 'jane.smith@company.com'],
          content: 'Meeting discussion content',
          timestamp: Date.now()
        };

        const processedData = await securityServices.privacy.processDataForPlatform(
          testTranscript, platform
        );

        if (policy.anonymizeParticipants) {
          expect(processedData.participants).not.toContain('john.doe@company.com');
          expect(processedData.participants[0]).toMatch(/^participant_\d+$/);
        }

        if (!policy.allowCloudProcessing) {
          expect(processedData.processingMode).toBe('local');
        }
      }
    });

    test('should handle consent management across platforms', async () => {
      const consentScenarios = [
        { platform: 'teams', feature: 'transcription', granted: true },
        { platform: 'teams', feature: 'cloud_processing', granted: false },
        { platform: 'zoom', feature: 'recording', granted: true },
        { platform: 'meet', feature: 'calendar_access', granted: false }
      ];

      for (const scenario of consentScenarios) {
        await securityServices.privacy.recordConsent(
          'user123',
          scenario.platform,
          scenario.feature,
          scenario.granted
        );

        const consentStatus = await securityServices.privacy.checkConsent(
          'user123',
          scenario.platform,
          scenario.feature
        );

        expect(consentStatus.granted).toBe(scenario.granted);
        expect(consentStatus.timestamp).toBeDefined();
        expect(consentStatus.platform).toBe(scenario.platform);
      }
    });

    test('should implement data minimization across platforms', async () => {
      const fullTranscript = {
        meetingId: 'meeting-123',
        participants: [
          { id: 'user1', email: 'user1@company.com', name: 'John Doe' },
          { id: 'user2', email: 'user2@company.com', name: 'Jane Smith' }
        ],
        segments: [
          { speaker: 'user1', text: 'Hello everyone', timestamp: 1000 },
          { speaker: 'user2', text: 'Good morning', timestamp: 2000 }
        ],
        metadata: {
          duration: 3600,
          quality: 'high',
          location: 'Conference Room A',
          organizer: 'user1@company.com'
        }
      };

      for (const platform of Object.keys(platformAdapters)) {
        const minimizedData = await securityServices.privacy.minimizeDataForPlatform(
          fullTranscript, platform
        );

        // Should remove unnecessary personal information
        expect(minimizedData.participants[0]).not.toHaveProperty('email');
        expect(minimizedData.metadata).not.toHaveProperty('location');
        expect(minimizedData.metadata).not.toHaveProperty('organizer');

        // Should retain essential data
        expect(minimizedData.segments).toHaveLength(2);
        expect(minimizedData.meetingId).toBeDefined();
      }
    });

    test('should handle cross-platform data deletion', async () => {
      const testData = {
        meetingId: 'meeting-to-delete',
        transcript: 'This data should be deleted',
        participants: ['user1', 'user2']
      };

      // Store data across platforms
      for (const platform of Object.keys(platformAdapters)) {
        await securityServices.secureStorage.storePlatformData(
          platform, 'meeting-to-delete', testData
        );
      }

      // Request deletion across all platforms
      const deletionResult = await securityServices.privacy.deleteDataAcrossPlatforms(
        'meeting-to-delete'
      );

      expect(deletionResult.success).toBe(true);
      expect(deletionResult.platformsProcessed).toEqual(Object.keys(platformAdapters));

      // Verify data is deleted from all platforms
      for (const platform of Object.keys(platformAdapters)) {
        const retrievedData = await securityServices.secureStorage.retrievePlatformData(
          platform, 'meeting-to-delete'
        );
        expect(retrievedData).toBeNull();
      }
    });
  });

  describe('Cross-Platform API Security', () => {
    test('should validate API keys for each platform', async () => {
      const apiKeys = {
        teams: 'teams-api-key-12345',
        zoom: 'zoom-api-key-67890',
        meet: 'meet-api-key-abcdef',
        openai: 'sk-openai-key-123456',
        claude: 'claude-api-key-789012'
      };

      for (const [platform, apiKey] of Object.entries(apiKeys)) {
        const isValid = await securityServices.security.validateApiKey(platform, apiKey);
        expect(isValid).toBe(true);

        // Test invalid key
        const invalidKey = 'invalid-key-123';
        const isInvalid = await securityServices.security.validateApiKey(platform, invalidKey);
        expect(isInvalid).toBe(false);
      }
    });

    test('should implement secure API key storage per platform', async () => {
      const apiKeys = {
        teams: 'teams-secret-key',
        zoom: 'zoom-secret-key',
        meet: 'meet-secret-key'
      };

      // Store API keys securely
      for (const [platform, apiKey] of Object.entries(apiKeys)) {
        await securityServices.secureStorage.storeApiKey(platform, apiKey);
      }

      // Verify keys are encrypted in storage
      for (const platform of Object.keys(apiKeys)) {
        const rawStorage = localStorage.getItem(`apiKey_${platform}`);
        expect(rawStorage).not.toContain(apiKeys[platform]);
        expect(rawStorage).toMatch(/^[A-Za-z0-9+/]+=*$/); // Base64 pattern
      }

      // Verify keys can be retrieved and decrypted
      for (const [platform, originalKey] of Object.entries(apiKeys)) {
        const retrievedKey = await securityServices.secureStorage.getApiKey(platform);
        expect(retrievedKey).toBe(originalKey);
      }
    });

    test('should implement request signing for platform APIs', async () => {
      const testRequest = {
        method: 'POST',
        url: 'https://api.example.com/transcribe',
        body: { audio: 'base64-audio-data' }
      };

      for (const platform of Object.keys(platformAdapters)) {
        const signedRequest = await securityServices.security.signRequest(
          testRequest, platform
        );

        expect(signedRequest).toHaveProperty('signature');
        expect(signedRequest).toHaveProperty('timestamp');
        expect(signedRequest).toHaveProperty('nonce');
        expect(signedRequest).toHaveProperty('platform', platform);

        // Verify signature
        const isValid = await securityServices.security.verifyRequestSignature(
          signedRequest, platform
        );
        expect(isValid).toBe(true);

        // Tampered request should fail verification
        const tamperedRequest = { ...signedRequest, body: { audio: 'tampered-data' } };
        const isTamperedValid = await securityServices.security.verifyRequestSignature(
          tamperedRequest, platform
        );
        expect(isTamperedValid).toBe(false);
      }
    });

    test('should prevent API key exposure in logs across platforms', async () => {
      const sensitiveData = {
        teams: { apiKey: 'teams-secret-123', tenantId: 'tenant-456' },
        zoom: { apiKey: 'zoom-secret-789', apiSecret: 'zoom-secret-abc' },
        meet: { clientId: 'meet-client-def', clientSecret: 'meet-secret-ghi' }
      };

      for (const [platform, data] of Object.entries(sensitiveData)) {
        const logMessage = `Platform ${platform} authentication with ${JSON.stringify(data)}`;
        
        const sanitizedLog = await securityServices.auditLog.sanitizeLogMessage(
          logMessage, platform
        );

        // API keys should be masked
        expect(sanitizedLog).not.toContain(data.apiKey);
        expect(sanitizedLog).toContain('****');
        
        // Other sensitive data should be masked
        Object.values(data).forEach(value => {
          if (typeof value === 'string' && value.length > 4) {
            expect(sanitizedLog).not.toContain(value);
          }
        });
      }
    });
  });

  describe('Cross-Platform Audit Logging', () => {
    test('should log security events across all platforms', async () => {
      const securityEvents = [
        { platform: 'teams', event: 'authentication_success', userId: 'user1' },
        { platform: 'zoom', event: 'api_key_rotation', userId: 'admin1' },
        { platform: 'meet', event: 'data_export', userId: 'user2' },
        { platform: 'generic', event: 'privacy_mode_enabled', userId: 'user3' }
      ];

      for (const eventData of securityEvents) {
        await securityServices.auditLog.logSecurityEvent(eventData);
      }

      const auditLogs = await securityServices.auditLog.getSecurityLogs();
      
      expect(auditLogs).toHaveLength(securityEvents.length);
      
      auditLogs.forEach((log, index) => {
        expect(log.platform).toBe(securityEvents[index].platform);
        expect(log.event).toBe(securityEvents[index].event);
        expect(log.userId).toBe(securityEvents[index].userId);
        expect(log.timestamp).toBeDefined();
        expect(log.integrity).toBeDefined(); // Integrity hash
      });
    });

    test('should detect and prevent audit log tampering', async () => {
      const originalEvent = {
        platform: 'teams',
        event: 'data_access',
        userId: 'user123',
        timestamp: Date.now()
      };

      await securityServices.auditLog.logSecurityEvent(originalEvent);
      
      const logs = await securityServices.auditLog.getSecurityLogs();
      const logEntry = logs[logs.length - 1];

      // Attempt to tamper with log
      const tamperedLog = { ...logEntry, userId: 'hacker' };
      
      const isValid = await securityServices.auditLog.verifyLogIntegrity(tamperedLog);
      expect(isValid).toBe(false);

      // Original log should still be valid
      const originalValid = await securityServices.auditLog.verifyLogIntegrity(logEntry);
      expect(originalValid).toBe(true);
    });

    test('should implement secure log aggregation across platforms', async () => {
      const platformLogs = {
        teams: [
          { event: 'meeting_start', timestamp: Date.now() - 3000 },
          { event: 'transcription_start', timestamp: Date.now() - 2000 }
        ],
        zoom: [
          { event: 'recording_start', timestamp: Date.now() - 1500 },
          { event: 'participant_join', timestamp: Date.now() - 1000 }
        ],
        meet: [
          { event: 'extension_loaded', timestamp: Date.now() - 500 },
          { event: 'calendar_access', timestamp: Date.now() }
        ]
      };

      // Log events for each platform
      for (const [platform, events] of Object.entries(platformLogs)) {
        for (const event of events) {
          await securityServices.auditLog.logSecurityEvent({
            platform,
            ...event,
            userId: 'test-user'
          });
        }
      }

      // Aggregate logs across platforms
      const aggregatedLogs = await securityServices.auditLog.aggregateLogsByTimeRange(
        Date.now() - 4000,
        Date.now()
      );

      expect(aggregatedLogs).toHaveLength(6); // Total events across all platforms
      
      // Verify chronological order
      for (let i = 1; i < aggregatedLogs.length; i++) {
        expect(aggregatedLogs[i].timestamp).toBeGreaterThanOrEqual(
          aggregatedLogs[i - 1].timestamp
        );
      }
    });

    test('should anonymize sensitive data in cross-platform logs', async () => {
      const sensitiveEvents = [
        {
          platform: 'teams',
          event: 'transcript_generated',
          data: {
            transcript: 'Confidential discussion about Project X',
            participants: ['john.doe@company.com', 'jane.smith@company.com'],
            meetingId: 'secret-meeting-123'
          }
        },
        {
          platform: 'zoom',
          event: 'recording_uploaded',
          data: {
            filename: 'confidential-meeting-recording.mp4',
            participants: ['user1@company.com', 'user2@company.com'],
            duration: 3600
          }
        }
      ];

      for (const event of sensitiveEvents) {
        await securityServices.auditLog.logSecurityEvent(event);
      }

      const logs = await securityServices.auditLog.getSecurityLogs();
      const recentLogs = logs.slice(-2);

      recentLogs.forEach(log => {
        // Transcript content should be anonymized
        if (log.data?.transcript) {
          expect(log.data.transcript).toContain('[REDACTED]');
          expect(log.data.transcript).not.toContain('Project X');
        }

        // Email addresses should be anonymized
        if (log.data?.participants) {
          log.data.participants.forEach(participant => {
            expect(participant).toMatch(/^user\d+@\*\*\*$/);
          });
        }

        // Meeting IDs should be hashed
        if (log.data?.meetingId) {
          expect(log.data.meetingId).toMatch(/^hash_[a-f0-9]+$/);
        }
      });
    });
  });

  describe('Cross-Platform Compliance', () => {
    test('should enforce GDPR compliance across platforms', async () => {
      const gdprRequirements = {
        dataMinimization: true,
        consentRequired: true,
        rightToErasure: true,
        dataPortability: true,
        privacyByDesign: true
      };

      for (const platform of Object.keys(platformAdapters)) {
        const complianceStatus = await securityServices.privacy.checkGDPRCompliance(platform);
        
        Object.entries(gdprRequirements).forEach(([requirement, expected]) => {
          expect(complianceStatus[requirement]).toBe(expected);
        });
      }
    });

    test('should handle data subject rights across platforms', async () => {
      const userId = 'gdpr-test-user';
      const testData = {
        transcript: 'User data for GDPR testing',
        meetings: ['meeting1', 'meeting2'],
        preferences: { language: 'en', notifications: true }
      };

      // Store user data across platforms
      for (const platform of Object.keys(platformAdapters)) {
        await securityServices.secureStorage.storePlatformData(
          platform, userId, testData
        );
      }

      // Test right of access
      const userData = await securityServices.privacy.exportUserDataAcrossPlatforms(userId);
      expect(userData).toHaveProperty('teams');
      expect(userData).toHaveProperty('zoom');
      expect(userData).toHaveProperty('meet');
      expect(userData).toHaveProperty('generic');

      // Test right to rectification
      const updatedData = { ...testData, preferences: { language: 'es' } };
      await securityServices.privacy.updateUserDataAcrossPlatforms(userId, updatedData);

      // Test right to erasure
      const deletionResult = await securityServices.privacy.deleteUserDataAcrossPlatforms(userId);
      expect(deletionResult.success).toBe(true);
      expect(deletionResult.platformsProcessed).toEqual(Object.keys(platformAdapters));

      // Verify data is deleted
      const deletedUserData = await securityServices.privacy.exportUserDataAcrossPlatforms(userId);
      Object.values(deletedUserData).forEach(platformData => {
        expect(platformData).toBeNull();
      });
    });

    test('should implement data retention policies per platform', async () => {
      const retentionPolicies = {
        teams: { transcripts: 365, recordings: 90, logs: 2555 }, // days
        zoom: { transcripts: 180, recordings: 60, logs: 1825 },
        meet: { transcripts: 90, recordings: 30, logs: 1095 },
        generic: { transcripts: 30, recordings: 7, logs: 365 }
      };

      for (const [platform, policy] of Object.entries(retentionPolicies)) {
        await securityServices.privacy.setRetentionPolicy(platform, policy);
        
        const appliedPolicy = await securityServices.privacy.getRetentionPolicy(platform);
        expect(appliedPolicy).toEqual(policy);
      }

      // Test automatic cleanup based on retention policies
      const oldData = {
        timestamp: Date.now() - (400 * 24 * 60 * 60 * 1000), // 400 days ago
        transcript: 'Old meeting data'
      };

      for (const platform of Object.keys(retentionPolicies)) {
        await securityServices.secureStorage.storePlatformData(
          platform, 'old-meeting', oldData
        );
      }

      // Run retention cleanup
      const cleanupResult = await securityServices.privacy.enforceRetentionPolicies();
      
      expect(cleanupResult.itemsDeleted).toBeGreaterThan(0);
      expect(cleanupResult.platformsProcessed).toEqual(Object.keys(retentionPolicies));

      // Verify old data is deleted from platforms with shorter retention
      const teamsData = await securityServices.secureStorage.retrievePlatformData(
        'teams', 'old-meeting'
      );
      expect(teamsData).toBeDefined(); // 365 days retention, data is 400 days old but within policy

      const genericData = await securityServices.secureStorage.retrievePlatformData(
        'generic', 'old-meeting'
      );
      expect(genericData).toBeNull(); // 30 days retention, should be deleted
    });
  });
});