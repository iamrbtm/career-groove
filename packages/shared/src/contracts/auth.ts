import { z } from "zod";

import { timestampSchema } from "./common.js";

export const credentialsLoginSchema = z
  .object({
    email: z.string().trim().toLowerCase().email().max(320),
    password: z.string().min(8).max(1_024),
    deviceName: z.string().trim().max(100).optional(),
    platform: z.enum(["ios", "android", "web"]).optional(),
  })
  .strict();

export const tokenRefreshSchema = z
  .object({
    refreshToken: z.string().startsWith("cg_refresh_").max(256),
  })
  .strict();

export const tokenPairSchema = z.object({
  accessToken: z.string().startsWith("cg_access_").max(256),
  refreshToken: z.string().startsWith("cg_refresh_").max(256),
  accessTokenExpiresAt: timestampSchema,
  refreshTokenExpiresAt: timestampSchema,
});

export const oauthExchangeSchema = z
  .object({
    provider: z.enum(["google", "github", "apple"]),
    code: z.string().min(32).max(512),
    codeVerifier: z.string().min(43).max(128),
    redirectUri: z.string().url().max(2_048),
  })
  .strict();

export type TokenPair = z.infer<typeof tokenPairSchema>;
