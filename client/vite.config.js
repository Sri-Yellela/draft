import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { prePaintScript } from "./src/themes/index.js";

// D91 · no flash: inline the theme registry's pre-paint script where index.html marks it. A missing
// marker fails the build rather than shipping a page that flashes.
const PRE_PAINT_MARKER = "<!--d91-pre-paint-->";
const themePrePaint = {
  name: "d91-theme-pre-paint",
  transformIndexHtml(html) {
    if (!html.includes(PRE_PAINT_MARKER)) throw new Error(`index.html lost ${PRE_PAINT_MARKER}`);
    return html.replace(PRE_PAINT_MARKER, `<script>${prePaintScript()}</script>`);
  },
};

export default defineConfig({
  plugins: [
    react({
      jsxRuntime: "automatic",   // ← eliminates "React is not defined" across all files
    }),
    themePrePaint,
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    proxy: {
      "/api": {
        target: "http://localhost:3001",
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: "../client/dist",
    emptyOutDir: true,
  },
});
