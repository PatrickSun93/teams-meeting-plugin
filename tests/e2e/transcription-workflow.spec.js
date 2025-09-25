// End-to-end tests for complete transcription workflow
const { test, expect } = require('@playwright/test');

test.describe('Complete Transcription Workflow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('should complete full transcription workflow', async ({ page }) => {
    // Test plugin initialization
    await expect(page.locator('[data-testid="plugin-interface"]')).toBeVisible();
    
    // Test configuration setup
    await page.click('[data-testid="config-button"]');
    await page.selectOption('[data-testid="stt-provider"]', 'local');
    await page.click('[data-testid="save-config"]');
    
    // Test meeting detection and start transcription
    await page.click('[data-testid="start-transcription"]');
    await expect(page.locator('[data-testid="transcription-status"]')).toContainText('Recording');
    
    // Simulate audio input and verify transcription
    await page.evaluate(() => {
      // Mock audio input for testing
      window.mockAudioInput('Hello, this is a test meeting');
    });
    
    // Wait for transcription to appear
    await expect(page.locator('[data-testid="transcript-text"]')).toContainText('Hello');
    
    // Test speaker identification
    await expect(page.locator('[data-testid="speaker-label"]')).toBeVisible();
    
    // Test stop transcription
    await page.click('[data-testid="stop-transcription"]');
    await expect(page.locator('[data-testid="transcription-status"]')).toContainText('Stopped');
    
    // Test summary generation
    await page.click('[data-testid="generate-summary"]');
    await expect(page.locator('[data-testid="summary-content"]')).toBeVisible();
    
    // Test transcript export
    await page.click('[data-testid="export-transcript"]');
    const downloadPromise = page.waitForEvent('download');
    await page.click('[data-testid="export-pdf"]');
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toContain('.pdf');
  });

  test('should handle error scenarios gracefully', async ({ page }) => {
    // Test network failure handling
    await page.route('**/api/**', route => route.abort());
    
    await page.click('[data-testid="start-transcription"]');
    await expect(page.locator('[data-testid="error-notification"]')).toBeVisible();
    
    // Test recovery after network restoration
    await page.unroute('**/api/**');
    await page.click('[data-testid="retry-button"]');
    await expect(page.locator('[data-testid="transcription-status"]')).toContainText('Recording');
  });

  test('should maintain accessibility standards', async ({ page }) => {
    // Test keyboard navigation
    await page.keyboard.press('Tab');
    await expect(page.locator(':focus')).toBeVisible();
    
    // Test ARIA labels
    const startButton = page.locator('[data-testid="start-transcription"]');
    await expect(startButton).toHaveAttribute('aria-label');
    
    // Test screen reader compatibility
    const transcriptArea = page.locator('[data-testid="transcript-text"]');
    await expect(transcriptArea).toHaveAttribute('role', 'log');
    await expect(transcriptArea).toHaveAttribute('aria-live', 'polite');
  });

  test('should handle Teams integration', async ({ page }) => {
    // Mock Teams SDK
    await page.addInitScript(() => {
      window.microsoftTeams = {
        initialize: () => {},
        getContext: (callback) => callback({
          meetingId: 'test-meeting-123',
          userPrincipalName: 'test@example.com',
          isHost: true
        }),
        authentication: {
          getAuthToken: (callback) => callback('mock-token')
        }
      };
    });

    await page.reload();
    
    // Test Teams context detection
    await expect(page.locator('[data-testid="teams-status"]')).toContainText('Connected');
    
    // Test host controls
    await expect(page.locator('[data-testid="host-controls"]')).toBeVisible();
    
    // Test chat integration
    await page.click('[data-testid="send-to-chat"]');
    await expect(page.locator('[data-testid="chat-success"]')).toBeVisible();
  });
});

test.describe('Performance Tests', () => {
  test('should handle large transcripts efficiently', async ({ page }) => {
    await page.goto('/');
    
    // Generate large transcript
    const largeText = 'This is a test sentence. '.repeat(1000);
    
    await page.evaluate((text) => {
      window.mockLargeTranscript(text);
    }, largeText);
    
    // Measure rendering performance
    const startTime = Date.now();
    await page.locator('[data-testid="transcript-text"]').waitFor();
    const renderTime = Date.now() - startTime;
    
    expect(renderTime).toBeLessThan(2000); // Should render within 2 seconds
  });

  test('should maintain responsive UI during processing', async ({ page }) => {
    await page.goto('/');
    
    // Start intensive processing
    await page.click('[data-testid="start-transcription"]');
    
    // UI should remain responsive
    const button = page.locator('[data-testid="config-button"]');
    await button.click();
    await expect(page.locator('[data-testid="config-panel"]')).toBeVisible();
  });
});