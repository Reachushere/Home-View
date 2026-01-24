import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// Global error handler for debugging on Fire tablets
window.onerror = function(message, source, lineno, colno, error) {
  const errorDiv = document.createElement('div');
  errorDiv.style.cssText = 'position:fixed;top:0;left:0;right:0;background:red;color:white;padding:20px;z-index:999999;font-size:14px;white-space:pre-wrap;';
  errorDiv.textContent = `Error: ${message}\nSource: ${source}\nLine: ${lineno}, Col: ${colno}\n${error?.stack || ''}`;
  document.body.appendChild(errorDiv);
  return false;
};

// Unhandled promise rejection handler
window.onunhandledrejection = function(event) {
  const errorDiv = document.createElement('div');
  errorDiv.style.cssText = 'position:fixed;top:0;left:0;right:0;background:orange;color:black;padding:20px;z-index:999999;font-size:14px;white-space:pre-wrap;';
  errorDiv.textContent = `Unhandled Promise: ${event.reason}`;
  document.body.appendChild(errorDiv);
};

createRoot(document.getElementById("root")!).render(<App />);
