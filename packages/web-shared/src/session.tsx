"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { UserDto } from "@repo/contracts";

import {
  api,
  clearSession,
  getRefreshToken,
  loginRequest,
  setAccessToken,
  storeRefreshToken,
} from "./api";

interface SessionContextValue {
  user: UserDto | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const SessionContext = createContext<SessionContextValue | null>(null);

export const SessionProvider = ({ children }: { children: React.ReactNode }): React.ReactElement => {
  const [user, setUser] = useState<UserDto | null>(null);
  const [loading, setLoading] = useState(true);

  const restore = useCallback(async () => {
    if (!getRefreshToken()) {
      setLoading(false);
      return;
    }
    try {
      const me = await api.get<UserDto>("/auth/me");
      setUser(me);
    } catch {
      clearSession();
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void restore();
  }, [restore]);

  const login = useCallback(async (email: string, password: string) => {
    const data = await loginRequest(email, password);
    setAccessToken(data.accessToken);
    storeRefreshToken(data.refreshToken);
    setUser(data.user);
  }, []);

  const logout = useCallback(async () => {
    const refreshToken = getRefreshToken();
    if (refreshToken) {
      await api.post("/auth/logout", { refreshToken }).catch(() => undefined);
    }
    clearSession();
    setUser(null);
  }, []);

  const value = useMemo(() => ({ user, loading, login, logout }), [user, loading, login, logout]);

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
};

export const useSession = (): SessionContextValue => {
  const context = useContext(SessionContext);
  if (!context) {
    throw new Error("useSession must be used within SessionProvider");
  }
  return context;
};
