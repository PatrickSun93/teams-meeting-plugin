# User Setup Guide

## Overview

This guide will help you install, configure, and use the Teams Meeting Transcription Plugin. The plugin provides real-time speech-to-text transcription, speaker identification, and AI-powered meeting summaries for Microsoft Teams meetings.

## Table of Contents

1. [System Requirements](#system-requirements)
2. [Installation Methods](#installation-methods)
3. [Initial Configuration](#initial-configuration)
4. [STT Service Setup](#stt-service-setup)
5. [AI Service Configuration](#ai-service-configuration)
6. [First Meeting Setup](#first-meeting-setup)
7. [Troubleshooting](#troubleshooting)

## System Requirements

### Minimum Requirements
- **Operating System**: Windows 10/11, macOS 10.15+, or Linux (Ubuntu 18.04+)
- **Browser**: Chrome 90+, Edge 90+, or Firefox 88+
- **Memory**: 4 GB RAM minimum, 8 GB recommended
- **Network**: Stable internet connection for cloud STT services
- **Microphone**: Built-in or external microphone with good audio quality

### Microsoft Teams Requirements
- **Teams Version**: Desktop app 1.4.00+ or Teams web app
- **Permissions**: Microphone access, meeting participation
- **Account**: Microsoft 365 account with Teams access
- **Role**: Meeting host privileges required to enable transcription

### Optional Requirements
- **GPU**: For local STT processing (NVIDIA GPU with CUDA support recommended)
- **Storage**: 2 GB free space for local models and transcripts
- **API Keys**: For cloud STT and AI services (OpenAI, Azure, Claude)

## Installation Methods

### Method 1: Teams App Store (Recommended)

1. **Open Microsoft Teams**
   - Launch the Teams desktop app or go to teams.microsoft.com

2. **Access Apps**
   - Click on "Apps" in the left sidebar
   - Search for "Meeting Transcription Plugin"

3. **Install the App**
   - Click on the plugin from search results
   - Click "Add" or "Install"
   - Grant required permissions when prompted

4. **Verify Installation**
   - The plugin should appear in your Teams apps list
   - You'll see a transcription icon in meeting controls

### Method 2: Sideloading (Development/Testing)

> **Note**: This method requires developer permissions in your organization.

1. **Download the App Package**
   - Download `teams-transcription-app.zip` from the releases page
   - Save it to your computer

2. **Enable Sideloading**
   - Go to Teams Admin Center (admin.teams.microsoft.com)
   - Navigate to Teams apps > Setup policies
   - Enable "Upload custom apps"

3. **Upload the App**
   - In Teams, go to Apps > Manage your apps
   - Click "Upload an app" > "Upload a custom app"
   - Select the downloaded .zip file

4. **Install for Your Organization**
   - The app will appear in your custom apps
   - Click "Add" to install

### Method 3: Organization App Catalog

> **Note**: This method requires IT administrator access.

1. **Contact Your IT Administrator**
   - Request installation of the Meeting Transcription Plugin
   - Provide the app package file if needed

2. **Wait for Deployment**
   - IT will deploy the app to your organization's catalog
   - You'll receive notification when available

3. **Install from Catalog**
   - Go to Apps in Teams
   - Find the plugin in your organization's apps
   - Click "Add" to install

## Initial Configuration

### First Launch Setup

1. **Open the Plugin**
   - Join or start a Teams meeting
   - Look for the transcription icon in meeting controls
   - Click to open the plugin interface

2. **Grant Permissions**
   - Allow microphone access when prompted
   - Grant Teams integration permissions
   - Accept privacy and data usage terms

3. **Choose Processing Mode**
   - **Local Processing**: More private, requires local resources
   - **Cloud Processing**: More accurate, requires API keys
   - **Hybrid Mode**: Combines both approaches

### Privacy Settings

1. **Data Retention**
   - Choose how long to keep transcripts (1 day to 1 year)
   - Enable automatic deletion if desired
   - Set up data export preferences

2. **Consent Management**
   - Configure participant consent requirements
   - Set up notification preferences
   - Choose data sharing options

3. **Security Options**
   - Enable transcript encryption
   - Set up secure storage preferences
   - Configure audit logging

## STT Service Setup

### Local STT (Whisper.js)

1. **Enable Local Processing**
   - Go to Settings > STT Configuration
   - Select "Local Whisper" as provider
   - Choose model size (tiny, base, small, medium, large)

2. **Download Models**
   - Click "Download Models" button
   - Wait for model download to complete
   - Test with sample audio

3. **Configure Settings**
   - Set language preference
   - Adjust confidence threshold
   - Configure processing options

### OpenAI Whisper API

1. **Get API Key**
   - Go to platform.openai.com
   - Create account or sign in
   - Navigate to API Keys section
   - Create new API key

2. **Configure in Plugin**
   - Go to Settings > STT Configuration
   - Select "OpenAI Whisper" as provider
   - Enter your API key
   - Test connection

3. **Set Preferences**
   - Choose model (whisper-1 recommended)
   - Set language (auto-detect or specific)
   - Configure response format

### Azure Speech Services

1. **Create Azure Account**
   - Go to portal.azure.com
   - Create account or sign in
   - Create new Speech Services resource

2. **Get Credentials**
   - Copy the API key from Azure portal
   - Note the service region
   - Copy the endpoint URL

3. **Configure in Plugin**
   - Go to Settings > STT Configuration
   - Select "Azure Speech" as provider
   - Enter API key, region, and endpoint
   - Test connection

### Claude Speech (if available)

1. **Get Anthropic API Key**
   - Go to console.anthropic.com
   - Create account or sign in
   - Generate API key

2. **Configure in Plugin**
   - Go to Settings > STT Configuration
   - Select "Claude Speech" as provider
   - Enter API key
   - Test connection

## AI Service Configuration

### OpenAI GPT for Summaries

1. **Use Existing API Key**
   - If you set up OpenAI for STT, the same key works
   - Or create a separate key for summaries

2. **Configure Summary Settings**
   - Go to Settings > AI Configuration
   - Select "OpenAI GPT" as provider
   - Choose model (gpt-4 recommended for best results)
   - Set temperature and max tokens

3. **Customize Summary Prompt**
   - Click "Custom Prompt" tab
   - Write your preferred summary format
   - Include agenda focus instructions
   - Save and test with sample transcript

### Claude for Summaries

1. **Configure Claude API**
   - Go to Settings > AI Configuration
   - Select "Claude" as provider
   - Enter your Anthropic API key
   - Choose model version

2. **Set Summary Preferences**
   - Configure response length
   - Set focus areas (action items, decisions, etc.)
   - Test with sample data

### Azure OpenAI

1. **Set Up Azure OpenAI**
   - Create Azure OpenAI resource
   - Deploy a model (GPT-4 recommended)
   - Get endpoint and API key

2. **Configure in Plugin**
   - Go to Settings > AI Configuration
   - Select "Azure OpenAI" as provider
   - Enter endpoint, API key, and deployment name
   - Test connection

## First Meeting Setup

### Pre-Meeting Checklist

1. **Test Audio Setup**
   - Check microphone levels
   - Test in a quiet environment
   - Verify Teams audio settings

2. **Verify Configuration**
   - Confirm STT service is working
   - Test AI summary generation
   - Check storage settings

3. **Prepare Participants**
   - Inform participants about transcription
   - Explain consent requirements
   - Share any privacy policies

### During Your First Meeting

1. **Start the Meeting**
   - Join or start your Teams meeting as usual
   - Ensure you have host privileges

2. **Enable Transcription**
   - Click the transcription icon in meeting controls
   - The plugin interface will open
   - Click "Start Transcription"

3. **Monitor Progress**
   - Watch real-time transcription appear
   - Check speaker identification accuracy
   - Adjust settings if needed

4. **End Transcription**
   - Click "Stop Transcription" when meeting ends
   - Review the final transcript
   - Generate and review summary

### Post-Meeting Actions

1. **Review Transcript**
   - Check accuracy and completeness
   - Edit any errors if needed
   - Add missing speaker names

2. **Share Results**
   - Send transcript to meeting chat
   - Export to preferred format
   - Share summary with participants

3. **Save and Archive**
   - Save transcript to local storage
   - Export for external systems
   - Set retention preferences

## Configuration Best Practices

### For Best Transcription Quality

1. **Audio Setup**
   - Use a good quality microphone
   - Minimize background noise
   - Ensure stable internet connection

2. **Meeting Environment**
   - Choose quiet locations
   - Ask participants to mute when not speaking
   - Avoid overlapping conversations

3. **STT Configuration**
   - Use cloud services for better accuracy
   - Set appropriate confidence thresholds
   - Choose correct language settings

### For Privacy and Security

1. **Local Processing**
   - Use local STT when handling sensitive information
   - Enable transcript encryption
   - Set short data retention periods

2. **Access Control**
   - Only enable for trusted meetings
   - Require participant consent
   - Use secure API key storage

3. **Data Management**
   - Regular transcript cleanup
   - Secure export procedures
   - Audit log monitoring

### For Team Collaboration

1. **Standardize Settings**
   - Use consistent summary prompts across team
   - Standardize speaker identification
   - Agree on sharing procedures

2. **Integration Workflows**
   - Set up automatic export to team tools
   - Configure notification preferences
   - Establish review processes

## Common Configuration Issues

### Microphone Not Working
- Check Teams microphone permissions
- Verify browser microphone access
- Test with other applications

### API Keys Not Working
- Verify key format and validity
- Check API quota and billing
- Ensure correct service endpoints

### Poor Transcription Quality
- Check audio input levels
- Reduce background noise
- Try different STT providers

### Summary Generation Failing
- Verify AI service configuration
- Check custom prompt syntax
- Ensure sufficient transcript content

## Getting Help

### Documentation Resources
- [API Documentation](./API_DOCUMENTATION.md)
- [Troubleshooting Guide](./TROUBLESHOOTING.md)
- [Developer Guide](./DEVELOPER_GUIDE.md)

### Support Channels
- GitHub Issues: Report bugs and feature requests
- Community Forum: Get help from other users
- Email Support: Contact for enterprise support

### Training Resources
- Video tutorials (see [Video Tutorials](#video-tutorials))
- Interactive demos
- Best practices guides

## Next Steps

After completing the setup:

1. **Practice with Test Meetings**
   - Run several test sessions
   - Experiment with different settings
   - Train speaker identification

2. **Customize for Your Needs**
   - Create custom summary prompts
   - Set up team-specific configurations
   - Integrate with your workflow tools

3. **Train Your Team**
   - Share setup instructions
   - Conduct training sessions
   - Establish usage guidelines

4. **Monitor and Optimize**
   - Review transcription accuracy
   - Adjust settings based on usage
   - Update configurations as needed

For detailed troubleshooting help, see our [Troubleshooting Guide](./TROUBLESHOOTING.md).