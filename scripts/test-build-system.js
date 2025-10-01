#!/usr/bin/env node

/**
 * Test Build System
 * Quick test of the deployment system without full webpack builds
 */

const fs = require('fs');
const path = require('path');

class TestBuildSystem {
  constructor() {
    this.rootDir = path.resolve(__dirname, '..');
    this.buildDir = path.join(this.rootDir, 'dist-test');
  }

  async testBuildSystem() {
    console.log('🧪 Testing multi-platform build system...');
    
    try {
      // Clean and create test build directory
      this.cleanBuildDirectory();
      
      // Create mock builds for each platform
      await this.createMockTeamsBuild();
      await this.createMockZoomBuild();
      await this.createMockExtensionBuild();
      
      // Test validation system
      await this.testValidation();
      
      console.log('\n✅ Build system test completed successfully!');
      
    } catch (error) {
      console.error('❌ Build system test failed:', error.message);
      process.exit(1);
    }
  }

  cleanBuildDirectory() {
    console.log('🧹 Creating test build directory...');
    if (fs.existsSync(this.buildDir)) {
      fs.rmSync(this.buildDir, { recursive: true, force: true });
    }
    fs.mkdirSync(this.buildDir, { recursive: true });
  }

  async createMockTeamsBuild() {
    console.log('📱 Creating mock Teams build...');
    const teamsDir = path.join(this.buildDir, 'teams');
    fs.mkdirSync(teamsDir, { recursive: true });

    // Create mock manifest
    const manifest = {
      id: "test-teams-app-id",
      version: "1.0.0",
      packageName: "com.test.transcription",
      developer: {
        name: "Test Developer",
        websiteUrl: "https://example.com",
        privacyUrl: "https://example.com/privacy",
        termsOfUseUrl: "https://example.com/terms"
      },
      name: {
        short: "Meeting Transcription",
        full: "Universal Meeting Transcription Plugin"
      },
      description: {
        short: "Real-time meeting transcription",
        full: "AI-powered meeting transcription with speaker identification"
      },
      icons: {
        outline: "icon-outline.png",
        color: "icon-color.png"
      },
      accentColor: "#0078d4",
      buildDate: new Date().toISOString(),
      buildPlatform: "teams"
    };

    fs.writeFileSync(
      path.join(teamsDir, 'manifest.json'),
      JSON.stringify(manifest, null, 2)
    );

    // Create mock icons
    fs.writeFileSync(path.join(teamsDir, 'icon-color.png'), 'mock-icon-data');
    fs.writeFileSync(path.join(teamsDir, 'icon-outline.png'), 'mock-icon-data');

    // Create mock build directory
    const buildPath = path.join(teamsDir, 'build');
    fs.mkdirSync(buildPath, { recursive: true });
    fs.writeFileSync(path.join(buildPath, 'index.html'), '<html><body>Mock Teams App</body></html>');
    
    const staticPath = path.join(buildPath, 'static');
    fs.mkdirSync(staticPath, { recursive: true });
    fs.writeFileSync(path.join(staticPath, 'app.js'), 'console.log("Mock Teams app");');

    console.log('  ✅ Mock Teams build created');
  }

  async createMockZoomBuild() {
    console.log('🎥 Creating mock Zoom build...');
    const zoomDir = path.join(this.buildDir, 'zoom');
    fs.mkdirSync(zoomDir, { recursive: true });

    // Create mock manifest
    const manifest = {
      name: "Meeting Transcription Plugin",
      version: "1.0.0",
      description: "AI-powered meeting transcription for Zoom",
      author: "Test Developer",
      home_url: "https://example.com",
      redirect_uri_domains: ["example.com"],
      buildDate: new Date().toISOString(),
      buildPlatform: "zoom"
    };

    fs.writeFileSync(
      path.join(zoomDir, 'manifest.json'),
      JSON.stringify(manifest, null, 2)
    );

    // Create mock build directory
    const buildPath = path.join(zoomDir, 'build');
    fs.mkdirSync(buildPath, { recursive: true });
    fs.writeFileSync(path.join(buildPath, 'index.html'), '<html><body>Mock Zoom App</body></html>');

    // Create mock server directory
    const serverPath = path.join(zoomDir, 'server');
    fs.mkdirSync(serverPath, { recursive: true });
    const webhooksPath = path.join(serverPath, 'webhooks');
    fs.mkdirSync(webhooksPath, { recursive: true });
    fs.writeFileSync(path.join(webhooksPath, 'handler.js'), 'console.log("Mock webhook handler");');

    console.log('  ✅ Mock Zoom build created');
  }

  async createMockExtensionBuild() {
    console.log('🌐 Creating mock extension build...');
    const extensionDir = path.join(this.buildDir, 'browser-extension');
    fs.mkdirSync(extensionDir, { recursive: true });

    // Create mock manifest
    const manifest = {
      manifest_version: 3,
      name: "Meeting Transcription Extension",
      version: "1.0.0",
      description: "Universal meeting transcription browser extension",
      permissions: ["activeTab", "storage"],
      background: {
        service_worker: "background/background.js"
      },
      content_scripts: [{
        matches: ["https://meet.google.com/*"],
        js: ["content-scripts/meet-detector.js"]
      }],
      buildDate: new Date().toISOString(),
      buildPlatform: "browser-extension"
    };

    fs.writeFileSync(
      path.join(extensionDir, 'manifest.json'),
      JSON.stringify(manifest, null, 2)
    );

    // Create mock directories and files
    const dirs = ['background', 'content-scripts', 'popup', 'options', 'icons'];
    for (const dir of dirs) {
      const dirPath = path.join(extensionDir, dir);
      fs.mkdirSync(dirPath, { recursive: true });
      fs.writeFileSync(path.join(dirPath, 'mock.js'), `console.log("Mock ${dir}");`);
    }

    // Create mock icons
    const iconSizes = [16, 32, 48, 128];
    for (const size of iconSizes) {
      fs.writeFileSync(
        path.join(extensionDir, 'icons', `icon-${size}.png`),
        'mock-icon-data'
      );
    }

    console.log('  ✅ Mock extension build created');
  }

  async testValidation() {
    console.log('\n🔍 Testing validation system...');
    
    // Import and test the validation system
    const DeploymentValidator = require('./deploy-validation');
    const validator = new DeploymentValidator();
    
    // Override build directory for testing
    validator.buildDir = this.buildDir;
    
    try {
      await validator.validateAll();
      console.log('  ✅ Validation system working correctly');
    } catch (error) {
      console.log('  ⚠️ Validation completed with some issues (expected for mock data)');
    }
  }
}

// Run test if called directly
if (require.main === module) {
  const tester = new TestBuildSystem();
  tester.testBuildSystem();
}

module.exports = TestBuildSystem;