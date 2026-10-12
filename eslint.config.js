// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require("eslint-config-expo/flat");

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ["dist/*"],
  },
  {
    // Vendored (see its README): Reanimated shared value writes read as mutations to the React Compiler rules.
    files: ["src/lib/dynamic-island/**"],
    rules: {
      "react/display-name": "off",
      "react-hooks/immutability": "off",
      "react-hooks/refs": "off",
    },
  },
]);
