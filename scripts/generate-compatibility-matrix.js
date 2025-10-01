#!/usr/bin/env node

// Generate cross-platform compatibility matrix from test results
const fs = require('fs');
const path = require('path');

class CompatibilityMatrixGenerator {
  constructor(inputDir, outputDir) {
    this.inputDir = inputDir;
    this.outputDir = outputDir;
    this.platforms = ['teams', 'zoom', 'meet', 'generic'];
    this.testTypes = ['integration', 'e2e', 'performance', 'accessibility', 'security'];
    this.browsers = ['chromium', 'firefox', 'webkit'];
    
    this.matrix = {
      generated: new Date().toISOString(),
      platforms: {},
      summary: {
        totalTests: 0,
        passedTests: 0,
        failedTests: 0,
        coverage: 0
      },
      compatibility: {},
      recommendations: []
    };
  }

  async generate() {
    console.log('🔍 Analyzing test results...');
    
    // Ensure output directory exists
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
    }

    // Process test results for each platform
    for (const platform of this.platforms) {
      await this.processPlatformResults(platform);
    }

    // Generate compatibility analysis
    this.generateCompatibilityAnalysis();
    
    // Generate recommendations
    this.generateRecommendations();
    
    // Calculate overall metrics
    this.calculateMetrics();
    
    // Write matrix files
    await this.writeMatrixFiles();
    
    console.log('✅ Compatibility matrix generated successfully');
  }

  async processPlatformResults(platform) {
    console.log(`📊 Processing ${platform} results...`);
    
    this.matrix.platforms[platform] = {
      name: platform,
      testResults: {},
      browserSupport: {},
      performance: {},
      accessibility: {},
      security: {},
      overallStatus: 'unknown'
    };

    // Process each test type
    for (const testType of this.testTypes) {
      await this.processTestType(platform, testType);
    }

    // Determine overall platform status
    this.matrix.platforms[platform].overallStatus = this.calculatePlatformStatus(platform);
  }

  async processTestType(platform, testType) {
    const resultFiles = this.findResultFiles(platform, testType);
    
    this.matrix.platforms[platform].testResults[testType] = {
      status: 'not_run',
      passed: 0,
      failed: 0,
      total: 0,
      coverage: 0,
      details: []
    };

    for (const resultFile of resultFiles) {
      try {
        const results = await this.parseResultFile(resultFile);
        this.aggregateResults(platform, testType, results);
      } catch (error) {
        console.warn(`⚠️  Failed to parse ${resultFile}: ${error.message}`);
      }
    }

    // Process browser-specific results for E2E tests
    if (testType === 'e2e') {
      await this.processBrowserResults(platform);
    }
  }

  findResultFiles(platform, testType) {
    const patterns = [
      `${testType}-results-${platform}`,
      `${testType}-results-${platform}-*`,
      `${platform}-${testType}-*`
    ];

    const files = [];
    
    try {
      const entries = fs.readdirSync(this.inputDir);
      
      for (const entry of entries) {
        const entryPath = path.join(this.inputDir, entry);
        
        if (fs.statSync(entryPath).isDirectory()) {
          for (const pattern of patterns) {
            if (entry.includes(pattern)) {
              // Look for JSON result files in the directory
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

  async parseResultFile(filePath) {
    const content = fs.readFileSync(filePath, 'utf8');
    
    // Try to parse as JSON first
    try {
      return JSON.parse(content);
    } catch (error) {
      // If not JSON, try to parse as JUnit XML or other formats
      return this.parseAlternativeFormat(content, filePath);
    }
  }

  parseAlternativeFormat(content, filePath) {
    // Handle JUnit XML format
    if (content.includes('<?xml') && content.includes('testsuite')) {
      return this.parseJUnitXML(content);
    }
    
    // Handle Jest JSON format
    if (content.includes('"testResults"')) {
      return JSON.parse(content);
    }
    
    // Handle Playwright JSON format
    if (content.includes('"suites"')) {
      return JSON.parse(content);
    }
    
    throw new Error(`Unsupported format for file: ${filePath}`);
  }

  parseJUnitXML(xmlContent) {
    // Simple XML parsing for JUnit format
    const testcaseRegex = /<testcase[^>]*name="([^"]*)"[^>]*time="([^"]*)"[^>]*>/g;
    const failureRegex = /<failure[^>]*>/g;
    
    const results = {
      testResults: [],
      numTotalTests: 0,
      numPassedTests: 0,
      numFailedTests: 0
    };

    let match;
    while ((match = testcaseRegex.exec(xmlContent)) !== null) {
      const testName = match[1];
      const duration = parseFloat(match[2]) * 1000; // Convert to ms
      
      const testResult = {
        title: testName,
        status: 'passed',
        duration: duration
      };

      // Check if this test has failures
      const testEndIndex = xmlContent.indexOf('</testcase>', match.index);
      const testContent = xmlContent.substring(match.index, testEndIndex);
      
      if (failureRegex.test(testContent)) {
        testResult.status = 'failed';
        results.numFailedTests++;
      } else {
        results.numPassedTests++;
      }

      results.testResults.push(testResult);
      results.numTotalTests++;
    }

    return results;
  }

  aggregateResults(platform, testType, results) {
    const platformResults = this.matrix.platforms[platform].testResults[testType];
    
    // Handle different result formats
    if (results.testResults) {
      // Jest/Playwright format
      platformResults.total += results.numTotalTests || results.testResults.length;
      platformResults.passed += results.numPassedTests || 
        results.testResults.filter(t => t.status === 'passed' || t.status === 'ok').length;
      platformResults.failed += results.numFailedTests || 
        results.testResults.filter(t => t.status === 'failed' || t.status === 'timedOut').length;
    } else if (results.suites) {
      // Playwright format
      for (const suite of results.suites) {
        this.processSuite(suite, platformResults);
      }
    } else if (results.tests) {
      // Custom format
      platformResults.total += results.tests.length;
      platformResults.passed += results.tests.filter(t => t.passed).length;
      platformResults.failed += results.tests.filter(t => !t.passed).length;
    }

    // Calculate status
    if (platformResults.total > 0) {
      const passRate = platformResults.passed / platformResults.total;
      platformResults.coverage = Math.round(passRate * 100);
      
      if (passRate >= 0.9) {
        platformResults.status = 'excellent';
      } else if (passRate >= 0.8) {
        platformResults.status = 'good';
      } else if (passRate >= 0.6) {
        platformResults.status = 'fair';
      } else {
        platformResults.status = 'poor';
      }
    }

    // Update summary
    this.matrix.summary.totalTests += platformResults.total;
    this.matrix.summary.passedTests += platformResults.passed;
    this.matrix.summary.failedTests += platformResults.failed;
  }

  processSuite(suite, platformResults) {
    for (const spec of suite.specs || []) {
      platformResults.total++;
      
      const hasPassed = spec.tests?.some(test => test.results?.some(result => result.status === 'passed'));
      const hasFailed = spec.tests?.some(test => test.results?.some(result => result.status === 'failed'));
      
      if (hasPassed && !hasFailed) {
        platformResults.passed++;
      } else if (hasFailed) {
        platformResults.failed++;
      }
    }
  }

  async processBrowserResults(platform) {
    this.matrix.platforms[platform].browserSupport = {};
    
    for (const browser of this.browsers) {
      const browserFiles = this.findResultFiles(platform, 'e2e')
        .filter(f => f.includes(browser));
      
      if (browserFiles.length > 0) {
        let totalTests = 0;
        let passedTests = 0;
        
        for (const file of browserFiles) {
          try {
            const results = await this.parseResultFile(file);
            if (results.testResults) {
              totalTests += results.numTotalTests || results.testResults.length;
              passedTests += results.numPassedTests || 
                results.testResults.filter(t => t.status === 'passed').length;
            }
          } catch (error) {
            console.warn(`⚠️  Failed to parse browser result ${file}: ${error.message}`);
          }
        }
        
        this.matrix.platforms[platform].browserSupport[browser] = {
          supported: totalTests > 0,
          compatibility: totalTests > 0 ? Math.round((passedTests / totalTests) * 100) : 0,
          totalTests,
          passedTests
        };
      } else {
        this.matrix.platforms[platform].browserSupport[browser] = {
          supported: false,
          compatibility: 0,
          totalTests: 0,
          passedTests: 0
        };
      }
    }
  }

  calculatePlatformStatus(platform) {
    const platformData = this.matrix.platforms[platform];
    const testResults = platformData.testResults;
    
    let totalScore = 0;
    let testTypeCount = 0;
    
    for (const [testType, results] of Object.entries(testResults)) {
      if (results.total > 0) {
        const score = results.passed / results.total;
        totalScore += score;
        testTypeCount++;
      }
    }
    
    if (testTypeCount === 0) return 'unknown';
    
    const averageScore = totalScore / testTypeCount;
    
    if (averageScore >= 0.95) return 'excellent';
    if (averageScore >= 0.85) return 'good';
    if (averageScore >= 0.70) return 'fair';
    return 'poor';
  }

  generateCompatibilityAnalysis() {
    console.log('🔬 Generating compatibility analysis...');
    
    this.matrix.compatibility = {
      crossPlatform: {},
      browserSupport: {},
      featureMatrix: {}
    };

    // Cross-platform compatibility
    const platformStatuses = Object.values(this.matrix.platforms)
      .map(p => p.overallStatus);
    
    this.matrix.compatibility.crossPlatform = {
      allPlatformsSupported: platformStatuses.every(s => s !== 'poor'),
      consistentQuality: this.calculateConsistency(platformStatuses),
      recommendedPlatforms: Object.entries(this.matrix.platforms)
        .filter(([_, data]) => ['excellent', 'good'].includes(data.overallStatus))
        .map(([name, _]) => name)
    };

    // Browser support analysis
    const browserCompatibility = {};
    for (const browser of this.browsers) {
      const browserScores = Object.values(this.matrix.platforms)
        .map(p => p.browserSupport?.[browser]?.compatibility || 0);
      
      browserCompatibility[browser] = {
        averageCompatibility: Math.round(browserScores.reduce((a, b) => a + b, 0) / browserScores.length),
        supportedPlatforms: browserScores.filter(score => score > 0).length,
        recommended: browserScores.every(score => score >= 80)
      };
    }
    
    this.matrix.compatibility.browserSupport = browserCompatibility;

    // Feature matrix
    this.generateFeatureMatrix();
  }

  generateFeatureMatrix() {
    const features = [
      'audio_capture',
      'real_time_transcription',
      'speaker_identification',
      'chat_integration',
      'agenda_access',
      'file_export',
      'cloud_processing',
      'local_processing'
    ];

    this.matrix.compatibility.featureMatrix = {};

    for (const feature of features) {
      this.matrix.compatibility.featureMatrix[feature] = {};
      
      for (const platform of this.platforms) {
        // Determine feature support based on test results and platform capabilities
        const support = this.determineFeatureSupport(platform, feature);
        this.matrix.compatibility.featureMatrix[feature][platform] = support;
      }
    }
  }

  determineFeatureSupport(platform, feature) {
    // Platform-specific feature support logic
    const platformCapabilities = {
      teams: {
        audio_capture: 'full',
        real_time_transcription: 'full',
        speaker_identification: 'full',
        chat_integration: 'full',
        agenda_access: 'full',
        file_export: 'full',
        cloud_processing: 'full',
        local_processing: 'full'
      },
      zoom: {
        audio_capture: 'full',
        real_time_transcription: 'full',
        speaker_identification: 'full',
        chat_integration: 'full',
        agenda_access: 'limited',
        file_export: 'full',
        cloud_processing: 'full',
        local_processing: 'full'
      },
      meet: {
        audio_capture: 'full',
        real_time_transcription: 'full',
        speaker_identification: 'limited',
        chat_integration: 'none',
        agenda_access: 'full',
        file_export: 'full',
        cloud_processing: 'full',
        local_processing: 'full'
      },
      generic: {
        audio_capture: 'limited',
        real_time_transcription: 'full',
        speaker_identification: 'limited',
        chat_integration: 'none',
        agenda_access: 'none',
        file_export: 'full',
        cloud_processing: 'full',
        local_processing: 'full'
      }
    };

    return platformCapabilities[platform]?.[feature] || 'unknown';
  }

  calculateConsistency(values) {
    const statusScores = {
      'excellent': 4,
      'good': 3,
      'fair': 2,
      'poor': 1,
      'unknown': 0
    };

    const scores = values.map(v => statusScores[v] || 0);
    const average = scores.reduce((a, b) => a + b, 0) / scores.length;
    const variance = scores.reduce((acc, score) => acc + Math.pow(score - average, 2), 0) / scores.length;
    
    return variance < 0.5 ? 'high' : variance < 1.5 ? 'medium' : 'low';
  }

  generateRecommendations() {
    console.log('💡 Generating recommendations...');
    
    const recommendations = [];

    // Platform recommendations
    const poorPlatforms = Object.entries(this.matrix.platforms)
      .filter(([_, data]) => data.overallStatus === 'poor')
      .map(([name, _]) => name);

    if (poorPlatforms.length > 0) {
      recommendations.push({
        type: 'platform_improvement',
        priority: 'high',
        title: 'Improve Platform Support',
        description: `The following platforms need attention: ${poorPlatforms.join(', ')}`,
        platforms: poorPlatforms,
        actions: [
          'Review failed test cases',
          'Implement missing features',
          'Optimize performance',
          'Enhance error handling'
        ]
      });
    }

    // Browser compatibility recommendations
    const poorBrowsers = Object.entries(this.matrix.compatibility.browserSupport)
      .filter(([_, data]) => data.averageCompatibility < 80)
      .map(([name, _]) => name);

    if (poorBrowsers.length > 0) {
      recommendations.push({
        type: 'browser_compatibility',
        priority: 'medium',
        title: 'Improve Browser Compatibility',
        description: `Browser support needs improvement: ${poorBrowsers.join(', ')}`,
        browsers: poorBrowsers,
        actions: [
          'Test browser-specific features',
          'Add polyfills where needed',
          'Update browser support documentation'
        ]
      });
    }

    // Feature gap recommendations
    const featureGaps = this.identifyFeatureGaps();
    if (featureGaps.length > 0) {
      recommendations.push({
        type: 'feature_gaps',
        priority: 'medium',
        title: 'Address Feature Gaps',
        description: 'Some platforms are missing key features',
        gaps: featureGaps,
        actions: [
          'Implement missing features',
          'Provide alternative solutions',
          'Update feature documentation'
        ]
      });
    }

    // Performance recommendations
    const performanceIssues = this.identifyPerformanceIssues();
    if (performanceIssues.length > 0) {
      recommendations.push({
        type: 'performance',
        priority: 'medium',
        title: 'Optimize Performance',
        description: 'Performance improvements needed',
        issues: performanceIssues,
        actions: [
          'Profile slow operations',
          'Optimize algorithms',
          'Implement caching',
          'Reduce memory usage'
        ]
      });
    }

    this.matrix.recommendations = recommendations;
  }

  identifyFeatureGaps() {
    const gaps = [];
    const featureMatrix = this.matrix.compatibility.featureMatrix;

    for (const [feature, platformSupport] of Object.entries(featureMatrix)) {
      const unsupportedPlatforms = Object.entries(platformSupport)
        .filter(([_, support]) => support === 'none' || support === 'unknown')
        .map(([platform, _]) => platform);

      if (unsupportedPlatforms.length > 0) {
        gaps.push({
          feature,
          unsupportedPlatforms,
          impact: this.calculateFeatureImpact(feature)
        });
      }
    }

    return gaps;
  }

  calculateFeatureImpact(feature) {
    const criticalFeatures = ['audio_capture', 'real_time_transcription'];
    const importantFeatures = ['speaker_identification', 'chat_integration', 'file_export'];
    
    if (criticalFeatures.includes(feature)) return 'high';
    if (importantFeatures.includes(feature)) return 'medium';
    return 'low';
  }

  identifyPerformanceIssues() {
    const issues = [];
    
    // This would be populated from actual performance test results
    // For now, return empty array as placeholder
    
    return issues;
  }

  calculateMetrics() {
    const summary = this.matrix.summary;
    
    if (summary.totalTests > 0) {
      summary.coverage = Math.round((summary.passedTests / summary.totalTests) * 100);
    }

    // Calculate platform distribution
    const platformStatuses = Object.values(this.matrix.platforms)
      .map(p => p.overallStatus);
    
    summary.platformDistribution = {
      excellent: platformStatuses.filter(s => s === 'excellent').length,
      good: platformStatuses.filter(s => s === 'good').length,
      fair: platformStatuses.filter(s => s === 'fair').length,
      poor: platformStatuses.filter(s => s === 'poor').length
    };

    // Overall health score
    const weights = { excellent: 4, good: 3, fair: 2, poor: 1, unknown: 0 };
    const totalWeight = Object.entries(summary.platformDistribution)
      .reduce((acc, [status, count]) => acc + (weights[status] * count), 0);
    
    summary.healthScore = Math.round((totalWeight / (this.platforms.length * 4)) * 100);
  }

  async writeMatrixFiles() {
    console.log('📝 Writing matrix files...');
    
    // Write main matrix JSON
    const matrixPath = path.join(this.outputDir, 'matrix.json');
    fs.writeFileSync(matrixPath, JSON.stringify(this.matrix, null, 2));

    // Write HTML report
    await this.generateHTMLReport();
    
    // Write CSV summary
    await this.generateCSVSummary();
    
    // Write markdown report
    await this.generateMarkdownReport();
  }

  async generateHTMLReport() {
    const htmlTemplate = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Cross-Platform Compatibility Matrix</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .header { background: #f5f5f5; padding: 20px; border-radius: 8px; margin-bottom: 20px; }
        .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin-bottom: 30px; }
        .metric { background: white; border: 1px solid #ddd; padding: 15px; border-radius: 8px; text-align: center; }
        .metric-value { font-size: 2em; font-weight: bold; color: #2196F3; }
        .platform-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; margin-bottom: 30px; }
        .platform-card { border: 1px solid #ddd; border-radius: 8px; padding: 20px; }
        .status-excellent { border-left: 5px solid #4CAF50; }
        .status-good { border-left: 5px solid #8BC34A; }
        .status-fair { border-left: 5px solid #FF9800; }
        .status-poor { border-left: 5px solid #F44336; }
        .feature-matrix { width: 100%; border-collapse: collapse; margin-top: 20px; }
        .feature-matrix th, .feature-matrix td { border: 1px solid #ddd; padding: 8px; text-align: center; }
        .feature-matrix th { background: #f5f5f5; }
        .support-full { background: #4CAF50; color: white; }
        .support-limited { background: #FF9800; color: white; }
        .support-none { background: #F44336; color: white; }
        .recommendations { background: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 8px; margin-top: 20px; }
    </style>
</head>
<body>
    <div class="header">
        <h1>Cross-Platform Compatibility Matrix</h1>
        <p>Generated: ${this.matrix.generated}</p>
        <p>Overall Health Score: <strong>${this.matrix.summary.healthScore}%</strong></p>
    </div>

    <div class="summary">
        <div class="metric">
            <div class="metric-value">${this.matrix.summary.totalTests}</div>
            <div>Total Tests</div>
        </div>
        <div class="metric">
            <div class="metric-value">${this.matrix.summary.passedTests}</div>
            <div>Passed Tests</div>
        </div>
        <div class="metric">
            <div class="metric-value">${this.matrix.summary.coverage}%</div>
            <div>Test Coverage</div>
        </div>
        <div class="metric">
            <div class="metric-value">${Object.keys(this.matrix.platforms).length}</div>
            <div>Platforms</div>
        </div>
    </div>

    <h2>Platform Status</h2>
    <div class="platform-grid">
        ${Object.entries(this.matrix.platforms).map(([name, data]) => `
            <div class="platform-card status-${data.overallStatus}">
                <h3>${name.toUpperCase()}</h3>
                <p><strong>Status:</strong> ${data.overallStatus}</p>
                <div>
                    ${Object.entries(data.testResults).map(([testType, results]) => `
                        <div>${testType}: ${results.passed}/${results.total} (${results.coverage}%)</div>
                    `).join('')}
                </div>
            </div>
        `).join('')}
    </div>

    <h2>Feature Support Matrix</h2>
    <table class="feature-matrix">
        <thead>
            <tr>
                <th>Feature</th>
                ${this.platforms.map(p => `<th>${p.toUpperCase()}</th>`).join('')}
            </tr>
        </thead>
        <tbody>
            ${Object.entries(this.matrix.compatibility.featureMatrix).map(([feature, platforms]) => `
                <tr>
                    <td><strong>${feature.replace(/_/g, ' ')}</strong></td>
                    ${this.platforms.map(platform => {
                        const support = platforms[platform] || 'unknown';
                        return `<td class="support-${support}">${support}</td>`;
                    }).join('')}
                </tr>
            `).join('')}
        </tbody>
    </table>

    ${this.matrix.recommendations.length > 0 ? `
        <div class="recommendations">
            <h2>Recommendations</h2>
            ${this.matrix.recommendations.map(rec => `
                <div style="margin-bottom: 15px;">
                    <h4>${rec.title} (${rec.priority} priority)</h4>
                    <p>${rec.description}</p>
                    <ul>
                        ${rec.actions.map(action => `<li>${action}</li>`).join('')}
                    </ul>
                </div>
            `).join('')}
        </div>
    ` : ''}
</body>
</html>`;

    const htmlPath = path.join(this.outputDir, 'compatibility-report.html');
    fs.writeFileSync(htmlPath, htmlTemplate);
  }

  async generateCSVSummary() {
    const csvRows = [
      ['Platform', 'Status', 'Total Tests', 'Passed Tests', 'Coverage %', 'Integration', 'E2E', 'Performance', 'Accessibility', 'Security']
    ];

    for (const [platform, data] of Object.entries(this.matrix.platforms)) {
      const row = [
        platform,
        data.overallStatus,
        Object.values(data.testResults).reduce((sum, r) => sum + r.total, 0),
        Object.values(data.testResults).reduce((sum, r) => sum + r.passed, 0),
        Math.round(Object.values(data.testResults).reduce((sum, r) => sum + r.coverage, 0) / this.testTypes.length),
        data.testResults.integration?.status || 'not_run',
        data.testResults.e2e?.status || 'not_run',
        data.testResults.performance?.status || 'not_run',
        data.testResults.accessibility?.status || 'not_run',
        data.testResults.security?.status || 'not_run'
      ];
      csvRows.push(row);
    }

    const csvContent = csvRows.map(row => row.join(',')).join('\n');
    const csvPath = path.join(this.outputDir, 'compatibility-summary.csv');
    fs.writeFileSync(csvPath, csvContent);
  }

  async generateMarkdownReport() {
    const markdown = `# Cross-Platform Compatibility Matrix

Generated: ${this.matrix.generated}

## Summary

- **Total Tests:** ${this.matrix.summary.totalTests}
- **Passed Tests:** ${this.matrix.summary.passedTests}
- **Test Coverage:** ${this.matrix.summary.coverage}%
- **Health Score:** ${this.matrix.summary.healthScore}%

## Platform Status

| Platform | Status | Integration | E2E | Performance | Accessibility | Security |
|----------|--------|-------------|-----|-------------|---------------|----------|
${Object.entries(this.matrix.platforms).map(([platform, data]) => {
  const getStatus = (testType) => {
    const result = data.testResults[testType];
    if (!result || result.total === 0) return '❌';
    return result.coverage >= 80 ? '✅' : result.coverage >= 60 ? '⚠️' : '❌';
  };
  
  return `| ${platform} | ${data.overallStatus} | ${getStatus('integration')} | ${getStatus('e2e')} | ${getStatus('performance')} | ${getStatus('accessibility')} | ${getStatus('security')} |`;
}).join('\n')}

## Feature Support Matrix

| Feature | Teams | Zoom | Meet | Generic |
|---------|-------|------|------|---------|
${Object.entries(this.matrix.compatibility.featureMatrix).map(([feature, platforms]) => {
  const getIcon = (support) => {
    switch(support) {
      case 'full': return '✅';
      case 'limited': return '⚠️';
      case 'none': return '❌';
      default: return '❓';
    }
  };
  
  return `| ${feature.replace(/_/g, ' ')} | ${getIcon(platforms.teams)} | ${getIcon(platforms.zoom)} | ${getIcon(platforms.meet)} | ${getIcon(platforms.generic)} |`;
}).join('\n')}

## Browser Compatibility

| Browser | Average Compatibility | Supported Platforms | Recommended |
|---------|----------------------|-------------------|-------------|
${Object.entries(this.matrix.compatibility.browserSupport).map(([browser, data]) => 
  `| ${browser} | ${data.averageCompatibility}% | ${data.supportedPlatforms}/4 | ${data.recommended ? '✅' : '❌'} |`
).join('\n')}

${this.matrix.recommendations.length > 0 ? `
## Recommendations

${this.matrix.recommendations.map(rec => `
### ${rec.title} (${rec.priority} priority)

${rec.description}

**Actions:**
${rec.actions.map(action => `- ${action}`).join('\n')}
`).join('\n')}
` : ''}

---
*Report generated by Cross-Platform Testing Pipeline*`;

    const markdownPath = path.join(this.outputDir, 'compatibility-report.md');
    fs.writeFileSync(markdownPath, markdown);
  }
}

// CLI interface
if (require.main === module) {
  const args = process.argv.slice(2);
  const inputDir = args.find(arg => arg.startsWith('--input-dir='))?.split('=')[1] || 'test-artifacts';
  const outputDir = args.find(arg => arg.startsWith('--output-dir='))?.split('=')[1] || 'compatibility-reports';

  const generator = new CompatibilityMatrixGenerator(inputDir, outputDir);
  
  generator.generate()
    .then(() => {
      console.log('✅ Compatibility matrix generation completed');
      process.exit(0);
    })
    .catch(error => {
      console.error('❌ Failed to generate compatibility matrix:', error);
      process.exit(1);
    });
}

module.exports = CompatibilityMatrixGenerator;