/**
 * Platform-Specific Help Component
 * Provides platform-specific documentation and guides
 */

import React from 'react';
import { MeetingPlatform } from '../services/PlatformAdapter.js';
import './PlatformHelp.css';

const PlatformHelp = ({ platform, capabilities }) => {
  const getPlatformSpecificHelp = () => {
    switch (platform) {
      case MeetingPlatform.TEAMS:
        return {
          title: 'Microsoft Teams Integration',
          description: 'This plugin integrates natively with Microsoft Teams to provide real-time transcription.',
          features: [
            {
              name: 'Native Integration',
              description: 'Full access to Teams meeting APIs and audio streams',
              available: true
            },
            {
              name: 'Chat Integration',
              description: 'Automatically post transcripts and summaries to meeting chat',
              available: capabilities?.chatIntegration === true
            },
            {
              name: 'Agenda Access',
              description: 'Access meeting agenda from Microsoft Calendar',
              available: capabilities?.agendaAccess === true
            },
            {
              name: 'Host Controls',
              description: 'Meeting hosts can control transcription for all participants',
              available: capabilities?.hostDetection === true
            }
          ],
          setup: [
            'Install the Teams app through sideloading or your organization\'s app catalog',
            'Grant necessary permissions when prompted',
            'Configure your preferred STT and AI services in settings',
            'Start transcription from the meeting controls'
          ],
          troubleshooting: [
            {
              issue: 'Cannot access meeting audio',
              solution: 'Ensure microphone permissions are granted and you\'re in an active meeting'
            },
            {
              issue: 'Transcripts not appearing in chat',
              solution: 'Check that you have permission to send messages in the meeting chat'
            },
            {
              issue: 'Plugin not loading',
              solution: 'Verify the app is properly installed and enabled in Teams settings'
            }
          ]
        };

      case MeetingPlatform.ZOOM:
        return {
          title: 'Zoom Integration',
          description: 'Integration with Zoom meetings through the Zoom Web SDK and App Marketplace.',
          features: [
            {
              name: 'Web SDK Integration',
              description: 'Access to Zoom meeting audio and participant information',
              available: true
            },
            {
              name: 'Chat Integration',
              description: 'Send transcripts to Zoom meeting chat',
              available: capabilities?.chatIntegration === true
            },
            {
              name: 'Participant Info',
              description: 'Access to participant names and meeting roles',
              available: capabilities?.participantInfo === true
            },
            {
              name: 'Recording Integration',
              description: 'Access to Zoom cloud recordings for post-meeting processing',
              available: capabilities?.recordingAccess === true
            }
          ],
          setup: [
            'Install the Zoom app from the Zoom App Marketplace',
            'Authorize the app to access your Zoom account',
            'Join a Zoom meeting where the app is enabled',
            'Configure transcription settings and start recording'
          ],
          troubleshooting: [
            {
              issue: 'App not appearing in Zoom',
              solution: 'Ensure the app is installed and enabled in your Zoom account settings'
            },
            {
              issue: 'Audio capture issues',
              solution: 'Check browser permissions and ensure you\'re using a supported browser'
            },
            {
              issue: 'Cannot send to chat',
              solution: 'Verify you have chat permissions in the meeting'
            }
          ]
        };

      case MeetingPlatform.GOOGLE_MEET:
        return {
          title: 'Google Meet Integration',
          description: 'Browser extension integration with Google Meet for transcription and export.',
          features: [
            {
              name: 'Browser Extension',
              description: 'Chrome/Firefox extension for Google Meet integration',
              available: true
            },
            {
              name: 'Audio Capture',
              description: 'Capture meeting audio through browser APIs',
              available: true
            },
            {
              name: 'Calendar Integration',
              description: 'Access meeting agenda from Google Calendar',
              available: capabilities?.agendaAccess === true
            },
            {
              name: 'Export Options',
              description: 'Export transcripts as files (no native chat integration)',
              available: true
            }
          ],
          setup: [
            'Install the browser extension from Chrome Web Store or Firefox Add-ons',
            'Grant necessary permissions for Google Meet and Calendar access',
            'Join a Google Meet meeting',
            'Click the extension icon to start transcription'
          ],
          troubleshooting: [
            {
              issue: 'Extension not working',
              solution: 'Refresh the Google Meet page and ensure the extension is enabled'
            },
            {
              issue: 'No audio detected',
              solution: 'Check browser microphone permissions and meeting audio settings'
            },
            {
              issue: 'Cannot access calendar',
              solution: 'Ensure you\'ve granted Google Calendar permissions to the extension'
            }
          ]
        };

      default:
        return {
          title: 'Generic Platform Support',
          description: 'Universal desktop application for unsupported platforms.',
          features: [
            {
              name: 'System Audio Capture',
              description: 'Capture audio from any meeting platform using system audio',
              available: true
            },
            {
              name: 'Manual Export',
              description: 'Export transcripts as files for manual sharing',
              available: true
            },
            {
              name: 'Local Processing',
              description: 'All processing done locally for maximum privacy',
              available: true
            }
          ],
          setup: [
            'Download and install the desktop application',
            'Configure system audio routing (may require virtual audio cable)',
            'Start the application before joining any meeting',
            'Manually start/stop transcription as needed'
          ],
          troubleshooting: [
            {
              issue: 'No audio detected',
              solution: 'Check system audio settings and virtual audio cable configuration'
            },
            {
              issue: 'Poor transcription quality',
              solution: 'Ensure good microphone setup and minimize background noise'
            }
          ]
        };
    }
  };

  const helpData = getPlatformSpecificHelp();

  return (
    <div className="platform-help platform-component">
      <div className="help-header">
        <h2>{helpData.title}</h2>
        <p className="platform-text-secondary">{helpData.description}</p>
      </div>

      <div className="help-section">
        <h3>Available Features</h3>
        <div className="features-list">
          {helpData.features.map((feature, index) => (
            <div key={index} className={`feature-item ${feature.available ? 'available' : 'unavailable'}`}>
              <div className="feature-header">
                <span className="feature-icon">
                  {feature.available ? '✅' : '❌'}
                </span>
                <span className="feature-name">{feature.name}</span>
              </div>
              <p className="feature-description platform-text-secondary">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </div>

      <div className="help-section">
        <h3>Setup Instructions</h3>
        <ol className="setup-steps">
          {helpData.setup.map((step, index) => (
            <li key={index} className="setup-step">
              {step}
            </li>
          ))}
        </ol>
      </div>

      {helpData.troubleshooting && (
        <div className="help-section">
          <h3>Troubleshooting</h3>
          <div className="troubleshooting-list">
            {helpData.troubleshooting.map((item, index) => (
              <div key={index} className="troubleshooting-item platform-surface">
                <h4 className="issue-title">{item.issue}</h4>
                <p className="solution-text platform-text-secondary">{item.solution}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="help-section">
        <h3>Additional Resources</h3>
        <div className="resources-list">
          <a href="#" className="resource-link platform-button">
            📖 User Guide
          </a>
          <a href="#" className="resource-link platform-button">
            🎥 Video Tutorials
          </a>
          <a href="#" className="resource-link platform-button">
            ❓ FAQ
          </a>
          <a href="#" className="resource-link platform-button">
            🐛 Report Issue
          </a>
        </div>
      </div>
    </div>
  );
};

export default PlatformHelp;