/**
 * Jest Setup File
 * Global test configuration and mocks
 */

// Mock Chrome Extension APIs
global.chrome = {
  runtime: {
    sendMessage: jest.fn(() => Promise.resolve({ success: true })),
    onMessage: {
      addListener: jest.fn()
    },
    onInstalled: {
      addListener: jest.fn()
    },
    getURL: jest.fn((path) => `chrome-extension://test-id/${path}`),
    openOptionsPage: jest.fn()
  },
  storage: {
    sync: {
      get: jest.fn(() => Promise.resolve({})),
      set: jest.fn(() => Promise.resolve())
    },
    local: {
      get: jest.fn(() => Promise.resolve({})),
      set: jest.fn(() => Promise.resolve()),
      clear: jest.fn(() => Promise.resolve())
    },
    onChanged: {
      addListener: jest.fn()
    }
  },
  tabs: {
    query: jest.fn(() => Promise.resolve([{ id: 1, url: 'https://meet.google.com/test' }])),
    sendMessage: jest.fn(() => Promise.resolve({ success: true })),
    create: jest.fn(() => Promise.resolve({ id: 2 })),
    onUpdated: {
      addListener: jest.fn()
    }
  },
  identity: {
    getAuthToken: jest.fn(() => Promise.resolve('mock-token')),
    removeCachedAuthToken: jest.fn(() => Promise.resolve())
  },
  scripting: {
    executeScript: jest.fn(() => Promise.resolve())
  }
};

// Mock DOM APIs
global.document = {
  readyState: 'complete',
  addEventListener: jest.fn(),
  querySelector: jest.fn(),
  querySelectorAll: jest.fn(() => []),
  createElement: jest.fn(() => ({
    className: '',
    innerHTML: '',
    style: {},
    addEventListener: jest.fn(),
    appendChild: jest.fn(),
    remove: jest.fn(),
    textContent: '',
    setAttribute: jest.fn(),
    getAttribute: jest.fn()
  })),
  body: {
    appendChild: jest.fn(),
    addEventListener: jest.fn()
  },
  head: {
    appendChild: jest.fn()
  }
};

global.window = {
  location: {
    href: 'https://meet.google.com/abc-defg-hij',
    hostname: 'meet.google.com'
  },
  addEventListener: jest.fn(),
  MutationObserver: jest.fn(() => ({
    observe: jest.fn(),
    disconnect: jest.fn()
  })),
  AudioContext: jest.fn(() => ({
    createAnalyser: jest.fn(() => ({
      fftSize: 2048,
      frequencyBinCount: 1024,
      getByteFrequencyData: jest.fn()
    })),
    createMediaStreamSource: jest.fn(() => ({
      connect: jest.fn()
    })),
    close: jest.fn()
  })),
  webkitAudioContext: jest.fn()
};

global.navigator = {
  mediaDevices: {
    getUserMedia: jest.fn(() => Promise.resolve({
      getTracks: () => [{ stop: jest.fn() }]
    })),
    getDisplayMedia: jest.fn(() => Promise.resolve({
      getTracks: () => [{ stop: jest.fn() }]
    }))
  },
  clipboard: {
    writeText: jest.fn(() => Promise.resolve())
  }
};

// Mock Media APIs
global.MediaRecorder = jest.fn(() => ({
  start: jest.fn(),
  stop: jest.fn(),
  ondataavailable: null,
  onstop: null
}));

global.FileReader = jest.fn(() => ({
  readAsArrayBuffer: jest.fn(),
  onload: null,
  result: new ArrayBuffer(8)
}));

global.Blob = jest.fn((chunks, options) => ({
  size: chunks ? chunks.reduce((size, chunk) => size + chunk.length, 0) : 0,
  type: options?.type || ''
}));

// Mock fetch API
global.fetch = jest.fn(() => Promise.resolve({
  ok: true,
  status: 200,
  json: () => Promise.resolve({}),
  text: () => Promise.resolve('')
}));

// Console methods for testing
global.console = {
  ...console,
  log: jest.fn(),
  warn: jest.fn(),
  error: jest.fn()
};

// Clean up after each test
afterEach(() => {
  jest.clearAllMocks();
});