import { defineConfig, normalizePath } from "vite";
import react from "@vitejs/plugin-react";
import { readFileSync } from "fs";
import { fileURLToPath, URL } from "node:url";
import path from "node:path";
import { createRequire } from "node:module";
import { viteStaticCopy } from "vite-plugin-static-copy";

// Read version from package.json at build time
const pkg = JSON.parse(readFileSync("./package.json", "utf-8"));

const require = createRequire(import.meta.url);
const pdfjsDistPath = path.dirname(require.resolve("pdfjs-dist/package.json"));
const wasmDir = normalizePath(path.relative(process.cwd(), path.join(pdfjsDistPath, "wasm")));
const cmapsDir = normalizePath(path.relative(process.cwd(), path.join(pdfjsDistPath, "cmaps")));
const standardFontsDir = normalizePath(
  path.relative(process.cwd(), path.join(pdfjsDistPath, "standard_fonts")),
);

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    viteStaticCopy({
      targets: [
        { src: `${wasmDir}/*`, dest: "wasm", rename: { stripBase: true } },
        { src: `${cmapsDir}/*`, dest: "cmaps", rename: { stripBase: true } },
        {
          src: `${standardFontsDir}/*`,
          dest: "standard_fonts",
          rename: { stripBase: true },
        },
      ],
    }),
  ],

  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
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
