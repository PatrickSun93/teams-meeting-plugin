# Multi-Platform Deployment Guide

This guide covers the deployment process for the Universal Meeting Transcription Plugin across Microsoft Teams, Zoom, and browser extension platforms.

## Overview

The plugin supports three deployment targets:
- **Microsoft Teams**: Native Teams app via Teams App Store or sideloading
- **Zoom**: Zoom App Marketplace integration
- **Browser Extension**: Chrome Web Store and Firefox Add-ons

## Prerequisites

### Development Environment
- Node.js 18+ installed
- npm package manager
- Git for version control
- Platform-specific developer accounts (see below)

### Platform Developer Accounts
- **Microsoft Teams**: Microsoft Partner Center account
- **Zoom**: Zoom App Marketplace developer account
- **Chrome Extension**: Chrome Web Store developer account
- **Firefox Extension**: Firefox Add-ons developer account

## Build Process

### Automated Build (Recommended)

Use the multi-platform build script to build all platforms:

```bash
# Build all platforms
npm run build:all-platforms

# Build specific platform
npm run build:teams
npm run build:zoom
npm run build:extension
```

### Manual Build Process

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Run Tests**
   ```bash
   npm run test:all
   ```

3. **Build Platforms**
   ```bash
   # Teams app
   node scripts/build-platforms.js teams
   
   # Zoom app
   node scripts/build-platforms.js zoom
   
   # Browser extension
   node scripts/build-platforms.js extension
   ```

4. **Validate Packages**
   ```bash
   node scripts/deploy-validation.js
   ```

## Platform-Specific Deployment

### Microsoft Teams Deployment

#### 1. Sideloading (Development/Testing)

**Prerequisites:**
- Teams admin permissions or developer tenant
- Teams desktop or web client

**Steps:**
1. Build the Teams app package:
   ```bash
   npm run build:teams
   ```

2. Locate the package: `dist/teams-package.zip`

3. Upload to Teams:
   - Open Microsoft Teams
   - Go to Apps → Manage your apps
   - Click "Upload a custom app"
   - Select the zip file

**Troubleshooting:**
- Ensure manifest.json is valid
- Check app permissions in Teams Admin Center
- Verify icons are correct size (32x32 and 192x192 pixels)

#### 2. Teams App Store Submission

**Prerequisites:**
- Microsoft Partner Center account
- App certification compliance
- Privacy policy and terms of service

**Steps:**
1. Prepare submission package:
   ```bash
   npm run build:teams
   npm run validate:teams
   ```

2. Create Partner Center listing:
   - Log into Microsoft Partner Center
   - Create new Teams app submission
   - Upload the validated package
   - Complete app metadata and descriptions

3. Submit for review:
   - Microsoft reviews typically take 1-2 weeks
   - Address any feedback from certification team
   - App goes live after approval

**Requirements:**
- App must pass Microsoft certification
- Privacy policy URL required
- Support contact information
- Detailed app description and screenshots

### Zoom Deployment

#### 1. Zoom App Marketplace Submission

**Prerequisites:**
- Zoom App Marketplace developer account
- OAuth app registration
- Webhook endpoint (for production)

**Steps:**
1. Build Zoom app:
   ```bash
   npm run build:zoom
   ```

2. Set up OAuth app:
   - Log into Zoom Marketplace
   - Create new app → OAuth
   - Configure redirect URIs and scopes
   - Note client ID and secret

3. Configure webhooks (if needed):
   - Set up webhook endpoint URL
   - Configure event subscriptions
   - Implement webhook verification

4. Submit app:
   - Upload app package
   - Complete app information
   - Submit for Zoom review

**Required Scopes:**
```json
{
  "scopes": [
    "meeting:read",
    "meeting:write", 
    "chat_message:write",
    "user:read"
  ]
}
```

#### 2. Browser Extension Fallback

For users who can't install the Zoom app:
```bash
npm run build:extension
```
Deploy as browser extension with Zoom web client support.

### Browser Extension Deployment

#### 1. Chrome Web Store

**Prerequisites:**
- Chrome Web Store developer account ($5 registration fee)
- Extension package under 128MB

**Steps:**
1. Build extension:
   ```bash
   npm run build:extension
   ```

2. Prepare Chrome Web Store listing:
   - Create developer account at Chrome Web Store
   - Prepare screenshots and promotional images
   - Write detailed description

3. Upload and submit:
   - Upload the extension zip file
   - Complete store listing information
   - Submit for review (typically 1-3 days)

**Chrome Web Store Requirements:**
- Manifest V3 compliance
- Privacy policy for data collection
- Detailed permission justifications
- High-quality screenshots (1280x800 or 640x400)

#### 2. Firefox Add-ons

**Prerequisites:**
- Firefox Add-ons developer account (free)
- WebExtensions API compatibility

**Steps:**
1. Ensure Firefox compatibility:
   ```bash
   npm run test:firefox-compat
   ```

2. Submit to Firefox Add-ons:
   - Create account at addons.mozilla.org
   - Upload extension package
   - Complete listing information
   - Submit for review

**Firefox Requirements:**
- Source code review for complex extensions
- WebExtensions API compliance
- Privacy policy for data collection

## CI/CD Pipeline

### GitHub Actions Workflow

The project includes automated CI/CD pipeline (`.github/workflows/multi-platform-build.yml`):

**Triggers:**
- Push to main/develop branches
- Pull requests
- Version tags (v*)

**Pipeline Stages:**
1. **Test**: Unit, integration, security tests
2. **Build**: Parallel builds for all platforms
3. **Validate**: Package validation and compliance checks
4. **E2E Tests**: End-to-end testing across platforms
5. **Deploy Staging**: Automatic staging deployment (develop branch)
6. **Release**: Create GitHub release (version tags)
7. **Deploy Production**: Submit to app stores (version tags)

### Environment Variables

Configure these secrets in GitHub repository settings:

```bash
# Microsoft Teams
TEAMS_APP_ID=your-teams-app-id
TEAMS_CLIENT_SECRET=your-teams-client-secret

# Zoom
ZOOM_CLIENT_ID=your-zoom-client-id
ZOOM_CLIENT_SECRET=your-zoom-client-secret
ZOOM_WEBHOOK_SECRET=your-webhook-secret

# Chrome Web Store
CHROME_EXTENSION_ID=your-extension-id
CHROME_CLIENT_ID=your-chrome-client-id
CHROME_CLIENT_SECRET=your-chrome-client-secret
CHROME_REFRESH_TOKEN=your-refresh-token

# General
ENCRYPTION_KEY=your-encryption-key
API_BASE_URL=https://your-api-domain.com
```

## Deployment Validation

### Automated Validation

Run comprehensive validation before deployment:

```bash
# Validate all platforms
npm run validate:all

# Platform-specific validation
npm run validate:teams
npm run validate:zoom
npm run validate:extension
```

### Manual Testing Checklist

#### Teams App Testing
- [ ] App loads correctly in Teams client
- [ ] Meeting detection works
- [ ] Audio capture functions
- [ ] Transcription displays in real-time
- [ ] Chat integration sends messages
- [ ] Configuration panel accessible
- [ ] Error handling graceful

#### Zoom App Testing
- [ ] OAuth flow completes successfully
- [ ] Meeting events trigger correctly
- [ ] Webhook endpoints respond
- [ ] Audio processing works
- [ ] Chat messages post correctly
- [ ] App uninstalls cleanly

#### Browser Extension Testing
- [ ] Extension installs without errors
- [ ] Content scripts inject properly
- [ ] Google Meet detection works
- [ ] Audio capture permissions granted
- [ ] Export functionality works
- [ ] Options page saves settings
- [ ] Extension updates automatically

## Monitoring and Analytics

### Production Monitoring

Set up monitoring for deployed applications:

1. **Application Performance Monitoring (APM)**
   - Error tracking (Sentry, Bugsnag)
   - Performance monitoring
   - User analytics

2. **Platform-Specific Monitoring**
   - Teams: Application Insights
   - Zoom: Webhook delivery monitoring
   - Extension: Chrome Web Store analytics

3. **Custom Metrics**
   - Transcription accuracy rates
   - User engagement metrics
   - Error rates by platform

### Health Checks

Implement health check endpoints:

```javascript
// Health check for Zoom webhooks
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version
  });
});
```

## Rollback Procedures

### Emergency Rollback

If critical issues are discovered post-deployment:

1. **Teams App**
   - Remove from Teams Admin Center
   - Notify users via Teams announcement
   - Deploy previous version

2. **Zoom App**
   - Disable app in Zoom Marketplace
   - Update webhook endpoints
   - Rollback to previous version

3. **Browser Extension**
   - Unpublish from Chrome Web Store
   - Push emergency update
   - Notify users via extension popup

### Gradual Rollout

For major updates, use gradual rollout:

1. Deploy to staging environment
2. Test with beta users
3. Deploy to 10% of production users
4. Monitor metrics and feedback
5. Gradually increase to 100%

## Troubleshooting

### Common Deployment Issues

#### Teams App Issues
- **Manifest validation errors**: Check manifest.json syntax and required fields
- **Icon size errors**: Ensure icons are exactly 32x32 and 192x192 pixels
- **Permission errors**: Verify app permissions in Teams Admin Center
- **Sideloading blocked**: Check organization policies

#### Zoom App Issues
- **OAuth errors**: Verify client ID, secret, and redirect URIs
- **Webhook failures**: Check endpoint URL and SSL certificate
- **Scope errors**: Ensure all required scopes are requested
- **Rate limiting**: Implement proper rate limiting and retry logic

#### Extension Issues
- **Manifest V3 errors**: Update to Manifest V3 format
- **Permission errors**: Justify all requested permissions
- **Content script injection**: Check host permissions and timing
- **Storage quota**: Monitor extension storage usage

### Support Contacts

- **Teams Support**: Microsoft Partner Center support
- **Zoom Support**: Zoom Developer Support (devsupport@zoom.us)
- **Chrome Support**: Chrome Web Store Developer Support
- **Firefox Support**: Firefox Add-ons Community

## Security Considerations

### Data Protection
- All user data encrypted at rest and in transit
- API keys stored securely using platform key management
- Regular security audits and penetration testing
- GDPR and privacy compliance

### Platform Security
- Follow platform-specific security guidelines
- Implement proper authentication and authorization
- Use HTTPS for all communications
- Regular dependency updates and vulnerability scanning

## Performance Optimization

### Build Optimization
- Code splitting for platform-specific features
- Asset optimization and compression
- Bundle size monitoring and optimization
- Lazy loading for non-critical components

### Runtime Optimization
- Efficient audio processing algorithms
- Memory management and garbage collection
- Network request optimization
- Caching strategies for improved performance

## Conclusion

This multi-platform deployment approach ensures consistent functionality across Teams, Zoom, and browser environments while adapting to each platform's specific capabilities and requirements. Regular testing, monitoring, and updates are essential for maintaining a high-quality user experience across all platforms.