import { z } from "zod";
export declare const credentialsLoginSchema: z.ZodObject<{
    email: z.ZodString;
    password: z.ZodString;
    deviceName: z.ZodOptional<z.ZodString>;
    platform: z.ZodOptional<z.ZodEnum<["ios", "android", "web"]>>;
}, "strict", z.ZodTypeAny, {
    email: string;
    password: string;
    deviceName?: string | undefined;
    platform?: "ios" | "android" | "web" | undefined;
}, {
    email: string;
    password: string;
    deviceName?: string | undefined;
    platform?: "ios" | "android" | "web" | undefined;
}>;
export declare const tokenRefreshSchema: z.ZodObject<{
    refreshToken: z.ZodString;
}, "strict", z.ZodTypeAny, {
    refreshToken: string;
}, {
    refreshToken: string;
}>;
export declare const tokenPairSchema: z.ZodObject<{
    accessToken: z.ZodString;
    refreshToken: z.ZodString;
    accessTokenExpiresAt: z.ZodString;
    refreshTokenExpiresAt: z.ZodString;
}, "strip", z.ZodTypeAny, {
    refreshToken: string;
    accessToken: string;
    accessTokenExpiresAt: string;
    refreshTokenExpiresAt: string;
}, {
    refreshToken: string;
    accessToken: string;
    accessTokenExpiresAt: string;
    refreshTokenExpiresAt: string;
}>;
export declare const oauthExchangeSchema: z.ZodObject<{
    provider: z.ZodEnum<["google", "github", "apple"]>;
    code: z.ZodString;
    codeVerifier: z.ZodString;
    redirectUri: z.ZodString;
}, "strict", z.ZodTypeAny, {
    code: string;
    provider: "google" | "github" | "apple";
    codeVerifier: string;
    redirectUri: string;
}, {
    code: string;
    provider: "google" | "github" | "apple";
    codeVerifier: string;
    redirectUri: string;
}>;
export type TokenPair = z.infer<typeof tokenPairSchema>;
//# sourceMappingURL=auth.d.ts.map