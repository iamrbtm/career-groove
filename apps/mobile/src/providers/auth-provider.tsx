import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  CryptoDigestAlgorithm,
  CryptoEncoding,
  digestStringAsync,
  randomUUID,
} from "expo-crypto";
import { makeRedirectUri } from "expo-auth-session";
import * as WebBrowser from "expo-web-browser";

import { absoluteApiUrl, apiClient, apiJson } from "@/lib/api";
import { tokenStore } from "@/lib/token-store";

export interface SessionUser {
  email: string;
  id: string;
  image: string | null;
  name: string | null;
}

interface AuthContextValue {
  isLoading: boolean;
  register(name: string, email: string, password: string): Promise<void>;
  signIn(email: string, password: string): Promise<void>;
  signInWithOAuth(provider: "google" | "github"): Promise<void>;
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

  const signInWithOAuth = useCallback(
    async (provider: "google" | "github") => {
      const state = `${randomUUID()}${randomUUID()}`.replaceAll("-", "");
      const codeVerifier = `${randomUUID()}${randomUUID()}`.replaceAll("-", "");
      const digest = await digestStringAsync(
        CryptoDigestAlgorithm.SHA256,
        codeVerifier,
        { encoding: CryptoEncoding.BASE64 },
      );
      const codeChallenge = digest
        .replaceAll("+", "-")
        .replaceAll("/", "_")
        .replace(/=+$/, "");
      const redirectUri = makeRedirectUri({
        path: "auth/callback",
        scheme: "careergroove",
      });
      const start = new URL(absoluteApiUrl("/api/mobile/auth/oauth/start"));
      start.searchParams.set("provider", provider);
      start.searchParams.set("state", state);
      start.searchParams.set("code_challenge", codeChallenge);
      const result = await WebBrowser.openAuthSessionAsync(
        start.toString(),
        redirectUri,
      );
      if (result.type !== "success") throw new Error("Sign in was canceled");
      const callback = new URL(result.url);
      if (callback.searchParams.get("state") !== state) {
        throw new Error("Authorization state did not match");
      }
      const code = callback.searchParams.get("code");
      if (!code) throw new Error("Authorization code was missing");
      const session = await apiJson<{
        accessToken: string;
        refreshToken: string;
        accessTokenExpiresAt: string;
        refreshTokenExpiresAt: string;
        user: SessionUser;
      }>("/api/mobile/auth/oauth/exchange", {
        body: JSON.stringify({ code, codeVerifier, state }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      await apiClient.setTokens(session);
      setUser(session.user);
    },
    [],
  );

  const register = useCallback(
    async (name: string, email: string, password: string) => {
      await apiJson("/api/register", {
        body: JSON.stringify({ email, name, password }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      await signIn(email, password);
    },
    [signIn],
  );

  const value = useMemo(
    () => ({ isLoading, register, signIn, signInWithOAuth, signOut, user }),
    [isLoading, register, signIn, signInWithOAuth, signOut, user],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used within AuthProvider");
  return value;
}
