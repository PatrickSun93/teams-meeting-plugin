// Main Plugin Interface - Comprehensive UI for the transcription plugin
import React, { useState, useCallback, useRef, useEffect } from 'react';
import MeetingController from './MeetingController.js';
import MeetingStatus from './MeetingStatus.js';
import TranscriptionControls from './TranscriptionControls.js';
import RealTimeTranscription from './RealTimeTranscription.js';
import ConfigurationPanel from './ConfigurationPanel.js';
import ChatIntegration from './ChatIntegration.js';
import NotificationSystem from './NotificationSystem.js';
import DiagnosticPanel from './DiagnosticPanel.js';
import TranscriptManager from './TranscriptManager.js';
import SummaryDisplay from './SummaryDisplay.js';
import PromptManager from './PromptManager.js';
import AgendaIntegration from './AgendaIntegration.js';
import SpeakerIdentification from './SpeakerIdentification.js';
import HelpPanel from './HelpPanel.js';
import ProgressIndicator from './ProgressIndicator.js';
import StatusDisplay from './StatusDisplay.js';
import PerformanceOptimizationPanel from './PerformanceOptimizationPanel.js';
import PlatformIndicator from './PlatformIndicator.js';
import { platformThemeProvider } from './PlatformTheme.js';
import { platformDetectionService } from '../services/PlatformDetectionService.js';
import { MeetingPlatform } from '../services/PlatformAdapter.js';
import useConfiguration from '../hooks/useConfiguration.js';
import { errorHandler } from '../services/ErrorHandler.js';
import './PluginInterface.css';
import './PlatformTheme.css';

const PluginInterface = () => {
  // Navigation state
  const [activeTab, setActiveTab] = useState('meeting');
  const [showConfigPanel, setShowConfigPanel] = useState(false);
  const [showDiagnosticPanel, setShowDiagnosticPanel] = useState(false);
  const [showHelpPanel, setShowHelpPanel] = useState(false);
  const [showPerformancePanel, setShowPerformancePanel] = useState(false);
  
  // Meeting and transcription state
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [error, setError] = useState(null);
  const [meetingEvents, setMeetingEvents] = useState([]);
  const [currentTranscript, setCurrentTranscript] = useState(null);
  const [currentSummary, setCurrentSummary] = useState(null);
  const [transcriptionProgress, setTranscriptionProgress] = useState(null);
  
  // Platform state
  const [currentPlatform, setCurrentPlatform] = useState(MeetingPlatform.UNKNOWN);
  const [platformCapabilities, setPlatformCapabilities] = useState(null);
  const [platformTheme, setPlatformTheme] = useState(null);
  
  // Refs
  const transcriptionEngineRef = useRef(null);

  // Configuration hook
  const { config, hasValidConfiguration, requiresConsent } = useConfiguration();

  // Handle meeting state changes
  const handleMeetingStateChange = useCallback((event) => {
    console.log('Meeting state changed:', event);
    setMeetingEvents(prev => [...prev, event]);
    
    // Stop transcription if meeting ends
    if (event.newState === 'ended' && isTranscribing) {
      setIsTranscribing(false);
    }
  }, [isTranscribing]);

  // Handle errors
  const handleError = useCallback(async (error) => {
    console.error('Plugin error:', error);
    
    const result = await errorHandler.handleError(error, {
      component: 'plugin-interface',
      context: { activeTab, isTranscribing }
    });
    
    if (!result.success) {
      setError(error.message);
    }
  }, [activeTab, isTranscribing]);

  // Use the meeting controller
  const {
    isInitialized,
    meetingInfo,
    isHost,
    participants,
    meetingState,
    error: controllerError,
    isAudioCapturing,
    audioQuality,
    startTranscription,
    stopTranscription,
    getPlatformCapabilities,
    getAudioStatus,
    transcriptionEngine,
    teamsAdapter
  } = MeetingController({ 
    onMeetingStateChange: handleMeetingStateChange, 
    onError: handleError 
  });

  // Store transcription engine reference
  useEffect(() => {
    if (transcriptionEngine && !transcriptionEngineRef.current) {
      transcriptionEngineRef.current = transcriptionEngine;
    }
  }, [transcriptionEngine]);

  // Platform detection and theme setup
  useEffect(() => {
    const initializePlatform = async () => {
      try {
        // Detect current platform
        const detectedPlatform = platformDetectionService.getCurrentPlatform();
        setCurrentPlatform(detectedPlatform);
        
        // Set platform theme
        platformThemeProvider.setPlatform(detectedPlatform);
        
        // Get platform capabilities
        const capabilities = await platformDetectionService.getPlatformCapabilities(detectedPlatform);
        setPlatformCapabilities(capabilities);
        
        console.log('Platform initialized:', {
          platform: detectedPlatform,
          capabilities
        });
      } catch (error) {
        console.error('Error initializing platform:', error);
      }
    };

    initializePlatform();

    // Listen for platform changes
    const handlePlatformChange = async (event) => {
      setCurrentPlatform(event.newPlatform);
      platformThemeProvider.setPlatform(event.newPlatform);
      
      const capabilities = await platformDetectionService.getPlatformCapabilities(event.newPlatform);
      setPlatformCapabilities(capabilities);
    };

    platformDetectionService.onPlatformDetected(handlePlatformChange);

    // Listen for theme changes
    const handleThemeChange = (themeData) => {
      setPlatformTheme(themeData);
    };

    platformThemeProvider.onThemeChange(handleThemeChange);

    // Start continuous platform detection
    platformDetectionService.startContinuousDetection();

    return () => {
      platformDetectionService.removeDetectionCallback(handlePlatformChange);
      platformThemeProvider.removeThemeChangeCallback(handleThemeChange);
      platformDetectionService.stopContinuousDetection();
    };
  }, []);

  // Handle transcription start
  const handleStartTranscription = useCallback(async () => {
    if (!hasValidConfiguration()) {
      setError('Please configure the plugin before starting transcription');
      setShowConfigPanel(true);
      return { success: false, error: 'Configuration required' };
    }

    if (requiresConsent() && !config?.consentGiven) {
      setError('Please provide consent for cloud services in configuration');
      setShowConfigPanel(true);
      return { success: false, error: 'Consent required' };
    }

    try {
      setTranscriptionProgress({ status: 'starting', message: 'Initializing transcription...' });
      const result = await startTranscription();
      
      if (result.success) {
        setIsTranscribing(true);
        setError(null);
        setTranscriptionProgress({ status: 'active', message: 'Transcription active' });
      } else {
        setTranscriptionProgress(null);
        await handleError(result.error);
      }
      return result;
    } catch (error) {
      setTranscriptionProgress(null);
      await handleError(error);
      return { success: false, error };
    }
  }, [hasValidConfiguration, requiresConsent, config, startTranscription, handleError]);

  // Handle transcription stop
  const handleStopTranscription = useCallback(async () => {
    try {
      setTranscriptionProgress({ status: 'stopping', message: 'Stopping transcription...' });
      const result = await stopTranscription();
      
      if (result.success) {
        setIsTranscribing(false);
        setTranscriptionProgress(null);
      } else {
        await handleError(result.error);
      }
      return result;
    } catch (error) {
      await handleError(error);
      return { success: false, error };
    }
  }, [stopTranscription, handleError]);

  // Handle transcript updates
  const handleTranscriptUpdate = useCallback((transcript) => {
    setCurrentTranscript(transcript);
  }, []);

  // Handle summary updates
  const handleSummaryUpdate = useCallback((summary) => {
    setCurrentSummary(summary);
  }, []);

  // Clear error
  const clearError = () => setError(null);

  // Get platform-aware navigation tabs
  const getNavigationTabs = () => {
    const baseTabs = [
      { id: 'meeting', label: 'Meeting', icon: '🎤', alwaysShow: true },
      { id: 'transcription', label: 'Transcription', icon: '📝', alwaysShow: true },
      { id: 'summary', label: 'Summary', icon: '📋', requiresCapability: 'aiSummary' },
      { id: 'history', label: 'History', icon: '📚', alwaysShow: true },
      { id: 'speakers', label: 'Speakers', icon: '👥', requiresCapability: 'speakerIdentification' },
      { id: 'agenda', label: 'Agenda', icon: '📅', requiresCapability: 'agendaAccess' }
    ];

    // Filter tabs based on platform capabilities
    return baseTabs.filter(tab => {
      if (tab.alwaysShow) return true;
      if (!platformCapabilities) return false;
      
      if (tab.requiresCapability) {
        return platformCapabilities[tab.requiresCapability] === true;
      }
      
      return true;
    });
  };

  const tabs = getNavigationTabs();

  if (!isInitialized) {
    return (
      <div className="plugin-interface loading">
        <ProgressIndicator 
          status="initializing"
          message="Initializing Teams Integration..."
          description="Please wait while we connect to Microsoft Teams"
        />
      </div>
    );
  }

  const displayError = error || controllerError;

  return (
    <div className={`plugin-interface platform-component platform-${currentPlatform}`}>
      {/* Header */}
      <header className="plugin-header">
        <div className="header-content platform-container">
          <div className="header-title">
            <h1>🎤 Meeting Transcription</h1>
            <p>Real-time transcription and AI summaries</p>
            <PlatformIndicator 
              platform={currentPlatform}
              capabilities={platformCapabilities}
              isActive={meetingState === 'active'}
              compact={true}
            />
          </div>
          <div className="header-actions">
            <button 
              className="action-button platform-button"
              onClick={() => setShowConfigPanel(true)}
              title="Settings"
            >
              ⚙️
            </button>
            <button 
              className="action-button platform-button"
              onClick={() => setShowDiagnosticPanel(true)}
              title="Diagnostics"
            >
              🔧
            </button>
            <button 
              className="action-button platform-button"
              onClick={() => setShowHelpPanel(true)}
              title="Help"
            >
              ❓
            </button>
            
            <button 
              className="action-button platform-button"
              onClick={() => setShowPerformancePanel(true)}
              title="Performance Optimization"
            >
              ⚡
            </button>
          </div>
        </div>
      </header>

      {/* Status Bar */}
      <StatusDisplay 
        meetingState={meetingState}
        isTranscribing={isTranscribing}
        isHost={isHost}
        audioQuality={audioQuality}
        error={displayError}
        onClearError={clearError}
        platform={currentPlatform}
        platformCapabilities={platformCapabilities}
      />

      {/* Progress Indicator */}
      {transcriptionProgress && (
        <ProgressIndicator 
          status={transcriptionProgress.status}
          message={transcriptionProgress.message}
        />
      )}

      {/* Navigation Tabs */}
      <nav className="plugin-navigation">
        <div className="platform-container">
          {tabs.map(tab => (
            <button
              key={tab.id}
              className={`nav-tab platform-button ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              <span className="tab-icon platform-icon">{tab.icon}</span>
              <span className="tab-label">{tab.label}</span>
            </button>
          ))}
        </div>
      </nav>

      {/* Main Content */}
      <main className="plugin-content platform-container">
        {activeTab === 'meeting' && (
          <div className="tab-content">
            <MeetingStatus 
              meetingInfo={meetingInfo}
              participants={participants}
              isHost={isHost}
              meetingState={meetingState}
            />
            
            <TranscriptionControls
              isHost={isHost}
              meetingState={meetingState}
              onStartTranscription={handleStartTranscription}
              onStopTranscription={handleStopTranscription}
              isTranscribing={isTranscribing}
            />

            <PlatformIndicator 
              platform={currentPlatform}
              capabilities={platformCapabilities}
              isActive={meetingState === 'active'}
              showCapabilities={true}
            />
          </div>
        )}

        {activeTab === 'transcription' && (
          <div className="tab-content">
            <RealTimeTranscription
              transcriptionEngine={transcriptionEngineRef.current}
              isActive={isTranscribing}
              onTranscriptUpdate={handleTranscriptUpdate}
              onSummaryUpdate={handleSummaryUpdate}
            />
            
            <ChatIntegration
              teamsAdapter={teamsAdapter}
              transcript={currentTranscript}
              summary={currentSummary}
              onError={handleError}
            />
          </div>
        )}

        {activeTab === 'summary' && (
          <div className="tab-content">
            <SummaryDisplay 
              summary={currentSummary}
              transcript={currentTranscript}
            />
            
            <PromptManager />
          </div>
        )}

        {activeTab === 'history' && (
          <div className="tab-content">
            <TranscriptManager />
          </div>
        )}

        {activeTab === 'speakers' && (
          <div className="tab-content">
            <SpeakerIdentification 
              participants={participants}
              isActive={isTranscribing}
            />
          </div>
        )}

        {activeTab === 'agenda' && (
          <div className="tab-content">
            <AgendaIntegration 
              meetingInfo={meetingInfo}
            />
          </div>
        )}
      </main>

      {/* Panels */}
      <ConfigurationPanel
        isOpen={showConfigPanel}
        onClose={() => setShowConfigPanel(false)}
      />

      <DiagnosticPanel
        isOpen={showDiagnosticPanel}
        onClose={() => setShowDiagnosticPanel(false)}
      />

      <HelpPanel
        isOpen={showHelpPanel}
        onClose={() => setShowHelpPanel(false)}
        platform={currentPlatform}
        platformCapabilities={platformCapabilities}
      />
      
      <PerformanceOptimizationPanel
        isVisible={showPerformancePanel}
        onClose={() => setShowPerformancePanel(false)}
      />

      <NotificationSystem />
    </div>
  );
};

export default PluginInterface;