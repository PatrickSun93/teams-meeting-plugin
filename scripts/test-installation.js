#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Test counters
let testsPasssed = 0;
let testsFailed = 0;
let warnings = 0;

// Helper functions
function passTest(message) {
    console.log(`✅ ${message}`);
    testsPasssed++;
}

function failTest(message) {
    console.log(`❌ ${message}`);
    testsFailed++;
}

function warnTest(message) {
    console.log(`⚠️  ${message}`);
    warnings++;
}

function infoTest(message) {
    console.log(`ℹ️  ${message}`);
}

console.log('🧪 Teams Meeting Transcription App - Installation Testing');
console.log('========================================================\n');

// Test 1: Check if package exists
console.log('1️⃣ Testing Package Existence');
const packagePath = 'teams-transcription-app.zip';
if (fs.existsSync(packagePath)) {
    passTest('App package found: teams-transcription-app.zip');
} else {
    failTest('App package not found. Run "npm run package:teams" first');
    process.exit(1);
}

// Test 2: Validate package structure
console.log('\n2️⃣ Testing Package Structure');
try {
    execSync(`unzip -t ${packagePath}`, { stdio: 'pipe' });
    passTest('Package is a valid ZIP file');
} catch (error) {
    failTest('Package is corrupted or invalid');
    process.exit(1);
}

// Get package contents
let packageContents;
try {
    packageContents = execSync(`unzip -l ${packagePath}`, { encoding: 'utf8' });
    passTest('Package contents readable');
} catch (error) {
    failTest('Cannot read package contents');
    process.exit(1);
}

// Check required files
const requiredFiles = ['manifest.json'];
for (const file of requiredFiles) {
    if (packageContents.includes(file)) {
        passTest(`Required file found: ${file}`);
    } else {
        failTest(`Missing required file: ${file}`);
    }
}

// Check for icons
if (packageContents.includes('icon-color.png')) {
    passTest('Color icon found: icon-color.png');
} else if (packageContents.includes('icon-color.svg')) {
    warnTest('Using SVG fallback for color icon (PNG recommended for production)');
} else {
    failTest('Missing color icon (icon-color.png or icon-color.svg)');
}

if (packageContents.includes('icon-outline.png')) {
    passTest('Outline icon found: icon-outline.png');
} else if (packageContents.includes('icon-outline.svg')) {
    warnTest('Using SVG fallback for outline icon (PNG recommended for production)');
} else {
    failTest('Missing outline icon (icon-outline.png or icon-outline.svg)');
}

// Test 3: Validate manifest.json
console.log('\n3️⃣ Testing Manifest Validation');

let manifestContent;
try {
    manifestContent = execSync(`unzip -p ${packagePath} manifest.json`, { encoding: 'utf8' });
    const manifest = JSON.parse(manifestContent);
    passTest('Manifest is valid JSON');
    
    // Check required fields
    const requiredFields = ['id', 'version', 'name', 'description', 'developer', 'icons'];
    for (const field of requiredFields) {
        if (manifest[field]) {
            passTest(`Manifest field present: ${field}`);
        } else {
            failTest(`Missing required manifest field: ${field}`);
        }
    }
    
    // Check version format
    const version = manifest.version;
    if (/^\d+\.\d+\.\d+$/.test(version)) {
        passTest(`Version format is valid: ${version}`);
    } else {
        warnTest(`Version format should be semantic (x.y.z): ${version}`);
    }
    
    // Check app ID
    const appId = manifest.id;
    if (appId && appId.length > 4 && appId.length < 64) {
        passTest(`App ID length is valid: ${appId}`);
    } else {
        warnTest(`App ID should be 4-64 characters: ${appId}`);
    }
    
    // Check for placeholder values
    if (manifestContent.includes('your-app-id-here')) {
        warnTest('Placeholder app ID detected - update webApplicationInfo.id');
    }
    
    if (manifestContent.includes('yourcompany.com')) {
        warnTest('Placeholder URLs detected - update developer URLs');
    }
    
    if (manifestContent.includes('Your Company Name')) {
        warnTest('Placeholder developer name detected - update developer.name');
    }
    
    // Check permissions
    console.log('\n4️⃣ Testing Permissions');
    const permissions = manifest.permissions || [];
    const devicePermissions = manifest.devicePermissions || [];
    
    if (permissions.includes('identity')) {
        passTest('Identity permission configured');
    } else {
        warnTest('Identity permission not found (may be needed for user info)');
    }
    
    if (permissions.includes('messageTeamMembers')) {
        passTest('Message team members permission configured');
    } else {
        warnTest('Message team members permission not found (needed for chat integration)');
    }
    
    if (devicePermissions.includes('media')) {
        passTest('Media device permission configured');
    } else {
        failTest('Media device permission required for audio capture');
    }
    
    // Check valid domains
    console.log('\n5️⃣ Testing Valid Domains');
    const validDomains = manifest.validDomains || [];
    
    if (validDomains.length > 0) {
        passTest('Valid domains configured');
        validDomains.forEach(domain => {
            if (domain.startsWith('localhost:')) {
                warnTest(`Development domain detected: ${domain} (update for production)`);
            } else {
                infoTest(`Production domain: ${domain}`);
            }
        });
    } else {
        warnTest('No valid domains specified');
    }
    
} catch (error) {
    failTest('Manifest contains invalid JSON or cannot be read');
}

// Test 4: Check package size
console.log('\n6️⃣ Testing Package Size');
const stats = fs.statSync(packagePath);
const packageSize = stats.size;
const maxSize = 4 * 1024 * 1024; // 4MB

if (packageSize < maxSize) {
    const sizeMB = (packageSize / 1024 / 1024).toFixed(2);
    passTest(`Package size OK: ${sizeMB}MB (limit: 4MB)`);
} else {
    const sizeMB = (packageSize / 1024 / 1024).toFixed(2);
    failTest(`Package too large: ${sizeMB}MB (limit: 4MB)`);
}

// Test 5: Development environment
console.log('\n7️⃣ Testing Development Environment');

if (fs.existsSync('node_modules')) {
    passTest('Node.js dependencies installed');
} else {
    warnTest('Node.js dependencies not found. Run "npm install"');
}

if (fs.existsSync('src/client/build') || fs.existsSync('build') || fs.existsSync('dist')) {
    passTest('Build artifacts found');
} else {
    warnTest('No build artifacts found. Run "npm run build"');
}

if (fs.existsSync('package.json')) {
    const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
    if (packageJson.scripts && packageJson.scripts['package:teams']) {
        passTest('Teams packaging script configured');
    } else {
        warnTest('Teams packaging script not found in package.json');
    }
}

// Summary
console.log('\n📊 Test Summary');
console.log('===============');
console.log(`Tests Passed: ${testsPasssed}`);
console.log(`Tests Failed: ${testsFailed}`);
console.log(`Warnings: ${warnings}`);

// Overall result
if (testsFailed === 0) {
    if (warnings === 0) {
        console.log('\n🎉 All tests passed! Package is ready for deployment.');
    } else {
        console.log('\n⚠️  Tests passed with warnings. Review warnings before production deployment.');
    }
} else {
    console.log('\n❌ Some tests failed. Fix issues before deployment.');
}

// Recommendations
console.log('\n📋 Recommendations');
console.log('===================');

if (warnings > 0 || testsFailed > 0) {
    console.log('Before production deployment:');
    console.log('1. Fix all failed tests');
    console.log('2. Address security warnings (placeholder values)');
    console.log('3. Create proper PNG icons (192x192 and 32x32)');
    console.log('4. Update URLs to production domains');
    console.log('5. Test sideloading in Teams');
}

console.log('\nNext steps:');
console.log('1. Test sideloading: Upload teams-transcription-app.zip to Teams');
console.log('2. Verify app functionality in a test meeting');
console.log('3. Review docs/DEPLOYMENT_GUIDE.md for deployment options');
console.log('4. Check docs/APP_STORE_SUBMISSION.md for store submission');

process.exit(testsFailed > 0 ? 1 : 0);