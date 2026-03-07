import { defineConfig, Plugin } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";

function babelLetConstToVar(): Plugin {
  return {
    name: 'babel-let-const-to-var',
    apply: 'build',
    enforce: 'post',
    async renderChunk(code) {
      const babel = await import("@babel/core");
      const result = babel.transformSync(code, {
        configFile: false,
        babelrc: false,
        compact: true,
        plugins: ['@babel/plugin-transform-block-scoping'],
        sourceType: 'module',
      });
      if (result?.code) {
        return { code: result.code.replace(/\blet /g, 'var ').replace(/\bconst /g, 'var '), map: null };
      }
      return null;
    },
  };
}

export default defineConfig({
  plugins: [
    react(),
    runtimeErrorOverlay(),
    babelLetConstToVar(),
    ...(process.env.NODE_ENV !== "production" &&
    process.env.REPL_ID !== undefined
      ? [
          await import("@replit/vite-plugin-cartographer").then((m) =>
            m.cartographer(),
          ),
          await import("@replit/vite-plugin-dev-banner").then((m) =>
            m.devBanner(),
          ),
        ]
      : []),
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
      "@assets": path.resolve(import.meta.dirname, "attached_assets"),
      "react": "preact/compat",
      "react-dom": "preact/compat",
      "react-dom/client": "preact/compat",
      "react/jsx-runtime": "preact/jsx-runtime",
    },
  },
  root: path.resolve(import.meta.dirname, "client"),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
    target: false as any,
    minify: 'terser',
    terserOptions: {
      ecma: 5,
      compress: { ecma: 5 },
      format: { ecma: 5 },
    },
  },
  server: {
    fs: {
      strict: true,
      deny: ["**/.*"],
    },
  },
});
