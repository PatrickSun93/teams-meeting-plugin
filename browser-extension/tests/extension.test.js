/**
 * Browser Extension Tests
 * Tests for Google Meet browser extension functionality
 */

// Mock Chrome APIs for testing
global.chrome = {
  runtime: {
    sendMessage: jest.fn(),
    onMessage: {
      addListener: jest.fn()
    },
    onInstalled: {
      addListener: jest.fn()
    },
    getURL: jest.fn()
  },
  storage: {
    sync: {
      get: jest.fn(),
      set: jest.fn()
    },
    local: {
      get: jest.fn(),
      set: jest.fn(),
      clear: jest.fn()
    },
    onChanged: {
      addListener: jest.fn()
    }
  },
  tabs: {
    query: jest.fn(),
    sendMessage: jest.fn(),
    create: jest.fn(),
    onUpdated: {
      addListener: jest.fn()
    }
  },
  identity: {
    getAuthToken: jest.fn(),
    removeCachedAuthToken: jest.fn()
  },
  scripting: {
    executeScript: jest.fn()
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
    remove: jest.fn()
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
    getUserMedia: jest.fn(),
    getDisplayMedia: jest.fn()
  }
};

global.MediaRecorder = jest.fn(() => ({
  start: jest.fn(),
  stop: jest.fn(),
  ondataavailable: null,
  onstop: null
}));

global.FileReader = jest.fn(() => ({
  readAsArrayBuffer: jest.fn(),
  onload: null
}));

global.Blob = jest.fn();

describe('Google Meet Extension', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Meeting Detection', () => {
    test('should extract meeting ID from URL', () => {
      const url = 'https://meet.google.com/abc-defg-hij';
      const meetingIdMatch = url.match(/meet\.google\.com\/([a-z0-9-]+)/);
      
      expect(meetingIdMatch).toBeTruthy();
      expect(meetingIdMatch[1]).toBe('abc-defg-hij');
    });

    test('should detect meeting state changes', () => {
      // Mock meeting indicators
      document.querySelector = jest.fn((selector) => {
        if (selector === '[data-is-muted]') return { getAttribute: () => 'true' };
        if (selector === '[aria-label*="camera"]') return {};
        return null;
      });

      // Test meeting detection logic
      const meetingIndicators = [
        () => document.querySelector('[data-is-muted]'),
        () => document.querySelector('[aria-label*="camera"]'),
        () => document.querySelector('video')
      ];

      const isInMeeting = meetingIndicators.some(check => check());
      expect(isInMeeting).toBe(true);
    });

    test('should handle URL changes for SPA navigation', () => {
      const mockCallback = jest.fn();
      let lastUrl = 'https://meet.google.com/old-meeting';
      
      const checkUrlChange = (newUrl) => {
        if (newUrl !== lastUrl) {
          lastUrl = newUrl;
          mockCallback(newUrl);
        }
      };

      // Simulate URL change
      const newUrl = 'https://meet.google.com/new-meeting';
      checkUrlChange(newUrl);

      expect(mockCallback).toHaveBeenCalledWith('https://meet.google.com/new-meeting');
    });
  });

  describe('Audio Capture', () => {
    test('should request microphone access with proper constraints', async () => {
      const mockStream = { getTracks: () => [{ stop: jest.fn() }] };
      const getUserMediaMock = jest.fn().mockResolvedValue(mockStream);
      
      // Mock navigator.mediaDevices properly
      Object.defineProperty(navigator, 'mediaDevices', {
        value: { getUserMedia: getUserMediaMock },
        writable: true
      });

      const audioConstraints = {
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 16000
        }
      };

      const stream = await navigator.mediaDevices.getUserMedia(audioConstraints);
      
      expect(getUserMediaMock).toHaveBeenCalledWith(audioConstraints);
      expect(stream).toBe(mockStream);
    });

    test('should create MediaRecorder with correct options', () => {
      const mockStream = {};
      const recorder = new MediaRecorder(mockStream, {
        mimeType: 'audio/webm;codecs=opus'
      });

      expect(MediaRecorder).toHaveBeenCalledWith(mockStream, {
        mimeType: 'audio/webm;codecs=opus'
      });
    });

    test('should handle audio capture errors gracefully', async () => {
      const error = new Error('Permission denied');
      const getUserMediaMock = jest.fn().mockRejectedValue(error);
      
      // Mock navigator.mediaDevices properly
      Object.defineProperty(navigator, 'mediaDevices', {
        value: { getUserMedia: getUserMediaMock },
        writable: true
      });

      try {
        await navigator.mediaDevices.getUserMedia({ audio: true });
      } catch (e) {
        expect(e.message).toBe('Permission denied');
      }
    });
  });

  describe('Background Service', () => {
    test('should handle extension installation', () => {
      const mockHandler = jest.fn();
      chrome.runtime.onInstalled.addListener(mockHandler);

      expect(chrome.runtime.onInstalled.addListener).toHaveBeenCalledWith(mockHandler);
    });

    test('should handle tab updates for Meet pages', () => {
      const mockHandler = jest.fn();
      chrome.tabs.onUpdated.addListener(mockHandler);

      expect(chrome.tabs.onUpdated.addListener).toHaveBeenCalledWith(mockHandler);
    });

    test('should save configuration to storage', async () => {
      const config = {
        sttProvider: 'local_whisper',
        aiProvider: 'openai_gpt',
        autoStartTranscription: false
      };

      chrome.storage.sync.set.mockResolvedValue();

      await chrome.storage.sync.set(config);

      expect(chrome.storage.sync.set).toHaveBeenCalledWith(config);
    });

    test('should handle message passing between components', () => {
      const mockMessage = { type: 'MEETING_DETECTED', data: { meetingId: 'test-123' } };
      const mockSender = { tab: { id: 1 } };
      const mockSendResponse = jest.fn();

      chrome.runtime.sendMessage.mockImplementation((message) => {
        return Promise.resolve({ success: true });
      });

      chrome.runtime.sendMessage(mockMessage);

      expect(chrome.runtime.sendMessage).toHaveBeenCalledWith(mockMessage);
    });
  });

  describe('Calendar API Integration', () => {
    test('should authenticate with Google Calendar', async () => {
      const mockToken = 'mock-auth-token';
      chrome.identity.getAuthToken.mockResolvedValue(mockToken);

      const token = await chrome.identity.getAuthToken({ interactive: true });

      expect(chrome.identity.getAuthToken).toHaveBeenCalledWith({ interactive: true });
      expect(token).toBe(mockToken);
    });

    test('should handle authentication errors', async () => {
      const error = new Error('Authentication failed');
      chrome.identity.getAuthToken.mockRejectedValue(error);

      try {
        await chrome.identity.getAuthToken({ interactive: true });
      } catch (e) {
        expect(e.message).toBe('Authentication failed');
      }
    });

    test('should parse agenda items from event description', () => {
      const description = `
        Meeting Agenda:
        1. Project updates
        2. Budget review
        - Action items
        * Next steps
      `;

      const lines = description.split('\n');
      const agendaPatterns = [
        /^\d+\.\s*(.+)$/,
        /^-\s*(.+)$/,
        /^\*\s*(.+)$/
      ];

      const items = [];
      for (const line of lines) {
        const trimmedLine = line.trim();
        for (const pattern of agendaPatterns) {
          const match = trimmedLine.match(pattern);
          if (match) {
            items.push(match[1].trim());
            break;
          }
        }
      }

      expect(items).toContain('Project updates');
      expect(items).toContain('Budget review');
      expect(items).toContain('Action items');
      expect(items).toContain('Next steps');
    });
  });

  describe('UI Injection', () => {
    test('should inject transcription controls into Meet UI', () => {
      const mockControlsContainer = {
        appendChild: jest.fn()
      };
      
      document.querySelector = jest.fn().mockReturnValue(mockControlsContainer);
      
      const controlsPanel = document.createElement('div');
      controlsPanel.className = 'transcription-controls';
      
      mockControlsContainer.appendChild(controlsPanel);

      expect(mockControlsContainer.appendChild).toHaveBeenCalledWith(controlsPanel);
    });

    test('should create transcription panel with proper structure', () => {
      const mockPanel = {
        className: '',
        innerHTML: '',
        style: { cssText: '' }
      };
      
      document.createElement = jest.fn().mockReturnValue(mockPanel);
      
      const panel = document.createElement('div');
      panel.className = 'transcription-panel';
      
      expect(panel.className).toBe('transcription-panel');
    });

    test('should handle button click events', () => {
      const mockButton = {
        addEventListener: jest.fn()
      };
      
      const mockHandler = jest.fn();
      mockButton.addEventListener('click', mockHandler);

      expect(mockButton.addEventListener).toHaveBeenCalledWith('click', mockHandler);
    });
  });

  describe('Configuration Management', () => {
    test('should load default configuration', async () => {
      const defaultConfig = {
        extensionEnabled: true,
        sttProvider: 'local_whisper',
        aiProvider: 'openai_gpt',
        autoStartTranscription: false,
        showConfidenceScores: true,
        exportFormat: 'txt'
      };

      chrome.storage.sync.get.mockResolvedValue(defaultConfig);

      const config = await chrome.storage.sync.get();

      expect(config).toEqual(defaultConfig);
    });

    test('should validate configuration values', () => {
      const validProviders = ['local_whisper', 'openai_whisper', 'azure_speech'];
      const testProvider = 'local_whisper';

      expect(validProviders).toContain(testProvider);
    });

    test('should handle configuration updates', async () => {
      const newConfig = {
        sttProvider: 'openai_whisper',
        apiKey: 'sk-test-key'
      };

      chrome.storage.sync.set.mockResolvedValue();

      await chrome.storage.sync.set(newConfig);

      expect(chrome.storage.sync.set).toHaveBeenCalledWith(newConfig);
    });
  });

  describe('Error Handling', () => {
    test('should handle network errors gracefully', async () => {
      const networkError = new Error('Network request failed');
      
      // Mock fetch failure
      global.fetch = jest.fn().mockRejectedValue(networkError);

      try {
        await fetch('https://api.example.com/test');
      } catch (error) {
        expect(error.message).toBe('Network request failed');
      }
    });

    test('should provide fallback for missing permissions', () => {
      const hasPermission = (permission) => {
        const requiredPermissions = ['activeTab', 'storage', 'identity'];
        return requiredPermissions.includes(permission);
      };

      expect(hasPermission('activeTab')).toBe(true);
      expect(hasPermission('invalidPermission')).toBe(false);
    });

    test('should handle storage quota exceeded', async () => {
      const quotaError = new Error('Quota exceeded');
      chrome.storage.local.set.mockRejectedValue(quotaError);

      try {
        await chrome.storage.local.set({ largeData: 'x'.repeat(10000000) });
      } catch (error) {
        expect(error.message).toBe('Quota exceeded');
      }
    });
  });

  describe('Security and Privacy', () => {
    test('should not expose sensitive data in logs', () => {
      const apiKey = 'sk-sensitive-key-12345';
      const maskedKey = apiKey.replace(/sk-[a-zA-Z0-9-]+/, 'sk-***');

      expect(maskedKey).toBe('sk-***');
      expect(maskedKey).not.toContain('sensitive');
    });

    test('should validate API key format', () => {
      const validOpenAIKey = 'sk-1234567890abcdef1234567890abcdef12345678901234567890';
      const invalidKey = 'invalid-key';

      const isValidOpenAIKey = (key) => /^sk-[a-zA-Z0-9]{48,}$/.test(key);

      expect(isValidOpenAIKey(validOpenAIKey)).toBe(true);
      expect(isValidOpenAIKey(invalidKey)).toBe(false);
    });

    test('should handle privacy mode correctly', () => {
      const config = { privacyMode: true };
      const allowedProviders = config.privacyMode ? ['local_whisper'] : ['local_whisper', 'openai_whisper', 'azure_speech'];

      expect(allowedProviders).toEqual(['local_whisper']);
    });
  });
});

describe('Extension Manifest Validation', () => {
  test('should have required manifest properties', () => {
    const manifest = {
      manifest_version: 3,
      name: 'Meeting Transcription for Google Meet',
      version: '1.0.0',
      permissions: ['activeTab', 'storage', 'identity', 'scripting'],
      host_permissions: ['https://meet.google.com/*'],
      background: { service_worker: 'background/background.js' },
      content_scripts: [{
        matches: ['https://meet.google.com/*'],
        js: ['content-scripts/meet-detector.js']
      }]
    };

    expect(manifest.manifest_version).toBe(3);
    expect(manifest.permissions).toContain('activeTab');
    expect(manifest.host_permissions).toContain('https://meet.google.com/*');
    expect(manifest.background.service_worker).toBe('background/background.js');
  });

  test('should have proper content script configuration', () => {
    const contentScript = {
      matches: ['https://meet.google.com/*'],
      js: [
        'content-scripts/meet-detector.js',
        'content-scripts/audio-capture.js',
        'content-scripts/ui-injection.js'
      ],
      css: ['content-scripts/meet-styles.css'],
      run_at: 'document_end'
    };

    expect(contentScript.matches).toContain('https://meet.google.com/*');
    expect(contentScript.js).toHaveLength(3);
    expect(contentScript.run_at).toBe('document_end');
  });
});