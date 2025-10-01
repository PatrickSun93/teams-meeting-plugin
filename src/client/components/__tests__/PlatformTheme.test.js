/**
 * Platform Theme System Tests
 * @jest-environment jsdom
 */

import { 
  PlatformThemes, 
  PlatformUIConfig, 
  PlatformThemeProvider 
} from '../PlatformTheme.js';
import { MeetingPlatform } from '../../services/PlatformAdapter.js';

describe('PlatformThemes', () => {
  test('contains themes for all supported platforms', () => {
    expect(PlatformThemes[MeetingPlatform.TEAMS]).toBeDefined();
    expect(PlatformThemes[MeetingPlatform.ZOOM]).toBeDefined();
    expect(PlatformThemes[MeetingPlatform.GOOGLE_MEET]).toBeDefined();
    expect(PlatformThemes[MeetingPlatform.UNKNOWN]).toBeDefined();
  });

  test('each theme has required properties', () => {
    Object.values(PlatformThemes).forEach(theme => {
      expect(theme.name).toBeDefined();
      expect(theme.colors).toBeDefined();
      expect(theme.fonts).toBeDefined();
      expect(theme.spacing).toBeDefined();
      expect(theme.borderRadius).toBeDefined();
      expect(theme.shadows).toBeDefined();
    });
  });

  test('Teams theme has correct colors', () => {
    const teamsTheme = PlatformThemes[MeetingPlatform.TEAMS];
    expect(teamsTheme.colors.primary).toBe('#0078d4');
    expect(teamsTheme.colors.primaryHover).toBe('#106ebe');
    expect(teamsTheme.name).toBe('Microsoft Teams');
  });

  test('Zoom theme has correct colors', () => {
    const zoomTheme = PlatformThemes[MeetingPlatform.ZOOM];
    expect(zoomTheme.colors.primary).toBe('#2d8cff');
    expect(zoomTheme.name).toBe('Zoom');
  });

  test('Google Meet theme has correct colors', () => {
    const meetTheme = PlatformThemes[MeetingPlatform.GOOGLE_MEET];
    expect(meetTheme.colors.primary).toBe('#1a73e8');
    expect(meetTheme.name).toBe('Google Meet');
  });
});

describe('PlatformUIConfig', () => {
  test('contains UI config for all supported platforms', () => {
    expect(PlatformUIConfig[MeetingPlatform.TEAMS]).toBeDefined();
    expect(PlatformUIConfig[MeetingPlatform.ZOOM]).toBeDefined();
    expect(PlatformUIConfig[MeetingPlatform.GOOGLE_MEET]).toBeDefined();
    expect(PlatformUIConfig[MeetingPlatform.UNKNOWN]).toBeDefined();
  });

  test('each UI config has required properties', () => {
    Object.values(PlatformUIConfig).forEach(config => {
      expect(config.showPlatformBranding).toBeDefined();
      expect(config.compactMode).toBeDefined();
      expect(config.iconStyle).toBeDefined();
      expect(config.animationDuration).toBeDefined();
      expect(config.maxWidth).toBeDefined();
    });
  });

  test('Teams UI config is correct', () => {
    const teamsConfig = PlatformUIConfig[MeetingPlatform.TEAMS];
    expect(teamsConfig.showPlatformBranding).toBe(true);
    expect(teamsConfig.compactMode).toBe(false);
    expect(teamsConfig.iconStyle).toBe('fluent');
  });
});

describe('PlatformThemeProvider', () => {
  let themeProvider;

  beforeEach(() => {
    themeProvider = new PlatformThemeProvider();
    
    // Mock DOM methods
    document.getElementById = jest.fn();
    document.createElement = jest.fn(() => ({
      id: '',
      textContent: '',
      remove: jest.fn()
    }));
    document.head = {
      appendChild: jest.fn()
    };
    document.body = {
      className: '',
      classList: {
        add: jest.fn(),
        remove: jest.fn()
      }
    };
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Platform Management', () => {
    test('initializes with unknown platform', () => {
      expect(themeProvider.getCurrentPlatform()).toBe(MeetingPlatform.UNKNOWN);
    });

    test('sets platform correctly', () => {
      themeProvider.setPlatform(MeetingPlatform.TEAMS);
      expect(themeProvider.getCurrentPlatform()).toBe(MeetingPlatform.TEAMS);
    });

    test('updates theme when platform changes', () => {
      themeProvider.setPlatform(MeetingPlatform.TEAMS);
      const theme = themeProvider.getTheme();
      expect(theme.name).toBe('Microsoft Teams');
    });

    test('updates UI config when platform changes', () => {
      themeProvider.setPlatform(MeetingPlatform.ZOOM);
      const uiConfig = themeProvider.getUIConfig();
      expect(uiConfig.compactMode).toBe(true);
    });
  });

  describe('Theme Generation', () => {
    test('generates CSS variables correctly', () => {
      themeProvider.setPlatform(MeetingPlatform.TEAMS);
      const css = themeProvider.generateCSSVariables();
      
      expect(css).toContain(':root {');
      expect(css).toContain('--platform-color-primary: #0078d4;');
      expect(css).toContain('--platform-font-primary:');
      expect(css).toContain('--platform-spacing-md:');
      expect(css).toContain('}');
    });

    test('includes all required CSS variables', () => {
      themeProvider.setPlatform(MeetingPlatform.TEAMS);
      const css = themeProvider.generateCSSVariables();
      
      // Check colors
      expect(css).toContain('--platform-color-primary:');
      expect(css).toContain('--platform-color-secondary:');
      expect(css).toContain('--platform-color-background:');
      
      // Check fonts
      expect(css).toContain('--platform-font-primary:');
      expect(css).toContain('--platform-font-mono:');
      
      // Check spacing
      expect(css).toContain('--platform-spacing-xs:');
      expect(css).toContain('--platform-spacing-md:');
      
      // Check other properties
      expect(css).toContain('--platform-border-radius:');
      expect(css).toContain('--platform-animation-duration:');
    });
  });

  describe('Event Handling', () => {
    test('calls theme change callbacks', () => {
      const callback = jest.fn();
      themeProvider.onThemeChange(callback);
      
      themeProvider.setPlatform(MeetingPlatform.TEAMS);
      
      expect(callback).toHaveBeenCalledWith({
        platform: MeetingPlatform.TEAMS,
        theme: expect.any(Object),
        uiConfig: expect.any(Object)
      });
    });

    test('removes theme change callbacks', () => {
      const callback = jest.fn();
      themeProvider.onThemeChange(callback);
      themeProvider.removeThemeChangeCallback(callback);
      
      themeProvider.setPlatform(MeetingPlatform.TEAMS);
      
      expect(callback).not.toHaveBeenCalled();
    });

    test('handles callback errors gracefully', () => {
      const errorCallback = jest.fn(() => {
        throw new Error('Callback error');
      });
      const goodCallback = jest.fn();
      
      themeProvider.onThemeChange(errorCallback);
      themeProvider.onThemeChange(goodCallback);
      
      // Should not throw
      expect(() => {
        themeProvider.setPlatform(MeetingPlatform.TEAMS);
      }).not.toThrow();
      
      expect(goodCallback).toHaveBeenCalled();
    });
  });

  describe('DOM Manipulation', () => {
    test('applies theme to DOM when platform changes', () => {
      const mockStyleElement = {
        id: '',
        textContent: '',
        remove: jest.fn()
      };
      
      document.createElement.mockReturnValue(mockStyleElement);
      document.getElementById.mockReturnValue(null);
      
      themeProvider.setPlatform(MeetingPlatform.TEAMS);
      
      expect(document.createElement).toHaveBeenCalledWith('style');
      expect(mockStyleElement.id).toBe('platform-theme-variables');
      expect(document.head.appendChild).toHaveBeenCalledWith(mockStyleElement);
    });

    test('removes existing style element before adding new one', () => {
      const existingElement = { remove: jest.fn() };
      document.getElementById.mockReturnValue(existingElement);
      
      themeProvider.setPlatform(MeetingPlatform.TEAMS);
      
      expect(existingElement.remove).toHaveBeenCalled();
    });

    test('adds platform class to body', () => {
      themeProvider.setPlatform(MeetingPlatform.TEAMS);
      
      expect(document.body.classList.add).toHaveBeenCalledWith('platform-teams');
    });
  });

  describe('Fallback Behavior', () => {
    test('falls back to unknown theme for invalid platform', () => {
      themeProvider.setPlatform('invalid-platform');
      const theme = themeProvider.getTheme();
      expect(theme.name).toBe('Generic');
    });

    test('handles missing theme gracefully', () => {
      // Temporarily remove a theme
      const originalTheme = PlatformThemes['test-platform'];
      delete PlatformThemes['test-platform'];
      
      themeProvider.setPlatform('test-platform');
      const theme = themeProvider.getTheme();
      expect(theme.name).toBe('Generic');
      
      // Restore
      if (originalTheme) {
        PlatformThemes['test-platform'] = originalTheme;
      }
    });
  });
});