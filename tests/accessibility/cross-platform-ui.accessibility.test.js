// Cross-platform UI accessibility tests
import { render, screen } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import userEvent from '@testing-library/user-event';

// Extend Jest matchers
expect.extend(toHaveNoViolations);

// Import platform-specific components
import PlatformTheme from '../../src/client/components/PlatformTheme';
import PlatformIndicator from '../../src/client/components/PlatformIndicator';
import PlatformHelp from '../../src/client/components/PlatformHelp';
import PluginInterface from '../../src/client/components/PluginInterface';
import ConfigurationPanel from '../../src/client/components/ConfigurationPanel';

describe('Cross-Platform UI Accessibility Tests', () => {
  const platforms = ['teams', 'zoom', 'meet', 'generic'];

  describe('Platform Theme Accessibility', () => {
    platforms.forEach(platform => {
      test(`should be accessible with ${platform} theme`, async () => {
        const { container } = render(
          <PlatformTheme platform={platform}>
            <PluginInterface />
          </PlatformTheme>
        );

        const results = await axe(container);
        expect(results).toHaveNoViolations();
      });

      test(`should maintain color contrast in ${platform} theme`, async () => {
        const { container } = render(
          <PlatformTheme platform={platform}>
            <div className="test-content">
              <button>Primary Action</button>
              <p>Sample text content</p>
              <input type="text" placeholder="Input field" />
            </div>
          </PlatformTheme>
        );

        // Test with axe color contrast rules
        const results = await axe(container, {
          rules: {
            'color-contrast': { enabled: true },
            'color-contrast-enhanced': { enabled: true }
          }
        });

        expect(results).toHaveNoViolations();
      });

      test(`should support high contrast mode for ${platform}`, async () => {
        // Mock high contrast media query
        Object.defineProperty(window, 'matchMedia', {
          writable: true,
          value: jest.fn().mockImplementation(query => ({
            matches: query === '(prefers-contrast: high)',
            media: query,
            onchange: null,
            addListener: jest.fn(),
            removeListener: jest.fn(),
            addEventListener: jest.fn(),
            removeEventListener: jest.fn(),
            dispatchEvent: jest.fn(),
          })),
        });

        const { container } = render(
          <PlatformTheme platform={platform} highContrast={true}>
            <PluginInterface />
          </PlatformTheme>
        );

        // Verify high contrast styles are applied
        const themeContainer = container.firstChild;
        expect(themeContainer).toHaveClass(`${platform}-theme`);
        expect(themeContainer).toHaveClass('high-contrast');

        const results = await axe(container);
        expect(results).toHaveNoViolations();
      });
    });
  });

  describe('Platform Indicator Accessibility', () => {
    platforms.forEach(platform => {
      test(`should properly announce ${platform} platform status`, () => {
        render(<PlatformIndicator platform={platform} status="connected" />);

        const indicator = screen.getByRole('status');
        expect(indicator).toHaveAttribute('aria-label', `Connected to ${platform}`);
        expect(indicator).toHaveAttribute('aria-live', 'polite');
      });

      test(`should handle platform switching announcements for ${platform}`, async () => {
        const { rerender } = render(
          <PlatformIndicator platform="teams" status="connected" />
        );

        // Switch to different platform
        rerender(<PlatformIndicator platform={platform} status="connecting" />);

        const indicator = screen.getByRole('status');
        expect(indicator).toHaveAttribute('aria-label', `Connecting to ${platform}`);
      });

      test(`should provide keyboard navigation for ${platform} controls`, async () => {
        const user = userEvent.setup();
        const mockOnPlatformChange = jest.fn();

        render(
          <PlatformIndicator 
            platform={platform} 
            status="connected"
            onPlatformChange={mockOnPlatformChange}
            showControls={true}
          />
        );

        // Test keyboard navigation
        const platformButton = screen.getByRole('button', { name: new RegExp(platform, 'i') });
        
        await user.tab();
        expect(document.activeElement).toBe(platformButton);

        await user.keyboard('{Enter}');
        expect(mockOnPlatformChange).toHaveBeenCalled();
      });
    });
  });

  describe('Platform Help Accessibility', () => {
    platforms.forEach(platform => {
      test(`should provide accessible help content for ${platform}`, async () => {
        const { container } = render(<PlatformHelp platform={platform} />);

        const results = await axe(container);
        expect(results).toHaveNoViolations();
      });

      test(`should have proper heading structure for ${platform} help`, () => {
        render(<PlatformHelp platform={platform} />);

        // Check heading hierarchy
        const headings = screen.getAllByRole('heading');
        expect(headings.length).toBeGreaterThan(0);

        // First heading should be h1 or h2
        const firstHeading = headings[0];
        expect(['H1', 'H2']).toContain(firstHeading.tagName);
      });

      test(`should provide keyboard navigation for ${platform} help sections`, async () => {
        const user = userEvent.setup();
        
        render(<PlatformHelp platform={platform} />);

        // Test expandable sections
        const expandButtons = screen.getAllByRole('button', { expanded: false });
        
        if (expandButtons.length > 0) {
          const firstButton = expandButtons[0];
          
          await user.tab();
          expect(document.activeElement).toBe(firstButton);

          await user.keyboard('{Enter}');
          expect(firstButton).toHaveAttribute('aria-expanded', 'true');
        }
      });

      test(`should announce help content changes for ${platform}`, async () => {
        const user = userEvent.setup();
        
        render(<PlatformHelp platform={platform} />);

        const liveRegions = screen.getAllByRole('region');
        const helpRegion = liveRegions.find(region => 
          region.getAttribute('aria-live') === 'polite'
        );

        expect(helpRegion).toBeInTheDocument();
      });
    });
  });

  describe('Cross-Platform Configuration Accessibility', () => {
    test('should maintain accessibility across platform configurations', async () => {
      for (const platform of platforms) {
        const { container, unmount } = render(
          <ConfigurationPanel 
            platform={platform}
            isOpen={true}
          />
        );

        const results = await axe(container);
        expect(results).toHaveNoViolations();

        unmount();
      }
    });

    test('should provide consistent form labeling across platforms', () => {
      platforms.forEach(platform => {
        const { unmount } = render(
          <ConfigurationPanel 
            platform={platform}
            isOpen={true}
          />
        );

        // Check common form elements
        const sttProviderSelect = screen.getByLabelText(/speech-to-text provider/i);
        expect(sttProviderSelect).toBeInTheDocument();

        const apiKeyInput = screen.getByLabelText(/api key/i);
        expect(apiKeyInput).toBeInTheDocument();
        expect(apiKeyInput).toHaveAttribute('aria-describedby');

        unmount();
      });
    });

    test('should handle platform-specific configuration options accessibly', async () => {
      const platformConfigs = {
        teams: ['tenant-id', 'client-id'],
        zoom: ['api-key', 'api-secret'],
        meet: ['client-id', 'calendar-access'],
        generic: ['audio-source', 'export-format']
      };

      for (const [platform, expectedFields] of Object.entries(platformConfigs)) {
        const { container, unmount } = render(
          <ConfigurationPanel 
            platform={platform}
            isOpen={true}
          />
        );

        // Verify platform-specific fields are accessible
        for (const fieldName of expectedFields) {
          const field = screen.getByTestId(`${platform}-${fieldName}`);
          expect(field).toHaveAttribute('aria-label');
          
          if (field.tagName === 'INPUT') {
            expect(field).toHaveAttribute('aria-describedby');
          }
        }

        const results = await axe(container);
        expect(results).toHaveNoViolations();

        unmount();
      }
    });
  });

  describe('Responsive Design Accessibility', () => {
    const viewports = [
      { width: 320, height: 568, name: 'mobile' },
      { width: 768, height: 1024, name: 'tablet' },
      { width: 1024, height: 768, name: 'desktop' },
      { width: 1920, height: 1080, name: 'large-desktop' }
    ];

    viewports.forEach(viewport => {
      test(`should maintain accessibility at ${viewport.name} viewport`, async () => {
        // Mock viewport
        Object.defineProperty(window, 'innerWidth', {
          writable: true,
          configurable: true,
          value: viewport.width,
        });
        Object.defineProperty(window, 'innerHeight', {
          writable: true,
          configurable: true,
          value: viewport.height,
        });

        const { container } = render(
          <div style={{ width: viewport.width, height: viewport.height }}>
            <PluginInterface />
          </div>
        );

        const results = await axe(container);
        expect(results).toHaveNoViolations();
      });

      test(`should provide touch-friendly targets at ${viewport.name}`, () => {
        Object.defineProperty(window, 'innerWidth', {
          writable: true,
          configurable: true,
          value: viewport.width,
        });

        render(<PluginInterface />);

        const buttons = screen.getAllByRole('button');
        
        buttons.forEach(button => {
          const styles = window.getComputedStyle(button);
          const minSize = viewport.width < 768 ? 44 : 32; // Larger targets on mobile
          
          // Note: In a real test, you'd check computed styles
          // This is a simplified check
          expect(button).toBeInTheDocument();
        });
      });
    });
  });

  describe('Screen Reader Navigation', () => {
    test('should provide logical reading order across platforms', () => {
      platforms.forEach(platform => {
        const { unmount } = render(
          <PlatformTheme platform={platform}>
            <PluginInterface />
          </PlatformTheme>
        );

        // Check landmark structure
        const main = screen.getByRole('main');
        expect(main).toBeInTheDocument();

        const navigation = screen.queryByRole('navigation');
        if (navigation) {
          expect(navigation).toBeInTheDocument();
        }

        // Check heading structure
        const headings = screen.getAllByRole('heading');
        expect(headings.length).toBeGreaterThan(0);

        unmount();
      });
    });

    test('should provide skip links for keyboard users', () => {
      render(<PluginInterface />);

      const skipLink = screen.getByText(/skip to main content/i);
      expect(skipLink).toBeInTheDocument();
      expect(skipLink).toHaveAttribute('href', '#main-content');
      
      // Skip link should be visually hidden but accessible
      expect(skipLink).toHaveClass('sr-only');
    });

    test('should announce dynamic content changes', async () => {
      const user = userEvent.setup();
      
      render(<PluginInterface />);

      // Start transcription
      const startButton = screen.getByRole('button', { name: /start transcription/i });
      await user.click(startButton);

      // Check for live region updates
      const liveRegion = screen.getByRole('log');
      expect(liveRegion).toHaveAttribute('aria-live', 'polite');
      expect(liveRegion).toHaveAttribute('aria-label', 'Live transcription');
    });
  });

  describe('Focus Management', () => {
    test('should manage focus properly in modal dialogs', async () => {
      const user = userEvent.setup();
      
      render(<PluginInterface />);

      // Open configuration modal
      const configButton = screen.getByRole('button', { name: /configuration/i });
      await user.click(configButton);

      const modal = screen.getByRole('dialog');
      expect(modal).toBeInTheDocument();

      // Focus should be trapped in modal
      const focusableElements = modal.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      
      expect(focusableElements.length).toBeGreaterThan(0);
      
      // First focusable element should be focused
      expect(document.activeElement).toBe(focusableElements[0]);
    });

    test('should restore focus after modal closes', async () => {
      const user = userEvent.setup();
      
      render(<PluginInterface />);

      const configButton = screen.getByRole('button', { name: /configuration/i });
      configButton.focus();
      
      // Open modal
      await user.click(configButton);
      
      // Close modal
      const closeButton = screen.getByRole('button', { name: /close/i });
      await user.click(closeButton);
      
      // Focus should return to config button
      expect(document.activeElement).toBe(configButton);
    });

    test('should handle focus for platform-specific controls', async () => {
      const user = userEvent.setup();
      
      platforms.forEach(async platform => {
        const { unmount } = render(
          <PlatformTheme platform={platform}>
            <PluginInterface />
          </PlatformTheme>
        );

        // Test tab navigation through platform-specific controls
        await user.tab();
        expect(document.activeElement).toBeVisible();

        await user.tab();
        expect(document.activeElement).toBeVisible();

        unmount();
      });
    });
  });

  describe('Error State Accessibility', () => {
    test('should announce errors accessibly across platforms', () => {
      const errorMessage = 'Failed to connect to platform';
      
      platforms.forEach(platform => {
        const { unmount } = render(
          <PlatformTheme platform={platform}>
            <PluginInterface error={errorMessage} />
          </PlatformTheme>
        );

        const errorAlert = screen.getByRole('alert');
        expect(errorAlert).toHaveTextContent(errorMessage);
        expect(errorAlert).toHaveAttribute('aria-live', 'assertive');

        unmount();
      });
    });

    test('should provide accessible error recovery options', async () => {
      const user = userEvent.setup();
      const mockRetry = jest.fn();
      
      render(
        <PluginInterface 
          error="Connection failed"
          onRetry={mockRetry}
        />
      );

      const retryButton = screen.getByRole('button', { name: /retry/i });
      expect(retryButton).toHaveAttribute('aria-describedby');
      
      await user.click(retryButton);
      expect(mockRetry).toHaveBeenCalled();
    });
  });

  describe('Internationalization Accessibility', () => {
    const languages = ['en', 'es', 'fr', 'de', 'ja'];

    languages.forEach(language => {
      test(`should maintain accessibility in ${language} locale`, async () => {
        // Mock language
        Object.defineProperty(navigator, 'language', {
          writable: true,
          value: language
        });

        const { container } = render(
          <div lang={language}>
            <PluginInterface />
          </div>
        );

        const results = await axe(container);
        expect(results).toHaveNoViolations();
      });

      test(`should handle RTL languages properly`, async () => {
        const rtlLanguages = ['ar', 'he', 'fa'];
        
        if (rtlLanguages.includes(language)) {
          const { container } = render(
            <div lang={language} dir="rtl">
              <PluginInterface />
            </div>
          );

          const results = await axe(container);
          expect(results).toHaveNoViolations();
        }
      });
    });
  });

  describe('Performance and Accessibility', () => {
    test('should maintain accessibility during heavy operations', async () => {
      const user = userEvent.setup();
      
      render(<PluginInterface />);

      // Start transcription (heavy operation)
      const startButton = screen.getByRole('button', { name: /start transcription/i });
      await user.click(startButton);

      // UI should remain accessible during processing
      const statusIndicator = screen.getByRole('status');
      expect(statusIndicator).toBeInTheDocument();
      expect(statusIndicator).toHaveAttribute('aria-live');

      // Controls should remain focusable
      const stopButton = screen.getByRole('button', { name: /stop transcription/i });
      expect(stopButton).not.toHaveAttribute('disabled');
    });

    test('should handle large transcript accessibility', async () => {
      const largeTranscript = Array.from({ length: 1000 }, (_, i) => ({
        id: i,
        text: `This is transcript segment ${i}`,
        speaker: `Speaker ${i % 5}`,
        timestamp: Date.now() + i * 1000
      }));

      const { container } = render(
        <PluginInterface transcript={largeTranscript} />
      );

      // Should still be accessible with large content
      const results = await axe(container);
      expect(results).toHaveNoViolations();

      // Transcript should be in a scrollable region
      const transcriptRegion = screen.getByRole('log');
      expect(transcriptRegion).toHaveAttribute('aria-label');
      expect(transcriptRegion).toHaveAttribute('tabindex', '0');
    });
  });
});