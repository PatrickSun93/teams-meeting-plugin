// Test utilities and helpers for comprehensive testing
import { render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// Mock data generators
export const generateMockTranscript = (segmentCount = 5) => {
  return {
    id: `transcript-${Date.now()}`,
    meetingId: `meeting-${Math.random().toString(36).substr(2, 9)}`,
    startTime: new Date(Date.now() - 3600000), // 1 hour ago
    endTime: new Date(),
    segments: Array.from({ length: segmentCount }, (_, i) => ({
      id: `segment-${i}`,
      speakerId: `speaker-${i % 3}`,
      speakerName: `Speaker ${i % 3 + 1}`,
      text: `This is test segment number ${i + 1} with some sample content.`,
      startTime: i * 1000,
      endTime: (i + 1) * 1000,
      confidence: 0.85 + Math.random() * 0.15
    })),
    metadata: {
      duration: segmentCount * 1000,
      participantCount: 3,
      language: 'en-US'
    }
  };
};

export const generateMockAudioBuffer = (duration = 1, sampleRate = 16000) => {
  const length = duration * sampleRate;
  const buffer = new Float32Array(length);
  
  // Generate sine wave with some noise
  for (let i = 0; i < length; i++) {
    buffer[i] = Math.sin(2 * Math.PI * 440 * i / sampleRate) * 0.5 + 
                Math.random() * 0.1 - 0.05;
  }
  
  return buffer;
};

export const generateMockMeetingContext = (overrides = {}) => {
  return {
    meetingId: 'test-meeting-123',
    userId: 'user-456',
    userDisplayName: 'Test User',
    userEmail: 'test@example.com',
    isHost: false,
    participants: [
      { id: 'user-456', name: 'Test User', role: 'attendee' },
      { id: 'user-789', name: 'Another User', role: 'presenter' },
      { id: 'user-012', name: 'Meeting Host', role: 'organizer' }
    ],
    meetingTitle: 'Test Meeting',
    startTime: new Date(Date.now() - 1800000), // 30 minutes ago
    ...overrides
  };
};

export const generateMockSummary = () => {
  return {
    id: `summary-${Date.now()}`,
    meetingId: 'test-meeting-123',
    keyPoints: [
      'Discussed project timeline and milestones',
      'Reviewed budget allocation for Q1',
      'Identified potential risks and mitigation strategies',
      'Agreed on communication protocols'
    ],
    actionItems: [
      {
        id: 'action-1',
        assignee: 'John Doe',
        task: 'Prepare project proposal document',
        dueDate: '2024-01-15',
        priority: 'high'
      },
      {
        id: 'action-2',
        assignee: 'Jane Smith',
        task: 'Review vendor contracts',
        dueDate: '2024-01-20',
        priority: 'medium'
      }
    ],
    decisions: [
      'Approved budget increase of 15%',
      'Extended project deadline by 2 weeks',
      'Selected vendor A for implementation'
    ],
    nextMeeting: {
      date: '2024-01-22',
      agenda: ['Review progress', 'Discuss next phase']
    },
    generatedAt: new Date(),
    confidence: 0.92
  };
};

// Test environment setup helpers
export const setupTestEnvironment = () => {
  // Mock Web Audio API
  global.AudioContext = jest.fn(() => ({
    sampleRate: 16000,
    state: 'running',
    createMediaStreamSource: jest.fn(() => ({
      connect: jest.fn(),
      disconnect: jest.fn()
    })),
    createAnalyser: jest.fn(() => ({
      frequencyBinCount: 1024,
      getFloatFrequencyData: jest.fn(),
      getByteFrequencyData: jest.fn(),
      connect: jest.fn(),
      disconnect: jest.fn()
    })),
    createGain: jest.fn(() => ({
      gain: { value: 1 },
      connect: jest.fn(),
      disconnect: jest.fn()
    })),
    createBiquadFilter: jest.fn(() => ({
      type: 'lowpass',
      frequency: { value: 350 },
      connect: jest.fn(),
      disconnect: jest.fn()
    })),
    createScriptProcessor: jest.fn(() => ({
      onaudioprocess: null,
      connect: jest.fn(),
      disconnect: jest.fn()
    })),
    close: jest.fn(),
    destination: {}
  }));

  // Mock MediaDevices
  Object.defineProperty(global.navigator, 'mediaDevices', {
    writable: true,
    value: {
      getUserMedia: jest.fn().mockResolvedValue({
        getTracks: jest.fn(() => []),
        getAudioTracks: jest.fn(() => [{
          kind: 'audio',
          enabled: true,
          stop: jest.fn()
        }]),
        getVideoTracks: jest.fn(() => [])
      }),
      enumerateDevices: jest.fn().mockResolvedValue([
        { deviceId: 'default', kind: 'audioinput', label: 'Default Microphone' }
      ])
    }
  });

  // Mock IndexedDB
  global.indexedDB = {
    open: jest.fn(() => ({
      onsuccess: null,
      onerror: null,
      result: {
        createObjectStore: jest.fn(),
        transaction: jest.fn(() => ({
          objectStore: jest.fn(() => ({
            add: jest.fn(),
            get: jest.fn(),
            put: jest.fn(),
            delete: jest.fn(),
            getAll: jest.fn()
          }))
        }))
      }
    }))
  };

  // Mock localStorage
  const localStorageMock = {
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
    clear: jest.fn()
  };
  Object.defineProperty(window, 'localStorage', {
    value: localStorageMock
  });

  // Mock Teams SDK
  global.microsoftTeams = {
    initialize: jest.fn(),
    getContext: jest.fn(),
    authentication: {
      getAuthToken: jest.fn()
    },
    meeting: {
      getMeetingDetails: jest.fn()
    },
    chat: {
      sendMessage: jest.fn()
    }
  };
};

// Performance testing helpers
export const measurePerformance = async (fn, iterations = 1) => {
  const times = [];
  
  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    await fn();
    const end = performance.now();
    times.push(end - start);
  }
  
  return {
    min: Math.min(...times),
    max: Math.max(...times),
    avg: times.reduce((a, b) => a + b, 0) / times.length,
    median: times.sort((a, b) => a - b)[Math.floor(times.length / 2)],
    times
  };
};

export const createMemorySnapshot = () => {
  if (typeof window !== 'undefined' && window.performance && window.performance.memory) {
    return {
      used: window.performance.memory.usedJSHeapSize,
      total: window.performance.memory.totalJSHeapSize,
      limit: window.performance.memory.jsHeapSizeLimit
    };
  }
  
  if (typeof process !== 'undefined' && process.memoryUsage) {
    const usage = process.memoryUsage();
    return {
      used: usage.heapUsed,
      total: usage.heapTotal,
      external: usage.external,
      rss: usage.rss
    };
  }
  
  return null;
};

// Accessibility testing helpers
export const checkKeyboardNavigation = async (container) => {
  const user = userEvent.setup();
  const focusableElements = container.querySelectorAll(
    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
  );
  
  const results = [];
  
  for (let i = 0; i < focusableElements.length; i++) {
    await user.tab();
    const focused = document.activeElement;
    results.push({
      element: focusableElements[i],
      focused: focused === focusableElements[i],
      hasVisibleFocus: window.getComputedStyle(focused).outline !== 'none'
    });
  }
  
  return results;
};

export const checkAriaLabels = (container) => {
  const elementsNeedingLabels = container.querySelectorAll(
    'button, input, select, textarea, [role="button"], [role="textbox"]'
  );
  
  const results = [];
  
  elementsNeedingLabels.forEach(element => {
    const hasAriaLabel = element.hasAttribute('aria-label');
    const hasAriaLabelledBy = element.hasAttribute('aria-labelledby');
    const hasLabel = element.labels && element.labels.length > 0;
    const hasTitle = element.hasAttribute('title');
    
    results.push({
      element,
      hasAccessibleName: hasAriaLabel || hasAriaLabelledBy || hasLabel || hasTitle,
      ariaLabel: element.getAttribute('aria-label'),
      ariaLabelledBy: element.getAttribute('aria-labelledby')
    });
  });
  
  return results;
};

// Security testing helpers
export const testXSSVulnerability = (component, inputProps) => {
  const xssPayloads = [
    '<script>alert("xss")</script>',
    'javascript:alert("xss")',
    '<img src="x" onerror="alert(1)">',
    '"><script>alert("xss")</script>',
    'data:text/html,<script>alert("xss")</script>'
  ];
  
  const results = [];
  
  xssPayloads.forEach(payload => {
    const testProps = { ...inputProps };
    Object.keys(testProps).forEach(key => {
      if (typeof testProps[key] === 'string') {
        testProps[key] = payload;
      }
    });
    
    try {
      const { container } = render(component(testProps));
      const hasScript = container.innerHTML.includes('<script>');
      const hasJavascript = container.innerHTML.includes('javascript:');
      
      results.push({
        payload,
        vulnerable: hasScript || hasJavascript,
        rendered: container.innerHTML
      });
    } catch (error) {
      results.push({
        payload,
        vulnerable: false,
        error: error.message
      });
    }
  });
  
  return results;
};

// Integration testing helpers
export const waitForAsyncOperation = (condition, timeout = 5000) => {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    
    const check = () => {
      if (condition()) {
        resolve();
      } else if (Date.now() - startTime > timeout) {
        reject(new Error('Timeout waiting for async operation'));
      } else {
        setTimeout(check, 100);
      }
    };
    
    check();
  });
};

export const mockApiResponse = (url, response, delay = 0) => {
  const originalFetch = global.fetch;
  
  global.fetch = jest.fn().mockImplementation((requestUrl) => {
    if (requestUrl.includes(url)) {
      return new Promise(resolve => {
        setTimeout(() => {
          resolve({
            ok: true,
            json: () => Promise.resolve(response),
            text: () => Promise.resolve(JSON.stringify(response))
          });
        }, delay);
      });
    }
    return originalFetch(requestUrl);
  });
  
  return () => {
    global.fetch = originalFetch;
  };
};

// Custom render function with providers
export const renderWithProviders = (ui, options = {}) => {
  const {
    initialState = {},
    ...renderOptions
  } = options;
  
  // Add any context providers here
  const Wrapper = ({ children }) => {
    return children; // Add providers as needed
  };
  
  return render(ui, { wrapper: Wrapper, ...renderOptions });
};

// Test data cleanup
export const cleanupTestData = () => {
  if (typeof window !== 'undefined') {
    localStorage.clear();
    sessionStorage.clear();
  }
  
  // Clear any global mocks
  jest.clearAllMocks();
};

export default {
  generateMockTranscript,
  generateMockAudioBuffer,
  generateMockMeetingContext,
  generateMockSummary,
  setupTestEnvironment,
  measurePerformance,
  createMemorySnapshot,
  checkKeyboardNavigation,
  checkAriaLabels,
  testXSSVulnerability,
  waitForAsyncOperation,
  mockApiResponse,
  renderWithProviders,
  cleanupTestData
};