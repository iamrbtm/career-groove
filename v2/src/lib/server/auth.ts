import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { sveltekitCookies } from "better-auth/svelte-kit";
import { getRequestEvent } from "$app/server";
import { compare, hash } from "bcryptjs";
import { db } from "./db";
import { account, session, user, verification } from "./db/schema";

const knownOrigins = [
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  "http://localhost:3001",
  "http://127.0.0.1:3001",
];

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: { user, session, account, verification },
  }),
  secret: process.env.BETTER_AUTH_SECRET || process.env.AUTH_SECRET,
  baseURL: process.env.BETTER_AUTH_URL,
  trustedOrigins: (request) => {
    const origin = request?.headers.get("origin");
    return origin ? [...knownOrigins, origin] : knownOrigins;
  },
  emailAndPassword: {
    enabled: true,
    disableSignUp: true,
    minPasswordLength: 8,
    password: {
      hash: (password) => hash(password, 12),
      verify: ({ hash: stored, password }) => compare(password, stored),
    },
  },
  user: {
    additionalFields: {
      isAdmin: {
        type: "boolean",
        required: false,
        defaultValue: false,
        input: false,
      },
    },
  },
  session: {
    expiresIn: 60 * 60 * 24 * 30,
    updateAge: 60 * 60 * 24,
  },
  plugins: [sveltekitCookies(getRequestEvent)],
});

export type AuthUser = {
  id: string;
  name: string;
  email: string;
  image?: string | null;
  isAdmin?: boolean;
};

export async function getSessionUser(headers: Headers): Promise<AuthUser | null> {
  const result = await auth.api.getSession({ headers });
  if (!result?.user) return null;
  const u = result.user as AuthUser;
  return u;
}
