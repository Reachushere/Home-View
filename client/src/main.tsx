import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import "drag-drop-touch";

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

// ----------------------------------------------------------------------------
// SAFE MODE / PANIC MODE
// ----------------------------------------------------------------------------
// If the page ever starts auto-refreshing or popping dialogs faster than Bryn
// can stop it (e.g. during a Pi crash loop), they can break out by loading:
//
//     https://uni-cal.app/?safe=1
//
// That sets a localStorage flag so EVERY subsequent load stays in safe mode
// until they click the "Exit safe mode" button in the banner (or load
// ?safe=0). In safe mode we disable:
//   - the /api/version check (so anything that ever re-introduces auto-reload
//     based on version bumps cannot fire)
//   - the monthly report auto-popup (window.__SAFE_MODE__ gates it in
//     dashboard.tsx)
//   - any future auto-polling / auto-dialog code (read window.__SAFE_MODE__
//     before scheduling timers)
//
// A red banner is injected at the very top so it's obvious the mode is on.
// ----------------------------------------------------------------------------
const SAFE_MODE_KEY = 'uni_cal_safe_mode';
const urlParams = new URLSearchParams(window.location.search);
if (urlParams.get('safe') === '1' || urlParams.get('panic') === '1') {
  localStorage.setItem(SAFE_MODE_KEY, '1');
}
if (urlParams.get('safe') === '0') {
  localStorage.removeItem(SAFE_MODE_KEY);
}
const SAFE_MODE = localStorage.getItem(SAFE_MODE_KEY) === '1';
(window as any).__SAFE_MODE__ = SAFE_MODE;

if (SAFE_MODE) {
  // Banner is created with raw DOM so it appears before React mounts and
  // survives even if React itself crashes during render.
  const banner = document.createElement('div');
  banner.setAttribute('data-testid', 'banner-safe-mode');
  banner.style.cssText = [
    'position:fixed', 'top:0', 'left:0', 'right:0', 'z-index:2147483647',
    'background:#dc2626', 'color:white', 'padding:8px 16px',
    'font-family:system-ui,sans-serif', 'font-size:14px', 'font-weight:600',
    'display:flex', 'align-items:center', 'justify-content:center', 'gap:16px',
    'box-shadow:0 2px 8px rgba(0,0,0,.3)',
  ].join(';');
  banner.innerHTML = [
    '<span>SAFE MODE — auto-refresh, polling, and auto-dialogs are disabled.</span>',
    '<button id="exit-safe-mode" data-testid="button-exit-safe-mode" ',
    'style="background:white;color:#dc2626;border:none;border-radius:4px;',
    'padding:4px 12px;font-weight:700;cursor:pointer;">Exit safe mode</button>',
  ].join('');
  document.documentElement.appendChild(banner);
  // Push the page down so the banner does not cover content.
  document.documentElement.style.scrollPaddingTop = '40px';
  document.body && (document.body.style.paddingTop = '40px');
  document.addEventListener('DOMContentLoaded', () => {
    document.body.style.paddingTop = '40px';
  });
  banner.addEventListener('click', (e) => {
    const t = e.target as HTMLElement;
    if (t && t.id === 'exit-safe-mode') {
      localStorage.removeItem(SAFE_MODE_KEY);
      const u = new URL(window.location.href);
      u.searchParams.delete('safe');
      u.searchParams.delete('panic');
      window.location.replace(u.toString());
    }
  });
  console.warn('[SAFE MODE] Active. Append ?safe=0 to URL or click banner button to exit.');
}

// Version tracking only — we no longer auto-reload the page when the server
// version bumps. The previous behavior (setInterval(checkVersion, 30000) +
// window.location.reload()) caused the page to refresh constantly whenever
// the server restarted (every git push / deploy.sh run on the Pi), which in
// turn re-popped the monthly report dialog and sometimes dropped the auth
// session so the password prompt re-appeared. Bryn refreshes manually when
// they want the latest build.
let knownVersion: string | null = null;
async function checkVersion() {
  if (SAFE_MODE) return;
  try {
    const params = new URLSearchParams(window.location.search);
    if (params.get('followOnly') === 'true') return;
    const resp = await originalFetch('/api/version');
    if (resp.ok) {
      const data = await resp.json();
      knownVersion = data.version;
    }
  } catch {}
}
checkVersion();

createRoot(document.getElementById("root")!).render(<App />);
