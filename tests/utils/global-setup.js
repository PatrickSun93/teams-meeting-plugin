// Global setup for all tests
module.exports = async () => {
  console.log('Setting up test environment...');
  
  // Set test environment variables
  process.env.NODE_ENV = 'test';
  process.env.REACT_APP_ENV = 'test';
  
  // Disable console logs in tests unless explicitly enabled
  if (!process.env.VERBOSE_TESTS) {
    const noop = () => {};
    console.log = noop;
    console.info = noop;
  }
  
  // Setup test database or external services if needed
  // This is where you would initialize test databases, start mock servers, etc.
  
  console.log('Test environment setup complete');
};