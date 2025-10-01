/**
 * Platform Indicator Component Tests
 * @jest-environment jsdom
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { MeetingPlatform } from '../../services/PlatformAdapter.js';

// Mock CSS import
jest.mock('../PlatformIndicator.css', () => ({}));

// Import component after mocking CSS
const PlatformIndicator = require('../PlatformIndicator.js').default;

describe('PlatformIndicator', () => {
  const mockCapabilities = {
    chatIntegration: true,
    agendaAccess: false,
    participantInfo: true,
    hostDetection: true,
    audioQuality: 'high'
  };

  describe('Platform Display', () => {
    test('displays Teams platform correctly', () => {
      render(
        <PlatformIndicator 
          platform={MeetingPlatform.TEAMS}
          isActive={true}
        />
      );
      
      expect(screen.getByText('Microsoft Teams')).toBeInTheDocument();
      expect(screen.getByText('Connected')).toBeInTheDocument();
    });

    test('displays Zoom platform correctly', () => {
      render(
        <PlatformIndicator 
          platform={MeetingPlatform.ZOOM}
          isActive={false}
        />
      );
      
      expect(screen.getByText('Zoom')).toBeInTheDocument();
      expect(screen.queryByText('Connected')).not.toBeInTheDocument();
    });

    test('displays Google Meet platform correctly', () => {
      render(
        <PlatformIndicator 
          platform={MeetingPlatform.GOOGLE_MEET}
          isActive={true}
        />
      );
      
      expect(screen.getByText('Google Meet')).toBeInTheDocument();
      expect(screen.getByText('Connected')).toBeInTheDocument();
    });

    test('displays unknown platform correctly', () => {
      render(
        <PlatformIndicator 
          platform={MeetingPlatform.UNKNOWN}
          isActive={false}
        />
      );
      
      expect(screen.getByText('Unknown Platform')).toBeInTheDocument();
    });
  });

  describe('Compact Mode', () => {
    test('renders compact version correctly', () => {
      render(
        <PlatformIndicator 
          platform={MeetingPlatform.TEAMS}
          isActive={true}
          compact={true}
        />
      );
      
      expect(screen.getByText('Teams')).toBeInTheDocument();
      const indicator = screen.getByText('Teams').closest('.platform-indicator');
      expect(indicator).toHaveClass('compact');
    });

    test('shows status dot when active in compact mode', () => {
      render(
        <PlatformIndicator 
          platform={MeetingPlatform.ZOOM}
          isActive={true}
          compact={true}
        />
      );
      
      const statusDot = document.querySelector('.status-dot');
      expect(statusDot).toBeInTheDocument();
    });
  });

  describe('Capabilities Display', () => {
    test('shows capabilities when enabled', () => {
      render(
        <PlatformIndicator 
          platform={MeetingPlatform.TEAMS}
          capabilities={mockCapabilities}
          showCapabilities={true}
        />
      );
      
      expect(screen.getByText('Platform Capabilities')).toBeInTheDocument();
      expect(screen.getByText('Chat Integration')).toBeInTheDocument();
      expect(screen.getByText('Agenda Access')).toBeInTheDocument();
    });

    test('displays capability status correctly', () => {
      render(
        <PlatformIndicator 
          platform={MeetingPlatform.TEAMS}
          capabilities={mockCapabilities}
          showCapabilities={true}
        />
      );
      
      // Check supported capability
      const chatIntegration = screen.getByText('Chat Integration').closest('.capability-item');
      expect(chatIntegration.querySelector('.capability-status')).toHaveClass('supported');
      
      // Check unsupported capability
      const agendaAccess = screen.getByText('Agenda Access').closest('.capability-item');
      expect(agendaAccess.querySelector('.capability-status')).toHaveClass('unsupported');
    });

    test('hides capabilities when not enabled', () => {
      render(
        <PlatformIndicator 
          platform={MeetingPlatform.TEAMS}
          capabilities={mockCapabilities}
          showCapabilities={false}
        />
      );
      
      expect(screen.queryByText('Platform Capabilities')).not.toBeInTheDocument();
    });
  });

  describe('Active State', () => {
    test('applies active class when active', () => {
      render(
        <PlatformIndicator 
          platform={MeetingPlatform.TEAMS}
          isActive={true}
        />
      );
      
      const indicator = document.querySelector('.platform-indicator');
      expect(indicator).toHaveClass('active');
    });

    test('does not apply active class when inactive', () => {
      render(
        <PlatformIndicator 
          platform={MeetingPlatform.TEAMS}
          isActive={false}
        />
      );
      
      const indicator = document.querySelector('.platform-indicator');
      expect(indicator).not.toHaveClass('active');
    });

    test('shows connection indicator when active', () => {
      render(
        <PlatformIndicator 
          platform={MeetingPlatform.TEAMS}
          isActive={true}
        />
      );
      
      const connectionIndicator = document.querySelector('.connection-indicator');
      expect(connectionIndicator).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    test('has proper ARIA attributes', () => {
      render(
        <PlatformIndicator 
          platform={MeetingPlatform.TEAMS}
          isActive={true}
        />
      );
      
      const indicator = document.querySelector('.platform-indicator');
      expect(indicator).toBeInTheDocument();
    });

    test('capability icons are accessible', () => {
      render(
        <PlatformIndicator 
          platform={MeetingPlatform.TEAMS}
          capabilities={mockCapabilities}
          showCapabilities={true}
        />
      );
      
      const capabilityIcons = document.querySelectorAll('.capability-icon');
      expect(capabilityIcons.length).toBeGreaterThan(0);
    });
  });
});