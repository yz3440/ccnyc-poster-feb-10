import { defineConfig } from "vite";
import { resolve } from "path";

export default defineConfig({
  root: ".",
  publicDir: "public",
  server: {
    port: 3000,
    open: true,
  },
  build: {
    outDir: "dist",
    rollupOptions: {
      input: {
        main: resolve(__dirname, "index.html"),
        poster: resolve(__dirname, "poster.html"),
        text: resolve(__dirname, "text.html"),
      },
    },
  },
});
