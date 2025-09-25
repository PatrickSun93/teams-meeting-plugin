/**
 * Tests for SecurityManager
 */

import SecurityManager from '../SecurityManager.js';

// Mock all the security services
jest.mock('../EncryptionService.js');
jest.mock('../SecureStorageService.js');
jest.mock('../PrivacyModeService.js');
jest.mock('../ConsentService.js');
jest.mock('../DataRetentionService.js');
jest.mock('../AuditLogService.js');

import EncryptionService from '../EncryptionService.js';
import SecureStorageService from '../SecureStorageService.js';
import PrivacyModeService from '../PrivacyModeService.js';
import ConsentService from '../ConsentService.js';
import DataRetentionService from '../DataRetentionService.js';
import AuditLogService from '../AuditLogService.js';

describe('SecurityManager', () => {
  let securityManager;
  let mockServices;

  beforeEach(() => {
    // Create mock instances
    mockServices = {
      encryptionService: {
        generateKey: jest.fn(),
        encryptTranscript: jest.fn(),
        decryptTranscript: jest.fn()
      },
      secureStorageService: {
        initialize: jest.fn(),
        getStoredProviders: jest.fn()
      },
      privacyModeService: {
        initializeFromStorage: jest.fn(),
        validateProcessingRequest: jest.fn(),
        sanitizeData: jest.fn(),
        getPrivacyStatus: jest.fn(),
        addListener: jest.fn()
      },
      consentService: {
        validateRequiredConsents: jest.fn(),
        requestConsent: jest.fn(),
        getAllConsentStatuses: jest.fn(),
        addConsentListener: jest.fn(),
        revokeConsent: jest.fn()
      },
      dataRetentionService: {
        shouldDeleteData: jest.fn(),
        getAllRetentionPolicies: jest.fn(),
        stopCleanup: jest.fn()
      },
      auditLogService: {
        setUserId: jest.fn(),
        logEvent: jest.fn(),
        logConfigChange: jest.fn(),
        logSecurityEvent: jest.fn(),
        logSystemError: jest.fn(),
        logDataAccess: jest.fn(),
        logConsentEvent: jest.fn(),
        logPrivacyChange: jest.fn(),
        generateComplianceReport: jest.fn(),
        getLogStatistics: jest.fn(),
        eventTypes: {
          LOGIN: 'user_login',
          LOGOUT: 'user_logout'
        },
        logLevels: {
          INFO: 'info',
          ERROR: 'error'
        },
        userId: 'test-user'
      }
    };

    // Mock constructors
    EncryptionService.mockImplementation(() => mockServices.encryptionService);
    SecureStorageService.mockImplementation(() => mockServices.secureStorageService);
    PrivacyModeService.mockImplementation(() => mockServices.privacyModeService);
    ConsentService.mockImplementation(() => mockServices.consentService);
    DataRetentionService.mockImplementation(() => mockServices.dataRetentionService);
    AuditLogService.mockImplementation(() => mockServices.auditLogService);

    securityManager = new SecurityManager();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Initialization', () => {
    test('should initialize security manager successfully', async () => {
      const userId = 'test-user';
      const password = 'test-password';

      mockServices.secureStorageService.initialize.mockResolvedValue(true);

      const result = await securityManager.initialize(userId, password);

      expect(result).toBe(true);
      expect(mockServices.auditLogService.setUserId).toHaveBeenCalledWith(userId);
      expect(mockServices.secureStorageService.initialize).toHaveBeenCalledWith(password);
      expect(mockServices.privacyModeService.initializeFromStorage).toHaveBeenCalled();
      expect(mockServices.auditLogService.logEvent).toHaveBeenCalledWith(
        'user_login',
        { userId: userId },
        'info'
      );
      expect(securityManager.isInitialized()).toBe(true);
    });

    test('should handle initialization failure', async () => {
      const userId = 'test-user';
      const password = 'test-password';

      mockServices.secureStorageService.initialize.mockResolvedValue(false);

      const result = await securityManager.initialize(userId, password);

      expect(result).toBe(false);
      expect(securityManager.isInitialized()).toBe(false);
    });

    test('should handle initialization error', async () => {
      const userId = 'test-user';
      const password = 'test-password';
      const error = new Error('Initialization failed');

      mockServices.secureStorageService.initialize.mockRejectedValue(error);

      const result = await securityManager.initialize(userId, password);

      expect(result).toBe(false);
      expect(mockServices.auditLogService.logSystemError).toHaveBeenCalledWith(
        error,
        'SecurityManager.initialize'
      );
    });
  });

  describe('Security Level Management', () => {
    test('should set security level', () => {
      const level = 'high';

      securityManager.setSecurityLevel(level);

      expect(securityManager.getSecurityLevel()).toBe(level);
      expect(mockServices.auditLogService.logConfigChange).toHaveBeenCalledWith(
        'security_level',
        'standard',
        level,
        'Security level changed by user'
      );
    });

    test('should apply security level settings', () => {
      securityManager.setSecurityLevel('minimal');
      expect(securityManager.getSecurityLevel()).toBe('minimal');

      securityManager.setSecurityLevel('high');
      expect(securityManager.getSecurityLevel()).toBe('high');
    });
  });

  describe('Security Validation', () => {
    beforeEach(() => {
      securityManager.initialized = true;
    });

    test('should validate security requirements successfully', async () => {
      const operation = 'store_data';
      const context = {
        serviceType: 'storage',
        provider: 'local',
        dataType: 'transcript',
        destination: 'local'
      };

      mockServices.privacyModeService.validateProcessingRequest.mockReturnValue({
        allowed: true,
        reason: 'Request complies with privacy settings'
      });

      mockServices.consentService.validateRequiredConsents.mockReturnValue({
        valid: true,
        missing: [],
        expired: []
      });

      const result = await securityManager.validateSecurityRequirements(operation, context);

      expect(result.allowed).toBe(true);
      expect(result.violations).toHaveLength(0);
      expect(mockServices.auditLogService.logSecurityEvent).toHaveBeenCalledWith(
        'security_validation',
        {
          operation: operation,
          allowed: true,
          violations: 0,
          context: context
        },
        'low'
      );
    });

    test('should detect privacy violations', async () => {
      const operation = 'cloud_stt';
      const context = {
        serviceType: 'stt',
        provider: 'openai',
        dataType: 'audio'
      };

      mockServices.privacyModeService.validateProcessingRequest.mockReturnValue({
        allowed: false,
        reason: 'Cloud STT blocked by privacy settings',
        alternative: 'Use local Whisper model'
      });

      // Mock consent validation to return valid
      mockServices.consentService.validateRequiredConsents.mockReturnValue({
        valid: true,
        missing: [],
        expired: []
      });

      const result = await securityManager.validateSecurityRequirements(operation, context);

      expect(result.allowed).toBe(false);
      expect(result.violations).toHaveLength(1);
      expect(result.violations[0].type).toBe('privacy_violation');
    });

    test('should detect missing consent', async () => {
      const operation = 'cloud_stt';
      const context = { serviceType: 'stt', provider: 'openai' };

      mockServices.privacyModeService.validateProcessingRequest.mockReturnValue({
        allowed: true
      });

      mockServices.consentService.validateRequiredConsents.mockReturnValue({
        valid: false,
        missing: ['cloud_stt'],
        expired: []
      });

      const result = await securityManager.validateSecurityRequirements(operation, context);

      expect(result.allowed).toBe(false);
      expect(result.violations).toHaveLength(1);
      expect(result.violations[0].type).toBe('missing_consent');
    });

    test('should detect expired consent', async () => {
      const operation = 'cloud_stt';
      const context = { serviceType: 'stt', provider: 'openai' };

      mockServices.privacyModeService.validateProcessingRequest.mockReturnValue({
        allowed: true
      });

      mockServices.consentService.validateRequiredConsents.mockReturnValue({
        valid: false,
        missing: [],
        expired: ['cloud_stt']
      });

      const result = await securityManager.validateSecurityRequirements(operation, context);

      expect(result.allowed).toBe(false);
      expect(result.violations).toHaveLength(1);
      expect(result.violations[0].type).toBe('expired_consent');
    });

    test('should detect retention violations', async () => {
      const operation = 'retrieve_data';
      const context = {
        dataType: 'transcript',
        dataTimestamp: Date.now() - (100 * 24 * 60 * 60 * 1000) // 100 days ago
      };

      mockServices.privacyModeService.validateProcessingRequest.mockReturnValue({
        allowed: true
      });

      mockServices.dataRetentionService.shouldDeleteData.mockReturnValue({
        shouldDelete: true,
        reason: 'Data exceeds retention period',
        policy: { retentionDays: 90 }
      });

      const result = await securityManager.validateSecurityRequirements(operation, context);

      expect(result.allowed).toBe(false);
      expect(result.violations).toHaveLength(1);
      expect(result.violations[0].type).toBe('retention_violation');
    });
  });

  describe('Secure Data Operations', () => {
    beforeEach(() => {
      securityManager.initialized = true;
      
      // Mock validation to pass by default
      mockServices.privacyModeService.validateProcessingRequest.mockReturnValue({
        allowed: true
      });
      mockServices.consentService.validateRequiredConsents.mockReturnValue({
        valid: true,
        missing: [],
        expired: []
      });
    });

    test('should securely store data', async () => {
      const dataType = 'transcript';
      const dataId = 'test-123';
      const data = { text: 'meeting transcript' };

      mockServices.privacyModeService.sanitizeData.mockReturnValue(data);
      mockServices.encryptionService.generateKey.mockResolvedValue({ type: 'secret' });
      mockServices.encryptionService.encryptTranscript.mockResolvedValue({
        encryptedData: [1, 2, 3, 4],
        iv: [5, 6, 7, 8]
      });

      // Mock localStorage
      const mockSetItem = jest.fn();
      Object.defineProperty(global, 'localStorage', {
        value: { setItem: mockSetItem },
        writable: true
      });

      const result = await securityManager.securelyStoreData(dataType, dataId, data);

      expect(result).toBe(true);
      expect(mockServices.privacyModeService.sanitizeData).toHaveBeenCalledWith(data, dataType);
      expect(mockServices.auditLogService.logDataAccess).toHaveBeenCalledWith(
        'write',
        dataType,
        dataId,
        expect.objectContaining({ encrypted: true })
      );
      expect(mockSetItem).toHaveBeenCalled();
    });

    test('should securely retrieve data', async () => {
      const dataType = 'transcript';
      const dataId = 'test-123';
      const encryptedData = {
        data: { encryptedData: [1, 2, 3, 4], iv: [5, 6, 7, 8] },
        encrypted: true,
        timestamp: Date.now()
      };

      // Mock localStorage
      const mockGetItem = jest.fn().mockReturnValue(JSON.stringify(encryptedData));
      Object.defineProperty(global, 'localStorage', {
        value: { getItem: mockGetItem },
        writable: true
      });

      mockServices.encryptionService.generateKey.mockResolvedValue({ type: 'secret' });
      mockServices.encryptionService.decryptTranscript.mockResolvedValue({
        text: 'decrypted transcript'
      });

      const result = await securityManager.securelyRetrieveData(dataType, dataId);

      expect(result).toEqual({ text: 'decrypted transcript' });
      expect(mockServices.auditLogService.logDataAccess).toHaveBeenCalledWith(
        'read',
        dataType,
        dataId,
        expect.objectContaining({ encrypted: true })
      );
    });

    test('should securely delete data', async () => {
      const dataType = 'transcript';
      const dataId = 'test-123';

      // Mock localStorage
      const mockRemoveItem = jest.fn();
      Object.defineProperty(global, 'localStorage', {
        value: { removeItem: mockRemoveItem },
        writable: true
      });

      const result = await securityManager.securelyDeleteData(dataType, dataId);

      expect(result).toBe(true);
      expect(mockRemoveItem).toHaveBeenCalledWith(`teams_transcription_${dataType}_${dataId}`);
      expect(mockServices.auditLogService.logDataAccess).toHaveBeenCalledWith(
        'delete',
        dataType,
        dataId
      );
    });

    test('should handle storage errors', async () => {
      const dataType = 'transcript';
      const dataId = 'test-123';
      const data = { text: 'meeting transcript' };

      // Mock validation failure
      mockServices.privacyModeService.validateProcessingRequest.mockReturnValue({
        allowed: false,
        reason: 'Privacy violation'
      });

      const result = await securityManager.securelyStoreData(dataType, dataId, data);

      expect(result).toBe(false);
      expect(mockServices.auditLogService.logSystemError).toHaveBeenCalled();
    });
  });

  describe('Consent Management', () => {
    test('should request consent successfully', async () => {
      const consentType = 'cloud_stt';
      const context = { provider: 'openai' };

      mockServices.consentService.requestConsent.mockResolvedValue({
        granted: true,
        grantedAt: Date.now()
      });

      const result = await securityManager.requestConsent(consentType, context);

      expect(result).toBe(true);
      expect(mockServices.consentService.requestConsent).toHaveBeenCalledWith(consentType, context);
      expect(mockServices.auditLogService.logConsentEvent).toHaveBeenCalledWith(
        'granted',
        consentType,
        { context: context }
      );
    });

    test('should handle consent denial', async () => {
      const consentType = 'cloud_stt';
      const context = { provider: 'openai' };

      mockServices.consentService.requestConsent.mockResolvedValue({
        granted: false,
        deniedAt: Date.now()
      });

      const result = await securityManager.requestConsent(consentType, context);

      expect(result).toBe(false);
      expect(mockServices.auditLogService.logConsentEvent).toHaveBeenCalledWith(
        'denied',
        consentType,
        { context: context }
      );
    });

    test('should handle consent request errors', async () => {
      const consentType = 'cloud_stt';
      const context = { provider: 'openai' };
      const error = new Error('Consent request failed');

      mockServices.consentService.requestConsent.mockRejectedValue(error);

      const result = await securityManager.requestConsent(consentType, context);

      expect(result).toBe(false);
      expect(mockServices.auditLogService.logSystemError).toHaveBeenCalledWith(
        error,
        'SecurityManager.requestConsent'
      );
    });
  });

  describe('Privacy Mode Management', () => {
    test('should enable privacy mode', () => {
      const settings = { blockCloudSTT: true };

      // Add the missing method to the mock
      mockServices.privacyModeService.enablePrivacyMode = jest.fn();

      securityManager.enablePrivacyMode(settings);

      expect(mockServices.privacyModeService.enablePrivacyMode).toHaveBeenCalledWith(settings);
      expect(mockServices.auditLogService.logPrivacyChange).toHaveBeenCalledWith(
        'privacy_mode',
        true,
        settings
      );
    });

    test('should disable privacy mode', () => {
      // Add the missing method to the mock
      mockServices.privacyModeService.disablePrivacyMode = jest.fn();

      securityManager.disablePrivacyMode();

      expect(mockServices.privacyModeService.disablePrivacyMode).toHaveBeenCalled();
      expect(mockServices.auditLogService.logPrivacyChange).toHaveBeenCalledWith(
        'privacy_mode',
        false
      );
    });
  });

  describe('Security Status and Reporting', () => {
    test('should get security status', () => {
      const mockStatus = {
        privacyMode: { enabled: false },
        consentStatus: {},
        retentionPolicies: {},
        auditLogStats: { totalLogs: 0 },
        secureStorageProviders: []
      };

      mockServices.privacyModeService.getPrivacyStatus.mockReturnValue(mockStatus.privacyMode);
      mockServices.consentService.getAllConsentStatuses.mockReturnValue(mockStatus.consentStatus);
      mockServices.dataRetentionService.getAllRetentionPolicies.mockReturnValue(mockStatus.retentionPolicies);
      mockServices.auditLogService.getLogStatistics.mockReturnValue(mockStatus.auditLogStats);
      mockServices.secureStorageService.getStoredProviders.mockReturnValue(mockStatus.secureStorageProviders);

      const status = securityManager.getSecurityStatus();

      expect(status).toEqual({
        initialized: false,
        securityLevel: 'standard',
        ...mockStatus
      });
    });

    test('should generate compliance report', () => {
      const startTime = Date.now() - 86400000; // 24 hours ago
      const endTime = Date.now();

      const mockAuditReport = {
        reportPeriod: { startTime, endTime },
        summary: { totalEvents: 10 }
      };

      const mockConsentStatuses = {
        cloud_stt: { granted: true, expired: false },
        cloud_summary: { granted: false, expired: true }
      };

      const mockPrivacyStatus = {
        enabled: true,
        settings: { localStorageOnly: true, blockCloudSTT: true }
      };

      mockServices.auditLogService.generateComplianceReport.mockReturnValue(mockAuditReport);
      mockServices.consentService.getAllConsentStatuses.mockReturnValue(mockConsentStatuses);
      mockServices.privacyModeService.getPrivacyStatus.mockReturnValue(mockPrivacyStatus);
      mockServices.dataRetentionService.getAllRetentionPolicies.mockReturnValue({
        transcripts: { enabled: true }
      });
      mockServices.dataRetentionService.getCleanupStatus = jest.fn().mockReturnValue({
        schedulerActive: true
      });

      const report = securityManager.generateComplianceReport(startTime, endTime);

      expect(report).toEqual({
        reportPeriod: mockAuditReport.reportPeriod,
        securityLevel: 'standard',
        auditSummary: mockAuditReport.summary,
        consentCompliance: {
          totalConsentTypes: 2,
          grantedConsents: 1,
          expiredConsents: 1
        },
        privacyCompliance: {
          privacyModeEnabled: true,
          localOnlyProcessing: true,
          cloudServicesBlocked: true
        },
        dataRetention: {
          policiesActive: 1,
          autoCleanupEnabled: true
        },
        generatedAt: expect.any(Number),
        generatedBy: 'test-user'
      });
    });
  });

  describe('Shutdown', () => {
    test('should shutdown security manager', () => {
      securityManager.initialized = true;

      securityManager.shutdown();

      expect(mockServices.dataRetentionService.stopCleanup).toHaveBeenCalled();
      expect(mockServices.auditLogService.logEvent).toHaveBeenCalledWith(
        'user_logout',
        { userId: 'test-user' },
        'info'
      );
      expect(securityManager.isInitialized()).toBe(false);
    });
  });
});