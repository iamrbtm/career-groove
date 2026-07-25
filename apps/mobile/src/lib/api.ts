import { Platform } from "react-native";

import { SessionClient } from "./session-client";
import { tokenStore } from "./token-store";

const configuredUrl = process.env.EXPO_PUBLIC_API_URL;
if (!configuredUrl && !__DEV__) {
  throw new Error("EXPO_PUBLIC_API_URL is required in production");
}

const developmentUrl =
  Platform.OS === "android" ? "http://10.0.2.2:3001" : "http://localhost:3001";

export const apiClient = new SessionClient({
  baseUrl: configuredUrl ?? developmentUrl,
  store: tokenStore,
});

export async function apiJson<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const response = await apiClient.request(path, init);
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const message =
      payload &&
      typeof payload === "object" &&
      "error" in payload &&
      typeof payload.error === "object" &&
      payload.error &&
      "message" in payload.error
        ? String(payload.error.message)
        : "Request failed";
    throw new Error(message);
  }
  return payload as T;
}
