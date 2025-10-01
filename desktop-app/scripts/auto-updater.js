const { autoUpdater } = require('electron-updater');
const { dialog, BrowserWindow } = require('electron');
const log = require('electron-log');

class AutoUpdaterManager {
  constructor(mainWindow) {
    this.mainWindow = mainWindow;
    this.updateAvailable = false;
    this.updateDownloaded = false;
    
    this.setupLogging();
    this.setupEventHandlers();
    this.configureUpdater();
  }

  setupLogging() {
    // Configure electron-log for auto-updater
    autoUpdater.logger = log;
    autoUpdater.logger.transports.file.level = 'info';
    
    log.info('Auto-updater initialized');
  }

  configureUpdater() {
    // Configure update server
    autoUpdater.setFeedURL({
      provider: 'github',
      owner: 'your-org',
      repo: 'meeting-transcription',
      private: false
    });

    // Auto-download updates
    autoUpdater.autoDownload = true;
    
    // Check for updates every hour
    autoUpdater.autoInstallOnAppQuit = true;
    
    // Allow pre-release versions in development
    if (process.env.NODE_ENV === 'development') {
      autoUpdater.allowPrerelease = true;
    }
  }

  setupEventHandlers() {
    // Update available
    autoUpdater.on('update-available', (info) => {
      log.info('Update available:', info);
      this.updateAvailable = true;
      
      this.showUpdateNotification('Update Available', 
        `Version ${info.version} is available. It will be downloaded in the background.`);
      
      // Notify renderer process
      if (this.mainWindow && !this.mainWindow.isDestroyed()) {
        this.mainWindow.webContents.send('update-available', info);
      }
    });

    // Update not available
    autoUpdater.on('update-not-available', (info) => {
      log.info('Update not available:', info);
      this.updateAvailable = false;
    });

    // Update downloaded
    autoUpdater.on('update-downloaded', (info) => {
      log.info('Update downloaded:', info);
      this.updateDownloaded = true;
      
      this.showUpdateDownloadedDialog(info);
      
      // Notify renderer process
      if (this.mainWindow && !this.mainWindow.isDestroyed()) {
        this.mainWindow.webContents.send('update-downloaded', info);
      }
    });

    // Download progress
    autoUpdater.on('download-progress', (progressObj) => {
      const percent = Math.round(progressObj.percent);
      log.info(`Download progress: ${percent}%`);
      
      // Update progress in renderer
      if (this.mainWindow && !this.mainWindow.isDestroyed()) {
        this.mainWindow.webContents.send('update-progress', {
          percent,
          transferred: progressObj.transferred,
          total: progressObj.total,
          bytesPerSecond: progressObj.bytesPerSecond
        });
      }
    });

    // Update error
    autoUpdater.on('error', (error) => {
      log.error('Auto-updater error:', error);
      
      this.showUpdateError(error);
      
      // Notify renderer process
      if (this.mainWindow && !this.mainWindow.isDestroyed()) {
        this.mainWindow.webContents.send('update-error', {
          message: error.message,
          stack: error.stack
        });
      }
    });

    // Before quit for update
    autoUpdater.on('before-quit-for-update', () => {
      log.info('App will quit for update');
      
      // Save any pending data before update
      if (this.mainWindow && !this.mainWindow.isDestroyed()) {
        this.mainWindow.webContents.send('before-update-quit');
      }
    });
  }

  async checkForUpdates() {
    try {
      log.info('Checking for updates...');
      const result = await autoUpdater.checkForUpdatesAndNotify();
      
      if (result) {
        log.info('Update check result:', result);
        return {
          updateAvailable: !!result.updateInfo,
          currentVersion: result.currentVersion,
          updateInfo: result.updateInfo
        };
      }
      
      return { updateAvailable: false };
    } catch (error) {
      log.error('Failed to check for updates:', error);
      throw error;
    }
  }

  async downloadUpdate() {
    if (!this.updateAvailable) {
      throw new Error('No update available to download');
    }

    try {
      log.info('Starting update download...');
      await autoUpdater.downloadUpdate();
    } catch (error) {
      log.error('Failed to download update:', error);
      throw error;
    }
  }

  quitAndInstall() {
    if (!this.updateDownloaded) {
      throw new Error('No update downloaded to install');
    }

    log.info('Quitting and installing update...');
    autoUpdater.quitAndInstall();
  }

  showUpdateNotification(title, message) {
    // Show native notification if available
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send('show-notification', {
        title,
        message,
        type: 'info'
      });
    }
  }

  showUpdateDownloadedDialog(info) {
    const options = {
      type: 'info',
      title: 'Update Ready',
      message: `Version ${info.version} has been downloaded.`,
      detail: 'The update will be installed when you restart the application. Would you like to restart now?',
      buttons: ['Restart Now', 'Later'],
      defaultId: 0,
      cancelId: 1
    };

    dialog.showMessageBox(this.mainWindow, options).then((result) => {
      if (result.response === 0) {
        // User chose to restart now
        this.quitAndInstall();
      }
    });
  }

  showUpdateError(error) {
    const options = {
      type: 'error',
      title: 'Update Error',
      message: 'Failed to check for updates',
      detail: error.message,
      buttons: ['OK']
    };

    dialog.showMessageBox(this.mainWindow, options);
  }

  // Manual update check (called from menu or UI)
  async manualUpdateCheck() {
    try {
      const result = await this.checkForUpdates();
      
      if (!result.updateAvailable) {
        // Show "no updates" dialog
        const options = {
          type: 'info',
          title: 'No Updates',
          message: 'You are running the latest version.',
          detail: `Current version: ${result.currentVersion || 'Unknown'}`,
          buttons: ['OK']
        };
        
        dialog.showMessageBox(this.mainWindow, options);
      }
      
      return result;
    } catch (error) {
      this.showUpdateError(error);
      throw error;
    }
  }

  // Get current update status
  getUpdateStatus() {
    return {
      updateAvailable: this.updateAvailable,
      updateDownloaded: this.updateDownloaded,
      currentVersion: autoUpdater.currentVersion,
      isChecking: autoUpdater.isUpdaterActive()
    };
  }

  // Configure update channel (stable, beta, alpha)
  setUpdateChannel(channel) {
    if (!['stable', 'beta', 'alpha'].includes(channel)) {
      throw new Error(`Invalid update channel: ${channel}`);
    }

    autoUpdater.channel = channel;
    log.info(`Update channel set to: ${channel}`);
  }

  // Enable/disable automatic updates
  setAutoUpdate(enabled) {
    autoUpdater.autoDownload = enabled;
    log.info(`Auto-update ${enabled ? 'enabled' : 'disabled'}`);
  }

  // Set update check interval (in milliseconds)
  setUpdateInterval(interval) {
    if (this.updateTimer) {
      clearInterval(this.updateTimer);
    }

    if (interval > 0) {
      this.updateTimer = setInterval(() => {
        this.checkForUpdates().catch(error => {
          log.error('Scheduled update check failed:', error);
        });
      }, interval);
      
      log.info(`Update check interval set to: ${interval}ms`);
    }
  }

  // Start periodic update checks
  startPeriodicChecks(interval = 3600000) { // Default: 1 hour
    this.setUpdateInterval(interval);
    
    // Also check immediately
    setTimeout(() => {
      this.checkForUpdates().catch(error => {
        log.error('Initial update check failed:', error);
      });
    }, 5000); // Wait 5 seconds after app start
  }

  // Stop periodic update checks
  stopPeriodicChecks() {
    if (this.updateTimer) {
      clearInterval(this.updateTimer);
      this.updateTimer = null;
      log.info('Periodic update checks stopped');
    }
  }

  // Cleanup
  destroy() {
    this.stopPeriodicChecks();
    autoUpdater.removeAllListeners();
    log.info('Auto-updater manager destroyed');
  }
}

module.exports = AutoUpdaterManager;