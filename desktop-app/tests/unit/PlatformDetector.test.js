const PlatformDetector = require('../../src/services/PlatformDetector');

describe('PlatformDetector', () => {
  let detector;

  beforeEach(() => {
    detector = new PlatformDetector();
  });

  describe('initialization', () => {
    test('should initialize with default settings', () => {
      expect(detector.currentPlatform).toBeNull();
      expect(detector.manualPlatform).toBeNull();
      expect(detector.confidenceThreshold).toBe(0.6);
      expect(detector.supportedPlatforms).toHaveLength(6); // teams, zoom, meet, webex, skype, generic
    });

    test('should have correct supported platforms', () => {
      const platformIds = detector.supportedPlatforms.map(p => p.id);
      expect(platformIds).toContain('teams');
      expect(platformIds).toContain('zoom');
      expect(platformIds).toContain('meet');
      expect(platformIds).toContain('webex');
      expect(platformIds).toContain('skype');
      expect(platformIds).toContain('generic');
    });
  });

  describe('platform information', () => {
    test('should get platform info by ID', () => {
      const teamsInfo = detector.getPlatformInfo('teams');
      
      expect(teamsInfo).toHaveProperty('id', 'teams');
      expect(teamsInfo).toHaveProperty('name', 'Microsoft Teams');
      expect(teamsInfo).toHaveProperty('features');
      expect(teamsInfo.features.chatIntegration).toBe(true);
      expect(teamsInfo.features.agendaAccess).toBe(true);
    });

    test('should return generic platform for invalid ID', () => {
      const invalidInfo = detector.getPlatformInfo('invalid');
      
      expect(invalidInfo.id).toBe('generic');
      expect(invalidInfo.name).toBe('Generic/Unknown Platform');
    });

    test('should get available platforms', () => {
      const platforms = detector.getAvailablePlatforms();
      
      expect(platforms).toBeInstanceOf(Array);
      expect(platforms.length).toBe(6);
      expect(platforms[0]).toHaveProperty('id');
      expect(platforms[0]).toHaveProperty('name');
      expect(platforms[0]).toHaveProperty('features');
    });
  });

  describe('manual platform selection', () => {
    test('should set manual platform', () => {
      const platformInfo = detector.setManualPlatform('teams');
      
      expect(detector.manualPlatform).toBe('teams');
      expect(detector.currentPlatform).toBe('teams');
      expect(platformInfo.id).toBe('teams');
      expect(platformInfo.isManual).toBe(true);
    });

    test('should throw error for invalid platform', () => {
      expect(() => detector.setManualPlatform('invalid'))
        .toThrow('Unsupported platform: invalid');
    });

    test('should clear manual platform', () => {
      detector.setManualPlatform('teams');
      detector.clearManualPlatform();
      
      expect(detector.manualPlatform).toBeNull();
    });

    test('should check if in manual mode', () => {
      expect(detector.isManualMode()).toBe(false);
      
      detector.setManualPlatform('zoom');
      expect(detector.isManualMode()).toBe(true);
      
      detector.clearManualPlatform();
      expect(detector.isManualMode()).toBe(false);
    });
  });

  describe('platform detection', () => {
    test('should return manual platform when set', async () => {
      detector.setManualPlatform('teams');
      
      const detected = await detector.detectCurrentPlatform();
      
      expect(detected.id).toBe('teams');
      expect(detected.isManual).toBe(true);
    });

    test('should detect platform automatically', async () => {
      const detected = await detector.detectCurrentPlatform();
      
      expect(detected).toHaveProperty('id');
      expect(detected).toHaveProperty('name');
      expect(detected).toHaveProperty('confidence');
      expect(detected.confidence).toBeGreaterThanOrEqual(0);
      expect(detected.confidence).toBeLessThanOrEqual(1);
    });

    test('should return generic platform when no detection', async () => {
      // Mock all detection methods to return null
      detector.detectByProcess = jest.fn().mockResolvedValue(null);
      detector.detectByWindow = jest.fn().mockResolvedValue(null);
      detector.detectByScreen = jest.fn().mockResolvedValue(null);
      
      const detected = await detector.detectCurrentPlatform();
      
      expect(detected.id).toBe('generic');
    });
  });

  describe('detection methods', () => {
    test('should detect by process', async () => {
      const result = await detector.detectByProcess();
      
      // Result can be null if no matching processes are found
      if (result) {
        expect(result).toHaveProperty('platform');
        expect(result).toHaveProperty('confidence');
        expect(result).toHaveProperty('method', 'process');
        expect(result).toHaveProperty('details');
      }
    });

    test('should detect by window', async () => {
      const result = await detector.detectByWindow();
      
      // Result can be null if no matching windows are found
      if (result) {
        expect(result).toHaveProperty('platform');
        expect(result).toHaveProperty('confidence');
        expect(result).toHaveProperty('method', 'window');
        expect(result).toHaveProperty('details');
      }
    });

    test('should detect by screen', async () => {
      const result = await detector.detectByScreen();
      
      // This method is not fully implemented, so it should return null
      expect(result).toBeNull();
    });
  });

  describe('detection analysis', () => {
    test('should analyze detection results', () => {
      const results = [
        { platform: 'teams', confidence: 0.8, method: 'process' },
        { platform: 'teams', confidence: 0.9, method: 'window' },
        { platform: 'zoom', confidence: 0.5, method: 'process' }
      ];
      
      const analyzed = detector.analyzeDetectionResults(results);
      
      expect(analyzed.id).toBe('teams'); // Should pick teams due to higher combined confidence
      expect(analyzed.confidence).toBeGreaterThan(0.8);
      expect(analyzed.detectionMethods).toContain('process');
      expect(analyzed.detectionMethods).toContain('window');
    });

    test('should return generic for low confidence results', () => {
      const results = [
        { platform: 'teams', confidence: 0.3, method: 'process' },
        { platform: 'zoom', confidence: 0.2, method: 'window' }
      ];
      
      const analyzed = detector.analyzeDetectionResults(results);
      
      expect(analyzed.id).toBe('generic');
    });

    test('should handle empty results', () => {
      const analyzed = detector.analyzeDetectionResults([]);
      
      expect(analyzed.id).toBe('generic');
    });
  });

  describe('detection history', () => {
    test('should add to detection history', () => {
      const detectionResult = {
        id: 'teams',
        confidence: 0.8,
        detectionMethods: ['process', 'window']
      };
      
      detector.addToHistory(detectionResult);
      
      const history = detector.getDetectionHistory();
      expect(history).toHaveLength(1);
      expect(history[0]).toHaveProperty('platform', 'teams');
      expect(history[0]).toHaveProperty('confidence', 0.8);
      expect(history[0]).toHaveProperty('timestamp');
    });

    test('should limit history size', () => {
      // Add more than 50 entries
      for (let i = 0; i < 55; i++) {
        detector.addToHistory({
          id: 'teams',
          confidence: 0.8,
          detectionMethods: ['process']
        });
      }
      
      const history = detector.getDetectionHistory();
      expect(history).toHaveLength(50);
    });
  });

  describe('configuration', () => {
    test('should set confidence threshold', () => {
      detector.setConfidenceThreshold(0.8);
      expect(detector.confidenceThreshold).toBe(0.8);
    });

    test('should validate confidence threshold', () => {
      expect(() => detector.setConfidenceThreshold(-0.1))
        .toThrow('Confidence threshold must be between 0 and 1');
      
      expect(() => detector.setConfidenceThreshold(1.1))
        .toThrow('Confidence threshold must be between 0 and 1');
    });

    test('should get current platform', () => {
      expect(detector.getCurrentPlatform()).toBeNull();
      
      detector.setManualPlatform('teams');
      const current = detector.getCurrentPlatform();
      expect(current.id).toBe('teams');
    });
  });

  describe('testing functionality', () => {
    test('should test detection capabilities', async () => {
      const testResults = await detector.testDetection();
      
      expect(testResults).toHaveProperty('processDetection');
      expect(testResults).toHaveProperty('windowDetection');
      expect(testResults).toHaveProperty('screenDetection');
      expect(testResults).toHaveProperty('overallSuccess');
      expect(testResults).toHaveProperty('detectedPlatforms');
      expect(testResults).toHaveProperty('errors');
      
      expect(testResults.detectedPlatforms).toBeInstanceOf(Array);
      expect(testResults.errors).toBeInstanceOf(Array);
    }, 10000);
  });

  describe('event handling', () => {
    test('should emit platform detected event', (done) => {
      detector.on('platformDetected', (platformInfo) => {
        expect(platformInfo).toHaveProperty('id');
        expect(platformInfo).toHaveProperty('name');
        done();
      });
      
      // Trigger detection
      detector.detectCurrentPlatform();
    });

    test('should emit platform changed event', (done) => {
      detector.on('platformChanged', (platformInfo) => {
        expect(platformInfo.id).toBe('zoom');
        expect(platformInfo.isManual).toBe(true);
        done();
      });
      
      detector.setManualPlatform('zoom');
    });

    test('should emit manual platform cleared event', (done) => {
      detector.on('manualPlatformCleared', () => {
        done();
      });
      
      detector.setManualPlatform('teams');
      detector.clearManualPlatform();
    });
  });
});