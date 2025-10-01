/**
 * Deployment Validation Tests
 * Tests to ensure all platform packages are correctly built and ready for deployment
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const DeploymentValidator = require('../../scripts/deploy-validation');

describe('Deployment Validation Tests', () => {
  let validator;
  const buildDir = path.join(__dirname, '../../dist');
  const testBuildDir = path.join(__dirname, 'test-builds');

  beforeAll(async () => {
    validator = new DeploymentValidator();
    
    // Create test build directory
    if (!fs.existsSync(testBuildDir)) {
      fs.mkdirSync(testBuildDir, { recursive: true });
    }
  });

  afterAll(() => {
    // Clean up test builds
    if (fs.existsSync(testBuildDir)) {
      fs.rmSync(testBuildDir, { recursive: true, force: true });
    }
  });

  describe('Build Script Tests', () => {
    test('should build all platforms successfully', async () => {
      const MultiPlatformBuilder = require('../../scripts/build-platforms');
      const builder = new MultiPlatformBuilder();
      
      // Mock build directory to test location
      builder.buildDir = testBuildDir;
      
      await expect(builder.buildAll()).resolves.not.toThrow();
      
      // Verify all platform directories exist
      expect(fs.existsSync(path.join(testBuildDir, 'teams'))).toBe(true);
      expect(fs.existsSync(path.join(testBuildDir, 'zoom'))).toBe(true);
      expect(fs.existsSync(path.join(testBuildDir, 'browser-extension'))).toBe(true);
    }, 60000);

    test('should create deployment packages', async () => {
      const packagePaths = [
        path.join(testBuildDir, 'teams-package.zip'),
        path.join(testBuildDir, 'zoom-package.zip'),
        path.join(testBuildDir, 'browser-extension-package.zip')
      ];

      for (const packagePath of packagePaths) {
        expect(fs.existsSync(packagePath)).toBe(true);
        
        // Verify package is not empty
        const stats = fs.statSync(packagePath);
        expect(stats.size).toBeGreaterThan(0);
      }
    });
  });

  describe('Teams Package Validation', () => {
    let teamsDir;

    beforeAll(() => {
      teamsDir = path.join(testBuildDir, 'teams');
    });

    test('should have valid Teams manifest', () => {
      const manifestPath = path.join(teamsDir, 'manifest.json');
      expect(fs.existsSync(manifestPath)).toBe(true);

      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
      
      // Required Teams manifest fields
      expect(manifest).toHaveProperty('id');
      expect(manifest).toHaveProperty('version');
      expect(manifest).toHaveProperty('packageName');
      expect(manifest).toHaveProperty('developer');
      expect(manifest).toHaveProperty('name');
      expect(manifest).toHaveProperty('description');
      expect(manifest).toHaveProperty('icons');
      expect(manifest).toHaveProperty('accentColor');
      
      // Validate version format
      expect(manifest.version).toMatch(/^\d+\.\d+\.\d+$/);
    });

    test('should have required Teams icons', () => {
      const iconPaths = [
        path.join(teamsDir, 'icon-color.png'),
        path.join(teamsDir, 'icon-outline.png')
      ];

      for (const iconPath of iconPaths) {
        expect(fs.existsSync(iconPath)).toBe(true);
        
        // Verify icon file size
        const stats = fs.statSync(iconPath);
        expect(stats.size).toBeGreaterThan(0);
      }
    });

    test('should have build directory with React app', () => {
      const buildPath = path.join(teamsDir, 'build');
      expect(fs.existsSync(buildPath)).toBe(true);
      
      // Check for essential build files
      expect(fs.existsSync(path.join(buildPath, 'index.html'))).toBe(true);
      expect(fs.existsSync(path.join(buildPath, 'static'))).toBe(true);
    });

    test('should not exceed Teams package size limit', () => {
      const packageSize = getDirectorySize(teamsDir);
      const maxSize = 4 * 1024 * 1024; // 4MB limit for Teams
      
      expect(packageSize).toBeLessThanOrEqual(maxSize);
    });
  });

  describe('Zoom Package Validation', () => {
    let zoomDir;

    beforeAll(() => {
      zoomDir = path.join(testBuildDir, 'zoom');
    });

    test('should have valid Zoom manifest', () => {
      const manifestPath = path.join(zoomDir, 'manifest.json');
      expect(fs.existsSync(manifestPath)).toBe(true);

      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
      
      // Required Zoom manifest fields
      expect(manifest).toHaveProperty('name');
      expect(manifest).toHaveProperty('version');
      expect(manifest).toHaveProperty('description');
      expect(manifest).toHaveProperty('author');
      expect(manifest).toHaveProperty('home_url');
      expect(manifest).toHaveProperty('redirect_uri_domains');
    });

    test('should have server directory for webhooks', () => {
      const serverPath = path.join(zoomDir, 'server');
      expect(fs.existsSync(serverPath)).toBe(true);
      
      // Check for webhook handler
      expect(fs.existsSync(path.join(serverPath, 'webhooks'))).toBe(true);
    });

    test('should not exceed Zoom package size limit', () => {
      const packageSize = getDirectorySize(zoomDir);
      const maxSize = 10 * 1024 * 1024; // 10MB limit for Zoom
      
      expect(packageSize).toBeLessThanOrEqual(maxSize);
    });
  });

  describe('Browser Extension Validation', () => {
    let extensionDir;

    beforeAll(() => {
      extensionDir = path.join(testBuildDir, 'browser-extension');
    });

    test('should have valid extension manifest', () => {
      const manifestPath = path.join(extensionDir, 'manifest.json');
      expect(fs.existsSync(manifestPath)).toBe(true);

      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
      
      // Required extension manifest fields
      expect(manifest).toHaveProperty('manifest_version');
      expect(manifest).toHaveProperty('name');
      expect(manifest).toHaveProperty('version');
      expect(manifest).toHaveProperty('description');
      expect(manifest).toHaveProperty('permissions');
      expect(manifest).toHaveProperty('background');
      expect(manifest).toHaveProperty('content_scripts');
      
      // Should use Manifest V3
      expect(manifest.manifest_version).toBe(3);
    });

    test('should have required extension directories', () => {
      const requiredDirs = [
        'background',
        'content-scripts',
        'popup',
        'options',
        'icons'
      ];

      for (const dir of requiredDirs) {
        const dirPath = path.join(extensionDir, dir);
        expect(fs.existsSync(dirPath)).toBe(true);
      }
    });

    test('should have extension icons', () => {
      const iconSizes = [16, 32, 48, 128];
      
      for (const size of iconSizes) {
        const iconPath = path.join(extensionDir, 'icons', `icon-${size}.png`);
        expect(fs.existsSync(iconPath)).toBe(true);
      }
    });

    test('should not exceed Chrome Web Store size limit', () => {
      const packageSize = getDirectorySize(extensionDir);
      const maxSize = 128 * 1024 * 1024; // 128MB limit for Chrome Web Store
      
      expect(packageSize).toBeLessThanOrEqual(maxSize);
    });
  });

  describe('Cross-Platform Validation', () => {
    test('should have consistent version across all platforms', () => {
      const packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, '../../package.json'), 'utf8'));
      const expectedVersion = packageJson.version;

      // Check Teams manifest
      const teamsManifest = JSON.parse(fs.readFileSync(path.join(testBuildDir, 'teams/manifest.json'), 'utf8'));
      expect(teamsManifest.version).toBe(expectedVersion);

      // Check Zoom manifest
      const zoomManifest = JSON.parse(fs.readFileSync(path.join(testBuildDir, 'zoom/manifest.json'), 'utf8'));
      expect(zoomManifest.version).toBe(expectedVersion);

      // Check Extension manifest
      const extensionManifest = JSON.parse(fs.readFileSync(path.join(testBuildDir, 'browser-extension/manifest.json'), 'utf8'));
      expect(extensionManifest.version).toBe(expectedVersion);
    });

    test('should have build metadata in all manifests', () => {
      const platforms = ['teams', 'zoom', 'browser-extension'];
      
      for (const platform of platforms) {
        const manifestPath = path.join(testBuildDir, platform, 'manifest.json');
        const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
        
        expect(manifest).toHaveProperty('buildDate');
        expect(manifest).toHaveProperty('buildPlatform');
        expect(manifest.buildPlatform).toBe(platform === 'browser-extension' ? 'browser-extension' : platform);
        
        // Validate build date format
        expect(new Date(manifest.buildDate).toISOString()).toBe(manifest.buildDate);
      }
    });

    test('should have no security vulnerabilities in dependencies', async () => {
      try {
        execSync('npm audit --audit-level moderate', { 
          cwd: path.join(__dirname, '../..'),
          stdio: 'pipe'
        });
      } catch (error) {
        // If audit fails, check if it's due to vulnerabilities
        if (error.stdout && error.stdout.includes('vulnerabilities')) {
          fail('Security vulnerabilities found in dependencies');
        }
        // Other audit errors (like network issues) should not fail the test
      }
    });
  });

  describe('Deployment Validator Integration', () => {
    test('should pass all validation checks', async () => {
      // Mock the validator to use test build directory
      validator.buildDir = testBuildDir;
      
      await expect(validator.validateAll()).resolves.not.toThrow();
      
      // Check that validation results show no failures
      for (const [platform, results] of Object.entries(validator.validationResults)) {
        expect(results.failed).toBe(0);
        expect(results.errors).toHaveLength(0);
        expect(results.passed).toBeGreaterThan(0);
      }
    });

    test('should generate validation report', () => {
      const reportPath = path.join(testBuildDir, 'validation-report.json');
      expect(fs.existsSync(reportPath)).toBe(true);
      
      const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
      expect(report).toHaveProperty('timestamp');
      expect(report).toHaveProperty('summary');
      expect(report).toHaveProperty('platforms');
      
      // Verify summary shows no failures
      expect(report.summary.totalFailed).toBe(0);
      expect(report.summary.totalPassed).toBeGreaterThan(0);
    });
  });

  describe('Performance Validation', () => {
    test('should have optimized bundle sizes', () => {
      const platforms = ['teams', 'zoom', 'browser-extension'];
      
      for (const platform of platforms) {
        const buildPath = path.join(testBuildDir, platform, 'build');
        if (fs.existsSync(buildPath)) {
          const staticPath = path.join(buildPath, 'static');
          if (fs.existsSync(staticPath)) {
            // Check that JavaScript bundles are not excessively large
            const jsFiles = fs.readdirSync(path.join(staticPath, 'js'))
              .filter(file => file.endsWith('.js'));
            
            for (const jsFile of jsFiles) {
              const filePath = path.join(staticPath, 'js', jsFile);
              const fileSize = fs.statSync(filePath).size;
              const maxSize = 2 * 1024 * 1024; // 2MB per JS file
              
              expect(fileSize).toBeLessThanOrEqual(maxSize);
            }
          }
        }
      }
    });

    test('should have compressed assets', () => {
      // Check that CSS and JS files are minified (no excessive whitespace)
      const platforms = ['teams', 'zoom', 'browser-extension'];
      
      for (const platform of platforms) {
        const buildPath = path.join(testBuildDir, platform, 'build');
        if (fs.existsSync(buildPath)) {
          const staticPath = path.join(buildPath, 'static');
          if (fs.existsSync(staticPath)) {
            // Check CSS files
            const cssPath = path.join(staticPath, 'css');
            if (fs.existsSync(cssPath)) {
              const cssFiles = fs.readdirSync(cssPath).filter(file => file.endsWith('.css'));
              for (const cssFile of cssFiles) {
                const content = fs.readFileSync(path.join(cssPath, cssFile), 'utf8');
                // Minified CSS should have minimal whitespace
                const whitespaceRatio = (content.match(/\s/g) || []).length / content.length;
                expect(whitespaceRatio).toBeLessThan(0.1); // Less than 10% whitespace
              }
            }
          }
        }
      }
    });
  });
});

// Helper function to calculate directory size
function getDirectorySize(dirPath) {
  let totalSize = 0;
  
  if (!fs.existsSync(dirPath)) {
    return 0;
  }
  
  const files = fs.readdirSync(dirPath, { withFileTypes: true });
  
  for (const file of files) {
    const filePath = path.join(dirPath, file.name);
    
    if (file.isDirectory()) {
      totalSize += getDirectorySize(filePath);
    } else {
      totalSize += fs.statSync(filePath).size;
    }
  }
  
  return totalSize;
}