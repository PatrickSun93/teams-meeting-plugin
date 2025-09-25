#!/usr/bin/env node
// Test suite validation script
const fs = require('fs');
const path = require('path');

const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

const log = (message, color = 'reset') => {
  console.log(`${colors[color]}${message}${colors.reset}`);
};

const checkFileExists = (filePath) => {
  return fs.existsSync(filePath);
};

const countTestFiles = (directory) => {
  if (!fs.existsSync(directory)) return 0;
  
  let count = 0;
  const files = fs.readdirSync(directory, { withFileTypes: true });
  
  for (const file of files) {
    if (file.isDirectory()) {
      count += countTestFiles(path.join(directory, file.name));
    } else if (file.name.includes('.test.') || file.name.includes('.spec.')) {
      count++;
    }
  }
  
  return count;
};

const validateTestSuite = () => {
  log('🔍 Validating Test Suite Configuration', 'cyan');
  log('=====================================', 'cyan');

  const validationResults = [];

  // Check core test configuration files
  const configFiles = [
    'jest.config.js',
    'playwright.config.js',
    '.github/workflows/test.yml',
    'src/setupTests.js'
  ];

  log('\n📁 Configuration Files:', 'blue');
  configFiles.forEach(file => {
    const exists = checkFileExists(file);
    const status = exists ? '✅' : '❌';
    const color = exists ? 'green' : 'red';
    log(`${status} ${file}`, color);
    validationResults.push({ type: 'config', file, exists });
  });

  // Check test utility files
  const utilityFiles = [
    'tests/utils/test-helpers.js',
    'tests/utils/test-setup.js',
    'tests/utils/integration-setup.js',
    'tests/utils/performance-setup.js',
    'tests/utils/accessibility-setup.js',
    'tests/utils/security-setup.js',
    'tests/utils/global-setup.js',
    'tests/utils/global-teardown.js'
  ];

  log('\n🛠️  Test Utility Files:', 'blue');
  utilityFiles.forEach(file => {
    const exists = checkFileExists(file);
    const status = exists ? '✅' : '❌';
    const color = exists ? 'green' : 'red';
    log(`${status} ${file}`, color);
    validationResults.push({ type: 'utility', file, exists });
  });

  // Check test directories and count files
  const testDirectories = [
    { path: 'src/client/components/__tests__', type: 'Unit Tests (Components)' },
    { path: 'src/client/services/__tests__', type: 'Unit Tests (Services)' },
    { path: 'tests/integration', type: 'Integration Tests' },
    { path: 'tests/e2e', type: 'End-to-End Tests' },
    { path: 'tests/performance', type: 'Performance Tests' },
    { path: 'tests/accessibility', type: 'Accessibility Tests' },
    { path: 'tests/security', type: 'Security Tests' }
  ];

  log('\n📊 Test File Counts:', 'blue');
  let totalTests = 0;
  testDirectories.forEach(dir => {
    const count = countTestFiles(dir.path);
    totalTests += count;
    const status = count > 0 ? '✅' : '⚠️';
    const color = count > 0 ? 'green' : 'yellow';
    log(`${status} ${dir.type}: ${count} files`, color);
    validationResults.push({ type: 'testDir', path: dir.path, count, name: dir.type });
  });

  // Check package.json test scripts
  const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  const requiredScripts = [
    'test',
    'test:unit',
    'test:integration',
    'test:e2e',
    'test:performance',
    'test:accessibility',
    'test:security',
    'test:all',
    'test:coverage'
  ];

  log('\n📜 Package.json Test Scripts:', 'blue');
  requiredScripts.forEach(script => {
    const exists = packageJson.scripts && packageJson.scripts[script];
    const status = exists ? '✅' : '❌';
    const color = exists ? 'green' : 'red';
    log(`${status} ${script}`, color);
    validationResults.push({ type: 'script', script, exists });
  });

  // Check required dependencies
  const requiredDevDeps = [
    '@testing-library/jest-dom',
    '@testing-library/react',
    '@testing-library/user-event',
    'jest',
    'jest-environment-jsdom',
    'jest-axe',
    'playwright',
    'jest-junit',
    'jest-html-reporters'
  ];

  log('\n📦 Required Dependencies:', 'blue');
  requiredDevDeps.forEach(dep => {
    const exists = packageJson.devDependencies && packageJson.devDependencies[dep];
    const status = exists ? '✅' : '❌';
    const color = exists ? 'green' : 'red';
    log(`${status} ${dep}`, color);
    validationResults.push({ type: 'dependency', dependency: dep, exists });
  });

  // Generate summary
  log('\n📋 Validation Summary:', 'cyan');
  log('====================', 'cyan');

  const configIssues = validationResults.filter(r => r.type === 'config' && !r.exists).length;
  const utilityIssues = validationResults.filter(r => r.type === 'utility' && !r.exists).length;
  const scriptIssues = validationResults.filter(r => r.type === 'script' && !r.exists).length;
  const depIssues = validationResults.filter(r => r.type === 'dependency' && !r.exists).length;
  const emptyTestDirs = validationResults.filter(r => r.type === 'testDir' && r.count === 0).length;

  log(`Total Test Files: ${totalTests}`, totalTests > 0 ? 'green' : 'red');
  log(`Configuration Issues: ${configIssues}`, configIssues === 0 ? 'green' : 'red');
  log(`Utility File Issues: ${utilityIssues}`, utilityIssues === 0 ? 'green' : 'red');
  log(`Script Issues: ${scriptIssues}`, scriptIssues === 0 ? 'green' : 'red');
  log(`Dependency Issues: ${depIssues}`, depIssues === 0 ? 'green' : 'red');
  log(`Empty Test Directories: ${emptyTestDirs}`, emptyTestDirs === 0 ? 'green' : 'yellow');

  const totalIssues = configIssues + utilityIssues + scriptIssues + depIssues;

  if (totalIssues === 0 && totalTests > 0) {
    log('\n🎉 Test suite validation passed! All components are properly configured.', 'green');
    return true;
  } else {
    log('\n⚠️  Test suite validation found issues. Please review the results above.', 'yellow');
    if (totalTests === 0) {
      log('❌ No test files found! Please ensure tests are created.', 'red');
    }
    return false;
  }
};

// Run validation
const isValid = validateTestSuite();
process.exit(isValid ? 0 : 1);