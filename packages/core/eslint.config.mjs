import { defineConfig, globalIgnores } from "eslint/config";
import tseslint from "typescript-eslint";

/** Core stays framework-free: no React, React DOM, React Native, Next or Expo imports. */
const FRAMEWORKS = ["react", "react-*", "react/*", "react-dom", "react-dom/*", "react-native", "react-native/*", "next", "next/*", "expo", "expo-*", "@react-native-*/*"];

export default defineConfig([
  ...tseslint.configs.recommended,
  {
    rules: {
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
      "no-restricted-imports": ["error", { paths: [{ name: "zustand", message: "Use zustand/vanilla in core; each app binds it to React." }], patterns: [{ group: FRAMEWORKS, message: "packages/core must stay framework-free (zustand/vanilla is fine)." }] }],
    },
  },
  globalIgnores(["node_modules/**"]),
]);
