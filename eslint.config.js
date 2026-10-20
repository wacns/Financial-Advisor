import hooks from "eslint-plugin-react-hooks";
import tseslint from "typescript-eslint";
const correctness = {
  "no-unreachable": "error",
  "no-dupe-keys": "error",
};
export default [
  {
    ignores: [
      "node_modules/**",
      "dist/**",
      "dist-native/**",
      "desktop/web/**",
      "desktop/node_modules/**",
      "desktop/*.cjs",
      "release-desktop/**",
      ".baseline/**",
      ".superpowers/**",
      "android/**",
      "ios/**",
      "public/ocr/**",
      "playwright-report/**",
      "test-results/**",
    ],
  },
  {
    files: ["src/**/*.{js,jsx}"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      parserOptions: { ecmaFeatures: { jsx: true } },
      globals: {
        process: "readonly",
        window: "readonly",
        document: "readonly",
        location: "readonly",
        history: "readonly",
        localStorage: "readonly",
        URL: "readonly",
        URLSearchParams: "readonly",
        Blob: "readonly",
        FileReader: "readonly", atob: "readonly",
        crypto: "readonly",
        setTimeout: "readonly",
        clearTimeout: "readonly",
      },
    },
    plugins: { "react-hooks": hooks },
    rules: {
      ...correctness,
      "no-undef": "error",
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "error",
    },
  },
  {
    files: ["**/*.{js,mjs,cjs}"],
    ignores: ["src/**"],
    languageOptions: { ecmaVersion: "latest" },
    rules: correctness,
  },
  {
    files: ["**/*.cjs"],
    languageOptions: { sourceType: "commonjs" },
  },
  {
    files: ["**/*.{ts,tsx,mts,cts}"],
    // Task 10 brings the Supabase functions under the escape-hatch rules.
    ignores: ["supabase/functions/**"],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    plugins: { "react-hooks": hooks, "@typescript-eslint": tseslint.plugin },
    rules: {
      ...correctness,
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "error",
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-non-null-assertion": "error",
      "@typescript-eslint/ban-ts-comment": "error",
      "@typescript-eslint/consistent-type-assertions": ["error", { assertionStyle: "never" }],
    },
  },
];
