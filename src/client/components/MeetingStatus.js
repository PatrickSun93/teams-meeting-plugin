// Meeting Status Component - Displays current meeting information and participants
import React from 'react';
import './MeetingStatus.css';

const MeetingStatus = ({ meetingInfo, participants, isHost, meetingState }) => {
  const formatTime = (date) => {
    if (!date) return 'Unknown';
    return new Date(date).toLocaleTimeString();
  };

  const getMeetingStateDisplay = (state) => {
    switch (state) {
      case 'active':
        return { text: 'Active Meeting', icon: '🟢', className: 'active' };
      case 'ended':
        return { text: 'Meeting Ended', icon: '🔴', className: 'ended' };
      default:
        return { text: 'No Meeting', icon: '⚪', className: 'unknown' };
    }
  };

  const stateDisplay = getMeetingStateDisplay(meetingState);

  if (!meetingInfo || meetingState === 'unknown') {
    return (
      <div className="meeting-status no-meeting">
        <div className="status-header">
          <span className="status-icon">⚪</span>
          <h3>No Active Meeting</h3>
        </div>
        <p>Join a Teams meeting to use the transcription plugin</p>
      </div>
    );
  }

  return (
    <div className="meeting-status">
      <div className="status-header">
        <span className={`status-icon ${stateDisplay.className}`}>
          {stateDisplay.icon}
        </span>
        <div className="meeting-title">
          <h3>{meetingInfo.title || 'Teams Meeting'}</h3>
          <span className="meeting-state">{stateDisplay.text}</span>
        </div>
      </div>

      <div className="meeting-details">
        <div className="detail-item">
          <span className="label">Meeting ID:</span>
          <span className="value">{meetingInfo.id}</span>
        </div>
        
        <div className="detail-item">
          <span className="label">Started:</span>
          <span className="value">{formatTime(meetingInfo.startTime)}</span>
        </div>
        
        <div className="detail-item">
          <span className="label">Platform:</span>
          <span className="value">Microsoft Teams</span>
        </div>
        
        <div className="detail-item">
          <span className="label">Your Role:</span>
          <span className={`value role ${isHost ? 'host' : 'participant'}`}>
            {isHost ? '👑 Host' : '👤 Participant'}
          </span>
        </div>
      </div>

      {participants && participants.length > 0 && (
        <div className="participants-section">
          <h4>Participants ({participants.length})</h4>
          <div className="participants-list">
            {participants.map((participant, index) => (
              <div key={participant.id || index} className="participant-item">
                <span className="participant-name">
                  {participant.name || 'Unknown User'}
                </span>
                <div className="participant-badges">
                  {participant.isCurrentUser && (
                    <span className="badge current-user">You</span>
                  )}
                  {participant.role === 'host' && (
                    <span className="badge host">Host</span>
                  )}
                  {participant.role === 'organizer' && (
                    <span className="badge organizer">Organizer</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="capabilities-info">
        <small>
          ℹ️ Plugin supports real-time transcription, speaker identification, and AI summaries
        </small>
      </div>
    </div>
  );
};

export default MeetingStatus;