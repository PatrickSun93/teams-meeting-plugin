#!/usr/bin/env node

// Generate comprehensive test summary from all cross-platform test results
const fs = require('fs');
const path = require('path');

class TestSummaryGenerator {
  constructor(inputDir, outputFile) {
    this.inputDir = inputDir;
    this.outputFile = outputFile;
    this.platforms = ['teams', 'zoom', 'meet', 'generic'];
    this.testTypes = ['integration', 'e2e', 'performance', 'accessibility', 'security'];
    
    this.summary = {
      generated: new Date().toISOString(),
      overallStatus: false,
      coverage: 0,
      platforms: [],
      performance: {
        audioProcessing: 0,
        transcriptionLatency: 0,
        memoryUsage: 0
      },
      testResults: {
        total: 0,
        passed: 0,
        failed: 0,
        skipped: 0
      },
      browserCompatibility: {},
      securityCompliance: {},
      accessibilityScore: 0,
      recommendations: []
    };
  }

  async generate() {
    console.log('📊 Generating comprehensive test summary...');
    
    // Process results for each platform
    for (const platform of this.platforms) {
      await this.processPlatformSummary(platform);
    }
    
    // Calculate overall metrics
    this.calculateOverallMetrics();
    
    // Generate performance summary
    await this.generatePerformanceSummary();
    
    // Generate browser compatibility summary
    await this.generateBrowserCompatibilitySummary();
    
    // Generate security compliance summary
    await this.generateSecurityComplianceSummary();
    
    // Generate accessibility summary
    await this.generateAccessibilitySummary();
    
    // Generate recommendations
    this.generateRecommendations();
    
    // Write summary file
    await this.writeSummaryFile();
    
    console.log('✅ Test summary generated successfully');
  }

  async processPlatformSummary(platform) {
    console.log(`🔍 Processing ${platform} summary...`);
    
    const platformSummary = {
      name: platform,
      integration: false,
      e2e: false,
      performance: false,
      accessibility: false,
      security: false,
      overallScore: 0,
      testCounts: {
        total: 0,
        passed: 0,
        failed: 0
      },
      issues: [],
      strengths: []
    };

    // Process each test type for the platform
    for (const testType of this.testTypes) {
      const results = await this.getTestResults(platform, testType);
      
      if (results) {
        platformSummary.testCounts.total += results.total;
        platformSummary.testCounts.passed += results.passed;
        platformSummary.testCounts.failed += results.failed;
        
        // Determine if test type passed (80% threshold)
        const passRate = results.total > 0 ? results.passed / results.total : 0;
        platformSummary[testType] = passRate >= 0.8;
        
        if (passRate < 0.8) {
          platformSummary.issues.push(`${testType} tests below threshold (${Math.round(passRate * 100)}%)`);
        } else {
          platformSummary.strengths.push(`Strong ${testType} performance (${Math.round(passRate * 100)}%)`);
        }
      }
    }

    // Calculate overall platform score
    const testTypeScores = this.testTypes.map(type => platformSummary[type] ? 1 : 0);
    platformSummary.overallScore = Math.round((testTypeScores.reduce((a, b) => a + b, 0) / this.testTypes.length) * 100);

    this.summary.platforms.push(platformSummary);
    
    // Update global test counts
    this.summary.testResults.total += platformSummary.testCounts.total;
    this.summary.testResults.passed += platformSummary.testCounts.passed;
    this.summary.testResults.failed += platformSummary.testCounts.failed;
  }

  async getTestResults(platform, testType) {
    const resultFiles = this.findResultFiles(platform, testType);
    
    if (resultFiles.length === 0) {
      return null;
    }

    let totalTests = 0;
    let passedTests = 0;
    let failedTests = 0;

    for (const file of resultFiles) {
      try {
        const content = fs.readFileSync(file, 'utf8');
        const results = JSON.parse(content);
        
        if (results.testResults) {
          // Jest format
          totalTests += results.numTotalTests || results.testResults.length;
          passedTests += results.numPassedTests || 
            results.testResults.filter(t => t.status === 'passed').length;
          failedTests += results.numFailedTests || 
            results.testResults.filter(t => t.status === 'failed').length;
        } else if (results.suites) {
          // Playwright format
          for (const suite of results.suites) {
            for (const spec of suite.specs || []) {
              totalTests++;
              const hasPassed = spec.tests?.some(test => 
                test.results?.some(result => result.status === 'passed')
              );
              if (hasPassed) {
                passedTests++;
              } else {
                failedTests++;
              }
            }
          }
        } else if (results.tests) {
          // Custom format
          totalTests += results.tests.length;
          passedTests += results.tests.filter(t => t.passed).length;
          failedTests += results.tests.filter(t => !t.passed).length;
        }
      } catch (error) {
        console.warn(`⚠️  Failed to parse ${file}: ${error.message}`);
      }
    }

    return {
      total: totalTests,
      passed: passedTests,
      failed: failedTests
    };
  }

  findResultFiles(platform, testType) {
    const patterns = [
      `${testType}-results-${platform}`,
      `${platform}-${testType}`,
      `${testType}-${platform}`
    ];

    const files = [];
    
    try {
      const entries = fs.readdirSync(this.inputDir);
      
      for (const entry of entries) {
        const entryPath = path.join(this.inputDir, entry);
        
        if (fs.statSync(entryPath).isDirectory()) {
          for (const pattern of patterns) {
            if (entry.includes(pattern)) {
              const subFiles = fs.readdirSync(entryPath)
                .filter(f => f.endsWith('.json'))
                .map(f => path.join(entryPath, f));
              files.push(...subFiles);
            }
          }
        }
      }
    } catch (error) {
      console.warn(`⚠️  Error reading directory ${this.inputDir}: ${error.message}`);
    }

    return files;
  }

  calculateOverallMetrics() {
    console.log('📈 Calculating overall metrics...');
    
    // Calculate overall coverage
    if (this.summary.testResults.total > 0) {
      this.summary.coverage = Math.round(
        (this.summary.testResults.passed / this.summary.testResults.total) * 100
      );
    }

    // Determine overall status
    const platformsPassing = this.summary.platforms.filter(p => p.overallScore >= 80).length;
    const totalPlatforms = this.summary.platforms.length;
    
    this.summary.overallStatus = (platformsPassing / totalPlatforms) >= 0.75; // 75% of platforms must pass

    // Calculate skipped tests
    this.summary.testResults.skipped = this.summary.testResults.total - 
      this.summary.testResults.passed - this.summary.testResults.failed;
  }

  async generatePerformanceSummary() {
    console.log('⚡ Generating performance summary...');
    
    const performanceFiles = this.findPerformanceFiles();
    const performanceMetrics = {
      audioProcessingTimes: [],
      transcriptionLatencies: [],
      memoryUsages: []
    };

    for (const file of performanceFiles) {
      try {
        const content = fs.readFileSync(file, 'utf8');
        const results = JSON.parse(content);
        
        if (results.performance) {
          if (results.performance.audioProcessing) {
            performanceMetrics.audioProcessingTimes.push(results.performance.audioProcessing);
          }
          if (results.performance.transcriptionLatency) {
            performanceMetrics.transcriptionLatencies.push(results.performance.transcriptionLatency);
          }
          if (results.performance.memoryUsage) {
            performanceMetrics.memoryUsages.push(results.performance.memoryUsage);
          }
        }
      } catch (error) {
        console.warn(`⚠️  Failed to parse performance file ${file}: ${error.message}`);
      }
    }

    // Calculate averages
    this.summary.performance.audioProcessing = this.calculateAverage(performanceMetrics.audioProcessingTimes);
    this.summary.performance.transcriptionLatency = this.calculateAverage(performanceMetrics.transcriptionLatencies);
    this.summary.performance.memoryUsage = this.calculateAverage(performanceMetrics.memoryUsages);
  }

  findPerformanceFiles() {
    const files = [];
    
    try {
      const entries = fs.readdirSync(this.inputDir);
      
      for (const entry of entries) {
        if (entry.includes('performance-results')) {
          const entryPath = path.join(this.inputDir, entry);
          
          if (fs.statSync(entryPath).isDirectory()) {
            const subFiles = fs.readdirSync(entryPath)
              .filter(f => f.endsWith('.json'))
              .map(f => path.join(entryPath, f));
            files.push(...subFiles);
          }
        }
      }
    } catch (error) {
      console.warn(`⚠️  Error finding performance files: ${error.message}`);
    }

    return files;
  }

  calculateAverage(values) {
    if (values.length === 0) return 0;
    return Math.round(values.reduce((a, b) => a + b, 0) / values.length);
  }

  async generateBrowserCompatibilitySummary() {
    console.log('🌐 Generating browser compatibility summary...');
    
    const browsers = ['chromium', 'firefox', 'webkit'];
    
    for (const browser of browsers) {
      const browserResults = await this.getBrowserResults(browser);
      
      this.summary.browserCompatibility[browser] = {
        supported: browserResults.total > 0,
        compatibility: browserResults.total > 0 ? 
          Math.round((browserResults.passed / browserResults.total) * 100) : 0,
        totalTests: browserResults.total,
        passedTests: browserResults.passed
      };
    }
  }

  async getBrowserResults(browser) {
    const browserFiles = [];
    
    try {
      const entries = fs.readdirSync(this.inputDir);
      
      for (const entry of entries) {
        if (entry.includes('e2e-results') && entry.includes(browser)) {
          const entryPath = path.join(this.inputDir, entry);
          
          if (fs.statSync(entryPath).isDirectory()) {
            const subFiles = fs.readdirSync(entryPath)
              .filter(f => f.endsWith('.json'))
              .map(f => path.join(entryPath, f));
            browserFiles.push(...subFiles);
          }
        }
      }
    } catch (error) {
      console.warn(`⚠️  Error finding browser files for ${browser}: ${error.message}`);
    }

    let total = 0;
    let passed = 0;

    for (const file of browserFiles) {
      try {
        const content = fs.readFileSync(file, 'utf8');
        const results = JSON.parse(content);
        
        if (results.suites) {
          for (const suite of results.suites) {
            for (const spec of suite.specs || []) {
              total++;
              const hasPassed = spec.tests?.some(test => 
                test.results?.some(result => result.status === 'passed')
              );
              if (hasPassed) passed++;
            }
          }
        }
      } catch (error) {
        console.warn(`⚠️  Failed to parse browser file ${file}: ${error.message}`);
      }
    }

    return { total, passed };
  }

  async generateSecurityComplianceSummary() {
    console.log('🔒 Generating security compliance summary...');
    
    const securityAspects = ['encryption', 'privacy', 'audit', 'compliance'];
    
    for (const aspect of securityAspects) {
      const aspectResults = await this.getSecurityResults(aspect);
      
      this.summary.securityCompliance[aspect] = {
        compliant: aspectResults.total > 0 && (aspectResults.passed / aspectResults.total) >= 0.9,
        score: aspectResults.total > 0 ? 
          Math.round((aspectResults.passed / aspectResults.total) * 100) : 0,
        totalTests: aspectResults.total,
        passedTests: aspectResults.passed
      };
    }
  }

  async getSecurityResults(aspect) {
    const securityFiles = [];
    
    try {
      const entries = fs.readdirSync(this.inputDir);
      
      for (const entry of entries) {
        if (entry.includes('security-results') && entry.includes(aspect)) {
          const entryPath = path.join(this.inputDir, entry);
          
          if (fs.statSync(entryPath).isDirectory()) {
            const subFiles = fs.readdirSync(entryPath)
              .filter(f => f.endsWith('.json'))
              .map(f => path.join(entryPath, f));
            securityFiles.push(...subFiles);
          }
        }
      }
    } catch (error) {
      console.warn(`⚠️  Error finding security files for ${aspect}: ${error.message}`);
    }

    let total = 0;
    let passed = 0;

    for (const file of securityFiles) {
      try {
        const content = fs.readFileSync(file, 'utf8');
        const results = JSON.parse(content);
        
        if (results.testResults) {
          total += results.numTotalTests || results.testResults.length;
          passed += results.numPassedTests || 
            results.testResults.filter(t => t.status === 'passed').length;
        }
      } catch (error) {
        console.warn(`⚠️  Failed to parse security file ${file}: ${error.message}`);
      }
    }

    return { total, passed };
  }

  async generateAccessibilitySummary() {
    console.log('♿ Generating accessibility summary...');
    
    const accessibilityFiles = [];
    
    try {
      const entries = fs.readdirSync(this.inputDir);
      
      for (const entry of entries) {
        if (entry.includes('accessibility-results')) {
          const entryPath = path.join(this.inputDir, entry);
          
          if (fs.statSync(entryPath).isDirectory()) {
            const subFiles = fs.readdirSync(entryPath)
              .filter(f => f.endsWith('.json'))
              .map(f => path.join(entryPath, f));
            accessibilityFiles.push(...subFiles);
          }
        }
      }
    } catch (error) {
      console.warn(`⚠️  Error finding accessibility files: ${error.message}`);
    }

    let totalViolations = 0;
    let totalChecks = 0;

    for (const file of accessibilityFiles) {
      try {
        const content = fs.readFileSync(file, 'utf8');
        const results = JSON.parse(content);
        
        if (results.accessibility) {
          totalViolations += results.accessibility.violations || 0;
          totalChecks += results.accessibility.checks || 0;
        }
      } catch (error) {
        console.warn(`⚠️  Failed to parse accessibility file ${file}: ${error.message}`);
      }
    }

    // Calculate accessibility score (100 - violation percentage)
    this.summary.accessibilityScore = totalChecks > 0 ? 
      Math.max(0, 100 - Math.round((totalViolations / totalChecks) * 100)) : 0;
  }

  generateRecommendations() {
    console.log('💡 Generating recommendations...');
    
    const recommendations = [];

    // Platform-specific recommendations
    const failingPlatforms = this.summary.platforms.filter(p => p.overallScore < 80);
    if (failingPlatforms.length > 0) {
      recommendations.push({
        type: 'platform_improvement',
        priority: 'high',
        title: `Improve ${failingPlatforms.map(p => p.name).join(', ')} platform support`,
        description: 'Some platforms are not meeting quality thresholds',
        action: 'Focus on failing test areas and implement missing features'
      });
    }

    // Performance recommendations
    if (this.summary.performance.audioProcessing > 100) {
      recommendations.push({
        type: 'performance',
        priority: 'medium',
        title: 'Optimize audio processing performance',
        description: `Audio processing averaging ${this.summary.performance.audioProcessing}ms`,
        action: 'Profile and optimize audio processing algorithms'
      });
    }

    if (this.summary.performance.memoryUsage > 200) {
      recommendations.push({
        type: 'performance',
        priority: 'medium',
        title: 'Reduce memory usage',
        description: `Memory usage averaging ${this.summary.performance.memoryUsage}MB`,
        action: 'Implement memory optimization and garbage collection improvements'
      });
    }

    // Browser compatibility recommendations
    const poorBrowsers = Object.entries(this.summary.browserCompatibility)
      .filter(([_, data]) => data.compatibility < 80)
      .map(([browser, _]) => browser);

    if (poorBrowsers.length > 0) {
      recommendations.push({
        type: 'browser_compatibility',
        priority: 'medium',
        title: `Improve ${poorBrowsers.join(', ')} browser support`,
        description: 'Some browsers have compatibility issues',
        action: 'Add browser-specific polyfills and test coverage'
      });
    }

    // Security recommendations
    const securityIssues = Object.entries(this.summary.securityCompliance)
      .filter(([_, data]) => !data.compliant)
      .map(([aspect, _]) => aspect);

    if (securityIssues.length > 0) {
      recommendations.push({
        type: 'security',
        priority: 'high',
        title: `Address ${securityIssues.join(', ')} security compliance`,
        description: 'Security compliance requirements not met',
        action: 'Review and implement security best practices'
      });
    }

    // Accessibility recommendations
    if (this.summary.accessibilityScore < 90) {
      recommendations.push({
        type: 'accessibility',
        priority: 'high',
        title: 'Improve accessibility compliance',
        description: `Accessibility score: ${this.summary.accessibilityScore}%`,
        action: 'Address accessibility violations and improve WCAG compliance'
      });
    }

    // Coverage recommendations
    if (this.summary.coverage < 80) {
      recommendations.push({
        type: 'test_coverage',
        priority: 'medium',
        title: 'Increase test coverage',
        description: `Current coverage: ${this.summary.coverage}%`,
        action: 'Add more comprehensive test cases and edge case coverage'
      });
    }

    this.summary.recommendations = recommendations;
  }

  async writeSummaryFile() {
    console.log('📝 Writing summary file...');
    
    const summaryJson = JSON.stringify(this.summary, null, 2);
    fs.writeFileSync(this.outputFile, summaryJson);
    
    // Also write a human-readable version
    const readableFile = this.outputFile.replace('.json', '-readable.txt');
    const readableContent = this.generateReadableSummary();
    fs.writeFileSync(readableFile, readableContent);
  }

  generateReadableSummary() {
    return `
CROSS-PLATFORM TEST SUMMARY
Generated: ${this.summary.generated}

OVERALL STATUS: ${this.summary.overallStatus ? 'PASS ✅' : 'FAIL ❌'}
Test Coverage: ${this.summary.coverage}%
Accessibility Score: ${this.summary.accessibilityScore}%

PLATFORM RESULTS:
${this.summary.platforms.map(p => `
  ${p.name.toUpperCase()}:
    Overall Score: ${p.overallScore}%
    Integration: ${p.integration ? '✅' : '❌'}
    E2E: ${p.e2e ? '✅' : '❌'}
    Performance: ${p.performance ? '✅' : '❌'}
    Accessibility: ${p.accessibility ? '✅' : '❌'}
    Security: ${p.security ? '✅' : '❌'}
    Tests: ${p.testCounts.passed}/${p.testCounts.total} passed
    ${p.issues.length > 0 ? `Issues: ${p.issues.join(', ')}` : ''}
    ${p.strengths.length > 0 ? `Strengths: ${p.strengths.join(', ')}` : ''}
`).join('')}

PERFORMANCE METRICS:
  Audio Processing: ${this.summary.performance.audioProcessing}ms avg
  Transcription Latency: ${this.summary.performance.transcriptionLatency}ms avg
  Memory Usage: ${this.summary.performance.memoryUsage}MB avg

BROWSER COMPATIBILITY:
${Object.entries(this.summary.browserCompatibility).map(([browser, data]) => 
  `  ${browser}: ${data.compatibility}% (${data.passedTests}/${data.totalTests} tests)`
).join('\n')}

SECURITY COMPLIANCE:
${Object.entries(this.summary.securityCompliance).map(([aspect, data]) => 
  `  ${aspect}: ${data.compliant ? '✅' : '❌'} (${data.score}%)`
).join('\n')}

${this.summary.recommendations.length > 0 ? `
RECOMMENDATIONS:
${this.summary.recommendations.map(rec => 
  `  ${rec.priority.toUpperCase()}: ${rec.title}\n    ${rec.description}\n    Action: ${rec.action}`
).join('\n\n')}
` : 'No recommendations - all systems performing well! ✅'}

TEST STATISTICS:
  Total Tests: ${this.summary.testResults.total}
  Passed: ${this.summary.testResults.passed}
  Failed: ${this.summary.testResults.failed}
  Skipped: ${this.summary.testResults.skipped}
`;
  }
}

// CLI interface
if (require.main === module) {
  const args = process.argv.slice(2);
  const inputDir = args.find(arg => arg.startsWith('--input-dir='))?.split('=')[1] || 'test-artifacts';
  const outputFile = args.find(arg => arg.startsWith('--output-file='))?.split('=')[1] || 'test-summary.json';

  const generator = new TestSummaryGenerator(inputDir, outputFile);
  
  generator.generate()
    .then(() => {
      console.log('✅ Test summary generation completed');
      
      // Print key metrics to console for CI
      const summary = JSON.parse(fs.readFileSync(outputFile, 'utf8'));
      console.log('\n📊 KEY METRICS:');
      console.log(`Overall Status: ${summary.overallStatus ? 'PASS ✅' : 'FAIL ❌'}`);
      console.log(`Coverage: ${summary.coverage}%`);
      console.log(`Platforms Passing: ${summary.platforms.filter(p => p.overallScore >= 80).length}/${summary.platforms.length}`);
      console.log(`Accessibility Score: ${summary.accessibilityScore}%`);
      
      if (summary.recommendations.length > 0) {
        console.log(`\n⚠️  ${summary.recommendations.length} recommendations generated`);
      }
      
      process.exit(summary.overallStatus ? 0 : 1);
    })
    .catch(error => {
      console.error('❌ Failed to generate test summary:', error);
      process.exit(1);
    });
}

module.exports = TestSummaryGenerator;