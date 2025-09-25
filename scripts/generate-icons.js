const fs = require('fs');
const path = require('path');

// Simple SVG to create placeholder icons
function createColorIconSVG() {
    return `<svg width="192" height="192" xmlns="http://www.w3.org/2000/svg">
        <defs>
            <linearGradient id="bg" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" style="stop-color:#0078d4;stop-opacity:1" />
                <stop offset="100%" style="stop-color:#106ebe;stop-opacity:1" />
            </linearGradient>
        </defs>
        <rect width="192" height="192" fill="url(#bg)" rx="20"/>
        <text x="96" y="120" font-family="Arial, sans-serif" font-size="80" fill="white" text-anchor="middle">🎤</text>
        <circle cx="96" cy="96" r="60" fill="none" stroke="rgba(255,255,255,0.3)" stroke-width="2"/>
        <circle cx="96" cy="96" r="75" fill="none" stroke="rgba(255,255,255,0.2)" stroke-width="2"/>
    </svg>`;
}

function createOutlineIconSVG() {
    return `<svg width="32" height="32" xmlns="http://www.w3.org/2000/svg">
        <!-- Microphone body -->
        <rect x="12" y="8" width="8" height="12" rx="4" fill="white"/>
        <!-- Microphone stand -->
        <line x1="16" y1="20" x2="16" y2="26" stroke="white" stroke-width="2"/>
        <!-- Base -->
        <line x1="12" y1="26" x2="20" y2="26" stroke="white" stroke-width="2"/>
        <!-- Sound waves -->
        <path d="M 22 12 Q 26 16 22 20" fill="none" stroke="white" stroke-width="1.5" opacity="0.8"/>
        <path d="M 24 10 Q 29 16 24 22" fill="none" stroke="white" stroke-width="1.5" opacity="0.6"/>
    </svg>`;
}

// Create assets directory if it doesn't exist
const assetsDir = path.join(__dirname, '..', 'assets');
if (!fs.existsSync(assetsDir)) {
    fs.mkdirSync(assetsDir, { recursive: true });
}

// Write SVG files (Teams can use SVG icons in development)
fs.writeFileSync(path.join(assetsDir, 'icon-color.svg'), createColorIconSVG());
fs.writeFileSync(path.join(assetsDir, 'icon-outline.svg'), createOutlineIconSVG());

console.log('✅ Placeholder icons created in assets/ directory');
console.log('📝 Note: For production, convert SVG to PNG using online tools or design software');
console.log('   - icon-color.png should be 192x192 pixels');
console.log('   - icon-outline.png should be 32x32 pixels');
console.log('🌐 Open scripts/create-placeholder-icons.html in browser to generate PNG files');