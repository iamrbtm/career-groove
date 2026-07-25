import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { apiClient, apiJson } from "@/lib/api";
import { tokenStore } from "@/lib/token-store";

export interface SessionUser {
  email: string;
  id: string;
  image: string | null;
  name: string | null;
}

interface AuthContextValue {
  isLoading: boolean;
  signIn(email: string, password: string): Promise<void>;
  signOut(): Promise<void>;
  user: SessionUser | null;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      try {
        if (!(await tokenStore.load())) return;
        const session = await apiJson<{ user: SessionUser }>(
          "/api/mobile/auth/session",
        );
        setUser(session.user);
      } catch {
        await apiClient.signOut();
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const result = await apiJson<{
      accessToken: string;
      refreshToken: string;
      accessTokenExpiresAt: string;
      refreshTokenExpiresAt: string;
      user: SessionUser;
    }>("/api/mobile/auth/signin", {
      body: JSON.stringify({ email, password }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });
    await apiClient.setTokens(result);
    setUser(result.user);
  }, []);

  const signOut = useCallback(async () => {
    await apiClient.signOut();
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ isLoading, signIn, signOut, user }),
    [isLoading, signIn, signOut, user],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used within AuthProvider");
  return value;
}
