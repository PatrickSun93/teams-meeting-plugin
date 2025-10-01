const { test, expect } = require('@playwright/test');
const { _electron: electron } = require('playwright');
const path = require('path');

test.describe('Desktop Application E2E Tests', () => {
  let electronApp;
  let page;

  test.beforeAll(async () => {
    // Launch Electron app
    electronApp = await electron.launch({
      args: [path.join(__dirname, '../../src/main.js')],
      env: {
        NODE_ENV: 'test'
      }
    });
    
    // Get the first window
    page = await electronApp.firstWindow();
    
    // Wait for app to be ready
    await page.waitForLoadState('domcontentloaded');
  });

  test.afterAll(async () => {
    if (electronApp) {
      await electronApp.close();
    }
  });

  test('should launch and display main interface', async () => {
    // Check if main elements are visible
    await expect(page.locator('.app-header')).toBeVisible();
    await expect(page.locator('.app-title')).toHaveText('Meeting Transcription');
    await expect(page.locator('.control-panel')).toBeVisible();
    await expect(page.locator('.transcription-panel')).toBeVisible();
    await expect(page.locator('.status-bar')).toBeVisible();
  });

  test('should show platform indicator', async () => {
    const platformIndicator = page.locator('.platform-indicator');
    await expect(platformIndicator).toBeVisible();
    
    const platformName = platformIndicator.locator('.platform-name');
    await expect(platformName).toBeVisible();
    
    const platformStatus = platformIndicator.locator('.platform-status');
    await expect(platformStatus).toBeVisible();
  });

  test('should have recording controls', async () => {
    const startBtn = page.locator('#startBtn');
    const stopBtn = page.locator('#stopBtn');
    
    await expect(startBtn).toBeVisible();
    await expect(startBtn).toBeEnabled();
    await expect(startBtn).toHaveText(/Start Recording/);
    
    await expect(stopBtn).toBeVisible();
    await expect(stopBtn).toBeDisabled();
    await expect(stopBtn).toHaveText(/Stop Recording/);
  });

  test('should have platform selection dropdown', async () => {
    const platformSelect = page.locator('#platformSelect');
    await expect(platformSelect).toBeVisible();
    
    // Check if it has expected options
    const options = await platformSelect.locator('option').allTextContents();
    expect(options).toContain('Auto-detect');
    expect(options).toContain('Microsoft Teams');
    expect(options).toContain('Zoom');
    expect(options).toContain('Google Meet');
    expect(options).toContain('Generic/Other');
  });

  test('should have audio device selection', async () => {
    const audioSelect = page.locator('#audioDeviceSelect');
    await expect(audioSelect).toBeVisible();
    
    // Should have at least one option
    const options = await audioSelect.locator('option').count();
    expect(options).toBeGreaterThan(0);
  });

  test('should open settings modal', async () => {
    const settingsBtn = page.locator('#settingsBtn');
    await settingsBtn.click();
    
    const settingsModal = page.locator('#settingsModal');
    await expect(settingsModal).toHaveClass(/active/);
    
    // Check if tabs are present
    await expect(page.locator('[data-tab="transcription"]')).toBeVisible();
    await expect(page.locator('[data-tab="audio"]')).toBeVisible();
    await expect(page.locator('[data-tab="platform"]')).toBeVisible();
    await expect(page.locator('[data-tab="export"]')).toBeVisible();
    await expect(page.locator('[data-tab="privacy"]')).toBeVisible();
    await expect(page.locator('[data-tab="advanced"]')).toBeVisible();
    
    // Close modal
    await page.locator('#closeSettingsBtn').click();
    await expect(settingsModal).not.toHaveClass(/active/);
  });

  test('should switch between settings tabs', async () => {
    // Open settings
    await page.locator('#settingsBtn').click();
    
    // Test tab switching
    await page.locator('[data-tab="audio"]').click();
    await expect(page.locator('#audio-tab')).toHaveClass(/active/);
    
    await page.locator('[data-tab="platform"]').click();
    await expect(page.locator('#platform-tab')).toHaveClass(/active/);
    
    await page.locator('[data-tab="privacy"]').click();
    await expect(page.locator('#privacy-tab')).toHaveClass(/active/);
    
    // Close modal
    await page.locator('#closeSettingsBtn').click();
  });

  test('should detect platform when button clicked', async () => {
    const detectBtn = page.locator('#detectBtn');
    await detectBtn.click();
    
    // Wait for detection to complete
    await page.waitForTimeout(2000);
    
    // Platform indicator should update
    const platformName = page.locator('.platform-name');
    const text = await platformName.textContent();
    expect(text).toBeTruthy();
  });

  test('should change platform selection', async () => {
    const platformSelect = page.locator('#platformSelect');
    
    // Select Teams
    await platformSelect.selectOption('teams');
    await expect(platformSelect).toHaveValue('teams');
    
    // Select Zoom
    await platformSelect.selectOption('zoom');
    await expect(platformSelect).toHaveValue('zoom');
    
    // Select auto-detect
    await platformSelect.selectOption('auto');
    await expect(platformSelect).toHaveValue('auto');
  });

  test('should show transcript placeholder initially', async () => {
    const transcriptContainer = page.locator('#transcriptContainer');
    const placeholder = transcriptContainer.locator('.transcript-placeholder');
    
    await expect(placeholder).toBeVisible();
    await expect(placeholder).toContainText('Start recording to see live transcription');
  });

  test('should clear transcript when button clicked', async () => {
    const clearBtn = page.locator('#clearTranscriptBtn');
    await clearBtn.click();
    
    // Should show placeholder again
    const placeholder = page.locator('.transcript-placeholder');
    await expect(placeholder).toBeVisible();
  });

  test('should show status information', async () => {
    // Recording status
    const recordingStatus = page.locator('#recordingStatus');
    await expect(recordingStatus).toHaveText('Ready');
    
    // Platform status
    const platformStatus = page.locator('#platformStatus');
    await expect(platformStatus).toBeVisible();
    
    // Transcription provider
    const provider = page.locator('#transcriptionProvider');
    await expect(provider).toBeVisible();
    
    // App version
    const version = page.locator('#appVersion');
    await expect(version).toMatch(/v\d+\.\d+\.\d+/);
  });

  test('should handle keyboard shortcuts', async () => {
    // Test Ctrl+N for new meeting (should be same as start recording)
    await page.keyboard.press('Control+N');
    // This would start recording in a real scenario
    
    // Test Ctrl+S for settings
    await page.keyboard.press('Control+,');
    // This might open settings in some implementations
  });

  test('should be responsive to window resizing', async () => {
    // Get initial size
    const initialSize = await page.viewportSize();
    
    // Resize to smaller window
    await page.setViewportSize({ width: 600, height: 400 });
    
    // Check if layout adapts
    const controlPanel = page.locator('.control-panel');
    await expect(controlPanel).toBeVisible();
    
    // Restore original size
    if (initialSize) {
      await page.setViewportSize(initialSize);
    }
  });

  test('should handle app menu interactions', async () => {
    // Test if menu is accessible (this depends on Electron menu implementation)
    // In a real test, you would interact with the native menu
    
    // For now, just verify the app responds to menu-like actions
    const settingsBtn = page.locator('#settingsBtn');
    await expect(settingsBtn).toBeVisible();
  });

  test('should validate form inputs in settings', async () => {
    // Open settings
    await page.locator('#settingsBtn').click();
    
    // Go to advanced tab
    await page.locator('[data-tab="advanced"]').click();
    
    // Test numeric input validation
    const maxConcurrent = page.locator('#maxConcurrentTranscriptions');
    await maxConcurrent.fill('0');
    
    // Try to save (should validate)
    await page.locator('#saveSettingsBtn').click();
    
    // Close settings
    await page.locator('#closeSettingsBtn').click();
  });

  test('should show notifications', async () => {
    // Notifications container should exist
    const notifications = page.locator('#notifications');
    await expect(notifications).toBeVisible();
    
    // In a real scenario, notifications would appear based on app actions
  });

  test('should handle export functionality', async () => {
    const exportBtn = page.locator('#exportTranscriptBtn');
    await exportBtn.click();
    
    // Should show some feedback (notification or dialog)
    // In a real scenario, this would open a file dialog
  });

  test('should maintain state across interactions', async () => {
    // Change platform selection
    await page.locator('#platformSelect').selectOption('teams');
    
    // Open and close settings
    await page.locator('#settingsBtn').click();
    await page.locator('#closeSettingsBtn').click();
    
    // Platform selection should be maintained
    await expect(page.locator('#platformSelect')).toHaveValue('teams');
  });

  test('should handle error states gracefully', async () => {
    // Try to start recording (might fail in test environment)
    const startBtn = page.locator('#startBtn');
    await startBtn.click();
    
    // App should handle any errors gracefully and not crash
    await expect(page.locator('.app-header')).toBeVisible();
  });
});