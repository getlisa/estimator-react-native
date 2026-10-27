// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  { ignores: ['dist/*', '.expo/*', 'node_modules/*'] },
  {
    rules: {
      // RN <Text> renders quotes fine; escaping them in prose hurts readability.
      'react/no-unescaped-entities': 'off',
      // Fetch-on-mount effects set loading/data state; the compiler bails out safely on these.
      'react-hooks/set-state-in-effect': 'off',
    },
  },
]);
