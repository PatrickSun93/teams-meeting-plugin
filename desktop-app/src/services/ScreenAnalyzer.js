const screenshot = require('screenshot-desktop');
const Jimp = require('jimp');
const Tesseract = require('tesseract.js');
const { EventEmitter } = require('events');

class ScreenAnalyzer extends EventEmitter {
  constructor() {
    super();
    this.isAnalyzing = false;
    this.analysisInterval = null;
    this.intervalMs = 5000; // Analyze every 5 seconds
    this.tesseractWorker = null;
    this.lastScreenshot = null;
    this.meetingPatterns = {
      teams: [
        /Microsoft Teams/i,
        /Leave meeting/i,
        /Turn camera on/i,
        /Mute microphone/i,
        /Share content/i
      ],
      zoom: [
        /Zoom Meeting/i,
        /Leave Meeting/i,
        /Start Video/i,
        /Mute\/Unmute/i,
        /Share Screen/i,
        /Participants/i
      ],
      meet: [
        /Google Meet/i,
        /Leave call/i,
        /Turn camera on/i,
        /Mute microphone/i,
        /Present now/i,
        /People/i
      ],
      webex: [
        /Webex/i,
        /Leave meeting/i,
        /Start video/i,
        /Mute\/Unmute/i,
        /Share content/i
      ]
    };
  }

  async initialize() {
    try {
      // Initialize Tesseract worker for OCR
      this.tesseractWorker = await Tesseract.createWorker();
      await this.tesseractWorker.loadLanguage('eng');
      await this.tesseractWorker.initialize('eng');
      
      console.log('ScreenAnalyzer initialized');
    } catch (error) {
      console.error('Failed to initialize ScreenAnalyzer:', error);
      throw error;
    }
  }

  async startAnalysis() {
    if (this.isAnalyzing) {
      throw new Error('Screen analysis already in progress');
    }

    try {
      this.isAnalyzing = true;
      
      // Perform initial analysis
      await this.analyzeScreen();
      
      // Set up periodic analysis
      this.analysisInterval = setInterval(async () => {
        try {
          await this.analyzeScreen();
        } catch (error) {
          console.error('Screen analysis error:', error);
          this.emit('analysisError', error);
        }
      }, this.intervalMs);

      console.log('Screen analysis started');
      this.emit('analysisStarted');
      
    } catch (error) {
      this.isAnalyzing = false;
      console.error('Failed to start screen analysis:', error);
      throw error;
    }
  }

  async stopAnalysis() {
    if (!this.isAnalyzing) {
      return;
    }

    try {
      this.isAnalyzing = false;
      
      if (this.analysisInterval) {
        clearInterval(this.analysisInterval);
        this.analysisInterval = null;
      }

      console.log('Screen analysis stopped');
      this.emit('analysisStopped');
      
    } catch (error) {
      console.error('Failed to stop screen analysis:', error);
      throw error;
    }
  }

  async analyzeScreen() {
    try {
      // Take screenshot
      const screenshotBuffer = await screenshot({ format: 'png' });
      
      // Process image with Jimp for better OCR results
      const image = await Jimp.read(screenshotBuffer);
      
      // Enhance image for better text recognition
      image.contrast(0.3).brightness(0.1);
      
      // Convert back to buffer
      const processedBuffer = await image.getBufferAsync(Jimp.MIME_PNG);
      
      // Perform OCR
      const { data: { text } } = await this.tesseractWorker.recognize(processedBuffer);
      
      // Analyze text for meeting platform indicators
      const detectedPlatform = this.detectMeetingPlatform(text);
      const meetingInfo = this.extractMeetingInfo(text);
      
      const analysisResult = {
        timestamp: new Date(),
        detectedPlatform,
        meetingInfo,
        rawText: text,
        confidence: this.calculateConfidence(text, detectedPlatform)
      };

      this.emit('analysisResult', analysisResult);
      
      // Store for comparison
      this.lastScreenshot = {
        buffer: processedBuffer,
        analysis: analysisResult
      };

      return analysisResult;
      
    } catch (error) {
      console.error('Screen analysis failed:', error);
      throw error;
    }
  }

  detectMeetingPlatform(text) {
    const platforms = Object.keys(this.meetingPatterns);
    const detectionResults = {};

    for (const platform of platforms) {
      const patterns = this.meetingPatterns[platform];
      let matches = 0;

      for (const pattern of patterns) {
        if (pattern.test(text)) {
          matches++;
        }
      }

      detectionResults[platform] = {
        matches,
        confidence: matches / patterns.length
      };
    }

    // Find platform with highest confidence
    let bestPlatform = null;
    let bestConfidence = 0;

    for (const [platform, result] of Object.entries(detectionResults)) {
      if (result.confidence > bestConfidence && result.confidence > 0.3) {
        bestPlatform = platform;
        bestConfidence = result.confidence;
      }
    }

    return bestPlatform ? {
      platform: bestPlatform,
      confidence: bestConfidence,
      allResults: detectionResults
    } : null;
  }

  extractMeetingInfo(text) {
    const info = {
      participants: [],
      meetingTitle: null,
      meetingId: null,
      isHost: false,
      isMuted: false,
      isVideoOn: false,
      isScreenSharing: false
    };

    // Extract meeting title (common patterns)
    const titlePatterns = [
      /Meeting:\s*(.+?)(?:\n|$)/i,
      /Title:\s*(.+?)(?:\n|$)/i,
      /"([^"]+)"\s*meeting/i
    ];

    for (const pattern of titlePatterns) {
      const match = text.match(pattern);
      if (match) {
        info.meetingTitle = match[1].trim();
        break;
      }
    }

    // Extract meeting ID
    const idPatterns = [
      /Meeting ID:\s*(\d+(?:\s+\d+)*)/i,
      /ID:\s*(\d+(?:\s+\d+)*)/i,
      /(\d{3}\s+\d{3}\s+\d{4})/
    ];

    for (const pattern of idPatterns) {
      const match = text.match(pattern);
      if (match) {
        info.meetingId = match[1].replace(/\s+/g, '');
        break;
      }
    }

    // Detect status indicators
    info.isMuted = /mute|muted/i.test(text) && !/unmute/i.test(text);
    info.isVideoOn = /video.*on|camera.*on/i.test(text);
    info.isScreenSharing = /sharing|screen share|present/i.test(text);
    info.isHost = /host|organizer/i.test(text);

    // Extract participant count (simplified)
    const participantMatch = text.match(/(\d+)\s+participant/i);
    if (participantMatch) {
      info.participantCount = parseInt(participantMatch[1]);
    }

    return info;
  }

  calculateConfidence(text, detectedPlatform) {
    if (!detectedPlatform) {
      return 0;
    }

    let confidence = detectedPlatform.confidence;

    // Boost confidence based on additional indicators
    const commonMeetingWords = [
      'meeting', 'call', 'video', 'audio', 'participants',
      'mute', 'camera', 'share', 'screen', 'chat'
    ];

    let wordMatches = 0;
    for (const word of commonMeetingWords) {
      if (new RegExp(word, 'i').test(text)) {
        wordMatches++;
      }
    }

    confidence += (wordMatches / commonMeetingWords.length) * 0.3;

    return Math.min(confidence, 1.0);
  }

  async captureRegion(x, y, width, height) {
    try {
      const screenshotBuffer = await screenshot({ format: 'png' });
      const image = await Jimp.read(screenshotBuffer);
      
      // Crop to specified region
      const croppedImage = image.crop(x, y, width, height);
      
      return await croppedImage.getBufferAsync(Jimp.MIME_PNG);
    } catch (error) {
      console.error('Failed to capture screen region:', error);
      throw error;
    }
  }

  async findUIElements(elementType) {
    try {
      if (!this.lastScreenshot) {
        await this.analyzeScreen();
      }

      const text = this.lastScreenshot.analysis.rawText;
      const elements = [];

      // Define patterns for common UI elements
      const patterns = {
        buttons: [
          /Leave meeting/i,
          /End call/i,
          /Mute/i,
          /Unmute/i,
          /Start video/i,
          /Stop video/i,
          /Share screen/i,
          /Stop sharing/i
        ],
        participants: [
          /\d+\s+participant/i,
          /People\s*\(\d+\)/i,
          /Attendees\s*\(\d+\)/i
        ],
        chat: [
          /Chat/i,
          /Messages/i,
          /Send message/i
        ]
      };

      if (patterns[elementType]) {
        for (const pattern of patterns[elementType]) {
          const matches = text.match(new RegExp(pattern.source, 'gi'));
          if (matches) {
            elements.push(...matches);
          }
        }
      }

      return elements;
    } catch (error) {
      console.error('Failed to find UI elements:', error);
      throw error;
    }
  }

  setAnalysisInterval(intervalMs) {
    this.intervalMs = intervalMs;
    
    // Restart analysis with new interval if currently running
    if (this.isAnalyzing) {
      this.stopAnalysis();
      this.startAnalysis();
    }
  }

  getAnalysisStats() {
    return {
      isAnalyzing: this.isAnalyzing,
      intervalMs: this.intervalMs,
      hasLastScreenshot: !!this.lastScreenshot,
      lastAnalysisTime: this.lastScreenshot?.analysis?.timestamp
    };
  }

  async cleanup() {
    try {
      await this.stopAnalysis();
      
      if (this.tesseractWorker) {
        await this.tesseractWorker.terminate();
        this.tesseractWorker = null;
      }
      
      console.log('ScreenAnalyzer cleaned up');
    } catch (error) {
      console.error('Failed to cleanup ScreenAnalyzer:', error);
    }
  }
}

module.exports = ScreenAnalyzer;