import {
  tokenPairSchema,
  type TokenPair,
} from "@career-groove/shared";

export interface TokenStore {
  clear(): Promise<void>;
  load(): Promise<TokenPair | null>;
  save(tokens: TokenPair): Promise<void>;
}

interface SessionClientOptions {
  baseUrl: string;
  store: TokenStore;
  transport?: typeof fetch;
}

export class SessionClient {
  readonly #baseUrl: string;
  readonly #store: TokenStore;
  readonly #transport: typeof fetch;
  #tokens: TokenPair | null | undefined;
  #refreshPromise: Promise<TokenPair> | null = null;

  constructor({
    baseUrl,
    store,
    transport = fetch.bind(globalThis),
  }: SessionClientOptions) {
    this.#baseUrl = baseUrl.replace(/\/$/, "");
    this.#store = store;
    this.#transport = transport;
  }

  async #currentTokens(): Promise<TokenPair | null> {
    if (this.#tokens !== undefined) return this.#tokens;
    this.#tokens = await this.#store.load();
    return this.#tokens;
  }

  async #refresh(refreshToken: string): Promise<TokenPair> {
    if (!this.#refreshPromise) {
      this.#refreshPromise = (async () => {
        const response = await this.#transport(
          `${this.#baseUrl}/api/mobile/auth/refresh`,
          {
            body: JSON.stringify({ refreshToken }),
            headers: { "Content-Type": "application/json" },
            method: "POST",
          },
        );
        if (!response.ok) {
          this.#tokens = null;
          await this.#store.clear();
          throw new Error("Session expired");
        }
        const tokens = tokenPairSchema.parse(await response.json());
        this.#tokens = tokens;
        await this.#store.save(tokens);
        return tokens;
      })().finally(() => {
        this.#refreshPromise = null;
      });
    }
    return this.#refreshPromise;
  }

  async request(path: string, init: RequestInit = {}): Promise<Response> {
    const tokens = await this.#currentTokens();
    const headers: Record<string, string> = {
      Accept: "application/json",
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...(tokens ? { Authorization: `Bearer ${tokens.accessToken}` } : {}),
      ...Object.fromEntries(new Headers(init.headers).entries()),
    };
    const response = await this.#transport(`${this.#baseUrl}${path}`, {
      ...init,
      headers,
    });
    if (
      response.status !== 401 ||
      !tokens ||
      path.startsWith("/api/mobile/auth/")
    ) {
      return response;
    }

    const refreshed = await this.#refresh(tokens.refreshToken);
    return this.#transport(`${this.#baseUrl}${path}`, {
      ...init,
      headers: {
        ...headers,
        Authorization: `Bearer ${refreshed.accessToken}`,
      },
    });
  }

  async setTokens(tokens: TokenPair): Promise<void> {
    this.#tokens = tokenPairSchema.parse(tokens);
    await this.#store.save(this.#tokens);
  }

  async signOut(): Promise<void> {
    const tokens = await this.#currentTokens();
    if (tokens) {
      await this.#transport(`${this.#baseUrl}/api/mobile/auth/signout`, {
        body: JSON.stringify({ refreshToken: tokens.refreshToken }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      }).catch(() => undefined);
    }
    this.#tokens = null;
    await this.#store.clear();
  }
}
