// Meeting Controller - Orchestrates meeting detection and transcription workflow
import React, { useState, useEffect, useCallback } from 'react';
import TeamsAdapter from '../../teams/teamsAdapter.js';
import AudioProcessor from './AudioProcessor.js';

const MeetingController = ({ onMeetingStateChange, onError }) => {
  const [teamsAdapter, setTeamsAdapter] = useState(null);
  const [audioProcessor, setAudioProcessor] = useState(null);
  const [meetingInfo, setMeetingInfo] = useState(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isHost, setIsHost] = useState(false);
  const [participants, setParticipants] = useState([]);
  const [meetingState, setMeetingState] = useState('unknown');
  const [error, setError] = useState(null);
  const [audioStream, setAudioStream] = useState(null);
  const [audioQuality, setAudioQuality] = useState(null);
  const [isAudioCapturing, setIsAudioCapturing] = useState(false);

  // Initialize Teams adapter and audio processor
  useEffect(() => {
    const initializeComponents = async () => {
      try {
        // Initialize Teams adapter
        const adapter = new TeamsAdapter();
        await adapter.initialize();
        setTeamsAdapter(adapter);
        
        // Initialize audio processor
        const processor = new AudioProcessor();
        await processor.initialize();
        setAudioProcessor(processor);
        
        // Set up audio processor event listeners
        processor.addEventListener('qualityUpdate', handleAudioQualityUpdate);
        processor.addEventListener('audioReady', handleAudioReady);
        processor.addEventListener('captureStarted', handleAudioCaptureStarted);
        processor.addEventListener('captureStopped', handleAudioCaptureStopped);
        
        setIsInitialized(true);
        
        // Get initial meeting information
        const info = adapter.getMeetingInfo();
        setMeetingInfo(info);
        setIsHost(info.isHost);
        setParticipants(info.participants);
        setMeetingState(info.state);
        
        // Set up meeting state change listener
        adapter.addEventListener('meetingStateChange', handleMeetingStateChange);
        
        console.log('Meeting controller initialized successfully');
      } catch (error) {
        console.error('Failed to initialize meeting controller:', error);
        setError(error.message);
        if (onError) {
          onError(error);
        }
      }
    };

    initializeComponents();

    // Cleanup on unmount
    return () => {
      if (teamsAdapter) {
        teamsAdapter.cleanup();
      }
      if (audioProcessor) {
        audioProcessor.cleanup();
      }
      if (audioStream) {
        audioStream.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  // Handle meeting state changes
  const handleMeetingStateChange = useCallback((event) => {
    console.log('Meeting state changed:', event);
    
    setMeetingState(event.newState);
    
    // Stop audio capture if meeting ends
    if (event.newState === 'ended' && isAudioCapturing) {
      stopAudioCapture();
    }
    
    if (teamsAdapter) {
      const info = teamsAdapter.getMeetingInfo();
      setMeetingInfo(info);
      setIsHost(info.isHost);
      setParticipants(info.participants);
    }
    
    // Notify parent component
    if (onMeetingStateChange) {
      onMeetingStateChange(event);
    }
  }, [teamsAdapter, onMeetingStateChange, isAudioCapturing]);

  // Handle audio quality updates
  const handleAudioQualityUpdate = useCallback((qualityMetrics) => {
    setAudioQuality(qualityMetrics);
    
    // Log quality issues
    if (!audioProcessor?.isQualitySufficient()) {
      console.warn('Audio quality insufficient:', qualityMetrics);
    }
  }, [audioProcessor]);

  // Handle audio ready for processing
  const handleAudioReady = useCallback((audioSegment) => {
    console.log('Audio segment ready for transcription:', {
      duration: audioSegment.duration,
      sampleRate: audioSegment.sampleRate,
      dataLength: audioSegment.data.length
    });
    
    // TODO: Send to transcription engine in future tasks
  }, []);

  // Handle audio capture started
  const handleAudioCaptureStarted = useCallback((event) => {
    console.log('Audio capture started:', event);
    setIsAudioCapturing(true);
  }, []);

  // Handle audio capture stopped
  const handleAudioCaptureStopped = useCallback((event) => {
    console.log('Audio capture stopped:', event);
    setIsAudioCapturing(false);
  }, []);

  // Start audio capture
  const startAudioCapture = useCallback(async () => {
    if (!teamsAdapter || !audioProcessor) {
      const errorMsg = 'Components not initialized';
      setError(errorMsg);
      return { success: false, error: errorMsg };
    }

    if (isAudioCapturing) {
      return { success: true, message: 'Audio capture already active' };
    }

    try {
      console.log('Starting audio capture...');
      
      // Request audio access from Teams
      const stream = await teamsAdapter.requestAudioAccess();
      setAudioStream(stream);
      
      // Start audio processing
      await audioProcessor.startCapture(stream);
      
      console.log('Audio capture started successfully');
      return { success: true, message: 'Audio capture started' };
    } catch (error) {
      console.error('Failed to start audio capture:', error);
      setError(error.message);
      return { success: false, error: error.message };
    }
  }, [teamsAdapter, audioProcessor, isAudioCapturing]);

  // Stop audio capture
  const stopAudioCapture = useCallback(async () => {
    if (!audioProcessor) {
      const errorMsg = 'Audio processor not initialized';
      setError(errorMsg);
      return { success: false, error: errorMsg };
    }

    if (!isAudioCapturing) {
      return { success: true, message: 'Audio capture not active' };
    }

    try {
      console.log('Stopping audio capture...');
      
      // Stop audio processing
      audioProcessor.stopCapture();
      
      // Stop audio stream
      if (audioStream) {
        audioStream.getTracks().forEach(track => track.stop());
        setAudioStream(null);
      }
      
      console.log('Audio capture stopped successfully');
      return { success: true, message: 'Audio capture stopped' };
    } catch (error) {
      console.error('Failed to stop audio capture:', error);
      setError(error.message);
      return { success: false, error: error.message };
    }
  }, [audioProcessor, audioStream, isAudioCapturing]);

  // Start transcription (now includes audio capture)
  const startTranscription = useCallback(async () => {
    if (!teamsAdapter || !isHost) {
      const errorMsg = !teamsAdapter ? 'Teams not initialized' : 'Only meeting host can start transcription';
      setError(errorMsg);
      return { success: false, error: errorMsg };
    }

    try {
      console.log('Starting transcription...');
      
      // Start audio capture first
      const audioResult = await startAudioCapture();
      if (!audioResult.success) {
        return audioResult;
      }
      
      // TODO: Start actual transcription engine in future tasks
      
      return { success: true, message: 'Transcription started with audio capture' };
    } catch (error) {
      console.error('Failed to start transcription:', error);
      setError(error.message);
      return { success: false, error: error.message };
    }
  }, [teamsAdapter, isHost, startAudioCapture]);

  // Stop transcription (now includes audio capture)
  const stopTranscription = useCallback(async () => {
    if (!teamsAdapter || !isHost) {
      const errorMsg = !teamsAdapter ? 'Teams not initialized' : 'Only meeting host can stop transcription';
      setError(errorMsg);
      return { success: false, error: errorMsg };
    }

    try {
      console.log('Stopping transcription...');
      
      // Stop audio capture
      const audioResult = await stopAudioCapture();
      if (!audioResult.success) {
        console.warn('Audio capture stop failed:', audioResult.error);
      }
      
      // TODO: Stop actual transcription engine in future tasks
      
      return { success: true, message: 'Transcription stopped' };
    } catch (error) {
      console.error('Failed to stop transcription:', error);
      setError(error.message);
      return { success: false, error: error.message };
    }
  }, [teamsAdapter, isHost, stopAudioCapture]);

  // Get platform capabilities
  const getPlatformCapabilities = useCallback(() => {
    return teamsAdapter ? teamsAdapter.getPlatformCapabilities() : null;
  }, [teamsAdapter]);

  // Refresh meeting information
  const refreshMeetingInfo = useCallback(async () => {
    if (!teamsAdapter) return;

    try {
      await teamsAdapter.detectMeetingState();
      const info = teamsAdapter.getMeetingInfo();
      setMeetingInfo(info);
      setIsHost(info.isHost);
      setParticipants(info.participants);
      setMeetingState(info.state);
    } catch (error) {
      console.error('Failed to refresh meeting info:', error);
      setError(error.message);
    }
  }, [teamsAdapter]);

  // Get audio processor status
  const getAudioStatus = useCallback(() => {
    return audioProcessor ? audioProcessor.getStatus() : null;
  }, [audioProcessor]);

  // Get audio quality metrics
  const getAudioQuality = useCallback(() => {
    return audioQuality;
  }, [audioQuality]);

  // Get audio segment for processing
  const getAudioSegment = useCallback((duration) => {
    return audioProcessor ? audioProcessor.getAudioSegment(duration) : null;
  }, [audioProcessor]);

  return {
    // State
    isInitialized,
    meetingInfo,
    isHost,
    participants,
    meetingState,
    error,
    isAudioCapturing,
    audioQuality,
    
    // Methods
    startTranscription,
    stopTranscription,
    startAudioCapture,
    stopAudioCapture,
    getPlatformCapabilities,
    refreshMeetingInfo,
    getAudioStatus,
    getAudioQuality,
    getAudioSegment,
    
    // Component references (for advanced usage)
    teamsAdapter,
    audioProcessor
  };
};

export default MeetingController;