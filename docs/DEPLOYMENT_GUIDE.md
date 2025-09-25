# Teams Meeting Transcription App - Deployment Guide

This comprehensive guide covers installation, deployment, and management of the Teams Meeting Transcription app.

## 📋 Table of Contents

1. [Prerequisites](#prerequisites)
2. [Building the App Package](#building-the-app-package)
3. [Sideloading for Development](#sideloading-for-development)
4. [Organization Deployment](#organization-deployment)
5. [App Store Submission](#app-store-submission)
6. [Installation Testing](#installation-testing)
7. [User Onboarding](#user-onboarding)
8. [Troubleshooting](#troubleshooting)

## Prerequisites

### System Requirements
- **Microsoft Teams:** Desktop app (recommended) or web version
- **Node.js:** Version 18+ for building the app
- **Browser:** Chrome, Edge, or Firefox (for web Teams)
- **Operating System:** Windows 10+, macOS 10.15+, or Linux

### Permissions Required
- **For Sideloading:** Teams app upload permissions in your organization
- **For Admin Deployment:** Teams administrator role
- **For App Store:** Microsoft Partner Center account

### Organization Settings
Ensure your Teams organization allows custom apps:
1. Go to Teams Admin Center → Teams apps → Setup policies
2. Enable "Upload custom apps" for target users/groups
3. Configure app permission policies as needed

## Building the App Package

### 1. Install Dependencies
```bash
# Clone or download the project
cd teams-meeting-transcription

# Install all dependencies
npm install
```

### 2. Generate App Icons
```bash
# Generate placeholder icons (SVG format)
npm run generate:icons

# For production: Create PNG icons using the HTML generator
# Open scripts/create-placeholder-icons.html in browser
# Download and save as assets/icon-color.png (192x192) and assets/icon-outline.png (32x32)
```

### 3. Configure the App
Edit `manifest.json` to customize:
- **App ID:** Change `id` to your unique identifier
- **Developer Info:** Update `developer` section with your details
- **URLs:** Replace `localhost:3000` with your production domain
- **App Registration:** Update `webApplicationInfo.id` with your Azure app ID

### 4. Build and Package
```bash
# Build the application
npm run build

# Create Teams app package
npm run package:teams

# This creates: teams-transcription-app.zip
```

## Sideloading for Development

### Method 1: Teams Desktop/Web App

1. **Open Microsoft Teams**
2. **Navigate to Apps:**
   - Click "Apps" in the left sidebar
   - Select "Manage your apps" or "Built for your org"

3. **Upload Custom App:**
   - Click "Upload a custom app" 
   - Select "Upload for me" (personal) or "Upload for [organization]"
   - Choose the `teams-transcription-app.zip` file

4. **Review and Install:**
   - Review app permissions and description
   - Click "Add" to install the app
   - The app appears in your Apps list

### Method 2: Direct Meeting Installation

1. **Join or Start a Meeting**
2. **Add App to Meeting:**
   - Click "Apps" in the meeting toolbar
   - Search for "Meeting Transcription" 
   - Click "Add" to include in the meeting

### Method 3: Teams Toolkit (Developers)

```bash
# Install Teams Toolkit CLI
npm install -g @microsoft/teamsfx-cli

# Deploy to Teams
teamsfx deploy

# Preview in Teams
teamsfx preview --local
```

## Organization Deployment

### Admin Center Deployment

1. **Access Teams Admin Center:**
   - Go to https://admin.teams.microsoft.com
   - Sign in with Teams administrator credentials

2. **Upload Custom App:**
   - Navigate to "Teams apps" → "Manage apps"
   - Click "Upload new app"
   - Select the `teams-transcription-app.zip` file

3. **Configure App Availability:**
   - Set app status to "Available" 
   - Configure which users/groups can install
   - Set up app permission policies

4. **Create App Setup Policy:**
   - Go to "Teams apps" → "Setup policies"
   - Create new policy or edit existing
   - Add the transcription app to "Installed apps"
   - Assign policy to target users

### PowerShell Deployment

```powershell
# Connect to Teams PowerShell
Connect-MicrosoftTeams

# Upload app package
New-CsTeamsApp -Path "teams-transcription-app.zip"

# Get app ID
$app = Get-CsTeamsApp -Identity "teams-meeting-transcription-app"

# Allow app for organization
Set-CsTeamsAppPermissionPolicy -Identity "Global" -AppIds @{Add=$app.Id}
```

### Bulk Deployment Script

```bash
#!/bin/bash
# bulk-deploy.sh - Deploy to multiple tenants

TENANTS=("tenant1.onmicrosoft.com" "tenant2.onmicrosoft.com")
APP_PACKAGE="teams-transcription-app.zip"

for tenant in "${TENANTS[@]}"; do
    echo "Deploying to $tenant..."
    # Use Microsoft Graph API or Teams Toolkit
    teamsfx deploy --tenant $tenant --package $APP_PACKAGE
done
```

## App Store Submission

### 1. Prepare Submission Materials

**Required Files:**
- `teams-transcription-app.zip` (app package)
- App icons (PNG format, high resolution)
- Screenshots (1366x768 recommended)
- Privacy policy document
- Terms of use document
- App description and metadata

**Create Submission Package:**
```bash
# Create submission directory
mkdir teams-app-submission
cd teams-app-submission

# Copy required files
cp ../teams-transcription-app.zip .
cp ../assets/screenshots/* .
cp ../docs/privacy-policy.pdf .
cp ../docs/terms-of-use.pdf .

# Create submission checklist
cat > submission-checklist.md << EOF
# Teams App Store Submission Checklist

## Required Items
- [x] App package (teams-transcription-app.zip)
- [x] App icons (192x192 color, 32x32 outline)
- [x] Screenshots (at least 3, max 5)
- [x] Privacy policy URL
- [x] Terms of use URL
- [x] App description (short and full)
- [x] Developer information
- [x] Support contact information

## Testing Completed
- [x] Sideloading test successful
- [x] All features working
- [x] No security vulnerabilities
- [x] Accessibility compliance
- [x] Performance testing passed

## Compliance
- [x] Privacy policy compliant
- [x] Data handling documented
- [x] Security measures implemented
- [x] Terms of service complete
EOF
```

### 2. Partner Center Submission

1. **Access Partner Center:**
   - Go to https://partner.microsoft.com
   - Sign in with developer account

2. **Create New Submission:**
   - Navigate to "Office Store" → "Teams"
   - Click "Create new submission"
   - Upload app package and materials

3. **Complete Submission Form:**
   - App details and descriptions
   - Pricing and availability
   - Properties and categories
   - Age ratings and certifications

4. **Submit for Review:**
   - Review all information
   - Submit for Microsoft certification
   - Monitor review status

### 3. Certification Process

**Timeline:** 5-10 business days typically

**Review Stages:**
1. **Automated Testing:** Basic functionality and security
2. **Manual Review:** Feature testing and compliance
3. **Security Review:** Data handling and permissions
4. **Final Approval:** Publishing to store

## Installation Testing

### Test Scenarios

Create a comprehensive test plan:

```javascript
// test-installation.js
const testScenarios = [
    {
        name: "Fresh Installation",
        steps: [
            "Install app from package",
            "Grant required permissions", 
            "Verify app appears in Teams",
            "Test basic functionality"
        ]
    },
    {
        name: "Update Installation", 
        steps: [
            "Install previous version",
            "Update to new version",
            "Verify settings preserved",
            "Test new features"
        ]
    },
    {
        name: "Uninstallation",
        steps: [
            "Remove app from Teams",
            "Verify data cleanup",
            "Confirm no residual files",
            "Test reinstallation"
        ]
    }
];
```

### Automated Testing Script

```bash
#!/bin/bash
# test-installation.sh

echo "🧪 Testing Teams App Installation..."

# Test 1: Package validation
echo "1️⃣ Validating app package..."
if [ -f "teams-transcription-app.zip" ]; then
    unzip -t teams-transcription-app.zip
    echo "✅ Package is valid"
else
    echo "❌ Package not found"
    exit 1
fi

# Test 2: Manifest validation
echo "2️⃣ Validating manifest..."
unzip -p teams-transcription-app.zip manifest.json | jq . > /dev/null
if [ $? -eq 0 ]; then
    echo "✅ Manifest is valid JSON"
else
    echo "❌ Invalid manifest"
    exit 1
fi

# Test 3: Icon validation
echo "3️⃣ Checking required icons..."
for icon in "icon-color.png" "icon-outline.png"; do
    if unzip -l teams-transcription-app.zip | grep -q $icon; then
        echo "✅ Found $icon"
    else
        echo "⚠️  Missing $icon"
    fi
done

echo "🎉 Installation tests completed!"
```

## User Onboarding

### 1. Installation Guide for End Users

Create user-friendly documentation:

```markdown
# Quick Start Guide - Meeting Transcription App

## Step 1: Install the App
1. Open Microsoft Teams
2. Click "Apps" in the sidebar
3. Search for "Meeting Transcription"
4. Click "Add" to install

## Step 2: First-Time Setup
1. Open the app from your Apps list
2. Configure your preferences:
   - Choose transcription service (Local/Cloud)
   - Set up API keys if needed
   - Customize summary prompts

## Step 3: Use in Meetings
1. Join or start a Teams meeting
2. Click "Apps" in the meeting toolbar
3. Select "Meeting Transcription"
4. Click "Start Transcription" (hosts only)

## Step 4: Review Results
- Real-time transcription appears during meeting
- Complete transcript sent to chat after meeting
- AI summary follows the transcript
```

### 2. Training Materials

**Video Tutorial Script:**
```
0:00 - Introduction to Meeting Transcription App
0:30 - Installation walkthrough
1:00 - Configuration options
1:30 - Using in meetings (host perspective)
2:00 - Using in meetings (participant perspective)  
2:30 - Reviewing transcripts and summaries
3:00 - Troubleshooting common issues
3:30 - Privacy and security features
```

**Interactive Demo:**
Create a demo meeting scenario with sample transcription to show features.

### 3. Support Documentation

```markdown
# Support Resources

## Getting Help
- **Email:** support@yourcompany.com
- **Documentation:** https://docs.yourcompany.com/teams-transcription
- **Video Tutorials:** https://videos.yourcompany.com/teams-app
- **Community Forum:** https://community.yourcompany.com

## Common Questions
- How do I configure API keys?
- Why isn't transcription starting?
- How do I customize summary prompts?
- What data is stored locally vs. cloud?

## Feedback and Feature Requests
- Submit via the app's feedback button
- Email feature requests to product@yourcompany.com
- Vote on features in our community forum
```

## Troubleshooting

### Common Installation Issues

**Issue: "Upload failed - Invalid package"**
```bash
# Solution: Validate package structure
unzip -l teams-transcription-app.zip
# Should contain: manifest.json, icon-color.png, icon-outline.png

# Check manifest syntax
cat manifest.json | jq .
```

**Issue: "App not appearing in Teams"**
- Check if custom apps are enabled in organization
- Verify user has permission to install apps
- Try refreshing Teams or restarting application

**Issue: "Permission denied during installation"**
- Contact Teams administrator
- Check app permission policies
- Verify organization allows the required permissions

### Runtime Issues

**Issue: "Microphone access denied"**
```javascript
// Check permissions in browser console
navigator.permissions.query({name: 'microphone'})
  .then(result => console.log('Microphone permission:', result.state));
```

**Issue: "Transcription not starting"**
- Verify API keys are configured
- Check network connectivity
- Try local STT mode as fallback
- Review browser console for errors

**Issue: "Chat integration not working"**
- Ensure app has chat permissions
- Verify meeting chat is enabled
- Check if user is meeting host/presenter

### Diagnostic Tools

**Built-in Diagnostics:**
The app includes a diagnostic panel accessible via the settings menu:
- Audio input levels
- API connectivity tests  
- Permission status
- Service health checks

**Log Collection:**
```javascript
// Enable debug logging
localStorage.setItem('transcription-debug', 'true');

// Export logs
const logs = JSON.parse(localStorage.getItem('transcription-logs') || '[]');
console.log('App logs:', logs);
```

### Getting Support

**For Developers:**
- Check GitHub issues and documentation
- Review Teams app development guidelines
- Use Teams Toolkit debugging features

**For End Users:**
- Contact your IT administrator
- Check organization's Teams app policies
- Submit support ticket through proper channels

**For Administrators:**
- Review Teams Admin Center logs
- Check app permission policies
- Monitor usage analytics and reports

---

## 📞 Support Contacts

- **Technical Support:** support@yourcompany.com
- **Sales Inquiries:** sales@yourcompany.com  
- **Privacy Questions:** privacy@yourcompany.com
- **Security Issues:** security@yourcompany.com

For the most up-to-date information, visit our documentation site at https://docs.yourcompany.com/teams-transcription