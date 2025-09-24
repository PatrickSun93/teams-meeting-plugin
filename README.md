# Teams Meeting Transcription Plugin

A Microsoft Teams plugin that provides real-time speech-to-text transcription, speaker identification, and AI-powered meeting summaries.

## Features

- 🎤 Real-time meeting transcription
- 👥 Speaker identification
- 🤖 AI-powered meeting summaries
- 💬 Automatic transcript sharing to Teams chat
- 🔒 Local and cloud STT options
- ⚙️ Customizable summary prompts

## Quick Start

### Prerequisites

- Node.js 18+ installed
- Microsoft Teams account
- Teams development environment set up

### Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```

3. Copy environment variables:
   ```bash
   cp .env.example .env
   ```

4. Configure your API keys in `.env` file

5. Start the development server:
   ```bash
   npm run dev
   ```

6. Build the client application:
   ```bash
   npm run build:dev
   ```

### Teams App Setup

1. Create app icons (see `assets/README.md`)
2. Update `manifest.json` with your domain and app ID
3. Package the app for Teams:
   - Zip the `manifest.json` and `assets/` folder
4. Sideload the app in Teams:
   - Go to Teams → Apps → Upload a custom app
   - Select your zip file

## Development

### Project Structure

```
├── src/
│   ├── client/          # React frontend
│   ├── server/          # Express backend
│   └── teams/           # Teams-specific integration
├── assets/              # App icons and resources
├── public/              # Static files
├── manifest.json        # Teams app manifest
└── package.json         # Dependencies and scripts
```

### Available Scripts

- `npm start` - Start production server
- `npm run dev` - Start development server with hot reload
- `npm run build` - Build for production
- `npm run build:dev` - Build for development
- `npm test` - Run tests
- `npm run lint` - Run ESLint
- `npm run format` - Format code with Prettier

## Configuration

### STT Services

The plugin supports multiple speech-to-text services:

- **Local Whisper**: Privacy-focused, runs locally
- **OpenAI Whisper**: High accuracy, cloud-based
- **Azure Speech Services**: Enterprise-grade
- **Claude**: AI-powered transcription (if available)

### Environment Variables

See `.env.example` for all available configuration options.

## Next Steps

This is the basic project structure. Next tasks will implement:

1. Audio capture from Teams meetings
2. STT service integrations
3. Speaker identification
4. AI summary generation
5. Teams chat integration

## Contributing

1. Follow the implementation plan in `.kiro/specs/teams-meeting-transcription/tasks.md`
2. Complete one task at a time
3. Test thoroughly before moving to the next task
4. Update documentation as needed

## License

MIT License - see LICENSE file for details