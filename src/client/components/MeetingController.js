// Meeting Controller - Orchestrates meeting detection and transcription workflow
import React, { useState, useEffect, useCallback } from 'react';
import TeamsAdapter from '../../teams/teamsAdapter.js';

const MeetingController = ({ onMeetingStateChange, onError }) => {
  const [teamsAdapter, setTeamsAdapter] = useState(null);
  const [meetingInfo, setMeetingInfo] = useState(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isHost, setIsHost] = useState(false);
  const [participants, setParticipants] = useState([]);
  const [meetingState, setMeetingState] = useState('unknown');
  const [error, setError] = useState(null);

  // Initialize Teams adapter
  useEffect(() => {
    const initializeTeams = async () => {
      try {
        const adapter = new TeamsAdapter();
        await adapter.initialize();
        
        setTeamsAdapter(adapter);
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

    initializeTeams();

    // Cleanup on unmount
    return () => {
      if (teamsAdapter) {
        teamsAdapter.cleanup();
      }
    };
  }, []);

  // Handle meeting state changes
  const handleMeetingStateChange = useCallback((event) => {
    console.log('Meeting state changed:', event);
    
    setMeetingState(event.newState);
    
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
  }, [teamsAdapter, onMeetingStateChange]);

  // Start transcription (placeholder)
  const startTranscription = useCallback(async () => {
    if (!teamsAdapter || !isHost) {
      const errorMsg = !teamsAdapter ? 'Teams not initialized' : 'Only meeting host can start transcription';
      setError(errorMsg);
      return { success: false, error: errorMsg };
    }

    try {
      console.log('Starting transcription...');
      
      // Request audio access
      const audioStream = await teamsAdapter.requestAudioAccess();
      console.log('Audio access granted for transcription');
      
      // TODO: Implement actual transcription logic in future tasks
      
      return { success: true, message: 'Transcription started' };
    } catch (error) {
      console.error('Failed to start transcription:', error);
      setError(error.message);
      return { success: false, error: error.message };
    }
  }, [teamsAdapter, isHost]);

  // Stop transcription (placeholder)
  const stopTranscription = useCallback(() => {
    if (!teamsAdapter || !isHost) {
      const errorMsg = !teamsAdapter ? 'Teams not initialized' : 'Only meeting host can stop transcription';
      setError(errorMsg);
      return { success: false, error: errorMsg };
    }

    try {
      console.log('Stopping transcription...');
      
      // TODO: Implement actual transcription stop logic in future tasks
      
      return { success: true, message: 'Transcription stopped' };
    } catch (error) {
      console.error('Failed to stop transcription:', error);
      setError(error.message);
      return { success: false, error: error.message };
    }
  }, [teamsAdapter, isHost]);

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

  return {
    // State
    isInitialized,
    meetingInfo,
    isHost,
    participants,
    meetingState,
    error,
    
    // Methods
    startTranscription,
    stopTranscription,
    getPlatformCapabilities,
    refreshMeetingInfo,
    
    // Teams adapter reference (for advanced usage)
    teamsAdapter
  };
};

export default MeetingController;