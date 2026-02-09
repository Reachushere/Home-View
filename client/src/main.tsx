import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

const originalFetch = window.fetch.bind(window);
window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
  return originalFetch(input, { credentials: 'include', ...init });
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

window.onerror = function(message, source, lineno, colno, error) {
  const msg = `${message} at ${source}:${lineno}:${colno}`;
  reportError(msg, error?.stack);
  return false;
};

window.onunhandledrejection = function(event) {
  const msg = `Unhandled Promise: ${event.reason}`;
  reportError(msg, event.reason?.stack);
};

if (navigator.userAgent.toLowerCase().includes('android') || navigator.userAgent.toLowerCase().includes('fire')) {
  setTimeout(() => {
    const diag: string[] = [];
    diag.push('UA: ' + navigator.userAgent.substring(0, 80));

    originalFetch('/api/auth/check', { credentials: 'include' })
      .then(r => r.json())
      .then(d => {
        diag.push('Auth: ' + (d.authenticated ? 'YES' : 'NO'));
        return originalFetch('/api/files', { credentials: 'include' });
      })
      .then(r => {
        diag.push('Files status: ' + r.status);
        return r.json();
      })
      .then(files => {
        diag.push('Files count: ' + (Array.isArray(files) ? files.length : 'not-array'));
        return originalFetch('/api/files/counts', { credentials: 'include' });
      })
      .then(r => {
        diag.push('Counts status: ' + r.status);
        return r.json();
      })
      .then(counts => {
        diag.push('Counts keys: ' + Object.keys(counts).length);
        reportError('TABLET_DIAG: ' + diag.join(' | '));

        const el = document.createElement('div');
        el.style.cssText = 'position:fixed;bottom:0;left:0;right:0;background:rgba(0,0,0,0.85);color:#0f0;padding:8px;z-index:999999;font-size:11px;font-family:monospace;white-space:pre-wrap;max-height:30vh;overflow:auto;';
        el.textContent = diag.join('\n');
        el.onclick = () => el.remove();
        document.body.appendChild(el);
        setTimeout(() => el.remove(), 30000);
      })
      .catch(err => {
        diag.push('ERROR: ' + (err?.message || err));
        reportError('TABLET_DIAG_ERR: ' + diag.join(' | '));

        const el = document.createElement('div');
        el.style.cssText = 'position:fixed;bottom:0;left:0;right:0;background:rgba(0,0,0,0.85);color:red;padding:8px;z-index:999999;font-size:11px;font-family:monospace;white-space:pre-wrap;max-height:30vh;overflow:auto;';
        el.textContent = diag.join('\n');
        el.onclick = () => el.remove();
        document.body.appendChild(el);
        setTimeout(() => el.remove(), 60000);
      });
  }, 3000);
}

createRoot(document.getElementById("root")!).render(<App />);
