import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { readFileSync } from "fs";
import { fileURLToPath, URL } from "node:url";

// Read version from package.json at build time
const pkg = JSON.parse(readFileSync("./package.json", "utf-8"));

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],

  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },

  esbuild: {
    jsx: "automatic",
  },

  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },

  build: {
    // Build output directory must be 'build' for Tauri compatibility
    outDir: "build",
    emptyOutDir: true,
  },

  server: {
    host: "0.0.0.0",
    port: 3000,
    strictPort: true,
    // Proxy API calls to the backend
    proxy: {
      "/api": {
        target: "http://localhost:5000",
        changeOrigin: true,
      },
    },
  },
});
