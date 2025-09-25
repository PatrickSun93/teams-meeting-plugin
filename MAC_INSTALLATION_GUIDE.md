# Teams Meeting Transcription Plugin - Mac Installation Guide

## 🍎 Complete Installation Guide for Mac mini

This guide will walk you through installing and setting up the Teams Meeting Transcription Plugin on your Mac mini.

## Prerequisites

### System Requirements
- **macOS**: 10.15 (Catalina) or later
- **RAM**: 8 GB minimum (16 GB recommended for local STT)
- **Storage**: 5 GB free space
- **Internet**: Stable connection for cloud services

### Required Software
- **Node.js 18+**: For running the development server
- **Microsoft Teams**: Desktop app or web version
- **Chrome/Safari/Edge**: For web-based Teams

## Step 1: Install Node.js (if not already installed)

1. **Check if Node.js is installed:**
   ```bash
   node --version
   npm --version
   ```

2. **If not installed, download from:**
   - Visit: https://nodejs.org/
   - Download the LTS version for macOS
   - Run the installer and follow instructions

3. **Verify installation:**
   ```bash
   node --version  # Should show v18.x.x or higher
   npm --version   # Should show 9.x.x or higher
   ```

## Step 2: Set Up the Application

The application is already set up in your current directory. Let's start it:

1. **Install dependencies (already done):**
   ```bash
   npm install
   ```

2. **Build the client application:**
   ```bash
   npm run build:dev
   ```

3. **Start the development server:**
   ```bash
   PORT=3001 npm start
   ```

   You should see:
   ```
   Teams Transcription App running on port 3001
   Access the app at: http://localhost:3001
   ```

## Step 3: Create the Teams App Package

1. **Create app icons (if not already present):**
   ```bash
   mkdir -p assets
   # You'll need to add icon-color.png and icon-outline.png to the assets folder
   ```

2. **Update the manifest for your local setup:**
   The manifest.json is already configured for localhost:3000, but since we're using port 3001, let's update it:

3. **Create the Teams app package:**
   ```bash
   npm run package:teams:dev
   ```

## Step 4: Install in Microsoft Teams

### Option A: Teams Desktop App (Recommended)

1. **Open Microsoft Teams Desktop App**
   - Launch Teams from Applications or Spotlight search
   - Sign in with your Microsoft account

2. **Enable Developer Mode (if needed):**
   - Go to Teams Admin Center (admin.teams.microsoft.com)
   - Navigate to Teams apps > Setup policies
   - Enable "Upload custom apps"

3. **Upload the App:**
   - In Teams, click "Apps" in the left sidebar
   - Click "Manage your apps" (bottom left)
   - Click "Upload an app"
   - Select "Upload a custom app"
   - Choose the generated .zip file from the teams-app-package folder

4. **Install the App:**
   - Click "Add" when prompted
   - Grant necessary permissions

### Option B: Teams Web App

1. **Open Teams in Browser:**
   - Go to teams.microsoft.com
   - Sign in with your account
   - Use Chrome or Safari for best compatibility

2. **Upload the App:**
   - Follow the same steps as desktop app
   - Grant microphone permissions when prompted

## Step 5: Test the Installation

### Basic Test

1. **Start or join a Teams meeting**

2. **Look for the transcription app:**
   - Click "Apps" in the meeting toolbar
   - Find "Meeting Transcription" in the list
   - Click to open the app

3. **Verify functionality:**
   - App should load and show meeting information
   - If you're the host, you should see transcription controls
   - Test microphone permissions

### Expected Behavior

✅ App loads without errors
✅ Meeting information displays correctly
✅ Host/participant status is detected
✅ Microphone permission request works
✅ UI components render properly

## Step 6: Configure STT Services

### Option 1: Local Processing (Most Private)

1. **Enable Local Whisper:**
   - Open the app in a meeting
   - Go to Settings > STT Configuration
   - Select "Local Whisper"
   - Choose model size (base recommended for Mac mini)

2. **Download Models:**
   - Click "Download Models"
   - Wait for download to complete (may take several minutes)
   - Test with sample audio

### Option 2: Cloud Services (Better Accuracy)

1. **OpenAI Whisper API:**
   - Get API key from platform.openai.com
   - In app settings, select "OpenAI Whisper"
   - Enter your API key
   - Test connection

2. **Azure Speech Services:**
   - Create Azure account and Speech resource
   - Get API key and region
   - Configure in app settings

## Step 7: Configure AI Summaries

1. **Choose AI Provider:**
   - OpenAI GPT-4 (recommended)
   - Claude (Anthropic)
   - Azure OpenAI

2. **Set Up API Keys:**
   - Enter your chosen provider's API key
   - Test connection
   - Customize summary prompts if desired

## Mac-Specific Considerations

### Performance Optimization

1. **For Local STT on Mac mini:**
   - Use "base" or "small" Whisper models
   - Close unnecessary applications during meetings
   - Ensure adequate cooling/ventilation

2. **Memory Management:**
   - Monitor Activity Monitor during use
   - Consider upgrading RAM if using local processing heavily

### Audio Setup

1. **Built-in Microphone:**
   - Works well for personal meetings
   - Consider external mic for better quality

2. **External Microphone:**
   - USB microphones work great
   - Test audio levels in Teams settings

### Browser Considerations

1. **Safari:**
   - May have some limitations with WebRTC
   - Chrome recommended for best compatibility

2. **Chrome:**
   - Best performance and compatibility
   - Handles microphone permissions well

## Troubleshooting Mac-Specific Issues

### Port Already in Use
If you get "EADDRINUSE" error:
```bash
# Find what's using the port
lsof -ti:3000

# Use a different port
PORT=3001 npm start
```

### Microphone Permissions
1. **System Preferences > Security & Privacy > Privacy > Microphone**
2. **Enable for:**
   - Microsoft Teams
   - Your browser (Chrome/Safari)
   - Terminal (if testing from command line)

### Node.js Issues
```bash
# If you have permission issues
sudo chown -R $(whoami) ~/.npm

# If modules won't install
npm cache clean --force
rm -rf node_modules package-lock.json
npm install
```

### Teams App Won't Load
1. **Check console logs:**
   - Open Developer Tools in browser (Cmd+Option+I)
   - Look for JavaScript errors

2. **Verify server is running:**
   ```bash
   curl http://localhost:3001/api/health
   ```

3. **Check manifest configuration:**
   - Ensure validDomains includes your localhost port

## Running in Production

### For Personal Use
Keep the development server running:
```bash
# Run in background
nohup npm start &

# Or use PM2 for process management
npm install -g pm2
pm2 start src/server/index.js --name teams-transcription
```

### For Team/Organization Use
1. **Deploy to a server** (AWS, Azure, etc.)
2. **Update manifest.json** with production URL
3. **Use HTTPS** for production deployment
4. **Submit to Teams Admin Center** for organization-wide deployment

## Maintenance

### Keep Updated
```bash
# Update dependencies
npm update

# Rebuild after updates
npm run build:dev
```

### Monitor Performance
```bash
# Check server logs
tail -f server.log

# Monitor system resources
top -pid $(pgrep node)
```

## Getting Help

### Common Issues
- **App won't start**: Check Node.js version and port availability
- **Teams won't load app**: Verify manifest.json and server URL
- **Microphone not working**: Check macOS privacy settings
- **Poor transcription**: Try different STT providers or check audio quality

### Support Resources
- **Documentation**: Check the docs/ folder
- **Logs**: Check browser console and server logs
- **Community**: GitHub issues and discussions

## Next Steps

1. **Test thoroughly** with practice meetings
2. **Configure your preferred STT and AI services**
3. **Customize summary prompts** for your meeting types
4. **Train your team** on using the plugin
5. **Set up regular maintenance** and updates

---

## Quick Start Commands

```bash
# Start the service
PORT=3001 npm start

# Build for development
npm run build:dev

# Run tests
npm test

# Package for Teams
npm run package:teams:dev

# Check service health
curl http://localhost:3001/api/health
```

Your Teams Meeting Transcription Plugin is now ready to use on your Mac mini! 🎉