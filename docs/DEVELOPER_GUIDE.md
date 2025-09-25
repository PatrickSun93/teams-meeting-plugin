# Developer Guide

## Overview

This guide provides comprehensive information for developers who want to extend, customize, or contribute to the Teams Meeting Transcription Plugin. It covers architecture, APIs, development setup, and extension patterns.

## Table of Contents

1. [Development Environment Setup](#development-environment-setup)
2. [Architecture Overview](#architecture-overview)
3. [Core Components](#core-components)
4. [Extension Points](#extension-points)
5. [Adding New STT Providers](#adding-new-stt-providers)
6. [Adding New AI Providers](#adding-new-ai-providers)
7. [Custom Platform Adapters](#custom-platform-adapters)
8. [Plugin Development](#plugin-development)
9. [Testing Guidelines](#testing-guidelines)
10. [Deployment and Distribution](#deployment-and-distribution)

## Development Environment Setup

### Prerequisites

```bash
# Required software
Node.js 18+ 
npm 8+
Git
Visual Studio Code (recommended)

# Optional but recommended
Docker Desktop
Teams Toolkit for VS Code
```

### Initial Setup

1. **Clone the Repository**
   ```bash
   git clone https://github.com/your-org/teams-transcription-plugin.git
   cd teams-transcription-plugin
   ```

2. **Install Dependencies**
   ```bash
   npm install
   ```

3. **Environment Configuration**
   ```bash
   cp .env.example .env
   # Edit .env with your development settings
   ```

4. **Development Server**
   ```bash
   npm run dev
   # Opens development server on http://localhost:3000
   ```

### Development Tools

**VS Code Extensions:**
```json
{
  "recommendations": [
    "ms-teams-vscode-extension.teams-toolkit",
    "ms-vscode.vscode-typescript-next",
    "esbenp.prettier-vscode",
    "ms-vscode.vscode-eslint",
    "bradlc.vscode-tailwindcss"
  ]
}
```

**Package Scripts:**
```json
{
  "scripts": {
    "dev": "webpack serve --mode development",
    "build": "webpack --mode production",
    "test": "jest",
    "test:watch": "jest --watch",
    "test:e2e": "playwright test",
    "lint": "eslint src/",
    "format": "prettier --write src/",
    "package": "node scripts/package-teams-app.js"
  }
}
```

## Architecture Overview

### High-Level Architecture

```
┌─────────────────────────────────────┐
│           Presentation Layer        │
│        (React Components)           │
├─────────────────────────────────────┤
│         Business Logic Layer        │
│      (Services & Controllers)       │
├─────────────────────────────────────┤
│        Platform Abstraction         │
│         (Adapters & APIs)           │
├─────────────────────────────────────┤
│         External Services           │
│    (STT, AI, Storage Providers)     │
└─────────────────────────────────────┘
```

### Module Structure

```
src/
├── client/                 # Frontend React application
│   ├── components/         # React components
│   ├── hooks/             # Custom React hooks
│   ├── services/          # Business logic services
│   └── utils/             # Utility functions
├── server/                # Backend Node.js server (optional)
├── teams/                 # Teams-specific integration
├── shared/                # Shared types and utilities
└── tests/                 # Test files
```

### Key Design Patterns

1. **Adapter Pattern**: Platform abstraction for different meeting platforms
2. **Strategy Pattern**: Pluggable STT and AI providers
3. **Observer Pattern**: Event-driven architecture for real-time updates
4. **Factory Pattern**: Service instantiation and configuration
5. **Singleton Pattern**: Configuration and state management

## Core Components

### MeetingController

The central orchestrator that manages the entire transcription workflow.

```typescript
// src/client/components/MeetingController.js
class MeetingController extends EventEmitter {
  constructor(config) {
    super();
    this.config = config;
    this.platformAdapter = null;
    this.transcriptionEngine = null;
    this.speakerService = null;
    this.summaryService = null;
    this.state = 'idle';
  }

  async initializePlatform(platform) {
    this.platformAdapter = PlatformAdapterFactory.create(platform);
    await this.platformAdapter.initialize();
    this.emit('platform:initialized', platform);
  }

  async startTranscription() {
    try {
      this.state = 'starting';
      const audioStream = await this.platformAdapter.getAudioStream();
      await this.transcriptionEngine.startRealTimeTranscription(
        audioStream, 
        this.handleTranscriptionSegment.bind(this)
      );
      this.state = 'active';
      this.emit('transcription:started');
    } catch (error) {
      this.state = 'error';
      this.emit('transcription:error', error);
    }
  }

  handleTranscriptionSegment(segment) {
    // Process transcription segment
    this.emit('transcription:segment', segment);
  }
}
```

### Service Architecture

Services follow a consistent interface pattern:

```typescript
// Base service interface
interface IService {
  initialize(config: any): Promise<void>;
  isAvailable(): boolean;
  getCapabilities(): ServiceCapabilities;
}

// Example: STT Service
interface ISTTService extends IService {
  transcribe(audio: AudioBuffer): Promise<TranscriptionResult>;
  startRealTimeTranscription(stream: MediaStream, callback: Function): Promise<void>;
  stopRealTimeTranscription(): Promise<void>;
}
```

## Extension Points

### 1. Custom STT Providers

Create new STT providers by implementing the `ISTTService` interface:

```typescript
// src/client/services/stt-providers/CustomSTTProvider.js
class CustomSTTProvider {
  constructor(config) {
    this.config = config;
    this.isInitialized = false;
  }

  async initialize(config) {
    // Initialize your STT service
    this.apiKey = config.apiKey;
    this.endpoint = config.endpoint;
    this.isInitialized = true;
  }

  isAvailable() {
    return this.isInitialized && this.apiKey;
  }

  getCapabilities() {
    return {
      realTime: true,
      languages: ['en-US', 'es-ES', 'fr-FR'],
      maxAudioLength: 300, // seconds
      supportedFormats: ['wav', 'mp3', 'flac']
    };
  }

  async transcribe(audioBuffer) {
    if (!this.isAvailable()) {
      throw new Error('STT service not available');
    }

    try {
      const response = await fetch(`${this.endpoint}/transcribe`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'audio/wav'
        },
        body: audioBuffer
      });

      const result = await response.json();
      
      return {
        text: result.transcript,
        confidence: result.confidence,
        segments: result.segments || [],
        language: result.language,
        processingTime: result.processing_time
      };
    } catch (error) {
      throw new TranscriptionError('Custom STT failed', 'STT_SERVICE_ERROR', error);
    }
  }

  async startRealTimeTranscription(audioStream, callback) {
    // Implement real-time transcription
    const audioContext = new AudioContext();
    const source = audioContext.createMediaStreamSource(audioStream);
    
    // Set up audio processing pipeline
    const processor = audioContext.createScriptProcessor(4096, 1, 1);
    processor.onaudioprocess = async (event) => {
      const audioData = event.inputBuffer.getChannelData(0);
      const result = await this.processAudioChunk(audioData);
      if (result) {
        callback(result);
      }
    };

    source.connect(processor);
    processor.connect(audioContext.destination);
  }

  async processAudioChunk(audioData) {
    // Process audio chunk and return transcription
    // Implementation depends on your STT service
  }
}

// Register the provider
STTProviderRegistry.register('custom_stt', CustomSTTProvider);
```

### 2. Custom AI Providers

Add new AI providers for summary generation:

```typescript
// src/client/services/ai-providers/CustomAIProvider.js
class CustomAIProvider {
  constructor(config) {
    this.config = config;
  }

  async initialize(config) {
    this.apiKey = config.apiKey;
    this.model = config.model || 'default';
  }

  async generateSummary(transcript, agenda, customPrompt) {
    const prompt = this.buildPrompt(transcript, agenda, customPrompt);
    
    try {
      const response = await fetch(`${this.config.endpoint}/generate`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: this.model,
          prompt: prompt,
          max_tokens: 1000,
          temperature: 0.7
        })
      });

      const result = await response.json();
      
      return {
        summary: result.text,
        actionItems: this.extractActionItems(result.text),
        keyDecisions: this.extractDecisions(result.text),
        confidence: result.confidence
      };
    } catch (error) {
      throw new SummaryError('Custom AI generation failed', 'AI_SERVICE_ERROR', error);
    }
  }

  buildPrompt(transcript, agenda, customPrompt) {
    // Build prompt based on transcript and agenda
    let prompt = customPrompt || this.getDefaultPrompt();
    
    if (agenda) {
      prompt += `\n\nMeeting Agenda:\n${this.formatAgenda(agenda)}`;
    }
    
    prompt += `\n\nTranscript:\n${this.formatTranscript(transcript)}`;
    
    return prompt;
  }

  getDefaultPrompt() {
    return `Please provide a concise summary of this meeting, including:
    1. Key discussion points
    2. Decisions made
    3. Action items with assignees
    4. Next steps`;
  }
}

// Register the provider
AIProviderRegistry.register('custom_ai', CustomAIProvider);
```

### 3. Platform Adapters

Create adapters for new meeting platforms:

```typescript
// src/client/adapters/CustomPlatformAdapter.js
class CustomPlatformAdapter {
  constructor() {
    this.platform = 'custom_platform';
    this.capabilities = {
      supportsChatIntegration: true,
      supportsAgendaAccess: false,
      supportsParticipantInfo: true,
      supportsHostDetection: true,
      audioQuality: 'high'
    };
  }

  detectPlatform() {
    // Detect if we're running on your platform
    return window.location.hostname.includes('yourplatform.com');
  }

  async initialize() {
    // Initialize platform-specific APIs
    if (typeof window.YourPlatformAPI !== 'undefined') {
      this.api = window.YourPlatformAPI;
      await this.api.initialize();
    } else {
      throw new Error('Platform API not available');
    }
  }

  async getMeetingInfo() {
    const meetingData = await this.api.getCurrentMeeting();
    
    return {
      id: meetingData.id,
      title: meetingData.title,
      platform: this.platform,
      startTime: new Date(meetingData.startTime),
      participants: meetingData.participants.map(p => ({
        id: p.id,
        name: p.displayName,
        role: p.role
      }))
    };
  }

  async getAudioStream() {
    // Get audio stream from platform
    return await this.api.getAudioStream();
  }

  async sendMessageToChat(message) {
    try {
      await this.api.sendChatMessage(message);
      return true;
    } catch (error) {
      console.error('Failed to send chat message:', error);
      return false;
    }
  }

  async isHost() {
    const userRole = await this.api.getCurrentUserRole();
    return userRole === 'host' || userRole === 'co-host';
  }
}

// Register the adapter
PlatformAdapterRegistry.register('custom_platform', CustomPlatformAdapter);
```

## Adding New STT Providers

### Step-by-Step Guide

1. **Create Provider Class**
   ```typescript
   // src/client/services/stt-providers/NewSTTProvider.js
   class NewSTTProvider extends BaseSTTProvider {
     // Implement required methods
   }
   ```

2. **Add Configuration Schema**
   ```typescript
   // src/client/config/stt-providers.js
   export const STT_PROVIDERS = {
     // ... existing providers
     new_stt: {
       name: 'New STT Service',
       description: 'Description of your STT service',
       configSchema: {
         apiKey: { type: 'string', required: true },
         endpoint: { type: 'string', required: false },
         model: { type: 'string', required: false }
       },
       capabilities: {
         realTime: true,
         languages: ['en-US', 'es-ES'],
         maxAudioLength: 600
       }
     }
   };
   ```

3. **Add UI Configuration**
   ```jsx
   // src/client/components/ConfigurationPanel.js
   const renderSTTProviderConfig = (provider) => {
     switch (provider) {
       case 'new_stt':
         return <NewSTTProviderConfig />;
       // ... other cases
     }
   };
   ```

4. **Register Provider**
   ```typescript
   // src/client/services/STTProviderRegistry.js
   import NewSTTProvider from './stt-providers/NewSTTProvider.js';
   
   STTProviderRegistry.register('new_stt', NewSTTProvider);
   ```

5. **Add Tests**
   ```typescript
   // src/client/services/__tests__/NewSTTProvider.test.js
   describe('NewSTTProvider', () => {
     test('should transcribe audio correctly', async () => {
       // Test implementation
     });
   });
   ```

### Provider Interface Requirements

```typescript
interface ISTTProvider {
  // Required methods
  initialize(config: STTConfig): Promise<void>;
  isAvailable(): boolean;
  getCapabilities(): STTCapabilities;
  transcribe(audio: AudioBuffer): Promise<TranscriptionResult>;
  
  // Optional methods for real-time transcription
  startRealTimeTranscription?(stream: MediaStream, callback: Function): Promise<void>;
  stopRealTimeTranscription?(): Promise<void>;
  
  // Optional methods for advanced features
  setLanguage?(language: string): void;
  getAvailableLanguages?(): string[];
  getSupportedFormats?(): string[];
}
```

## Adding New AI Providers

### Implementation Steps

1. **Create AI Provider Class**
   ```typescript
   // src/client/services/ai-providers/NewAIProvider.js
   class NewAIProvider extends BaseAIProvider {
     async generateSummary(transcript, agenda, prompt) {
       // Implementation
     }
     
     async extractActionItems(transcript) {
       // Implementation
     }
     
     async extractKeyDecisions(transcript) {
       // Implementation
     }
   }
   ```

2. **Add Provider Configuration**
   ```typescript
   // src/client/config/ai-providers.js
   export const AI_PROVIDERS = {
     new_ai: {
       name: 'New AI Service',
       description: 'Advanced AI for meeting summaries',
       configSchema: {
         apiKey: { type: 'string', required: true },
         model: { 
           type: 'select', 
           options: ['model-1', 'model-2'],
           default: 'model-1'
         }
       },
       capabilities: {
         maxTokens: 4000,
         supportedLanguages: ['en', 'es', 'fr'],
         features: ['summary', 'action-items', 'decisions']
       }
     }
   };
   ```

3. **Register and Test**
   ```typescript
   // Register
   AIProviderRegistry.register('new_ai', NewAIProvider);
   
   // Test
   describe('NewAIProvider', () => {
     test('should generate quality summaries', async () => {
       // Test implementation
     });
   });
   ```

## Custom Platform Adapters

### Creating Platform Adapters

1. **Detect Platform**
   ```typescript
   class MyPlatformAdapter extends BasePlatformAdapter {
     static detect() {
       return window.location.hostname.includes('myplatform.com') &&
              typeof window.MyPlatformAPI !== 'undefined';
     }
   }
   ```

2. **Implement Required Methods**
   ```typescript
   async getMeetingInfo() {
     // Return standardized meeting info
   }
   
   async getAudioStream() {
     // Return MediaStream for audio
   }
   
   async getParticipants() {
     // Return participant list
   }
   ```

3. **Handle Platform-Specific Features**
   ```typescript
   getCapabilities() {
     return {
       supportsChatIntegration: this.api.hasChatAPI(),
       supportsAgendaAccess: this.api.hasCalendarAPI(),
       supportsParticipantInfo: true,
       supportsHostDetection: true,
       audioQuality: 'high'
     };
   }
   ```

## Plugin Development

### Creating Extension Plugins

The plugin system allows extending functionality without modifying core code:

```typescript
// src/plugins/MyCustomPlugin.js
class MyCustomPlugin {
  constructor(pluginManager) {
    this.pluginManager = pluginManager;
    this.name = 'MyCustomPlugin';
    this.version = '1.0.0';
  }

  async initialize() {
    // Register event listeners
    this.pluginManager.on('transcription:segment', this.handleSegment.bind(this));
    
    // Add UI components
    this.pluginManager.addComponent('sidebar', MyCustomSidebar);
    
    // Register custom commands
    this.pluginManager.registerCommand('my-command', this.executeCommand.bind(this));
  }

  handleSegment(segment) {
    // Process transcription segments
    if (this.shouldProcessSegment(segment)) {
      this.processSegment(segment);
    }
  }

  executeCommand(args) {
    // Handle custom command
    console.log('Executing custom command with args:', args);
  }

  async cleanup() {
    // Cleanup when plugin is disabled
    this.pluginManager.removeAllListeners(this);
  }
}

// Register plugin
PluginManager.register(MyCustomPlugin);
```

### Plugin Manifest

```json
{
  "name": "my-custom-plugin",
  "version": "1.0.0",
  "description": "Custom functionality for transcription",
  "author": "Your Name",
  "main": "MyCustomPlugin.js",
  "dependencies": {
    "transcription-plugin": "^1.0.0"
  },
  "permissions": [
    "transcription:read",
    "ui:modify",
    "storage:write"
  ],
  "hooks": {
    "transcription:segment": "handleSegment",
    "meeting:started": "onMeetingStart"
  }
}
```

## Testing Guidelines

### Unit Testing

```typescript
// src/client/services/__tests__/TranscriptionEngine.test.js
import { TranscriptionEngine } from '../TranscriptionEngine.js';
import { MockSTTProvider } from '../../__mocks__/MockSTTProvider.js';

describe('TranscriptionEngine', () => {
  let engine;
  let mockProvider;

  beforeEach(() => {
    mockProvider = new MockSTTProvider();
    engine = new TranscriptionEngine();
    engine.setSTTProvider(mockProvider);
  });

  test('should transcribe audio successfully', async () => {
    const audioBuffer = createMockAudioBuffer();
    const result = await engine.transcribe(audioBuffer);
    
    expect(result.text).toBeDefined();
    expect(result.confidence).toBeGreaterThan(0);
  });

  test('should handle transcription errors gracefully', async () => {
    mockProvider.setError(new Error('API Error'));
    
    await expect(engine.transcribe(audioBuffer))
      .rejects.toThrow('API Error');
  });
});
```

### Integration Testing

```typescript
// tests/integration/transcription-workflow.test.js
describe('Transcription Workflow Integration', () => {
  test('should complete full transcription workflow', async () => {
    const controller = new MeetingController();
    await controller.initializePlatform('teams');
    
    // Mock meeting start
    const meetingInfo = await controller.startMeeting();
    expect(meetingInfo).toBeDefined();
    
    // Start transcription
    await controller.startTranscription();
    expect(controller.state).toBe('active');
    
    // Simulate audio input
    const audioStream = createMockAudioStream();
    await controller.processAudio(audioStream);
    
    // Verify transcription output
    const transcript = controller.getCurrentTranscript();
    expect(transcript.segments).toHaveLength(1);
  });
});
```

### E2E Testing with Playwright

```typescript
// tests/e2e/meeting-transcription.spec.js
import { test, expect } from '@playwright/test';

test('should transcribe meeting successfully', async ({ page }) => {
  // Navigate to Teams meeting
  await page.goto('https://teams.microsoft.com/meeting/...');
  
  // Wait for plugin to load
  await page.waitForSelector('[data-testid="transcription-plugin"]');
  
  // Start transcription
  await page.click('[data-testid="start-transcription"]');
  
  // Verify transcription is active
  await expect(page.locator('[data-testid="transcription-status"]'))
    .toHaveText('Active');
  
  // Simulate speaking (using mock audio)
  await page.evaluate(() => {
    window.mockAudioInput('Hello, this is a test meeting');
  });
  
  // Verify transcription appears
  await expect(page.locator('[data-testid="transcript-text"]'))
    .toContainText('Hello, this is a test meeting');
});
```

### Performance Testing

```typescript
// tests/performance/audio-processing.performance.test.js
describe('Audio Processing Performance', () => {
  test('should process audio within acceptable time limits', async () => {
    const audioProcessor = new AudioProcessor();
    const largeAudioBuffer = createLargeAudioBuffer(60); // 60 seconds
    
    const startTime = performance.now();
    const result = await audioProcessor.processAudio(largeAudioBuffer);
    const endTime = performance.now();
    
    const processingTime = endTime - startTime;
    expect(processingTime).toBeLessThan(5000); // Should process within 5 seconds
    expect(result.quality).toBeGreaterThan(0.8);
  });
});
```

## Deployment and Distribution

### Building for Production

```bash
# Build optimized bundle
npm run build

# Package Teams app
npm run package

# Run tests
npm test

# Generate documentation
npm run docs
```

### Teams App Packaging

```typescript
// scripts/package-teams-app.js
const fs = require('fs');
const archiver = require('archiver');

async function packageTeamsApp() {
  const output = fs.createWriteStream('teams-transcription-app.zip');
  const archive = archiver('zip', { zlib: { level: 9 } });

  archive.pipe(output);
  
  // Add manifest
  archive.file('manifest.json', { name: 'manifest.json' });
  
  // Add icons
  archive.file('assets/icon-color.svg', { name: 'icon-color.svg' });
  archive.file('assets/icon-outline.svg', { name: 'icon-outline.svg' });
  
  // Add built application
  archive.directory('dist/', false);
  
  await archive.finalize();
  console.log('Teams app package created successfully');
}
```

### CI/CD Pipeline

```yaml
# .github/workflows/build-and-test.yml
name: Build and Test

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main ]

jobs:
  test:
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Setup Node.js
      uses: actions/setup-node@v3
      with:
        node-version: '18'
        cache: 'npm'
    
    - name: Install dependencies
      run: npm ci
    
    - name: Run tests
      run: npm test
    
    - name: Run E2E tests
      run: npm run test:e2e
    
    - name: Build application
      run: npm run build
    
    - name: Package Teams app
      run: npm run package
    
    - name: Upload artifacts
      uses: actions/upload-artifact@v3
      with:
        name: teams-app-package
        path: teams-transcription-app.zip
```

### Distribution Strategies

1. **Teams App Store**
   - Submit to Microsoft for review
   - Public distribution
   - Automatic updates

2. **Organization Catalog**
   - Deploy to enterprise catalog
   - IT-controlled distribution
   - Custom approval workflows

3. **Sideloading**
   - Direct installation
   - Development and testing
   - Manual distribution

### Version Management

```json
{
  "version": "1.2.3",
  "manifestVersion": "1.14",
  "updateUrl": "https://your-domain.com/updates/manifest.json",
  "changelog": {
    "1.2.3": [
      "Added new STT provider support",
      "Improved speaker identification accuracy",
      "Fixed chat integration issues"
    ]
  }
}
```

## Best Practices

### Code Organization

1. **Modular Architecture**: Keep components focused and loosely coupled
2. **Interface Segregation**: Use specific interfaces for different concerns
3. **Dependency Injection**: Make dependencies explicit and testable
4. **Error Boundaries**: Implement proper error handling at all levels

### Performance Optimization

1. **Lazy Loading**: Load components and services on demand
2. **Memory Management**: Clean up resources and event listeners
3. **Caching**: Cache API responses and computed results
4. **Debouncing**: Limit API calls and expensive operations

### Security Considerations

1. **API Key Security**: Never expose keys in client code
2. **Input Validation**: Validate all user inputs and API responses
3. **CORS Configuration**: Properly configure cross-origin requests
4. **Content Security Policy**: Implement CSP headers

### Documentation Standards

1. **JSDoc Comments**: Document all public APIs
2. **README Files**: Provide clear setup and usage instructions
3. **Architecture Diagrams**: Visual representation of system design
4. **API Documentation**: Comprehensive API reference

## Contributing Guidelines

### Code Style

```javascript
// Use ESLint and Prettier for consistent formatting
// Follow these naming conventions:
// - Classes: PascalCase
// - Functions/Variables: camelCase
// - Constants: UPPER_SNAKE_CASE
// - Files: kebab-case

class TranscriptionEngine {
  constructor(config) {
    this.config = config;
  }

  async transcribeAudio(audioBuffer) {
    // Implementation
  }
}
```

### Pull Request Process

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open Pull Request

### Issue Reporting

Use the provided issue templates:
- Bug reports
- Feature requests
- Performance issues
- Documentation improvements

For more information, see the [Contributing Guide](./CONTRIBUTING.md).