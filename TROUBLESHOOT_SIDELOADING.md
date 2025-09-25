# Troubleshooting Teams App Sideloading

## 🚨 Can't See "Upload a custom app" Option

This is a common issue. Here are the solutions:

### Solution 1: Try Different Teams Platforms

**Teams Web App Issues:**
- Web Teams often has restrictions on custom apps
- Try the **Teams Desktop App** instead
- Download from: https://www.microsoft.com/en-us/microsoft-teams/download-app

**Teams Desktop App:**
1. Download and install Teams desktop app
2. Sign in with your account
3. Go to Apps → Manage your apps
4. Look for "Upload a custom app" option

### Solution 2: Check Account Type

**Personal vs Work Account:**
- **Personal Microsoft Account:** Usually allows sideloading
- **Work/School Account:** May have restrictions

**Try with Personal Account:**
1. Sign out of Teams
2. Sign in with personal Microsoft account (@outlook.com, @hotmail.com, @gmail.com)
3. Try uploading the app

### Solution 3: Enable Developer Mode

**In Teams Desktop App:**
1. Go to Settings (gear icon)
2. Look for "Developer" or "Advanced" settings
3. Enable "Developer mode" or "Custom app uploads"
4. Restart Teams

### Solution 4: Organization Policy Check

**If using work account:**
- Your IT admin may have disabled custom apps
- Contact your IT department
- Ask them to enable "Allow uploading of custom apps"

## 🔄 Alternative Testing Methods

### Method 1: Direct URL Testing (Recommended)

Since you can't sideload, test the app directly:

```
http://localhost:3000/demo
```

This gives you full functionality without Teams integration.

### Method 2: Teams Web App Direct Integration

Try accessing the app directly in Teams web:

1. **Open Teams Web** (teams.microsoft.com)
2. **Start or join a meeting**
3. **In the meeting, open browser console** (F12)
4. **Navigate to:** `http://localhost:3000/tab`
5. **Test the app** in a separate tab

### Method 3: Use Teams Toolkit (Advanced)

Install Teams Toolkit for better development experience:

```bash
npm install -g @microsoft/teamsfx-cli
```

Then use it to deploy:
```bash
teamsfx provision
teamsfx deploy
```

## 🎯 Immediate Testing Options

### Option A: Standalone Demo (Works Now)
```
http://localhost:3000/demo
```
- Full app functionality
- Microphone testing
- STT services
- AI summaries
- No Teams needed

### Option B: Browser Tab Simulation
```
http://localhost:3000/tab?standalone=true
```
- Simulates Teams tab experience
- All features available
- Perfect for development

### Option C: Mobile Testing
- Install Teams mobile app
- Sometimes has different sideloading options
- Limited functionality but good for basic testing

## 🔧 Fix Common Issues

### Issue 1: "Upload" Button Grayed Out

**Causes:**
- Organization policy restrictions
- Wrong account type
- Teams version too old

**Solutions:**
- Try personal Microsoft account
- Update Teams to latest version
- Use Teams desktop app instead of web

### Issue 2: Upload Fails

**Causes:**
- Zip file corrupted
- Manifest.json errors
- Missing required files

**Solutions:**
- Repackage the app: `npm run package:teams:dev`
- Verify zip contents
- Check manifest.json syntax

### Issue 3: App Installs But Won't Load

**Causes:**
- Server not running
- Port blocked
- Network issues

**Solutions:**
- Ensure server is running: `npm start`
- Check http://localhost:3000/api/health
- Try different port: `PORT=3001 npm start`

## 🚀 Workaround: Test Without Sideloading

### Full Feature Testing

You can test everything without sideloading:

1. **Audio Capture:** ✅ Works in browser
2. **STT Services:** ✅ All providers work
3. **AI Summaries:** ✅ With API keys
4. **Real-time Display:** ✅ Full functionality
5. **Configuration:** ✅ All settings
6. **Speaker ID:** ✅ Works with microphone

### What You're Missing Without Teams Integration:
- ❌ Real Teams meeting context
- ❌ Automatic participant detection
- ❌ Teams chat integration
- ❌ Teams-specific permissions

### What Still Works:
- ✅ All core transcription features
- ✅ Audio processing
- ✅ STT and AI services
- ✅ Configuration and settings
- ✅ Local storage and export

## 📱 Try These Alternatives

### Alternative 1: Teams Mobile App
- Download Teams mobile app
- Sometimes has different upload options
- May allow personal sideloading

### Alternative 2: Different Browser
- Try Chrome, Edge, Firefox
- Some browsers handle Teams better
- Clear cache and cookies

### Alternative 3: Incognito/Private Mode
- Open Teams in incognito mode
- Sign in with personal account
- Try uploading the app

### Alternative 4: Different Teams Tenant
- Create new personal Microsoft account
- Join Teams with that account
- Try sideloading there

## 🎯 Recommended Next Steps

### Immediate (Works Now):
1. **Test standalone:** http://localhost:3000/demo
2. **Configure STT services** with your API keys
3. **Test all features** thoroughly
4. **Document what works** for your use case

### Short-term:
1. **Try Teams desktop app** for sideloading
2. **Contact IT** about custom app policies
3. **Test with personal Microsoft account**
4. **Consider Teams Toolkit** for development

### Long-term:
1. **Deploy to cloud** for production use
2. **Submit to Teams App Store** for wider distribution
3. **Work with IT** for organization deployment
4. **Create documentation** for team rollout

## 🆘 Still Need Help?

### If Nothing Works:
1. **Focus on standalone testing** - you get 90% of functionality
2. **Document the working features** for stakeholders
3. **Plan cloud deployment** for real Teams integration
4. **Consider this a successful proof-of-concept**

### Contact Options:
- **IT Support:** For organization policies
- **Microsoft Support:** For Teams-specific issues
- **Community Forums:** Teams developer community
- **Documentation:** Microsoft Teams developer docs

Remember: The standalone version at `http://localhost:3000/demo` gives you almost all the functionality you need for testing and development!