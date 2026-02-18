import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],

  esbuild: {
    jsx: "automatic",
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
