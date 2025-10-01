// End-to-end tests across Teams, Zoom, and Google Meet platforms
const { test, expect } = require('@playwright/test');

test.describe('Multi-Platform Transcription Workflow', () => {
  const platforms = [
    {
      name: 'Teams',
      url: 'https://teams.microsoft.com/test-meeting',
      selector: '[data-testid="teams-meeting-container"]',
      mockScript: 'teams-mock.js'
    },
    {
      name: 'Zoom',
      url: 'https://zoom.us/j/123456789',
      selector: '[data-testid="zoom-meeting-container"]',
      mockScript: 'zoom-mock.js'
    },
    {
      name: 'Google Meet',
      url: 'https://meet.google.com/abc-defg-hij',
      selector: '[data-testid="meet-container"]',
      mockScript: 'meet-mock.js'
    }
  ];

  platforms.forEach(platform => {
    test.describe(`${platform.name} Platform`, () => {
      test.beforeEach(async ({ page }) => {
        // Load platform-specific mocks
        await page.addInitScript({ path: `tests/mocks/${platform.mockScript}` });
        
        // Navigate to platform
        await page.goto(platform.url);
        await page.waitForSelector(platform.selector);
        
        // Initialize transcription plugin
        await page.evaluate(() => {
          window.transcriptionPlugin = new window.UniversalTranscriptionPlugin();
        });
      });

      test(`should detect ${platform.name} platform automatically`, async ({ page }) => {
        const detectedPlatform = await page.evaluate(() => {
          return window.transcriptionPlugin.detectPlatform();
        });

        expect(detectedPlatform.toLowerCase()).toBe(platform.name.toLowerCase());
      });

      test(`should initialize transcription on ${platform.name}`, async ({ page }) => {
        // Start transcription
        await page.click('[data-testid="start-transcription"]');
        
        // Verify transcription status
        await expect(page.locator('[data-testid="transcription-status"]'))
          .toContainText('Recording');
        
        // Verify platform-specific UI elements
        await expect(page.locator(`[data-testid="${platform.name.toLowerCase()}-controls"]`))
          .toBeVisible();
      });

      test(`should capture and transcribe audio on ${platform.name}`, async ({ page }) => {
        // Start transcription
        await page.click('[data-testid="start-transcription"]');
        
        // Simulate audio input
        await page.evaluate(() => {
          window.mockAudioInput('Hello, this is a test meeting on ' + window.transcriptionPlugin.detectPlatform());
        });
        
        // Wait for transcription to appear
        await expect(page.locator('[data-testid="transcript-text"]'))
          .toContainText('Hello, this is a test meeting');
        
        // Verify platform name appears in transcript
        await expect(page.locator('[data-testid="transcript-text"]'))
          .toContainText(platform.name);
      });

      test(`should identify speakers on ${platform.name}`, async ({ page }) => {
        await page.click('[data-testid="start-transcription"]');
        
        // Simulate multiple speakers
        await page.evaluate(() => {
          window.mockMultipleSpeakers([
            { name: 'John Doe', text: 'Good morning everyone' },
            { name: 'Jane Smith', text: 'Hello John, how are you?' },
            { name: 'Bob Wilson', text: 'Great to see everyone today' }
          ]);
        });
        
        // Verify speaker identification
        await expect(page.locator('[data-testid="speaker-john-doe"]')).toBeVisible();
        await expect(page.locator('[data-testid="speaker-jane-smith"]')).toBeVisible();
        await expect(page.locator('[data-testid="speaker-bob-wilson"]')).toBeVisible();
        
        // Verify speaker labels in transcript
        await expect(page.locator('[data-testid="transcript-text"]'))
          .toContainText('John Doe: Good morning everyone');
        await expect(page.locator('[data-testid="transcript-text"]'))
          .toContainText('Jane Smith: Hello John');
      });

      test(`should generate AI summary on ${platform.name}`, async ({ page }) => {
        // Complete a mock meeting
        await page.click('[data-testid="start-transcription"]');
        
        await page.evaluate(() => {
          window.mockMeetingContent([
            'Discussed Q4 project timeline',
            'Reviewed budget allocation for new initiatives',
            'Assigned action items to team members',
            'Scheduled follow-up meeting for next week'
          ]);
        });
        
        await page.click('[data-testid="stop-transcription"]');
        
        // Generate summary
        await page.click('[data-testid="generate-summary"]');
        
        // Wait for summary to be generated
        await expect(page.locator('[data-testid="summary-content"]')).toBeVisible();
        
        // Verify summary contains key elements
        await expect(page.locator('[data-testid="summary-content"]'))
          .toContainText('Key Points');
        await expect(page.locator('[data-testid="summary-content"]'))
          .toContainText('Action Items');
      });

      if (platform.name === 'Teams' || platform.name === 'Zoom') {
        test(`should send transcript to chat on ${platform.name}`, async ({ page }) => {
          // Complete transcription
          await page.click('[data-testid="start-transcription"]');
          await page.evaluate(() => {
            window.mockMeetingContent(['Test meeting content for chat integration']);
          });
          await page.click('[data-testid="stop-transcription"]');
          
          // Send to chat
          await page.click('[data-testid="send-to-chat"]');
          
          // Verify success notification
          await expect(page.locator('[data-testid="chat-success-notification"]'))
            .toContainText('Transcript sent to chat');
          
          // Verify chat integration worked
          const chatSent = await page.evaluate(() => {
            return window.mockPlatformAPI.getChatMessages().length > 0;
          });
          expect(chatSent).toBe(true);
        });
      }

      if (platform.name === 'Google Meet') {
        test(`should provide export options on ${platform.name}`, async ({ page }) => {
          // Complete transcription
          await page.click('[data-testid="start-transcription"]');
          await page.evaluate(() => {
            window.mockMeetingContent(['Test meeting content for export']);
          });
          await page.click('[data-testid="stop-transcription"]');
          
          // Open export options
          await page.click('[data-testid="export-transcript"]');
          
          // Verify export options are available
          await expect(page.locator('[data-testid="export-pdf"]')).toBeVisible();
          await expect(page.locator('[data-testid="export-docx"]')).toBeVisible();
          await expect(page.locator('[data-testid="export-txt"]')).toBeVisible();
          
          // Test PDF export
          const downloadPromise = page.waitForEvent('download');
          await page.click('[data-testid="export-pdf"]');
          const download = await downloadPromise;
          expect(download.suggestedFilename()).toMatch(/\.pdf$/);
        });
      }

      test(`should handle errors gracefully on ${platform.name}`, async ({ page }) => {
        // Simulate network error
        await page.route('**/api/**', route => route.abort());
        
        await page.click('[data-testid="start-transcription"]');
        
        // Verify error handling
        await expect(page.locator('[data-testid="error-notification"]'))
          .toBeVisible();
        await expect(page.locator('[data-testid="error-notification"]'))
          .toContainText('Connection error');
        
        // Verify retry functionality
        await page.unroute('**/api/**');
        await page.click('[data-testid="retry-button"]');
        
        await expect(page.locator('[data-testid="transcription-status"]'))
          .toContainText('Recording');
      });

      test(`should maintain accessibility on ${platform.name}`, async ({ page }) => {
        // Test keyboard navigation
        await page.keyboard.press('Tab');
        await expect(page.locator(':focus')).toBeVisible();
        
        // Test ARIA labels
        const startButton = page.locator('[data-testid="start-transcription"]');
        await expect(startButton).toHaveAttribute('aria-label');
        
        // Test screen reader announcements
        await page.click('[data-testid="start-transcription"]');
        const liveRegion = page.locator('[aria-live="polite"]');
        await expect(liveRegion).toBeVisible();
      });
    });
  });

  test.describe('Cross-Platform Consistency', () => {
    test('should maintain consistent UI across platforms', async ({ browser }) => {
      const contexts = await Promise.all([
        browser.newContext(),
        browser.newContext(),
        browser.newContext()
      ]);

      const pages = await Promise.all([
        contexts[0].newPage(),
        contexts[1].newPage(),
        contexts[2].newPage()
      ]);

      // Load each platform
      for (let i = 0; i < platforms.length; i++) {
        const platform = platforms[i];
        const page = pages[i];
        
        await page.addInitScript({ path: `tests/mocks/${platform.mockScript}` });
        await page.goto(platform.url);
        await page.waitForSelector(platform.selector);
      }

      // Verify consistent UI elements across platforms
      const commonElements = [
        '[data-testid="start-transcription"]',
        '[data-testid="config-button"]',
        '[data-testid="transcript-display"]',
        '[data-testid="summary-section"]'
      ];

      for (const element of commonElements) {
        for (const page of pages) {
          await expect(page.locator(element)).toBeVisible();
        }
      }

      // Cleanup
      await Promise.all(contexts.map(context => context.close()));
    });

    test('should provide consistent transcription quality across platforms', async ({ browser }) => {
      const results = {};

      for (const platform of platforms) {
        const context = await browser.newContext();
        const page = await context.newPage();
        
        await page.addInitScript({ path: `tests/mocks/${platform.mockScript}` });
        await page.goto(platform.url);
        await page.waitForSelector(platform.selector);
        
        // Start transcription
        await page.click('[data-testid="start-transcription"]');
        
        // Input standardized test audio
        await page.evaluate(() => {
          window.mockStandardizedAudio('The quick brown fox jumps over the lazy dog');
        });
        
        // Get transcription result
        const transcriptText = await page.locator('[data-testid="transcript-text"]').textContent();
        
        results[platform.name] = {
          transcript: transcriptText,
          accuracy: calculateAccuracy(transcriptText, 'The quick brown fox jumps over the lazy dog')
        };
        
        await context.close();
      }

      // Verify consistent accuracy across platforms (within 10% variance)
      const accuracies = Object.values(results).map(r => r.accuracy);
      const maxAccuracy = Math.max(...accuracies);
      const minAccuracy = Math.min(...accuracies);
      
      expect(maxAccuracy - minAccuracy).toBeLessThan(0.1); // 10% variance
    });

    test('should handle configuration synchronization across platforms', async ({ browser }) => {
      const sharedConfig = {
        sttProvider: 'openai',
        aiProvider: 'claude',
        language: 'en-US',
        customPrompt: 'Generate a detailed summary with action items'
      };

      for (const platform of platforms) {
        const context = await browser.newContext();
        const page = await context.newPage();
        
        await page.addInitScript({ path: `tests/mocks/${platform.mockScript}` });
        await page.goto(platform.url);
        await page.waitForSelector(platform.selector);
        
        // Set configuration
        await page.click('[data-testid="config-button"]');
        await page.selectOption('[data-testid="stt-provider"]', sharedConfig.sttProvider);
        await page.selectOption('[data-testid="ai-provider"]', sharedConfig.aiProvider);
        await page.fill('[data-testid="custom-prompt"]', sharedConfig.customPrompt);
        await page.click('[data-testid="save-config"]');
        
        // Verify configuration is saved
        await page.click('[data-testid="config-button"]');
        const savedSttProvider = await page.locator('[data-testid="stt-provider"]').inputValue();
        const savedAiProvider = await page.locator('[data-testid="ai-provider"]').inputValue();
        const savedPrompt = await page.locator('[data-testid="custom-prompt"]').inputValue();
        
        expect(savedSttProvider).toBe(sharedConfig.sttProvider);
        expect(savedAiProvider).toBe(sharedConfig.aiProvider);
        expect(savedPrompt).toBe(sharedConfig.customPrompt);
        
        await context.close();
      }
    });
  });

  test.describe('Performance Across Platforms', () => {
    test('should maintain consistent performance metrics', async ({ browser }) => {
      const performanceResults = {};

      for (const platform of platforms) {
        const context = await browser.newContext();
        const page = await context.newPage();
        
        await page.addInitScript({ path: `tests/mocks/${platform.mockScript}` });
        
        // Measure page load time
        const startTime = Date.now();
        await page.goto(platform.url);
        await page.waitForSelector(platform.selector);
        const loadTime = Date.now() - startTime;
        
        // Measure transcription start time
        const transcriptionStartTime = Date.now();
        await page.click('[data-testid="start-transcription"]');
        await page.waitForSelector('[data-testid="transcription-status"]:has-text("Recording")');
        const transcriptionTime = Date.now() - transcriptionStartTime;
        
        performanceResults[platform.name] = {
          loadTime,
          transcriptionTime
        };
        
        await context.close();
      }

      // Verify performance consistency
      const loadTimes = Object.values(performanceResults).map(r => r.loadTime);
      const transcriptionTimes = Object.values(performanceResults).map(r => r.transcriptionTime);
      
      // No platform should be more than 2x slower than the fastest
      expect(Math.max(...loadTimes) / Math.min(...loadTimes)).toBeLessThan(2);
      expect(Math.max(...transcriptionTimes) / Math.min(...transcriptionTimes)).toBeLessThan(2);
    });

    test('should handle concurrent platform usage', async ({ browser }) => {
      // Open all platforms simultaneously
      const contexts = await Promise.all(platforms.map(() => browser.newContext()));
      const pages = await Promise.all(contexts.map(context => context.newPage()));
      
      // Load platforms concurrently
      await Promise.all(platforms.map(async (platform, index) => {
        const page = pages[index];
        await page.addInitScript({ path: `tests/mocks/${platform.mockScript}` });
        await page.goto(platform.url);
        await page.waitForSelector(platform.selector);
      }));
      
      // Start transcription on all platforms simultaneously
      const startTime = Date.now();
      await Promise.all(pages.map(page => 
        page.click('[data-testid="start-transcription"]')
      ));
      
      // Wait for all to be recording
      await Promise.all(pages.map(page =>
        page.waitForSelector('[data-testid="transcription-status"]:has-text("Recording")')
      ));
      const totalTime = Date.now() - startTime;
      
      // Should complete within reasonable time (< 5 seconds)
      expect(totalTime).toBeLessThan(5000);
      
      // Cleanup
      await Promise.all(contexts.map(context => context.close()));
    });
  });
});

// Helper function to calculate transcription accuracy
function calculateAccuracy(actual, expected) {
  const actualWords = actual.toLowerCase().split(/\s+/);
  const expectedWords = expected.toLowerCase().split(/\s+/);
  
  let matches = 0;
  const minLength = Math.min(actualWords.length, expectedWords.length);
  
  for (let i = 0; i < minLength; i++) {
    if (actualWords[i] === expectedWords[i]) {
      matches++;
    }
  }
  
  return matches / expectedWords.length;
}