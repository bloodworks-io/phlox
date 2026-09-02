/// <reference types="vitest/config" />
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
const ortDistDir = normalizePath(
  path.relative(
    process.cwd(),
    path.join(path.dirname(fileURLToPath(import.meta.url)), "node_modules/onnxruntime-web/dist"),
  ),
);

// GitHub Pages SPA fallback: serve the app shell for unknown deep links.
function spa404Fallback() {
  return {
    name: "spa-404-fallback",
    apply: "build",
    writeBundle(options) {
      const outDir = options.dir ?? "build";
      const fs = require("node:fs");
      const pathMod = require("node:path");
      const indexPath = pathMod.join(outDir, "index.html");
      if (fs.existsSync(indexPath)) {
        fs.copyFileSync(indexPath, pathMod.join(outDir, "404.html"));
      }
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig({
  // Hosted at a subpath (e.g. GitHub Pages /<repo>/) — override at build time.
  base: process.env.GITHUB_PAGES_BASE ?? "/",
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
        // onnxruntime wasm binaries (transformers.js WebGPU/WASM backends),
        // served locally instead of the jsdelivr CDN default.
        { src: `${ortDistDir}/*.wasm`, dest: "ort", rename: { stripBase: true } },
        { src: `${ortDistDir}/*.mjs`, dest: "ort", rename: { stripBase: true } },
      ],
    }),
    spa404Fallback(),
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

  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.js"],
  },


  optimizeDeps: {
    entries: ["index.html"],
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

    watch: {
      ignored: [
        "**/build-dir/**",
        "**/.flatpak-builder/**",
        "**/_build/**",
        "**/src-tauri/llama.cpp/**",
        "**/src-tauri/parakeet.cpp/**",
        "**/src-tauri/target/**",
      ],
    },
  },
});
