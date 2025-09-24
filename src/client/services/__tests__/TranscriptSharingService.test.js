/**
 * Tests for TranscriptSharingService
 */

import TranscriptSharingService from '../TranscriptSharingService';

// Mock storage service
const mockStorageService = {
  db: null,
  dbName: 'TestDB',
  initialize: jest.fn(),
  getTranscript: jest.fn()
};

// Mock IndexedDB components
const mockDB = {
  version: 1,
  objectStoreNames: {
    contains: jest.fn()
  },
  createObjectStore: jest.fn(),
  transaction: jest.fn(),
  close: jest.fn()
};

const mockObjectStore = {
  createIndex: jest.fn(),
  put: jest.fn(),
  get: jest.fn(),
  getAll: jest.fn(),
  delete: jest.fn(),
  index: jest.fn(),
  openCursor: jest.fn()
};

const mockTransaction = {
  objectStore: jest.fn(() => mockObjectStore)
};

const mockRequest = {
  result: null,
  error: null,
  onsuccess: null,
  onerror: null,
  onupgradeneeded: null
};

// Mock crypto API
const mockCrypto = {
  subtle: {
    digest: jest.fn()
  }
};

// Mock window location
const mockLocation = {
  origin: 'https://example.com'
};

// Setup global mocks
global.indexedDB = {
  open: jest.fn(() => mockRequest)
};
global.crypto = mockCrypto;
global.window = { location: mockLocation };
global.TextEncoder = jest.fn(() => ({
  encode: jest.fn(text => new Uint8Array(Buffer.from(text)))
}));

describe('TranscriptSharingService', () => {
  let service;
  let mockTranscript;

  beforeEach(() => {
    service = new TranscriptSharingService(mockStorageService);
    
    mockTranscript = {
      id: 'test-transcript-1',
      meetingId: 'meeting-123',
      title: 'Test Meeting',
      platform: 'teams',
      createdAt: new Date('2024-01-15T10:00:00Z'),
      content: {
        segments: [
          {
            id: 'seg1',
            speakerId: 'speaker1',
            speakerName: 'John Doe',
            text: 'Hello everyone',
            startTime: 0,
            endTime: 3,
            confidence: 0.95
          }
        ]
      }
    };

    // Reset mocks
    jest.clearAllMocks();
    
    // Setup default mock behaviors
    mockStorageService.db = mockDB;
    mockStorageService.initialize.mockResolvedValue();
    mockStorageService.getTranscript.mockResolvedValue(mockTranscript);
    
    mockDB.transaction.mockReturnValue(mockTransaction);
    mockDB.objectStoreNames.contains.mockReturnValue(false);
    mockDB.createObjectStore.mockReturnValue(mockObjectStore);
    
    mockRequest.result = mockDB;
    
    // Mock crypto operations
    mockCrypto.subtle.digest.mockResolvedValue(new ArrayBuffer(32));
  });

  describe('initialization', () => {
    it('should initialize sharing stores', async () => {
      // Simulate database upgrade
      setTimeout(() => {
        if (mockRequest.onupgradeneeded) {
          mockRequest.onupgradeneeded({ target: { result: mockDB } });
        }
        if (mockRequest.onsuccess) {
          mockRequest.onsuccess();
        }
      }, 0);

      await service.initialize();
      
      expect(mockStorageService.initialize).toHaveBeenCalled();
      expect(mockDB.createObjectStore).toHaveBeenCalledWith('transcriptShares', { keyPath: 'id' });
      expect(mockDB.createObjectStore).toHaveBeenCalledWith('shareAccess', { keyPath: 'id' });
    });

    it('should handle initialization errors', async () => {
      const error = new Error('Initialization failed');
      
      setTimeout(() => {
        mockRequest.error = error;
        if (mockRequest.onerror) {
          mockRequest.onerror();
        }
      }, 0);

      await expect(service.initialize()).rejects.toThrow('Initialization failed');
    });
  });

  describe('share creation', () => {
    beforeEach(() => {
      mockObjectStore.put.mockReturnValue({
        onsuccess() { this.result = true; },
        onerror() {}
      });
    });

    it('should create a basic share', async () => {
      const result = await service.createShare('test-transcript-1');
      
      expect(result).toHaveProperty('shareId');
      expect(result).toHaveProperty('shareUrl');
      expect(result).toHaveProperty('expiresAt');
      expect(result).toHaveProperty('permissions');
      
      expect(result.shareUrl).toContain('https://example.com/share/');
      expect(result.permissions.canView).toBe(true);
      expect(result.permissions.canDownload).toBe(true);
    });

    it('should create share with custom options', async () => {
      const options = {
        createdBy: 'user123',
        allowDownload: false,
        allowComments: true,
        allowEdit: true,
        password: 'secret123',
        allowedEmails: ['user@example.com'],
        maxAccesses: 10,
        description: 'Test share'
      };

      const result = await service.createShare('test-transcript-1', options);
      
      expect(result).toHaveProperty('shareId');
      expect(result.permissions.canDownload).toBe(false);
      expect(result.permissions.canComment).toBe(true);
      expect(result.permissions.canEdit).toBe(true);
    });

    it('should handle transcript not found', async () => {
      mockStorageService.getTranscript.mockResolvedValue(null);

      await expect(service.createShare('non-existent'))
        .rejects.toThrow('Transcript not found');
    });

    it('should handle share creation errors', async () => {
      const error = new Error('Share creation failed');
      mockObjectStore.put.mockReturnValue({
        onsuccess() {},
        onerror() { this.error = error; }
      });

      await expect(service.createShare('test-transcript-1'))
        .rejects.toThrow('Failed to create share: Share creation failed');
    });
  });

  describe('share access', () => {
    let mockShare;

    beforeEach(() => {
      mockShare = {
        id: 'share-123',
        transcriptId: 'test-transcript-1',
        createdBy: 'user123',
        createdAt: new Date('2024-01-15T10:00:00Z'),
        expiresAt: new Date('2024-02-15T10:00:00Z'),
        permissions: {
          canView: true,
          canDownload: true,
          canComment: false,
          canEdit: false
        },
        accessControl: {
          requirePassword: false,
          password: null,
          allowedEmails: [],
          maxAccesses: null,
          currentAccesses: 0
        },
        metadata: {
          title: 'Test Meeting',
          description: '',
          tags: []
        },
        isActive: true
      };

      mockObjectStore.get.mockReturnValue({
        onsuccess() { this.result = mockShare; },
        onerror() {}
      });

      mockObjectStore.put.mockReturnValue({
        onsuccess() { this.result = true; },
        onerror() {}
      });
    });

    it('should access valid share', async () => {
      const result = await service.accessShare('share-123');
      
      expect(result).toHaveProperty('transcript');
      expect(result).toHaveProperty('share');
      expect(result.transcript).toEqual(mockTranscript);
      expect(result.share.id).toBe('share-123');
    });

    it('should reject access to inactive share', async () => {
      mockShare.isActive = false;

      await expect(service.accessShare('share-123'))
        .rejects.toThrow('Access denied: Share has been revoked');
    });

    it('should reject access to expired share', async () => {
      mockShare.expiresAt = new Date('2023-01-01T00:00:00Z');

      await expect(service.accessShare('share-123'))
        .rejects.toThrow('Access denied: Share has expired');
    });

    it('should reject access when max accesses reached', async () => {
      mockShare.accessControl.maxAccesses = 5;
      mockShare.accessControl.currentAccesses = 5;

      await expect(service.accessShare('share-123'))
        .rejects.toThrow('Access denied: Maximum access limit reached');
    });

    it('should validate password when required', async () => {
      mockShare.accessControl.requirePassword = true;
      mockShare.accessControl.password = [1, 2, 3, 4]; // Mock hash

      // Mock password verification
      service._verifyPassword = jest.fn().mockResolvedValue(true);

      const result = await service.accessShare('share-123', { password: 'correct' });
      
      expect(result).toHaveProperty('transcript');
      expect(service._verifyPassword).toHaveBeenCalledWith('correct', [1, 2, 3, 4]);
    });

    it('should reject invalid password', async () => {
      mockShare.accessControl.requirePassword = true;
      mockShare.accessControl.password = [1, 2, 3, 4];

      service._verifyPassword = jest.fn().mockResolvedValue(false);

      await expect(service.accessShare('share-123', { password: 'wrong' }))
        .rejects.toThrow('Access denied: Invalid password');
    });

    it('should validate email restrictions', async () => {
      mockShare.accessControl.allowedEmails = ['allowed@example.com'];

      await expect(service.accessShare('share-123', { email: 'notallowed@example.com' }))
        .rejects.toThrow('Access denied: Email not authorized');

      const result = await service.accessShare('share-123', { email: 'allowed@example.com' });
      expect(result).toHaveProperty('transcript');
    });

    it('should increment access count', async () => {
      await service.accessShare('share-123');
      
      expect(mockObjectStore.put).toHaveBeenCalledWith(
        expect.objectContaining({
          accessControl: expect.objectContaining({
            currentAccesses: 1
          })
        })
      );
    });

    it('should handle non-existent share', async () => {
      mockObjectStore.get.mockReturnValue({
        onsuccess() { this.result = null; },
        onerror() {}
      });

      await expect(service.accessShare('non-existent'))
        .rejects.toThrow('Access denied: Share not found');
    });
  });

  describe('share management', () => {
    let mockShare;

    beforeEach(() => {
      mockShare = {
        id: 'share-123',
        transcriptId: 'test-transcript-1',
        expiresAt: new Date('2024-02-15T10:00:00Z'),
        permissions: { canView: true, canDownload: true },
        accessControl: { maxAccesses: null },
        metadata: { title: 'Test Meeting' },
        isActive: true
      };

      mockObjectStore.get.mockReturnValue({
        onsuccess() { this.result = mockShare; },
        onerror() {}
      });

      mockObjectStore.put.mockReturnValue({
        onsuccess() { this.result = mockShare; },
        onerror() {}
      });
    });

    it('should update share settings', async () => {
      const updates = {
        permissions: { canDownload: false },
        metadata: { description: 'Updated description' }
      };

      const result = await service.updateShare('share-123', updates);
      
      expect(result.permissions.canDownload).toBe(false);
      expect(result.metadata.description).toBe('Updated description');
      expect(result).toHaveProperty('updatedAt');
    });

    it('should revoke share', async () => {
      const result = await service.revokeShare('share-123');
      
      expect(result.isActive).toBe(false);
    });

    it('should handle update errors', async () => {
      mockObjectStore.get.mockReturnValue({
        onsuccess() { this.result = null; },
        onerror() {}
      });

      await expect(service.updateShare('non-existent', {}))
        .rejects.toThrow('Share not found');
    });
  });

  describe('share listing', () => {
    it('should get transcript shares', async () => {
      const shares = [
        { id: 'share-1', transcriptId: 'test-transcript-1', createdAt: new Date() },
        { id: 'share-2', transcriptId: 'test-transcript-1', createdAt: new Date() }
      ];

      const mockIndex = {
        getAll: jest.fn().mockReturnValue({
          onsuccess() { this.result = shares; },
          onerror() {}
        })
      };

      mockObjectStore.index.mockReturnValue(mockIndex);

      const result = await service.getTranscriptShares('test-transcript-1');
      
      expect(result).toHaveLength(2);
      expect(result[0]).toHaveProperty('shareUrl');
      expect(result[0]).not.toHaveProperty('password'); // Should be filtered out
    });
  });

  describe('analytics', () => {
    it('should get share analytics', async () => {
      const mockShare = {
        id: 'share-123',
        expiresAt: new Date('2024-02-15T10:00:00Z'),
        isActive: true
      };

      const mockAccesses = [
        { shareId: 'share-123', accessedBy: 'user1', accessedAt: new Date('2024-01-16T10:00:00Z') },
        { shareId: 'share-123', accessedBy: 'user2', accessedAt: new Date('2024-01-17T10:00:00Z') },
        { shareId: 'share-123', accessedBy: 'user1', accessedAt: new Date('2024-01-18T10:00:00Z') }
      ];

      mockObjectStore.get.mockReturnValue({
        onsuccess() { this.result = mockShare; },
        onerror() {}
      });

      const mockIndex = {
        getAll: jest.fn().mockReturnValue({
          onsuccess() { this.result = mockAccesses; },
          onerror() {}
        })
      };

      mockObjectStore.index.mockReturnValue(mockIndex);

      const analytics = await service.getShareAnalytics('share-123');
      
      expect(analytics.totalAccesses).toBe(3);
      expect(analytics.uniqueAccessors).toBe(2);
      expect(analytics).toHaveProperty('firstAccess');
      expect(analytics).toHaveProperty('lastAccess');
      expect(analytics).toHaveProperty('accessesByDay');
      expect(analytics).toHaveProperty('topAccessors');
      expect(analytics.isExpired).toBe(false);
      expect(analytics.isActive).toBe(true);
    });
  });

  describe('cleanup', () => {
    it('should cleanup expired shares', async () => {
      const mockCursor = {
        value: { id: 'expired-share', expiresAt: new Date('2023-01-01T00:00:00Z') },
        delete: jest.fn().mockReturnValue({
          onsuccess() { this.result = true; },
          onerror() {}
        }),
        continue: jest.fn().mockReturnValue(false)
      };

      mockObjectStore.openCursor.mockReturnValue({
        onsuccess() { this.result = mockCursor; },
        onerror() {}
      });

      const deletedShares = await service.cleanupExpiredShares();
      
      expect(deletedShares).toContain('expired-share');
      expect(mockCursor.delete).toHaveBeenCalled();
    });
  });

  describe('helper methods', () => {
    it('should hash passwords', async () => {
      const hash = await service._hashPassword('test-password');
      
      expect(mockCrypto.subtle.digest).toHaveBeenCalledWith('SHA-256', expect.any(Uint8Array));
      expect(Array.isArray(hash)).toBe(true);
    });

    it('should verify passwords', async () => {
      const hash = [1, 2, 3, 4];
      service._hashPassword = jest.fn().mockResolvedValue(hash);

      const isValid = await service._verifyPassword('test-password', hash);
      
      expect(isValid).toBe(true);
    });

    it('should generate unique share IDs', () => {
      const id1 = service._generateShareId();
      const id2 = service._generateShareId();
      
      expect(id1).not.toBe(id2);
      expect(id1).toMatch(/^share_\d+_[a-z0-9]+$/);
    });

    it('should generate share URLs', () => {
      const url = service._generateShareUrl('share-123');
      
      expect(url).toBe('https://example.com/share/share-123');
    });

    it('should calculate default expiry', () => {
      const expiry = service._getDefaultExpiry();
      const now = new Date();
      const thirtyDaysLater = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
      
      expect(expiry.getTime()).toBeCloseTo(thirtyDaysLater.getTime(), -1000);
    });

    it('should group accesses by day', () => {
      const accesses = [
        { accessedAt: new Date('2024-01-15T10:00:00Z') },
        { accessedAt: new Date('2024-01-15T14:00:00Z') },
        { accessedAt: new Date('2024-01-16T10:00:00Z') }
      ];

      const grouped = service._groupAccessesByDay(accesses);
      
      expect(grouped['Mon Jan 15 2024']).toBe(2);
      expect(grouped['Tue Jan 16 2024']).toBe(1);
    });

    it('should get top accessors', () => {
      const accesses = [
        { accessedBy: 'user1' },
        { accessedBy: 'user2' },
        { accessedBy: 'user1' },
        { accessedBy: 'user3' },
        { accessedBy: 'user1' }
      ];

      const topAccessors = service._getTopAccessors(accesses);
      
      expect(topAccessors[0]).toEqual({ accessor: 'user1', count: 3 });
      expect(topAccessors[1]).toEqual({ accessor: 'user2', count: 1 });
      expect(topAccessors[2]).toEqual({ accessor: 'user3', count: 1 });
    });
  });
});