// Global test setup for all test types
import { setupTestEnvironment, cleanupTestData } from './test-helpers';

// Setup test environment before each test
beforeEach(() => {
  setupTestEnvironment();
});

// Cleanup after each test
afterEach(() => {
  cleanupTestData();
});

// Global error handler for unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Increase timeout for async operations
jest.setTimeout(30000);

// Mock console methods to reduce noise in tests
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;

console.error = (...args) => {
  // Filter out known React warnings in tests
  if (args[0]?.includes?.('Warning: ReactDOM.render is no longer supported')) {
    return;
  }
  if (args[0]?.includes?.('Warning: React.createElement: type is invalid')) {
    return;
  }
  originalConsoleError(...args);
};

console.warn = (...args) => {
  // Filter out known warnings
  if (args[0]?.includes?.('componentWillReceiveProps has been renamed')) {
    return;
  }
  originalConsoleWarn(...args);
};