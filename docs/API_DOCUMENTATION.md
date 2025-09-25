# API Documentation

## Overview

The Teams Meeting Transcription Plugin provides a comprehensive API for real-time speech-to-text transcription, speaker identification, and AI-powered meeting summaries. This document covers all public APIs, interfaces, and integration points.

## Table of Contents

1. [Core APIs](#core-apis)
2. [Configuration APIs](#configuration-apis)
3. [Transcription APIs](#transcription-apis)
4. [Speaker Identification APIs](#speaker-identification-apis)
5. [Summary Generation APIs](#summary-generation-apis)
6. [Storage APIs](#storage-apis)
7. [Error Handling](#error-handling)
8. [Events and Callbacks](#events-and-callbacks)

## Core APIs

### MeetingController

The main orchestrator for all transcription functionality.

```javascript
class MeetingController {
  /**
   * Initialize the meeting controller with platform adapter
   * @param {string} platform - Platform type ('teams', 'zoom', 'meet', etc.)
   * @returns {Promise<void>}
   */
  async initializePlatform(platform)

  /**
   * Start transcription for the current meeting
   * @returns {Promise<void>}
   * @throws {TranscriptionError} When transcription cannot be started
   */
  async startTranscription()

  /**
   * Stop transcription and finalize transcript
   * @returns {Promise<Transcript>}
   */
  async stopTranscription()

  /**
   * Pause transcription temporarily
   * @returns {Promise<void>}
   */
  async pauseTranscription()

  /**
   * Resume paused transcription
   * @returns {Promise<void>}
   */
  async resumeTranscription()

  /**
   * Send transcript to meeting chat
   * @returns {Promise<boolean>} Success status
   */
  async sendTranscriptToChat()

  /**
   * Generate AI summary of the meeting
   * @returns {Promise<Summary>}
   */
  async generateSummary()

  /**
   * Get platform-specific capabilities
   * @returns {PlatformCapabilities}
   */
  getPlatformCapabilities()
}
```

### Platform Adapter Interface

```javascript
class PlatformAdapter {
  /**
   * Detect the current meeting platform
   * @returns {string} Platform identifier
   */
  detectPlatform()

  /**
   * Get current meeting information
   * @returns {Promise<MeetingInfo>}
   */
  async getMeetingInfo()

  /**
   * Get audio stream from the meeting
   * @returns {Promise<MediaStream>}
   */
  async getAudioStream()

  /**
   * Get list of meeting participants
   * @returns {Promise<Participant[]>}
   */
  async getParticipants()

  /**
   * Send message to meeting chat
   * @param {string} message - Message to send
   * @returns {Promise<boolean>} Success status
   */
  async sendMessageToChat(message)

  /**
   * Get meeting agenda if available
   * @returns {Promise<MeetingAgenda|null>}
   */
  async getMeetingAgenda()

  /**
   * Check if current user is meeting host
   * @returns {Promise<boolean>}
   */
  async isHost()
}
```

## Configuration APIs

### ConfigurationManager

```javascript
class ConfigurationManager {
  /**
   * Get user configuration
   * @param {string} userId - User identifier
   * @returns {Promise<UserConfig>}
   */
  async getUserConfig(userId)

  /**
   * Save user configuration
   * @param {string} userId - User identifier
   * @param {UserConfig} config - Configuration object
   * @returns {Promise<void>}
   */
  async saveUserConfig(userId, config)

  /**
   * Get STT service configuration
   * @returns {STTConfig}
   */
  getSTTConfig()

  /**
   * Get AI service configuration
   * @returns {AIConfig}
   */
  getAIConfig()

  /**
   * Validate configuration
   * @param {UserConfig} config - Configuration to validate
   * @returns {ValidationResult}
   */
  validateConfig(config)
}
```

### Configuration Types

```typescript
interface UserConfig {
  sttProvider: STTProvider;
  aiProvider: AIProvider;
  customPrompt?: string;
  apiKeys: Record<string, string>;
  preferences: UserPreferences;
  privacy: PrivacySettings;
}

interface STTConfig {
  provider: STTProvider;
  apiKey?: string;
  endpoint?: string;
  model?: string;
  language: string;
  confidence: number;
}

interface AIConfig {
  provider: AIProvider;
  apiKey?: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

enum STTProvider {
  LOCAL_WHISPER = 'local_whisper',
  OPENAI_WHISPER = 'openai_whisper',
  AZURE_SPEECH = 'azure_speech',
  CLAUDE_SPEECH = 'claude_speech'
}

enum AIProvider {
  OPENAI_GPT = 'openai_gpt',
  CLAUDE = 'claude',
  AZURE_OPENAI = 'azure_openai'
}
```

## Transcription APIs

### TranscriptionEngine

```javascript
class TranscriptionEngine {
  /**
   * Transcribe audio buffer
   * @param {AudioBuffer} audio - Audio data to transcribe
   * @param {STTConfig} config - STT configuration
   * @returns {Promise<TranscriptionResult>}
   */
  async transcribe(audio, config)

  /**
   * Set STT provider
   * @param {STTProvider} provider - Provider to use
   * @returns {void}
   */
  setSTTProvider(provider)

  /**
   * Get available STT providers
   * @returns {STTProvider[]}
   */
  getAvailableProviders()

  /**
   * Start real-time transcription
   * @param {MediaStream} audioStream - Live audio stream
   * @param {function} callback - Callback for transcription results
   * @returns {Promise<void>}
   */
  async startRealTimeTranscription(audioStream, callback)

  /**
   * Stop real-time transcription
   * @returns {Promise<void>}
   */
  async stopRealTimeTranscription()
}
```

### Transcription Types

```typescript
interface TranscriptionResult {
  text: string;
  confidence: number;
  segments: TranscriptionSegment[];
  language?: string;
  processingTime: number;
}

interface TranscriptionSegment {
  id: string;
  text: string;
  startTime: number;
  endTime: number;
  confidence: number;
  speakerId?: string;
}

interface Transcript {
  meetingId: string;
  startTime: Date;
  endTime?: Date;
  segments: TranscriptionSegment[];
  speakers: SpeakerProfile[];
  metadata: MeetingMetadata;
}
```

## Speaker Identification APIs

### SpeakerIdentificationService

```javascript
class SpeakerIdentificationService {
  /**
   * Identify speaker from audio
   * @param {AudioBuffer} audio - Audio sample
   * @returns {Promise<SpeakerResult>}
   */
  async identifySpeaker(audio)

  /**
   * Enroll new speaker
   * @param {string} speakerId - Speaker identifier
   * @param {AudioBuffer[]} audioSamples - Training audio samples
   * @returns {Promise<void>}
   */
  async enrollSpeaker(speakerId, audioSamples)

  /**
   * Get all speaker profiles
   * @returns {SpeakerProfile[]}
   */
  getSpeakerProfiles()

  /**
   * Update speaker profile
   * @param {string} speakerId - Speaker identifier
   * @param {AudioBuffer} audio - Additional audio sample
   * @returns {Promise<void>}
   */
  async updateSpeakerProfile(speakerId, audio)

  /**
   * Remove speaker profile
   * @param {string} speakerId - Speaker identifier
   * @returns {Promise<void>}
   */
  async removeSpeakerProfile(speakerId)
}
```

### Speaker Types

```typescript
interface SpeakerResult {
  speakerId: string;
  confidence: number;
  isNewSpeaker: boolean;
  voiceCharacteristics?: VoiceCharacteristics;
}

interface SpeakerProfile {
  id: string;
  name?: string;
  voiceprint: VoiceprintData;
  participantId?: string;
  enrollmentDate: Date;
  lastSeen: Date;
}

interface VoiceCharacteristics {
  pitch: number;
  tone: string;
  accent?: string;
  gender?: string;
}
```

## Summary Generation APIs

### SummaryService

```javascript
class SummaryService {
  /**
   * Generate meeting summary
   * @param {Transcript} transcript - Meeting transcript
   * @param {MeetingAgenda} agenda - Meeting agenda
   * @param {string} userPrompt - Custom user prompt
   * @returns {Promise<Summary>}
   */
  async generateSummary(transcript, agenda, userPrompt)

  /**
   * Set AI provider for summaries
   * @param {AIProvider} provider - AI provider to use
   * @returns {void}
   */
  setAIProvider(provider)

  /**
   * Save user's custom prompt
   * @param {string} userId - User identifier
   * @param {string} prompt - Custom prompt
   * @returns {Promise<void>}
   */
  async saveUserPrompt(userId, prompt)

  /**
   * Get user's custom prompt
   * @param {string} userId - User identifier
   * @returns {Promise<string|null>}
   */
  async getUserPrompt(userId)

  /**
   * Generate action items from transcript
   * @param {Transcript} transcript - Meeting transcript
   * @returns {Promise<ActionItem[]>}
   */
  async extractActionItems(transcript)
}
```

### Summary Types

```typescript
interface Summary {
  meetingId: string;
  agendaItems: SummarizedItem[];
  actionItems: ActionItem[];
  keyDecisions: Decision[];
  participants: string[];
  duration: number;
  generatedAt: Date;
  generatedBy: string;
}

interface ActionItem {
  id: string;
  description: string;
  assignee?: string;
  dueDate?: Date;
  priority: 'low' | 'medium' | 'high';
  status: 'pending' | 'in-progress' | 'completed';
}

interface Decision {
  id: string;
  description: string;
  context: string;
  participants: string[];
  timestamp: Date;
}
```

## Storage APIs

### TranscriptStorageService

```javascript
class TranscriptStorageService {
  /**
   * Save transcript to local storage
   * @param {Transcript} transcript - Transcript to save
   * @returns {Promise<string>} Transcript ID
   */
  async saveTranscript(transcript)

  /**
   * Retrieve transcript by ID
   * @param {string} transcriptId - Transcript identifier
   * @returns {Promise<Transcript|null>}
   */
  async getTranscript(transcriptId)

  /**
   * Search transcripts
   * @param {SearchQuery} query - Search parameters
   * @returns {Promise<Transcript[]>}
   */
  async searchTranscripts(query)

  /**
   * Delete transcript
   * @param {string} transcriptId - Transcript identifier
   * @returns {Promise<void>}
   */
  async deleteTranscript(transcriptId)

  /**
   * Export transcript
   * @param {string} transcriptId - Transcript identifier
   * @param {ExportFormat} format - Export format
   * @returns {Promise<Blob>}
   */
  async exportTranscript(transcriptId, format)
}
```

### SecureStorageService

```javascript
class SecureStorageService {
  /**
   * Store encrypted data
   * @param {string} key - Storage key
   * @param {any} data - Data to encrypt and store
   * @returns {Promise<void>}
   */
  async setSecureItem(key, data)

  /**
   * Retrieve and decrypt data
   * @param {string} key - Storage key
   * @returns {Promise<any|null>}
   */
  async getSecureItem(key)

  /**
   * Remove encrypted data
   * @param {string} key - Storage key
   * @returns {Promise<void>}
   */
  async removeSecureItem(key)

  /**
   * Clear all encrypted data
   * @returns {Promise<void>}
   */
  async clearSecureStorage()
}
```

## Error Handling

### Error Types

```typescript
class TranscriptionError extends Error {
  constructor(message: string, code: string, details?: any) {
    super(message);
    this.name = 'TranscriptionError';
    this.code = code;
    this.details = details;
  }
}

class AudioError extends Error {
  constructor(message: string, code: string, details?: any) {
    super(message);
    this.name = 'AudioError';
    this.code = code;
    this.details = details;
  }
}

class ConfigurationError extends Error {
  constructor(message: string, code: string, details?: any) {
    super(message);
    this.name = 'ConfigurationError';
    this.code = code;
    this.details = details;
  }
}
```

### Error Codes

```typescript
enum ErrorCodes {
  // Audio Errors
  MICROPHONE_ACCESS_DENIED = 'MICROPHONE_ACCESS_DENIED',
  AUDIO_STREAM_INTERRUPTED = 'AUDIO_STREAM_INTERRUPTED',
  POOR_AUDIO_QUALITY = 'POOR_AUDIO_QUALITY',

  // Transcription Errors
  STT_SERVICE_UNAVAILABLE = 'STT_SERVICE_UNAVAILABLE',
  API_RATE_LIMIT_EXCEEDED = 'API_RATE_LIMIT_EXCEEDED',
  INVALID_API_KEY = 'INVALID_API_KEY',
  TRANSCRIPTION_FAILED = 'TRANSCRIPTION_FAILED',

  // Configuration Errors
  INVALID_CONFIGURATION = 'INVALID_CONFIGURATION',
  MISSING_API_KEY = 'MISSING_API_KEY',
  UNSUPPORTED_PROVIDER = 'UNSUPPORTED_PROVIDER',

  // Platform Errors
  PLATFORM_NOT_SUPPORTED = 'PLATFORM_NOT_SUPPORTED',
  MEETING_NOT_DETECTED = 'MEETING_NOT_DETECTED',
  INSUFFICIENT_PERMISSIONS = 'INSUFFICIENT_PERMISSIONS'
}
```

## Events and Callbacks

### Event System

```javascript
class EventEmitter {
  /**
   * Subscribe to events
   * @param {string} event - Event name
   * @param {function} callback - Event handler
   * @returns {void}
   */
  on(event, callback)

  /**
   * Unsubscribe from events
   * @param {string} event - Event name
   * @param {function} callback - Event handler
   * @returns {void}
   */
  off(event, callback)

  /**
   * Emit event
   * @param {string} event - Event name
   * @param {any} data - Event data
   * @returns {void}
   */
  emit(event, data)
}
```

### Available Events

```typescript
interface Events {
  // Meeting Events
  'meeting:started': MeetingInfo;
  'meeting:ended': MeetingInfo;
  'meeting:participant-joined': Participant;
  'meeting:participant-left': Participant;

  // Transcription Events
  'transcription:started': void;
  'transcription:stopped': Transcript;
  'transcription:paused': void;
  'transcription:resumed': void;
  'transcription:segment': TranscriptionSegment;
  'transcription:error': TranscriptionError;

  // Speaker Events
  'speaker:identified': SpeakerResult;
  'speaker:enrolled': SpeakerProfile;
  'speaker:unknown': AudioBuffer;

  // Summary Events
  'summary:generated': Summary;
  'summary:error': Error;

  // Configuration Events
  'config:changed': UserConfig;
  'config:error': ConfigurationError;
}
```

## Usage Examples

### Basic Transcription

```javascript
import { MeetingController } from './src/client/components/MeetingController.js';

const controller = new MeetingController();

// Initialize for Teams
await controller.initializePlatform('teams');

// Start transcription
controller.on('transcription:segment', (segment) => {
  console.log(`${segment.speakerId}: ${segment.text}`);
});

await controller.startTranscription();

// Stop and get final transcript
const transcript = await controller.stopTranscription();
console.log('Final transcript:', transcript);
```

### Custom Configuration

```javascript
import { ConfigurationManager } from './src/client/services/ConfigurationManager.js';

const configManager = new ConfigurationManager();

const userConfig = {
  sttProvider: 'openai_whisper',
  aiProvider: 'openai_gpt',
  apiKeys: {
    openai: 'your-api-key'
  },
  preferences: {
    language: 'en-US',
    confidence: 0.8
  }
};

await configManager.saveUserConfig('user123', userConfig);
```

### Speaker Identification

```javascript
import { SpeakerIdentificationService } from './src/client/services/SpeakerIdentificationService.js';

const speakerService = new SpeakerIdentificationService();

// Enroll a speaker
const audioSamples = [audioBuffer1, audioBuffer2, audioBuffer3];
await speakerService.enrollSpeaker('john-doe', audioSamples);

// Identify speaker during meeting
const result = await speakerService.identifySpeaker(audioBuffer);
console.log(`Speaker: ${result.speakerId} (confidence: ${result.confidence})`);
```

## Rate Limits and Quotas

### OpenAI Whisper API
- Rate limit: 50 requests per minute
- File size limit: 25 MB
- Audio length limit: 25 minutes

### Azure Speech Services
- Rate limit: 20 transactions per second
- File size limit: 200 MB
- Audio length limit: 10 hours

### Claude API
- Rate limit: 1000 requests per minute
- Token limit: 100,000 tokens per request

## Security Considerations

### API Key Management
- Store API keys securely using SecureStorageService
- Never log or expose API keys in client-side code
- Rotate API keys regularly
- Use environment variables for development

### Data Encryption
- All stored transcripts are encrypted using AES-256
- API keys are encrypted before storage
- Secure key derivation using PBKDF2

### Privacy Controls
- Local-only processing mode available
- User consent required for cloud services
- Automatic data deletion options
- GDPR compliance features

## Troubleshooting

### Common Issues

1. **Microphone Access Denied**
   - Check browser permissions
   - Ensure HTTPS connection
   - Verify Teams app permissions

2. **Transcription Not Starting**
   - Verify API keys are configured
   - Check network connectivity
   - Ensure meeting is active

3. **Poor Transcription Quality**
   - Check audio input levels
   - Reduce background noise
   - Try different STT provider

4. **Speaker Identification Failing**
   - Ensure sufficient enrollment audio
   - Check for overlapping speech
   - Verify audio quality

For more troubleshooting information, see the [Troubleshooting Guide](./TROUBLESHOOTING.md).