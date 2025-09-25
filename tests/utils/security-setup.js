// Setup for security tests
import crypto from 'crypto';

// Mock crypto APIs for security tests
beforeAll(() => {
  // Mock Web Crypto API
  if (typeof window !== 'undefined') {
    Object.defineProperty(window, 'crypto', {
      value: {
        getRandomValues: (arr) => {
          for (let i = 0; i < arr.length; i++) {
            arr[i] = Math.floor(Math.random() * 256);
          }
          return arr;
        },
        subtle: {
          encrypt: jest.fn(),
          decrypt: jest.fn(),
          generateKey: jest.fn(),
          importKey: jest.fn(),
          exportKey: jest.fn(),
          sign: jest.fn(),
          verify: jest.fn()
        }
      }
    });
  }
  
  // Mock Node.js crypto for server-side tests
  if (typeof global !== 'undefined') {
    global.crypto = crypto;
  }
});

// Security test helpers
global.securityTestHelpers = {
  generateSecureRandom: (length = 32) => {
    const array = new Uint8Array(length);
    if (typeof window !== 'undefined' && window.crypto) {
      window.crypto.getRandomValues(array);
    } else {
      for (let i = 0; i < length; i++) {
        array[i] = Math.floor(Math.random() * 256);
      }
    }
    return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
  },
  
  createMockApiKey: (prefix = 'sk') => {
    return `${prefix}-${global.securityTestHelpers.generateSecureRandom(16)}`;
  }
};

// Extended timeout for security tests
jest.setTimeout(45000);