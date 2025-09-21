/**
 * Global Jest Teardown
 * Runs once after all tests
 */

module.exports = async () => {
  console.log('🧹 Cleaning up test environment...');

  // Close database connections
  if (global.__TEST_DB_POOL__ && !global.__IN_MEMORY_TEST__) {
    try {
      await global.__TEST_DB_POOL__.end();
      console.log('✅ Test database connections closed');
    } catch (error) {
      console.warn('⚠️ Error closing test database:', error.message);
    }
  }

  // Clean up global test data
  if (global.__TEST_DATA__) {
    delete global.__TEST_DATA__;
  }

  // Clean up other global test resources
  delete global.__TEST_DB_POOL__;
  delete global.__IN_MEMORY_TEST__;

  console.log('✅ Test environment cleaned up');
};