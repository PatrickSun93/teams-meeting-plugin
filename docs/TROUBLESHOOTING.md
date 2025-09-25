# Troubleshooting Guide

## Overview

This guide helps you diagnose and resolve common issues with the Teams Meeting Transcription Plugin. Issues are organized by category with step-by-step solutions.

## Table of Contents

1. [Installation Issues](#installation-issues)
2. [Audio and Microphone Problems](#audio-and-microphone-problems)
3. [Transcription Issues](#transcription-issues)
4. [Speaker Identification Problems](#speaker-identification-problems)
5. [Summary Generation Issues](#summary-generation-issues)
6. [Configuration Problems](#configuration-problems)
7. [Performance Issues](#performance-issues)
8. [Teams Integration Problems](#teams-integration-problems)
9. [API and Network Issues](#api-and-network-issues)
10. [Data and Storage Issues](#data-and-storage-issues)

## Installation Issues

### Plugin Not Appearing in Teams

**Symptoms:**
- Plugin not visible in Teams apps
- Transcription icon missing from meeting controls
- "App not found" error

**Solutions:**

1. **Check Installation Status**
   ```
   - Go to Teams > Apps > Manage your apps
   - Look for "Meeting Transcription Plugin"
   - If not found, reinstall from Teams App Store
   ```

2. **Verify Permissions**
   ```
   - Ensure you have permission to install apps
   - Check with IT administrator if in managed environment
   - Verify Teams app policies allow custom apps
   ```

3. **Clear Teams Cache**
   ```
   Windows: %appdata%\Microsoft\Teams
   macOS: ~/Library/Application Support/Microsoft/Teams
   - Close Teams completely
   - Delete cache folders
   - Restart Teams and reinstall plugin
   ```

4. **Try Different Installation Method**
   - If sideloading fails, try Teams App Store
   - If App Store unavailable, contact IT for organization deployment

### Sideloading Fails

**Symptoms:**
- "Upload failed" error
- "Invalid app package" message
- Permission denied errors

**Solutions:**

1. **Check App Package**
   ```
   - Verify .zip file is not corrupted
   - Ensure manifest.json is valid
   - Check file size limits (< 50MB)
   ```

2. **Enable Sideloading**
   ```
   - Go to Teams Admin Center
   - Navigate to Teams apps > Setup policies
   - Enable "Upload custom apps"
   - Apply policy to your user/group
   ```

3. **Verify Manifest Format**
   ```json
   {
     "$schema": "https://developer.microsoft.com/json-schemas/teams/v1.14/MicrosoftTeams.schema.json",
     "manifestVersion": "1.14",
     "version": "1.0.0",
     // ... rest of manifest
   }
   ```

## Audio and Microphone Problems

### Microphone Access Denied

**Symptoms:**
- "Microphone access denied" error
- No audio input detected
- Plugin shows "No microphone available"

**Solutions:**

1. **Browser Permissions**
   ```
   Chrome:
   - Click lock icon in address bar
   - Set Microphone to "Allow"
   - Refresh page and retry
   
   Edge:
   - Click site information icon
   - Change microphone permission to "Allow"
   - Restart browser
   ```

2. **Teams Permissions**
   ```
   - Go to Teams Settings > Privacy
   - Enable microphone access
   - Test microphone in Teams settings
   - Restart Teams application
   ```

3. **System Permissions**
   ```
   Windows:
   - Settings > Privacy > Microphone
   - Enable "Allow apps to access microphone"
   - Enable for Teams specifically
   
   macOS:
   - System Preferences > Security & Privacy > Microphone
   - Check box for Teams and browser
   ```

### Poor Audio Quality

**Symptoms:**
- Transcription accuracy is very low
- Audio sounds distorted or quiet
- Frequent "low confidence" warnings

**Solutions:**

1. **Check Audio Input**
   ```
   - Test microphone in Teams settings
   - Adjust input volume to 70-80%
   - Use headset microphone if available
   - Move closer to microphone
   ```

2. **Reduce Background Noise**
   ```
   - Close windows and doors
   - Turn off fans, air conditioning
   - Use noise-canceling microphone
   - Enable Teams noise suppression
   ```

3. **Audio Settings Optimization**
   ```
   Teams Settings:
   - Enable "Noise cancellation"
   - Set microphone sensitivity appropriately
   - Disable "Automatically adjust microphone settings"
   ```

### Audio Stream Interruption

**Symptoms:**
- Transcription stops unexpectedly
- "Audio stream lost" error
- Gaps in transcript

**Solutions:**

1. **Check Network Connection**
   ```
   - Verify stable internet connection
   - Test with other audio applications
   - Restart network adapter if needed
   ```

2. **Teams Audio Settings**
   ```
   - Go to Teams Settings > Devices
   - Test microphone and speaker
   - Try different audio device
   - Restart Teams application
   ```

3. **System Resources**
   ```
   - Close unnecessary applications
   - Check CPU and memory usage
   - Restart computer if needed
   ```

## Transcription Issues

### Transcription Not Starting

**Symptoms:**
- "Start Transcription" button doesn't work
- No text appears in transcription window
- "Transcription service unavailable" error

**Solutions:**

1. **Check Service Configuration**
   ```
   - Go to Settings > STT Configuration
   - Verify selected provider is configured
   - Test API connection if using cloud service
   - Try switching to different STT provider
   ```

2. **Verify API Keys**
   ```
   - Check API key format and validity
   - Ensure sufficient API quota/credits
   - Test key with provider's test endpoint
   - Regenerate key if necessary
   ```

3. **Network Connectivity**
   ```
   - Test internet connection
   - Check firewall settings
   - Verify proxy configuration
   - Try different network if available
   ```

### Low Transcription Accuracy

**Symptoms:**
- Many incorrect words in transcript
- Missing words or phrases
- Wrong language detection

**Solutions:**

1. **Improve Audio Quality**
   ```
   - Use better microphone
   - Reduce background noise
   - Speak clearly and at moderate pace
   - Ensure participants don't overlap speech
   ```

2. **Adjust STT Settings**
   ```
   - Set correct language in configuration
   - Lower confidence threshold if too restrictive
   - Try different STT provider
   - Use cloud service for better accuracy
   ```

3. **Optimize for Content Type**
   ```
   - Use technical vocabulary models if available
   - Train custom models for domain-specific terms
   - Add custom vocabulary to STT service
   ```

### Transcription Lag

**Symptoms:**
- Significant delay between speech and text
- Real-time transcription feels slow
- Text appears in large chunks

**Solutions:**

1. **Optimize Processing**
   ```
   - Use faster STT provider
   - Reduce audio processing buffer size
   - Close other resource-intensive applications
   - Upgrade hardware if consistently slow
   ```

2. **Network Optimization**
   ```
   - Use wired internet connection
   - Ensure sufficient bandwidth
   - Choose geographically closer API endpoints
   - Reduce concurrent network usage
   ```

3. **Configuration Tuning**
   ```
   - Adjust real-time processing settings
   - Use smaller audio segments
   - Enable local processing for faster response
   ```

## Speaker Identification Problems

### Speakers Not Identified

**Symptoms:**
- All speech labeled as "Unknown Speaker"
- Speaker names not appearing
- Poor speaker separation

**Solutions:**

1. **Enroll Speakers**
   ```
   - Go to Settings > Speaker Identification
   - Record voice samples for each participant
   - Use 30-60 seconds of clear speech per speaker
   - Re-enroll if identification poor
   ```

2. **Improve Audio Conditions**
   ```
   - Ensure speakers use individual microphones
   - Reduce overlapping speech
   - Ask speakers to identify themselves initially
   - Use consistent audio setup across meetings
   ```

3. **Adjust Identification Settings**
   ```
   - Lower confidence threshold for identification
   - Increase voice sample requirements
   - Enable adaptive learning
   - Reset speaker profiles if corrupted
   ```

### Incorrect Speaker Labels

**Symptoms:**
- Speech attributed to wrong person
- Speaker switching mid-sentence
- Inconsistent speaker identification

**Solutions:**

1. **Re-train Speaker Models**
   ```
   - Delete existing speaker profiles
   - Record new voice samples in current environment
   - Use longer training samples (60+ seconds)
   - Ensure samples represent natural speech patterns
   ```

2. **Check Audio Setup**
   ```
   - Verify each speaker has separate audio channel
   - Ensure consistent microphone positioning
   - Reduce audio crosstalk between participants
   ```

3. **Manual Correction**
   ```
   - Use transcript editing features
   - Manually assign correct speakers
   - Save corrections to improve future identification
   ```

## Summary Generation Issues

### Summary Not Generated

**Symptoms:**
- "Generate Summary" button doesn't work
- "Summary generation failed" error
- Empty summary output

**Solutions:**

1. **Check AI Service Configuration**
   ```
   - Verify AI provider is selected and configured
   - Test API key with provider's service
   - Ensure sufficient API quota/credits
   - Check service status and availability
   ```

2. **Verify Transcript Content**
   ```
   - Ensure transcript has sufficient content (>100 words)
   - Check that transcript is properly formatted
   - Verify speaker identification is working
   - Test with sample transcript
   ```

3. **Review Custom Prompts**
   ```
   - Check custom prompt syntax
   - Ensure prompt is not too long or complex
   - Test with default prompt first
   - Validate prompt against AI service requirements
   ```

### Poor Summary Quality

**Symptoms:**
- Summary misses key points
- Irrelevant information included
- Summary too short or too long

**Solutions:**

1. **Improve Transcript Quality**
   ```
   - Ensure accurate transcription first
   - Correct speaker identification errors
   - Edit transcript for clarity if needed
   ```

2. **Optimize Summary Prompt**
   ```
   - Include specific instructions for your meeting type
   - Request focus on agenda items
   - Specify desired summary length
   - Include examples of good summaries
   ```

3. **Try Different AI Provider**
   ```
   - Test with different AI models
   - Compare results across providers
   - Adjust model parameters (temperature, max tokens)
   ```

## Configuration Problems

### Settings Not Saving

**Symptoms:**
- Configuration changes revert after restart
- "Save failed" error messages
- Settings appear corrupted

**Solutions:**

1. **Check Storage Permissions**
   ```
   - Verify browser storage permissions
   - Clear browser cache and cookies
   - Ensure sufficient disk space
   - Try incognito/private browsing mode
   ```

2. **Reset Configuration**
   ```
   - Go to Settings > Advanced > Reset
   - Clear all configuration data
   - Reconfigure from scratch
   - Export/import settings if available
   ```

3. **Browser-Specific Issues**
   ```
   Chrome:
   - Check site data permissions
   - Clear IndexedDB for the site
   
   Firefox:
   - Check storage permissions in about:preferences
   - Clear site data
   ```

### API Keys Not Working

**Symptoms:**
- "Invalid API key" errors
- Authentication failures
- Service unavailable messages

**Solutions:**

1. **Verify API Key Format**
   ```
   OpenAI: sk-...
   Azure: 32-character hex string
   Anthropic: sk-ant-...
   
   - Check for extra spaces or characters
   - Ensure key is copied completely
   - Verify key hasn't expired
   ```

2. **Check API Permissions**
   ```
   - Ensure key has required permissions
   - Verify billing account is active
   - Check usage quotas and limits
   - Test key with provider's API directly
   ```

3. **Network and Proxy Issues**
   ```
   - Check firewall settings
   - Verify proxy configuration
   - Test from different network
   - Check corporate network restrictions
   ```

## Performance Issues

### High CPU Usage

**Symptoms:**
- Computer becomes slow during transcription
- Fan noise increases significantly
- Other applications become unresponsive

**Solutions:**

1. **Optimize Processing Settings**
   ```
   - Use cloud STT instead of local processing
   - Reduce audio processing quality if acceptable
   - Close unnecessary applications
   - Limit concurrent transcription sessions
   ```

2. **Hardware Considerations**
   ```
   - Ensure adequate RAM (8GB+ recommended)
   - Use SSD for better performance
   - Consider GPU acceleration for local STT
   - Monitor system temperature
   ```

3. **Browser Optimization**
   ```
   - Close unused browser tabs
   - Disable unnecessary browser extensions
   - Use dedicated browser for Teams
   - Clear browser cache regularly
   ```

### Memory Issues

**Symptoms:**
- "Out of memory" errors
- Browser crashes during long meetings
- Slow performance over time

**Solutions:**

1. **Memory Management**
   ```
   - Restart browser periodically
   - Clear transcript cache regularly
   - Limit transcript history retention
   - Use streaming processing for long meetings
   ```

2. **Configuration Adjustments**
   ```
   - Reduce audio buffer sizes
   - Enable automatic transcript cleanup
   - Use lower quality audio processing
   - Limit concurrent features
   ```

## Teams Integration Problems

### Plugin Not Loading in Meetings

**Symptoms:**
- Plugin interface doesn't appear
- Transcription controls missing
- "Plugin unavailable" message

**Solutions:**

1. **Check Meeting Type**
   ```
   - Ensure you're in a Teams meeting (not chat)
   - Verify you have host or co-host privileges
   - Check if meeting allows apps/plugins
   - Try in different meeting types
   ```

2. **Teams App Permissions**
   ```
   - Go to Teams Settings > Privacy
   - Enable app permissions
   - Check organization app policies
   - Verify plugin is enabled for your account
   ```

3. **Refresh Teams Session**
   ```
   - Leave and rejoin meeting
   - Restart Teams application
   - Clear Teams cache
   - Try Teams web version
   ```

### Chat Integration Not Working

**Symptoms:**
- Transcript not sent to chat
- "Failed to send message" error
- Chat permissions denied

**Solutions:**

1. **Check Chat Permissions**
   ```
   - Verify you can send messages manually
   - Check meeting chat settings
   - Ensure chat is enabled for meeting
   - Verify organization chat policies
   ```

2. **Message Size Limits**
   ```
   - Long transcripts may be split into multiple messages
   - Check if transcript exceeds Teams message limits
   - Try sending shorter test messages
   ```

3. **Alternative Delivery**
   ```
   - Use export feature to save transcript
   - Share via file upload to chat
   - Email transcript to participants
   ```

## API and Network Issues

### Rate Limit Exceeded

**Symptoms:**
- "Rate limit exceeded" errors
- Transcription stops working temporarily
- API quota warnings

**Solutions:**

1. **Monitor Usage**
   ```
   - Check API usage in provider dashboard
   - Monitor rate limits and quotas
   - Implement usage tracking
   - Set up billing alerts
   ```

2. **Optimize API Calls**
   ```
   - Batch audio processing when possible
   - Use appropriate audio quality settings
   - Implement exponential backoff for retries
   - Cache results when appropriate
   ```

3. **Upgrade API Plan**
   ```
   - Consider higher tier API plans
   - Use multiple API keys for load distribution
   - Implement fallback to different providers
   ```

### Network Connectivity Issues

**Symptoms:**
- Intermittent transcription failures
- "Network error" messages
- Slow API responses

**Solutions:**

1. **Network Diagnostics**
   ```
   - Test internet speed and stability
   - Check DNS resolution
   - Verify firewall settings
   - Test from different networks
   ```

2. **Proxy and Corporate Networks**
   ```
   - Configure proxy settings if required
   - Whitelist API endpoints
   - Check SSL certificate validation
   - Contact IT for network configuration
   ```

## Data and Storage Issues

### Transcripts Not Saving

**Symptoms:**
- Transcripts disappear after meeting
- "Save failed" error messages
- Storage quota exceeded warnings

**Solutions:**

1. **Check Storage Space**
   ```
   - Verify available disk space
   - Clear old transcripts if needed
   - Check browser storage quotas
   - Use external storage if available
   ```

2. **Storage Permissions**
   ```
   - Verify browser storage permissions
   - Check file system permissions
   - Ensure storage location is writable
   ```

3. **Backup and Recovery**
   ```
   - Export transcripts regularly
   - Use cloud backup if available
   - Implement automatic export
   ```

### Data Corruption Issues

**Symptoms:**
- Transcripts appear garbled
- Configuration settings corrupted
- "Invalid data format" errors

**Solutions:**

1. **Data Recovery**
   ```
   - Check for backup copies
   - Try data repair tools
   - Reset to default configuration
   - Restore from known good backup
   ```

2. **Prevention**
   ```
   - Enable automatic backups
   - Regular data validation
   - Use redundant storage
   - Monitor data integrity
   ```

## Getting Additional Help

### Diagnostic Information

When reporting issues, include:

```
System Information:
- Operating System and version
- Browser type and version
- Teams version (desktop/web)
- Plugin version

Configuration:
- STT provider and settings
- AI provider and settings
- Audio device information
- Network configuration

Error Details:
- Exact error messages
- Steps to reproduce
- Screenshots if applicable
- Browser console logs
```

### Log Collection

1. **Browser Console Logs**
   ```
   - Press F12 to open developer tools
   - Go to Console tab
   - Reproduce the issue
   - Copy all error messages
   ```

2. **Teams Logs**
   ```
   Windows: %appdata%\Microsoft\Teams\logs.txt
   macOS: ~/Library/Logs/Microsoft Teams/
   ```

3. **Plugin Diagnostic Logs**
   ```
   - Go to Settings > Advanced > Diagnostics
   - Enable debug logging
   - Reproduce issue
   - Export diagnostic report
   ```

### Support Channels

- **GitHub Issues**: For bug reports and feature requests
- **Community Forum**: For user discussions and tips
- **Email Support**: For enterprise and priority support
- **Documentation**: Check latest docs for updates

### Emergency Workarounds

If plugin is completely non-functional:

1. **Use Teams Built-in Transcription**
   - Enable Teams live captions
   - Use Teams recording with auto-transcription
   - Manual note-taking as backup

2. **Alternative Tools**
   - Use Otter.ai or similar services
   - Record meeting audio for later transcription
   - Use mobile apps for real-time transcription

3. **Fallback Procedures**
   - Designate note-taker for meeting
   - Use shared document for collaborative notes
   - Schedule follow-up for action items