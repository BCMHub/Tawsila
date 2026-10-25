module.exports = {
  preset: 'jest-expo',
  testEnvironment: '<rootDir>/src/__integration__/nodeEnvironment.cjs',
  setupFilesAfterEnv: ['<rootDir>/src/__integration__/setup.cjs'],
  testMatch: ['**/src/__integration__/**/*.integration.test.ts?(x)'],
  testTimeout: 30000,
};
