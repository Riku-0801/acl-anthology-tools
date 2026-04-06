import { defineConfig } from "vite";
import webExtension from "vite-plugin-web-extension";

export default defineConfig({
  build: {
    outDir: "dist",
    emptyOutDir: true,
    minify: false,
    sourcemap: true,
  },
  plugins: [
    webExtension({
      manifest: "manifest.json",
      webExtConfig: {
        startUrl: "https://aclanthology.org/",
      },
    }),
  ],
});
