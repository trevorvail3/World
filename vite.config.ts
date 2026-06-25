import { defineConfig } from "vite";

// Minimal Vite config. The game is a plain TypeScript + HTML5 canvas app,
// so there are no framework plugins. `base: "./"` makes the built /dist
// work when opened from any path (handy for static hosting later).
export default defineConfig({
  base: "./",
  server: {
    host: true,
    open: false,
  },
  build: {
    target: "es2020",
    outDir: "dist",
  },
});
