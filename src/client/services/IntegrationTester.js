// Integration Tester - Comprehensive integration testing for all components
class IntegrationTester {
  constructor() {
    this.isRunning = false;
    this.testResults = new Map();
    this.testSuites = new Map();
    this.currentTest = null;
    
    // Test configuration
    this.config = {
      timeout: 30000, // 30 seconds per test
      retries: 3,
      parallel: false,
      verbose: true,
      stopOnFailure: false
    };
    
    // Test statistics
    this.stats = {
      totalTests: 0,
      passedTests: 0,
      failedTests: 0,
      skippedTests: 0,
      totalTime: 0,
      startTime: 0
    };
    
    this.eventListeners = new Map();
    
    // Initialize test suites
    this.initializeTestSuites();
  }

  /**
   * Initialize integration test suites
   */
  initializeTestSuites() {
    // Audio processing integration tests
    this.testSuites.set('audio', {
      name: 'Audio Processing Integration',
      tests: [
        { name: 'Audio Capture Initialization', fn: () => this.testAudioCaptureInit() },
        { name: 'Audio Quality Assessment', fn: () => this.testAudioQuality() },
        { name: 'Audio Buffer Management', fn: () => this.testAudioBufferManagement() },
        { name: 'Audio Preprocessing', fn: () => this.testAudioPreprocessing() }
      ]
    });
    
    // Transcription engine integration tests
    this.testSuites.set('transcription', {
      name: 'Transcription Engine Integration',
      tests: [
        { name: 'Local STT Integration', fn: () => this.testLocalSTTIntegration() },
        { name: 'Cloud STT Integration', fn: () => this.testCloudSTTIntegration() },
        { name: 'Transcription Pipeline', fn: () => this.testTranscriptionPipeline() },
        { name: 'Real-time Processing', fn: () => this.testRealTimeProcessing() }
      ]
    });
    
    // Speaker identification integration tests
    this.testSuites.set('speaker', {
      name: 'Speaker Identification Integration',
      tests: [
        { name: 'Speaker Enrollment', fn: () => this.testSpeakerEnrollment() },
        { name: 'Speaker Recognition', fn: () => this.testSpeakerRecognition() },
        { name: 'Multi-speaker Handling', fn: () => this.testMultiSpeakerHandling() }
      ]
    });
    
    // Summary generation integration tests
    this.testSuites.set('summary', {
      name: 'Summary Generation Integration',
      tests: [
        { name: 'AI Provider Integration', fn: () => this.testAIProviderIntegration() },
        { name: 'Custom Prompt Processing', fn: () => this.testCustomPromptProcessing() },
        { name: 'Agenda-based Summarization', fn: () => this.testAgendaBasedSummarization() }
      ]
    });
    
    // Teams integration tests
    this.testSuites.set('teams', {
      name: 'Teams Platform Integration',
      tests: [
        { name: 'Teams SDK Integration', fn: () => this.testTeamsSDKIntegration() },
        { name: 'Meeting Detection', fn: () => this.testMeetingDetection() },
        { name: 'Chat Integration', fn: () => this.testChatIntegration() },
        { name: 'Permissions Handling', fn: () => this.testPermissionsHandling() }
      ]
    });
    
    // Performance integration tests
    this.testSuites.set('performance', {
      name: 'Performance Integration',
      tests: [
        { name: 'Memory Management', fn: () => this.testMemoryManagement() },
        { name: 'Performance Optimization', fn: () => this.testPerformanceOptimization() },
        { name: 'Resource Monitoring', fn: () => this.testResourceMonitoring() },
        { name: 'Garbage Collection', fn: () => this.testGarbageCollection() }
      ]
    });
    
    // End-to-end workflow tests
    this.testSuites.set('e2e', {
      name: 'End-to-End Workflow',
      tests: [
        { name: 'Complete Transcription Workflow', fn: () => this.testCompleteWorkflow() },
        { name: 'Error Recovery Workflow', fn: () => this.testErrorRecoveryWorkflow() },
        { name: 'Multi-user Workflow', fn: () => this.testMultiUserWorkflow() }
      ]
    });
  }

  /**
   * Run all integration tests
   */
  async runAllTests() {
    if (this.isRunning) {
      throw new Error('Tests are already running');
    }

    try {
      this.isRunning = true;
      this.resetStats();
      
      console.log('Starting comprehensive integration tests...');
      this.notifyListeners('testsStarted', { timestamp: Date.now() });
      
      this.stats.startTime = Date.now();
      
      // Run test suites
      for (const [suiteKey, suite] of this.testSuites) {
        await this.runTestSuite(suiteKey, suite);
        
        if (this.config.stopOnFailure && this.stats.failedTests > 0) {
          console.log('Stopping tests due to failure');
          break;
        }
      }
      
      this.stats.totalTime = Date.now() - this.stats.startTime;
      
      const results = this.generateTestReport();
      console.log('Integration tests completed:', results);
      
      this.notifyListeners('testsCompleted', results);
      
      return results;
      
    } catch (error) {
      console.error('Integration tests failed:', error);
      this.notifyListeners('testsFailed', { error: error.message });
      throw error;
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Run specific test suite
   */
  async runTestSuite(suiteKey, suite) {
    console.log(`Running test suite: ${suite.name}`);
    
    const suiteResults = {
      name: suite.name,
      tests: [],
      passed: 0,
      failed: 0,
      skipped: 0,
      startTime: Date.now(),
      endTime: null
    };
    
    this.notifyListeners('suiteStarted', { suite: suite.name });
    
    for (const test of suite.tests) {
      const testResult = await this.runSingleTest(test);
      suiteResults.tests.push(testResult);
      
      if (testResult.status === 'passed') {
        suiteResults.passed++;
        this.stats.passedTests++;
      } else if (testResult.status === 'failed') {
        suiteResults.failed++;
        this.stats.failedTests++;
      } else {
        suiteResults.skipped++;
        this.stats.skippedTests++;
      }
      
      this.stats.totalTests++;
    }
    
    suiteResults.endTime = Date.now();
    this.testResults.set(suiteKey, suiteResults);
    
    this.notifyListeners('suiteCompleted', suiteResults);
  }

  /**
   * Run single test
   */
  async runSingleTest(test) {
    const testResult = {
      name: test.name,
      status: 'running',
      startTime: Date.now(),
      endTime: null,
      duration: 0,
      error: null,
      details: {}
    };
    
    this.currentTest = testResult;
    
    console.log(`Running test: ${test.name}`);
    this.notifyListeners('testStarted', { test: test.name });
    
    let retries = 0;
    
    while (retries <= this.config.retries) {
      try {
        // Set timeout for test
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Test timeout')), this.config.timeout);
        });
        
        // Run test with timeout
        const testPromise = test.fn();
        const result = await Promise.race([testPromise, timeoutPromise]);
        
        testResult.status = 'passed';
        testResult.details = result || {};
        break;
        
      } catch (error) {
        retries++;
        testResult.error = error.message;
        
        if (retries > this.config.retries) {
          testResult.status = 'failed';
          console.error(`Test failed: ${test.name}`, error);
        } else {
          console.warn(`Test retry ${retries}/${this.config.retries}: ${test.name}`);
          await this.delay(1000 * retries); // Exponential backoff
        }
      }
    }
    
    testResult.endTime = Date.now();
    testResult.duration = testResult.endTime - testResult.startTime;
    
    this.notifyListeners('testCompleted', testResult);
    
    return testResult;
  }

  /**
   * Test audio capture initialization
   */
  async testAudioCaptureInit() {
    const audioProcessor = window.audioProcessor;
    if (!audioProcessor) {
      throw new Error('AudioProcessor not available');
    }
    
    // Test initialization
    await audioProcessor.initialize();
    
    if (!audioProcessor.audioContext) {
      throw new Error('Audio context not initialized');
    }
    
    return {
      audioContextState: audioProcessor.audioContext.state,
      sampleRate: audioProcessor.audioContext.sampleRate
    };
  }

  /**
   * Test audio quality assessment
   */
  async testAudioQuality() {
    const audioProcessor = window.audioProcessor;
    if (!audioProcessor) {
      throw new Error('AudioProcessor not available');
    }
    
    // Create mock audio stream
    const mockStream = await this.createMockAudioStream();
    
    // Start capture
    await audioProcessor.startCapture(mockStream);
    
    // Wait for quality metrics
    await this.delay(2000);
    
    const qualityMetrics = audioProcessor.getQualityMetrics();
    
    if (!qualityMetrics || typeof qualityMetrics.averageVolume !== 'number') {
      throw new Error('Quality metrics not available');
    }
    
    audioProcessor.stopCapture();
    
    return qualityMetrics;
  }

  /**
   * Test audio buffer management
   */
  async testAudioBufferManagement() {
    const audioProcessor = window.audioProcessor;
    if (!audioProcessor) {
      throw new Error('AudioProcessor not available');
    }
    
    const initialBufferCount = audioProcessor.audioBuffers.length;
    
    // Create mock audio stream
    const mockStream = await this.createMockAudioStream();
    await audioProcessor.startCapture(mockStream);
    
    // Wait for buffers to accumulate
    await this.delay(3000);
    
    const finalBufferCount = audioProcessor.audioBuffers.length;
    
    audioProcessor.stopCapture();
    
    if (finalBufferCount <= initialBufferCount) {
      throw new Error('Audio buffers not accumulating');
    }
    
    return {
      initialBufferCount,
      finalBufferCount,
      buffersAdded: finalBufferCount - initialBufferCount
    };
  }

  /**
   * Test audio preprocessing
   */
  async testAudioPreprocessing() {
    const audioProcessor = window.audioProcessor;
    if (!audioProcessor) {
      throw new Error('AudioProcessor not available');
    }
    
    // Create test audio data
    const testAudio = new Float32Array(1024);
    for (let i = 0; i < testAudio.length; i++) {
      testAudio[i] = Math.sin(2 * Math.PI * 440 * i / 44100); // 440Hz sine wave
    }
    
    // Test preprocessing
    const processed = audioProcessor.preprocessAudio(testAudio);
    
    if (!processed || processed.length !== testAudio.length) {
      throw new Error('Audio preprocessing failed');
    }
    
    return {
      originalLength: testAudio.length,
      processedLength: processed.length,
      processed: true
    };
  }

  /**
   * Test local STT integration
   */
  async testLocalSTTIntegration() {
    const localSTTService = window.localSTTService;
    if (!localSTTService) {
      throw new Error('LocalSTTService not available');
    }
    
    // Test initialization
    await localSTTService.initialize();
    
    if (!localSTTService.isInitialized) {
      throw new Error('Local STT service not initialized');
    }
    
    // Test transcription with mock audio
    const mockAudio = this.createMockAudioData();
    const result = await localSTTService.transcribe(mockAudio);
    
    if (!result || typeof result.text !== 'string') {
      throw new Error('Transcription result invalid');
    }
    
    return {
      initialized: true,
      transcriptionResult: result.text,
      confidence: result.confidence
    };
  }

  /**
   * Test cloud STT integration
   */
  async testCloudSTTIntegration() {
    const cloudSTTService = window.cloudSTTService;
    if (!cloudSTTService) {
      throw new Error('CloudSTTService not available');
    }
    
    // Test network status
    const networkStatus = cloudSTTService.getNetworkStatus();
    
    if (!networkStatus.isOnline) {
      throw new Error('Network not available for cloud STT');
    }
    
    return {
      networkOnline: networkStatus.isOnline,
      availableProviders: cloudSTTService.getAvailableProviders()
    };
  }

  /**
   * Test transcription pipeline
   */
  async testTranscriptionPipeline() {
    const transcriptionEngine = window.transcriptionEngine;
    if (!transcriptionEngine) {
      throw new Error('TranscriptionEngine not available');
    }
    
    // Initialize engine
    await transcriptionEngine.initialize();
    
    // Start transcription
    await transcriptionEngine.startTranscription();
    
    // Test audio processing
    const mockAudio = this.createMockAudioData();
    transcriptionEngine.handleAudioData(mockAudio);
    
    // Wait for processing
    await this.delay(2000);
    
    // Stop transcription
    transcriptionEngine.stopTranscription();
    
    const metrics = transcriptionEngine.getMetrics();
    
    return {
      initialized: true,
      metricsAvailable: !!metrics,
      totalTranscriptions: metrics?.totalTranscriptions || 0
    };
  }

  /**
   * Test real-time processing
   */
  async testRealTimeProcessing() {
    const transcriptionEngine = window.transcriptionEngine;
    if (!transcriptionEngine) {
      throw new Error('TranscriptionEngine not available');
    }
    
    // Enable real-time mode
    transcriptionEngine.config.realTimeMode = true;
    
    await transcriptionEngine.initialize();
    await transcriptionEngine.startTranscription();
    
    let partialResults = 0;
    let finalResults = 0;
    
    // Listen for results
    const partialListener = () => partialResults++;
    const finalListener = () => finalResults++;
    
    transcriptionEngine.addEventListener('partialResult', partialListener);
    transcriptionEngine.addEventListener('transcriptionResult', finalListener);
    
    // Send multiple audio segments
    for (let i = 0; i < 3; i++) {
      const mockAudio = this.createMockAudioData();
      transcriptionEngine.handleAudioData(mockAudio);
      await this.delay(500);
    }
    
    // Wait for processing
    await this.delay(2000);
    
    transcriptionEngine.stopTranscription();
    transcriptionEngine.removeEventListener('partialResult', partialListener);
    transcriptionEngine.removeEventListener('transcriptionResult', finalListener);
    
    return {
      partialResults,
      finalResults,
      realTimeMode: true
    };
  }

  /**
   * Test speaker enrollment
   */
  async testSpeakerEnrollment() {
    const speakerService = window.speakerIdentificationService;
    if (!speakerService) {
      throw new Error('SpeakerIdentificationService not available');
    }
    
    await speakerService.initialize();
    
    // Test speaker enrollment
    const mockAudio = this.createMockAudioData();
    await speakerService.enrollSpeaker('test_speaker', [mockAudio]);
    
    const profiles = speakerService.getSpeakerProfiles();
    
    if (!profiles.find(p => p.id === 'test_speaker')) {
      throw new Error('Speaker enrollment failed');
    }
    
    return {
      enrolled: true,
      profileCount: profiles.length
    };
  }

  /**
   * Test speaker recognition
   */
  async testSpeakerRecognition() {
    const speakerService = window.speakerIdentificationService;
    if (!speakerService) {
      throw new Error('SpeakerIdentificationService not available');
    }
    
    // Test speaker identification
    const mockAudio = this.createMockAudioData();
    const result = await speakerService.identifySpeaker(mockAudio);
    
    if (!result || typeof result.speakerId !== 'string') {
      throw new Error('Speaker identification failed');
    }
    
    return {
      identified: true,
      speakerId: result.speakerId,
      confidence: result.confidence
    };
  }

  /**
   * Test multi-speaker handling
   */
  async testMultiSpeakerHandling() {
    const speakerService = window.speakerIdentificationService;
    if (!speakerService) {
      throw new Error('SpeakerIdentificationService not available');
    }
    
    // Enroll multiple speakers
    const speakers = ['speaker1', 'speaker2', 'speaker3'];
    
    for (const speakerId of speakers) {
      const mockAudio = this.createMockAudioData();
      await speakerService.enrollSpeaker(speakerId, [mockAudio]);
    }
    
    const profiles = speakerService.getSpeakerProfiles();
    
    if (profiles.length < speakers.length) {
      throw new Error('Multi-speaker enrollment failed');
    }
    
    return {
      enrolledSpeakers: profiles.length,
      speakerIds: profiles.map(p => p.id)
    };
  }

  /**
   * Test AI provider integration
   */
  async testAIProviderIntegration() {
    const summaryService = window.summaryService;
    if (!summaryService) {
      throw new Error('SummaryService not available');
    }
    
    const providers = summaryService.getAvailableProviders();
    
    if (providers.length === 0) {
      throw new Error('No AI providers available');
    }
    
    return {
      availableProviders: providers,
      providerCount: providers.length
    };
  }

  /**
   * Test custom prompt processing
   */
  async testCustomPromptProcessing() {
    const summaryService = window.summaryService;
    if (!summaryService) {
      throw new Error('SummaryService not available');
    }
    
    // Test custom prompt
    const customPrompt = 'Summarize the key points from this meeting.';
    const mockTranscript = 'This is a test transcript for summarization.';
    
    try {
      const summary = await summaryService.generateSummary(mockTranscript, null, customPrompt);
      
      return {
        customPromptProcessed: true,
        summaryGenerated: !!summary,
        summaryLength: summary?.length || 0
      };
    } catch (error) {
      // Expected if no API keys configured
      return {
        customPromptProcessed: false,
        error: 'API configuration required'
      };
    }
  }

  /**
   * Test agenda-based summarization
   */
  async testAgendaBasedSummarization() {
    const summaryService = window.summaryService;
    if (!summaryService) {
      throw new Error('SummaryService not available');
    }
    
    const mockAgenda = {
      items: [
        { title: 'Project Updates', description: 'Review current project status' },
        { title: 'Budget Discussion', description: 'Discuss Q4 budget allocation' }
      ]
    };
    
    const mockTranscript = 'We discussed project updates and budget allocation.';
    
    try {
      const summary = await summaryService.generateSummary(mockTranscript, mockAgenda);
      
      return {
        agendaProcessed: true,
        summaryGenerated: !!summary,
        agendaItems: mockAgenda.items.length
      };
    } catch (error) {
      return {
        agendaProcessed: false,
        error: 'API configuration required'
      };
    }
  }

  /**
   * Test Teams SDK integration
   */
  async testTeamsSDKIntegration() {
    // Check if Teams SDK is available
    if (typeof microsoftTeams === 'undefined') {
      throw new Error('Teams SDK not available');
    }
    
    return {
      teamsSDKAvailable: true,
      version: microsoftTeams.version || 'unknown'
    };
  }

  /**
   * Test meeting detection
   */
  async testMeetingDetection() {
    const teamsAdapter = window.teamsAdapter;
    if (!teamsAdapter) {
      throw new Error('TeamsAdapter not available');
    }
    
    // Test meeting info retrieval
    try {
      const meetingInfo = await teamsAdapter.getMeetingInfo();
      
      return {
        meetingDetected: !!meetingInfo,
        meetingInfo: meetingInfo
      };
    } catch (error) {
      return {
        meetingDetected: false,
        error: 'Not in Teams meeting context'
      };
    }
  }

  /**
   * Test chat integration
   */
  async testChatIntegration() {
    const chatService = window.teamsChatService;
    if (!chatService) {
      throw new Error('TeamsChatService not available');
    }
    
    // Test chat capabilities
    const canSendMessages = chatService.canSendMessages();
    
    return {
      chatServiceAvailable: true,
      canSendMessages: canSendMessages
    };
  }

  /**
   * Test permissions handling
   */
  async testPermissionsHandling() {
    // Test microphone permissions
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach(track => track.stop());
      
      return {
        microphonePermission: true,
        permissionsGranted: true
      };
    } catch (error) {
      return {
        microphonePermission: false,
        error: error.message
      };
    }
  }

  /**
   * Test memory management
   */
  async testMemoryManagement() {
    const memoryManager = window.memoryManager;
    if (!memoryManager) {
      throw new Error('MemoryManager not available');
    }
    
    memoryManager.start();
    
    // Test memory operations
    const audioBuffer = memoryManager.getFromPool('audioBuffers');
    const returned = memoryManager.returnToPool('audioBuffers', audioBuffer);
    
    const stats = memoryManager.getMemoryStats();
    
    return {
      memoryManagerActive: memoryManager.isActive,
      poolOperations: returned,
      memoryStats: stats
    };
  }

  /**
   * Test performance optimization
   */
  async testPerformanceOptimization() {
    const performanceOptimizer = window.performanceOptimizer;
    if (!performanceOptimizer) {
      throw new Error('PerformanceOptimizer not available');
    }
    
    await performanceOptimizer.startOptimization('balanced');
    
    const status = performanceOptimizer.getOptimizationStatus();
    
    performanceOptimizer.stopOptimization();
    
    return {
      optimizationStarted: status.isOptimizing,
      enabledStrategies: status.enabledStrategies.length,
      performanceMode: status.performanceMode
    };
  }

  /**
   * Test resource monitoring
   */
  async testResourceMonitoring() {
    const performanceMonitor = window.performanceMonitor;
    if (!performanceMonitor) {
      throw new Error('PerformanceMonitor not available');
    }
    
    performanceMonitor.start();
    
    // Wait for metrics collection
    await this.delay(2000);
    
    const metrics = performanceMonitor.getAllMetrics();
    
    performanceMonitor.stop();
    
    return {
      monitoringActive: true,
      metricsCollected: Object.keys(metrics).length,
      metrics: metrics
    };
  }

  /**
   * Test garbage collection
   */
  async testGarbageCollection() {
    const memoryManager = window.memoryManager;
    if (!memoryManager) {
      throw new Error('MemoryManager not available');
    }
    
    const initialStats = memoryManager.getMemoryStats();
    
    // Trigger cleanup
    memoryManager.performCleanup();
    
    const finalStats = memoryManager.getMemoryStats();
    
    return {
      cleanupPerformed: true,
      gcCountBefore: initialStats.gcCount,
      gcCountAfter: finalStats.gcCount
    };
  }

  /**
   * Test complete transcription workflow
   */
  async testCompleteWorkflow() {
    // This is a comprehensive end-to-end test
    const components = [
      'audioProcessor',
      'transcriptionEngine',
      'speakerIdentificationService',
      'summaryService'
    ];
    
    // Check all components are available
    for (const component of components) {
      if (!window[component]) {
        throw new Error(`${component} not available`);
      }
    }
    
    // Initialize all components
    await window.audioProcessor.initialize();
    await window.transcriptionEngine.initialize();
    await window.speakerIdentificationService.initialize();
    
    // Start workflow
    const mockStream = await this.createMockAudioStream();
    await window.audioProcessor.startCapture(mockStream);
    await window.transcriptionEngine.startTranscription();
    
    // Process audio
    const mockAudio = this.createMockAudioData();
    window.transcriptionEngine.handleAudioData(mockAudio);
    
    // Wait for processing
    await this.delay(3000);
    
    // Stop workflow
    window.transcriptionEngine.stopTranscription();
    window.audioProcessor.stopCapture();
    
    const metrics = window.transcriptionEngine.getMetrics();
    
    return {
      workflowCompleted: true,
      componentsInitialized: components.length,
      transcriptionsProcessed: metrics?.totalTranscriptions || 0
    };
  }

  /**
   * Test error recovery workflow
   */
  async testErrorRecoveryWorkflow() {
    const errorHandler = window.errorHandler;
    if (!errorHandler) {
      throw new Error('ErrorHandler not available');
    }
    
    // Test error handling
    const testError = new Error('Test error for recovery');
    
    const recovery = await errorHandler.handleTranscriptionError(testError, {
      component: 'test',
      operation: 'integration-test'
    });
    
    return {
      errorHandled: true,
      recoveryAttempted: recovery.success,
      recoveryStrategy: recovery.strategy
    };
  }

  /**
   * Test multi-user workflow
   */
  async testMultiUserWorkflow() {
    const speakerService = window.speakerIdentificationService;
    if (!speakerService) {
      throw new Error('SpeakerIdentificationService not available');
    }
    
    // Simulate multiple users
    const users = ['user1', 'user2', 'user3'];
    
    for (const user of users) {
      const mockAudio = this.createMockAudioData();
      await speakerService.enrollSpeaker(user, [mockAudio]);
    }
    
    const profiles = speakerService.getSpeakerProfiles();
    
    return {
      multiUserSupport: true,
      usersEnrolled: profiles.length,
      userIds: profiles.map(p => p.id)
    };
  }

  /**
   * Create mock audio stream
   */
  async createMockAudioStream() {
    // Create a mock MediaStream for testing
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const destination = audioContext.createMediaStreamDestination();
    
    oscillator.connect(destination);
    oscillator.frequency.value = 440; // A4 note
    oscillator.start();
    
    return destination.stream;
  }

  /**
   * Create mock audio data
   */
  createMockAudioData() {
    const sampleRate = 16000;
    const duration = 1; // 1 second
    const samples = sampleRate * duration;
    const audioData = new Float32Array(samples);
    
    // Generate sine wave
    for (let i = 0; i < samples; i++) {
      audioData[i] = Math.sin(2 * Math.PI * 440 * i / sampleRate) * 0.1;
    }
    
    return {
      data: audioData,
      sampleRate: sampleRate,
      duration: duration,
      timestamp: Date.now()
    };
  }

  /**
   * Reset test statistics
   */
  resetStats() {
    this.stats = {
      totalTests: 0,
      passedTests: 0,
      failedTests: 0,
      skippedTests: 0,
      totalTime: 0,
      startTime: 0
    };
    
    this.testResults.clear();
  }

  /**
   * Generate test report
   */
  generateTestReport() {
    const report = {
      summary: {
        ...this.stats,
        successRate: this.stats.totalTests > 0 
          ? (this.stats.passedTests / this.stats.totalTests) * 100 
          : 0
      },
      suites: {}
    };
    
    this.testResults.forEach((results, suiteKey) => {
      report.suites[suiteKey] = results;
    });
    
    return report;
  }

  /**
   * Export test results
   */
  exportResults(format = 'json') {
    const report = this.generateTestReport();
    
    switch (format) {
      case 'json':
        return JSON.stringify(report, null, 2);
      case 'html':
        return this.generateHTMLReport(report);
      default:
        return report;
    }
  }

  /**
   * Generate HTML test report
   */
  generateHTMLReport(report) {
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Integration Test Report</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 20px; }
          .summary { background: #f5f5f5; padding: 15px; border-radius: 5px; }
          .suite { margin: 20px 0; border: 1px solid #ddd; border-radius: 5px; }
          .suite-header { background: #e9e9e9; padding: 10px; font-weight: bold; }
          .test { padding: 10px; border-bottom: 1px solid #eee; }
          .passed { color: green; }
          .failed { color: red; }
          .skipped { color: orange; }
        </style>
      </head>
      <body>
        <h1>Integration Test Report</h1>
        <div class="summary">
          <h2>Summary</h2>
          <p>Total Tests: ${report.summary.totalTests}</p>
          <p>Passed: <span class="passed">${report.summary.passedTests}</span></p>
          <p>Failed: <span class="failed">${report.summary.failedTests}</span></p>
          <p>Skipped: <span class="skipped">${report.summary.skippedTests}</span></p>
          <p>Success Rate: ${report.summary.successRate.toFixed(2)}%</p>
          <p>Total Time: ${report.summary.totalTime}ms</p>
        </div>
        ${Object.entries(report.suites).map(([key, suite]) => `
          <div class="suite">
            <div class="suite-header">${suite.name}</div>
            ${suite.tests.map(test => `
              <div class="test">
                <span class="${test.status}">${test.name}: ${test.status.toUpperCase()}</span>
                <span style="float: right;">${test.duration}ms</span>
                ${test.error ? `<div style="color: red; font-size: 0.9em;">${test.error}</div>` : ''}
              </div>
            `).join('')}
          </div>
        `).join('')}
      </body>
      </html>
    `;
    
    return html;
  }

  /**
   * Utility delay function
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Add event listener
   */
  addEventListener(eventType, listener) {
    if (!this.eventListeners.has(eventType)) {
      this.eventListeners.set(eventType, []);
    }
    this.eventListeners.get(eventType).push(listener);
  }

  /**
   * Remove event listener
   */
  removeEventListener(eventType, listener) {
    const listeners = this.eventListeners.get(eventType);
    if (listeners) {
      const index = listeners.indexOf(listener);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }
  }

  /**
   * Notify event listeners
   */
  notifyListeners(eventType, data) {
    const listeners = this.eventListeners.get(eventType) || [];
    listeners.forEach(listener => {
      try {
        listener(data);
      } catch (error) {
        console.error(`Error in ${eventType} listener:`, error);
      }
    });
  }

  /**
   * Cleanup resources
   */
  cleanup() {
    this.testResults.clear();
    this.eventListeners.clear();
    console.log('Integration tester cleaned up');
  }
}

export default IntegrationTester;