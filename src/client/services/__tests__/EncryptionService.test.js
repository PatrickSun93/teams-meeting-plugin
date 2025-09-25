/**
 * Tests for EncryptionService
 */

import EncryptionService from '../EncryptionService.js';

// Mock Web Crypto API for testing
const mockCrypto = {
  subtle: {
    generateKey: jest.fn(),
    encrypt: jest.fn(),
    decrypt: jest.fn(),
    exportKey: jest.fn(),
    importKey: jest.fn(),
    deriveKey: jest.fn(),
    deriveBits: jest.fn()
  },
  getRandomValues: jest.fn()
};

// Mock TextEncoder/TextDecoder
global.TextEncoder = jest.fn().mockImplementation(() => ({
  encode: jest.fn().mockReturnValue(new Uint8Array([1, 2, 3, 4]))
}));

global.TextDecoder = jest.fn().mockImplementation(() => ({
  decode: jest.fn().mockReturnValue('decoded text')
}));

Object.defineProperty(global, 'crypto', {
  value: mockCrypto
});

describe('EncryptionService', () => {
  let encryptionService;

  beforeEach(() => {
    encryptionService = new EncryptionService();
    jest.clearAllMocks();
  });

  describe('Key Generation', () => {
    test('should generate encryption key', async () => {
      const mockKey = { type: 'secret', algorithm: { name: 'AES-GCM' } };
      mockCrypto.subtle.generateKey.mockResolvedValue(mockKey);

      const key = await encryptionService.generateKey();

      expect(mockCrypto.subtle.generateKey).toHaveBeenCalledWith(
        { name: 'AES-GCM', length: 256 },
        true,
        ['encrypt', 'decrypt']
      );
      expect(key).toBe(mockKey);
    });

    test('should derive key from password', async () => {
      const password = 'test-password';
      const salt = new Uint8Array([1, 2, 3, 4]);
      const mockKeyMaterial = { type: 'raw' };
      const mockDerivedKey = { type: 'secret' };

      mockCrypto.subtle.importKey.mockResolvedValue(mockKeyMaterial);
      mockCrypto.subtle.deriveKey.mockResolvedValue(mockDerivedKey);

      const key = await encryptionService.deriveKeyFromPassword(password, salt);

      expect(mockCrypto.subtle.importKey).toHaveBeenCalledWith(
        'raw',
        expect.any(Uint8Array),
        { name: 'PBKDF2' },
        false,
        ['deriveBits', 'deriveKey']
      );

      expect(mockCrypto.subtle.deriveKey).toHaveBeenCalledWith(
        {
          name: 'PBKDF2',
          salt: salt,
          iterations: 100000,
          hash: 'SHA-256'
        },
        mockKeyMaterial,
        { name: 'AES-GCM', length: 256 },
        true,
        ['encrypt', 'decrypt']
      );

      expect(key).toBe(mockDerivedKey);
    });

    test('should generate random salt', () => {
      const mockSalt = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16]);
      mockCrypto.getRandomValues.mockReturnValue(mockSalt);

      const salt = encryptionService.generateSalt();

      expect(mockCrypto.getRandomValues).toHaveBeenCalledWith(expect.any(Uint8Array));
      expect(salt).toBe(mockSalt);
    });

    test('should generate random IV', () => {
      const mockIV = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
      mockCrypto.getRandomValues.mockReturnValue(mockIV);

      const iv = encryptionService.generateIV();

      expect(mockCrypto.getRandomValues).toHaveBeenCalledWith(expect.any(Uint8Array));
      expect(iv).toBe(mockIV);
    });
  });

  describe('Encryption/Decryption', () => {
    test('should encrypt data', async () => {
      const testData = 'test data';
      const mockKey = { type: 'secret' };
      const mockEncryptedData = new ArrayBuffer(16);
      const mockIV = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);

      mockCrypto.getRandomValues.mockReturnValue(mockIV);
      mockCrypto.subtle.encrypt.mockResolvedValue(mockEncryptedData);

      const result = await encryptionService.encrypt(testData, mockKey);

      expect(mockCrypto.subtle.encrypt).toHaveBeenCalledWith(
        { name: 'AES-GCM', iv: mockIV },
        mockKey,
        expect.any(Uint8Array)
      );

      expect(result).toEqual({
        encryptedData: mockEncryptedData,
        iv: mockIV
      });
    });

    test('should encrypt object data', async () => {
      const testData = { message: 'test', value: 123 };
      const mockKey = { type: 'secret' };
      const mockEncryptedData = new ArrayBuffer(16);
      const mockIV = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);

      mockCrypto.getRandomValues.mockReturnValue(mockIV);
      mockCrypto.subtle.encrypt.mockResolvedValue(mockEncryptedData);

      const result = await encryptionService.encrypt(testData, mockKey);

      expect(result).toEqual({
        encryptedData: mockEncryptedData,
        iv: mockIV
      });
    });

    test('should decrypt data', async () => {
      const mockEncryptedData = new ArrayBuffer(16);
      const mockIV = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
      const mockKey = { type: 'secret' };
      const mockDecryptedBuffer = new ArrayBuffer(8);

      mockCrypto.subtle.decrypt.mockResolvedValue(mockDecryptedBuffer);

      const result = await encryptionService.decrypt(mockEncryptedData, mockIV, mockKey);

      expect(mockCrypto.subtle.decrypt).toHaveBeenCalledWith(
        { name: 'AES-GCM', iv: mockIV },
        mockKey,
        mockEncryptedData
      );

      expect(result).toBe('decoded text');
    });
  });

  describe('Key Import/Export', () => {
    test('should export key', async () => {
      const mockKey = { type: 'secret' };
      const mockExportedKey = new ArrayBuffer(32);

      mockCrypto.subtle.exportKey.mockResolvedValue(mockExportedKey);

      const result = await encryptionService.exportKey(mockKey);

      expect(mockCrypto.subtle.exportKey).toHaveBeenCalledWith('raw', mockKey);
      expect(result).toBe(mockExportedKey);
    });

    test('should import key', async () => {
      const mockKeyData = new ArrayBuffer(32);
      const mockImportedKey = { type: 'secret' };

      mockCrypto.subtle.importKey.mockResolvedValue(mockImportedKey);

      const result = await encryptionService.importKey(mockKeyData);

      expect(mockCrypto.subtle.importKey).toHaveBeenCalledWith(
        'raw',
        mockKeyData,
        { name: 'AES-GCM' },
        true,
        ['encrypt', 'decrypt']
      );
      expect(result).toBe(mockImportedKey);
    });
  });

  describe('Transcript Encryption', () => {
    test('should encrypt transcript with metadata', async () => {
      const mockTranscript = { id: '123', text: 'meeting transcript' };
      const mockKey = { type: 'secret' };
      const mockEncryptedData = new ArrayBuffer(16);
      const mockIV = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);

      mockCrypto.getRandomValues.mockReturnValue(mockIV);
      mockCrypto.subtle.encrypt.mockResolvedValue(mockEncryptedData);

      const result = await encryptionService.encryptTranscript(mockTranscript, mockKey);

      expect(result).toEqual({
        encryptedData: Array.from(new Uint8Array(mockEncryptedData)),
        iv: Array.from(mockIV),
        timestamp: expect.any(Number),
        algorithm: 'AES-GCM',
        version: '1.0'
      });
    });

    test('should decrypt transcript', async () => {
      const mockEncryptedPackage = {
        encryptedData: [1, 2, 3, 4],
        iv: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
        timestamp: Date.now(),
        algorithm: 'AES-GCM',
        version: '1.0'
      };
      const mockKey = { type: 'secret' };
      const mockDecryptedBuffer = new ArrayBuffer(8);

      // Mock TextDecoder to return valid JSON
      global.TextDecoder = jest.fn().mockImplementation(() => ({
        decode: jest.fn().mockReturnValue('{"id": "123", "text": "decrypted transcript"}')
      }));

      mockCrypto.subtle.decrypt.mockResolvedValue(mockDecryptedBuffer);

      const result = await encryptionService.decryptTranscript(mockEncryptedPackage, mockKey);

      expect(mockCrypto.subtle.decrypt).toHaveBeenCalled();
      expect(result).toEqual({ id: "123", text: "decrypted transcript" });
    });
  });

  describe('Secure Delete', () => {
    test('should securely delete ArrayBuffer', () => {
      const mockData = new ArrayBuffer(16);
      const mockView = new Uint8Array(mockData);
      
      // Mock Uint8Array constructor
      global.Uint8Array = jest.fn().mockReturnValue(mockView);
      mockCrypto.getRandomValues.mockReturnValue(mockView);

      encryptionService.secureDelete(mockData);

      expect(mockCrypto.getRandomValues).toHaveBeenCalledWith(mockView);
    });

    test('should securely delete Uint8Array', () => {
      const mockData = new Uint8Array(16);
      
      // Test that the function doesn't throw an error
      expect(() => {
        encryptionService.secureDelete(mockData);
      }).not.toThrow();
    });
  });

  describe('Error Handling', () => {
    test('should handle encryption errors', async () => {
      const testData = 'test data';
      const mockKey = { type: 'secret' };
      const error = new Error('Encryption failed');

      mockCrypto.subtle.encrypt.mockRejectedValue(error);

      await expect(encryptionService.encrypt(testData, mockKey)).rejects.toThrow('Encryption failed');
    });

    test('should handle decryption errors', async () => {
      const mockEncryptedData = new ArrayBuffer(16);
      const mockIV = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
      const mockKey = { type: 'secret' };
      const error = new Error('Decryption failed');

      mockCrypto.subtle.decrypt.mockRejectedValue(error);

      await expect(encryptionService.decrypt(mockEncryptedData, mockIV, mockKey))
        .rejects.toThrow('Decryption failed');
    });

    test('should handle key generation errors', async () => {
      const error = new Error('Key generation failed');
      mockCrypto.subtle.generateKey.mockRejectedValue(error);

      await expect(encryptionService.generateKey()).rejects.toThrow('Key generation failed');
    });
  });
});