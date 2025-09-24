# Teams App Sideloading Guide

This guide explains how to sideload and test the Meeting Transcription plugin in Microsoft Teams.

## Prerequisites

1. **Microsoft Teams Desktop App** or **Teams Web App**
2. **Developer permissions** in your Teams organization
3. **Node.js 18+** installed
4. **Teams Toolkit** (optional but recommended)

## Step 1: Prepare the App

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Build the app:**
   ```bash
   npm run build
   ```

3. **Start the development server:**
   ```bash
   npm start
   ```
   
   The app will be available at `http://localhost:3000`

## Step 2: Update Manifest Configuration

1. **Update the manifest.json file** with your app details:
   ```json
   {
     "developer": {
       "name": "Your Company Name",
       "websiteUrl": "https://yourcompany.com",
       "privacyUrl": "https://yourcompany.com/privacy",
       "termsOfUseUrl": "https://yourcompany.com/terms"
     },
     "webApplicationInfo": {
       "id": "your-actual-app-id-here",
       "resource": "https://graph.microsoft.com"
     }
   }
   ```

2. **Ensure valid domains** point to your development server:
   ```json
   {
     "validDomains": [
       "localhost:3000",
       "yourdomain.com"
     ]
   }
   ```

## Step 3: Create App Package

1. **Create the app package directory:**
   ```bash
   mkdir teams-app-package
   ```

2. **Copy required files:**
   ```bash
   cp manifest.json teams-app-package/
   cp assets/icon-color.png teams-app-package/
   cp assets/icon-outline.png teams-app-package/
   ```

3. **Create the app package:**
   ```bash
   cd teams-app-package
   zip -r ../teams-transcription-app.zip .
   cd ..
   ```

## Step 4: Sideload in Teams

### Method 1: Teams Desktop App

1. **Open Microsoft Teams Desktop App**
2. **Go to Apps** (left sidebar)
3. **Click "Manage your apps"**
4. **Click "Upload an app"**
5. **Select "Upload a custom app"**
6. **Choose the `teams-transcription-app.zip` file**
7. **Click "Add"** to install the app

### Method 2: Teams Web App

1. **Open Teams in your browser** (teams.microsoft.com)
2. **Click on "Apps"** in the left sidebar
3. **Click "Manage your apps"** (bottom left)
4. **Click "Upload an app"**
5. **Select "Upload a custom app"**
6. **Upload the `teams-transcription-app.zip` file**

### Method 3: Teams Admin Center (Organization-wide)

1. **Go to Teams Admin Center** (admin.teams.microsoft.com)
2. **Navigate to Teams apps > Manage apps**
3. **Click "Upload new app"**
4. **Upload the app package**
5. **Set permissions and policies**

## Step 5: Test the App

### Basic Functionality Test

1. **Join or start a Teams meeting**
2. **Open the Meeting Transcription app** from the meeting toolbar
3. **Verify the app loads** and shows meeting information
4. **Check host detection** (if you're the meeting organizer)
5. **Test transcription controls** (start/stop buttons)

### Expected Behavior

✅ **App loads successfully** in Teams meeting
✅ **Meeting information displays** correctly
✅ **Host status detected** properly
✅ **Participant list shows** current attendees
✅ **Audio permission request** works
✅ **UI components render** without errors

### Troubleshooting

#### App doesn't load
- Check that the development server is running on `http://localhost:3000`
- Verify the `validDomains` in manifest.json includes your server
- Check browser console for JavaScript errors

#### Permission errors
- Ensure your Teams organization allows custom app sideloading
- Check that you have developer permissions
- Verify the app manifest has correct permissions

#### Meeting detection fails
- Make sure you're testing in an actual Teams meeting
- Check that the Teams SDK is properly initialized
- Verify browser permissions for microphone access

## Step 6: Development Testing

### Test Meeting States

1. **Test outside meeting:**
   - App should show "No Active Meeting"
   - Controls should be disabled

2. **Test as participant:**
   - Should show participant view
   - Transcription controls should be disabled
   - Should display host-controlled message

3. **Test as host/organizer:**
   - Should show host controls
   - Start/stop transcription buttons should be enabled
   - Should be able to request audio permissions

### Test Audio Integration

1. **Click "Start Transcription"**
2. **Grant microphone permissions** when prompted
3. **Verify audio stream is captured**
4. **Check console logs** for audio processing messages

### Test Error Handling

1. **Deny microphone permissions**
2. **Test with poor network connection**
3. **Test app behavior when meeting ends**

## Step 7: Production Deployment

### For Organization Deployment

1. **Update manifest.json** with production URLs
2. **Deploy app to production server** (HTTPS required)
3. **Update validDomains** to production domain
4. **Create production app package**
5. **Submit to Teams Admin Center**

### For Teams App Store

1. **Complete Microsoft Partner Center registration**
2. **Prepare store listing materials**
3. **Submit for Microsoft certification**
4. **Address any certification feedback**
5. **Publish to Teams App Store**

## Security Considerations

- **Use HTTPS** for production deployments
- **Validate all user inputs**
- **Secure API keys** and credentials
- **Implement proper authentication**
- **Follow Microsoft's security guidelines**

## Next Steps

After successful sideloading and basic testing:

1. **Implement audio capture** (Task 3)
2. **Add STT integration** (Tasks 4-6)
3. **Build transcription engine** (Task 7)
4. **Add speaker identification** (Task 8)
5. **Implement AI summaries** (Tasks 9-10)

## Support

For issues with sideloading:
- Check [Microsoft Teams Developer Documentation](https://docs.microsoft.com/en-us/microsoftteams/platform/)
- Review [Teams Toolkit Documentation](https://docs.microsoft.com/en-us/microsoftteams/platform/toolkit/teams-toolkit-fundamentals)
- Consult [Teams App Manifest Schema](https://docs.microsoft.com/en-us/microsoftteams/platform/resources/schema/manifest-schema)