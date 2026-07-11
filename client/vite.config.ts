import path from "path";
import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import tailwind from "tailwindcss";
import autoprefixer from "autoprefixer";

export default defineConfig({
  base: "/ott/",
  css: {
    postcss: {
      plugins: [tailwind(), autoprefixer()],
    },
  },
  plugins: [vue()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 6102,
    fs: {
      allow: [path.resolve(__dirname, "..")],
    },
    proxy: {
      "/api/ottwatcher": {
        target: "http://localhost:6002",
        changeOrigin: true,
      },
    },
  },
  esbuild: {
    drop: ["console", "debugger"],
  },
  build: {
    outDir: "dist",
    sourcemap: false,
    minify: "esbuild",
    rollupOptions: {
      output: {
        assetFileNames: "assets/[name].[hash][extname]",
        chunkFileNames: "assets/[name].[hash].js",
        entryFileNames: "assets/[name].[hash].js",
        onlyExplicitManualChunks: true,
        manualChunks(id) {
          if (id.includes("node_modules")) {
            return "vendor";
          }
          if (id.includes("/src/lib/api")) {
            return "api";
          }
        },
      },
    },
    chunkSizeWarningLimit: 500,
  },
});
