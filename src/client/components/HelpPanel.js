// Help Panel Component - User guides and documentation
import React, { useState } from 'react';
import PlatformHelp from './PlatformHelp.js';
import { MeetingPlatform } from '../services/PlatformAdapter.js';
import './HelpPanel.css';

const HelpPanel = ({ 
  isOpen, 
  onClose, 
  platform = MeetingPlatform.UNKNOWN, 
  platformCapabilities = null 
}) => {
  const [activeSection, setActiveSection] = useState('platform-guide');

  const helpSections = [
    {
      id: 'platform-guide',
      title: 'Platform Guide',
      icon: '🎯',
      content: (
        <PlatformHelp 
          platform={platform} 
          capabilities={platformCapabilities} 
        />
      )
    },
    {
      id: 'getting-started',
      title: 'Getting Started',
      icon: '🚀',
      content: (
        <div className="help-content">
          <h3>Welcome to Meeting Transcription</h3>
          <p>This plugin provides real-time transcription and AI-powered summaries for your meetings across multiple platforms.</p>
          
          <h4>Quick Start Guide</h4>
          <ol>
            <li><strong>Join a meeting</strong> - The plugin will automatically detect your meeting platform</li>
            <li><strong>Configure settings</strong> - Click the ⚙️ button to set up your preferred transcription service</li>
            <li><strong>Start transcription</strong> - Use the platform-appropriate controls to begin</li>
            <li><strong>View results</strong> - Watch real-time transcription and get AI summaries</li>
          </ol>
          
          <div className="help-note">
            <strong>Note:</strong> Available features depend on your meeting platform. Check the Platform Guide for specific capabilities.
          </div>
        </div>
      )
    },
    {
      id: 'configuration',
      title: 'Configuration',
      icon: '⚙️',
      content: (
        <div className="help-content">
          <h3>Plugin Configuration</h3>
          
          <h4>Transcription Services</h4>
          <ul>
            <li><strong>Local STT:</strong> Uses Whisper.js for privacy-focused transcription</li>
            <li><strong>OpenAI Whisper:</strong> Cloud-based high-accuracy transcription</li>
            <li><strong>Azure Speech:</strong> Enterprise-grade speech recognition</li>
            <li><strong>Claude:</strong> Anthropic's speech processing service</li>
          </ul>
          
          <h4>AI Summary Services</h4>
          <ul>
            <li><strong>OpenAI GPT:</strong> Advanced text summarization</li>
            <li><strong>Claude:</strong> Conversation analysis and summaries</li>
            <li><strong>Azure OpenAI:</strong> Enterprise AI services</li>
          </ul>
          
          <h4>API Keys</h4>
          <p>For cloud services, you'll need to provide API keys:</p>
          <ul>
            <li>OpenAI: Get from <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer">OpenAI Platform</a></li>
            <li>Azure: Configure in Azure Portal</li>
            <li>Claude: Get from Anthropic Console</li>
          </ul>
          
          <div className="help-warning">
            <strong>Privacy:</strong> When using cloud services, audio data is sent to external providers. Use local STT for maximum privacy.
          </div>
        </div>
      )
    },
    {
      id: 'features',
      title: 'Features',
      icon: '✨',
      content: (
        <div className="help-content">
          <h3>Plugin Features</h3>
          
          <h4>Real-time Transcription</h4>
          <ul>
            <li>Live speech-to-text conversion</li>
            <li>Speaker identification and labeling</li>
            <li>Confidence scoring for accuracy</li>
            <li>Multi-language support</li>
          </ul>
          
          <h4>AI-Powered Summaries</h4>
          <ul>
            <li>Automatic meeting summaries</li>
            <li>Action item extraction</li>
            <li>Key decision highlights</li>
            <li>Custom prompt support</li>
          </ul>
          
          <h4>Teams Integration</h4>
          <ul>
            <li>Automatic chat posting</li>
            <li>Meeting agenda integration</li>
            <li>Participant detection</li>
            <li>Host controls</li>
          </ul>
          
          <h4>Transcript Management</h4>
          <ul>
            <li>Local storage and encryption</li>
            <li>Export to PDF, Word, or text</li>
            <li>Search and filter history</li>
            <li>Sharing and collaboration</li>
          </ul>
        </div>
      )
    },
    {
      id: 'troubleshooting',
      title: 'Troubleshooting',
      icon: '🔧',
      content: (
        <div className="help-content">
          <h3>Common Issues</h3>
          
          <h4>Transcription Not Starting</h4>
          <ul>
            <li>Ensure you're the meeting host</li>
            <li>Check microphone permissions</li>
            <li>Verify configuration settings</li>
            <li>Check API key validity</li>
          </ul>
          
          <h4>Poor Audio Quality</h4>
          <ul>
            <li>Check microphone settings</li>
            <li>Reduce background noise</li>
            <li>Ensure stable internet connection</li>
            <li>Try different transcription service</li>
          </ul>
          
          <h4>Missing Transcripts</h4>
          <ul>
            <li>Check local storage permissions</li>
            <li>Verify meeting was properly recorded</li>
            <li>Look in transcript history tab</li>
            <li>Check browser storage limits</li>
          </ul>
          
          <h4>Chat Integration Issues</h4>
          <ul>
            <li>Verify Teams permissions</li>
            <li>Check if chat is restricted</li>
            <li>Try manual export instead</li>
            <li>Contact meeting organizer</li>
          </ul>
          
          <div className="help-tip">
            <strong>Tip:</strong> Use the Diagnostics panel (🔧) to check system status and run tests.
          </div>
        </div>
      )
    },
    {
      id: 'privacy',
      title: 'Privacy & Security',
      icon: '🔒',
      content: (
        <div className="help-content">
          <h3>Privacy & Security</h3>
          
          <h4>Data Processing</h4>
          <ul>
            <li><strong>Local Processing:</strong> When using local STT, audio never leaves your device</li>
            <li><strong>Cloud Services:</strong> Audio is sent to configured cloud providers</li>
            <li><strong>Encryption:</strong> All stored data is encrypted locally</li>
            <li><strong>No Permanent Storage:</strong> Cloud providers don't store your audio</li>
          </ul>
          
          <h4>Data Storage</h4>
          <ul>
            <li>Transcripts stored locally in browser</li>
            <li>API keys encrypted in local storage</li>
            <li>No data sent to plugin servers</li>
            <li>User controls data retention</li>
          </ul>
          
          <h4>Permissions</h4>
          <ul>
            <li><strong>Microphone:</strong> Required for audio capture</li>
            <li><strong>Teams API:</strong> For meeting integration</li>
            <li><strong>Local Storage:</strong> For saving transcripts</li>
            <li><strong>Network:</strong> For cloud service APIs</li>
          </ul>
          
          <h4>Best Practices</h4>
          <ul>
            <li>Use local STT for sensitive meetings</li>
            <li>Regularly clear old transcripts</li>
            <li>Keep API keys secure</li>
            <li>Review privacy settings</li>
          </ul>
          
          <div className="help-security">
            <strong>Security:</strong> This plugin follows Microsoft Teams security guidelines and industry best practices.
          </div>
        </div>
      )
    },
    {
      id: 'keyboard-shortcuts',
      title: 'Keyboard Shortcuts',
      icon: '⌨️',
      content: (
        <div className="help-content">
          <h3>Keyboard Shortcuts</h3>
          
          <h4>Global Shortcuts</h4>
          <div className="shortcut-list">
            <div className="shortcut-item">
              <kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>T</kbd>
              <span>Toggle transcription (host only)</span>
            </div>
            <div className="shortcut-item">
              <kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>S</kbd>
              <span>Open settings</span>
            </div>
            <div className="shortcut-item">
              <kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>H</kbd>
              <span>Open help panel</span>
            </div>
            <div className="shortcut-item">
              <kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>D</kbd>
              <span>Open diagnostics</span>
            </div>
          </div>
          
          <h4>Navigation Shortcuts</h4>
          <div className="shortcut-list">
            <div className="shortcut-item">
              <kbd>1</kbd> - <kbd>6</kbd>
              <span>Switch between tabs</span>
            </div>
            <div className="shortcut-item">
              <kbd>Escape</kbd>
              <span>Close panels/modals</span>
            </div>
          </div>
          
          <h4>Transcription Shortcuts</h4>
          <div className="shortcut-list">
            <div className="shortcut-item">
              <kbd>Space</kbd>
              <span>Pause/resume transcription</span>
            </div>
            <div className="shortcut-item">
              <kbd>Ctrl</kbd> + <kbd>C</kbd>
              <span>Copy current transcript</span>
            </div>
            <div className="shortcut-item">
              <kbd>Ctrl</kbd> + <kbd>S</kbd>
              <span>Save transcript</span>
            </div>
          </div>
        </div>
      )
    }
  ];

  const currentSection = helpSections.find(section => section.id === activeSection);

  if (!isOpen) return null;

  return (
    <div className="help-panel-overlay">
      <div className="help-panel">
        <div className="help-header">
          <h2>Help & Documentation</h2>
          <button className="close-button" onClick={onClose}>×</button>
        </div>
        
        <div className="help-body">
          <nav className="help-navigation">
            {helpSections.map(section => (
              <button
                key={section.id}
                className={`help-nav-item ${activeSection === section.id ? 'active' : ''}`}
                onClick={() => setActiveSection(section.id)}
              >
                <span className="nav-icon">{section.icon}</span>
                <span className="nav-title">{section.title}</span>
              </button>
            ))}
          </nav>
          
          <div className="help-content-area">
            {currentSection && currentSection.content}
          </div>
        </div>
        
        <div className="help-footer">
          <p>Need more help? Check the <a href="#" onClick={(e) => { e.preventDefault(); setActiveSection('troubleshooting'); }}>troubleshooting guide</a> or contact support.</p>
        </div>
      </div>
    </div>
  );
};

export default HelpPanel;