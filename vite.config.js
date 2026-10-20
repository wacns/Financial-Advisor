import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
export default defineConfig(({ command }) => ({
  plugins: [react()],
  optimizeDeps: { entries: ["index.html"] },
  resolve: {
    alias: [{ find: /^react-native$/, replacement: "react-native-web" }],
    extensions: [".web.ts", ".web.tsx", ".web.js", ".web.jsx", ".ts", ".tsx", ".js", ".jsx", ".json"],
  },
  define: { __DEV__: JSON.stringify(command === "serve") },
}));
