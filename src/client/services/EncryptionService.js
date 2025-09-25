/**
 * EncryptionService - Handles data encryption for stored transcripts and configurations
 * Provides AES-GCM encryption using Web Crypto API for client-side security
 */

class EncryptionService {
  constructor() {
    this.algorithm = 'AES-GCM';
    this.keyLength = 256;
    this.ivLength = 12; // 96 bits for GCM
  }

  /**
   * Generate a new encryption key
   * @returns {Promise<CryptoKey>} Generated encryption key
   */
  async generateKey() {
    return await crypto.subtle.generateKey(
      {
        name: this.algorithm,
        length: this.keyLength,
      },
      true, // extractable
      ['encrypt', 'decrypt']
    );
  }

  /**
   * Derive key from password using PBKDF2
   * @param {string} password - User password
   * @param {Uint8Array} salt - Salt for key derivation
   * @returns {Promise<CryptoKey>} Derived encryption key
   */
  async deriveKeyFromPassword(password, salt) {
    const encoder = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      encoder.encode(password),
      { name: 'PBKDF2' },
      false,
      ['deriveBits', 'deriveKey']
    );

    return await crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: salt,
        iterations: 100000,
        hash: 'SHA-256',
      },
      keyMaterial,
      { name: this.algorithm, length: this.keyLength },
      true,
      ['encrypt', 'decrypt']
    );
  }

  /**
   * Generate random salt
   * @returns {Uint8Array} Random salt
   */
  generateSalt() {
    return crypto.getRandomValues(new Uint8Array(16));
  }

  /**
   * Generate random IV
   * @returns {Uint8Array} Random initialization vector
   */
  generateIV() {
    return crypto.getRandomValues(new Uint8Array(this.ivLength));
  }

  /**
   * Encrypt data
   * @param {string|object} data - Data to encrypt
   * @param {CryptoKey} key - Encryption key
   * @returns {Promise<{encryptedData: ArrayBuffer, iv: Uint8Array}>} Encrypted data and IV
   */
  async encrypt(data, key) {
    const encoder = new TextEncoder();
    const dataString = typeof data === 'string' ? data : JSON.stringify(data);
    const dataBuffer = encoder.encode(dataString);
    
    const iv = this.generateIV();
    
    const encryptedData = await crypto.subtle.encrypt(
      {
        name: this.algorithm,
        iv: iv,
      },
      key,
      dataBuffer
    );

    return {
      encryptedData,
      iv,
    };
  }

  /**
   * Decrypt data
   * @param {ArrayBuffer} encryptedData - Encrypted data
   * @param {Uint8Array} iv - Initialization vector
   * @param {CryptoKey} key - Decryption key
   * @returns {Promise<string>} Decrypted data
   */
  async decrypt(encryptedData, iv, key) {
    const decryptedBuffer = await crypto.subtle.decrypt(
      {
        name: this.algorithm,
        iv: iv,
      },
      key,
      encryptedData
    );

    const decoder = new TextDecoder();
    return decoder.decode(decryptedBuffer);
  }

  /**
   * Export key to raw format
   * @param {CryptoKey} key - Key to export
   * @returns {Promise<ArrayBuffer>} Exported key
   */
  async exportKey(key) {
    return await crypto.subtle.exportKey('raw', key);
  }

  /**
   * Import key from raw format
   * @param {ArrayBuffer} keyData - Raw key data
   * @returns {Promise<CryptoKey>} Imported key
   */
  async importKey(keyData) {
    return await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: this.algorithm },
      true,
      ['encrypt', 'decrypt']
    );
  }

  /**
   * Encrypt transcript data with metadata
   * @param {object} transcript - Transcript object to encrypt
   * @param {CryptoKey} key - Encryption key
   * @returns {Promise<object>} Encrypted transcript package
   */
  async encryptTranscript(transcript, key) {
    const { encryptedData, iv } = await this.encrypt(transcript, key);
    
    return {
      encryptedData: Array.from(new Uint8Array(encryptedData)),
      iv: Array.from(iv),
      timestamp: Date.now(),
      algorithm: this.algorithm,
      version: '1.0'
    };
  }

  /**
   * Decrypt transcript data
   * @param {object} encryptedPackage - Encrypted transcript package
   * @param {CryptoKey} key - Decryption key
   * @returns {Promise<object>} Decrypted transcript
   */
  async decryptTranscript(encryptedPackage, key) {
    const encryptedData = new Uint8Array(encryptedPackage.encryptedData).buffer;
    const iv = new Uint8Array(encryptedPackage.iv);
    
    const decryptedString = await this.decrypt(encryptedData, iv, key);
    return JSON.parse(decryptedString);
  }

  /**
   * Secure delete - overwrite memory with random data
   * @param {ArrayBuffer|Uint8Array} data - Data to securely delete
   */
  secureDelete(data) {
    if (data instanceof ArrayBuffer) {
      const view = new Uint8Array(data);
      crypto.getRandomValues(view);
    } else if (data instanceof Uint8Array) {
      crypto.getRandomValues(data);
    }
  }
}

export default EncryptionService;