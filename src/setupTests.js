// Jest setup file for testing environment

// Mock Web Audio API globally
global.AudioContext = jest.fn(() => ({
  sampleRate: 16000,
  state: 'running',
  createMediaStreamSource: jest.fn(),
  createAnalyser: jest.fn(),
  createGain: jest.fn(),
  createBiquadFilter: jest.fn(),
  createScriptProcessor: jest.fn(),
  close: jest.fn(),
  destination: {}
}));

global.webkitAudioContext = global.AudioContext;

// Mock navigator.mediaDevices
Object.defineProperty(global.navigator, 'mediaDevices', {
  writable: true,
  value: {
    getUserMedia: jest.fn(),
    enumerateDevices: jest.fn()
  }
});

// Mock MediaStream
global.MediaStream = jest.fn(() => ({
  getTracks: jest.fn(() => []),
  getAudioTracks: jest.fn(() => []),
  getVideoTracks: jest.fn(() => [])
}));

// Suppress console warnings in tests
const originalWarn = console.warn;
console.warn = (...args) => {
  if (args[0]?.includes?.('React.createElement: type is invalid')) {
    return;
  }
  originalWarn(...args);
};