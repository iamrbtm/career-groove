import * as SecureStore from "expo-secure-store";

import { tokenPairSchema, type TokenPair } from "@career-groove/shared";

import type { TokenStore } from "./session-client";

const key = "career-groove.session.v1";
const options: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK,
};

export const tokenStore: TokenStore = {
  async clear() {
    await SecureStore.deleteItemAsync(key, options);
  },
  async load() {
    const value = await SecureStore.getItemAsync(key, options);
    if (!value) return null;
    const parsed = tokenPairSchema.safeParse(JSON.parse(value));
    if (!parsed.success) {
      await SecureStore.deleteItemAsync(key, options);
      return null;
    }
    return parsed.data;
  },
  async save(tokens: TokenPair) {
    await SecureStore.setItemAsync(key, JSON.stringify(tokens), options);
  },
};
