#!/usr/bin/env node
// Comprehensive test runner script
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

const log = (message, color = 'reset') => {
  console.log(`${colors[color]}${message}${colors.reset}`);
};

const runCommand = (command, description) => {
  log(`\n🔄 ${description}...`, 'blue');
  try {
    const output = execSync(command, { 
      stdio: 'inherit',
      encoding: 'utf8'
    });
    log(`✅ ${description} completed successfully`, 'green');
    return { success: true, output };
  } catch (error) {
    log(`❌ ${description} failed`, 'red');
    return { success: false, error: error.message };
  }
};

const generateTestReport = (results) => {
  const reportDir = './test-results';
  if (!fs.existsSync(reportDir)) {
    fs.mkdirSync(reportDir, { recursive: true });
  }

  const report = {
    timestamp: new Date().toISOString(),
    summary: {
      total: results.length,
      passed: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length
    },
    results: results
  };

  const reportPath = path.join(reportDir, 'comprehensive-test-report.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  
  log(`\n📊 Test report generated: ${reportPath}`, 'cyan');
  return report;
};

const main = async () => {
  log('🚀 Starting Comprehensive Test Suite', 'magenta');
  log('=====================================', 'magenta');

  const testSuites = [
    {
      name: 'Linting and Formatting',
      command: 'npm run lint && npm run format -- --check',
      description: 'Code quality checks'
    },
    {
      name: 'Unit Tests',
      command: 'npm run test:unit -- --run',
      description: 'Unit test suite'
    },
    {
      name: 'Integration Tests',
      command: 'npm run test:integration -- --run',
      description: 'Integration test suite'
    },
    {
      name: 'Performance Tests',
      command: 'npm run test:performance -- --run',
      description: 'Performance test suite'
    },
    {
      name: 'Accessibility Tests',
      command: 'npm run test:accessibility -- --run',
      description: 'Accessibility test suite'
    },
    {
      name: 'Security Tests',
      command: 'npm run test:security -- --run',
      description: 'Security test suite'
    },
    {
      name: 'Build Verification',
      command: 'npm run build',
      description: 'Production build verification'
    },
    {
      name: 'Package Creation',
      command: 'npm run package:teams',
      description: 'Teams app package creation'
    }
  ];

  const results = [];
  let overallSuccess = true;

  for (const suite of testSuites) {
    const result = runCommand(suite.command, suite.description);
    results.push({
      name: suite.name,
      description: suite.description,
      command: suite.command,
      ...result
    });

    if (!result.success) {
      overallSuccess = false;
    }
  }

  // Generate comprehensive report
  const report = generateTestReport(results);

  // Print summary
  log('\n📋 Test Suite Summary', 'cyan');
  log('====================', 'cyan');
  
  results.forEach(result => {
    const status = result.success ? '✅' : '❌';
    const color = result.success ? 'green' : 'red';
    log(`${status} ${result.name}`, color);
  });

  log(`\n📊 Overall Results:`, 'cyan');
  log(`   Total Suites: ${report.summary.total}`, 'blue');
  log(`   Passed: ${report.summary.passed}`, 'green');
  log(`   Failed: ${report.summary.failed}`, report.summary.failed > 0 ? 'red' : 'green');

  if (overallSuccess) {
    log('\n🎉 All test suites passed successfully!', 'green');
    process.exit(0);
  } else {
    log('\n💥 Some test suites failed. Please check the results above.', 'red');
    process.exit(1);
  }
};

// Handle command line arguments
const args = process.argv.slice(2);
if (args.includes('--help') || args.includes('-h')) {
  log('Comprehensive Test Runner', 'cyan');
  log('Usage: node scripts/run-comprehensive-tests.js [options]', 'blue');
  log('Options:', 'blue');
  log('  --help, -h     Show this help message', 'blue');
  log('  --verbose      Enable verbose output', 'blue');
  log('  --report-only  Generate report from existing results', 'blue');
  process.exit(0);
}

if (args.includes('--verbose')) {
  process.env.VERBOSE_TESTS = 'true';
}

if (args.includes('--report-only')) {
  log('📊 Generating report from existing results...', 'cyan');
  // Logic to generate report from existing test results
  process.exit(0);
}

// Run the main function
main().catch(error => {
  log(`💥 Unexpected error: ${error.message}`, 'red');
  process.exit(1);
});