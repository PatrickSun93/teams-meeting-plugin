# Google Meet Transcription Browser Extension

A Chrome/Firefox browser extension that provides real-time speech-to-text transcription, speaker identification, and AI-powered meeting summaries for Google Meet meetings.

## Features

- 🎤 **Real-time Transcription**: Live speech-to-text during Google Meet meetings
- 👥 **Speaker Identification**: Automatic speaker detection and labeling
- 🤖 **AI-Powered Summaries**: Generate meeting summaries with custom prompts
- 📅 **Calendar Integration**: Access meeting agendas from Google Calendar
- 🔒 **Privacy-Focused**: Local processing options with Whisper.js
- 📤 **Export Options**: Save transcripts in multiple formats (PDF, Word, Text)
- ⚙️ **Configurable**: Multiple STT and AI providers (OpenAI, Claude, Azure)

## Installation

### From Chrome Web Store (Recommended)
1. Visit the Chrome Web Store (link coming soon)
2. Click "Add to Chrome"
3. Follow the installation prompts

### Manual Installation (Development)
1. Download or clone this repository
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" in the top right
4. Click "Load unpacked" and select the `browser-extension` folder
5. The extension will appear in your extensions list

### Firefox Installation
1. Download the `.xpi` file from releases
2. Open Firefox and navigate to `about:addons`
3. Click the gear icon and select "Install Add-on From File"
4. Select the downloaded `.xpi` file

## Setup

### 1. Configure STT Provider
1. Click the extension icon in your browser toolbar
2. Click "Settings" to open the options page
3. Choose your preferred Speech-to-Text provider:
   - **Local Whisper**: Privacy-focused, runs locally (no API key needed)
   - **OpenAI Whisper**: High accuracy, requires OpenAI API key
   - **Azure Speech**: Enterprise-grade, requires Azure credentials

### 2. Configure AI Provider (for summaries)
1. In the settings page, select your AI provider:
   - **OpenAI GPT**: Requires OpenAI API key
   - **Claude**: Requires Anthropic API key
   - **Azure OpenAI**: Requires Azure OpenAI credentials

### 3. Google Calendar Integration (Optional)
1. Enable "Google Calendar Integration" in settings
2. Click "Authorize Google Calendar" to grant permissions
3. This allows the extension to access meeting agendas

## Usage

### Starting Transcription
1. Join a Google Meet meeting
2. Click the extension icon or use the in-meeting controls
3. Click "Start Transcription" to begin
4. The transcription panel will appear on the right side

### Viewing Transcripts
- Real-time transcription appears in the side panel
- Speaker names are automatically detected and labeled
- Confidence scores show transcription accuracy

### Generating Summaries
- Summaries are automatically generated when meetings end
- Customize summary prompts in the settings
- Summaries focus on agenda items when available

### Exporting Transcripts
- Click "Export" in the transcription panel
- Choose from PDF, Word, or text formats
- Files are automatically downloaded

## Configuration Options

### General Settings
- **Auto-start transcription**: Begin transcription automatically when joining meetings
- **Show confidence scores**: Display transcription accuracy indicators
- **Privacy mode**: Use only local processing (no cloud services)

### STT Providers
- **Local Whisper**: Runs entirely in your browser, no data sent to servers
- **OpenAI Whisper**: High accuracy, requires API key and internet connection
- **Azure Speech**: Enterprise features, requires Azure subscription

### AI Providers
- **OpenAI GPT**: Advanced summarization with GPT-4
- **Claude**: Anthropic's AI with strong reasoning capabilities
- **Azure OpenAI**: Enterprise-grade AI with compliance features

### Export & Storage
- **Default export format**: Choose PDF, Word, or text
- **Storage duration**: How long to keep transcripts locally
- **Auto-export**: Automatically download transcripts after meetings

## Privacy & Security

### Data Handling
- **Local Processing**: When using Local Whisper, no audio leaves your device
- **Encrypted Storage**: All stored transcripts are encrypted locally
- **No Persistent Storage**: Audio is processed in real-time and not stored
- **API Key Security**: API keys are stored securely in browser storage

### Permissions
The extension requires these permissions:
- **activeTab**: Access to Google Meet pages for transcription
- **storage**: Save settings and transcripts locally
- **identity**: Google Calendar integration (optional)
- **microphone**: Capture audio for transcription

### Privacy Mode
Enable Privacy Mode to:
- Use only local STT processing
- Disable all cloud service integrations
- Keep all data on your device

## Troubleshooting

### Common Issues

**Transcription not starting**
- Check microphone permissions in browser settings
- Ensure you're on a Google Meet page
- Try refreshing the page and rejoining the meeting

**Poor transcription quality**
- Check your microphone quality and positioning
- Reduce background noise
- Try switching to a cloud STT provider for better accuracy

**Calendar integration not working**
- Ensure you've authorized Google Calendar access
- Check that the meeting has an associated calendar event
- Verify your Google account has calendar permissions

**Extension not loading**
- Disable and re-enable the extension
- Check for browser updates
- Try reloading the extension in developer mode

### Getting Help
- Check the [FAQ](docs/FAQ.md) for common questions
- Report issues on [GitHub Issues](https://github.com/your-repo/issues)
- Contact support: support@example.com

## Development

### Building from Source
```bash
# Install dependencies
npm install

# Run tests
npm test

# Lint code
npm run lint

# Build extension
npm run build

# Package for distribution
npm run package
```

### Testing
```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Generate coverage report
npm run test:coverage
```

### Contributing
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Submit a pull request

## API Keys Setup

### OpenAI API Key
1. Visit [OpenAI API Keys](https://platform.openai.com/api-keys)
2. Create a new API key
3. Add it to the extension settings
4. Ensure you have sufficient credits for usage

### Anthropic Claude API Key
1. Visit [Anthropic Console](https://console.anthropic.com/)
2. Generate an API key
3. Add it to the extension settings

### Azure Credentials
1. Create an Azure Cognitive Services resource
2. Get your API key and region
3. For Azure OpenAI, create an Azure OpenAI resource
4. Add credentials to extension settings

## Supported Browsers

- **Chrome**: Version 88+ (Manifest V3 support)
- **Firefox**: Version 109+ (Manifest V3 support)
- **Edge**: Version 88+ (Chromium-based)
- **Opera**: Version 74+ (Chromium-based)

## Limitations

### Google Meet Limitations
- No native chat API (transcripts exported as files)
- Limited participant information available
- No host detection capabilities
- Requires user-initiated actions for most features

### Browser Limitations
- Requires microphone permissions
- Limited to web-based Google Meet (not mobile app)
- Some features require internet connection

## Changelog

### Version 1.0.0
- Initial release
- Real-time transcription with multiple STT providers
- Speaker identification
- AI-powered summaries
- Google Calendar integration
- Export functionality
- Privacy mode with local processing

## License

MIT License - see [LICENSE](LICENSE) file for details.

## Support

For support, feature requests, or bug reports:
- Email: support@example.com
- GitHub Issues: [Report an Issue](https://github.com/your-repo/issues)
- Documentation: [Full Documentation](docs/)

---

**Note**: This extension is not affiliated with Google or Google Meet. It's an independent tool designed to enhance your meeting experience.