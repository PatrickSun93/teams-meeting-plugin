# Teams Meeting Transcription App - Assets

This directory contains all visual and media assets required for the Teams Meeting Transcription app.

## 📁 Current Assets

- `icon-color.svg` - Color icon (SVG placeholder) ✅
- `icon-outline.svg` - Outline icon (SVG placeholder) ✅
- `create-icons.md` - Icon creation guide ✅
- `README.md` - This documentation ✅

## 📋 Required for Production

- `icon-color.png` - 192x192 color icon (PNG) ⚠️ Needed
- `icon-outline.png` - 32x32 outline icon (PNG) ⚠️ Needed
- `screenshots/` - App store screenshots ⚠️ Needed

## 🎨 Icon Requirements

### Color Icon (icon-color.png)
- **Size:** 192x192 pixels
- **Format:** PNG with transparency
- **Usage:** Teams app store, installation dialogs
- **Design:** Full color microphone/transcription icon
- **Status:** SVG placeholder available, PNG needed

### Outline Icon (icon-outline.png)
- **Size:** 32x32 pixels
- **Format:** PNG with transparent background
- **Color:** White (#FFFFFF) only
- **Usage:** Teams meeting toolbar, small UI elements
- **Design:** Simple microphone symbol
- **Status:** SVG placeholder available, PNG needed

## 🛠️ Creating Production Icons

### Quick Start (Development)
```bash
# Generate SVG placeholders
npm run generate:icons

# Create PNG icons using HTML generator
open scripts/create-placeholder-icons.html
```

### Professional Icons (Production)
1. **Design Tools:** Figma, Adobe Illustrator, Canva
2. **AI Generation:** DALL-E, Midjourney for custom designs
3. **Icon Libraries:** Use existing microphone/transcription icons

## 📸 Screenshots Needed

For app store submission, create 3-5 screenshots (1366x768):
1. Meeting transcription interface
2. Configuration panel
3. AI summary generation
4. Chat integration
5. Analytics dashboard (optional)

## 🔧 Validation

Test your assets:
```bash
# Test current package
npm run test:installation

# Validate complete package
npm run validate:package
```

## 📞 Support

For asset creation help:
- Review `create-icons.md` for detailed guidance
- Use HTML generator in `scripts/create-placeholder-icons.html`
- Check Teams design guidelines for best practices