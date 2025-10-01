#!/usr/bin/env node

/**
 * Multi-Platform Build Script
 * Builds and packages the application for Teams, Zoom, and Browser Extension platforms
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const archiver = require('archiver');

class MultiPlatformBuilder {
  constructor() {
    this.rootDir = path.resolve(__dirname, '..');
    this.buildDir = path.join(this.rootDir, 'dist');
    this.platforms = ['teams', 'zoom', 'browser-extension'];
  }

  async buildAll() {
    console.log('🚀 Starting multi-platform build process...');
    
    try {
      // Clean previous builds
      await this.cleanBuildDirectory();
      
      // Build each platform
      for (const platform of this.platforms) {
        console.log(`\n📦 Building ${platform}...`);
        await this.buildPlatform(platform);
      }
      
      // Create deployment packages
      await this.createDeploymentPackages();
      
      console.log('\n✅ Multi-platform build completed successfully!');
      console.log(`📁 Build artifacts available in: ${this.buildDir}`);
      
    } catch (error) {
      console.error('❌ Build failed:', error.message);
      process.exit(1);
    }
  }

  async cleanBuildDirectory() {
    console.log('🧹 Cleaning build directory...');
    if (fs.existsSync(this.buildDir)) {
      fs.rmSync(this.buildDir, { recursive: true, force: true });
    }
    fs.mkdirSync(this.buildDir, { recursive: true });
  }

  async buildPlatform(platform) {
    const platformDir = path.join(this.buildDir, platform);
    fs.mkdirSync(platformDir, { recursive: true });

    switch (platform) {
      case 'teams':
        await this.buildTeamsApp(platformDir);
        break;
      case 'zoom':
        await this.buildZoomApp(platformDir);
        break;
      case 'browser-extension':
        await this.buildBrowserExtension(platformDir);
        break;
      default:
        throw new Error(`Unknown platform: ${platform}`);
    }
  }

  async buildTeamsApp(outputDir) {
    console.log('  📱 Building Teams app...');
    
    // Build React app for Teams
    execSync('npm run build', { 
      cwd: this.rootDir,
      stdio: 'inherit',
      env: { ...process.env, REACT_APP_PLATFORM: 'teams' }
    });
    
    // Copy Teams-specific files
    const teamsFiles = [
      'teams-app-package/manifest.json',
      'teams-app-package/icon-color.png',
      'teams-app-package/icon-outline.png'
    ];
    
    for (const file of teamsFiles) {
      const srcPath = path.join(this.rootDir, file);
      const destPath = path.join(outputDir, path.basename(file));
      if (fs.existsSync(srcPath)) {
        fs.copyFileSync(srcPath, destPath);
      }
    }
    
    // Copy built React app
    const buildPath = path.join(this.rootDir, 'build');
    if (fs.existsSync(buildPath)) {
      this.copyDirectory(buildPath, path.join(outputDir, 'build'));
    }
    
    // Update manifest with build info
    await this.updateTeamsManifest(outputDir);
    
    console.log('  ✅ Teams app build completed');
  }

  async buildZoomApp(outputDir) {
    console.log('  🎥 Building Zoom app...');
    
    // Build React app for Zoom
    execSync('npm run build', { 
      cwd: this.rootDir,
      stdio: 'inherit',
      env: { ...process.env, REACT_APP_PLATFORM: 'zoom' }
    });
    
    // Copy Zoom-specific files
    const zoomFiles = [
      'zoom-app-package/manifest.json'
    ];
    
    for (const file of zoomFiles) {
      const srcPath = path.join(this.rootDir, file);
      const destPath = path.join(outputDir, path.basename(file));
      if (fs.existsSync(srcPath)) {
        fs.copyFileSync(srcPath, destPath);
      }
    }
    
    // Copy built React app
    const buildPath = path.join(this.rootDir, 'build');
    if (fs.existsSync(buildPath)) {
      this.copyDirectory(buildPath, path.join(outputDir, 'build'));
    }
    
    // Copy server files for webhooks
    const serverPath = path.join(this.rootDir, 'src/server');
    if (fs.existsSync(serverPath)) {
      this.copyDirectory(serverPath, path.join(outputDir, 'server'));
    }
    
    // Update manifest with build info
    await this.updateZoomManifest(outputDir);
    
    console.log('  ✅ Zoom app build completed');
  }

  async buildBrowserExtension(outputDir) {
    console.log('  🌐 Building browser extension...');
    
    // Build extension using webpack
    execSync('npm run build:extension', { 
      cwd: this.rootDir,
      stdio: 'inherit'
    });
    
    // Copy extension files
    const extensionPath = path.join(this.rootDir, 'browser-extension');
    if (fs.existsSync(extensionPath)) {
      this.copyDirectory(extensionPath, outputDir);
    }
    
    // Update manifest with build info
    await this.updateExtensionManifest(outputDir);
    
    console.log('  ✅ Browser extension build completed');
  }

  async createDeploymentPackages() {
    console.log('\n📦 Creating deployment packages...');
    
    for (const platform of this.platforms) {
      const platformDir = path.join(this.buildDir, platform);
      const packagePath = path.join(this.buildDir, `${platform}-package.zip`);
      
      await this.createZipPackage(platformDir, packagePath);
      console.log(`  ✅ Created ${platform} package: ${packagePath}`);
    }
  }

  async createZipPackage(sourceDir, outputPath) {
    return new Promise((resolve, reject) => {
      const output = fs.createWriteStream(outputPath);
      const archive = archiver('zip', { zlib: { level: 9 } });
      
      output.on('close', resolve);
      archive.on('error', reject);
      
      archive.pipe(output);
      archive.directory(sourceDir, false);
      archive.finalize();
    });
  }

  copyDirectory(src, dest) {
    if (!fs.existsSync(dest)) {
      fs.mkdirSync(dest, { recursive: true });
    }
    
    const entries = fs.readdirSync(src, { withFileTypes: true });
    
    for (const entry of entries) {
      const srcPath = path.join(src, entry.name);
      const destPath = path.join(dest, entry.name);
      
      if (entry.isDirectory()) {
        this.copyDirectory(srcPath, destPath);
      } else {
        fs.copyFileSync(srcPath, destPath);
      }
    }
  }

  async updateTeamsManifest(outputDir) {
    const manifestPath = path.join(outputDir, 'manifest.json');
    if (!fs.existsSync(manifestPath)) return;
    
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    const packageInfo = JSON.parse(fs.readFileSync(path.join(this.rootDir, 'package.json'), 'utf8'));
    
    // Update version and build info
    manifest.version = packageInfo.version;
    manifest.buildDate = new Date().toISOString();
    manifest.buildPlatform = 'teams';
    
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  }

  async updateZoomManifest(outputDir) {
    const manifestPath = path.join(outputDir, 'manifest.json');
    if (!fs.existsSync(manifestPath)) return;
    
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    const packageInfo = JSON.parse(fs.readFileSync(path.join(this.rootDir, 'package.json'), 'utf8'));
    
    // Update version and build info
    manifest.version = packageInfo.version;
    manifest.buildDate = new Date().toISOString();
    manifest.buildPlatform = 'zoom';
    
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  }

  async updateExtensionManifest(outputDir) {
    const manifestPath = path.join(outputDir, 'manifest.json');
    if (!fs.existsSync(manifestPath)) return;
    
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    const packageInfo = JSON.parse(fs.readFileSync(path.join(this.rootDir, 'package.json'), 'utf8'));
    
    // Update version and build info
    manifest.version = packageInfo.version;
    manifest.buildDate = new Date().toISOString();
    manifest.buildPlatform = 'browser-extension';
    
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  }
}

// CLI interface
if (require.main === module) {
  const builder = new MultiPlatformBuilder();
  
  const command = process.argv[2];
  
  switch (command) {
    case 'all':
    case undefined:
      builder.buildAll();
      break;
    case 'teams':
      builder.buildPlatform('teams').then(() => console.log('✅ Teams build completed'));
      break;
    case 'zoom':
      builder.buildPlatform('zoom').then(() => console.log('✅ Zoom build completed'));
      break;
    case 'extension':
      builder.buildPlatform('browser-extension').then(() => console.log('✅ Extension build completed'));
      break;
    default:
      console.log('Usage: node build-platforms.js [all|teams|zoom|extension]');
      process.exit(1);
  }
}

module.exports = MultiPlatformBuilder;