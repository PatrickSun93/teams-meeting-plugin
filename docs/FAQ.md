# Frequently Asked Questions (FAQ)

## General Questions

### What is the Teams Meeting Transcription Plugin?

The Teams Meeting Transcription Plugin is a comprehensive solution that provides real-time speech-to-text transcription, speaker identification, and AI-powered meeting summaries for Microsoft Teams meetings. It supports both local and cloud-based processing options to meet different privacy and accuracy requirements.

### How does the plugin work?

The plugin integrates with Microsoft Teams to:
1. Capture audio from meeting participants
2. Convert speech to text using configurable STT services
3. Identify speakers and label their contributions
4. Generate AI-powered summaries with action items
5. Send transcripts and summaries to the meeting chat or export them

### Is the plugin free to use?

The plugin itself is free, but some features may incur costs:
- **Local processing**: Completely free but requires system resources
- **Cloud STT services**: Costs vary by provider (OpenAI, Azure, Google)
- **AI summary generation**: Costs depend on the AI service used

## Installation and Setup

### How do I install the plugin?

There are three installation methods:

1. **Teams App Store** (Recommended):
   - Open Teams → Apps → Search "Meeting Transcription Plugin" → Install

2. **Sideloading** (Development/Testing):
   - Download the app package → Teams → Apps → Upload custom app

3. **Organization Catalog** (Enterprise):
   - Contact your IT administrator for deployment

### What permissions does the plugin need?

The plugin requires:
- **Microphone access**: To capture meeting audio
- **Teams integration**: To access meeting information and send messages
- **Storage access**: To save transcripts and settings locally
- **Network access**: For cloud STT and AI services (if used)

### Why can't I see the plugin in my Teams meeting?

Common reasons:
- Plugin not installed or enabled
- Insufficient permissions (need host/co-host role)
- Organization policies blocking custom apps
- Browser compatibility issues

**Solution**: Check installation status, verify permissions, and contact IT if needed.

## Configuration and Settings

### Which STT service should I choose?

**For privacy-sensitive meetings**: Local Whisper
**For best accuracy**: OpenAI Whisper or Azure Speech
**For enterprise features**: Azure Speech Services
**For cost-effectiveness**: Local Whisper (free) or OpenAI Whisper

### How do I configure API keys?

1. Go to Settings → STT Configuration
2. Select your preferred provider
3. Enter the API key (obtained from the service provider)
4. Test the connection
5. Save settings

**Security Note**: API keys are encrypted and stored securely locally.

### Can I use multiple STT providers?

Yes, you can configure multiple providers and switch between them or set up automatic fallback:
- Primary provider for normal use
- Fallback provider if primary fails
- Different providers for different meeting types

### How do I create custom summary prompts?

1. Go to Settings → AI Configuration
2. Click "Custom Prompt" tab
3. Write your prompt with specific instructions
4. Include variables like {agenda}, {participants}, {duration}
5. Test with sample transcript
6. Save for future use

## Privacy and Security

### Is my data secure?

Yes, the plugin implements multiple security layers:
- **Encryption**: All stored data is encrypted using AES-256
- **Local processing**: Option to keep all data on your device
- **Secure transmission**: TLS encryption for cloud services
- **Access controls**: User authentication and authorization

### What data does the plugin collect?

**Essential data**:
- Meeting audio (temporary, for transcription only)
- Transcripts and summaries
- Configuration settings

**Optional data** (with consent):
- Usage analytics for improvement
- Error logs for troubleshooting

### Can I use the plugin without cloud services?

Yes, enable "Local Processing Mode":
- Uses local Whisper model for transcription
- Processes everything on your device
- No data sent to external services
- Completely private but requires more system resources

### How long is my data retained?

**Default retention periods**:
- Audio data: Deleted immediately after processing
- Transcripts: 90 days (configurable: 1-365 days)
- Summaries: 180 days (configurable: 30-730 days)
- Settings: Until manually deleted

You can configure shorter retention periods or delete data manually at any time.

### Is the plugin GDPR compliant?

Yes, the plugin is designed with GDPR compliance in mind:
- **Consent management**: Clear consent flows
- **Data minimization**: Collects only necessary data
- **User rights**: Access, rectification, erasure, portability
- **Privacy by design**: Default privacy-friendly settings

## Usage and Features

### Do I need to be the meeting host to use transcription?

Yes, only meeting hosts or co-hosts can enable transcription for the entire meeting. This ensures:
- Proper consent from all participants
- Control over data processing
- Compliance with privacy regulations

### How accurate is the transcription?

Accuracy depends on several factors:
- **Audio quality**: Clear audio = better transcription
- **STT provider**: Cloud services generally more accurate
- **Language**: English typically has highest accuracy
- **Content type**: Business conversations vs. technical discussions

**Typical accuracy rates**:
- Local Whisper: 85-92%
- OpenAI Whisper: 90-95%
- Azure/Google Cloud: 88-94%

### Can the plugin identify speakers automatically?

Yes, the plugin includes speaker identification features:
- **Voice pattern analysis**: Learns speaker characteristics
- **Automatic labeling**: Assigns speaker IDs to transcript segments
- **Manual correction**: Edit speaker labels if needed
- **Participant mapping**: Links voice patterns to meeting participants

### How do I improve speaker identification accuracy?

1. **Enroll speakers**: Record voice samples before meetings
2. **Use individual microphones**: Avoid shared audio sources
3. **Minimize overlapping speech**: Ask participants to avoid talking simultaneously
4. **Consistent setup**: Use same audio equipment across meetings
5. **Manual training**: Correct misidentifications to improve future accuracy

### Can I edit transcripts after the meeting?

Yes, the plugin provides transcript editing features:
- **Text correction**: Fix transcription errors
- **Speaker reassignment**: Correct speaker labels
- **Segment merging/splitting**: Adjust transcript structure
- **Annotation**: Add notes and comments
- **Version history**: Track changes and revisions

### How do I share transcripts with participants?

Multiple sharing options:
1. **Teams chat**: Automatically send to meeting chat
2. **Export**: Download as PDF, Word, or text file
3. **Email**: Send via email integration
4. **Link sharing**: Generate secure sharing links
5. **Integration**: Export to other collaboration tools

## Technical Issues

### The plugin is not capturing audio. What should I do?

**Troubleshooting steps**:
1. Check microphone permissions in browser and Teams
2. Verify audio device is working in Teams settings
3. Test with different microphone or audio source
4. Restart Teams application
5. Check for browser or plugin updates

### Transcription is very slow or not working. How can I fix this?

**Common solutions**:
1. **Check internet connection** for cloud services
2. **Verify API keys** are correct and have sufficient quota
3. **Try different STT provider** as fallback
4. **Reduce audio quality** if processing is slow
5. **Close other applications** to free up system resources

### The summary generation is failing. What's wrong?

**Possible causes and solutions**:
1. **AI service issues**: Check API key and service status
2. **Insufficient transcript content**: Ensure meeting has enough speech
3. **Custom prompt errors**: Validate prompt syntax and length
4. **Rate limits**: Wait and retry, or upgrade API plan
5. **Network issues**: Check internet connectivity

### Why is the plugin using so much CPU/memory?

**Resource usage factors**:
- **Local STT processing**: Requires significant CPU/GPU
- **Large model sizes**: Bigger models use more memory
- **Real-time processing**: Continuous audio analysis
- **Multiple features**: Speaker ID + transcription + summary

**Optimization tips**:
- Use cloud STT services instead of local processing
- Choose smaller local models (tiny/base instead of large)
- Close unnecessary browser tabs and applications
- Upgrade hardware if consistently using local processing

### Can I use the plugin on mobile devices?

**Current limitations**:
- Full functionality requires desktop/laptop
- Mobile browsers have limited audio processing capabilities
- Teams mobile app has restricted plugin support

**Mobile alternatives**:
- Use Teams web app on mobile browser
- Access transcripts via mobile after desktop processing
- Use mobile for viewing/sharing existing transcripts

## Integration and Compatibility

### Which Teams versions are supported?

**Supported versions**:
- Teams desktop app 1.4.00 or later
- Teams web app (latest browsers)
- Teams for Mac 1.4.00 or later

**Browser compatibility**:
- Chrome 90+ (recommended)
- Edge 90+
- Firefox 88+
- Safari 14+ (limited support)

### Can I integrate with other meeting platforms?

The plugin is designed with platform abstraction:
- **Primary support**: Microsoft Teams
- **Planned support**: Zoom, Google Meet, WebEx
- **Generic support**: Any platform with audio access

### Does the plugin work with Teams Phone calls?

**Current status**:
- Teams meetings: Full support
- Teams calls: Limited support
- PSTN calls: Not supported

### Can I integrate transcripts with other tools?

**Export and integration options**:
- **Microsoft 365**: OneNote, SharePoint, Outlook
- **Productivity tools**: Notion, Obsidian, Roam Research
- **Project management**: Jira, Asana, Trello
- **CRM systems**: Salesforce, HubSpot
- **Custom integrations**: API and webhook support

## Billing and Costs

### What are the costs for cloud services?

**Approximate costs per hour of audio**:
- **OpenAI Whisper**: $0.36/hour
- **Azure Speech**: $1.00-2.00/hour (depending on tier)
- **Google Cloud Speech**: $1.44-2.88/hour
- **Local processing**: Free (but uses system resources)

### How can I monitor my API usage and costs?

**Usage monitoring**:
1. Check provider dashboards (OpenAI, Azure, Google)
2. Use plugin's built-in usage tracking
3. Set up billing alerts with providers
4. Monitor monthly usage reports

**Cost optimization tips**:
- Use local processing for routine meetings
- Reserve cloud services for important meetings
- Batch process recordings instead of real-time
- Choose appropriate quality settings

### Are there enterprise pricing options?

**Enterprise features**:
- Volume discounts for API usage
- Custom deployment and support
- Advanced security and compliance features
- Integration with enterprise identity systems

Contact your service providers for enterprise pricing.

## Troubleshooting Common Errors

### "Microphone access denied"

**Solutions**:
1. Grant microphone permissions in browser settings
2. Check Teams microphone permissions
3. Verify system microphone permissions (Windows/Mac)
4. Try different browser or incognito mode
5. Restart browser and Teams

### "API key invalid or expired"

**Solutions**:
1. Verify API key format is correct
2. Check if key has expired or been revoked
3. Ensure billing account is active
4. Regenerate API key from provider dashboard
5. Test key with provider's API directly

### "Network connection failed"

**Solutions**:
1. Check internet connectivity
2. Verify firewall settings allow API access
3. Test with different network (mobile hotspot)
4. Check proxy settings if in corporate environment
5. Contact IT administrator for network configuration

### "Insufficient storage space"

**Solutions**:
1. Clear old transcripts and cached data
2. Reduce transcript retention period
3. Export important transcripts before deletion
4. Free up disk space on device
5. Use cloud storage for transcript backup

### "Plugin not loading in meeting"

**Solutions**:
1. Refresh browser or restart Teams
2. Check if plugin is enabled in Teams settings
3. Verify meeting permissions (host/co-host required)
4. Clear Teams cache and reinstall plugin
5. Try different browser or device

## Best Practices

### For Meeting Hosts

1. **Pre-meeting setup**:
   - Test plugin functionality before important meetings
   - Inform participants about transcription
   - Obtain necessary consents
   - Configure appropriate privacy settings

2. **During meetings**:
   - Start transcription early in the meeting
   - Monitor transcription quality
   - Pause for technical issues if needed
   - Encourage clear speech and minimal overlap

3. **Post-meeting**:
   - Review transcript accuracy
   - Generate and share summaries
   - Export important transcripts
   - Follow up on action items

### For Organizations

1. **Deployment**:
   - Establish privacy and security policies
   - Provide user training and documentation
   - Configure appropriate default settings
   - Monitor usage and compliance

2. **Governance**:
   - Define data retention policies
   - Establish consent procedures
   - Create incident response plans
   - Regular security assessments

### For Privacy and Security

1. **Data protection**:
   - Use local processing for sensitive meetings
   - Enable encryption for all stored data
   - Regularly review and delete old transcripts
   - Monitor access and usage logs

2. **Compliance**:
   - Understand applicable regulations (GDPR, HIPAA, etc.)
   - Maintain proper documentation
   - Conduct privacy impact assessments
   - Train users on compliance requirements

## Getting Help and Support

### Where can I find more documentation?

**Available resources**:
- [User Setup Guide](./USER_SETUP_GUIDE.md)
- [API Documentation](./API_DOCUMENTATION.md)
- [Developer Guide](./DEVELOPER_GUIDE.md)
- [Privacy and Security](./PRIVACY_SECURITY.md)
- [Troubleshooting Guide](./TROUBLESHOOTING.md)

### How do I report bugs or request features?

**GitHub Issues**: 
- Bug reports: Use bug report template
- Feature requests: Use feature request template
- Security issues: Use security issue template (private)

**Community Forum**:
- User discussions and tips
- Community-driven support
- Feature discussions and voting

### Is there enterprise support available?

**Enterprise support options**:
- Priority email support
- Phone support for critical issues
- Custom deployment assistance
- Training and onboarding services
- SLA agreements available

### How do I stay updated on new features?

**Stay informed**:
- GitHub releases and changelog
- Plugin update notifications
- Community newsletter (optional)
- Social media announcements
- Documentation updates

### Can I contribute to the project?

**Contribution opportunities**:
- Code contributions (see [Developer Guide](./DEVELOPER_GUIDE.md))
- Documentation improvements
- Translation and localization
- Bug reports and testing
- Feature suggestions and feedback

See our [Contributing Guidelines](./CONTRIBUTING.md) for more information.

---

**Still have questions?** 

Check our [Troubleshooting Guide](./TROUBLESHOOTING.md) or reach out through our support channels. We're here to help!