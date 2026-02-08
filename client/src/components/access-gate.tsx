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
}

const AccessContext = createContext<AccessContextType>({ isReadOnly: false, isAdmin: true });

export function useAccessMode() {
  return useContext(AccessContext);
}

export function AccessGate({ children }: AccessGateProps) {
  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [passwordInput, setPasswordInput] = useState("");
  const [isValidating, setIsValidating] = useState(false);

  useEffect(() => {
    checkAccess();
  }, []);

  const checkAccess = async () => {
    try {
      const res = await fetch("/api/auth/check");
      const data = await res.json();
      if (data.authenticated) {
        setIsAuthorized(true);
        return;
      }
    } catch {}

    if (import.meta.env.DEV) {
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

  return (
    <AccessContext.Provider value={{ isReadOnly: false, isAdmin: true }}>
      {children}
    </AccessContext.Provider>
  );
}
