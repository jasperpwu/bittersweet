/* eslint-env node */
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    // `desktop/` is a separate project with its own toolchain and tsconfig; it
    // is typechecked by `cd desktop && npx tsc --noEmit`, not from here.
    // `shared/` is deliberately NOT ignored — it compiles into this app too.
    ignores: ['dist/*', 'desktop/*'],
  },
  {
    rules: {
      'react/display-name': 'off',
    },
  },
]);
