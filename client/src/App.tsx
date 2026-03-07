import { useState, useEffect, useCallback } from "react";
import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AccessGate } from "@/components/access-gate";
import { DevPostIt } from "@/components/dev-post-it";
import NotFound from "@/pages/not-found";
import Dashboard from "@/pages/dashboard";
import FilesPage from "@/pages/files";
import ProjectsPage from "@/pages/projects";
import PDFReaderPage from "@/pages/pdf-reader";
import PDFViewerPage from "@/pages/pdf-viewer";
import OneDrivePage from "@/pages/onedrive";

function useAutoFullscreen() {
  const [requested, setRequested] = useState(false);
  const isSilk = typeof navigator !== 'undefined' && 
    (/\bSilk\b/i.test(navigator.userAgent) || /\bKF[A-Z]{2,4}\b/.test(navigator.userAgent) || /\bFireTV\b/i.test(navigator.userAgent) || /\bAFT[A-Z]\b/.test(navigator.userAgent));

  useEffect(() => {
    if (!isSilk) return;
    document.documentElement.style.cssText += ';position:fixed;top:0;left:0;width:100vw;height:100vh;overflow:auto;margin:0;padding:0;';
    document.body.style.cssText += ';margin:0;padding:0;min-height:100vh;width:100vw;height:100vh;overflow:auto;';
    const meta = document.querySelector('meta[name="viewport"]');
    if (meta) {
      meta.setAttribute('content', 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover');
    }
  }, [isSilk]);

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
    if (!isSilk || requested) return;
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
  }, [isSilk, requested, requestFullscreen]);
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
      <Route component={NotFound} />
    </Switch>
  );
}

function ConditionalPostIt() {
  const [location] = useLocation();
  if (location !== "/") return null;
  return <DevPostIt />;
}

function App() {
  useAutoFullscreen();
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AccessGate>
          <Toaster />
          <ConditionalPostIt />
          <Router />
        </AccessGate>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
