// Global teardown for all tests
module.exports = async () => {
  console.log('Tearing down test environment...');
  
  // Cleanup test databases or external services
  // This is where you would cleanup test databases, stop mock servers, etc.
  
  // Generate test summary report
  if (process.env.GENERATE_TEST_REPORT) {
    console.log('Generating test summary report...');
    // Add test report generation logic here
  }
  
  console.log('Test environment teardown complete');
};