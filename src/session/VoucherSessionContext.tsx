// Voucher session: memory only, by design. No localStorage/sessionStorage —
// the backend session lives 60 minutes, a page reload simply re-activates.
// Any 401 from the API must call clearSession().

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import type { Activation, VoucherState } from "../lib/types";

type Session = {
  token: string;
  expiresAt: string;
  voucher: VoucherState;
};

type SessionContextValue = {
  session: Session | null;
  startSession: (a: Activation) => void;
  clearSession: () => void;
  /** Refreshes the token (exchange mints a fresh one) and merges a partial
   *  voucher patch — e.g. after an instant re-pin, without refetching
   *  fields (codeLast4, status, initialValueCents...) that didn't change. */
  applyExchange: (sessionToken: string, sessionExpiresAt: string, voucherPatch: Partial<VoucherState>) => void;
  /** Live session with a non-expired token. */
  isActive: () => boolean;
};

const SessionContext = createContext<SessionContextValue | null>(null);

export function VoucherSessionProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);

  const startSession = useCallback((a: Activation) => {
    setSession({ token: a.sessionToken, expiresAt: a.sessionExpiresAt, voucher: a.voucher });
  }, []);
  const clearSession = useCallback(() => setSession(null), []);
  const applyExchange = useCallback(
    (sessionToken: string, sessionExpiresAt: string, voucherPatch: Partial<VoucherState>) => {
      setSession((prev) =>
        prev ? { token: sessionToken, expiresAt: sessionExpiresAt, voucher: { ...prev.voucher, ...voucherPatch } } : prev,
      );
    },
    [],
  );
  const isActive = useCallback(
    () => session !== null && Date.parse(session.expiresAt) > Date.now(),
    [session],
  );

  const value = useMemo(
    () => ({ session, startSession, clearSession, applyExchange, isActive }),
    [session, startSession, clearSession, applyExchange, isActive],
  );
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useVoucherSession(): SessionContextValue {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useVoucherSession must be used inside VoucherSessionProvider");
  return ctx;
}

/** Route guard: no live session → back to the activation form. */
export function RequireSession({ children }: { children: React.ReactNode }) {
  const { isActive } = useVoucherSession();
  if (!isActive()) return <Navigate to="/redeem" replace />;
  return <>{children}</>;
}
