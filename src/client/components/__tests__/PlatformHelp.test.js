/**
 * Platform Help Component Tests
 * @jest-environment jsdom
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { MeetingPlatform } from '../../services/PlatformAdapter.js';

// Mock CSS import
jest.mock('../PlatformHelp.css', () => ({}));

// Import component after mocking CSS
const PlatformHelp = require('../PlatformHelp.js').default;

describe('PlatformHelp', () => {
  const mockCapabilities = {
    chatIntegration: true,
    agendaAccess: false,
    participantInfo: true,
    hostDetection: true,
    audioQuality: 'high'
  };

  describe('Teams Platform Help', () => {
    test('displays Teams-specific help content', () => {
      render(
        <PlatformHelp 
          platform={MeetingPlatform.TEAMS}
          capabilities={mockCapabilities}
        />
      );
      
      expect(screen.getByText('Microsoft Teams Integration')).toBeInTheDocument();
      expect(screen.getByText(/native integration/i)).toBeInTheDocument();
    });

    test('shows Teams-specific features', () => {
      render(
        <PlatformHelp 
          platform={MeetingPlatform.TEAMS}
          capabilities={mockCapabilities}
        />
      );
      
      expect(screen.getByText('Native Integration')).toBeInTheDocument();
      expect(screen.getByText('Chat Integration')).toBeInTheDocument();
      expect(screen.getByText('Host Controls')).toBeInTheDocument();
    });

    test('displays Teams setup instructions', () => {
      render(
        <PlatformHelp 
          platform={MeetingPlatform.TEAMS}
          capabilities={mockCapabilities}
        />
      );
      
      expect(screen.getByText('Setup Instructions')).toBeInTheDocument();
      expect(screen.getByText(/sideloading/i)).toBeInTheDocument();
    });
  });

  describe('Zoom Platform Help', () => {
    test('displays Zoom-specific help content', () => {
      render(
        <PlatformHelp 
          platform={MeetingPlatform.ZOOM}
          capabilities={mockCapabilities}
        />
      );
      
      expect(screen.getByText('Zoom Integration')).toBeInTheDocument();
      expect(screen.getByText('Web SDK Integration')).toBeInTheDocument();
    });

    test('shows Zoom-specific features', () => {
      render(
        <PlatformHelp 
          platform={MeetingPlatform.ZOOM}
          capabilities={mockCapabilities}
        />
      );
      
      expect(screen.getByText('Web SDK Integration')).toBeInTheDocument();
      expect(screen.getByText('Recording Integration')).toBeInTheDocument();
    });
  });

  describe('Google Meet Platform Help', () => {
    test('displays Google Meet-specific help content', () => {
      render(
        <PlatformHelp 
          platform={MeetingPlatform.GOOGLE_MEET}
          capabilities={mockCapabilities}
        />
      );
      
      expect(screen.getByText('Google Meet Integration')).toBeInTheDocument();
      expect(screen.getByText('Browser Extension')).toBeInTheDocument();
    });

    test('shows Google Meet-specific features', () => {
      render(
        <PlatformHelp 
          platform={MeetingPlatform.GOOGLE_MEET}
          capabilities={mockCapabilities}
        />
      );
      
      expect(screen.getByText('Browser Extension')).toBeInTheDocument();
      expect(screen.getByText('Export Options')).toBeInTheDocument();
    });
  });

  describe('Generic Platform Help', () => {
    test('displays generic help content for unknown platform', () => {
      render(
        <PlatformHelp 
          platform={MeetingPlatform.UNKNOWN}
          capabilities={mockCapabilities}
        />
      );
      
      expect(screen.getByText('Generic Platform Support')).toBeInTheDocument();
      expect(screen.getByText('System Audio Capture')).toBeInTheDocument();
    });

    test('shows generic features', () => {
      render(
        <PlatformHelp 
          platform={MeetingPlatform.UNKNOWN}
          capabilities={mockCapabilities}
        />
      );
      
      expect(screen.getByText('System Audio Capture')).toBeInTheDocument();
      expect(screen.getByText('Local Processing')).toBeInTheDocument();
    });
  });

  describe('Feature Availability', () => {
    test('marks features as available based on capabilities', () => {
      render(
        <PlatformHelp 
          platform={MeetingPlatform.TEAMS}
          capabilities={mockCapabilities}
        />
      );
      
      const chatFeature = screen.getByText('Chat Integration').closest('.feature-item');
      expect(chatFeature).toHaveClass('available');
      
      const agendaFeature = screen.getByText('Agenda Access').closest('.feature-item');
      expect(agendaFeature).toHaveClass('unavailable');
    });

    test('shows correct availability icons', () => {
      render(
        <PlatformHelp 
          platform={MeetingPlatform.TEAMS}
          capabilities={mockCapabilities}
        />
      );
      
      const availableIcons = screen.getAllByText('✅');
      const unavailableIcons = screen.getAllByText('❌');
      
      expect(availableIcons.length).toBeGreaterThan(0);
      expect(unavailableIcons.length).toBeGreaterThan(0);
    });
  });

  describe('Setup Instructions', () => {
    test('displays numbered setup steps', () => {
      render(
        <PlatformHelp 
          platform={MeetingPlatform.TEAMS}
          capabilities={mockCapabilities}
        />
      );
      
      expect(screen.getByText('Setup Instructions')).toBeInTheDocument();
      
      const setupList = document.querySelector('.setup-steps');
      expect(setupList).toBeInTheDocument();
      
      const steps = setupList.querySelectorAll('.setup-step');
      expect(steps.length).toBeGreaterThan(0);
    });

    test('shows platform-specific setup instructions', () => {
      render(
        <PlatformHelp 
          platform={MeetingPlatform.ZOOM}
          capabilities={mockCapabilities}
        />
      );
      
      expect(screen.getByText('Install the Zoom app from the Zoom App Marketplace')).toBeInTheDocument();
    });
  });

  describe('Troubleshooting', () => {
    test('displays troubleshooting section', () => {
      render(
        <PlatformHelp 
          platform={MeetingPlatform.TEAMS}
          capabilities={mockCapabilities}
        />
      );
      
      expect(screen.getByText('Troubleshooting')).toBeInTheDocument();
    });

    test('shows platform-specific troubleshooting items', () => {
      render(
        <PlatformHelp 
          platform={MeetingPlatform.TEAMS}
          capabilities={mockCapabilities}
        />
      );
      
      const troubleshootingItems = document.querySelectorAll('.troubleshooting-item');
      expect(troubleshootingItems.length).toBeGreaterThan(0);
    });

    test('displays issue titles and solutions', () => {
      render(
        <PlatformHelp 
          platform={MeetingPlatform.TEAMS}
          capabilities={mockCapabilities}
        />
      );
      
      const issueTitles = document.querySelectorAll('.issue-title');
      const solutions = document.querySelectorAll('.solution-text');
      
      expect(issueTitles.length).toBeGreaterThan(0);
      expect(solutions.length).toBeGreaterThan(0);
      expect(issueTitles.length).toBe(solutions.length);
    });
  });

  describe('Additional Resources', () => {
    test('displays resource links', () => {
      render(
        <PlatformHelp 
          platform={MeetingPlatform.TEAMS}
          capabilities={mockCapabilities}
        />
      );
      
      expect(screen.getByText('Additional Resources')).toBeInTheDocument();
      expect(screen.getByText('📖 User Guide')).toBeInTheDocument();
      expect(screen.getByText('🎥 Video Tutorials')).toBeInTheDocument();
      expect(screen.getByText('❓ FAQ')).toBeInTheDocument();
      expect(screen.getByText('🐛 Report Issue')).toBeInTheDocument();
    });

    test('resource links have proper styling', () => {
      render(
        <PlatformHelp 
          platform={MeetingPlatform.TEAMS}
          capabilities={mockCapabilities}
        />
      );
      
      const resourceLinks = document.querySelectorAll('.resource-link');
      expect(resourceLinks.length).toBe(4);
      
      resourceLinks.forEach(link => {
        expect(link).toHaveClass('platform-button');
      });
    });
  });

  describe('Responsive Design', () => {
    test('applies platform-component class', () => {
      render(
        <PlatformHelp 
          platform={MeetingPlatform.TEAMS}
          capabilities={mockCapabilities}
        />
      );
      
      const helpComponent = document.querySelector('.platform-help');
      expect(helpComponent).toHaveClass('platform-component');
    });

    test('uses platform-aware styling classes', () => {
      render(
        <PlatformHelp 
          platform={MeetingPlatform.TEAMS}
          capabilities={mockCapabilities}
        />
      );
      
      const secondaryText = document.querySelector('.platform-text-secondary');
      expect(secondaryText).toBeInTheDocument();
    });
  });
});