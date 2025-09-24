# Teams App Icons

The Teams app requires two icon files for proper sideloading:

## Required Icons

1. **icon-color.png** - 192x192 pixels, full color icon
2. **icon-outline.png** - 32x32 pixels, white outline on transparent background

## Icon Requirements

### Color Icon (icon-color.png)
- **Size:** 192x192 pixels
- **Format:** PNG
- **Background:** Can be any color
- **Usage:** App store listings, app gallery

### Outline Icon (icon-outline.png)  
- **Size:** 32x32 pixels
- **Format:** PNG
- **Background:** Transparent
- **Foreground:** White (#FFFFFF)
- **Usage:** Teams UI, meeting toolbar

## Creating Icons

You can create these icons using:
- **Design tools:** Figma, Adobe Illustrator, Canva
- **Online generators:** Teams icon generators
- **AI tools:** DALL-E, Midjourney for icon design

## Placeholder Icons

For development and testing, you can use simple placeholder icons:

### Color Icon Design
- Background: Blue gradient (#0078d4 to #106ebe)
- Icon: Microphone symbol with sound waves
- Text: "MT" (Meeting Transcription)

### Outline Icon Design
- White microphone icon on transparent background
- Simple, recognizable at small size

## Icon Guidelines

- **Keep it simple:** Icons should be recognizable at small sizes
- **Use brand colors:** Match your organization's branding
- **Avoid text:** Icons work better than text at small sizes
- **Test visibility:** Ensure outline icon is visible on dark backgrounds
- **Follow Teams guidelines:** Check Microsoft's icon design guidelines

## Installation

Once you have the icons:

1. Save them in the `assets/` directory
2. Ensure they're named exactly `icon-color.png` and `icon-outline.png`
3. Update the manifest.json if needed
4. Rebuild the Teams app package

## Temporary Solution

For immediate testing, you can create simple colored rectangles:
- Color icon: 192x192 blue rectangle with "🎤" emoji
- Outline icon: 32x32 white microphone on transparent background

The app will work without perfect icons for development purposes.