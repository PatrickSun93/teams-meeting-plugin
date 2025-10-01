/**
 * Zoom Meeting Interface Component
 * Zoom-specific UI for meeting transcription controls
 */

import React, { useState, useEffect, useRef } from 'react';
import './ZoomMeetingInterface.css';

const ZoomMeetingInterface = ({ 
  zoomAdapter,
  transcriptionEngine,
  summaryService,
  onTranscriptionStart,
  onTranscriptionStop,
  onError
}) => {
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [meetingInfo, setMeetingInfo] = useState(null);
  const [participants, setParticipants] = useState([]);
  const [transcript, setTranscript] = useState([]);
  const [isMinimized, setIsMinimized] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState('disconnected');
  const [isHost, setIsHost] = useState(false);
  
  const transcriptRef = useRef(null);

  useEffect(() => {
    initializeZoomInterface();
    return () => cleanup();
  }, []);

  useEffect(() => {
    // Auto-scroll transcript to bottom
    if (transcriptRef.current) {
      transcriptRef.current.scrollTop = transcriptRef.current.scrollHeight;
    }
  }, [transcript]);

  const initializeZoomInterface = async () => {
    try {
      setConnectionStatus('connecting');
      
      // Initialize Zoom adapter
      await zoomAdapter.initialize();
      
      // Get meeting information
      const meeting = await zoomAdapter.getMeetingInfo();
      setMeetingInfo(meeting);
      
      // Check if user is host
      const hostStatus = await zoomAdapter.isHost();
      setIsHost(hostStatus);
      
      // Get initial participants
      const participantList = await zoomAdapter.getParticipants();
      setParticipants(participantList);
      
      setConnectionStatus('connected');
      
      // Set up event listeners
      setupEventListeners();
      
    } catch (error) {
      console.error('Failed to initialize Zoom interface:', error);
      setConnectionStatus('error');
      onError?.(error);
    }
  };

  const setupEventListeners = () => {
    // Listen for participant changes
    zoomAdapter.on('participantJoined', handleParticipantJoined);
    zoomAdapter.on('participantLeft', handleParticipantLeft);
    zoomAdapter.on('meetingEnded', handleMeetingEnded);
    
    // Listen for transcription events
    transcriptionEngine.on('transcriptionResult', handleTranscriptionResult);
    transcriptionEngine.on('transcriptionError', handleTranscriptionError);
  };

  const cleanup = () => {
    // Remove event listeners
    zoomAdapter.off('participantJoined', handleParticipantJoined);
    zoomAdapter.off('participantLeft', handleParticipantLeft);
    zoomAdapter.off('meetingEnded', handleMeetingEnded);
    
    transcriptionEngine.off('transcriptionResult', handleTranscriptionResult);
    transcriptionEngine.off('transcriptionError', handleTranscriptionError);
  };

  const handleStartTranscription = async () => {
    try {
      setIsTranscribing(true);
      
      // Get audio stream from Zoom
      const audioStream = await zoomAdapter.getAudioStream();
      
      // Start transcription
      await transcriptionEngine.startTranscription(audioStream);
      
      onTranscriptionStart?.();
      
    } catch (error) {
      console.error('Failed to start transcription:', error);
      setIsTranscribing(false);
      onError?.(error);
    }
  };

  const handleStopTranscription = async () => {
    try {
      await transcriptionEngine.stopTranscription();
      setIsTranscribing(false);
      
      // Generate and send summary if enabled
      if (transcript.length > 0) {
        await generateAndSendSummary();
      }
      
      onTranscriptionStop?.();
      
    } catch (error) {
      console.error('Failed to stop transcription:', error);
      onError?.(error);
    }
  };

  const generateAndSendSummary = async () => {
    try {
      // Get meeting agenda if available
      const agenda = await zoomAdapter.getMeetingAgenda();
      
      // Generate summary
      const summary = await summaryService.generateSummary(
        transcript,
        agenda,
        meetingInfo
      );
      
      // Send to Zoom chat if supported
      const capabilities = zoomAdapter.getCapabilities();
      if (capabilities.chatIntegration) {
        await zoomAdapter.sendMessageToChat(
          `📝 Meeting Summary:\n\n${summary}`
        );
      }
      
    } catch (error) {
      console.error('Failed to generate summary:', error);
    }
  };

  const handleParticipantJoined = (participant) => {
    setParticipants(prev => [...prev, participant]);
  };

  const handleParticipantLeft = (participantId) => {
    setParticipants(prev => prev.filter(p => p.id !== participantId));
  };

  const handleMeetingEnded = () => {
    if (isTranscribing) {
      handleStopTranscription();
    }
  };

  const handleTranscriptionResult = (result) => {
    const newSegment = {
      id: Date.now(),
      timestamp: new Date(),
      speaker: result.speaker || 'Unknown',
      text: result.text,
      confidence: result.confidence
    };
    
    setTranscript(prev => [...prev, newSegment]);
  };

  const handleTranscriptionError = (error) => {
    console.error('Transcription error:', error);
    onError?.(error);
  };

  const handleSendTranscriptToChat = async () => {
    try {
      const formattedTranscript = formatTranscriptForChat();
      await zoomAdapter.sendMessageToChat(formattedTranscript);
    } catch (error) {
      console.error('Failed to send transcript to chat:', error);
      onError?.(error);
    }
  };

  const formatTranscriptForChat = () => {
    const header = `📝 Meeting Transcript - ${new Date().toLocaleString()}\n\n`;
    const content = transcript
      .map(segment => `${segment.speaker}: ${segment.text}`)
      .join('\n');
    
    return header + content;
  };

  const renderConnectionStatus = () => {
    const statusConfig = {
      connecting: { icon: '🔄', text: 'Connecting...', class: 'connecting' },
      connected: { icon: '✅', text: 'Connected', class: 'connected' },
      error: { icon: '❌', text: 'Connection Error', class: 'error' },
      disconnected: { icon: '⚪', text: 'Disconnected', class: 'disconnected' }
    };
    
    const config = statusConfig[connectionStatus];
    
    return (
      <div className={`zoom-connection-status ${config.class}`}>
        <span className="status-icon">{config.icon}</span>
        <span className="status-text">{config.text}</span>
      </div>
    );
  };

  const renderMeetingInfo = () => {
    if (!meetingInfo) return null;
    
    return (
      <div className="zoom-meeting-info">
        <h3>{meetingInfo.topic}</h3>
        <div className="meeting-details">
          <span>Meeting ID: {meetingInfo.id}</span>
          <span>Participants: {participants.length}</span>
          {isHost && <span className="host-badge">Host</span>}
        </div>
      </div>
    );
  };

  const renderTranscriptionControls = () => (
    <div className="zoom-transcription-controls">
      {!isTranscribing ? (
        <button 
          className="zoom-control-button start"
          onClick={handleStartTranscription}
          disabled={connectionStatus !== 'connected'}
        >
          <span className="button-icon">🎤</span>
          Start Transcription
        </button>
      ) : (
        <button 
          className="zoom-control-button stop"
          onClick={handleStopTranscription}
        >
          <span className="button-icon">⏹️</span>
          Stop Transcription
        </button>
      )}
      
      {transcript.length > 0 && (
        <button 
          className="zoom-control-button secondary"
          onClick={handleSendTranscriptToChat}
          disabled={!zoomAdapter.getCapabilities().chatIntegration}
        >
          <span className="button-icon">💬</span>
          Send to Chat
        </button>
      )}
    </div>
  );

  const renderTranscript = () => (
    <div className="zoom-transcript-container">
      <div className="transcript-header">
        <h4>Live Transcript</h4>
        <div className="transcript-controls">
          <button 
            className="transcript-control"
            onClick={() => setTranscript([])}
            title="Clear transcript"
          >
            🗑️
          </button>
        </div>
      </div>
      
      <div className="transcript-content" ref={transcriptRef}>
        {transcript.length === 0 ? (
          <div className="transcript-empty">
            {isTranscribing ? 'Listening for speech...' : 'Start transcription to see live text'}
          </div>
        ) : (
          transcript.map(segment => (
            <div key={segment.id} className="transcript-segment">
              <div className="segment-header">
                <span className="speaker-name">{segment.speaker}</span>
                <span className="segment-time">
                  {segment.timestamp.toLocaleTimeString()}
                </span>
                <span className={`confidence-indicator ${getConfidenceClass(segment.confidence)}`}>
                  {Math.round(segment.confidence * 100)}%
                </span>
              </div>
              <div className="segment-text">{segment.text}</div>
            </div>
          ))
        )}
      </div>
    </div>
  );

  const renderParticipants = () => (
    <div className="zoom-participants">
      <h4>Participants ({participants.length})</h4>
      <div className="participants-list">
        {participants.map(participant => (
          <div key={participant.id} className="participant-item">
            <span className="participant-name">{participant.name}</span>
            {participant.isHost && <span className="host-indicator">Host</span>}
            {participant.isMuted && <span className="mute-indicator">🔇</span>}
          </div>
        ))}
      </div>
    </div>
  );

  const getConfidenceClass = (confidence) => {
    if (confidence >= 0.8) return 'high';
    if (confidence >= 0.6) return 'medium';
    return 'low';
  };

  if (isMinimized) {
    return (
      <div className="zoom-interface minimized">
        <div className="minimized-header" onClick={() => setIsMinimized(false)}>
          <span>Meeting Transcription</span>
          <span className={`status-dot ${connectionStatus}`}></span>
        </div>
      </div>
    );
  }

  return (
    <div className="zoom-meeting-interface">
      <div className="zoom-interface-header">
        <div className="header-left">
          <h2>Meeting Transcription Pro</h2>
          {renderConnectionStatus()}
        </div>
        <div className="header-controls">
          <button 
            className="header-button"
            onClick={() => setShowSettings(!showSettings)}
            title="Settings"
          >
            ⚙️
          </button>
          <button 
            className="header-button"
            onClick={() => setIsMinimized(true)}
            title="Minimize"
          >
            ➖
          </button>
        </div>
      </div>

      <div className="zoom-interface-content">
        {renderMeetingInfo()}
        {renderTranscriptionControls()}
        
        <div className="zoom-main-content">
          <div className="transcript-section">
            {renderTranscript()}
          </div>
          
          <div className="sidebar-section">
            {renderParticipants()}
          </div>
        </div>
      </div>

      {showSettings && (
        <div className="zoom-settings-overlay">
          <div className="settings-panel">
            <h3>Transcription Settings</h3>
            {/* Settings content would go here */}
            <button onClick={() => setShowSettings(false)}>Close</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ZoomMeetingInterface;