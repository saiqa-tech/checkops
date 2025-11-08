export default {
  testEnvironment: 'node',
  coverageThreshold: {
    global: {
      branches: 35,
      functions: 37,
      lines: 27,
      statements: 27,
    },
  },
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/index.js',
  ],
  testMatch: [
    '**/tests/**/*.test.js',
  ],
  transform: {},
};
