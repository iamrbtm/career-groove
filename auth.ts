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
  adapter: PostgresAdapter(db), providers, session: { strategy: "jwt" },
  experimental: { enableWebAuthn: process.env.AUTH_EXPERIMENTAL_ENABLE_PASSKEYS === "true" },
  pages: { signIn: "/signin" },
});
