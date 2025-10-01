const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // Configuration
  getConfig: () => ipcRenderer.invoke('get-config'),
  saveConfig: (config) => ipcRenderer.invoke('save-config', config),

  // Platform detection
  detectPlatform: () => ipcRenderer.invoke('detect-platform'),
  getAvailablePlatforms: () => ipcRenderer.invoke('get-available-platforms'),
  setManualPlatform: (platform) => ipcRenderer.invoke('set-manual-platform', platform),

  // Audio capture
  startAudioCapture: () => ipcRenderer.invoke('start-audio-capture'),
  stopAudioCapture: () => ipcRenderer.invoke('stop-audio-capture'),
  getAudioDevices: () => ipcRenderer.invoke('get-audio-devices'),

  // Screen analysis
  startScreenAnalysis: () => ipcRenderer.invoke('start-screen-analysis'),
  stopScreenAnalysis: () => ipcRenderer.invoke('stop-screen-analysis'),

  // Meeting control
  startMeetingTranscription: (options) => ipcRenderer.invoke('start-meeting-transcription', options),
  stopMeetingTranscription: () => ipcRenderer.invoke('stop-meeting-transcription'),

  // Export
  exportTranscript: (options) => ipcRenderer.invoke('export-transcript', options),

  // Meeting history
  getMeetingHistory: () => ipcRenderer.invoke('get-meeting-history'),
  deleteMeeting: (meetingId) => ipcRenderer.invoke('delete-meeting', meetingId),

  // System
  showInFolder: (filePath) => ipcRenderer.invoke('show-in-folder', filePath),
  openExternal: (url) => ipcRenderer.invoke('open-external', url),
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),

  // Event listeners
  onTranscriptUpdate: (callback) => {
    ipcRenderer.on('transcript-update', (event, transcript) => callback(transcript));
  },
  onMenuAction: (action, callback) => {
    ipcRenderer.on(`menu-${action}`, callback);
  },
  onUpdateAvailable: (callback) => {
    ipcRenderer.on('update-available', callback);
  },
  onUpdateDownloaded: (callback) => {
    ipcRenderer.on('update-downloaded', callback);
  },
  onOpenMeeting: (callback) => {
    ipcRenderer.on('open-meeting', (event, meetingId) => callback(meetingId));
  },

  // Remove listeners
  removeAllListeners: (channel) => {
    ipcRenderer.removeAllListeners(channel);
  }
});