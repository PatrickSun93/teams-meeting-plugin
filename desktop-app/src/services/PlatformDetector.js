const { EventEmitter } = require('events');
const screenshot = require('screenshot-desktop');

class PlatformDetector extends EventEmitter {
  constructor() {
    super();
    this.currentPlatform = null;
    this.manualPlatform = null;
    this.detectionHistory = [];
    this.confidenceThreshold = 0.6;
    this.supportedPlatforms = [
      {
        id: 'teams',
        name: 'Microsoft Teams',
        processNames: ['Teams.exe', 'Microsoft Teams'],
        urlPatterns: ['teams.microsoft.com', 'teams.live.com'],
        windowTitles: ['Microsoft Teams', 'Teams'],
        features: {
          chatIntegration: true,
          agendaAccess: true,
          participantInfo: true,
          hostDetection: true,
          audioQuality: 'high'
        }
      },
      {
        id: 'zoom',
        name: 'Zoom',
        processNames: ['Zoom.exe', 'zoom', 'ZoomOpener'],
        urlPatterns: ['zoom.us', 'zoom.com'],
        windowTitles: ['Zoom Meeting', 'Zoom', 'Zoom Webinar'],
        features: {
          chatIntegration: true,
          agendaAccess: false,
          participantInfo: true,
          hostDetection: true,
          audioQuality: 'high'
        }
      },
      {
        id: 'meet',
        name: 'Google Meet',
        processNames: ['chrome.exe', 'firefox.exe', 'safari'],
        urlPatterns: ['meet.google.com'],
        windowTitles: ['Meet - ', 'Google Meet'],
        features: {
          chatIntegration: false,
          agendaAccess: true,
          participantInfo: false,
          hostDetection: false,
          audioQuality: 'medium'
        }
      },
      {
        id: 'webex',
        name: 'Cisco Webex',
        processNames: ['CiscoCollabHost.exe', 'webex', 'Webex'],
        urlPatterns: ['webex.com'],
        windowTitles: ['Webex Meeting', 'Cisco Webex Meetings'],
        features: {
          chatIntegration: true,
          agendaAccess: false,
          participantInfo: true,
          hostDetection: true,
          audioQuality: 'high'
        }
      },
      {
        id: 'skype',
        name: 'Skype',
        processNames: ['Skype.exe', 'skype'],
        urlPatterns: ['web.skype.com'],
        windowTitles: ['Skype'],
        features: {
          chatIntegration: true,
          agendaAccess: false,
          participantInfo: true,
          hostDetection: false,
          audioQuality: 'medium'
        }
      },
      {
        id: 'generic',
        name: 'Generic/Unknown Platform',
        processNames: [],
        urlPatterns: [],
        windowTitles: [],
        features: {
          chatIntegration: false,
          agendaAccess: false,
          participantInfo: false,
          hostDetection: false,
          audioQuality: 'medium'
        }
      }
    ];
  }

  async detectCurrentPlatform() {
    try {
      // If manual platform is set, use it
      if (this.manualPlatform) {
        return this.getPlatformInfo(this.manualPlatform);
      }

      const detectionMethods = [
        this.detectByProcess.bind(this),
        this.detectByWindow.bind(this),
        this.detectByScreen.bind(this)
      ];

      const results = [];

      // Run all detection methods
      for (const method of detectionMethods) {
        try {
          const result = await method();
          if (result) {
            results.push(result);
          }
        } catch (error) {
          console.warn('Detection method failed:', error.message);
        }
      }

      // Analyze results and determine best match
      const detectedPlatform = this.analyzeDetectionResults(results);
      
      if (detectedPlatform) {
        this.currentPlatform = detectedPlatform.id;
        this.addToHistory(detectedPlatform);
        this.emit('platformDetected', detectedPlatform);
      }

      return detectedPlatform;
      
    } catch (error) {
      console.error('Platform detection failed:', error);
      return this.getPlatformInfo('generic');
    }
  }

  async detectByProcess() {
    // This is a simplified implementation
    // In a real application, you would use native modules to detect running processes
    try {
      const { exec } = require('child_process');
      const util = require('util');
      const execAsync = util.promisify(exec);

      let command;
      if (process.platform === 'win32') {
        command = 'tasklist /fo csv';
      } else if (process.platform === 'darwin') {
        command = 'ps aux';
      } else {
        command = 'ps aux';
      }

      const { stdout } = await execAsync(command);
      const processes = stdout.toLowerCase();

      for (const platform of this.supportedPlatforms) {
        for (const processName of platform.processNames) {
          if (processes.includes(processName.toLowerCase())) {
            return {
              platform: platform.id,
              confidence: 0.8,
              method: 'process',
              details: { processName }
            };
          }
        }
      }

      return null;
    } catch (error) {
      console.warn('Process detection failed:', error.message);
      return null;
    }
  }

  async detectByWindow() {
    // This is a simplified implementation
    // In a real application, you would use native modules to get window titles
    try {
      const { exec } = require('child_process');
      const util = require('util');
      const execAsync = util.promisify(exec);

      let command;
      if (process.platform === 'win32') {
        command = 'powershell "Get-Process | Where-Object {$_.MainWindowTitle -ne \'\'} | Select-Object MainWindowTitle"';
      } else if (process.platform === 'darwin') {
        command = 'osascript -e \'tell application "System Events" to get name of (processes where background only is false)\'';
      } else {
        command = 'wmctrl -l';
      }

      const { stdout } = await execAsync(command);
      const windows = stdout.toLowerCase();

      for (const platform of this.supportedPlatforms) {
        for (const windowTitle of platform.windowTitles) {
          if (windows.includes(windowTitle.toLowerCase())) {
            return {
              platform: platform.id,
              confidence: 0.9,
              method: 'window',
              details: { windowTitle }
            };
          }
        }
      }

      return null;
    } catch (error) {
      console.warn('Window detection failed:', error.message);
      return null;
    }
  }

  async detectByScreen() {
    try {
      // Take a screenshot and analyze it for platform-specific UI elements
      const screenshotBuffer = await screenshot({ format: 'png' });
      
      // This is a simplified implementation
      // In a real application, you would use image recognition or OCR
      // to identify platform-specific UI elements
      
      // For now, we'll return null and rely on other detection methods
      return null;
    } catch (error) {
      console.warn('Screen detection failed:', error.message);
      return null;
    }
  }

  analyzeDetectionResults(results) {
    if (results.length === 0) {
      return this.getPlatformInfo('generic');
    }

    // Group results by platform
    const platformScores = {};
    
    for (const result of results) {
      if (!platformScores[result.platform]) {
        platformScores[result.platform] = {
          totalConfidence: 0,
          count: 0,
          methods: []
        };
      }
      
      platformScores[result.platform].totalConfidence += result.confidence;
      platformScores[result.platform].count++;
      platformScores[result.platform].methods.push(result.method);
    }

    // Calculate average confidence for each platform
    let bestPlatform = null;
    let bestScore = 0;

    for (const [platformId, score] of Object.entries(platformScores)) {
      const avgConfidence = score.totalConfidence / score.count;
      const methodBonus = score.count > 1 ? 0.1 : 0; // Bonus for multiple detection methods
      const finalScore = avgConfidence + methodBonus;

      if (finalScore > bestScore && finalScore >= this.confidenceThreshold) {
        bestPlatform = platformId;
        bestScore = finalScore;
      }
    }

    if (bestPlatform) {
      const platformInfo = this.getPlatformInfo(bestPlatform);
      platformInfo.confidence = bestScore;
      platformInfo.detectionMethods = platformScores[bestPlatform].methods;
      return platformInfo;
    }

    return this.getPlatformInfo('generic');
  }

  getPlatformInfo(platformId) {
    const platform = this.supportedPlatforms.find(p => p.id === platformId);
    if (!platform) {
      return this.supportedPlatforms.find(p => p.id === 'generic');
    }
    
    return {
      id: platform.id,
      name: platform.name,
      features: { ...platform.features },
      confidence: 1.0
    };
  }

  getAvailablePlatforms() {
    return this.supportedPlatforms.map(platform => ({
      id: platform.id,
      name: platform.name,
      features: platform.features
    }));
  }

  setManualPlatform(platformId) {
    const platform = this.supportedPlatforms.find(p => p.id === platformId);
    if (!platform) {
      throw new Error(`Unsupported platform: ${platformId}`);
    }

    this.manualPlatform = platformId;
    this.currentPlatform = platformId;
    
    const platformInfo = this.getPlatformInfo(platformId);
    platformInfo.isManual = true;
    
    this.emit('platformChanged', platformInfo);
    return platformInfo;
  }

  clearManualPlatform() {
    this.manualPlatform = null;
    this.emit('manualPlatformCleared');
  }

  addToHistory(detectionResult) {
    this.detectionHistory.push({
      timestamp: new Date(),
      platform: detectionResult.id,
      confidence: detectionResult.confidence,
      methods: detectionResult.detectionMethods || []
    });

    // Keep only last 50 detections
    if (this.detectionHistory.length > 50) {
      this.detectionHistory = this.detectionHistory.slice(-50);
    }
  }

  getDetectionHistory() {
    return [...this.detectionHistory];
  }

  getCurrentPlatform() {
    return this.currentPlatform ? this.getPlatformInfo(this.currentPlatform) : null;
  }

  isManualMode() {
    return !!this.manualPlatform;
  }

  setConfidenceThreshold(threshold) {
    if (threshold < 0 || threshold > 1) {
      throw new Error('Confidence threshold must be between 0 and 1');
    }
    this.confidenceThreshold = threshold;
  }

  // Test platform detection capabilities
  async testDetection() {
    const testResults = {
      processDetection: false,
      windowDetection: false,
      screenDetection: false,
      overallSuccess: false,
      detectedPlatforms: [],
      errors: []
    };

    try {
      // Test process detection
      try {
        const processResult = await this.detectByProcess();
        testResults.processDetection = !!processResult;
        if (processResult) {
          testResults.detectedPlatforms.push(processResult);
        }
      } catch (error) {
        testResults.errors.push(`Process detection: ${error.message}`);
      }

      // Test window detection
      try {
        const windowResult = await this.detectByWindow();
        testResults.windowDetection = !!windowResult;
        if (windowResult) {
          testResults.detectedPlatforms.push(windowResult);
        }
      } catch (error) {
        testResults.errors.push(`Window detection: ${error.message}`);
      }

      // Test screen detection
      try {
        const screenResult = await this.detectByScreen();
        testResults.screenDetection = !!screenResult;
        if (screenResult) {
          testResults.detectedPlatforms.push(screenResult);
        }
      } catch (error) {
        testResults.errors.push(`Screen detection: ${error.message}`);
      }

      testResults.overallSuccess = testResults.detectedPlatforms.length > 0;
      
    } catch (error) {
      testResults.errors.push(`Overall test: ${error.message}`);
    }

    return testResults;
  }
}

module.exports = PlatformDetector;