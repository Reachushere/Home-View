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
