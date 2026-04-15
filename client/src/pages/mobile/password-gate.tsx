import { useState } from "react";
import { VALID_PASSWORDS } from "./types";

export function PasswordGate({ onAuth }: { onAuth: (code: string) => void }) {
  const [input, setInput] = useState("");
  const [error, setError] = useState(false);

  const handleSubmit = () => {
    const v = input.trim();
    if (VALID_PASSWORDS.includes(v)) {
      localStorage.setItem("mobileAuth", v);
      onAuth(v);
    } else {
      setError(true);
    }
  };

  return (
    <div
      style={{
        width: '100vw', height: '100dvh', overflow: 'hidden',
        backgroundColor: '#3a8bbf',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '16px',
      }}
      data-testid="mobile-app-password-screen"
    >
      <div style={{
        background: 'linear-gradient(180deg, rgba(255,255,255,0.35) 0%, rgba(255,255,255,0.18) 100%)',
        backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
        border: '1.5px solid rgba(255,255,255,0.35)',
        borderRadius: '16px', padding: '28px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '14px',
        boxShadow: '0 4px 24px rgba(0,0,0,0.15), inset 0 1px 0 rgba(255,255,255,0.25)',
        width: '260px',
      }}>
        <span style={{ color: '#fff', fontSize: '14px', fontWeight: 600, fontFamily: "system-ui, -apple-system, sans-serif" }}>UniCal Mobile</span>
        <input
          type="password"
          inputMode="numeric"
          placeholder="Password"
          value={input}
          onChange={(e) => { setInput(e.target.value); setError(false); }}
          onKeyDown={(e) => { if (e.key === 'Enter') handleSubmit(); }}
          style={{
            width: '100%', height: '40px', borderRadius: '10px',
            border: error ? '2px solid #ef4444' : '1.5px solid rgba(255,255,255,0.4)',
            background: 'rgba(255,255,255,0.12)', color: '#fff', fontSize: '16px', textAlign: 'center',
            outline: 'none', fontFamily: "system-ui, -apple-system, sans-serif",
          }}
          data-testid="mobile-app-password-input"
          autoFocus
        />
        <button
          onClick={handleSubmit}
          style={{
            width: '100%', height: '38px', borderRadius: '10px',
            background: 'rgba(255,255,255,0.25)', border: '1px solid rgba(255,255,255,0.4)',
            color: '#fff', fontSize: '14px', fontWeight: 600, cursor: 'pointer',
            fontFamily: "system-ui, -apple-system, sans-serif",
          }}
          data-testid="mobile-app-password-submit"
        >Enter</button>
        {error && <span style={{ color: '#fca5a5', fontSize: '12px' }} data-testid="text-password-error">Incorrect password</span>}
      </div>
    </div>
  );
}
