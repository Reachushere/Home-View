import { useState, useEffect, createContext, useContext } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Lock, Clock, AlertCircle, Eye } from "lucide-react";

interface AccessGateProps {
  children: React.ReactNode;
}

const ADMIN_KEY = "uni_cal_admin";
const ACCESS_TOKEN_KEY = "uni_cal_access_token";
const EXPIRES_AT_KEY = "uni_cal_expires_at";

// Context to share read-only mode throughout the app
interface AccessContextType {
  isReadOnly: boolean;
  isAdmin: boolean;
}

const AccessContext = createContext<AccessContextType>({ isReadOnly: false, isAdmin: true });

export function useAccessMode() {
  return useContext(AccessContext);
}

export function AccessGate({ children }: AccessGateProps) {
  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<Date | null>(null);
  const [tokenInput, setTokenInput] = useState("");
  const [isValidating, setIsValidating] = useState(false);

  useEffect(() => {
    checkAccess();
  }, []);

  const checkAccess = async () => {
    // Check URL for access token FIRST - this takes priority over admin mode
    const urlParams = new URLSearchParams(window.location.search);
    const urlToken = urlParams.get("access");
    
    // If URL has access token, validate it and use read-only mode (never auto-admin)
    if (urlToken) {
      await validateToken(urlToken);
      // Clean up URL after validation
      window.history.replaceState({}, "", window.location.pathname);
      return;
    }

    // Only auto-enable admin for truly local development (localhost only, not replit.app)
    const isLocalhost = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
    const isDevMode = import.meta.env.DEV && isLocalhost;
    if (isDevMode) {
      localStorage.setItem(ADMIN_KEY, "true");
      setIsAdmin(true);
      setIsAuthorized(true);
      return;
    }

    // Check if admin mode is stored (user clicked "I'm the owner")
    if (localStorage.getItem(ADMIN_KEY) === "true") {
      setIsAdmin(true);
      setIsAuthorized(true);
      return;
    }

    // Check localStorage for token
    const storedToken = localStorage.getItem(ACCESS_TOKEN_KEY);
    const storedExpiry = localStorage.getItem(EXPIRES_AT_KEY);

    // If stored token exists and not expired, use it (for returning share link users)
    if (storedToken && storedExpiry) {
      const expiryDate = new Date(storedExpiry);
      if (expiryDate > new Date()) {
        setExpiresAt(expiryDate);
        setIsAuthorized(true);
        // Note: isAdmin stays false, so this is read-only mode
        return;
      } else {
        // Clear expired token
        localStorage.removeItem(ACCESS_TOKEN_KEY);
        localStorage.removeItem(EXPIRES_AT_KEY);
      }
    }

    // No valid access - show login screen
    setIsAuthorized(false);
  };

  const validateToken = async (token: string) => {
    setIsValidating(true);
    setError(null);

    try {
      const response = await fetch("/api/access-tokens/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });

      const data = await response.json();

      if (data.valid) {
        const expiry = new Date(data.expiresAt);
        localStorage.setItem(ACCESS_TOKEN_KEY, token);
        localStorage.setItem(EXPIRES_AT_KEY, expiry.toISOString());
        setExpiresAt(expiry);
        setIsAuthorized(true);
      } else {
        setError(data.message || "Invalid access token");
        setIsAuthorized(false);
      }
    } catch (err) {
      setError("Failed to validate token");
      setIsAuthorized(false);
    } finally {
      setIsValidating(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (tokenInput.trim()) {
      await validateToken(tokenInput.trim());
    }
  };

  const enableAdminMode = () => {
    localStorage.setItem(ADMIN_KEY, "true");
    setIsAdmin(true);
    setIsAuthorized(true);
  };

  // Loading state
  if (isAuthorized === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="animate-pulse text-white">Loading...</div>
      </div>
    );
  }

  // Access denied
  if (!isAuthorized) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 p-4">
        <div className="max-w-md w-full bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-lg p-8 text-center">
          <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
            <Lock className="w-8 h-8 text-red-400" />
          </div>
          
          <h1 className="text-2xl font-bold text-white mb-2">Access Required</h1>
          <p className="text-gray-400 mb-6">
            This app requires a valid access link to view.
          </p>

          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 mb-6 flex items-center gap-2 text-red-400">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span className="text-sm">{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              type="text"
              placeholder="Enter access token..."
              value={tokenInput}
              onChange={(e) => setTokenInput(e.target.value)}
              className="bg-gray-900/50 border-gray-600 text-white"
              data-testid="input-access-token"
            />
            <Button
              type="submit"
              className="w-full"
              disabled={isValidating || !tokenInput.trim()}
              data-testid="button-submit-token"
            >
              {isValidating ? "Validating..." : "Access App"}
            </Button>
          </form>

          <div className="mt-8 pt-6 border-t border-gray-700">
            <button
              onClick={enableAdminMode}
              className="text-xs text-gray-500 hover:text-gray-400 transition-colors"
              data-testid="button-admin-mode"
            >
              I'm the owner
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Authorized - show app with optional expiry notice
  const isReadOnly = !isAdmin;
  
  return (
    <AccessContext.Provider value={{ isReadOnly, isAdmin }}>
      {expiresAt && (
        <ExpiryBanner expiresAt={expiresAt} isReadOnly={isReadOnly} />
      )}
      {children}
    </AccessContext.Provider>
  );
}

function ExpiryBanner({ expiresAt, isReadOnly }: { expiresAt: Date; isReadOnly: boolean }) {
  const [timeLeft, setTimeLeft] = useState("");
  const [isExpired, setIsExpired] = useState(false);

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const diff = expiresAt.getTime() - now.getTime();

      if (diff <= 0) {
        setIsExpired(true);
        setTimeLeft("Expired");
        // Clear stored access
        localStorage.removeItem(ACCESS_TOKEN_KEY);
        localStorage.removeItem(EXPIRES_AT_KEY);
        return;
      }

      const minutes = Math.floor(diff / 60000);
      const seconds = Math.floor((diff % 60000) / 1000);
      setTimeLeft(`${minutes}:${seconds.toString().padStart(2, "0")}`);
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, [expiresAt]);

  if (isExpired) {
    return (
      <div className="fixed top-0 left-0 right-0 bg-red-600 text-white py-2 px-4 text-center text-sm z-[9999] flex items-center justify-center gap-2">
        <AlertCircle className="w-4 h-4" />
        <span>Your access has expired. Please request a new link.</span>
        <Button
          size="sm"
          variant="secondary"
          onClick={() => window.location.reload()}
          className="ml-2"
          data-testid="button-reload-after-expiry"
        >
          Reload
        </Button>
      </div>
    );
  }

  return (
    <div className="fixed top-0 left-0 right-0 bg-amber-600/90 text-white py-1 px-4 text-center text-xs z-[9999] flex items-center justify-center gap-2">
      {isReadOnly && (
        <>
          <Eye className="w-3 h-3" />
          <span>View Only</span>
          <span className="mx-1">|</span>
        </>
      )}
      <Clock className="w-3 h-3" />
      <span>Expires in {timeLeft}</span>
    </div>
  );
}
