// Jest configuration for comprehensive testing
module.exports = {
  // Test environment
  testEnvironment: 'jsdom',
  
  // Setup files
  setupFilesAfterEnv: [
    '<rootDir>/src/setupTests.js',
    '<rootDir>/tests/utils/test-setup.js'
  ],
  
  // Transform configuration
  transform: {
    '^.+\\.(js|jsx)$': 'babel-jest'
  },
  
  // Module name mapping
  moduleNameMapper: {
    '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@tests/(.*)$': '<rootDir>/tests/$1'
  },
  
  // Transform ignore patterns
  transformIgnorePatterns: [
    'node_modules/(?!(@xenova/transformers|@microsoft/teams-js)/)'
  ],
  
  // Test match patterns
  testMatch: [
    '<rootDir>/src/**/__tests__/**/*.{js,jsx}',
    '<rootDir>/src/**/*.{test,spec}.{js,jsx}',
    '<rootDir>/tests/**/*.{test,spec}.{js,jsx}'
  ],
  
  // Coverage configuration
  collectCoverageFrom: [
    'src/**/*.{js,jsx}',
    '!src/**/*.test.{js,jsx}',
    '!src/setupTests.js',
    '!src/client/build/**',
    '!src/server/index.js'
  ],
  
  // Coverage thresholds
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    },
    './src/client/services/': {
      branches: 85,
      functions: 85,
      lines: 85,
      statements: 85
    },
    './src/client/components/': {
      branches: 75,
      functions: 75,
      lines: 75,
      statements: 75
    }
  },
  
  // Coverage reporters
  coverageReporters: [
    'text',
    'lcov',
    'html',
    'json-summary'
  ],
  
  // Test timeout (moved to individual project configs)
  
  // Projects for different test types
  projects: [
    {
      displayName: 'unit',
      testMatch: [
        '<rootDir>/src/**/__tests__/**/*.{js,jsx}',
        '<rootDir>/src/**/*.{test,spec}.{js,jsx}'
      ],
      testPathIgnorePatterns: [
        'integration',
        'performance',
        'accessibility',
        'security'
      ],
      testTimeout: 30000
    },
    {
      displayName: 'integration',
      testMatch: [
        '<rootDir>/tests/integration/**/*.{test,spec}.{js,jsx}',
        '<rootDir>/src/**/*.integration.{test,spec}.{js,jsx}'
      ],
      setupFilesAfterEnv: [
        '<rootDir>/src/setupTests.js',
        '<rootDir>/tests/utils/integration-setup.js'
      ]
    },
    {
      displayName: 'performance',
      testMatch: [
        '<rootDir>/tests/performance/**/*.{test,spec}.{js,jsx}'
      ],
      setupFilesAfterEnv: [
        '<rootDir>/src/setupTests.js',
        '<rootDir>/tests/utils/performance-setup.js'
      ],
      testTimeout: 60000
    },
    {
      displayName: 'accessibility',
      testMatch: [
        '<rootDir>/tests/accessibility/**/*.{test,spec}.{js,jsx}'
      ],
      setupFilesAfterEnv: [
        '<rootDir>/src/setupTests.js',
        '<rootDir>/tests/utils/accessibility-setup.js'
      ]
    },
    {
      displayName: 'security',
      testMatch: [
        '<rootDir>/tests/security/**/*.{test,spec}.{js,jsx}'
      ],
      setupFilesAfterEnv: [
        '<rootDir>/src/setupTests.js',
        '<rootDir>/tests/utils/security-setup.js'
      ]
    }
  ],
  
  // Global setup and teardown
  globalSetup: '<rootDir>/tests/utils/global-setup.js',
  globalTeardown: '<rootDir>/tests/utils/global-teardown.js',
  
  // Reporters
  reporters: [
    'default',
    [
      'jest-junit',
      {
        outputDirectory: './test-results',
        outputName: 'junit.xml'
      }
    ],
    [
      'jest-html-reporters',
      {
        publicPath: './test-results',
        filename: 'report.html',
        expand: true
      }
    ]
  ],
  
  // Watch plugins
  watchPlugins: [
    'jest-watch-typeahead/filename',
    'jest-watch-typeahead/testname'
  ],
  
  // Verbose output
  verbose: true,
  
  // Clear mocks between tests
  clearMocks: true,
  
  // Restore mocks after each test
  restoreMocks: true
};