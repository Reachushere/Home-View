import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import fs from "fs";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";

function fixTdzPlugin() {
  const outDir = path.resolve(import.meta.dirname, "dist/public");
  return {
    name: 'fix-tdz',
    closeBundle() {
      const assetsDir = path.join(outDir, 'assets');
      if (!fs.existsSync(assetsDir)) return;
      const jsFiles = fs.readdirSync(assetsDir).filter((f: string) => f.endsWith('.js'));
      for (const file of jsFiles) {
        const filePath = path.join(assetsDir, file);
        let code = fs.readFileSync(filePath, 'utf8');
        code = code.replace(/\blet /g, 'var ');
        code = code.replace(/\bconst /g, 'var ');
        fs.writeFileSync(filePath, code);
      }
    },
  };
}

export default defineConfig({
  plugins: [
    react(),
    runtimeErrorOverlay(),
    fixTdzPlugin(),
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
    },
  },
  root: path.resolve(import.meta.dirname, "client"),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
  },
  server: {
    fs: {
      strict: true,
      deny: ["**/.*"],
    },
  },
});
