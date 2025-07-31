// Test setup file
process.env.NODE_ENV = 'test';
process.env.MOCK_SYNAPSE = 'true';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test_db';

// Suppress console.log during tests unless running with --verbose
if (!process.argv.includes('--verbose')) {
  console.log = jest.fn();
}