import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import GitHub from "next-auth/providers/github";
import Apple from "next-auth/providers/apple";
import Credentials from "next-auth/providers/credentials";
import Passkey from "next-auth/providers/passkey";
import PostgresAdapter from "@auth/pg-adapter";
import { compare } from "bcryptjs";
import { z } from "zod";
import { db } from "@/lib/db";
import type { Adapter, AdapterAuthenticator } from "next-auth/adapters";

function CareerGrooveAdapter(): Adapter {
  return {
    ...PostgresAdapter(db),
    async createAuthenticator(authenticator: AdapterAuthenticator) {
      const a = authenticator;
      const result = await db.query(`INSERT INTO authenticators ("credentialID","userId","providerAccountId","credentialPublicKey",counter,"credentialDeviceType","credentialBackedUp",transports) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`, [a.credentialID,a.userId,a.providerAccountId,a.credentialPublicKey,a.counter,a.credentialDeviceType,a.credentialBackedUp,a.transports]);
      return result.rows[0];
    },
    async getAuthenticator(credentialID) { const r=await db.query(`SELECT * FROM authenticators WHERE "credentialID"=$1`,[credentialID]); return r.rows[0]??null; },
    async listAuthenticatorsByUserId(userId) { const r=await db.query(`SELECT * FROM authenticators WHERE "userId"=$1`,[userId]); return r.rows; },
    async updateAuthenticatorCounter(credentialID,newCounter) { const r=await db.query(`UPDATE authenticators SET counter=$2 WHERE "credentialID"=$1 RETURNING *`,[credentialID,newCounter]); if(!r.rows[0])throw new Error("Authenticator not found"); return r.rows[0]; },
  };
}

const enabled = (id?: string, secret?: string) => Boolean(id && secret);
const providers = [
  ...(enabled(process.env.AUTH_GOOGLE_ID, process.env.AUTH_GOOGLE_SECRET) ? [Google] : []),
  ...(enabled(process.env.AUTH_GITHUB_ID, process.env.AUTH_GITHUB_SECRET) ? [GitHub] : []),
  ...(enabled(process.env.AUTH_APPLE_ID, process.env.AUTH_APPLE_SECRET) ? [Apple] : []),
  ...(process.env.AUTH_EXPERIMENTAL_ENABLE_PASSKEYS === "true" ? [Passkey] : []),
  Credentials({
    credentials: { email: { label: "Email", type: "email" }, password: { label: "Password", type: "password" } },
    async authorize(raw) {
      const input = z.object({ email: z.string().email(), password: z.string().min(8) }).safeParse(raw);
      if (!input.success) return null;
      const result = await db.query("SELECT id, name, email, image, password_hash FROM users WHERE email = $1", [input.data.email]);
      const user = result.rows[0];
      if (!user?.password_hash || !(await compare(input.data.password, user.password_hash))) return null;
      return { id: user.id, name: user.name, email: user.email, image: user.image };
    },
  }),
];

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: CareerGrooveAdapter(), providers, session: { strategy: "jwt" },
  // Derive the canonical URL from Host/X-Forwarded-* so the same container can
  // serve HTTPS behind Nginx and direct HTTP connections on a trusted LAN.
  trustHost: true,
  experimental: { enableWebAuthn: process.env.AUTH_EXPERIMENTAL_ENABLE_PASSKEYS === "true" },
  pages: { signIn: "/signin" },
  callbacks: {
    jwt({ token, user }) {
      if (user?.id) token.userId = user.id;
      return token;
    },
    session({ session, token }) {
      if (session.user && token.userId) session.user.id = String(token.userId);
      return session;
    },
  },
});
