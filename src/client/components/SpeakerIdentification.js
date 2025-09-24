// Speaker Identification Component - UI for managing speaker identification
import React, { useState, useEffect, useCallback } from 'react';
import SpeakerIdentificationService from '../services/SpeakerIdentificationService.js';
import './SpeakerIdentification.css';

const SpeakerIdentification = ({ 
  audioProcessor, 
  isActive = false, 
  onSpeakerIdentified,
  onSpeakerChanged 
}) => {
  const [speakerService] = useState(() => new SpeakerIdentificationService());
  const [isInitialized, setIsInitialized] = useState(false);
  const [currentSpeaker, setCurrentSpeaker] = useState(null);
  const [speakerProfiles, setSpeakerProfiles] = useState([]);
  const [unknownSpeakers, setUnknownSpeakers] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [confidence, setConfidence] = useState(0);
  const [showEnrollment, setShowEnrollment] = useState(false);
  const [enrollmentData, setEnrollmentData] = useState({
    speakerId: '',
    speakerName: '',
    audioSamples: [],
    isRecording: false,
    recordingDuration: 0
  });
  const [status, setStatus] = useState({
    speakerCount: 0,
    unknownSpeakerCount: 0,
    historyLength: 0
  });

  // Initialize speaker identification service
  useEffect(() => {
    const initializeService = async () => {
      try {
        await speakerService.initialize();
        setIsInitialized(true);
        updateStatus();
        loadSpeakerProfiles();
      } catch (error) {
        console.error('Failed to initialize speaker identification:', error);
      }
    };

    initializeService();

    return () => {
      speakerService.cleanup();
    };
  }, [speakerService]);

  // Set up event listeners
  useEffect(() => {
    if (!isInitialized) return;

    const handleSpeakerIdentified = (data) => {
      setCurrentSpeaker(data);
      setConfidence(data.confidence);
      setIsProcessing(false);
      
      if (onSpeakerIdentified) {
        onSpeakerIdentified(data);
      }
    };

    const handleSpeakerChanged = (data) => {
      console.log(`Speaker changed: ${data.previousSpeaker} -> ${data.currentSpeaker}`);
      
      if (onSpeakerChanged) {
        onSpeakerChanged(data);
      }
    };

    const handleNewSpeakerDetected = (data) => {
      console.log(`New speaker detected: ${data.speakerId}`);
      setUnknownSpeakers(prev => [...prev, data]);
    };

    const handleSpeakerEnrolled = (data) => {
      console.log(`Speaker enrolled: ${data.speakerId}`);
      loadSpeakerProfiles();
      updateStatus();
      
      // Remove from unknown speakers if it was there
      setUnknownSpeakers(prev => prev.filter(s => s.speakerId !== data.speakerId));
    };

    speakerService.addEventListener('speakerIdentified', handleSpeakerIdentified);
    speakerService.addEventListener('speakerChanged', handleSpeakerChanged);
    speakerService.addEventListener('newSpeakerDetected', handleNewSpeakerDetected);
    speakerService.addEventListener('speakerEnrolled', handleSpeakerEnrolled);

    return () => {
      speakerService.removeEventListener('speakerIdentified', handleSpeakerIdentified);
      speakerService.removeEventListener('speakerChanged', handleSpeakerChanged);
      speakerService.removeEventListener('newSpeakerDetected', handleNewSpeakerDetected);
      speakerService.removeEventListener('speakerEnrolled', handleSpeakerEnrolled);
    };
  }, [isInitialized, onSpeakerIdentified, onSpeakerChanged, speakerService]);

  // Handle audio data from AudioProcessor
  useEffect(() => {
    if (!audioProcessor || !isActive || !isInitialized) return;

    const handleAudioData = async (audioData) => {
      if (isProcessing) return;
      
      setIsProcessing(true);
      
      try {
        await speakerService.identifySpeaker(audioData);
      } catch (error) {
        console.error('Speaker identification failed:', error);
        setIsProcessing(false);
      }
    };

    audioProcessor.addEventListener('audioReady', handleAudioData);

    return () => {
      audioProcessor.removeEventListener('audioReady', handleAudioData);
    };
  }, [audioProcessor, isActive, isInitialized, isProcessing, speakerService]);

  // Load speaker profiles
  const loadSpeakerProfiles = useCallback(() => {
    const profiles = speakerService.getAllSpeakerProfiles();
    setSpeakerProfiles(profiles);
  }, [speakerService]);

  // Update status
  const updateStatus = useCallback(() => {
    const serviceStatus = speakerService.getStatus();
    setStatus({
      speakerCount: serviceStatus.speakerCount,
      unknownSpeakerCount: serviceStatus.unknownSpeakerCount,
      historyLength: serviceStatus.historyLength
    });
  }, [speakerService]);

  // Handle speaker enrollment
  const handleEnrollSpeaker = async () => {
    if (!enrollmentData.speakerId || enrollmentData.audioSamples.length === 0) {
      alert('Please provide speaker ID and record audio samples');
      return;
    }

    try {
      await speakerService.enrollSpeaker(
        enrollmentData.speakerId,
        enrollmentData.audioSamples,
        enrollmentData.speakerName || enrollmentData.speakerId
      );
      
      // Reset enrollment form
      setEnrollmentData({
        speakerId: '',
        speakerName: '',
        audioSamples: [],
        isRecording: false,
        recordingDuration: 0
      });
      
      setShowEnrollment(false);
      
    } catch (error) {
      console.error('Speaker enrollment failed:', error);
      alert(`Enrollment failed: ${error.message}`);
    }
  };

  // Start recording for enrollment
  const startEnrollmentRecording = () => {
    if (!audioProcessor) {
      alert('Audio processor not available');
      return;
    }

    setEnrollmentData(prev => ({
      ...prev,
      isRecording: true,
      recordingDuration: 0
    }));

    // Start collecting audio samples
    const audioSamples = [];
    const startTime = Date.now();

    const handleAudioForEnrollment = (audioData) => {
      audioSamples.push(audioData);
      const duration = Date.now() - startTime;
      
      setEnrollmentData(prev => ({
        ...prev,
        recordingDuration: duration,
        audioSamples: audioSamples
      }));
    };

    audioProcessor.addEventListener('audioReady', handleAudioForEnrollment);

    // Auto-stop after 10 seconds
    setTimeout(() => {
      stopEnrollmentRecording();
      audioProcessor.removeEventListener('audioReady', handleAudioForEnrollment);
    }, 10000);
  };

  // Stop recording for enrollment
  const stopEnrollmentRecording = () => {
    setEnrollmentData(prev => ({
      ...prev,
      isRecording: false
    }));
  };

  // Update speaker name
  const handleUpdateSpeakerName = (speakerId, newName) => {
    if (speakerService.updateSpeakerName(speakerId, newName)) {
      loadSpeakerProfiles();
    }
  };

  // Remove speaker
  const handleRemoveSpeaker = (speakerId) => {
    if (confirm(`Are you sure you want to remove speaker ${speakerId}?`)) {
      if (speakerService.removeSpeaker(speakerId)) {
        loadSpeakerProfiles();
        updateStatus();
      }
    }
  };

  // Clear all profiles
  const handleClearAllProfiles = () => {
    if (confirm('Are you sure you want to clear all speaker profiles? This cannot be undone.')) {
      speakerService.clearAllProfiles();
      loadSpeakerProfiles();
      updateStatus();
      setCurrentSpeaker(null);
      setUnknownSpeakers([]);
    }
  };

  // Get confidence color
  const getConfidenceColor = (confidence) => {
    if (confidence >= 0.8) return '#4CAF50'; // Green
    if (confidence >= 0.6) return '#FF9800'; // Orange
    return '#F44336'; // Red
  };

  if (!isInitialized) {
    return (
      <div className="speaker-identification loading">
        <div className="loading-spinner" data-testid="loading-spinner"></div>
        <p>Initializing speaker identification...</p>
      </div>
    );
  }

  return (
    <div className="speaker-identification">
      <div className="speaker-id-header">
        <h3>Speaker Identification</h3>
        <div className="speaker-id-status">
          <span className={`status-indicator ${isActive ? 'active' : 'inactive'}`}>
            {isActive ? 'Active' : 'Inactive'}
          </span>
        </div>
      </div>

      {/* Current Speaker Display */}
      <div className="current-speaker">
        <h4>Current Speaker</h4>
        {currentSpeaker ? (
          <div className="speaker-info">
            <div className="speaker-name">
              {currentSpeaker.speakerId}
              {currentSpeaker.isNewSpeaker && <span className="new-badge">NEW</span>}
            </div>
            <div className="confidence-bar">
              <div 
                className="confidence-fill"
                style={{ 
                  width: `${confidence * 100}%`,
                  backgroundColor: getConfidenceColor(confidence)
                }}
              ></div>
              <span className="confidence-text">
                {Math.round(confidence * 100)}% confidence
              </span>
            </div>
            {isProcessing && <div className="processing-indicator">Processing...</div>}
          </div>
        ) : (
          <div className="no-speaker">
            {isActive ? 'Listening for speakers...' : 'No active speaker detection'}
          </div>
        )}
      </div>

      {/* Speaker Statistics */}
      <div className="speaker-stats">
        <div className="stat-item">
          <span className="stat-label">Known Speakers:</span>
          <span className="stat-value">{status.speakerCount}</span>
        </div>
        <div className="stat-item">
          <span className="stat-label">Unknown Speakers:</span>
          <span className="stat-value">{status.unknownSpeakerCount}</span>
        </div>
      </div>

      {/* Speaker Management */}
      <div className="speaker-management">
        <div className="management-header">
          <h4>Speaker Management</h4>
          <button 
            className="btn-primary"
            onClick={() => setShowEnrollment(!showEnrollment)}
          >
            {showEnrollment ? 'Cancel' : 'Enroll Speaker'}
          </button>
        </div>

        {/* Enrollment Form */}
        {showEnrollment && (
          <div className="enrollment-form">
            <h5>Enroll New Speaker</h5>
            <div className="form-group">
              <label>Speaker ID:</label>
              <input
                type="text"
                value={enrollmentData.speakerId}
                onChange={(e) => setEnrollmentData(prev => ({
                  ...prev,
                  speakerId: e.target.value
                }))}
                placeholder="Enter unique speaker ID"
              />
            </div>
            <div className="form-group">
              <label>Speaker Name (optional):</label>
              <input
                type="text"
                value={enrollmentData.speakerName}
                onChange={(e) => setEnrollmentData(prev => ({
                  ...prev,
                  speakerName: e.target.value
                }))}
                placeholder="Enter speaker name"
              />
            </div>
            <div className="form-group">
              <label>Audio Recording:</label>
              <div className="recording-controls">
                {!enrollmentData.isRecording ? (
                  <button 
                    className="btn-record"
                    onClick={startEnrollmentRecording}
                    disabled={!audioProcessor}
                  >
                    Start Recording
                  </button>
                ) : (
                  <button 
                    className="btn-stop"
                    onClick={stopEnrollmentRecording}
                  >
                    Stop Recording ({Math.round(enrollmentData.recordingDuration / 1000)}s)
                  </button>
                )}
                <span className="recording-info">
                  {enrollmentData.audioSamples.length} samples collected
                </span>
              </div>
            </div>
            <div className="form-actions">
              <button 
                className="btn-primary"
                onClick={handleEnrollSpeaker}
                disabled={!enrollmentData.speakerId || enrollmentData.audioSamples.length === 0}
              >
                Enroll Speaker
              </button>
              <button 
                className="btn-secondary"
                onClick={() => setShowEnrollment(false)}
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Known Speakers List */}
        <div className="speakers-list">
          <h5>Known Speakers ({speakerProfiles.length})</h5>
          {speakerProfiles.length === 0 ? (
            <p className="no-speakers">No speakers enrolled yet</p>
          ) : (
            <div className="speakers-grid">
              {speakerProfiles.map(profile => (
                <div key={profile.id} className="speaker-card">
                  <div className="speaker-card-header">
                    <span className="speaker-id">{profile.id}</span>
                    <span className="speaker-name">{profile.name}</span>
                  </div>
                  <div className="speaker-card-info">
                    <div className="info-item">
                      <span>Samples: {profile.sampleCount}</span>
                    </div>
                    <div className="info-item">
                      <span>Enrolled: {new Date(profile.enrollmentDate).toLocaleDateString()}</span>
                    </div>
                  </div>
                  <div className="speaker-card-actions">
                    <button 
                      className="btn-edit"
                      onClick={() => {
                        const newName = prompt('Enter new name:', profile.name);
                        if (newName && newName !== profile.name) {
                          handleUpdateSpeakerName(profile.id, newName);
                        }
                      }}
                    >
                      Edit
                    </button>
                    <button 
                      className="btn-remove"
                      onClick={() => handleRemoveSpeaker(profile.id)}
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Unknown Speakers */}
        {unknownSpeakers.length > 0 && (
          <div className="unknown-speakers">
            <h5>Unknown Speakers ({unknownSpeakers.length})</h5>
            <div className="unknown-speakers-list">
              {unknownSpeakers.map(speaker => (
                <div key={speaker.speakerId} className="unknown-speaker-item">
                  <span className="unknown-speaker-id">{speaker.speakerId}</span>
                  <button 
                    className="btn-enroll-unknown"
                    onClick={() => {
                      const speakerName = prompt(`Enter name for ${speaker.speakerId}:`);
                      if (speakerName) {
                        setEnrollmentData({
                          speakerId: speaker.speakerId,
                          speakerName: speakerName,
                          audioSamples: [{ data: speaker.voiceFeatures }],
                          isRecording: false,
                          recordingDuration: 0
                        });
                        handleEnrollSpeaker();
                      }
                    }}
                  >
                    Enroll
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Management Actions */}
        <div className="management-actions">
          <button 
            className="btn-danger"
            onClick={handleClearAllProfiles}
          >
            Clear All Profiles
          </button>
        </div>
      </div>
    </div>
  );
};

export default SpeakerIdentification;