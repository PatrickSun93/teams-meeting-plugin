# Zoom Integration Guide

This guide explains how to integrate the Teams Meeting Transcription Plugin with Zoom meetings using the ZoomAdapter.

## Overview

The ZoomAdapter provides a unified interface for integrating with Zoom meetings through the Zoom Web SDK. It supports:

- Real-time meeting detection and state management
- Audio stream capture for transcription
- Participant information retrieval
- Chat integration for transcript posting
- Host detection and permissions
- Meeting events and lifecycle management

## Prerequisites

### 1. Zoom Web SDK

Include the Zoom Web SDK in your application:

```html
<script src="https://source.zoom.us/2.18.0/lib/vendor/react.min.js"></script>
<script src="https://source.zoom.us/2.18.0/lib/vendor/react-dom.min.js"></script>
<script src="https://source.zoom.us/2.18.0/lib/vendor/redux.min.js"></script>
<script src="https://source.zoom.us/2.18.0/lib/vendor/redux-thunk.min.js"></script>
<script src="https://source.zoom.us/2.18.0/lib/vendor/lodash.min.js"></script>
<script src="https://source.zoom.us/2.18.0/zoom-meeting-embedded-2.18.0.min.js"></script>
```

### 2. Zoom App Configuration

To use the ZoomAdapter with full functionality, you need:

- **Zoom API Key**: For SDK authentication
- **Zoom API Secret**: For generating meeting signatures
- **Meeting Number**: The Zoom meeting ID
- **Meeting Signature**: Generated using your API credentials

## Basic Usage

### 1. Initialize the ZoomAdapter

```javascript
import { ZoomAdapter } from './services/ZoomAdapter.js';
import { platformDetectionService } from './services/PlatformDetectionService.js';
import { MeetingPlatform } from './services/PlatformAdapter.js';

// Register ZoomAdapter with platform detection
platformDetectionService.registerAdapter(MeetingPlatform.ZOOM, ZoomAdapter);

// Create and initialize adapter
const zoomAdapter = new ZoomAdapter();
await zoomAdapter.initialize();
```

### 2. Join a Meeting

```javascript
const meetingConfig = {
  meetingNumber: '123456789',
  password: 'meeting-password',
  userName: 'Transcription Bot',
  userEmail: 'bot@example.com',
  signature: 'your-generated-signature',
  apiKey: 'your-zoom-api-key',
  role: 0 // 0 for participant, 1 for host
};

await zoomAdapter.joinMeeting(meetingConfig);
```

### 3. Start Transcription

```javascript
// Get audio stream
const audioStream = await zoomAdapter.getAudioStream();

// Set up transcription processing
// (integrate with your transcription engine here)

// Get meeting info
const meetingInfo = await zoomAdapter.getMeetingInfo();
console.log('Meeting:', meetingInfo.title);

// Get participants
const participants = await zoomAdapter.getParticipants();
console.log('Participants:', participants.length);
```

### 4. Send Transcript to Chat

```javascript
const transcript = "Meeting transcript content...";
const success = await zoomAdapter.sendMessageToChat(transcript);

if (success) {
  console.log('Transcript sent to chat');
} else {
  console.log('Failed to send transcript');
}
```

## Advanced Usage

### Event Handling

```javascript
import { PlatformEvents } from './services/PlatformAdapter.js';

// Listen for meeting events
zoomAdapter.addEventListener(PlatformEvents.MEETING_STARTED, (data) => {
  console.log('Meeting started:', data);
});

zoomAdapter.addEventListener(PlatformEvents.PARTICIPANT_JOINED, (participant) => {
  console.log('Participant joined:', participant.name);
});

zoomAdapter.addEventListener(PlatformEvents.MEETING_ENDED, (data) => {
  console.log('Meeting ended');
});
```

### Configuration Management

```javascript
import { PlatformConfigurationManager } from './services/PlatformConfigurationManager.js';

const configManager = new PlatformConfigurationManager();
await configManager.initialize();

// Set Zoom-specific configuration
await configManager.setPlatformConfigValue(MeetingPlatform.ZOOM, 'zoom.apiKey', 'your-api-key');
await configManager.setPlatformConfigValue(MeetingPlatform.ZOOM, 'zoom.chatEnabled', true);

// Get configuration
const zoomConfig = configManager.getPlatformConfig(MeetingPlatform.ZOOM);
```

### Platform Detection

```javascript
// Automatic platform detection
const currentPlatform = platformDetectionService.getCurrentPlatform();

if (currentPlatform === MeetingPlatform.ZOOM) {
  const adapter = await platformDetectionService.detectAndGetAdapter();
  // Use the adapter
}

// Listen for platform changes
platformDetectionService.onPlatformDetected((event) => {
  console.log(`Platform changed from ${event.oldPlatform} to ${event.newPlatform}`);
});
```

## Zoom Web SDK Integration

### Generating Meeting Signatures

Meeting signatures must be generated server-side using your Zoom API credentials:

```javascript
// Server-side signature generation (Node.js example)
const jwt = require('jsonwebtoken');

function generateSignature(apiKey, apiSecret, meetingNumber, role) {
  const iat = Math.round(new Date().getTime() / 1000) - 30;
  const exp = iat + 60 * 60 * 2; // 2 hours

  const oHeader = { alg: 'HS256', typ: 'JWT' };
  const oPayload = {
    iss: apiKey,
    exp: exp,
    iat: iat,
    aud: 'zoom',
    appKey: apiKey,
    tokenExp: exp,
    alg: 'HS256'
  };

  const sHeader = JSON.stringify(oHeader);
  const sPayload = JSON.stringify(oPayload);
  const signature = jwt.sign(oPayload, apiSecret, { header: oHeader });

  return signature;
}
```

### SDK Configuration Options

```javascript
const zoomAdapter = new ZoomAdapter();

// Customize SDK configuration
zoomAdapter.sdkConfig = {
  debug: false,
  leaveUrl: 'https://your-app.com',
  showMeetingTime: true,
  disableInvite: false,
  disableCallOut: false,
  disableRecord: false,
  disableJoinAudio: false,
  audioPanelAlwaysOpen: true,
  showPureSharingContent: false,
  enableLoggerSync: false,
  logLevel: 'info'
};
```

## Platform Capabilities

The ZoomAdapter provides the following capabilities:

```javascript
const capabilities = zoomAdapter.getCapabilities();
// {
//   chatIntegration: true,        // Can send messages to chat
//   agendaAccess: false,          // No agenda access via Web SDK
//   participantInfo: true,        // Can get participant information
//   hostDetection: true,          // Can detect host status
//   audioQuality: 'high',         // High-quality audio capture
//   meetingEvents: true,          // Supports meeting events
//   recordingAccess: false,       // No recording access via Web SDK
//   realTimeTranscription: true,  // Supports real-time transcription
//   speakerIdentification: true,  // Supports speaker identification
//   fileExport: true              // Supports file export
// }
```

## Error Handling

### Common Errors

```javascript
try {
  await zoomAdapter.initialize();
} catch (error) {
  if (error.message.includes('Zoom Web SDK not loaded')) {
    console.error('Please include the Zoom Web SDK script');
  } else if (error.message.includes('SDK initialization failed')) {
    console.error('Check your Zoom SDK configuration');
  }
}

try {
  await zoomAdapter.sendMessageToChat(transcript);
} catch (error) {
  if (error.message.includes('Chat is disabled')) {
    console.log('Chat not available, using alternative delivery');
    // Implement alternative transcript delivery
  }
}
```

### Graceful Degradation

```javascript
const capabilities = zoomAdapter.getCapabilities();

if (!capabilities.chatIntegration) {
  // Provide file export instead
  console.log('Chat not available, transcript will be exported as file');
}

if (!capabilities.participantInfo) {
  // Disable speaker identification
  console.log('Participant info not available, disabling speaker ID');
}
```

## Limitations

### Zoom Web SDK Limitations

1. **No Direct Audio Access**: The Web SDK doesn't provide direct access to meeting audio streams. Audio capture uses `getUserMedia()` to capture system audio.

2. **No Agenda Access**: Meeting agenda information is not available through the Web SDK. Use the Zoom REST API for agenda access.

3. **Chat Permissions**: Chat functionality depends on meeting settings and user permissions.

4. **Browser Compatibility**: The Zoom Web SDK has specific browser requirements and limitations.

### Workarounds

1. **Audio Capture**: Use system-level audio routing or virtual audio cables for better audio capture.

2. **Agenda Information**: Integrate with Zoom REST API separately for meeting metadata and agenda.

3. **Recording Access**: Use Zoom REST API for cloud recording access and management.

## Security Considerations

### API Key Management

```javascript
// Store API keys securely
const secureStorage = new SecureStorageService();
await secureStorage.setItem('zoom.apiKey', apiKey, true); // encrypted

// Use environment variables for server-side keys
const apiSecret = process.env.ZOOM_API_SECRET;
```

### User Consent

```javascript
// Always request user consent for audio access
const consentService = new ConsentService();
const hasConsent = await consentService.requestAudioConsent();

if (hasConsent) {
  const audioStream = await zoomAdapter.getAudioStream();
}
```

### Data Privacy

```javascript
// Enable privacy mode for sensitive meetings
const privacyMode = new PrivacyModeService();
if (privacyMode.isEnabled()) {
  // Use local-only processing
  console.log('Privacy mode enabled - using local STT only');
}
```

## Troubleshooting

### Common Issues

1. **SDK Not Loading**: Ensure Zoom Web SDK scripts are loaded before initializing the adapter.

2. **Signature Errors**: Verify API key, secret, and signature generation logic.

3. **Audio Access Denied**: Check browser permissions and HTTPS requirements.

4. **Chat Not Working**: Verify meeting chat settings and user permissions.

### Debug Mode

```javascript
// Enable debug logging
zoomAdapter.sdkConfig.debug = true;
zoomAdapter.sdkConfig.logLevel = 'debug';

// Monitor adapter state
console.log('Meeting State:', zoomAdapter.getMeetingState());
console.log('Is Initialized:', zoomAdapter.isInitialized());
console.log('Is Meeting Active:', zoomAdapter.isMeetingActive());
```

## Complete Example

```javascript
import { ZoomIntegrationExample } from './services/ZoomIntegrationExample.js';

async function startZoomTranscription() {
  const zoomIntegration = new ZoomIntegrationExample();
  
  try {
    // Initialize
    await zoomIntegration.initialize();
    
    // Meeting configuration
    const meetingConfig = {
      meetingNumber: '123456789',
      password: 'password123',
      userName: 'Transcription Bot',
      signature: await generateSignature(), // Your signature generation
      apiKey: 'your-zoom-api-key'
    };
    
    // Start transcription
    const transcriptionCallback = (result) => {
      console.log('Transcription:', result.text);
      // Process transcription result
    };
    
    await zoomIntegration.startTranscription(meetingConfig, transcriptionCallback);
    
    // Send transcript after meeting
    setTimeout(async () => {
      const transcript = 'Final meeting transcript...';
      await zoomIntegration.sendTranscriptToChat(transcript);
    }, 60000);
    
  } catch (error) {
    console.error('Zoom integration failed:', error);
  }
}
```

## Next Steps

1. **Set up Zoom App**: Create a Zoom App in the Zoom Marketplace for production use
2. **Implement REST API**: Add Zoom REST API integration for enhanced features
3. **Test Integration**: Test with various meeting scenarios and configurations
4. **Deploy**: Deploy your application with proper Zoom SDK integration

For more information, see the [Zoom Web SDK Documentation](https://marketplace.zoom.us/docs/sdk/native-sdks/web).