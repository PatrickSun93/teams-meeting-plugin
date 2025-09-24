/**
 * Tests for TranscriptStorageService
 */

import TranscriptStorageService from '../TranscriptStorageService';

// Mock IndexedDB
const mockIndexedDB = {
  open: jest.fn(),
  deleteDatabase: jest.fn()
};

const mockRequest = {
  result: null,
  error: null,
  onsuccess: null,
  onerror: null,
  onupgradeneeded: null
};

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
  index: jest.fn()
};

const mockTransaction = {
  objectStore: jest.fn(() => mockObjectStore)
};

// Mock crypto API
const mockCrypto = {
  subtle: {
    generateKey: jest.fn(),
    exportKey: jest.fn(),
    importKey: jest.fn(),
    encrypt: jest.fn(),
    decrypt: jest.fn(),
    digest: jest.fn()
  },
  getRandomValues: jest.fn()
};

// Setup mocks
global.indexedDB = mockIndexedDB;
global.crypto = mockCrypto;
global.TextEncoder = jest.fn(() => ({
  encode: jest.fn(text => new Uint8Array(Buffer.from(text)))
}));
global.TextDecoder = jest.fn(() => ({
  decode: jest.fn(buffer => Buffer.from(buffer).toString())
}));

describe('TranscriptStorageService', () => {
  let service;
  let mockTranscript;

  beforeEach(() => {
    service = new TranscriptStorageService();
    
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
            text: 'Hello everyone, welcome to the meeting.',
            startTime: 0,
            endTime: 3,
            confidence: 0.95
          },
          {
            id: 'seg2',
            speakerId: 'speaker2',
            speakerName: 'Jane Smith',
            text: 'Thank you for joining us today.',
            startTime: 3,
            endTime: 6,
            confidence: 0.92
          }
        ]
      },
      metadata: {
        duration: 6,
        participantCount: 2
      },
      tags: ['weekly', 'standup']
    };

    // Reset mocks
    jest.clearAllMocks();
    
    // Setup default mock behaviors
    mockIndexedDB.open.mockReturnValue(mockRequest);
    mockDB.transaction.mockReturnValue(mockTransaction);
    mockDB.objectStoreNames.contains.mockReturnValue(false);
    mockDB.createObjectStore.mockReturnValue(mockObjectStore);
    
    // Mock successful request
    mockRequest.result = mockDB;
    
    // Mock crypto operations
    mockCrypto.subtle.generateKey.mockResolvedValue('mock-key');
    mockCrypto.subtle.exportKey.mockResolvedValue(new ArrayBuffer(32));
    mockCrypto.subtle.importKey.mockResolvedValue('mock-key');
    mockCrypto.subtle.encrypt.mockResolvedValue(new ArrayBuffer(64));
    mockCrypto.subtle.decrypt.mockResolvedValue(new ArrayBuffer(32));
    mockCrypto.getRandomValues.mockReturnValue(new Uint8Array(12));
  });

  describe('initialization', () => {
    it('should initialize database successfully', async () => {
      // Simulate successful database opening
      setTimeout(() => {
        if (mockRequest.onsuccess) {
          mockRequest.onsuccess();
        }
      }, 0);

      await service.initialize();
      
      expect(mockIndexedDB.open).toHaveBeenCalledWith('TeamsTranscriptionDB', 1);
      expect(service.db).toBe(mockDB);
    });

    it('should handle database initialization error', async () => {
      const error = new Error('Database initialization failed');
      
      setTimeout(() => {
        mockRequest.error = error;
        if (mockRequest.onerror) {
          mockRequest.onerror();
        }
      }, 0);

      await expect(service.initialize()).rejects.toThrow('Database initialization failed');
    });

    it('should create object stores on upgrade', async () => {
      setTimeout(() => {
        if (mockRequest.onupgradeneeded) {
          mockRequest.onupgradeneeded({ target: { result: mockDB } });
        }
        if (mockRequest.onsuccess) {
          mockRequest.onsuccess();
        }
      }, 0);

      await service.initialize();
      
      expect(mockDB.createObjectStore).toHaveBeenCalledWith('transcripts', { keyPath: 'id' });
      expect(mockDB.createObjectStore).toHaveBeenCalledWith('encryption', { keyPath: 'id' });
      expect(mockDB.createObjectStore).toHaveBeenCalledWith('searchIndex', { keyPath: 'transcriptId' });
    });
  });

  describe('encryption', () => {
    beforeEach(async () => {
      service.db = mockDB;
    });

    it('should generate encryption key', async () => {
      mockObjectStore.get.mockReturnValue({
        onsuccess() { 
          this.result = null;
          setTimeout(() => this.onsuccess && this.onsuccess(), 0);
        },
        onerror() {}
      });
      
      mockObjectStore.put.mockReturnValue({
        onsuccess() { 
          this.result = true;
          setTimeout(() => this.onsuccess && this.onsuccess(), 0);
        },
        onerror() {}
      });

      const key = await service.getEncryptionKey();
      
      expect(mockCrypto.subtle.generateKey).toHaveBeenCalledWith(
        { name: 'AES-GCM', length: 256 },
        true,
        ['encrypt', 'decrypt']
      );
      expect(key).toBe('mock-key');
    });

    it('should encrypt content', async () => {
      service.encryptionKey = 'mock-key';
      
      const content = { test: 'data' };
      const encrypted = await service.encryptContent(content);
      
      expect(mockCrypto.subtle.encrypt).toHaveBeenCalled();
      expect(encrypted).toHaveProperty('encrypted');
      expect(encrypted).toHaveProperty('iv');
    });

    it('should decrypt content', async () => {
      service.encryptionKey = 'mock-key';
      
      const encryptedData = {
        encrypted: [1, 2, 3, 4],
        iv: [5, 6, 7, 8]
      };
      
      const decrypted = await service.decryptContent(encryptedData);
      
      expect(mockCrypto.subtle.decrypt).toHaveBeenCalled();
    });
  });

  describe('transcript storage', () => {
    beforeEach(async () => {
      service.db = mockDB;
    });

    it('should store transcript without encryption', async () => {
      mockObjectStore.put.mockReturnValue({
        onsuccess() { this.result = 'test-transcript-1'; },
        onerror() {}
      });

      const id = await service.storeTranscript(mockTranscript, false);
      
      expect(mockObjectStore.put).toHaveBeenCalled();
      expect(id).toBe(mockTranscript.id);
    });

    it('should store transcript with encryption', async () => {
      service.encryptionKey = 'mock-key';
      
      mockObjectStore.put.mockReturnValue({
        onsuccess() { this.result = 'test-transcript-1'; },
        onerror() {}
      });

      const id = await service.storeTranscript(mockTranscript, true);
      
      expect(mockCrypto.subtle.encrypt).toHaveBeenCalled();
      expect(id).toBe(mockTranscript.id);
    });

    it('should handle storage errors', async () => {
      const error = new Error('Storage failed');
      mockObjectStore.put.mockReturnValue({
        onsuccess() {},
        onerror() { this.error = error; }
      });

      await expect(service.storeTranscript(mockTranscript)).rejects.toThrow('Failed to store transcript: Storage failed');
    });
  });

  describe('transcript retrieval', () => {
    beforeEach(async () => {
      service.db = mockDB;
    });

    it('should retrieve transcript by ID', async () => {
      const storedTranscript = { ...mockTranscript, encrypted: false };
      
      mockObjectStore.get.mockReturnValue({
        onsuccess() { this.result = storedTranscript; },
        onerror() {}
      });

      const result = await service.getTranscript('test-transcript-1');
      
      expect(mockObjectStore.get).toHaveBeenCalledWith('test-transcript-1');
      expect(result).toEqual(storedTranscript);
    });

    it('should return null for non-existent transcript', async () => {
      mockObjectStore.get.mockReturnValue({
        onsuccess() { this.result = null; },
        onerror() {}
      });

      const result = await service.getTranscript('non-existent');
      
      expect(result).toBeNull();
    });

    it('should decrypt encrypted transcript', async () => {
      service.encryptionKey = 'mock-key';
      
      const encryptedTranscript = {
        ...mockTranscript,
        encrypted: true,
        content: { encrypted: [1, 2, 3], iv: [4, 5, 6] }
      };
      
      mockObjectStore.get.mockReturnValue({
        onsuccess() { this.result = encryptedTranscript; },
        onerror() {}
      });

      const result = await service.getTranscript('test-transcript-1');
      
      expect(mockCrypto.subtle.decrypt).toHaveBeenCalled();
    });

    it('should get all transcripts', async () => {
      const transcripts = [mockTranscript];
      
      mockObjectStore.getAll.mockReturnValue({
        onsuccess() { this.result = transcripts; },
        onerror() {}
      });

      const result = await service.getAllTranscripts();
      
      expect(result).toEqual(transcripts);
    });

    it('should filter transcripts by meeting ID', async () => {
      const transcripts = [mockTranscript];
      const mockIndex = {
        getAll: jest.fn().mockReturnValue({
          onsuccess() { this.result = transcripts; },
          onerror() {}
        })
      };
      
      mockObjectStore.index.mockReturnValue(mockIndex);

      const result = await service.getAllTranscripts({ meetingId: 'meeting-123' });
      
      expect(mockIndex.getAll).toHaveBeenCalledWith('meeting-123');
      expect(result).toEqual(transcripts);
    });
  });

  describe('search functionality', () => {
    beforeEach(async () => {
      service.db = mockDB;
    });

    it('should search transcripts by keywords', async () => {
      const searchResults = [
        { transcriptId: 'test-transcript-1', keywords: ['meeting', 'welcome'] }
      ];
      
      const mockIndex = {
        getAll: jest.fn().mockReturnValue({
          onsuccess() { this.result = searchResults; },
          onerror() {}
        })
      };
      
      mockObjectStore.index.mockReturnValue(mockIndex);
      mockObjectStore.get.mockReturnValue({
        onsuccess() { this.result = mockTranscript; },
        onerror() {}
      });

      const results = await service.searchTranscripts('meeting welcome');
      
      expect(results).toHaveLength(1);
      expect(results[0]).toHaveProperty('relevanceScore');
    });

    it('should handle search errors', async () => {
      const error = new Error('Search failed');
      const mockIndex = {
        getAll: jest.fn().mockReturnValue({
          onsuccess() {},
          onerror() { this.error = error; }
        })
      };
      
      mockObjectStore.index.mockReturnValue(mockIndex);

      await expect(service.searchTranscripts('test')).rejects.toThrow('Search failed: Search failed');
    });
  });

  describe('transcript deletion', () => {
    beforeEach(async () => {
      service.db = mockDB;
    });

    it('should delete transcript', async () => {
      mockObjectStore.delete.mockReturnValue({
        onsuccess() { this.result = true; },
        onerror() {}
      });

      const result = await service.deleteTranscript('test-transcript-1');
      
      expect(mockObjectStore.delete).toHaveBeenCalledWith('test-transcript-1');
      expect(result).toBe(true);
    });

    it('should delete multiple transcripts', async () => {
      mockObjectStore.delete.mockReturnValue({
        onsuccess() { this.result = true; },
        onerror() {}
      });

      const results = await service.deleteTranscripts(['id1', 'id2']);
      
      expect(results).toHaveLength(2);
      expect(results[0]).toEqual({ id: 'id1', success: true });
      expect(results[1]).toEqual({ id: 'id2', success: true });
    });

    it('should handle deletion errors', async () => {
      const error = new Error('Delete failed');
      mockObjectStore.delete.mockReturnValue({
        onsuccess() {},
        onerror() { this.error = error; }
      });

      await expect(service.deleteTranscript('test-transcript-1')).rejects.toThrow('Failed to delete transcript: Delete failed');
    });
  });

  describe('cleanup functionality', () => {
    beforeEach(async () => {
      service.db = mockDB;
    });

    it('should cleanup old transcripts', async () => {
      const oldTranscript = {
        ...mockTranscript,
        id: 'old-transcript',
        createdAt: new Date('2023-01-01T00:00:00Z')
      };
      
      mockObjectStore.getAll.mockReturnValue({
        onsuccess() { this.result = [oldTranscript]; },
        onerror() {}
      });
      
      mockObjectStore.delete.mockReturnValue({
        onsuccess() { this.result = true; },
        onerror() {}
      });

      const results = await service.cleanupOldTranscripts(30);
      
      expect(results).toHaveLength(1);
      expect(results[0]).toEqual({ id: 'old-transcript', success: true });
    });
  });

  describe('storage statistics', () => {
    beforeEach(async () => {
      service.db = mockDB;
    });

    it('should get storage statistics', async () => {
      const transcripts = [
        { ...mockTranscript, size: 1024, encrypted: false },
        { ...mockTranscript, id: 'transcript-2', size: 2048, encrypted: true, platform: 'zoom' }
      ];
      
      mockObjectStore.getAll.mockReturnValue({
        onsuccess() { this.result = transcripts; },
        onerror() {}
      });

      const stats = await service.getStorageStats();
      
      expect(stats.totalTranscripts).toBe(2);
      expect(stats.totalSize).toBe(3072);
      expect(stats.encryptedCount).toBe(1);
      expect(stats.platformBreakdown).toEqual({ teams: 1, zoom: 1 });
    });
  });

  describe('helper methods', () => {
    it('should extract keywords from content', () => {
      const keywords = service._extractKeywords(mockTranscript.content);
      
      expect(keywords).toContain('hello');
      expect(keywords).toContain('everyone');
      expect(keywords).toContain('welcome');
      expect(keywords).toContain('meeting');
      expect(keywords).toContain('thank');
      expect(keywords).toContain('joining');
      expect(keywords).toContain('today');
    });

    it('should calculate relevance score', () => {
      const transcript = {
        title: 'Weekly Meeting',
        tags: ['weekly', 'standup']
      };
      
      const score = service._calculateRelevanceScore(transcript, ['meeting', 'weekly']);
      
      expect(score).toBeGreaterThan(0);
    });

    it('should generate unique IDs', () => {
      const id1 = service._generateId();
      const id2 = service._generateId();
      
      expect(id1).not.toBe(id2);
      expect(id1).toMatch(/^transcript_\d+_[a-z0-9]+$/);
    });

    it('should calculate content size', () => {
      const size = service._calculateSize(mockTranscript.content);
      
      expect(size).toBeGreaterThan(0);
    });
  });
});