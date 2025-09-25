# Local Testing Guide - No Teams Admin Required

## 🧪 Test the Plugin Locally on Your Mac Mini

You can test all the plugin functionality without Teams admin access or sideloading. Here's how:

## Step 1: Start the Development Server

```bash
# Make sure you're in the project directory
cd /path/to/your/teams-meeting-transcription

# Start the server on port 3001 (since 3000 is in use)
PORT=3001 npm start
```

You should see:
```
Teams Transcription App running on port 3001
Access the app at: http://localhost:3001
```

## Step 2: Test in Browser (Standalone Mode)

### Option A: Direct Browser Testing

1. **Open your browser** (Chrome recommended)
2. **Go to:** `http://localhost:3001`
3. **You'll see the main app interface** without Teams integration

This lets you test:
- ✅ UI components and styling
- ✅ Configuration panels
- ✅ STT service connections
- ✅ Audio processing (with microphone permission)
- ✅ AI summary generation
- ✅ Local storage and settings

### Option B: Teams Tab Simulation

1. **Go to:** `http://localhost:3001/tab`
2. **This simulates the Teams tab experience**
3. **Test all functionality** as if it were in Teams

## Step 3: Test Core Features

### Test Audio Capture
```bash
# Open browser console (F12) and go to:
http://localhost:3001/tab

# Grant microphone permissions when prompted
# Check console logs for audio processing messages
```

### Test STT Services

1. **Local STT (No API keys needed):**
   - Go to Settings → STT Configuration
   - Select "Local Whisper"
   - Test with your microphone

2. **Cloud STT (If you have API keys):**
   - Add your OpenAI API key
   - Test transcription accuracy

### Test AI Summaries

1. **With OpenAI API key:**
   - Go to Settings → AI Configuration
   - Enter your API key
   - Test summary generation with sample text

## Step 4: Simulate Teams Meeting Environment

### Mock Meeting Data
The app includes mock data for testing without a real Teams meeting:

```javascript
// The app will simulate:
- Meeting participants
- Meeting metadata
- Host/participant roles
- Audio streams (using your microphone)
```

### Test Meeting Controls
1. **Start Transcription** - Should work with your microphone
2. **Speaker Identification** - Test with different voices
3. **Real-time Display** - See transcription appear live
4. **Summary Generation** - Test AI summary creation

## Step 5: Advanced Local Testing

### Test Different Scenarios

1. **Host Mode Simulation:**
   ```bash
   # Add to URL: ?role=host
   http://localhost:3001/tab?role=host
   ```

2. **Participant Mode:**
   ```bash
   # Add to URL: ?role=participant
   http://localhost:3001/tab?role=participant
   ```

3. **No Meeting Mode:**
   ```bash
   # Default behavior when not in Teams
   http://localhost:3001/tab
   ```

### Test with Mock Audio

Create a test audio file and use it:

```bash
# Create a simple test
echo "This is a test transcription" | say -o test-audio.wav
# (macOS text-to-speech)
```

## Step 6: Debug and Monitor

### Browser Developer Tools

1. **Open DevTools** (Cmd+Option+I in Chrome)
2. **Console Tab:** See app logs and errors
3. **Network Tab:** Monitor API calls
4. **Application Tab:** Check local storage

### Server Logs

```bash
# In another terminal, monitor server logs
tail -f server.log

# Or check the terminal where npm start is running
```

### Test API Endpoints

```bash
# Test health endpoint
curl http://localhost:3001/api/health

# Should return: {"status":"OK","timestamp":"..."}
```

## Step 7: Test Configuration

### STT Configuration
```bash
# Test different STT providers
# Go to: http://localhost:3001/tab
# Settings → STT Configuration
# Try: Local Whisper, OpenAI, Azure (if you have keys)
```

### AI Configuration
```bash
# Test AI summary services
# Settings → AI Configuration  
# Try: OpenAI GPT, Claude, Azure OpenAI
```

## What You Can Test Locally

### ✅ Fully Testable
- **Audio capture** from your microphone
- **STT transcription** (local and cloud)
- **Speaker identification** with different voices
- **AI summary generation** with API keys
- **Real-time transcription display**
- **Configuration management**
- **Local storage and persistence**
- **Error handling and recovery**
- **Performance monitoring**

### ⚠️ Limited Testing
- **Teams chat integration** (no real Teams chat)
- **Meeting participant detection** (uses mock data)
- **Teams-specific permissions** (simulated)

### ❌ Cannot Test Locally
- **Actual Teams meeting integration**
- **Teams app store submission**
- **Organization-wide deployment**

## Step 8: Performance Testing

### Memory Usage
```bash
# Monitor memory usage
top -pid $(pgrep node)

# Or use Activity Monitor to watch the Node.js process
```

### Audio Processing
```bash
# Test with different audio inputs
# Try: Built-in mic, USB mic, headset
# Monitor CPU usage during transcription
```

## Step 9: Troubleshooting Local Testing

### Common Issues

**Port Already in Use:**
```bash
# Find what's using the port
lsof -ti:3001

# Kill the process if needed
kill $(lsof -ti:3001)

# Or use a different port
PORT=3002 npm start
```

**Microphone Not Working:**
```bash
# Check browser permissions
# Chrome: Settings → Privacy → Microphone
# Safari: Preferences → Websites → Microphone
```

**API Keys Not Working:**
```bash
# Check browser console for error messages
# Verify API key format and validity
# Check network connectivity
```

## Step 10: Prepare for Teams Integration

Once you've tested locally and everything works:

### For Personal Teams Account
1. **Create simple icons** (use the create-icons.html file)
2. **Package the app** with `npm run package:teams:dev`
3. **Upload to Teams** (personal sideloading)

### For Organization Teams
1. **Contact IT** with the working app package
2. **Provide documentation** and test results
3. **Request pilot deployment** for your team

## Quick Test Commands

```bash
# Start the app
PORT=3001 npm start

# Test in browser
open http://localhost:3001/tab

# Check health
curl http://localhost:3001/api/health

# Run tests
npm test

# Build for production
npm run build
```

## Next Steps

1. **Test thoroughly locally** with all features
2. **Document any issues** you find
3. **Configure your preferred STT/AI services**
4. **When ready,** create a simple Teams app package for personal use
5. **Share results** with your team/organization

This approach lets you fully test and validate the plugin without any Teams admin requirements! 🎉