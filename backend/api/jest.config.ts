import type { Config } from 'jest';

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.test.ts'],
  moduleFileExtensions: ['ts', 'js', 'json'],
  collectCoverageFrom: ['<rootDir>/src/**/*.{ts,tsx}', '!<rootDir>/src/**/*.d.ts'],
  coverageDirectory: '<rootDir>/coverage',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts']
};

export default config;
