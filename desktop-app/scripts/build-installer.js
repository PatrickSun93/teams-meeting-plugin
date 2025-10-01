const { build } = require('electron-builder');
const path = require('path');
const fs = require('fs');

class InstallerBuilder {
  constructor() {
    this.config = {
      appId: 'com.meetingtranscription.desktop',
      productName: 'Meeting Transcription',
      copyright: 'Copyright © 2024 Meeting Transcription Team',
      directories: {
        output: 'dist',
        buildResources: 'build'
      },
      files: [
        'src/**/*',
        'renderer/**/*',
        'node_modules/**/*',
        'package.json'
      ],
      extraResources: [
        {
          from: 'assets',
          to: 'assets'
        }
      ],
      publish: {
        provider: 'github',
        owner: 'your-org',
        repo: 'meeting-transcription'
      }
    };
  }

  async buildForPlatform(platform) {
    console.log(`Building installer for ${platform}...`);
    
    const platformConfig = this.getPlatformConfig(platform);
    const fullConfig = { ...this.config, ...platformConfig };

    try {
      const result = await build({
        targets: this.getTargets(platform),
        config: fullConfig
      });

      console.log(`✅ Successfully built installer for ${platform}`);
      return result;
    } catch (error) {
      console.error(`❌ Failed to build installer for ${platform}:`, error);
      throw error;
    }
  }

  getPlatformConfig(platform) {
    switch (platform) {
      case 'windows':
        return {
          win: {
            target: [
              {
                target: 'nsis',
                arch: ['x64', 'ia32']
              },
              {
                target: 'portable',
                arch: ['x64']
              }
            ],
            icon: 'assets/icon.ico',
            publisherName: 'Meeting Transcription Team',
            verifyUpdateCodeSignature: false
          },
          nsis: {
            oneClick: false,
            allowToChangeInstallationDirectory: true,
            allowElevation: true,
            installerIcon: 'assets/installer.ico',
            uninstallerIcon: 'assets/uninstaller.ico',
            installerHeaderIcon: 'assets/installer-header.ico',
            createDesktopShortcut: true,
            createStartMenuShortcut: true,
            shortcutName: 'Meeting Transcription',
            include: 'scripts/installer.nsh'
          }
        };

      case 'mac':
        return {
          mac: {
            target: [
              {
                target: 'dmg',
                arch: ['x64', 'arm64']
              },
              {
                target: 'zip',
                arch: ['x64', 'arm64']
              }
            ],
            icon: 'assets/icon.icns',
            category: 'public.app-category.productivity',
            hardenedRuntime: true,
            gatekeeperAssess: false,
            entitlements: 'build/entitlements.mac.plist',
            entitlementsInherit: 'build/entitlements.mac.plist'
          },
          dmg: {
            title: 'Meeting Transcription ${version}',
            icon: 'assets/dmg-icon.icns',
            background: 'assets/dmg-background.png',
            window: {
              width: 540,
              height: 380
            },
            contents: [
              {
                x: 130,
                y: 220,
                type: 'file'
              },
              {
                x: 410,
                y: 220,
                type: 'link',
                path: '/Applications'
              }
            ]
          }
        };

      case 'linux':
        return {
          linux: {
            target: [
              {
                target: 'AppImage',
                arch: ['x64']
              },
              {
                target: 'deb',
                arch: ['x64']
              },
              {
                target: 'rpm',
                arch: ['x64']
              },
              {
                target: 'snap',
                arch: ['x64']
              }
            ],
            icon: 'assets/icon.png',
            category: 'Office',
            desktop: {
              Name: 'Meeting Transcription',
              Comment: 'Universal meeting transcription application',
              Keywords: 'meeting;transcription;audio;speech-to-text;'
            }
          },
          deb: {
            depends: ['gconf2', 'gconf-service', 'libnotify4', 'libappindicator1', 'libxtst6', 'libnss3']
          },
          rpm: {
            depends: ['libXScrnSaver']
          },
          snap: {
            summary: 'Universal meeting transcription application',
            grade: 'stable',
            confinement: 'strict',
            plugs: ['default', 'audio-record', 'screen-inhibit-control']
          }
        };

      default:
        throw new Error(`Unsupported platform: ${platform}`);
    }
  }

  getTargets(platform) {
    const targetMap = {
      windows: 'win',
      mac: 'mac',
      linux: 'linux'
    };

    return targetMap[platform];
  }

  async buildAll() {
    const platforms = ['windows', 'mac', 'linux'];
    const results = [];

    for (const platform of platforms) {
      try {
        const result = await this.buildForPlatform(platform);
        results.push({ platform, success: true, result });
      } catch (error) {
        results.push({ platform, success: false, error: error.message });
      }
    }

    return results;
  }

  async createPortableVersion() {
    console.log('Creating portable version...');
    
    try {
      const result = await build({
        targets: 'portable',
        config: {
          ...this.config,
          win: {
            target: 'portable'
          }
        }
      });

      console.log('✅ Successfully created portable version');
      return result;
    } catch (error) {
      console.error('❌ Failed to create portable version:', error);
      throw error;
    }
  }

  generateChecksums() {
    const crypto = require('crypto');
    const distPath = path.join(__dirname, '../dist');
    
    if (!fs.existsSync(distPath)) {
      console.log('No dist directory found');
      return;
    }

    const files = fs.readdirSync(distPath).filter(file => 
      file.endsWith('.exe') || 
      file.endsWith('.dmg') || 
      file.endsWith('.AppImage') || 
      file.endsWith('.deb') || 
      file.endsWith('.rpm')
    );

    const checksums = {};

    files.forEach(file => {
      const filePath = path.join(distPath, file);
      const fileBuffer = fs.readFileSync(filePath);
      const hashSum = crypto.createHash('sha256');
      hashSum.update(fileBuffer);
      checksums[file] = hashSum.digest('hex');
    });

    const checksumsPath = path.join(distPath, 'checksums.json');
    fs.writeFileSync(checksumsPath, JSON.stringify(checksums, null, 2));
    
    console.log('✅ Generated checksums for all installers');
    return checksums;
  }

  async validateBuild(platform) {
    const distPath = path.join(__dirname, '../dist');
    const expectedFiles = this.getExpectedFiles(platform);
    
    const missingFiles = expectedFiles.filter(file => 
      !fs.existsSync(path.join(distPath, file))
    );

    if (missingFiles.length > 0) {
      throw new Error(`Missing files for ${platform}: ${missingFiles.join(', ')}`);
    }

    console.log(`✅ Build validation passed for ${platform}`);
    return true;
  }

  getExpectedFiles(platform) {
    const version = require('../package.json').version;
    
    switch (platform) {
      case 'windows':
        return [
          `Meeting Transcription Setup ${version}.exe`,
          `Meeting Transcription ${version}.exe`
        ];
      case 'mac':
        return [
          `Meeting Transcription-${version}.dmg`,
          `Meeting Transcription-${version}-mac.zip`
        ];
      case 'linux':
        return [
          `Meeting Transcription-${version}.AppImage`,
          `meeting-transcription_${version}_amd64.deb`,
          `meeting-transcription-${version}.x86_64.rpm`
        ];
      default:
        return [];
    }
  }
}

// CLI interface
if (require.main === module) {
  const builder = new InstallerBuilder();
  const args = process.argv.slice(2);
  const command = args[0];
  const platform = args[1];

  async function main() {
    try {
      switch (command) {
        case 'build':
          if (platform) {
            await builder.buildForPlatform(platform);
          } else {
            const results = await builder.buildAll();
            console.log('\n📊 Build Summary:');
            results.forEach(({ platform, success, error }) => {
              const status = success ? '✅' : '❌';
              console.log(`${status} ${platform}: ${success ? 'Success' : error}`);
            });
          }
          break;

        case 'portable':
          await builder.createPortableVersion();
          break;

        case 'checksums':
          builder.generateChecksums();
          break;

        case 'validate':
          if (platform) {
            await builder.validateBuild(platform);
          } else {
            console.error('Platform required for validation');
            process.exit(1);
          }
          break;

        default:
          console.log(`
Usage: node build-installer.js <command> [platform]

Commands:
  build [platform]  - Build installer for specific platform or all platforms
  portable         - Create portable Windows version
  checksums        - Generate checksums for all built files
  validate <platform> - Validate build output for platform

Platforms:
  windows, mac, linux
          `);
      }
    } catch (error) {
      console.error('❌ Build failed:', error);
      process.exit(1);
    }
  }

  main();
}

module.exports = InstallerBuilder;