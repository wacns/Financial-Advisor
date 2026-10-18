import hooks from "eslint-plugin-react-hooks";
export default [
  {
    files: ["src/**/*.js", "src/**/*.jsx"],
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
        Blob: "readonly",
        FileReader: "readonly", atob: "readonly",
        crypto: "readonly",
        setTimeout: "readonly",
        clearTimeout: "readonly",
      },
    },
    plugins: { "react-hooks": hooks },
    rules: {
      "no-undef": "error",
      "no-unreachable": "error",
      "no-dupe-keys": "error",
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "error",
    },
  },
];
