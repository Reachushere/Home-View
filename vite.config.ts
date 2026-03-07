import { defineConfig, Plugin } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";

function reactUmdGlobalsPlugin(): Plugin {
  const shims: Record<string, string> = {
    'react': `var R = window.React;
export default R;
export var useState = R.useState, useEffect = R.useEffect, useRef = R.useRef,
  useCallback = R.useCallback, useMemo = R.useMemo, useContext = R.useContext,
  useReducer = R.useReducer, createElement = R.createElement,
  createContext = R.createContext, forwardRef = R.forwardRef, memo = R.memo,
  lazy = R.lazy, Suspense = R.Suspense, Fragment = R.Fragment,
  Children = R.Children, cloneElement = R.cloneElement,
  isValidElement = R.isValidElement, Component = R.Component,
  PureComponent = R.PureComponent, StrictMode = R.StrictMode,
  startTransition = R.startTransition, useTransition = R.useTransition,
  useDeferredValue = R.useDeferredValue, useId = R.useId,
  useSyncExternalStore = R.useSyncExternalStore,
  useInsertionEffect = R.useInsertionEffect,
  useImperativeHandle = R.useImperativeHandle,
  useDebugValue = R.useDebugValue, useLayoutEffect = R.useLayoutEffect,
  createRef = R.createRef, version = R.version;`,

    'react-dom': `var RD = window.ReactDOM;
export default RD;
export var createPortal = RD.createPortal, flushSync = RD.flushSync,
  createRoot = RD.createRoot, hydrateRoot = RD.hydrateRoot,
  findDOMNode = RD.findDOMNode, render = RD.render,
  unmountComponentAtNode = RD.unmountComponentAtNode,
  version = RD.version;`,

    'react-dom/client': `var RD = window.ReactDOM;
export default RD;
export var createRoot = RD.createRoot, hydrateRoot = RD.hydrateRoot;`,

    'react/jsx-runtime': `var R = window.React;
export var jsx = R.createElement, jsxs = R.createElement, Fragment = R.Fragment;`,

    'react/jsx-dev-runtime': `var R = window.React;
export var jsxDEV = R.createElement, Fragment = R.Fragment;`,
  };

  return {
    name: 'react-umd-globals',
    apply: 'build',
    enforce: 'pre',
    resolveId(id) {
      if (shims[id]) return '\0react-shim:' + id;
    },
    load(id) {
      if (id.startsWith('\0react-shim:')) {
        return shims[id.slice('\0react-shim:'.length)];
      }
    },
  };
}

export default defineConfig({
  plugins: [
    reactUmdGlobalsPlugin(),
    react(),
    runtimeErrorOverlay(),
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
    target: 'es2015',
  },
  server: {
    fs: {
      strict: true,
      deny: ["**/.*"],
    },
  },
});
