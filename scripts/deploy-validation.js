#!/usr/bin/env node

/**
 * Deployment Validation Script
 * Validates deployment packages for all platforms before submission
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

class DeploymentValidator {
  constructor() {
    this.rootDir = path.resolve(__dirname, '..');
    this.buildDir = path.join(this.rootDir, 'dist');
    this.validationResults = {
      teams: { passed: 0, failed: 0, errors: [] },
      zoom: { passed: 0, failed: 0, errors: [] },
      'browser-extension': { passed: 0, failed: 0, errors: [] }
    };
  }

  async validateAll() {
    console.log('🔍 Starting deployment validation...');
    
    try {
      // Validate each platform
      await this.validateTeamsPackage();
      await this.validateZoomPackage();
      await this.validateBrowserExtension();
      
      // Generate validation report
      this.generateValidationReport();
      
      // Check if all validations passed
      const hasErrors = Object.values(this.validationResults)
        .some(result => result.failed > 0);
      
      if (hasErrors) {
        console.log('\n❌ Deployment validation failed. Please fix the issues above.');
        process.exit(1);
      } else {
        console.log('\n✅ All deployment validations passed!');
      }
      
    } catch (error) {
      console.error('❌ Validation failed:', error.message);
      process.exit(1);
    }
  }

  async validateTeamsPackage() {
    console.log('\n📱 Validating Teams package...');
    const platform = 'teams';
    const packageDir = path.join(this.buildDir, platform);
    
    // Check if package exists
    this.validateFileExists(packageDir, 'Package directory', platform);
    
    // Validate manifest.json
    const manifestPath = path.join(packageDir, 'manifest.json');
    this.validateFileExists(manifestPath, 'manifest.json', platform);
    
    if (fs.existsSync(manifestPath)) {
      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
      this.validateTeamsManifest(manifest, platform);
    }
    
    // Validate required files
    const requiredFiles = [
      'icon-color.png',
      'icon-outline.png'
    ];
    
    for (const file of requiredFiles) {
      this.validateFileExists(path.join(packageDir, file), file, platform);
    }
    
    // Validate build directory
    const buildPath = path.join(packageDir, 'build');
    this.validateFileExists(buildPath, 'build directory', platform);
    
    // Validate package size (Teams has 4MB limit)
    this.validatePackageSize(packageDir, 4 * 1024 * 1024, platform);
    
    console.log(`  ✅ Teams validation completed: ${this.validationResults[platform].passed} passed, ${this.validationResults[platform].failed} failed`);
  }

  async validateZoomPackage() {
    console.log('\n🎥 Validating Zoom package...');
    const platform = 'zoom';
    const packageDir = path.join(this.buildDir, platform);
    
    // Check if package exists
    this.validateFileExists(packageDir, 'Package directory', platform);
    
    // Validate manifest.json
    const manifestPath = path.join(packageDir, 'manifest.json');
    this.validateFileExists(manifestPath, 'manifest.json', platform);
    
    if (fs.existsSync(manifestPath)) {
      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
      this.validateZoomManifest(manifest, platform);
    }
    
    // Validate build directory
    const buildPath = path.join(packageDir, 'build');
    this.validateFileExists(buildPath, 'build directory', platform);
    
    // Validate server directory (for webhooks)
    const serverPath = path.join(packageDir, 'server');
    this.validateFileExists(serverPath, 'server directory', platform);
    
    // Validate package size (Zoom has 10MB limit)
    this.validatePackageSize(packageDir, 10 * 1024 * 1024, platform);
    
    console.log(`  ✅ Zoom validation completed: ${this.validationResults[platform].passed} passed, ${this.validationResults[platform].failed} failed`);
  }

  async validateBrowserExtension() {
    console.log('\n🌐 Validating browser extension...');
    const platform = 'browser-extension';
    const packageDir = path.join(this.buildDir, platform);
    
    // Check if package exists
    this.validateFileExists(packageDir, 'Package directory', platform);
    
    // Validate manifest.json
    const manifestPath = path.join(packageDir, 'manifest.json');
    this.validateFileExists(manifestPath, 'manifest.json', platform);
    
    if (fs.existsSync(manifestPath)) {
      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
      this.validateExtensionManifest(manifest, platform);
    }
    
    // Validate required directories
    const requiredDirs = [
      'background',
      'content-scripts',
      'popup',
      'options',
      'icons'
    ];
    
    for (const dir of requiredDirs) {
      this.validateFileExists(path.join(packageDir, dir), `${dir} directory`, platform);
    }
    
    // Validate package size (Chrome Web Store has 128MB limit)
    this.validatePackageSize(packageDir, 128 * 1024 * 1024, platform);
    
    console.log(`  ✅ Extension validation completed: ${this.validationResults[platform].passed} passed, ${this.validationResults[platform].failed} failed`);
  }

  validateFileExists(filePath, description, platform) {
    if (fs.existsSync(filePath)) {
      this.validationResults[platform].passed++;
      console.log(`    ✅ ${description} exists`);
    } else {
      this.validationResults[platform].failed++;
      this.validationResults[platform].errors.push(`Missing ${description}: ${filePath}`);
      console.log(`    ❌ ${description} missing: ${filePath}`);
    }
  }

  validateTeamsManifest(manifest, platform) {
    const requiredFields = [
      'id', 'version', 'packageName', 'developer',
      'name', 'description', 'icons', 'accentColor'
    ];
    
    for (const field of requiredFields) {
      if (manifest[field]) {
        this.validationResults[platform].passed++;
        console.log(`    ✅ Manifest field '${field}' present`);
      } else {
        this.validationResults[platform].failed++;
        this.validationResults[platform].errors.push(`Missing manifest field: ${field}`);
        console.log(`    ❌ Manifest field '${field}' missing`);
      }
    }
    
    // Validate version format
    if (manifest.version && /^\d+\.\d+\.\d+$/.test(manifest.version)) {
      this.validationResults[platform].passed++;
      console.log(`    ✅ Version format valid: ${manifest.version}`);
    } else {
      this.validationResults[platform].failed++;
      this.validationResults[platform].errors.push(`Invalid version format: ${manifest.version}`);
      console.log(`    ❌ Invalid version format: ${manifest.version}`);
    }
  }

  validateZoomManifest(manifest, platform) {
    const requiredFields = [
      'name', 'version', 'description', 'author',
      'home_url', 'redirect_uri_domains'
    ];
    
    for (const field of requiredFields) {
      if (manifest[field]) {
        this.validationResults[platform].passed++;
        console.log(`    ✅ Manifest field '${field}' present`);
      } else {
        this.validationResults[platform].failed++;
        this.validationResults[platform].errors.push(`Missing manifest field: ${field}`);
        console.log(`    ❌ Manifest field '${field}' missing`);
      }
    }
  }

  validateExtensionManifest(manifest, platform) {
    const requiredFields = [
      'manifest_version', 'name', 'version', 'description',
      'permissions', 'background', 'content_scripts'
    ];
    
    for (const field of requiredFields) {
      if (manifest[field]) {
        this.validationResults[platform].passed++;
        console.log(`    ✅ Manifest field '${field}' present`);
      } else {
        this.validationResults[platform].failed++;
        this.validationResults[platform].errors.push(`Missing manifest field: ${field}`);
        console.log(`    ❌ Manifest field '${field}' missing`);
      }
    }
    
    // Validate manifest version
    if (manifest.manifest_version === 3) {
      this.validationResults[platform].passed++;
      console.log(`    ✅ Using Manifest V3`);
    } else {
      this.validationResults[platform].failed++;
      this.validationResults[platform].errors.push(`Should use Manifest V3, found: ${manifest.manifest_version}`);
      console.log(`    ❌ Should use Manifest V3, found: ${manifest.manifest_version}`);
    }
  }

  validatePackageSize(packageDir, maxSize, platform) {
    const size = this.getDirectorySize(packageDir);
    const sizeMB = (size / (1024 * 1024)).toFixed(2);
    const maxSizeMB = (maxSize / (1024 * 1024)).toFixed(2);
    
    if (size <= maxSize) {
      this.validationResults[platform].passed++;
      console.log(`    ✅ Package size OK: ${sizeMB}MB (limit: ${maxSizeMB}MB)`);
    } else {
      this.validationResults[platform].failed++;
      this.validationResults[platform].errors.push(`Package too large: ${sizeMB}MB (limit: ${maxSizeMB}MB)`);
      console.log(`    ❌ Package too large: ${sizeMB}MB (limit: ${maxSizeMB}MB)`);
    }
  }

  getDirectorySize(dirPath) {
    let totalSize = 0;
    
    const files = fs.readdirSync(dirPath, { withFileTypes: true });
    
    for (const file of files) {
      const filePath = path.join(dirPath, file.name);
      
      if (file.isDirectory()) {
        totalSize += this.getDirectorySize(filePath);
      } else {
        totalSize += fs.statSync(filePath).size;
      }
    }
    
    return totalSize;
  }

  generateValidationReport() {
    console.log('\n📊 Validation Summary:');
    console.log('========================');
    
    let totalPassed = 0;
    let totalFailed = 0;
    
    for (const [platform, results] of Object.entries(this.validationResults)) {
      console.log(`\n${platform.toUpperCase()}:`);
      console.log(`  ✅ Passed: ${results.passed}`);
      console.log(`  ❌ Failed: ${results.failed}`);
      
      if (results.errors.length > 0) {
        console.log(`  Errors:`);
        for (const error of results.errors) {
          console.log(`    - ${error}`);
        }
      }
      
      totalPassed += results.passed;
      totalFailed += results.failed;
    }
    
    console.log(`\nOVERALL:`);
    console.log(`  ✅ Total Passed: ${totalPassed}`);
    console.log(`  ❌ Total Failed: ${totalFailed}`);
    
    // Save report to file
    const reportPath = path.join(this.buildDir, 'validation-report.json');
    fs.writeFileSync(reportPath, JSON.stringify({
      timestamp: new Date().toISOString(),
      summary: { totalPassed, totalFailed },
      platforms: this.validationResults
    }, null, 2));
    
    console.log(`\n📄 Detailed report saved to: ${reportPath}`);
  }
}

// CLI interface
if (require.main === module) {
  const validator = new DeploymentValidator();
  validator.validateAll();
}

module.exports = DeploymentValidator;