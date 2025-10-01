/**
 * Background Service Worker for Google Meet Extension
 * Handles extension lifecycle, storage, and API communications
 */

import { CalendarAPIService } from './calendar-api.js';

class BackgroundService {
  constructor() {
    this.calendarAPI = new CalendarAPIService();
    this.activeMeetings = new Map();
    this.setupEventListeners();
  }

  setupEventListeners() {
    // Extension installation
    chrome.runtime.onInstalled.addListener(this.handleInstalled.bind(this));
    
    // Tab updates to detect Meet pages
    chrome.tabs.onUpdated.addListener(this.handleTabUpdated.bind(this));
    
    // Messages from content scripts
    chrome.runtime.onMessage.addListener(this.handleMessage.bind(this));
    
    // Storage changes
    chrome.storage.onChanged.addListener(this.handleStorageChanged.bind(this));
  }

  async handleInstalled(details) {
    console.log('Extension installed:', details);
    
    // Initialize default settings
    await chrome.storage.sync.set({
      extensionEnabled: true,
      sttProvider: 'local_whisper',
      aiProvider: 'openai_gpt',
      autoStartTranscription: false,
      showConfidenceScores: true,
      exportFormat: 'pdf'
    });
  }

  async handleTabUpdated(tabId, changeInfo, tab) {
    if (changeInfo.status === 'complete' && tab.url?.includes('meet.google.com')) {
      console.log('Google Meet tab detected:', tab.url);
      
      // Inject content scripts if not already injected
      try {
        await chrome.scripting.executeScript({
          target: { tabId },
          files: ['content-scripts/meet-detector.js']
        });
      } catch (error) {
        console.log('Content script already injected or failed:', error);
      }
    }
  }

  async handleMessage(message, sender, sendResponse) {
    console.log('Background received message:', message);

    switch (message.type) {
      case 'MEETING_DETECTED':
        return this.handleMeetingDetected(message.data, sender.tab);
      
      case 'MEETING_ENDED':
        return this.handleMeetingEnded(message.data, sender.tab);
      
      case 'GET_MEETING_AGENDA':
        return this.getMeetingAgenda(message.data);
      
      case 'SAVE_TRANSCRIPT':
        return this.saveTranscript(message.data);
      
      case 'GET_CONFIGURATION':
        return this.getConfiguration();
      
      case 'UPDATE_CONFIGURATION':
        return this.updateConfiguration(message.data);
      
      case 'EXPORT_TRANSCRIPT':
        return this.exportTranscript(message.data);
      
      case 'SAVE_TO_DRIVE':
        return this.saveToGoogleDrive(message.data);
      
      case 'GET_PARTICIPANTS':
        return this.getParticipants(message.data);
      
      default:
        console.warn('Unknown message type:', message.type);
        return { success: false, error: 'Unknown message type' };
    }
  }

  async handleMeetingDetected(meetingData, tab) {
    console.log('Meeting detected:', meetingData);
    
    const meetingInfo = {
      id: meetingData.meetingId,
      url: tab.url,
      title: meetingData.title || 'Google Meet',
      startTime: new Date(),
      tabId: tab.id
    };

    this.activeMeetings.set(meetingData.meetingId, meetingInfo);
    
    // Try to get agenda from Google Calendar
    try {
      const agenda = await this.calendarAPI.getMeetingAgenda(meetingData.meetingId);
      meetingInfo.agenda = agenda;
    } catch (error) {
      console.log('Could not fetch agenda:', error);
    }

    return { success: true, meetingInfo };
  }

  async handleMeetingEnded(meetingData, tab) {
    console.log('Meeting ended:', meetingData);
    
    const meetingInfo = this.activeMeetings.get(meetingData.meetingId);
    if (meetingInfo) {
      meetingInfo.endTime = new Date();
      this.activeMeetings.delete(meetingData.meetingId);
    }

    return { success: true };
  }

  async getMeetingAgenda(meetingId) {
    try {
      const agenda = await this.calendarAPI.getMeetingAgenda(meetingId);
      return { success: true, agenda };
    } catch (error) {
      console.error('Failed to get meeting agenda:', error);
      return { success: false, error: error.message };
    }
  }

  async saveTranscript(transcriptData) {
    try {
      const timestamp = new Date().toISOString();
      const storageKey = `transcript_${transcriptData.meetingId}_${timestamp}`;
      
      await chrome.storage.local.set({
        [storageKey]: {
          ...transcriptData,
          savedAt: timestamp
        }
      });

      return { success: true, storageKey };
    } catch (error) {
      console.error('Failed to save transcript:', error);
      return { success: false, error: error.message };
    }
  }

  async getConfiguration() {
    try {
      const config = await chrome.storage.sync.get();
      return { success: true, config };
    } catch (error) {
      console.error('Failed to get configuration:', error);
      return { success: false, error: error.message };
    }
  }

  async updateConfiguration(newConfig) {
    try {
      await chrome.storage.sync.set(newConfig);
      return { success: true };
    } catch (error) {
      console.error('Failed to update configuration:', error);
      return { success: false, error: error.message };
    }
  }

  handleStorageChanged(changes, namespace) {
    console.log('Storage changed:', changes, namespace);
    
    // Notify content scripts of configuration changes
    Object.keys(changes).forEach(key => {
      if (key.startsWith('stt') || key.startsWith('ai') || key === 'extensionEnabled') {
        this.notifyContentScripts('CONFIG_CHANGED', { key, change: changes[key] });
      }
    });
  }

  async exportTranscript(data) {
    try {
      const { transcript, format = 'txt' } = data;
      
      // Create downloadable file
      const content = this.formatTranscriptForExport(transcript, format);
      const filename = this.generateTranscriptFilename(transcript, format);
      
      // Create blob URL and trigger download
      const blob = new Blob([content], { type: this.getMimeTypeForFormat(format) });
      const url = URL.createObjectURL(blob);
      
      // Use Chrome downloads API
      await chrome.downloads.download({
        url: url,
        filename: filename,
        saveAs: true
      });
      
      return { success: true, filename };
    } catch (error) {
      console.error('Failed to export transcript:', error);
      return { success: false, error: error.message };
    }
  }

  async saveToGoogleDrive(data) {
    try {
      const { transcript } = data;
      const driveAPI = this.calendarAPI.getDriveAPI();
      
      const result = await driveAPI.saveTranscript(transcript, 'txt');
      return result;
    } catch (error) {
      console.error('Failed to save to Google Drive:', error);
      return { success: false, error: error.message };
    }
  }

  async getParticipants(data) {
    try {
      // Get participants from active meeting tabs
      const tabs = await chrome.tabs.query({ url: 'https://meet.google.com/*' });
      const participants = [];
      
      for (const tab of tabs) {
        try {
          const response = await chrome.tabs.sendMessage(tab.id, { 
            type: 'GET_PARTICIPANTS' 
          });
          
          if (response && response.participants) {
            participants.push(...response.participants);
          }
        } catch (error) {
          console.log('Failed to get participants from tab:', tab.id);
        }
      }
      
      return { success: true, participants };
    } catch (error) {
      console.error('Failed to get participants:', error);
      return { success: false, error: error.message };
    }
  }

  formatTranscriptForExport(transcript, format) {
    switch (format) {
      case 'json':
        return JSON.stringify(transcript, null, 2);
      case 'csv':
        return this.formatTranscriptAsCSV(transcript);
      case 'txt':
      default:
        return this.formatTranscriptAsText(transcript);
    }
  }

  formatTranscriptAsText(transcript) {
    const lines = [];
    
    if (transcript.meetingInfo) {
      lines.push(`Meeting: ${transcript.meetingInfo.title || 'Google Meet'}`);
      lines.push(`Date: ${new Date(transcript.meetingInfo.startTime).toLocaleString()}`);
      lines.push(`Platform: Google Meet`);
      lines.push('');
    }
    
    if (transcript.segments && transcript.segments.length > 0) {
      lines.push('Transcript:');
      lines.push('----------');
      
      transcript.segments.forEach(segment => {
        const timestamp = new Date(segment.startTime).toLocaleTimeString();
        const speaker = segment.speakerId || 'Unknown Speaker';
        lines.push(`[${timestamp}] ${speaker}: ${segment.text}`);
      });
    }
    
    return lines.join('\n');
  }

  formatTranscriptAsCSV(transcript) {
    const lines = [];
    lines.push('Timestamp,Speaker,Text,Confidence');
    
    if (transcript.segments && transcript.segments.length > 0) {
      transcript.segments.forEach(segment => {
        const timestamp = new Date(segment.startTime).toISOString();
        const speaker = (segment.speakerId || 'Unknown Speaker').replace(/"/g, '""');
        const text = (segment.text || '').replace(/"/g, '""');
        const confidence = segment.confidence || '';
        
        lines.push(`"${timestamp}","${speaker}","${text}","${confidence}"`);
      });
    }
    
    return lines.join('\n');
  }

  generateTranscriptFilename(transcript, format) {
    const date = new Date();
    const dateStr = date.toISOString().split('T')[0];
    const timeStr = date.toTimeString().split(' ')[0].replace(/:/g, '-');
    
    const meetingId = transcript.meetingInfo?.id || 'meeting';
    return `transcript-${meetingId}-${dateStr}-${timeStr}.${format}`;
  }

  getMimeTypeForFormat(format) {
    const mimeTypes = {
      'txt': 'text/plain',
      'json': 'application/json',
      'csv': 'text/csv'
    };
    
    return mimeTypes[format] || 'text/plain';
  }

  async notifyContentScripts(type, data) {
    const tabs = await chrome.tabs.query({ url: 'https://meet.google.com/*' });
    
    tabs.forEach(tab => {
      chrome.tabs.sendMessage(tab.id, { type, data }).catch(error => {
        console.log('Failed to notify content script:', error);
      });
    });
  }
}

// Initialize background service
const backgroundService = new BackgroundService();

export default backgroundService;