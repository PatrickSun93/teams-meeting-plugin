#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const PACKAGE_DIR = 'teams-app-package';
const OUTPUT_ZIP = 'teams-transcription-app.zip';

console.log('🚀 Building Teams Meeting Transcription App Package...\n');

// Step 1: Clean previous builds
console.log('1️⃣ Cleaning previous builds...');
if (fs.existsSync(PACKAGE_DIR)) {
    fs.rmSync(PACKAGE_DIR, { recursive: true, force: true });
}
if (fs.existsSync(OUTPUT_ZIP)) {
    fs.unlinkSync(OUTPUT_ZIP);
}

// Step 2: Create package directory
console.log('2️⃣ Creating package directory...');
fs.mkdirSync(PACKAGE_DIR, { recursive: true });

// Step 3: Validate manifest.json
console.log('3️⃣ Validating manifest.json...');
try {
    const manifest = JSON.parse(fs.readFileSync('manifest.json', 'utf8'));
    
    // Basic validation
    const requiredFields = ['id', 'version', 'name', 'description', 'developer', 'icons'];
    const missingFields = requiredFields.filter(field => !manifest[field]);
    
    if (missingFields.length > 0) {
        throw new Error(`Missing required fields: ${missingFields.join(', ')}`);
    }
    
    console.log(`   ✅ Manifest version: ${manifest.version}`);
    console.log(`   ✅ App ID: ${manifest.id}`);
    console.log(`   ✅ App name: ${manifest.name.short}`);
    
} catch (error) {
    console.error('❌ Manifest validation failed:', error.message);
    process.exit(1);
}

// Step 4: Copy manifest
console.log('4️⃣ Copying manifest.json...');
fs.copyFileSync('manifest.json', path.join(PACKAGE_DIR, 'manifest.json'));

// Step 5: Handle icons
console.log('5️⃣ Processing app icons...');
const iconFiles = ['icon-color.png', 'icon-outline.png'];
let iconWarnings = [];

for (const iconFile of iconFiles) {
    const iconPath = path.join('assets', iconFile);
    const svgPath = path.join('assets', iconFile.replace('.png', '.svg'));
    
    if (fs.existsSync(iconPath)) {
        fs.copyFileSync(iconPath, path.join(PACKAGE_DIR, iconFile));
        console.log(`   ✅ Copied ${iconFile}`);
    } else if (fs.existsSync(svgPath)) {
        // Copy SVG as fallback (Teams supports SVG in development)
        fs.copyFileSync(svgPath, path.join(PACKAGE_DIR, iconFile.replace('.png', '.svg')));
        iconWarnings.push(`Using SVG fallback for ${iconFile}`);
    } else {
        iconWarnings.push(`Missing ${iconFile} - create using scripts/create-placeholder-icons.html`);
    }
}

// Step 6: Copy additional assets if they exist
console.log('6️⃣ Copying additional assets...');
const additionalAssets = ['scenes', 'localization'];
for (const asset of additionalAssets) {
    const assetPath = path.join('assets', asset);
    if (fs.existsSync(assetPath)) {
        const destPath = path.join(PACKAGE_DIR, asset);
        fs.cpSync(assetPath, destPath, { recursive: true });
        console.log(`   ✅ Copied ${asset}/`);
    }
}

// Step 7: Create app package zip
console.log('7️⃣ Creating app package...');
try {
    process.chdir(PACKAGE_DIR);
    execSync(`zip -r ../${OUTPUT_ZIP} .`, { stdio: 'pipe' });
    process.chdir('..');
    
    const stats = fs.statSync(OUTPUT_ZIP);
    console.log(`   ✅ Package created: ${OUTPUT_ZIP} (${Math.round(stats.size / 1024)}KB)`);
    
} catch (error) {
    console.error('❌ Failed to create zip package:', error.message);
    process.exit(1);
}

// Step 8: Validate package size
const packageSize = fs.statSync(OUTPUT_ZIP).size;
const maxSize = 4 * 1024 * 1024; // 4MB limit for Teams apps

if (packageSize > maxSize) {
    console.warn(`⚠️  Package size (${Math.round(packageSize / 1024 / 1024)}MB) exceeds Teams limit (4MB)`);
} else {
    console.log(`   ✅ Package size OK: ${Math.round(packageSize / 1024)}KB`);
}

// Step 9: Display summary
console.log('\n📦 Package Summary:');
console.log(`   📁 Package directory: ${PACKAGE_DIR}/`);
console.log(`   📦 App package: ${OUTPUT_ZIP}`);
console.log(`   📏 Package size: ${Math.round(packageSize / 1024)}KB`);

if (iconWarnings.length > 0) {
    console.log('\n⚠️  Icon Warnings:');
    iconWarnings.forEach(warning => console.log(`   - ${warning}`));
}

console.log('\n🎉 Teams app package ready for sideloading!');
console.log('\n📋 Next Steps:');
console.log('   1. Open Microsoft Teams');
console.log('   2. Go to Apps > Manage your apps');
console.log('   3. Click "Upload a custom app"');
console.log(`   4. Select ${OUTPUT_ZIP}`);
console.log('   5. Follow the installation prompts');
console.log('\n📖 For detailed instructions, see docs/SIDELOADING_GUIDE.md');