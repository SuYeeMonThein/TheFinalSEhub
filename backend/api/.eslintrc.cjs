module.exports = {
  root: true,
  env: {
    node: true,
    es2021: true
  },
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2021,
    sourceType: 'module'
  },
  plugins: ['@typescript-eslint'],
  extends: ['eslint:recommended', 'plugin:@typescript-eslint/recommended'],
  ignorePatterns: ['lib', 'coverage', 'node_modules'],
  rules: {
    '@typescript-eslint/explicit-module-boundary-types': 'off'
  }
};
