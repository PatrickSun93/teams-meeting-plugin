# Teams App Sideloading Guide for Mac

## 🎉 Your Teams App Package is Ready!

The file `teams-transcription-app.zip` (1.6KB) has been created and is ready for sideloading into Microsoft Teams.

## 📋 What's in the Package

- ✅ `manifest.json` - Teams app configuration
- ✅ `icon-color.png` - App icon for Teams store
- ✅ `icon-outline.png` - Small icon for Teams UI
- ✅ Package size: 1.6KB (well under 4MB limit)

## 🚀 Sideloading Steps

### Option 1: Personal Sideloading (Easiest)

1. **Open Microsoft Teams**
   - Use the desktop app or go to teams.microsoft.com
   - Sign in with your personal Microsoft account

2. **Navigate to Apps**
   - Click "Apps" in the left sidebar
   - Look for "Manage your apps" at the bottom

3. **Upload Custom App**
   - Click "Upload a custom app"
   - Select "Upload for me" (personal use)
   - Choose the `teams-transcription-app.zip` file

4. **Install the App**
   - Review the app details
   - Click "Add" to install
   - Grant permissions when prompted

### Option 2: Organization Sideloading (If Enabled)

1. **Check Organization Policy**
   - Your organization must allow custom app uploads
   - Contact IT if this option isn't available

2. **Upload for Organization**
   - Follow steps 1-2 above
   - Select "Upload for [Your Organization]"
   - Choose the zip file and install

## 🧪 Testing the Sideloaded App

### In a Teams Meeting

1. **Start or Join a Meeting**
   - Create a test meeting or join an existing one

2. **Open the App**
   - Click "Apps" in the meeting toolbar
   - Find "Meeting Transcription" in your apps
   - Click to open the plugin

3. **Test Functionality**
   - Grant microphone permissions
   - Start transcription
   - Test real-time speech-to-text
   - Try different features

### Expected Behavior

✅ **App loads in meeting context**
✅ **Teams SDK initializes properly**
✅ **Meeting information is detected**
✅ **Host/participant roles work correctly**
✅ **Microphone access functions**
✅ **Real Teams integration active**

## 🔧 Troubleshooting Sideloading

### "Upload a custom app" Not Available

**Problem:** Option is grayed out or missing
**Solutions:**
- Check if you're using a personal Microsoft account
- Try Teams web app instead of desktop
- Contact your IT administrator about custom app policies
- Use a different Microsoft account

### App Won't Install

**Problem:** Installation fails or shows errors
**Solutions:**
- Verify the zip file isn't corrupted
- Check that all required files are in the package
- Try refreshing Teams and uploading again
- Clear Teams cache and retry

### App Loads But Doesn't Work

**Problem:** App opens but features don't function
**Solutions:**
- Check browser console for JavaScript errors
- Verify your server is still running on localhost:3000
- Ensure firewall isn't blocking the connection
- Try the standalone demo mode first

### Permissions Issues

**Problem:** App can't access microphone or Teams features
**Solutions:**
- Grant all requested permissions during installation
- Check browser/system microphone permissions
- Restart Teams after granting permissions
- Try in a different browser

## 🌐 Server Requirements

### Keep Your Server Running

The sideloaded app connects to your local server, so keep it running:

```bash
# In your project directory
npm start

# Should show:
# Teams Transcription App running on port 3000
# Access the app at: http://localhost:3000
```

### Network Considerations

- **Localhost Access:** The app connects to localhost:3000
- **Firewall:** Ensure port 3000 isn't blocked
- **HTTPS:** For production, you'll need HTTPS
- **Domain:** Update manifest.json for production domains

## 🔄 Updating the App

### After Making Changes

1. **Rebuild the client:**
   ```bash
   npm run build:dev
   ```

2. **Repackage the app:**
   ```bash
   npm run package:teams:dev
   ```

3. **Update in Teams:**
   - Go to Apps > Manage your apps
   - Find your app and click the "..." menu
   - Select "Update" and upload the new zip file

### Version Management

- Update the version in `manifest.json` for major changes
- Teams caches apps, so version updates help force refreshes
- Clear Teams cache if updates don't appear

## 📱 Testing on Different Platforms

### Desktop Teams App (Recommended)
- Best performance and feature support
- Full microphone and audio access
- Complete Teams SDK functionality

### Teams Web App
- Works in Chrome, Edge, Safari
- May have some audio limitations
- Good for testing basic functionality

### Mobile Teams App
- Limited functionality for this type of app
- Primarily for viewing transcripts
- Not recommended for hosting meetings with transcription

## 🎯 Next Steps After Sideloading

### 1. Test Core Features
- Audio capture and transcription
- Speaker identification
- Real-time display
- AI summary generation

### 2. Configure Services
- Add your STT API keys (OpenAI, Azure, etc.)
- Set up AI summary providers
- Customize prompts and settings

### 3. Team Rollout
- Test with colleagues in real meetings
- Gather feedback and iterate
- Document usage guidelines

### 4. Production Deployment
- Deploy server to cloud (AWS, Azure, etc.)
- Update manifest.json with production URLs
- Submit to Teams App Store (optional)

## 🆘 Getting Help

### If Sideloading Fails
1. **Check the package:** Unzip and verify contents
2. **Try different account:** Use personal vs. work account
3. **Test standalone first:** Ensure app works at localhost:3000/demo
4. **Check Teams version:** Update to latest Teams app

### If App Doesn't Work in Teams
1. **Check server logs:** Look for connection errors
2. **Test permissions:** Verify microphone access
3. **Try demo mode:** Add ?standalone=true to test
4. **Check console:** Look for JavaScript errors

### Support Resources
- **Local testing:** http://localhost:3000/demo
- **Documentation:** Check the docs/ folder
- **Logs:** Server terminal and browser console
- **Community:** GitHub issues and discussions

## 🎉 Success!

Once sideloaded successfully, you'll have:
- ✅ Real Teams meeting integration
- ✅ Native Teams UI experience
- ✅ Full microphone and audio access
- ✅ Meeting context and participant info
- ✅ Teams chat integration capabilities

Your Teams Meeting Transcription plugin is now ready for real-world testing! 🚀

---

## Quick Reference

```bash
# Package the app
npm run package:teams:dev

# File to upload
teams-transcription-app.zip

# Server must be running
npm start

# Test standalone first
http://localhost:3000/demo
```