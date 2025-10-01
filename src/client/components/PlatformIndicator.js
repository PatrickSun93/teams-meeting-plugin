/**
 * Platform Indicator Component
 * Shows current platform and its capabilities
 */

import React from 'react';
import { MeetingPlatform } from '../services/PlatformAdapter.js';
import './PlatformIndicator.css';

const PlatformIndicator = ({ 
  platform, 
  capabilities, 
  isActive = false, 
  showCapabilities = false,
  compact = false 
}) => {
  const getPlatformInfo = (platform) => {
    switch (platform) {
      case MeetingPlatform.TEAMS:
        return {
          name: 'Microsoft Teams',
          icon: '🟦',
          color: '#0078d4',
          shortName: 'Teams'
        };
      case MeetingPlatform.ZOOM:
        return {
          name: 'Zoom',
          icon: '🔵',
          color: '#2d8cff',
          shortName: 'Zoom'
        };
      case MeetingPlatform.GOOGLE_MEET:
        return {
          name: 'Google Meet',
          icon: '🟢',
          color: '#1a73e8',
          shortName: 'Meet'
        };
      case MeetingPlatform.WEBEX:
        return {
          name: 'Cisco Webex',
          icon: '🟠',
          color: '#00bceb',
          shortName: 'Webex'
        };
      default:
        return {
          name: 'Unknown Platform',
          icon: '⚪',
          color: '#6b7280',
          shortName: 'Generic'
        };
    }
  };

  const getCapabilityIcon = (capability, isSupported) => {
    if (isSupported === true) return '✅';
    if (isSupported === false) return '❌';
    return '⚠️'; // Limited support
  };

  const getCapabilityLabel = (key) => {
    const labels = {
      chatIntegration: 'Chat Integration',
      agendaAccess: 'Agenda Access',
      participantInfo: 'Participant Info',
      hostDetection: 'Host Detection',
      audioQuality: 'Audio Quality',
      meetingEvents: 'Meeting Events',
      recordingAccess: 'Recording Access'
    };
    return labels[key] || key;
  };

  const platformInfo = getPlatformInfo(platform);

  if (compact) {
    return (
      <div className={`platform-indicator compact ${isActive ? 'active' : ''}`}>
        <span className="platform-icon">{platformInfo.icon}</span>
        <span className="platform-name">{platformInfo.shortName}</span>
        {isActive && <span className="status-dot"></span>}
      </div>
    );
  }

  return (
    <div className={`platform-indicator ${isActive ? 'active' : ''}`}>
      <div className="platform-header">
        <div className="platform-info">
          <span className="platform-icon">{platformInfo.icon}</span>
          <div className="platform-details">
            <span className="platform-name">{platformInfo.name}</span>
            {isActive && (
              <span className="platform-status">Connected</span>
            )}
          </div>
        </div>
        {isActive && <div className="connection-indicator"></div>}
      </div>

      {showCapabilities && capabilities && (
        <div className="platform-capabilities">
          <h4>Platform Capabilities</h4>
          <div className="capabilities-list">
            {Object.entries(capabilities).map(([key, value]) => (
              <div key={key} className="capability-item">
                <span className="capability-icon">
                  {getCapabilityIcon(key, value)}
                </span>
                <span className="capability-label">
                  {getCapabilityLabel(key)}
                </span>
                <span className={`capability-status ${
                  value === true ? 'supported' : 
                  value === false ? 'unsupported' : 'limited'
                }`}>
                  {value === true ? 'Supported' : 
                   value === false ? 'Not Available' : 
                   typeof value === 'string' ? value : 'Limited'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default PlatformIndicator;