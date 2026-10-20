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
      "desktop/*.d.cts",
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
    files: ["**/*.{ts,tsx,mts,cts}"],
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
