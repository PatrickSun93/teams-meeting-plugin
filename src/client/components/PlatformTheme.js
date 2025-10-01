/**
 * Platform Theme System
 * Provides platform-specific styling and themes
 */

import { MeetingPlatform } from '../services/PlatformAdapter.js';

/**
 * Platform-specific color schemes and styling
 */
export const PlatformThemes = {
  [MeetingPlatform.TEAMS]: {
    name: 'Microsoft Teams',
    colors: {
      primary: '#0078d4',
      primaryHover: '#106ebe',
      secondary: '#f3f2f1',
      accent: '#6264a7',
      success: '#107c10',
      warning: '#ff8c00',
      error: '#d13438',
      background: '#f5f5f5',
      surface: '#ffffff',
      text: '#323130',
      textSecondary: '#605e5c',
      border: '#e1e5e9'
    },
    fonts: {
      primary: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
      mono: "'Segoe UI Mono', 'Courier New', monospace"
    },
    spacing: {
      xs: '4px',
      sm: '8px',
      md: '16px',
      lg: '24px',
      xl: '32px'
    },
    borderRadius: '6px',
    shadows: {
      light: '0 2px 4px rgba(0, 0, 0, 0.05)',
      medium: '0 2px 8px rgba(0, 0, 0, 0.1)',
      heavy: '0 4px 16px rgba(0, 0, 0, 0.15)'
    }
  },

  [MeetingPlatform.ZOOM]: {
    name: 'Zoom',
    colors: {
      primary: '#2d8cff',
      primaryHover: '#1a73e8',
      secondary: '#f6f7f9',
      accent: '#0e71eb',
      success: '#00b04f',
      warning: '#ff9500',
      error: '#e74c3c',
      background: '#f6f7f9',
      surface: '#ffffff',
      text: '#1f2329',
      textSecondary: '#747775',
      border: '#d8dce6'
    },
    fonts: {
      primary: "'Lato', 'Helvetica Neue', Arial, sans-serif",
      mono: "'Monaco', 'Menlo', 'Ubuntu Mono', monospace"
    },
    spacing: {
      xs: '4px',
      sm: '8px',
      md: '16px',
      lg: '24px',
      xl: '32px'
    },
    borderRadius: '8px',
    shadows: {
      light: '0 1px 3px rgba(0, 0, 0, 0.08)',
      medium: '0 2px 8px rgba(0, 0, 0, 0.12)',
      heavy: '0 4px 20px rgba(0, 0, 0, 0.16)'
    }
  },

  [MeetingPlatform.GOOGLE_MEET]: {
    name: 'Google Meet',
    colors: {
      primary: '#1a73e8',
      primaryHover: '#1557b0',
      secondary: '#f8f9fa',
      accent: '#34a853',
      success: '#34a853',
      warning: '#fbbc04',
      error: '#ea4335',
      background: '#f8f9fa',
      surface: '#ffffff',
      text: '#202124',
      textSecondary: '#5f6368',
      border: '#dadce0'
    },
    fonts: {
      primary: "'Google Sans', 'Roboto', Arial, sans-serif",
      mono: "'Roboto Mono', 'Courier New', monospace"
    },
    spacing: {
      xs: '4px',
      sm: '8px',
      md: '16px',
      lg: '24px',
      xl: '32px'
    },
    borderRadius: '8px',
    shadows: {
      light: '0 1px 2px rgba(60, 64, 67, 0.1)',
      medium: '0 2px 6px rgba(60, 64, 67, 0.15)',
      heavy: '0 4px 12px rgba(60, 64, 67, 0.2)'
    }
  },

  [MeetingPlatform.UNKNOWN]: {
    name: 'Generic',
    colors: {
      primary: '#6366f1',
      primaryHover: '#4f46e5',
      secondary: '#f1f5f9',
      accent: '#8b5cf6',
      success: '#10b981',
      warning: '#f59e0b',
      error: '#ef4444',
      background: '#f8fafc',
      surface: '#ffffff',
      text: '#1e293b',
      textSecondary: '#64748b',
      border: '#e2e8f0'
    },
    fonts: {
      primary: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
      mono: "'JetBrains Mono', 'Fira Code', 'Courier New', monospace"
    },
    spacing: {
      xs: '4px',
      sm: '8px',
      md: '16px',
      lg: '24px',
      xl: '32px'
    },
    borderRadius: '8px',
    shadows: {
      light: '0 1px 3px rgba(0, 0, 0, 0.1)',
      medium: '0 4px 6px rgba(0, 0, 0, 0.1)',
      heavy: '0 10px 15px rgba(0, 0, 0, 0.1)'
    }
  }
};

/**
 * Platform-specific UI configurations
 */
export const PlatformUIConfig = {
  [MeetingPlatform.TEAMS]: {
    showPlatformBranding: true,
    compactMode: false,
    iconStyle: 'fluent',
    animationDuration: '200ms',
    maxWidth: '1200px'
  },

  [MeetingPlatform.ZOOM]: {
    showPlatformBranding: true,
    compactMode: true,
    iconStyle: 'outline',
    animationDuration: '150ms',
    maxWidth: '1000px'
  },

  [MeetingPlatform.GOOGLE_MEET]: {
    showPlatformBranding: true,
    compactMode: true,
    iconStyle: 'material',
    animationDuration: '250ms',
    maxWidth: '900px'
  },

  [MeetingPlatform.UNKNOWN]: {
    showPlatformBranding: false,
    compactMode: false,
    iconStyle: 'generic',
    animationDuration: '200ms',
    maxWidth: '1100px'
  }
};

/**
 * Platform Theme Provider Class
 */
export class PlatformThemeProvider {
  constructor() {
    this.currentPlatform = MeetingPlatform.UNKNOWN;
    this.currentTheme = PlatformThemes[MeetingPlatform.UNKNOWN];
    this.currentUIConfig = PlatformUIConfig[MeetingPlatform.UNKNOWN];
    this.themeChangeCallbacks = [];
  }

  /**
   * Set current platform and update theme
   * @param {string} platform - Platform identifier
   */
  setPlatform(platform) {
    if (this.currentPlatform !== platform) {
      this.currentPlatform = platform;
      this.currentTheme = PlatformThemes[platform] || PlatformThemes[MeetingPlatform.UNKNOWN];
      this.currentUIConfig = PlatformUIConfig[platform] || PlatformUIConfig[MeetingPlatform.UNKNOWN];
      
      this._applyThemeToDOM();
      this._notifyThemeChange();
    }
  }

  /**
   * Get current theme
   * @returns {object} Current theme object
   */
  getTheme() {
    return this.currentTheme;
  }

  /**
   * Get current UI configuration
   * @returns {object} Current UI config object
   */
  getUIConfig() {
    return this.currentUIConfig;
  }

  /**
   * Get current platform
   * @returns {string} Current platform identifier
   */
  getCurrentPlatform() {
    return this.currentPlatform;
  }

  /**
   * Generate CSS custom properties for current theme
   * @returns {string} CSS custom properties
   */
  generateCSSVariables() {
    const theme = this.currentTheme;
    const uiConfig = this.currentUIConfig;
    
    let css = ':root {\n';
    
    // Colors
    Object.entries(theme.colors).forEach(([key, value]) => {
      css += `  --platform-color-${key}: ${value};\n`;
    });
    
    // Fonts
    Object.entries(theme.fonts).forEach(([key, value]) => {
      css += `  --platform-font-${key}: ${value};\n`;
    });
    
    // Spacing
    Object.entries(theme.spacing).forEach(([key, value]) => {
      css += `  --platform-spacing-${key}: ${value};\n`;
    });
    
    // Other properties
    css += `  --platform-border-radius: ${theme.borderRadius};\n`;
    css += `  --platform-animation-duration: ${uiConfig.animationDuration};\n`;
    css += `  --platform-max-width: ${uiConfig.maxWidth};\n`;
    
    // Shadows
    Object.entries(theme.shadows).forEach(([key, value]) => {
      css += `  --platform-shadow-${key}: ${value};\n`;
    });
    
    css += '}\n';
    return css;
  }

  /**
   * Add theme change callback
   * @param {function} callback - Callback function
   */
  onThemeChange(callback) {
    this.themeChangeCallbacks.push(callback);
  }

  /**
   * Remove theme change callback
   * @param {function} callback - Callback function
   */
  removeThemeChangeCallback(callback) {
    const index = this.themeChangeCallbacks.indexOf(callback);
    if (index > -1) {
      this.themeChangeCallbacks.splice(index, 1);
    }
  }

  /**
   * Apply theme to DOM
   * @private
   */
  _applyThemeToDOM() {
    // Remove existing theme style element
    const existingStyle = document.getElementById('platform-theme-variables');
    if (existingStyle) {
      existingStyle.remove();
    }

    // Create new style element with theme variables
    const styleElement = document.createElement('style');
    styleElement.id = 'platform-theme-variables';
    styleElement.textContent = this.generateCSSVariables();
    document.head.appendChild(styleElement);

    // Add platform class to body
    document.body.className = document.body.className
      .replace(/platform-\w+/g, '')
      .trim();
    document.body.classList.add(`platform-${this.currentPlatform}`);
  }

  /**
   * Notify theme change callbacks
   * @private
   */
  _notifyThemeChange() {
    this.themeChangeCallbacks.forEach(callback => {
      try {
        callback({
          platform: this.currentPlatform,
          theme: this.currentTheme,
          uiConfig: this.currentUIConfig
        });
      } catch (error) {
        console.error('Error in theme change callback:', error);
      }
    });
  }
}

// Create singleton instance
export const platformThemeProvider = new PlatformThemeProvider();

/**
 * React hook for using platform theme
 * @returns {object} Theme context
 */
export const usePlatformTheme = () => {
  const [themeState, setThemeState] = React.useState({
    platform: platformThemeProvider.getCurrentPlatform(),
    theme: platformThemeProvider.getTheme(),
    uiConfig: platformThemeProvider.getUIConfig()
  });

  React.useEffect(() => {
    const handleThemeChange = (newThemeState) => {
      setThemeState(newThemeState);
    };

    platformThemeProvider.onThemeChange(handleThemeChange);
    
    return () => {
      platformThemeProvider.removeThemeChangeCallback(handleThemeChange);
    };
  }, []);

  return themeState;
};