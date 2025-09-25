// Setup for accessibility tests
import 'jest-axe/extend-expect';

// Configure axe-core for accessibility testing
beforeAll(() => {
  // Configure axe rules
  if (typeof window !== 'undefined') {
    window.axe = {
      configure: jest.fn(),
      run: jest.fn()
    };
  }
});

// Mock media queries for accessibility tests
beforeEach(() => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: jest.fn().mockImplementation(query => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: jest.fn(),
      removeListener: jest.fn(),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      dispatchEvent: jest.fn(),
    })),
  });
});

// Mock screen reader APIs
global.speechSynthesis = {
  speak: jest.fn(),
  cancel: jest.fn(),
  pause: jest.fn(),
  resume: jest.fn(),
  getVoices: jest.fn(() => [])
};

// Extended timeout for accessibility tests
jest.setTimeout(45000);