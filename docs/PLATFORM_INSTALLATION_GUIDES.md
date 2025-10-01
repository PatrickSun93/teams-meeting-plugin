# Platform-Specific Installation Guides

This document provides detailed installation instructions for each supported platform of the Universal Meeting Transcription Plugin.

## Table of Contents
- [Microsoft Teams Installation](#microsoft-teams-installation)
- [Zoom Installation](#zoom-installation)
- [Browser Extension Installation](#browser-extension-installation)
- [Troubleshooting](#troubleshooting)

---

## Microsoft Teams Installation

### Method 1: Teams App Store (Recommended)

**For End Users:**

1. **Open Microsoft Teams**
   - Launch Teams desktop app or go to teams.microsoft.com
   - Sign in with your Microsoft account

2. **Access the App Store**
   - Click on "Apps" in the left sidebar
   - Search for "Meeting Transcription Plugin"
   - Click on the app from search results

3. **Install the App**
   - Click "Add" or "Install"
   - Grant necessary permissions when prompted
   - The app will appear in your Teams apps list

4. **First-Time Setup**
   - Open the app from your Teams apps
   - Complete the initial configuration
   - Choose your preferred STT service (local or cloud)
   - Configure API keys if using cloud services

**Required Permissions:**
- Microphone access for audio capture
- Meeting participation for transcription
- Chat access for sending transcripts

### Method 2: Sideloading (Development/Testing)

**Prerequisites:**
- Teams admin permissions or developer tenant
- App package file (.zip)

**For IT Administrators:**

1. **Enable Sideloading**
   - Go to Teams Admin Center (admin.teams.microsoft.com)
   - Navigate to Teams apps → Setup policies
   - Enable "Upload custom apps"
   - Apply policy to target users/groups

2. **Upload the App**
   - Download the Teams app package
   - In Teams, go to Apps → Manage your apps
   - Click "Upload a custom app"
   - Select the downloaded .zip file

3. **Deploy to Organization**
   - In Teams Admin Center, go to Teams apps → Manage apps
   - Upload the custom app
   - Set availability for specific users or entire organization

**For Developers:**

1. **Download Package**
   ```bash
   # Clone repository
   git clone https://github.com/your-org/meeting-transcription-plugin
   cd meeting-transcription-plugin
   
   # Build Teams package
   npm install
   npm run build:teams
   ```

2. **Sideload in Teams**
   - Open Teams desktop app
   - Go to Apps → Manage your apps
   - Click "Upload a custom app"
   - Select `dist/teams-package.zip`

### Teams Configuration

**Initial Setup:**
1. Open the transcription plugin in Teams
2. Go to Settings tab
3. Configure your preferences:
   - **STT Service**: Choose between local Whisper or cloud services
   - **Language**: Select primary meeting language
   - **Speaker ID**: Enable/disable speaker identification
   - **Auto-send**: Configure automatic transcript sharing

**API Key Configuration (for cloud services):**
1. Navigate to Configuration panel
2. Select your preferred AI service:
   - OpenAI (requires API key)
   - Claude (requires API key)
   - Azure OpenAI (requires endpoint and key)
3. Enter credentials securely
4. Test connection

---

## Zoom Installation

### Method 1: Zoom App Marketplace (Recommended)

**For End Users:**

1. **Access Zoom App Marketplace**
   - Go to marketplace.zoom.us
   - Sign in with your Zoom account
   - Search for "Meeting Transcription Plugin"

2. **Install the App**
   - Click on the app listing
   - Click "Install" or "Add to Zoom"
   - Authorize required permissions:
     - Read meeting information
     - Send chat messages
     - Access user information

3. **OAuth Authorization**
   - Complete OAuth flow when prompted
   - Grant necessary permissions
   - Return to Zoom client

4. **First Meeting Setup**
   - Join or start a Zoom meeting
   - Look for transcription plugin in meeting controls
   - Configure settings during first use

**For Zoom Administrators:**

1. **Enable App in Account**
   - Go to Zoom Admin Portal (zoom.us/account)
   - Navigate to Advanced → Marketplace Apps
   - Find and enable the transcription plugin
   - Configure organization-wide settings

2. **Set Permissions**
   - Define which users can install the app
   - Configure default settings
   - Set usage policies

### Method 2: Browser Extension (Fallback)

If the Zoom app is not available, use the browser extension:

1. **Install Browser Extension** (see Browser Extension section)
2. **Join Zoom Meeting in Browser**
   - Use zoom.us web client instead of desktop app
   - Extension will automatically detect Zoom meetings
3. **Enable Transcription**
   - Extension icon will show when in a Zoom meeting
   - Click to start transcription

### Zoom Configuration

**Meeting Host Setup:**
1. Start a Zoom meeting
2. Access meeting controls
3. Find transcription plugin button
4. Configure real-time settings:
   - Enable/disable transcription
   - Choose STT service
   - Set speaker identification preferences

**Webhook Configuration (for developers):**
```bash
# Set up webhook endpoint
curl -X POST https://api.zoom.us/v2/webhooks \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://your-domain.com/webhook/zoom",
    "auth_token": "your-webhook-secret",
    "events": ["meeting.started", "meeting.ended"]
  }'
```

---

## Browser Extension Installation

### Chrome Web Store Installation

**For End Users:**

1. **Open Chrome Web Store**
   - Go to chrome.google.com/webstore
   - Search for "Meeting Transcription Plugin"
   - Or use direct link if provided

2. **Install Extension**
   - Click "Add to Chrome"
   - Confirm by clicking "Add extension"
   - Extension icon appears in toolbar

3. **Grant Permissions**
   - Click on extension icon
   - Grant microphone access when prompted
   - Allow access to meeting sites (Teams, Zoom, Meet)

4. **Initial Configuration**
   - Right-click extension icon → Options
   - Configure STT service preferences
   - Set up API keys for cloud services
   - Choose default settings

### Firefox Add-ons Installation

**For Firefox Users:**

1. **Open Firefox Add-ons**
   - Go to addons.mozilla.org
   - Search for "Meeting Transcription Plugin"

2. **Install Add-on**
   - Click "Add to Firefox"
   - Confirm installation
   - Extension appears in toolbar

3. **Configure Permissions**
   - Click extension icon
   - Grant necessary permissions
   - Configure in extension options

### Manual Installation (Development)

**For Developers:**

1. **Build Extension**
   ```bash
   git clone https://github.com/your-org/meeting-transcription-plugin
   cd meeting-transcription-plugin
   npm install
   npm run build:extension
   ```

2. **Load in Chrome**
   - Open Chrome → Extensions (chrome://extensions/)
   - Enable "Developer mode"
   - Click "Load unpacked"
   - Select `dist/browser-extension` folder

3. **Load in Firefox**
   - Open Firefox → Add-ons (about:addons)
   - Click gear icon → "Debug Add-ons"
   - Click "Load Temporary Add-on"
   - Select `manifest.json` from extension folder

### Extension Configuration

**Options Page Setup:**
1. Right-click extension icon → Options
2. Configure platform preferences:
   - **Google Meet**: Enable/disable Meet integration
   - **Teams Web**: Configure Teams web client support
   - **Zoom Web**: Set up Zoom web client integration

3. **STT Service Configuration**:
   - Choose between local and cloud processing
   - Enter API keys for cloud services
   - Test service connections

**Per-Site Permissions:**
1. Visit a meeting platform (meet.google.com, teams.microsoft.com, etc.)
2. Click extension icon
3. Grant site-specific permissions
4. Configure platform-specific settings

---

## Platform Comparison

| Feature | Teams App | Zoom App | Browser Extension |
|---------|-----------|----------|-------------------|
| **Installation** | App Store/Sideload | Marketplace/OAuth | Web Store/Manual |
| **Audio Quality** | High (native) | High (SDK) | Medium (WebRTC) |
| **Chat Integration** | ✅ Native | ✅ API | ❌ Export only |
| **Meeting Detection** | ✅ Automatic | ✅ Automatic | ✅ Automatic |
| **Offline Mode** | ✅ Local STT | ✅ Local STT | ✅ Local STT |
| **Admin Control** | ✅ Full | ✅ Full | ⚠️ Limited |
| **Updates** | ✅ Automatic | ✅ Automatic | ✅ Automatic |

---

## Troubleshooting

### Common Installation Issues

#### Teams Installation Problems

**Issue: "App not available in your organization"**
- **Solution**: Contact IT admin to enable custom apps or approve the specific app
- **Alternative**: Use sideloading method if permitted

**Issue: "Permission denied during installation"**
- **Solution**: Ensure you have necessary Teams permissions
- **Check**: Organization policies in Teams Admin Center

**Issue: "App fails to load after installation"**
- **Solution**: Clear Teams cache and restart application
- **Steps**: 
  1. Close Teams completely
  2. Clear cache: `%appdata%\Microsoft\Teams` (Windows) or `~/Library/Application Support/Microsoft/Teams` (Mac)
  3. Restart Teams

#### Zoom Installation Problems

**Issue: "OAuth authorization fails"**
- **Solution**: Check Zoom account permissions and app approval status
- **Verify**: Correct redirect URIs in Zoom app configuration

**Issue: "App not visible in meeting"**
- **Solution**: Ensure app is enabled in Zoom account settings
- **Check**: Meeting host has necessary permissions

**Issue: "Webhook events not received"**
- **Solution**: Verify webhook URL is accessible and SSL certificate is valid
- **Test**: Use webhook testing tools to verify endpoint

#### Browser Extension Problems

**Issue: "Extension not working on meeting sites"**
- **Solution**: Grant site permissions manually
- **Steps**:
  1. Click extension icon
  2. Go to extension settings
  3. Enable permissions for meeting sites

**Issue: "Microphone access denied"**
- **Solution**: Check browser microphone permissions
- **Steps**:
  1. Go to browser settings → Privacy & Security
  2. Find microphone permissions
  3. Allow access for meeting sites

**Issue: "Extension crashes or becomes unresponsive"**
- **Solution**: Disable and re-enable extension
- **Alternative**: Reinstall extension from web store

### Performance Issues

**High CPU Usage:**
- Reduce transcription quality settings
- Use local STT instead of cloud services
- Close unnecessary browser tabs/applications

**Poor Transcription Quality:**
- Check microphone settings and positioning
- Reduce background noise
- Switch to cloud STT service for better accuracy
- Ensure stable internet connection

**Memory Issues:**
- Clear extension storage periodically
- Limit transcript history retention
- Restart browser/application regularly

### Getting Help

**Support Channels:**
- **Documentation**: Check online documentation and FAQ
- **Community**: Join user community forums
- **Support**: Contact platform-specific support teams
- **Issues**: Report bugs on GitHub repository

**Diagnostic Information:**
When reporting issues, include:
- Platform and version (Teams, Zoom, Browser)
- Operating system and version
- Extension/app version
- Error messages or screenshots
- Steps to reproduce the issue

**Log Collection:**
```bash
# Enable debug logging
localStorage.setItem('transcription-debug', 'true');

# Export logs
console.log('Transcription logs:', localStorage.getItem('transcription-logs'));
```

---

## Security and Privacy

### Data Handling
- All transcripts stored locally by default
- Cloud services used only with explicit user consent
- API keys encrypted and stored securely
- No data shared without user permission

### Permissions Explained
- **Microphone**: Required for audio capture and transcription
- **Meeting Access**: Needed to detect meeting state and participants
- **Chat Access**: Used to send transcripts (Teams/Zoom only)
- **Storage**: For saving transcripts and user preferences

### Privacy Controls
- Enable "Privacy Mode" for local-only processing
- Configure data retention policies
- Control transcript sharing settings
- Manage API key storage and access

---

This installation guide ensures users can successfully deploy the transcription plugin across all supported platforms while understanding the specific requirements and capabilities of each platform.