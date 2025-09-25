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
import useConfiguration from '../hooks/useConfiguration.js';
import { errorHandler } from '../services/ErrorHandler.js';
import './PluginInterface.css';

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

  // Navigation tabs
  const tabs = [
    { id: 'meeting', label: 'Meeting', icon: '🎤' },
    { id: 'transcription', label: 'Transcription', icon: '📝' },
    { id: 'summary', label: 'Summary', icon: '📋' },
    { id: 'history', label: 'History', icon: '📚' },
    { id: 'speakers', label: 'Speakers', icon: '👥' },
    { id: 'agenda', label: 'Agenda', icon: '📅' }
  ];

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
    <div className="plugin-interface">
      {/* Header */}
      <header className="plugin-header">
        <div className="header-content">
          <div className="header-title">
            <h1>🎤 Meeting Transcription</h1>
            <p>Real-time transcription and AI summaries</p>
          </div>
          <div className="header-actions">
            <button 
              className="action-button"
              onClick={() => setShowConfigPanel(true)}
              title="Settings"
            >
              ⚙️
            </button>
            <button 
              className="action-button"
              onClick={() => setShowDiagnosticPanel(true)}
              title="Diagnostics"
            >
              🔧
            </button>
            <button 
              className="action-button"
              onClick={() => setShowHelpPanel(true)}
              title="Help"
            >
              ❓
            </button>
            
            <button 
              className="action-button"
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
        {tabs.map(tab => (
          <button
            key={tab.id}
            className={`nav-tab ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            <span className="tab-icon">{tab.icon}</span>
            <span className="tab-label">{tab.label}</span>
          </button>
        ))}
      </nav>

      {/* Main Content */}
      <main className="plugin-content">
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

            {getPlatformCapabilities && (
              <div className="platform-capabilities">
                <h3>Platform Capabilities</h3>
                <div className="capabilities-grid">
                  {Object.entries(getPlatformCapabilities()).map(([key, value]) => (
                    <div key={key} className="capability-item">
                      <span className="capability-name">{key}</span>
                      <span className={`capability-value ${
                        value === true ? 'supported' : 
                        value === false ? 'unsupported' : 'info'
                      }`}>
                        {value === true ? '✅' : value === false ? '❌' : value}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
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