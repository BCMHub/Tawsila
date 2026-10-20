const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');
module.exports = defineConfig([expoConfig, { ignores: ['dist/*', 'coverage/*'] }, { files: ['src/__tests__/**/*'], languageOptions: { globals: { jest: 'readonly', test: 'readonly', expect: 'readonly' } } }]);
