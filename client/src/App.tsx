import { useState, useEffect, useCallback, useRef } from "react";
import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AccessGate } from "@/components/access-gate";
import { WifiOff } from "lucide-react";

import NotFound from "@/pages/not-found";
import Dashboard from "@/pages/dashboard";
import FilesPage from "@/pages/files";
import ProjectsPage from "@/pages/projects";
import PDFReaderPage from "@/pages/pdf-reader";
import PDFViewerPage from "@/pages/pdf-viewer";
import OneDrivePage from "@/pages/onedrive";
import SpotifyPlayerPage from "@/pages/spotify-player";
import OneNotePage from "@/pages/onenote";
import MobileNotesPage from "@/pages/mobile-notes";
import TickerPage from "@/pages/ticker";

function useAutoFullscreen() {
  const [requested, setRequested] = useState(false);
  const isSilk = typeof navigator !== 'undefined' && 
    (/\bSilk\b/i.test(navigator.userAgent) || /\bKF[A-Z]{2,4}\b/.test(navigator.userAgent) || /\bFireTV\b/i.test(navigator.userAgent) || /\bAFT[A-Z]\b/.test(navigator.userAgent));
  const urlWantsFullscreen = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('fullscreen') === 'true';
  const shouldFullscreen = isSilk || urlWantsFullscreen;
  useEffect(() => {
    if (!shouldFullscreen) return;
    const isInIframe = window.self !== window.top;
    const heightVal = isInIframe ? '100%' : '100vh';
    const widthVal = isInIframe ? '100%' : '100vw';
    document.documentElement.style.cssText += `;position:fixed;top:0;left:0;width:${widthVal};height:${heightVal};overflow:auto;margin:0;padding:0;`;
    document.body.style.cssText += `;margin:0;padding:0;min-height:${heightVal};width:${widthVal};height:${heightVal};overflow:auto;`;
    const meta = document.querySelector('meta[name="viewport"]');
    if (meta) {
      meta.setAttribute('content', 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover');
    }
  }, [shouldFullscreen]);

  const requestFullscreen = useCallback(() => {
    if (requested) return;
    if (document.fullscreenElement) { setRequested(true); return; }
    const el = document.documentElement as any;
    const fn = el.requestFullscreen || el.webkitRequestFullscreen || el.mozRequestFullScreen || el.msRequestFullscreen;
    if (fn) {
      fn.call(el).then(() => setRequested(true)).catch(() => {});
    }
  }, [requested]);

  useEffect(() => {
    if (!shouldFullscreen || requested) return;
    requestFullscreen();
    const interval = setInterval(() => {
      if (document.fullscreenElement) { setRequested(true); clearInterval(interval); return; }
      requestFullscreen();
    }, 2000);
    const handler = () => requestFullscreen();
    document.addEventListener('click', handler);
    document.addEventListener('touchstart', handler);
    document.addEventListener('keydown', handler);
    window.addEventListener('focus', handler);
    return () => {
      clearInterval(interval);
      document.removeEventListener('click', handler);
      document.removeEventListener('touchstart', handler);
      document.removeEventListener('keydown', handler);
      window.removeEventListener('focus', handler);
    };
  }, [shouldFullscreen, requested, requestFullscreen]);
}

function ConnectionBanner() {
  const [offline, setOffline] = useState(false);
  const [downSeconds, setDownSeconds] = useState(0);
  const failedAt = useRef<number | null>(null);
  const checkInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  const tickInterval = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const check = async () => {
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 5000);
        const resp = await fetch("/api/health", { signal: controller.signal });
        clearTimeout(timer);
        if (resp.ok) {
          if (failedAt.current) {
            failedAt.current = null;
            setOffline(false);
            setDownSeconds(0);
          }
          return;
        }
        throw new Error("not ok");
      } catch {
        if (!failedAt.current) failedAt.current = Date.now();
        setOffline(true);
      }
    };
    check();
    checkInterval.current = setInterval(check, 10000);
    tickInterval.current = setInterval(() => {
      if (failedAt.current) setDownSeconds(Math.round((Date.now() - failedAt.current) / 1000));
    }, 1000);
    return () => {
      if (checkInterval.current) clearInterval(checkInterval.current);
      if (tickInterval.current) clearInterval(tickInterval.current);
    };
  }, []);

  if (!offline) return null;

  const mins = Math.floor(downSeconds / 60);
  const secs = downSeconds % 60;
  const timeStr = mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;

  return (
    <div data-testid="connection-lost-banner" style={{
      position: "fixed", top: 0, left: 0, right: 0, zIndex: 99999,
      background: "linear-gradient(90deg, #dc2626, #b91c1c)",
      color: "#fff", display: "flex", alignItems: "center", justifyContent: "center",
      gap: 8, padding: "6px 16px", fontSize: 13, fontWeight: 600,
      boxShadow: "0 2px 12px rgba(220,38,38,0.5)",
      animation: "pulse 2s ease-in-out infinite",
    }}>
      <WifiOff style={{ width: 16, height: 16 }} />
      <span>Dashboard server unreachable — down for {timeStr}</span>
    </div>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/files" component={FilesPage} />
      <Route path="/onedrive" component={OneDrivePage} />
      <Route path="/projects" component={ProjectsPage} />
      <Route path="/pdf-reader/onedrive" component={PDFReaderPage} />
      <Route path="/pdf-reader/:fileId" component={PDFReaderPage} />
      <Route path="/pdf-reader" component={PDFReaderPage} />
      <Route path="/pdf-viewer/*" component={PDFViewerPage} />
      <Route path="/spotify" component={SpotifyPlayerPage} />
      <Route path="/onenote" component={OneNotePage} />
      <Route path="/mobile/notes" component={MobileNotesPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  useAutoFullscreen();
  const [location] = useLocation();

  if (location === '/ticker') {
    return (
      <QueryClientProvider client={queryClient}>
        <TickerPage />
      </QueryClientProvider>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <ConnectionBanner />
        <AccessGate>
          <Toaster />
          <Router />
        </AccessGate>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
