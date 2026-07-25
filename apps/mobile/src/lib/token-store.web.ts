import { tokenPairSchema, type TokenPair } from "@career-groove/shared";

import type { TokenStore } from "./session-client";

const key = "career-groove.session.v1";

export const tokenStore: TokenStore = {
  async clear() {
    globalThis.sessionStorage?.removeItem(key);
  },
  async load() {
    const value = globalThis.sessionStorage?.getItem(key);
    if (!value) return null;
    const parsed = tokenPairSchema.safeParse(JSON.parse(value));
    if (!parsed.success) {
      globalThis.sessionStorage?.removeItem(key);
      return null;
    }
    return parsed.data;
  },
  async save(tokens: TokenPair) {
    globalThis.sessionStorage?.setItem(key, JSON.stringify(tokens));
  },
};
