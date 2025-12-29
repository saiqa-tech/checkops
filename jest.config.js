export default {
  testEnvironment: 'node',

  // Parallel execution for faster testing (unit tests)
  // Integration tests use separate script with --runInBand
  maxWorkers: process.env.CI ? 1 : 4,

  // Increased timeout for integration tests
  testTimeout: 15000,

  // Coverage thresholds aligned with Critical Path First strategy
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
    './src/utils/optionUtils.js': {
      branches: 90,
      functions: 90,
      lines: 90,
      statements: 90,
    },
    './src/services/FormService.js': {
      branches: 85,
      functions: 85,
      lines: 85,
      statements: 85,
    },
    './src/services/QuestionService.js': {
      branches: 85,
      functions: 85,
      lines: 85,
      statements: 85,
    },
    './src/services/SubmissionService.js': {
      branches: 85,
      functions: 85,
      lines: 85,
      statements: 85,
    },
  },

  collectCoverageFrom: [
    'src/**/*.js',
    'checkops-power/lib/**/*.js',
    '!src/index.js',
    '!checkops-power/checkops-mcp-server.js',
    '!checkops-power/setup.js',
  ],

  testMatch: [
    '**/tests/**/*.test.js',
  ],

  transform: {},
};
