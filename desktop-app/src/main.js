const { app, BrowserWindow, ipcMain, dialog, Menu, shell, screen } = require('electron');
const { autoUpdater } = require('electron-updater');
const Store = require('electron-store');
const path = require('path');
const fs = require('fs');

const AudioCaptureManager = require('./services/AudioCaptureManager');
const ScreenAnalyzer = require('./services/ScreenAnalyzer');
const PlatformDetector = require('./services/PlatformDetector');
const TranscriptionService = require('./services/TranscriptionService');
const ConfigurationManager = require('./services/ConfigurationManager');

class DesktopApp {
  constructor() {
    this.mainWindow = null;
    this.store = new Store();
    this.audioCapture = new AudioCaptureManager();
    this.screenAnalyzer = new ScreenAnalyzer();
    this.platformDetector = new PlatformDetector();
    this.transcriptionService = new TranscriptionService();
    this.configManager = new ConfigurationManager();
    this.isRecording = false;
    this.currentMeeting = null;
  }

  async initialize() {
    await app.whenReady();
    this.createMainWindow();
    this.setupIpcHandlers();
    this.setupMenu();
    this.setupAutoUpdater();
    
    // Initialize services
    await this.audioCapture.initialize();
    await this.screenAnalyzer.initialize();
    await this.transcriptionService.initialize();
  }

  createMainWindow() {
    const { width, height } = screen.getPrimaryDisplay().workAreaSize;
    
    this.mainWindow = new BrowserWindow({
      width: Math.min(1200, width * 0.8),
      height: Math.min(800, height * 0.8),
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: path.join(__dirname, 'preload.js')
      },
      icon: path.join(__dirname, '../assets/icon.png'),
      show: false,
      titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default'
    });

    // Load the renderer
    this.mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));

    // Show window when ready
    this.mainWindow.once('ready-to-show', () => {
      this.mainWindow.show();
      
      if (process.env.NODE_ENV === 'development') {
        this.mainWindow.webContents.openDevTools();
      }
    });

    // Handle window closed
    this.mainWindow.on('closed', () => {
      this.mainWindow = null;
    });

    // Handle window minimize to tray (optional)
    this.mainWindow.on('minimize', (event) => {
      if (this.store.get('minimizeToTray', false)) {
        event.preventDefault();
        this.mainWindow.hide();
      }
    });
  }

  setupIpcHandlers() {
    // Configuration handlers
    ipcMain.handle('get-config', () => {
      return this.configManager.getConfig();
    });

    ipcMain.handle('save-config', async (event, config) => {
      return await this.configManager.saveConfig(config);
    });

    // Platform detection handlers
    ipcMain.handle('detect-platform', async () => {
      return await this.platformDetector.detectCurrentPlatform();
    });

    ipcMain.handle('get-available-platforms', () => {
      return this.platformDetector.getAvailablePlatforms();
    });

    ipcMain.handle('set-manual-platform', (event, platform) => {
      return this.platformDetector.setManualPlatform(platform);
    });

    // Audio capture handlers
    ipcMain.handle('start-audio-capture', async () => {
      try {
        await this.audioCapture.startCapture();
        return { success: true };
      } catch (error) {
        return { success: false, error: error.message };
      }
    });

    ipcMain.handle('stop-audio-capture', async () => {
      try {
        await this.audioCapture.stopCapture();
        return { success: true };
      } catch (error) {
        return { success: false, error: error.message };
      }
    });

    ipcMain.handle('get-audio-devices', async () => {
      return await this.audioCapture.getAvailableDevices();
    });

    // Screen analysis handlers
    ipcMain.handle('start-screen-analysis', async () => {
      try {
        await this.screenAnalyzer.startAnalysis();
        return { success: true };
      } catch (error) {
        return { success: false, error: error.message };
      }
    });

    ipcMain.handle('stop-screen-analysis', async () => {
      try {
        await this.screenAnalyzer.stopAnalysis();
        return { success: true };
      } catch (error) {
        return { success: false, error: error.message };
      }
    });

    // Meeting control handlers
    ipcMain.handle('start-meeting-transcription', async (event, options) => {
      try {
        this.isRecording = true;
        this.currentMeeting = {
          id: Date.now().toString(),
          startTime: new Date(),
          platform: options.platform || 'unknown',
          transcript: []
        };

        // Start audio capture
        await this.audioCapture.startCapture();
        
        // Start screen analysis if enabled
        if (options.enableScreenAnalysis) {
          await this.screenAnalyzer.startAnalysis();
        }

        // Start transcription
        await this.transcriptionService.startTranscription({
          meetingId: this.currentMeeting.id,
          audioSource: this.audioCapture,
          onTranscript: (transcript) => {
            this.currentMeeting.transcript.push(transcript);
            this.mainWindow.webContents.send('transcript-update', transcript);
          }
        });

        return { success: true, meetingId: this.currentMeeting.id };
      } catch (error) {
        this.isRecording = false;
        return { success: false, error: error.message };
      }
    });

    ipcMain.handle('stop-meeting-transcription', async () => {
      try {
        this.isRecording = false;
        
        if (this.currentMeeting) {
          this.currentMeeting.endTime = new Date();
          
          // Stop services
          await this.audioCapture.stopCapture();
          await this.screenAnalyzer.stopAnalysis();
          await this.transcriptionService.stopTranscription();

          // Save meeting data
          const meetingData = { ...this.currentMeeting };
          this.store.set(`meetings.${meetingData.id}`, meetingData);

          this.currentMeeting = null;
          return { success: true, meeting: meetingData };
        }

        return { success: true };
      } catch (error) {
        return { success: false, error: error.message };
      }
    });

    // Export handlers
    ipcMain.handle('export-transcript', async (event, options) => {
      try {
        const { filePath } = await dialog.showSaveDialog(this.mainWindow, {
          title: 'Export Transcript',
          defaultPath: `transcript-${new Date().toISOString().split('T')[0]}.${options.format}`,
          filters: [
            { name: 'Text Files', extensions: ['txt'] },
            { name: 'JSON Files', extensions: ['json'] },
            { name: 'PDF Files', extensions: ['pdf'] },
            { name: 'Word Documents', extensions: ['docx'] }
          ]
        });

        if (filePath) {
          await this.exportTranscript(options.meetingId, filePath, options.format);
          return { success: true, filePath };
        }

        return { success: false, error: 'Export cancelled' };
      } catch (error) {
        return { success: false, error: error.message };
      }
    });

    // Meeting history handlers
    ipcMain.handle('get-meeting-history', () => {
      const meetings = this.store.get('meetings', {});
      return Object.values(meetings).sort((a, b) => new Date(b.startTime) - new Date(a.startTime));
    });

    ipcMain.handle('delete-meeting', (event, meetingId) => {
      this.store.delete(`meetings.${meetingId}`);
      return { success: true };
    });

    // System handlers
    ipcMain.handle('show-in-folder', (event, filePath) => {
      shell.showItemInFolder(filePath);
    });

    ipcMain.handle('open-external', (event, url) => {
      shell.openExternal(url);
    });

    ipcMain.handle('get-app-version', () => {
      return app.getVersion();
    });

    ipcMain.handle('check-for-updates', () => {
      autoUpdater.checkForUpdatesAndNotify();
    });
  }

  setupMenu() {
    const template = [
      {
        label: 'File',
        submenu: [
          {
            label: 'New Meeting',
            accelerator: 'CmdOrCtrl+N',
            click: () => {
              this.mainWindow.webContents.send('menu-new-meeting');
            }
          },
          {
            label: 'Open Recent',
            submenu: this.getRecentMeetingsMenu()
          },
          { type: 'separator' },
          {
            label: 'Export...',
            accelerator: 'CmdOrCtrl+E',
            click: () => {
              this.mainWindow.webContents.send('menu-export');
            }
          },
          { type: 'separator' },
          {
            label: 'Quit',
            accelerator: process.platform === 'darwin' ? 'Cmd+Q' : 'Ctrl+Q',
            click: () => {
              app.quit();
            }
          }
        ]
      },
      {
        label: 'Meeting',
        submenu: [
          {
            label: 'Start Recording',
            accelerator: 'CmdOrCtrl+R',
            click: () => {
              this.mainWindow.webContents.send('menu-start-recording');
            }
          },
          {
            label: 'Stop Recording',
            accelerator: 'CmdOrCtrl+S',
            click: () => {
              this.mainWindow.webContents.send('menu-stop-recording');
            }
          },
          { type: 'separator' },
          {
            label: 'Platform Settings',
            click: () => {
              this.mainWindow.webContents.send('menu-platform-settings');
            }
          }
        ]
      },
      {
        label: 'View',
        submenu: [
          { role: 'reload' },
          { role: 'forceReload' },
          { role: 'toggleDevTools' },
          { type: 'separator' },
          { role: 'resetZoom' },
          { role: 'zoomIn' },
          { role: 'zoomOut' },
          { type: 'separator' },
          { role: 'togglefullscreen' }
        ]
      },
      {
        label: 'Help',
        submenu: [
          {
            label: 'About',
            click: () => {
              this.showAboutDialog();
            }
          },
          {
            label: 'Documentation',
            click: () => {
              shell.openExternal('https://github.com/your-org/meeting-transcription/docs');
            }
          },
          {
            label: 'Check for Updates',
            click: () => {
              autoUpdater.checkForUpdatesAndNotify();
            }
          }
        ]
      }
    ];

    const menu = Menu.buildFromTemplate(template);
    Menu.setApplicationMenu(menu);
  }

  getRecentMeetingsMenu() {
    const meetings = this.store.get('meetings', {});
    const recentMeetings = Object.values(meetings)
      .sort((a, b) => new Date(b.startTime) - new Date(a.startTime))
      .slice(0, 5);

    if (recentMeetings.length === 0) {
      return [{ label: 'No recent meetings', enabled: false }];
    }

    return recentMeetings.map(meeting => ({
      label: `${meeting.platform} - ${new Date(meeting.startTime).toLocaleDateString()}`,
      click: () => {
        this.mainWindow.webContents.send('open-meeting', meeting.id);
      }
    }));
  }

  setupAutoUpdater() {
    autoUpdater.checkForUpdatesAndNotify();

    autoUpdater.on('update-available', () => {
      this.mainWindow.webContents.send('update-available');
    });

    autoUpdater.on('update-downloaded', () => {
      this.mainWindow.webContents.send('update-downloaded');
    });

    autoUpdater.on('error', (error) => {
      console.error('Auto-updater error:', error);
    });
  }

  async exportTranscript(meetingId, filePath, format) {
    const meeting = this.store.get(`meetings.${meetingId}`);
    if (!meeting) {
      throw new Error('Meeting not found');
    }

    const transcript = meeting.transcript.map(t => `${t.speaker}: ${t.text}`).join('\n');
    
    switch (format) {
      case 'txt':
        fs.writeFileSync(filePath, transcript);
        break;
      case 'json':
        fs.writeFileSync(filePath, JSON.stringify(meeting, null, 2));
        break;
      case 'pdf':
        // TODO: Implement PDF export
        throw new Error('PDF export not yet implemented');
      case 'docx':
        // TODO: Implement DOCX export
        throw new Error('DOCX export not yet implemented');
      default:
        throw new Error(`Unsupported format: ${format}`);
    }
  }

  showAboutDialog() {
    dialog.showMessageBox(this.mainWindow, {
      type: 'info',
      title: 'About Meeting Transcription',
      message: 'Universal Meeting Transcription',
      detail: `Version: ${app.getVersion()}\nA universal desktop application for meeting transcription across all platforms.`
    });
  }
}

// App event handlers
app.whenReady().then(async () => {
  const desktopApp = new DesktopApp();
  await desktopApp.initialize();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', async () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    const desktopApp = new DesktopApp();
    await desktopApp.initialize();
  }
});

// Security: Prevent new window creation
app.on('web-contents-created', (event, contents) => {
  contents.on('new-window', (event, navigationUrl) => {
    event.preventDefault();
    shell.openExternal(navigationUrl);
  });
});