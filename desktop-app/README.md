# Universal Meeting Transcription Desktop App

A cross-platform desktop application built with Electron that provides real-time meeting transcription for any video conferencing platform.

## Features

- **Universal Platform Support**: Works with Teams, Zoom, Google Meet, Webex, Skype, and any other meeting platform
- **System-Level Audio Capture**: Captures audio from any application using system audio routing
- **Intelligent Platform Detection**: Automatically detects which meeting platform you're using
- **Multiple STT Providers**: Supports local Whisper models and cloud services (OpenAI, Azure, Claude)
- **Speaker Identification**: Identifies different speakers in the meeting
- **Screen Analysis**: Optional screen analysis to detect meeting state and UI elements
- **File Export**: Export transcripts in multiple formats (TXT, JSON, PDF, DOCX)
- **Auto-Updates**: Built-in auto-updater for seamless updates
- **Privacy-Focused**: Local processing options for sensitive meetings

## Installation

### Prerequisites

- Node.js 18 or higher
- npm or yarn package manager

### Development Setup

1. Clone the repository:
```bash
git clone <repository-url>
cd desktop-app
```

2. Install dependencies:
```bash
npm install
```

3. Start development server:
```bash
npm run dev
```

### Building for Production

Build for all platforms:
```bash
npm run build
```

Build for specific platforms:
```bash
npm run build:win    # Windows
npm run build:mac    # macOS
npm run build:linux  # Linux
```

## Usage

### Basic Operation

1. **Launch the Application**: Start the desktop app
2. **Platform Detection**: The app will automatically detect your meeting platform, or you can select it manually
3. **Audio Setup**: Select your audio input device (microphone or system audio)
4. **Start Recording**: Click "Start Recording" to begin transcription
5. **View Transcription**: See real-time transcription with speaker identification
6. **Export Results**: Export the transcript when the meeting ends

### Platform-Specific Setup

#### System Audio Capture (Recommended)

For best results, set up system audio capture to record the meeting audio directly:

**Windows:**
- Install VB-Audio Virtual Cable or similar
- Set virtual cable as default playback device
- Set virtual cable as input device in the app

**macOS:**
- Install BlackHole or SoundFlower
- Create multi-output device in Audio MIDI Setup
- Select the virtual device in the app

**Linux:**
- Use PulseAudio or ALSA loopback
- Configure audio routing to capture system audio

#### Manual Platform Selection

If auto-detection doesn't work:
1. Open the platform dropdown
2. Select your meeting platform manually
3. The app will adapt its features accordingly

### Configuration

#### STT (Speech-to-Text) Settings

- **Local Processing**: Use Whisper.js for privacy-focused transcription
- **Cloud Services**: Configure API keys for OpenAI, Azure, or Claude
- **Language**: Select the primary language for transcription
- **Speaker Identification**: Enable/disable speaker diarization

#### Audio Settings

- **Sample Rate**: Choose audio quality (16kHz recommended for STT)
- **Noise Reduction**: Enable audio preprocessing
- **Audio Quality**: Balance between speed and accuracy

#### Platform Settings

- **Auto-Detection**: Enable automatic platform detection
- **Screen Analysis**: Use OCR to detect meeting state (optional)
- **Detection Interval**: How often to check for platform changes

#### Export Settings

- **Default Format**: Choose default export format
- **Include Timestamps**: Add timestamps to transcripts
- **Speaker Labels**: Include speaker identification in exports

#### Privacy Settings

- **Local Processing**: Prefer local STT models
- **Data Retention**: How long to keep transcripts
- **Analytics**: Enable/disable usage analytics

## Architecture

### Core Components

- **Main Process** (`src/main.js`): Electron main process, handles system integration
- **Renderer Process** (`renderer/`): Frontend UI built with HTML/CSS/JavaScript
- **Audio Capture Manager**: System-level audio capture and processing
- **Platform Detector**: Automatic detection of meeting platforms
- **Screen Analyzer**: OCR-based screen analysis for meeting state
- **Transcription Service**: STT processing with multiple provider support
- **Configuration Manager**: Settings and preferences management

### Service Architecture

```
┌─────────────────────────────────────┐
│           Desktop App UI            │
│        (Electron Renderer)          │
├─────────────────────────────────────┤
│         Main Process                │
│      (Electron Main + Node.js)      │
├─────────────────────────────────────┤
│  Audio Capture │ Platform Detection │
│  Screen Analysis │ Transcription     │
├─────────────────────────────────────┤
│        System Integration           │
│   (Audio, Screen, Process APIs)     │
└─────────────────────────────────────┘
```

### Platform Detection Methods

1. **Process Detection**: Scans running processes for meeting applications
2. **Window Detection**: Analyzes window titles and properties
3. **Screen Analysis**: Uses OCR to identify meeting UI elements
4. **Manual Selection**: User-specified platform override

## API Reference

### Main Process IPC Handlers

#### Configuration
- `get-config`: Retrieve current configuration
- `save-config`: Save configuration changes

#### Platform Detection
- `detect-platform`: Detect current meeting platform
- `get-available-platforms`: Get list of supported platforms
- `set-manual-platform`: Override platform detection

#### Audio Capture
- `start-audio-capture`: Begin audio recording
- `stop-audio-capture`: Stop audio recording
- `get-audio-devices`: List available audio devices

#### Meeting Control
- `start-meeting-transcription`: Start full meeting transcription
- `stop-meeting-transcription`: Stop transcription and save results

#### Export
- `export-transcript`: Export transcript to file
- `get-meeting-history`: Retrieve past meetings
- `delete-meeting`: Remove meeting from history

### Events

#### Transcription Events
- `transcript-update`: New transcript segment available
- `transcription-started`: Transcription session began
- `transcription-stopped`: Transcription session ended
- `transcription-error`: Error during transcription

#### Platform Events
- `platform-detected`: Platform automatically detected
- `platform-changed`: Platform selection changed

#### Update Events
- `update-available`: New version available
- `update-downloaded`: Update ready to install

## Testing

### Unit Tests
```bash
npm test
```

### End-to-End Tests
```bash
npm run test:e2e
```

### Test Coverage
```bash
npm run test:coverage
```

## Troubleshooting

### Common Issues

#### Audio Capture Not Working
- Check audio device permissions
- Verify system audio routing
- Try different audio devices
- Check sample rate compatibility

#### Platform Detection Failing
- Enable manual platform selection
- Check if meeting application is running
- Verify window titles and process names
- Enable debug logging for more details

#### Transcription Errors
- Verify API keys for cloud services
- Check internet connection
- Try local STT as fallback
- Ensure audio quality is sufficient

#### Performance Issues
- Reduce audio quality settings
- Disable screen analysis
- Use local STT instead of cloud
- Close unnecessary applications

### Debug Mode

Enable debug logging in Advanced Settings or set environment variable:
```bash
NODE_ENV=development npm start
```

### Log Files

Logs are stored in:
- **Windows**: `%APPDATA%/meeting-transcription/logs/`
- **macOS**: `~/Library/Logs/meeting-transcription/`
- **Linux**: `~/.config/meeting-transcription/logs/`

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Run the test suite
6. Submit a pull request

### Development Guidelines

- Follow existing code style
- Add unit tests for new features
- Update documentation
- Test on multiple platforms
- Ensure accessibility compliance

## License

MIT License - see LICENSE file for details

## Security

### Data Privacy

- Transcripts are stored locally by default
- API keys are encrypted in configuration
- Optional cloud processing with user consent
- Automatic data cleanup based on retention settings

### Security Features

- Secure API key storage
- Local processing options
- No data transmission without consent
- Regular security updates via auto-updater

## Support

For issues and questions:
- Check the troubleshooting section
- Review existing GitHub issues
- Create a new issue with detailed information
- Include log files and system information