import { useState, useEffect, createContext, useContext } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Lock, AlertCircle } from "lucide-react";

interface AccessGateProps {
  children: React.ReactNode;
}

interface AccessContextType {
  isReadOnly: boolean;
  isAdmin: boolean;
  authLevel: string;
}

const AccessContext = createContext<AccessContextType>({ isReadOnly: false, isAdmin: true, authLevel: '5747' });

export function useAccessMode() {
  return useContext(AccessContext);
}

export function AccessGate({ children }: AccessGateProps) {
  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null);
  const [authLevel, setAuthLevel] = useState<string>('5747');
  const [error, setError] = useState<string | null>(null);
  const [passwordInput, setPasswordInput] = useState("");
  const [isValidating, setIsValidating] = useState(false);

  useEffect(() => {
    checkAccess();
  }, []);

  const checkAccess = async () => {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const authParam = urlParams.get('auth');
      const checkUrl = authParam ? `/api/auth/check?auth=${encodeURIComponent(authParam)}` : "/api/auth/check";
      const res = await fetch(checkUrl);
      const data = await res.json();
      if (data.authenticated) {
        if (data.token) {
          localStorage.setItem('uni_cal_token', data.token);
        }
        if (data.level) {
          setAuthLevel(data.level);
        }
        if (authParam) {
          const profileNames = ['bryn', 'yasu', 'guest'];
          if (!profileNames.includes(authParam.toLowerCase())) {
            urlParams.delete('auth');
            const newSearch = urlParams.toString();
            const newUrl = window.location.pathname + (newSearch ? `?${newSearch}` : '');
            window.history.replaceState({}, '', newUrl);
          }
        }
        setIsAuthorized(true);
        return;
      }
    } catch {}

    if (import.meta.env.DEV) {
      const devParams = new URLSearchParams(window.location.search);
      const devAuth = devParams.get('auth');
      if (devAuth && ['5747', '4201', '1010'].includes(devAuth)) {
        setAuthLevel(devAuth);
      }
      setIsAuthorized(true);
      return;
    }

    setIsAuthorized(false);
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passwordInput.trim()) return;
    setIsValidating(true);
    setError(null);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: passwordInput.trim() }),
      });
      const data = await res.json();
      if (data.success) {
        if (data.token) {
          localStorage.setItem('uni_cal_token', data.token);
        }
        if (data.level) {
          setAuthLevel(data.level);
        }
        setIsAuthorized(true);
      } else {
        setError(data.message || "Incorrect password");
      }
    } catch {
      setError("Connection error. Please try again.");
    } finally {
      setIsValidating(false);
    }
  };

  if (isAuthorized === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="animate-pulse text-white">Loading...</div>
      </div>
    );
  }

  if (!isAuthorized) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 p-4">
        <div className="max-w-sm w-full bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-lg p-6 sm:p-8 text-center">
          <div className="w-14 h-14 sm:w-16 sm:h-16 bg-blue-500/20 rounded-full flex items-center justify-center mx-auto mb-4 sm:mb-6">
            <Lock className="w-7 h-7 sm:w-8 sm:h-8 text-blue-400" />
          </div>
          
          <h1 className="text-xl sm:text-2xl font-bold text-white mb-1 sm:mb-2">Uni-Cal</h1>
          <p className="text-gray-400 text-sm sm:text-base mb-4 sm:mb-6">
            Enter password to continue
          </p>

          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 mb-4 flex items-center gap-2 text-red-400">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span className="text-sm">{error}</span>
            </div>
          )}

          <form onSubmit={handlePasswordSubmit} className="space-y-3 sm:space-y-4">
            <Input
              type="password"
              placeholder="Password"
              value={passwordInput}
              onChange={(e) => setPasswordInput(e.target.value)}
              className="bg-gray-900/50 border-gray-600 text-white text-base h-11"
              autoFocus
              data-testid="input-password"
            />
            <Button
              type="submit"
              className="w-full h-11"
              disabled={isValidating || !passwordInput.trim()}
              data-testid="button-login"
            >
              {isValidating ? "Checking..." : "Enter"}
            </Button>
          </form>
        </div>
      </div>
    );
  }

  const isFullAccess = authLevel === '5747';

  return (
    <AccessContext.Provider value={{ isReadOnly: !isFullAccess, isAdmin: isFullAccess, authLevel }}>
      {children}
      {authLevel === '1010' && <Auth1010Effects />}
    </AccessContext.Provider>
  );
}

function Auth1010Effects() {
  const [showFullscreenPrompt, setShowFullscreenPrompt] = useState(() => {
    try { return sessionStorage.getItem('uni_cal_1010_fs_prompt_dismissed') !== '1'; } catch { return true; }
  });

  useEffect(() => {
    document.body.setAttribute('data-auth-1010', '1');
    return () => { document.body.removeAttribute('data-auth-1010'); };
  }, []);

  useEffect(() => {
    const handler = () => {
      try { sessionStorage.removeItem('uni_cal_1010_fs_prompt_dismissed'); } catch {}
      setShowFullscreenPrompt(true);
    };
    window.addEventListener('show-1010-fs-prompt', handler);
    return () => window.removeEventListener('show-1010-fs-prompt', handler);
  }, []);

  const dismiss = () => {
    try { sessionStorage.setItem('uni_cal_1010_fs_prompt_dismissed', '1'); } catch {}
    setShowFullscreenPrompt(false);
  };

  if (!showFullscreenPrompt) return null;

  return (
    <div
      data-allow-1010="1"
      data-testid="dialog-1010-fullscreen-prompt"
      style={{
        position: 'fixed', inset: 0, zIndex: 2147483647,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(6px)',
      }}
    >
      <div
        data-allow-1010="1"
        style={{
          maxWidth: '440px', width: '90%',
          background: 'linear-gradient(180deg, #1f2937 0%, #111827 100%)',
          border: '1px solid rgba(255,255,255,0.18)',
          borderRadius: '14px',
          padding: '28px 26px',
          boxShadow: '0 30px 60px rgba(0,0,0,0.55)',
          color: '#fff',
          textAlign: 'center',
          fontFamily: "Avenir, 'Avenir Next', -apple-system, BlinkMacSystemFont, sans-serif",
        }}
      >
        <div style={{ fontSize: '17px', fontWeight: 600, marginBottom: '10px' }}>One quick thing</div>
        <div style={{ fontSize: '14px', lineHeight: 1.5, color: 'rgba(255,255,255,0.85)', marginBottom: '20px' }}>
          Please set your browser to full screen to view Bryn's software properly.
        </div>
        <button
          data-allow-1010="1"
          onClick={dismiss}
          data-testid="button-1010-fullscreen-ok"
          style={{
            padding: '10px 22px', borderRadius: '8px',
            background: 'linear-gradient(180deg, #3b82f6 0%, #1e3a8a 100%)',
            border: '1px solid rgba(255,255,255,0.2)',
            color: '#fff', fontSize: '13px', fontWeight: 600, cursor: 'pointer',
            boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
          }}
        >
          Got it
        </button>
      </div>
    </div>
  );
}
