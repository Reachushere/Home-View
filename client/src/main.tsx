import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

const originalFetch = window.fetch.bind(window);
window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
  const token = localStorage.getItem('uni_cal_token');
  const headers: Record<string, string> = {};
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return originalFetch(input, {
    credentials: 'include',
    ...init,
    headers: {
      ...headers,
      ...(init?.headers || {}),
    },
  });
};

function reportError(message: string, stack?: string) {
  try {
    originalFetch('/api/client-error', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message,
        stack: stack || '',
        userAgent: navigator.userAgent,
        url: window.location.href,
        timestamp: new Date().toISOString()
      }),
      credentials: 'include'
    }).catch(() => {});
  } catch {}
}

window.addEventListener('error', (event) => {
  if (event.message && typeof event.message === 'string' && event.message.includes('ResizeObserver')) {
    event.stopImmediatePropagation();
    event.preventDefault();
    return;
  }
  if (event.error) {
    console.error('[RUNTIME ERROR CAUGHT]', event.error, event.error?.message, event.error?.stack);
  } else {
    console.error('[RUNTIME ERROR NO-ERROR-OBJ]', event.message, event.filename, event.lineno);
  }
});

window.addEventListener('unhandledrejection', (event) => {
  console.error('[UNHANDLED REJECTION]', event.reason, typeof event.reason, event.reason?.message, event.reason?.stack);
});

window.onerror = function(message, source, lineno, colno, error) {
  if (typeof message === 'string' && message.includes('ResizeObserver')) return true;
  const msg = `${message} at ${source}:${lineno}:${colno}`;
  reportError(msg, error?.stack);
  return false;
};

window.onunhandledrejection = function(event) {
  const msg = `Unhandled Promise: ${event.reason}`;
  reportError(msg, event.reason?.stack);
};

let knownVersion: string | null = null;
async function checkVersion() {
  try {
    const params = new URLSearchParams(window.location.search);
    if (params.get('followOnly') === 'true') return;
    const resp = await originalFetch('/api/version');
    if (resp.ok) {
      const data = await resp.json();
      if (knownVersion && data.version !== knownVersion) {
        window.location.reload();
        return;
      }
      knownVersion = data.version;
    }
  } catch {}
}
checkVersion();
setInterval(checkVersion, 30000);

createRoot(document.getElementById("root")!).render(<App />);
