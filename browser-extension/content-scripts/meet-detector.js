/**
 * Google Meet Meeting Detection Content Script
 * Detects when user joins/leaves Google Meet meetings
 */

class MeetDetector {
  constructor() {
    this.meetingId = null;
    this.meetingTitle = null;
    this.isInMeeting = false;
    this.participants = new Set();
    this.observer = null;
    
    this.init();
  }

  init() {
    console.log('Meet detector initialized');
    
    // Wait for page to load completely
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => this.startDetection());
    } else {
      this.startDetection();
    }
  }

  startDetection() {
    // Extract meeting ID from URL
    this.extractMeetingInfo();
    
    // Set up observers for meeting state changes
    this.setupMeetingObserver();
    
    // Check initial meeting state
    this.checkMeetingState();
    
    // Listen for URL changes (SPA navigation)
    this.setupURLChangeListener();
  }

  extractMeetingInfo() {
    const url = window.location.href;
    const meetingIdMatch = url.match(/meet\.google\.com\/([a-z0-9-]+)/);
    
    if (meetingIdMatch) {
      this.meetingId = meetingIdMatch[1];
      console.log('Meeting ID extracted:', this.meetingId);
    }

    // Try to get meeting title from page
    this.updateMeetingTitle();
  }

  updateMeetingTitle() {
    // Try various selectors for meeting title
    const titleSelectors = [
      '[data-meeting-title]',
      '[jsname="r4nke"]', // Google Meet title element
      '.u6vdEc', // Another possible title selector
      'h1',
      '.meeting-title'
    ];

    for (const selector of titleSelectors) {
      const titleElement = document.querySelector(selector);
      if (titleElement && titleElement.textContent.trim()) {
        this.meetingTitle = titleElement.textContent.trim();
        console.log('Meeting title found:', this.meetingTitle);
        break;
      }
    }

    if (!this.meetingTitle) {
      this.meetingTitle = `Google Meet - ${this.meetingId}`;
    }
  }

  setupMeetingObserver() {
    // Observe DOM changes to detect meeting state
    this.observer = new MutationObserver((mutations) => {
      let shouldCheck = false;
      
      mutations.forEach((mutation) => {
        // Check for changes that might indicate meeting state change
        if (mutation.type === 'childList' || mutation.type === 'attributes') {
          shouldCheck = true;
        }
      });
      
      if (shouldCheck) {
        this.checkMeetingState();
        this.updateParticipants();
      }
    });

    this.observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class', 'data-meeting-state']
    });
  }

  checkMeetingState() {
    const wasInMeeting = this.isInMeeting;
    
    // Check various indicators that we're in a meeting
    const meetingIndicators = [
      // Camera/mic controls present
      () => document.querySelector('[data-is-muted]'),
      () => document.querySelector('[aria-label*="camera"]'),
      () => document.querySelector('[aria-label*="microphone"]'),
      
      // Meeting controls present
      () => document.querySelector('[aria-label*="Leave call"]'),
      () => document.querySelector('[aria-label*="End call"]'),
      
      // Video elements present
      () => document.querySelector('video'),
      
      // Participant grid present
      () => document.querySelector('[data-participant-id]'),
      () => document.querySelector('.participant-container'),
      
      // Meeting UI elements
      () => document.querySelector('.meeting-controls'),
      () => document.querySelector('[jsname="BOHaEe"]') // Meet controls container
    ];

    this.isInMeeting = meetingIndicators.some(check => check());
    
    // Meeting state changed
    if (this.isInMeeting !== wasInMeeting) {
      if (this.isInMeeting) {
        this.onMeetingJoined();
      } else {
        this.onMeetingLeft();
      }
    }
  }

  updateParticipants() {
    if (!this.isInMeeting) return;

    const participantElements = document.querySelectorAll([
      '[data-participant-id]',
      '.participant-name',
      '[aria-label*="participant"]'
    ].join(', '));

    const currentParticipants = new Set();
    
    participantElements.forEach(element => {
      const participantId = element.getAttribute('data-participant-id') || 
                           element.textContent?.trim() ||
                           element.getAttribute('aria-label');
      
      if (participantId) {
        currentParticipants.add(participantId);
      }
    });

    // Check for new participants
    currentParticipants.forEach(participant => {
      if (!this.participants.has(participant)) {
        console.log('New participant joined:', participant);
        this.participants.add(participant);
      }
    });

    // Check for participants who left
    this.participants.forEach(participant => {
      if (!currentParticipants.has(participant)) {
        console.log('Participant left:', participant);
        this.participants.delete(participant);
      }
    });
  }

  onMeetingJoined() {
    console.log('Meeting joined:', this.meetingId);
    
    this.sendMessage('MEETING_DETECTED', {
      meetingId: this.meetingId,
      title: this.meetingTitle,
      url: window.location.href,
      timestamp: new Date().toISOString()
    });
  }

  onMeetingLeft() {
    console.log('Meeting left:', this.meetingId);
    
    this.sendMessage('MEETING_ENDED', {
      meetingId: this.meetingId,
      timestamp: new Date().toISOString()
    });
    
    // Reset state
    this.participants.clear();
  }

  setupURLChangeListener() {
    let lastUrl = window.location.href;
    
    const checkUrlChange = () => {
      const currentUrl = window.location.href;
      if (currentUrl !== lastUrl) {
        console.log('URL changed:', currentUrl);
        lastUrl = currentUrl;
        
        // Re-extract meeting info for new URL
        this.extractMeetingInfo();
        this.checkMeetingState();
      }
    };

    // Check for URL changes periodically (for SPA navigation)
    setInterval(checkUrlChange, 1000);
    
    // Also listen for popstate events
    window.addEventListener('popstate', checkUrlChange);
  }

  sendMessage(type, data) {
    chrome.runtime.sendMessage({ type, data }).catch(error => {
      console.error('Failed to send message to background:', error);
    });
  }

  /**
   * Handle messages from background script
   */
  handleMessage(message, sender, sendResponse) {
    switch (message.type) {
      case 'GET_PARTICIPANTS':
        sendResponse({ participants: this.getParticipantsList() });
        break;
      case 'GET_MEETING_STATE':
        sendResponse({ 
          isInMeeting: this.isInMeeting,
          meetingId: this.meetingId,
          participants: this.getParticipantsList()
        });
        break;
      default:
        sendResponse({ success: false, error: 'Unknown message type' });
    }
  }

  /**
   * Get current participants list
   */
  getParticipantsList() {
    const participantsList = [];
    
    // Try different selectors for participant elements
    const participantSelectors = [
      '[data-participant-id]',
      '[jsname="V67aGc"]', // Google Meet participant container
      '.participant-name',
      '[aria-label*="participant"]',
      '[data-self-name]'
    ];

    participantSelectors.forEach(selector => {
      const elements = document.querySelectorAll(selector);
      elements.forEach(element => {
        const participantInfo = this.extractParticipantInfo(element);
        if (participantInfo && !participantsList.find(p => p.id === participantInfo.id)) {
          participantsList.push(participantInfo);
        }
      });
    });

    return participantsList;
  }

  /**
   * Extract participant information from DOM element
   */
  extractParticipantInfo(element) {
    try {
      const id = element.getAttribute('data-participant-id') || 
                 element.getAttribute('data-self-name') ||
                 element.textContent?.trim() ||
                 `participant-${Date.now()}-${Math.random()}`;
      
      const name = element.textContent?.trim() ||
                   element.getAttribute('aria-label') ||
                   element.getAttribute('title') ||
                   'Unknown Participant';

      // Check if participant is muted (if available)
      const isMuted = element.querySelector('[data-is-muted="true"]') !== null ||
                      element.getAttribute('aria-label')?.includes('muted') ||
                      false;

      // Check if video is on (if available)
      const isVideoOn = element.querySelector('video') !== null ||
                        !element.getAttribute('aria-label')?.includes('camera off') ||
                        true;

      return {
        id: id,
        name: name,
        isMuted: isMuted,
        isVideoOn: isVideoOn,
        joinTime: new Date().toISOString(),
        isHost: false // Google Meet doesn't reliably expose host status
      };
    } catch (error) {
      console.error('Failed to extract participant info:', error);
      return null;
    }
  }

  destroy() {
    if (this.observer) {
      this.observer.disconnect();
    }
  }
}

// Initialize detector when script loads
const meetDetector = new MeetDetector();

// Listen for messages from background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  meetDetector.handleMessage(message, sender, sendResponse);
  return true; // Keep message channel open for async response
});

// Clean up on page unload
window.addEventListener('beforeunload', () => {
  meetDetector.destroy();
});