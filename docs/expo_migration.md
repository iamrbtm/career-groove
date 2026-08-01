# Expo Migration Implementation Plan

> **For agentic workers:** Execute this plan task-by-task. Each task ends with a git push. Docker containers rebuild where noted.

**Goal:** Migrate CareerGroove from Next.js + SwiftUI to Expo (iOS/Android/Web) + Hono API backend with OAuth2 PKCE auth. All services remain Docker-ized with nginx routing.

**Architecture:** Turborepo monorepo — `apps/mobile` (Expo), `packages/api` (Hono), `packages/shared` (Zod schemas/types). nginx routes `/api/*` to Hono, `/` to Expo web static build. Workers (document gen, notifications, backup) stay unchanged.

**Tech Stack:** Expo SDK 52+, Expo Router 4, NativeWind 4, TanStack React Query, react-native-reanimated, Hono 4, Zod, PostgreSQL, Turborepo, Docker

---

## File Structure Overview

**Root:** `turbo.json` (CREATE), `package.json` (MODIFY — add workspaces), `tsconfig.json` (CREATE)
**Docker:** `docker-compose.yml` (MODIFY), `deploy/nginx.conf` (MODIFY), `packages/api/Dockerfile` (CREATE)
**`packages/shared/`:** `package.json`, `tsconfig.json`, `src/schemas/*.ts`, `src/types/index.ts`, `src/utils/index.ts`
**`packages/api/`:** `package.json`, `tsconfig.json`, `Dockerfile`, `src/index.ts`, `src/lib/*.ts`, `src/middleware/*.ts`, `src/routes/*.ts` (one per route group, 25+ files)
**`apps/mobile/`:** `package.json`, `app.json`, `tsconfig.json`, `babel.config.js`, `metro.config.js`, `nativewind-env.d.ts`, `app/_layout.tsx`, `app/index.tsx`, `app/(auth)/*`, `app/(tabs)/*`, `components/*`, `lib/*`, `providers/*`

---

## Task 1: Scaffold Turborepo + Shared Package

**Files:**
- CREATE `turbo.json`
- CREATE `packages/shared/package.json`
- CREATE `packages/shared/tsconfig.json`
- CREATE `packages/shared/src/types/index.ts`
- CREATE `packages/shared/src/utils/index.ts`
- MODIFY `package.json` (add workspaces key, turbo devDep)

**Step 1: Create `turbo.json`**

```json
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "build": { "dependsOn": ["^build"], "outputs": ["dist/**"] },
    "typecheck": { "dependsOn": ["^build"] },
    "lint": {},
    "dev": { "cache": false, "persistent": true }
  }
}
```

**Step 2: Update root `package.json`**

Add `"workspaces": ["apps/*", "packages/*"]`, `"private": true`. Add `"turbo"` to devDependencies.

**Step 3: Create root `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  }
}
```

**Step 4: Create `packages/shared/package.json`**

```json
{
  "name": "@career-groove/shared",
  "version": "0.1.0",
  "private": true,
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "dependencies": { "zod": "^3.25.76" },
  "devDependencies": { "typescript": "^5.8.3" }
}
```

**Step 5: Create `packages/shared/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": { "outDir": "./dist", "rootDir": "./src" },
  "include": ["src"]
}
```

**Step 6: Create `packages/shared/src/types/index.ts`**

Migrate all TypeScript types from `types/next-auth.d.ts` and inline types across the codebase:

```ts
export type AIProvider = "openai" | "anthropic" | "google" | "ollama";

export interface Job {
  id: string; userId: string; company: string; title: string;
  location: string | null; startedOn: string | null; endedOn: string | null;
  current: boolean; rawNotes: string | null;
  achievements: any[]; metadata: Record<string, any>;
  createdAt: string; updatedAt: string;
}

export interface Contact { /* fields from db/schema.sql contacts table */ }
export interface Residence { /* fields from residences table */ }
export interface Credential { /* fields from credentials table */ }
export interface Skill { /* fields from skills table */ }
export interface Application { /* fields from applications table */ }
export interface ApplicationEvent { /* fields from application_events */ }
export interface ApplicationInterview { /* fields */ }
export interface ApplicationScore { /* fields */ }
export interface ApplicationOutcome { /* fields */ }
export interface Document { /* fields from documents table */ }
export interface DocumentGenerationJob { /* fields */ }
export interface ProviderConnection { /* fields */ }
export interface UserPreferences { /* JSONB shape */ }
export interface MobileTokenPair {
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresAt: string;
  refreshTokenExpiresAt: string;
}
```

**Step 7: Create `packages/shared/src/utils/index.ts`**

```ts
export function cn(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(" ");
}

export const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || "http://localhost:3001";
export const APP_NAME = "CareerGroove";
```

**Step 8: Create `packages/shared/src/index.ts`** (barrel export)

```ts
export * from "./types";
export * from "./utils";
export * from "./schemas/jobs";
export * from "./schemas/contacts";
export * from "./schemas/residences";
export * from "./schemas/credentials";
export * from "./schemas/skills";
export * from "./schemas/applications";
export * from "./schemas/documents";
export * from "./schemas/settings";
export * from "./schemas/auth";
```

**Step 9: Verify**

```bash
cd packages/shared && npx tsc --noEmit
```

**Step 10: Commit and push**

```bash
git add -A && git commit -m "feat: scaffold turborepo monorepo with shared types package"
git push
```

---

## Task 2: Migrate Zod Schemas to Shared Package

**Files:**
- CREATE `packages/shared/src/schemas/jobs.ts`
- CREATE `packages/shared/src/schemas/contacts.ts`
- CREATE `packages/shared/src/schemas/residences.ts`
- CREATE `packages/shared/src/schemas/credentials.ts`
- CREATE `packages/shared/src/schemas/skills.ts`
- CREATE `packages/shared/src/schemas/applications.ts`
- CREATE `packages/shared/src/schemas/documents.ts`
- CREATE `packages/shared/src/schemas/settings.ts`
- CREATE `packages/shared/src/schemas/auth.ts`
- MODIFY `packages/shared/package.json` (add zod — already added in Task 1)

**Pattern for each schema file (example: `jobs.ts`):**

```ts
import { z } from "zod";

export const JobSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  company: z.string().min(1),
  title: z.string().min(1),
  location: z.string().nullable().optional(),
  startedOn: z.string().nullable().optional(),
  endedOn: z.string().nullable().optional(),
  current: z.boolean().default(false),
  rawNotes: z.string().nullable().optional(),
  achievements: z.array(z.any()).default([]),
  metadata: z.record(z.any()).default({}),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const CreateJobSchema = JobSchema.omit({ id: true, userId: true, createdAt: true, updatedAt: true });
export const UpdateJobSchema = CreateJobSchema.partial();

export type Job = z.infer<typeof JobSchema>;
export type CreateJobInput = z.infer<typeof CreateJobSchema>;
export type UpdateJobInput = z.infer<typeof UpdateJobSchema>;
```

Source field definitions from `db/schema.sql` and existing Next.js API routes. Create the same pattern for each domain. The `applications` schema is the most complex — include sub-schemas for events, interviews, scores, outcomes, contacts, documents, answers.

**Auth schemas (`auth.ts`):**

```ts
import { z } from "zod";

export const CredentialsLoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

export const OAuthExchangeSchema = z.object({
  provider: z.enum(["google", "github", "apple"]),
  code: z.string(),
  codeVerifier: z.string(),
  redirectUri: z.string().url(),
});

export const TokenRefreshSchema = z.object({
  refreshToken: z.string().min(1),
});

export const TokenPairSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
  accessTokenExpiresAt: z.string(),
  refreshTokenExpiresAt: z.string(),
});
```

**Verify:** `cd packages/shared && npx tsc --noEmit`

**Commit/push:** `feat: add shared zod schemas migrated from api routes`

---

## Task 3: Scaffold Hono API Package

**Files:**
- CREATE `packages/api/package.json`
- CREATE `packages/api/tsconfig.json`
- CREATE `packages/api/Dockerfile`
- CREATE `packages/api/src/index.ts`
- CREATE `packages/api/src/lib/db.ts`
- CREATE `packages/api/src/middleware/auth.ts`
- CREATE `packages/api/src/middleware/cors.ts`

**Step 1: Create `packages/api/package.json`**

```json
{
  "name": "@career-groove/api",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node --enable-source-maps dist/index.js"
  },
  "dependencies": {
    "hono": "^4.7.0",
    "@hono/node-server": "^1.13.0",
    "@hono/zod-validator": "^0.4.0",
    "zod": "^3.25.76",
    "pg": "^8.16.3",
    "@ai-sdk/openai": "^1.3.24",
    "@ai-sdk/anthropic": "^1.2.12",
    "@ai-sdk/google": "^1.2.22",
    "ai": "^4.3.16",
    "bcryptjs": "^3.0.2",
    "stripe": "^22.3.2",
    "@octokit/rest": "^21.1.1",
    "pdf-lib": "^1.17.1",
    "@simplewebauthn/server": "^9.0.3",
    "jsonwebtoken": "^9.0.0",
    "@career-groove/shared": "*"
  },
  "devDependencies": {
    "typescript": "^5.8.3",
    "tsx": "^4.19.0",
    "@types/node": "^22.16.4",
    "@types/pg": "^8.15.4",
    "@types/bcryptjs": "^2.4.6",
    "@types/jsonwebtoken": "^9.0.0"
  }
}
```

**Step 2: Create `packages/api/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "target": "ES2022"
  },
  "include": ["src"]
}
```

**Step 3: Create `packages/api/Dockerfile`**

```dockerfile
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production PORT=3001
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY package.json ./
EXPOSE 3001
CMD ["node", "--enable-source-maps", "dist/index.js"]
```

**Step 4: Create `packages/api/src/lib/db.ts`**

```ts
import { Pool } from "pg";

export const db = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
});
```

**Step 5: Create `packages/api/src/middleware/auth.ts`**

```ts
import { createMiddleware } from "hono/factory";
import { createHash } from "node:crypto";
import { db } from "../lib/db.js";

function digest(value: string) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

export const authMiddleware = createMiddleware<{ Variables: { userId: string } }>(async (c, next) => {
  const header = c.req.header("Authorization");
  const match = header?.match(/^Bearer ([A-Za-z0-9_-]+)$/);
  if (!match) return c.json({ error: "unauthorized" }, 401);

  const result = await db.query<{ user_id: string }>(
    `SELECT user_id FROM mobile_sessions
     WHERE access_token_hash=$1 AND revoked_at IS NULL
       AND access_expires_at > now() AND refresh_expires_at > now()`,
    [digest(match[1])],
  );
  if (!result.rows[0]) return c.json({ error: "invalid or expired token" }, 401);

  c.set("userId", result.rows[0].user_id);
  await next();
});
```

**Step 6: Create `packages/api/src/index.ts`**

```ts
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { healthRoutes } from "./routes/health.js";

const app = new Hono();

app.use("*", cors({ origin: "*", credentials: true }));
app.route("/api/health", healthRoutes);

// Subsequent tasks will mount additional routes here

serve({
  fetch: app.fetch,
  port: Number(process.env.PORT) || 3001,
});

console.log(`API server running on port ${Number(process.env.PORT) || 3001}`);
```

**Step 7: Create `packages/api/src/routes/health.ts`**

```ts
import { Hono } from "hono";

export const healthRoutes = new Hono()
  .get("/", (c) => c.json({ status: "ok", timestamp: new Date().toISOString() }));
```

**Step 8: Build and test**

```bash
cd packages/api && npm run build
node dist/index.js &
curl http://localhost:3001/api/health
# Expected: {"status":"ok","timestamp":"..."}
```

> **Docker rebuild:** After this task, run `docker compose build api` to verify the Dockerfile works.

**Commit/push:** `feat: scaffold hono api server with auth middleware and health endpoint`

---

## Task 4: Migrate Core CRUD Routes

**Files:**
- CREATE `packages/api/src/routes/jobs.ts`
- CREATE `packages/api/src/routes/contacts.ts`
- CREATE `packages/api/src/routes/residences.ts`
- CREATE `packages/api/src/routes/credentials.ts`
- CREATE `packages/api/src/routes/skills.ts`
- MODIFY `packages/api/src/index.ts` (mount routes)

**Pattern for each CRUD route (example: `jobs.ts`):**

```ts
import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { db } from "../lib/db.js";
import { authMiddleware } from "../middleware/auth.js";
import { CreateJobSchema, UpdateJobSchema } from "@career-groove/shared";

export const jobsRoutes = new Hono()
  .use("*", authMiddleware)

  .get("/", async (c) => {
    const userId = c.get("userId");
    const result = await db.query(
      "SELECT * FROM jobs WHERE user_id=$1 ORDER BY started_on DESC NULLS LAST",
      [userId],
    );
    return c.json(result.rows);
  })

  .get("/:id", async (c) => {
    const userId = c.get("userId");
    const { id } = c.req.param();
    const result = await db.query(
      "SELECT * FROM jobs WHERE id=$1 AND user_id=$2",
      [id, userId],
    );
    if (!result.rows[0]) return c.json({ error: "not found" }, 404);
    return c.json(result.rows[0]);
  })

  .post("/", zValidator("json", CreateJobSchema), async (c) => {
    const userId = c.get("userId");
    const body = c.req.valid("json");
    const result = await db.query(
      `INSERT INTO jobs (user_id, company, title, location, started_on, ended_on, current, raw_notes, achievements, metadata)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [userId, body.company, body.title, body.location, body.startedOn, body.endedOn,
       body.current, body.rawNotes, JSON.stringify(body.achievements), JSON.stringify(body.metadata)],
    );
    return c.json(result.rows[0], 201);
  })

  .patch("/:id", zValidator("json", UpdateJobSchema), async (c) => {
    const userId = c.get("userId");
    const { id } = c.req.param();
    const body = c.req.valid("json");
    // Build dynamic UPDATE from provided fields
    const fields: string[] = [];
    const values: any[] = [];
    let idx = 2;
    if (body.company !== undefined) { fields.push(`company=$${idx++}`); values.push(body.company); }
    if (body.title !== undefined) { fields.push(`title=$${idx++}`); values.push(body.title); }
    // ... all updateable fields
    values.push(id, userId);
    const result = await db.query(
      `UPDATE jobs SET ${fields.join(", ")} WHERE id=$${idx} AND user_id=$${idx+1} RETURNING *`,
      values,
    );
    return c.json(result.rows[0] ?? { error: "not found" }, result.rows[0] ? 200 : 404);
  })

  .delete("/:id", async (c) => {
    const userId = c.get("userId");
    const { id } = c.req.param();
    await db.query("DELETE FROM jobs WHERE id=$1 AND user_id=$2", [id, userId]);
    return c.json({ success: true });
  });
```

Create the same pattern for contacts, residences, credentials, and skills. Each follows the same CRUD structure with domain-specific fields from the schema.

**Mount routes in `src/index.ts`:**

```ts
import { jobsRoutes } from "./routes/jobs.js";
import { contactsRoutes } from "./routes/contacts.js";
import { residencesRoutes } from "./routes/residences.js";
import { credentialsRoutes } from "./routes/credentials.js";
import { skillsRoutes } from "./routes/skills.js";

app.route("/api/jobs", jobsRoutes);
app.route("/api/contacts", contactsRoutes);
app.route("/api/residences", residencesRoutes);
app.route("/api/credentials", credentialsRoutes);
app.route("/api/skills", skillsRoutes);
```

**Test:**

```bash
cd packages/api && npm run dev &
curl -X POST http://localhost:3001/api/auth/credentials -H 'Content-Type: application/json' -d '{"email":"test@test.com","password":"test123"}'
# Use token to test CRUD
curl http://localhost:3001/api/jobs -H 'Authorization: Bearer <token>'
```

**Commit/push:** `feat: migrate core crud routes (jobs, contacts, residences, credentials, skills)`

---

## Task 5: Migrate Application Routes

**Files:**
- CREATE `packages/api/src/routes/applications.ts`
- CREATE `packages/api/src/routes/application-events.ts`
- CREATE `packages/api/src/routes/application-interviews.ts`
- CREATE `packages/api/src/routes/application-scores.ts`
- CREATE `packages/api/src/routes/application-outcomes.ts`
- CREATE `packages/api/src/routes/application-contacts.ts`
- CREATE `packages/api/src/routes/application-documents.ts`
- CREATE `packages/api/src/routes/application-answers.ts`
- CREATE `packages/api/src/routes/command-sessions.ts`
- CREATE `packages/api/src/routes/application-preferences.ts`
- CREATE `packages/api/src/routes/application-analytics.ts`
- CREATE `packages/api/src/routes/application-insights.ts`
- MODIFY `packages/api/src/index.ts` (mount routes)

Applications is the most complex domain. Each sub-resource gets its own route file. The pattern is the same as Task 4 but with more complex queries (joins, aggregates for analytics).

**`applications.ts` example (key routes):**

```ts
// GET /api/applications — list with filters (status, date range, search)
// POST /api/applications — create with auto-scoring trigger
// GET /api/applications/:id — full detail with events, scores, contacts
// PATCH /api/applications/:id — update status, fields
// DELETE /api/applications/:id — hard delete (application + all associated documents, cover letters, jobs, follow-ups; cascade)
```

Application analytics (`application-analytics.ts`) requires aggregate queries:

```ts
// GET /api/application-analytics — stats by status, funnel, timeline
analyticsRoutes.get("/", authMiddleware, async (c) => {
  const userId = c.get("userId");
  const statusCounts = await db.query(
    `SELECT status, COUNT(*) FROM applications WHERE user_id=$1 AND archived_at IS NULL GROUP BY status`,
    [userId],
  );
  const weeklyApps = await db.query(
    `SELECT DATE_TRUNC('week', created_at) AS week, COUNT(*) FROM applications WHERE user_id=$1 GROUP BY week ORDER BY week`,
    [userId],
  );
  return c.json({ statusCounts: statusCounts.rows, weeklyTrend: weeklyApps.rows });
});
```

Each file follows the same pattern: auth middleware, Zod validation from shared schemas, pg queries.

**Test:** Verify all application CRUD operations and analytics endpoints.

**Commit/push:** `feat: migrate application routes (events, interviews, scores, outcomes, analytics)`

---

## Task 6: Migrate Settings, Providers, Profile, GitHub

**Files:**
- CREATE `packages/api/src/routes/settings.ts`
- CREATE `packages/api/src/routes/providers.ts`
- CREATE `packages/api/src/routes/profile.ts`
- CREATE `packages/api/src/lib/github.ts`
- CREATE `packages/api/src/lib/secret-box.ts`
- MODIFY `packages/api/src/index.ts` (mount routes)

**`lib/secret-box.ts`** — AES-256-GCM encryption for provider API keys:

```ts
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const ALGORITHM = "aes-256-gcm";

function getKey(): Buffer {
  const key = process.env.PROVIDER_ENCRYPTION_KEY || process.env.AUTH_SECRET || "";
  return createHash("sha256").update(key).digest();
}

export function encrypt(plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("base64")}.${tag.toString("base64")}.${encrypted.toString("base64")}`;
}

export function decrypt(ciphertext: string): string {
  const [ivB64, tagB64, dataB64] = ciphertext.split(".");
  const decipher = createDecipheriv(ALGORITHM, getKey(), Buffer.from(ivB64, "base64"));
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));
  return decipher.update(Buffer.from(dataB64, "base64"), undefined, "utf8") + decipher.final("utf8");
}
```

**`routes/providers.ts`:** CRUD for provider connections with live model discovery. Test by connecting to OpenAI and verifying available models are returned.

**`routes/settings.ts`:** GET/PUT user preferences JSONB (AI provider choice, music settings, motion preferences).

**`routes/profile.ts`:** User profile GET/PUT.

**`lib/github.ts`:** Octokit wrapper for issue creation and project board integration.

**Test:** Verify settings CRUD, provider connection with key encryption, profile updates.

**Commit/push:** `feat: migrate settings, providers, profile, and github routes`

---

## Task 7: Migrate Documents + AI Routes

**Files:**
- CREATE `packages/api/src/routes/documents.ts`
- CREATE `packages/api/src/routes/document-jobs.ts`
- CREATE `packages/api/src/routes/ai.ts`
- CREATE `packages/api/src/lib/ai.ts`
- CREATE `packages/api/src/lib/resume-pdf.ts`
- CREATE `packages/api/src/lib/job-post-parser.ts`
- MODIFY `packages/api/src/index.ts` (mount routes)

**`lib/ai.ts`:** Provider model factory — same as current Next.js `lib/ai.ts`:

```ts
import { createOpenAI } from "@ai-sdk/openai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";

export type AIProvider = "openai" | "anthropic" | "google" | "ollama";

export function getModel(provider: AIProvider, model?: string, apiKey?: string, baseUrl?: string) {
  switch (provider) {
    case "anthropic": return createAnthropic({ apiKey })(model ?? "claude-3-5-sonnet-latest");
    case "google": return createGoogleGenerativeAI({ apiKey })(model ?? "gemini-2.0-flash");
    case "ollama": return createOpenAI({
      baseURL: `${(baseUrl ?? "http://localhost:11434").replace(/\/api\/?$/, "").replace(/\/$/, "")}/v1`,
      apiKey: apiKey ?? "ollama",
    })(model ?? "llama3.2");
    default: return createOpenAI({ apiKey })(model ?? "gpt-4o-mini");
  }
}
```

**`routes/ai.ts`** — streaming endpoints:

```ts
import { Hono } from "hono";
import { stream } from "hono/streaming";
import { streamText } from "ai";
import { db } from "../lib/db.js";
import { authMiddleware } from "../middleware/auth.js";
import { getModel } from "../lib/ai.js";
import { decrypt } from "../lib/secret-box.js";

export const aiRoutes = new Hono()
  .use("*", authMiddleware)

  .post("/interviewer", async (c) => {
    const userId = c.get("userId");
    const { messages, provider, model } = await c.req.json();

    // Get user's provider config if they have one
    const provResult = await db.query(
      "SELECT encrypted_api_key, base_url FROM provider_connections WHERE user_id=$1 AND provider=$2 AND active=true",
      [userId, provider],
    );
    const apiKey = provResult.rows[0]?.encrypted_api_key
      ? decrypt(provResult.rows[0].encrypted_api_key)
      : undefined;

    const streamingResult = streamText({
      model: getModel(provider, model, apiKey, provResult.rows[0]?.base_url),
      messages,
    });

    return stream(c, async (ws) => {
      for await (const chunk of streamingResult.textStream) {
        ws.write(chunk);
      }
    });
  })

  // POST /ai/mock-interview — same pattern
  // POST /ai/resume — generate resume text
  // POST /ai/cover-letter — generate cover letter
  .post("/resume", async (c) => {
    const userId = c.get("userId");
    const { jobDescription, provider, model } = await c.req.json();
    // Fetch user's work history, build prompt, stream result
    const jobs = await db.query(
      "SELECT * FROM jobs WHERE user_id=$1 ORDER BY started_on DESC",
      [userId],
    );
    const prompt = `Create a resume tailored to this job...`;
    const result = streamText({ model: getModel(provider, model), messages: [{ role: "user", content: prompt }] });
    return stream(c, async (ws) => { for await (const chunk of result.textStream) ws.write(chunk); });
  });
```

**`routes/documents.ts`:** CRUD for saved resume/cover-letter/other documents with JSONB content.

**`routes/document-jobs.ts`:** Queue-based document generation. Submit job → worker picks it up → status callback.

**Test:** Verify streaming AI responses work with curl, document CRUD operations.

> **Docker rebuild:** After this task, rebuild the API container to ensure it starts correctly.

**Commit/push:** `feat: migrate documents, ai streaming, and pdf routes`

---

## Task 8: Implement OAuth2 PKCE Auth Routes

**Files:**
- CREATE `packages/api/src/routes/auth/credentials.ts`
- CREATE `packages/api/src/routes/auth/oauth.ts`
- CREATE `packages/api/src/routes/auth/passkey.ts`
- CREATE `packages/api/src/routes/auth/token.ts`
- CREATE `packages/api/src/lib/mobile-auth.ts`
- CREATE `packages/api/src/lib/credentials-auth.ts`
- MODIFY `packages/api/src/index.ts` (mount /api/auth/*)

**`lib/mobile-auth.ts`:** (same as current `lib/mobile-auth.ts`)

```ts
import { createHash, randomBytes } from "node:crypto";
import { db } from "../lib/db.js";

const ACCESS_TTL_MS = 15 * 60 * 1000;
const REFRESH_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const ACCESS_PREFIX = "cg_access_";
const REFRESH_PREFIX = "cg_refresh_";

function digest(value: string) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function token(prefix: string) {
  return `${prefix}${randomBytes(32).toString("base64url")}`;
}

export async function createMobileSession(
  userId: string,
  details: { deviceName?: string; platform?: string } = {},
) {
  const accessToken = token(ACCESS_PREFIX);
  const refreshToken = token(REFRESH_PREFIX);
  const accessTokenExpiresAt = new Date(Date.now() + ACCESS_TTL_MS);
  const refreshTokenExpiresAt = new Date(Date.now() + REFRESH_TTL_MS);

  await db.query(
    `INSERT INTO mobile_sessions (user_id, access_token_hash, refresh_token_hash, access_expires_at, refresh_expires_at, device_name, platform)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [userId, digest(accessToken), digest(refreshToken), accessTokenExpiresAt, refreshTokenExpiresAt,
     details.deviceName?.slice(0, 120) || null, details.platform?.slice(0, 40) || "expo"],
  );

  return {
    accessToken, refreshToken,
    accessTokenExpiresAt: accessTokenExpiresAt.toISOString(),
    refreshTokenExpiresAt: refreshTokenExpiresAt.toISOString(),
  };
}

export async function rotateMobileSession(value: string) {
  if (!value.startsWith(REFRESH_PREFIX) || value.length > 256) return null;
  const accessToken = token(ACCESS_PREFIX);
  const refreshToken = token(REFRESH_PREFIX);
  const accessTokenExpiresAt = new Date(Date.now() + ACCESS_TTL_MS);
  const refreshTokenExpiresAt = new Date(Date.now() + REFRESH_TTL_MS);

  const result = await db.query(
    `UPDATE mobile_sessions SET access_token_hash=$2, previous_refresh_token_hash=refresh_token_hash,
     refresh_token_hash=$3, access_expires_at=$4, refresh_expires_at=$5, last_used_at=now(), updated_at=now()
     WHERE refresh_token_hash=$1 AND revoked_at IS NULL AND refresh_expires_at > now()
     RETURNING id`,
    [digest(value), digest(accessToken), digest(refreshToken), accessTokenExpiresAt, refreshTokenExpiresAt],
  );
  if (!result.rowCount) {
    await db.query(
      `UPDATE mobile_sessions SET revoked_at=now(), updated_at=now()
       WHERE previous_refresh_token_hash=$1 AND revoked_at IS NULL`,
      [digest(value)],
    );
    return null;
  }
  return { accessToken, refreshToken, accessTokenExpiresAt: accessTokenExpiresAt.toISOString(), refreshTokenExpiresAt: refreshTokenExpiresAt.toISOString() };
}

export async function revokeMobileSession(refreshToken: string) {
  if (!refreshToken.startsWith(REFRESH_PREFIX)) return;
  await db.query("UPDATE mobile_sessions SET revoked_at=now(), updated_at=now() WHERE refresh_token_hash=$1", [digest(refreshToken)]);
}
```

**`routes/auth/credentials.ts`:**

```ts
import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { db } from "../../lib/db.js";
import { createMobileSession } from "../../lib/mobile-auth.js";
import { verifyCredentials } from "../../lib/credentials-auth.js";
import { CredentialsLoginSchema } from "@career-groove/shared";

export const credentialsAuthRoutes = new Hono()
  .post("/credentials", zValidator("json", CredentialsLoginSchema), async (c) => {
    const { email, password } = c.req.valid("json");
    const user = await verifyCredentials(email, password);
    if (!user) return c.json({ error: "Invalid credentials" }, 401);
    const tokens = await createMobileSession(user.id, { platform: "expo" });
    return c.json({ user: { id: user.id, name: user.name, email: user.email }, ...tokens });
  })

  .post("/register", zValidator("json", CredentialsLoginSchema), async (c) => {
    const { email, password } = c.req.valid("json");
    const hash = await bcrypt.hash(password, 12);
    const result = await db.query(
      `INSERT INTO users (email, password_hash, name) VALUES ($1, $2, $3) RETURNING id, name, email`,
      [email.toLowerCase().trim(), hash, email.split("@")[0]],
    );
    const user = result.rows[0];
    const tokens = await createMobileSession(user.id, { platform: "expo" });
    return c.json({ user, ...tokens }, 201);
  });
```

**`routes/auth/oauth.ts`:**

```ts
import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { db } from "../../lib/db.js";
import { createMobileSession } from "../../lib/mobile-auth.js";
import { OAuthExchangeSchema } from "@career-groove/shared";

export const oauthAuthRoutes = new Hono()
  .post("/oauth/exchange", zValidator("json", OAuthExchangeSchema), async (c) => {
    const { provider, code, codeVerifier, redirectUri } = c.req.valid("json");

    // Exchange authorization code with provider
    let providerUser: { id: string; email: string; name: string } | null = null;

    switch (provider) {
      case "google": {
        const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            code, client_id: process.env.AUTH_GOOGLE_ID!,
            client_secret: process.env.AUTH_GOOGLE_SECRET!,
            redirect_uri: redirectUri, grant_type: "authorization_code",
            code_verifier: codeVerifier,
          }),
        });
        const tokens = await tokenResponse.json();
        const userResponse = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
          headers: { Authorization: `Bearer ${tokens.access_token}` },
        });
        providerUser = await userResponse.json();
        break;
      }
      case "github": {
        // Same pattern with GitHub's token endpoint + user API
        break;
      }
      case "apple": {
        // Same pattern with Apple's token endpoint
        break;
      }
    }

    if (!providerUser?.email) return c.json({ error: "failed to authenticate" }, 401);

    // Find or create user by provider account
    const existing = await db.query(
      `SELECT u.id, u.name, u.email FROM users u
       JOIN accounts a ON a."userId" = u.id
       WHERE a.provider = $1 AND a."providerAccountId" = $2`,
      [provider, providerUser.id],
    );

    let userId: string;
    if (existing.rows[0]) {
      userId = existing.rows[0].id;
    } else {
      const newUser = await db.query(
        `INSERT INTO users (email, name) VALUES ($1, $2) RETURNING id`,
        [providerUser.email, providerUser.name],
      );
      userId = newUser.rows[0].id;
      await db.query(
        `INSERT INTO accounts ("userId", type, provider, "providerAccountId") VALUES ($1, 'oauth', $2, $3)`,
        [userId, provider, providerUser.id],
      );
    }

    const tokens = await createMobileSession(userId, { platform: "expo" });
    return c.json({ user: { id: userId, name: providerUser.name, email: providerUser.email }, ...tokens });
  });
```

**`routes/auth/token.ts`:**

```ts
import { Hono } from "hono";
import { rotateMobileSession, revokeMobileSession } from "../../lib/mobile-auth.js";

export const tokenAuthRoutes = new Hono()
  .post("/token/refresh", async (c) => {
    const { refreshToken } = await c.req.json();
    const tokens = await rotateMobileSession(refreshToken);
    if (!tokens) return c.json({ error: "session expired or revoked" }, 401);
    return c.json(tokens);
  })
  .post("/token/revoke", async (c) => {
    const { refreshToken } = await c.req.json();
    await revokeMobileSession(refreshToken);
    return c.json({ success: true });
  });
```

**`routes/auth/passkey.ts`:** WebAuthn registration + authentication using `@simplewebauthn/server`. Same logic as current Next.js auth implementation but as Hono routes.

**Mount in `index.ts`:**

```ts
app.route("/api/auth", credentialsAuthRoutes);
app.route("/api/auth", oauthAuthRoutes);
app.route("/api/auth", passkeyAuthRoutes);
app.route("/api/auth", tokenAuthRoutes);
```

**Test:** Full auth flow — register, login, token refresh, revoke. Verify protected routes work with new tokens.

**Commit/push:** `feat: implement oauth2 pkce auth with token rotation and passkeys`

---

## Task 9: Migrate Webhooks + Internal Routes

**Files:**
- CREATE `packages/api/src/routes/webhooks/stripe.ts`
- CREATE `packages/api/src/routes/webhooks/app-store.ts`
- CREATE `packages/api/src/routes/internal/mobile-notifications.ts`
- CREATE `packages/api/src/lib/stripe.ts`
- CREATE `packages/api/src/lib/app-store.ts`
- CREATE `packages/api/src/lib/apns.ts`
- MODIFY `packages/api/src/index.ts` (mount routes)

**`routes/webhooks/stripe.ts`:**

```ts
import { Hono } from "hono";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export const stripeWebhookRoutes = new Hono()
  .post("/stripe", async (c) => {
    const sig = c.req.header("stripe-signature");
    const body = await c.req.text();
    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(body, sig!, process.env.STRIPE_WEBHOOK_SECRET!);
    } catch {
      return c.json({ error: "invalid signature" }, 400);
    }

    switch (event.type) {
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        await db.query(
          `UPDATE users SET "stripeSubscriptionId"=$1, "stripePriceId"=$2, "stripeCurrentPeriodEnd"=$3, "subscriptionStatus"=$4
           WHERE "stripeCustomerId"=$5`,
          [sub.id, sub.items.data[0].price.id, new Date(sub.current_period_end * 1000), sub.status, sub.customer],
        );
        break;
      }
    }
    return c.json({ received: true });
  });
```

**`routes/webhooks/app-store.ts`:** App Store Server Notifications V2 handler. Verify signed payload using Apple root certificates, update subscription status.

**`routes/internal/mobile-notifications.ts`:** Internal endpoint called by the notification worker. Validates shared secret, delivers push via APNs.

**Test:** Webhook endpoints respond without errors (production testing requires real events).

**Commit/push:** `feat: migrate stripe, app store webhooks and internal notification routes`

---

## Task 10: Update Docker Compose + Nginx Config

**Files:**
- MODIFY `docker-compose.yml`
- MODIFY `deploy/nginx.conf` (create if needed)
- CREATE `scripts/build-web.sh`
- MODIFY `.env.example`

**Step 1: Update `docker-compose.yml`** — Replace the `app` service with `api` and `web`:

```yaml
services:
  db:
    image: postgres:16-alpine
    restart: unless-stopped
    environment:
      POSTGRES_DB: career_groove
      POSTGRES_USER: career_groove
      POSTGRES_PASSWORD: career_groove
    volumes:
      - career_groove_data:/var/lib/postgresql/data
      - ./db/schema.sql:/docker-entrypoint-initdb.d/001-schema.sql:ro
    ports: ["5432:5432"]
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U career_groove -d career_groove"]
      interval: 5s
      timeout: 3s
      retries: 10

  api:
    build:
      context: .
      dockerfile: packages/api/Dockerfile
    restart: unless-stopped
    ports: ["3001:3001"]
    env_file: [.env]
    environment:
      DATABASE_URL: postgresql://career_groove:career_groove@db:5432/career_groove
      PORT: 3001
      OLLAMA_BASE_URL: ${CAREER_GROOVE_OLLAMA_BASE_URL:-http://ollama:11434}
    extra_hosts:
      - "host.docker.internal:host-gateway"
    depends_on:
      db: { condition: service_healthy }

  web:
    image: nginx:alpine
    ports: ["3000:80"]
    volumes:
      - ./apps/mobile/dist/web:/usr/share/nginx/html:ro
      - ./deploy/nginx.conf:/etc/nginx/conf.d/default.conf:ro
    depends_on:
      - api

  document-worker:
    build:
      context: .
      dockerfile: Dockerfile
      target: worker
    restart: unless-stopped
    command: ["node", "scripts/document-worker.mjs"]
    env_file: [.env]
    environment:
      DATABASE_URL: postgresql://career_groove:career_groove@db:5432/career_groove
      OLLAMA_BASE_URL: ${CAREER_GROOVE_OLLAMA_BASE_URL:-http://ollama:11434}
    extra_hosts:
      - "host.docker.internal:host-gateway"
    depends_on:
      db: { condition: service_healthy }

  mobile-notification-worker:
    build:
      context: .
      dockerfile: Dockerfile
      target: runner
    restart: unless-stopped
    command: ["node", "scripts/mobile-notification-worker.mjs"]
    env_file: [.env]
    environment:
      MOBILE_NOTIFICATION_ENDPOINT: http://api:3001/api/internal/mobile-notifications
    depends_on:
      - api

  backup-scheduler:
    build:
      context: .
      dockerfile: Dockerfile
      target: backup-scheduler
    restart: unless-stopped
    working_dir: /workspace
    command: ["node", "scripts/backup/scheduler.mjs"]
    env_file: [.env]
    environment:
      DATABASE_URL: postgresql://career_groove:career_groove@db:5432/career_groove
      CAREER_GROOVE_BACKUP_ROOT: /workspace/backups
      TZ: ${TZ:-America/Los_Angeles}
    volumes:
      - .:/workspace
    depends_on:
      db: { condition: service_healthy }

  ollama:
    image: ollama/ollama:latest
    restart: unless-stopped
    profiles: ["ollama"]
    environment:
      OLLAMA_HOST: 0.0.0.0:11434
    volumes:
      - ${OLLAMA_MODELS_DIR:-./.ollama}:/root/.ollama

volumes:
  career_groove_data:
```

**Step 2: Create/update `deploy/nginx.conf`:**

```nginx
upstream api { server api:3001; }

server {
  listen 80;
  server_name _;

  # Security headers
  add_header X-Frame-Options "SAMEORIGIN" always;
  add_header X-Content-Type-Options "nosniff" always;
  add_header Referrer-Policy "strict-origin-when-cross-origin" always;

  # API proxy
  location /api/ {
    proxy_pass http://api;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_read_timeout 120s;
    proxy_buffering off;  # Required for AI streaming
  }

  # Static web app
  location / {
    root /usr/share/nginx/html;
    index index.html;
    try_files $uri $uri/ /index.html;
    add_header Cache-Control "public, max-age=3600";
  }
}
```

**Step 3: Create `scripts/build-web.sh`:**

```bash
#!/bin/bash
set -e
cd "$(dirname "$0")/../apps/mobile"
npx expo export --platform web --output-dir dist/web
echo "Web build complete: apps/mobile/dist/web"
```

**Step 4: Update `.env.example`:**

Add `EXPO_PUBLIC_API_URL=http://localhost:3001`

**Step 5: Test Docker build:**

```bash
docker compose build api
docker compose config --quiet
```

**Commit/push:** `infra: update docker compose with api + web containers, nginx config`

---

## Task 11: Scaffold Expo App

**Files:**
- CREATE `apps/mobile/package.json`
- CREATE `apps/mobile/app.json`
- CREATE `apps/mobile/tsconfig.json`
- CREATE `apps/mobile/babel.config.js`
- CREATE `apps/mobile/metro.config.js`
- CREATE `apps/mobile/nativewind-env.d.ts`
- CREATE `apps/mobile/tailwind.config.ts`
- CREATE `apps/mobile/app/_layout.tsx`
- CREATE `apps/mobile/app/index.tsx`
- CREATE `apps/mobile/app/(auth)/_layout.tsx`
- CREATE `apps/mobile/app/(auth)/sign-in.tsx`
- CREATE `apps/mobile/app/(auth)/register.tsx`
- CREATE `apps/mobile/app/(tabs)/_layout.tsx`
- CREATE `apps/mobile/providers/AuthProvider.tsx`
- CREATE `apps/mobile/providers/QueryProvider.tsx`
- CREATE `apps/mobile/lib/api.ts`
- CREATE `apps/mobile/lib/auth.tsx`

**Step 1: Create `apps/mobile/package.json`:**

```json
{
  "name": "career-groove-mobile",
  "version": "1.0.0",
  "private": true,
  "main": "expo-router/entry",
  "scripts": {
    "dev": "expo start",
    "android": "expo start --android",
    "ios": "expo start --ios",
    "web": "expo start --web",
    "build:web": "expo export --platform web"
  },
  "dependencies": {
    "expo": "~52.0.0",
    "expo-router": "~4.0.0",
    "expo-status-bar": "~2.0.0",
    "expo-secure-store": "~14.0.0",
    "expo-auth-session": "~6.0.0",
    "expo-web-browser": "~14.0.0",
    "expo-linking": "~7.0.0",
    "expo-passkeys": "~1.0.0",
    "expo-constants": "~17.0.0",
    "nativewind": "~4.0.0",
    "tailwindcss": "^3.4.17",
    "react-native-reanimated": "~3.16.0",
    "react-native-safe-area-context": "~5.0.0",
    "react-native-screens": "~4.0.0",
    "react-native": "0.76.0",
    "react": "^19.1.0",
    "react-dom": "^19.1.0",
    "@tanstack/react-query": "^5.0.0",
    "lucide-react-native": "^0.525.0",
    "framer-motion": "^12.23.6",
    "zod": "^3.25.76",
    "@career-groove/shared": "*"
  },
  "devDependencies": {
    "typescript": "^5.8.3",
    "@types/react": "^19.1.8"
  }
}
```

**Step 2: Create `apps/mobile/app.json`:**

```json
{
  "expo": {
    "name": "CareerGroove",
    "slug": "career-groove",
    "version": "1.0.0",
    "orientation": "portrait",
    "scheme": "careergroove",
    "platforms": ["ios", "android", "web"],
    "web": {
      "bundler": "metro",
      "output": "single",
      "favicon": "./assets/favicon.svg"
    },
    "ios": {
      "bundleIdentifier": "com.careergroove.careergroove",
      "supportsTablet": true,
      "associatedDomains": ["applinks:careergroove.website"],
      "infoPlist": {
        "NSFaceIDUsageDescription": "Use Face ID to sign in with passkeys"
      }
    },
    "android": {
      "package": "com.careergroove.careergroove"
    },
    "plugins": [
      "expo-router",
      "expo-secure-store",
      "expo-passkeys"
    ]
  }
}
```

**Step 3: Create `apps/mobile/tsconfig.json`:**

```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "strict": true,
    "paths": { "@/*": ["./*"] },
    "jsx": "react-native",
    "moduleResolution": "bundler"
  },
  "include": ["**/*.ts", "**/*.tsx", ".expo/types/**/*.ts", "expo-env.d.ts"]
}
```

**Step 4: Create `apps/mobile/babel.config.js`:**

```js
module.exports = function (api) {
  api.cache(true);
  return {
    presets: [["babel-preset-expo", { jsxRuntime: "automatic" }]],
    plugins: ["react-native-reanimated/plugin"],
  };
};
```

**Step 5: Create `apps/mobile/metro.config.js`:**

```js
const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const config = getDefaultConfig(__dirname);

config.watchFolders = [path.resolve(__dirname, "../../packages")];
config.resolver.nodeModulesPaths = [
  path.resolve(__dirname, "node_modules"),
  path.resolve(__dirname, "../../node_modules"),
];

module.exports = config;
```

**Step 6: Create `apps/mobile/tailwind.config.ts`:**

```ts
import type { Config } from "tailwindcss";

export default {
  content: ["./app/**/*.{js,ts,jsx,tsx}", "./components/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#26312c", cream: "#f6f0e5", coral: "#ff6b57",
        mint: "#62c6a5", sun: "#ffc857", plum: "#725a7a", fog: "#e8e2d7",
      },
      boxShadow: {
        soft: "0 12px 30px rgba(57, 48, 39, .10)",
        pop: "0 6px 0 #26312c",
      },
      borderRadius: { "4xl": "2rem" },
    },
  },
  plugins: [],
} satisfies Config;
```

**Step 7: Create `lib/api.ts`:**

```ts
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

const API_BASE = process.env.EXPO_PUBLIC_API_URL || "http://localhost:3001";

let accessToken: string | null = null;

export function setAccessToken(token: string | null) {
  accessToken = token;
}

export async function getAccessToken(): Promise<string | null> {
  if (accessToken) return accessToken;
  if (Platform.OS === "web") return localStorage.getItem("accessToken");
  return SecureStore.getItemAsync("accessToken");
}

export async function storeTokens(tokens: { accessToken: string; refreshToken: string }) {
  accessToken = tokens.accessToken;
  if (Platform.OS === "web") {
    localStorage.setItem("accessToken", tokens.accessToken);
    localStorage.setItem("refreshToken", tokens.refreshToken);
  } else {
    await SecureStore.setItemAsync("accessToken", tokens.accessToken);
    await SecureStore.setItemAsync("refreshToken", tokens.refreshToken);
  }
}

export async function clearTokens() {
  accessToken = null;
  if (Platform.OS === "web") {
    localStorage.removeItem("accessToken");
    localStorage.removeItem("refreshToken");
  } else {
    await SecureStore.deleteItemAsync("accessToken");
    await SecureStore.deleteItemAsync("refreshToken");
  }
}

async function refreshAccessToken(): Promise<boolean> {
  const refresh = Platform.OS === "web"
    ? localStorage.getItem("refreshToken")
    : await SecureStore.getItemAsync("refreshToken");
  if (!refresh) return false;

  try {
    const res = await fetch(`${API_BASE}/api/auth/token/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken: refresh }),
    });
    if (!res.ok) return false;
    const tokens = await res.json();
    await storeTokens(tokens);
    return true;
  } catch {
    return false;
  }
}

export async function api(path: string, options?: RequestInit & { skipAuth?: boolean }) {
  const token = options?.skipAuth ? null : await getAccessToken();

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options?.headers,
    },
  });

  if (res.status === 401 && !options?.skipAuth) {
    const refreshed = await refreshAccessToken();
    if (refreshed) return api(path, options);
    throw new Error("Session expired");
  }

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`API error ${res.status}: ${body}`);
  }

  return res.json();
}
```

**Step 8: Create `providers/AuthProvider.tsx`:**

```tsx
import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from "react";
import { api, storeTokens, clearTokens, setAccessToken } from "../lib/api";
import { Platform } from "react-native";
import * as AuthSession from "expo-auth-session";
import * as WebBrowser from "expo-web-browser";

WebBrowser.maybeCompleteAuthSession();

interface User { id: string; name: string; email: string; image?: string; }
interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  signInWithCredentials: (email: string, password: string) => Promise<void>;
  signUpWithCredentials: (email: string, password: string) => Promise<void>;
  signInWithOAuth: (provider: "google" | "github" | "apple") => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Try to restore session on mount
    (async () => {
      try {
        const token = Platform.OS === "web"
          ? localStorage.getItem("accessToken")
          : null; // SecureStore is async
        if (token) setAccessToken(token);
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  const signInWithCredentials = useCallback(async (email: string, password: string) => {
    const result = await api("/api/auth/credentials", {
      method: "POST",
      body: JSON.stringify({ email, password }),
      skipAuth: true,
    });
    await storeTokens(result);
    setUser(result.user);
  }, []);

  const signUpWithCredentials = useCallback(async (email: string, password: string) => {
    const result = await api("/api/auth/register", {
      method: "POST",
      body: JSON.stringify({ email, password }),
      skipAuth: true,
    });
    await storeTokens(result);
    setUser(result.user);
  }, []);

  const signInWithOAuth = useCallback(async (provider: "google" | "github" | "apple") => {
    const redirectUri = AuthSession.makeRedirectUri({ scheme: "careergroove" });

    const discovery = provider === "google"
      ? AuthSession.discovery("https://accounts.google.com")
      : provider === "github"
      ? { authorizationEndpoint: "https://github.com/login/oauth/authorize", tokenEndpoint: "https://github.com/login/oauth/access_token" }
      : null; // Apple uses native flow

    const [codeChallenge, codeVerifier] = await AuthSession.generateCodeVerifierAsync();

    const request = new AuthSession.AuthRequest({
      clientId: process.env[`EXPO_PUBLIC_AUTH_${provider.toUpperCase()}_ID`]!,
      scopes: ["openid", "profile", "email"],
      redirectUri,
      codeChallenge,
      codeChallengeMethod: AuthSession.CodeChallengeMethod.S256,
    });

    const result = await request.promptAsync(discovery);
    if (result.type !== "success") throw new Error("OAuth cancelled");

    const exchangeResult = await api("/api/auth/oauth/exchange", {
      method: "POST",
      body: JSON.stringify({
        provider,
        code: result.params.code,
        codeVerifier,
        redirectUri,
      }),
      skipAuth: true,
    });
    await storeTokens(exchangeResult);
    setUser(exchangeResult.user);
  }, []);

  const signOut = useCallback(async () => {
    await clearTokens();
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{
      user, isLoading, isAuthenticated: !!user,
      signInWithCredentials, signUpWithCredentials, signInWithOAuth, signOut,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
```

**Step 9: Create `providers/QueryProvider.tsx`:**

```tsx
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, ReactNode } from "react";

export function QueryProvider({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: { queries: { retry: 2, staleTime: 30000 } },
  }));
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
```

**Step 10: Create `app/_layout.tsx`:**

```tsx
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { AuthProvider } from "../providers/AuthProvider";
import { QueryProvider } from "../providers/QueryProvider";

export default function RootLayout() {
  return (
    <QueryProvider>
      <AuthProvider>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="index" options={{ headerShown: false }} />
          <Stack.Screen name="(auth)" options={{ headerShown: false }} />
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        </Stack>
        <StatusBar style="dark" />
      </AuthProvider>
    </QueryProvider>
  );
}
```

**Step 11: Create `app/(auth)/_layout.tsx`:**

```tsx
import { Stack } from "expo-router";

export default function AuthLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
```

**Step 12: Create `app/(auth)/sign-in.tsx`:**

```tsx
import { View, Text, TextInput, TouchableOpacity, Platform } from "react-native";
import { useState } from "react";
import { useRouter } from "expo-router";
import { useAuth } from "../../providers/AuthProvider";

export default function SignIn() {
  const { signInWithCredentials, signInWithOAuth } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const router = useRouter();

  const handleSubmit = async () => {
    try {
      setError("");
      await signInWithCredentials(email, password);
      router.replace("/(tabs)/dashboard");
    } catch (e: any) {
      setError(e.message);
    }
  };

  return (
    <View className="flex-1 bg-cream justify-center px-6">
      <Text className="font-[var(--font-display)] text-4xl font-black text-ink text-center mb-8">
        Sign In
      </Text>

      {error ? <Text className="text-coral text-center mb-4">{error}</Text> : null}

      <TextInput
        className="bg-white rounded-2xl px-4 py-3 text-ink mb-3 border-2 border-ink/10"
        placeholder="Email"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
      />
      <TextInput
        className="bg-white rounded-2xl px-4 py-3 text-ink mb-6 border-2 border-ink/10"
        placeholder="Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />

      <TouchableOpacity
        className="bg-coral rounded-2xl py-4 items-center shadow-pop mb-4"
        onPress={handleSubmit}
      >
        <Text className="text-white font-bold text-lg">Sign In</Text>
      </TouchableOpacity>

      {Platform.OS !== "android" ? (
        <>
          <TouchableOpacity
            className="bg-white rounded-2xl py-4 items-center border-2 border-ink/10 mb-2"
            onPress={() => signInWithOAuth("google")}
          >
            <Text className="text-ink font-bold">Continue with Google</Text>
          </TouchableOpacity>
          <TouchableOpacity
            className="bg-ink rounded-2xl py-4 items-center mb-2"
            onPress={() => signInWithOAuth("github")}
          >
            <Text className="text-white font-bold">Continue with GitHub</Text>
          </TouchableOpacity>
          {Platform.OS === "ios" && (
            <TouchableOpacity
              className="bg-black rounded-2xl py-4 items-center mb-4"
              onPress={() => signInWithOAuth("apple")}
            >
              <Text className="text-white font-bold">Continue with Apple</Text>
            </TouchableOpacity>
          )}
        </>
      ) : null}

      <TouchableOpacity onPress={() => router.push("/(auth)/register")}>
        <Text className="text-plum text-center mt-4">Don't have an account? Register</Text>
      </TouchableOpacity>
    </View>
  );
}
```

**Step 13: Create `app/(auth)/register.tsx`** — similar form with `signUpWithCredentials`.

**Step 14: Create `app/(tabs)/_layout.tsx`:**

```tsx
import { Tabs } from "expo-router";
import { Platform } from "react-native";
import { Home, BriefcaseBusiness, ClipboardList, BarChart3, Network, FileText, Settings2 } from "lucide-react-native";

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: Platform.OS === "web" ? { display: "none" } : {
          backgroundColor: "#26312c",
          borderTopWidth: 2,
          borderTopColor: "#26312c",
        },
        tabBarActiveTintColor: "#f6f0e5",
        tabBarInactiveTintColor: "rgba(246,240,229,0.6)",
        tabBarLabelStyle: { fontSize: 10, fontWeight: "800" },
      }}
    >
      <Tabs.Screen name="dashboard" options={{ title: "Home", tabBarIcon: ({ color }) => <Home size={21} color={color} /> }} />
      <Tabs.Screen name="journey" options={{ title: "Journey", tabBarIcon: ({ color }) => <BriefcaseBusiness size={21} color={color} /> }} />
      <Tabs.Screen name="applications" options={{ title: "Apps", tabBarIcon: ({ color }) => <ClipboardList size={21} color={color} /> }} />
      <Tabs.Screen name="analytics" options={{ title: "Analytics", tabBarIcon: ({ color }) => <BarChart3 size={21} color={color} /> }} />
      <Tabs.Screen name="network" options={{ title: "Network", tabBarIcon: ({ color }) => <Network size={21} color={color} /> }} />
      <Tabs.Screen name="documents" options={{ title: "Docs", tabBarIcon: ({ color }) => <FileText size={21} color={color} /> }} />
      <Tabs.Screen name="settings" options={{ title: "Settings", tabBarIcon: ({ color }) => <Settings2 size={21} color={color} /> }} />
    </Tabs>
  );
}
```

**Step 15: Create `app/index.tsx`:**

```tsx
import { Redirect } from "expo-router";
import { useAuth } from "../providers/AuthProvider";

export default function Index() {
  const { isAuthenticated, isLoading } = useAuth();
  if (isLoading) return null;
  if (isAuthenticated) return <Redirect href="/(tabs)/dashboard" />;
  return <Redirect href="/(auth)/sign-in" />;
}
```

**Step 16: Create `apps/mobile/nativewind-env.d.ts`:**

```ts
/// <reference types="nativewind/types" />
```

**Step 17: Verify:**

```bash
cd apps/mobile && npm install && npx expo start --web
# Landing page renders → redirects to sign-in
```

**Commit/push:** `feat: scaffold expo app with auth, routing, and tanstack query`

---

## Task 12: Port Shared UI Components

**Files:**
- CREATE `apps/mobile/components/AppShell.tsx`
- CREATE `apps/mobile/components/MusicPlayer.tsx`
- CREATE `apps/mobile/components/AccountMenu.tsx`
- CREATE `apps/mobile/components/EmptyState.tsx`
- CREATE `apps/mobile/components/MotionButton.tsx`
- CREATE `apps/mobile/components/DefaultAISelector.tsx`
- CREATE `apps/mobile/components/ServiceWorker.tsx`

Port each component from `components/` in the current codebase. Replace Next.js-specific imports with Expo equivalents:

**`AppShell.tsx`:** Since Expo Router handles navigation via tabs, this is simplified. For web, render a sidebar alongside the tab content. The existing Tailwind classes work via NativeWind.

**`MusicPlayer.tsx`:** Port the floating music player. On web, use Framer Motion. On native, wrap animations to use `react-native-reanimated` where Framer Motion isn't supported:

```tsx
import { View, TouchableOpacity, Platform } from "react-native";
import { Music, SkipForward, Play, Pause } from "lucide-react-native";

export function MusicPlayer() {
  // Same state management as current component
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTrack, setCurrentTrack] = useState("Lo-Fi Beats");

  return Platform.OS === "web" ? (
    <div className="fixed bottom-20 right-4 z-50 ...">
      {/* Web: framer-motion animated */}
    </div>
  ) : (
    <View className="absolute bottom-24 right-4 z-50 ...">
      {/* Native: reanimated pressable */}
    </View>
  );
}
```

**`EmptyState.tsx`:**

```tsx
import { View, Text } from "react-native";

interface EmptyStateProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  action?: React.ReactNode;
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <View className="flex-1 items-center justify-center py-16 px-8">
      <View className="mb-6 opacity-40">{icon}</View>
      <Text className="font-[var(--font-display)] text-2xl font-black text-ink mb-2 text-center">{title}</Text>
      <Text className="text-ink/55 text-center max-w-md mb-6">{description}</Text>
      {action}
    </View>
  );
}
```

**Commit/push:** `feat: port shared ui components (music player, empty state, etc.)`

---

## Task 13: Port Landing Page

**Files:**
- CREATE `apps/mobile/components/landing/LandingPage.tsx`
- CREATE `apps/mobile/components/landing/Hero.tsx`
- CREATE `apps/mobile/components/landing/Features.tsx`
- CREATE `apps/mobile/components/landing/Header.tsx`
- CREATE `apps/mobile/components/landing/Footer.tsx`
- CREATE `apps/mobile/components/landing/Pricing.tsx`
- CREATE `apps/mobile/components/landing/Reveal.tsx`

Port from `components/landing/`. Replace `next/link` → `expo-router/link`, `next/image` → standard `<Image>`, remove any server component patterns.

**LandingPage.tsx:**

```tsx
import { ScrollView, View } from "react-native";
import { Header } from "./Header";
import { Hero } from "./Hero";
import { Features } from "./Features";
import { Pricing } from "./Pricing";
import { Footer } from "./Footer";

export function LandingPage({ signedIn }: { signedIn: boolean }) {
  return (
    <ScrollView className="bg-cream">
      <Header signedIn={signedIn} />
      <Hero />
      <Features />
      <Pricing />
      <Footer />
    </ScrollView>
  );
}
```

Update `app/index.tsx` to show the landing page instead of redirecting to sign-in when not authenticated.

**Commit/push:** `feat: port landing page to expo`

---

## Task 14: Port Dashboard, Journey, Analytics Pages

**Files:**
- CREATE `apps/mobile/app/(tabs)/dashboard.tsx`
- CREATE `apps/mobile/app/(tabs)/journey.tsx`
- CREATE `apps/mobile/app/(tabs)/analytics.tsx`
- CREATE `apps/mobile/components/dashboard.tsx`
- CREATE `apps/mobile/components/journey-manager.tsx`
- CREATE `apps/mobile/components/analytics-studio.tsx`

Port each component from `components/`. Data fetching changes from server components to React Query:

```tsx
// apps/mobile/app/(tabs)/dashboard.tsx
import { View, Text, ScrollView } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { api } from "../../lib/api";

export default function Dashboard() {
  const { data: stats, isLoading } = useQuery({
    queryKey: ["dashboard"],
    queryFn: () => api("/api/application-analytics"),
  });

  if (isLoading) return <View className="flex-1 bg-cream" />;

  return (
    <ScrollView className="flex-1 bg-cream px-5 pt-6">
      <Text className="font-[var(--font-display)] text-4xl font-black text-ink mb-2">Dashboard</Text>
      <Text className="text-ink/55 mb-6">Your career at a glance</Text>

      {/* Stats cards */}
      <View className="flex-row flex-wrap gap-4">
        {/* Each card is a styled View with data from stats */}
      </View>

      {/* Recent activity, pipeline signals, etc. */}
    </ScrollView>
  );
}
```

**Commit/push:** `feat: port dashboard, journey, and analytics pages`

---

## Task 15: Port Applications + Tracker Components

**Files:**
- CREATE `apps/mobile/app/(tabs)/applications/_layout.tsx`
- CREATE `apps/mobile/app/(tabs)/applications/index.tsx`
- CREATE `apps/mobile/app/(tabs)/applications/[id].tsx`
- CREATE `apps/mobile/components/tracker/tracker-page.tsx`
- CREATE `apps/mobile/components/tracker/tracker-shell.tsx`
- CREATE `apps/mobile/components/tracker/role-list.tsx`
- CREATE `apps/mobile/components/tracker/role-list-item.tsx`
- CREATE `apps/mobile/components/tracker/step-card.tsx`
- CREATE `apps/mobile/components/tracker/step-accordion.tsx`
- CREATE `apps/mobile/components/tracker/steps/`
- CREATE `apps/mobile/components/tracker/capture-modal.tsx`
- CREATE `apps/mobile/components/tracker/canvas-header.tsx`
- CREATE `apps/mobile/components/tracker/canvas-workspace.tsx`
- CREATE `apps/mobile/components/tracker/pipeline-signals.tsx`

Port all 12 tracker components. This is the most complex UI section. Use react-query hooks for data:

```tsx
// apps/mobile/app/(tabs)/applications/index.tsx
import { useQuery } from "@tanstack/react-query";
import { api } from "../../../lib/api";
import { TrackerPage } from "../../../components/tracker/tracker-page";

export default function Applications() {
  const { data: apps } = useQuery({
    queryKey: ["applications"],
    queryFn: () => api("/api/applications"),
  });

  return <TrackerPage applications={apps || []} />;
}
```

**Commit/push:** `feat: port applications and tracker components`

---

## Task 16: Port Network, Documents, Settings, Interview Pages

**Files:**
- CREATE `apps/mobile/app/(tabs)/network.tsx`
- CREATE `apps/mobile/app/(tabs)/documents.tsx`
- CREATE `apps/mobile/app/(tabs)/settings.tsx`
- CREATE `apps/mobile/app/(tabs)/interview.tsx`
- CREATE `apps/mobile/components/network-manager.tsx`
- CREATE `apps/mobile/components/document-studio.tsx`
- CREATE `apps/mobile/components/settings-panel.tsx`
- CREATE `apps/mobile/components/billing-panel.tsx`
- CREATE `apps/mobile/components/profile-panel.tsx`
- CREATE `apps/mobile/components/provider-connections.tsx`
- CREATE `apps/mobile/components/job-interviewer.tsx`
- CREATE `apps/mobile/components/mock-interviewer.tsx`

Port each component. Data fetching via React Query. Reuse the API client from `lib/api.ts`.

For the AI interviewer streaming, use `react-native`'s `EventSource` or fetch with streaming:

```tsx
// Streaming AI response in React Native
const response = await fetch(`${API_BASE}/api/ai/interviewer`, {
  method: "POST",
  headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
  body: JSON.stringify({ messages, provider, model }),
});

const reader = response.body?.getReader();
const decoder = new TextDecoder();
while (reader) {
  const { done, value } = await reader.read();
  if (done) break;
  setResponse(prev => prev + decoder.decode(value));
}
```

**Commit/push:** `feat: port network, documents, settings, and interview pages`

---

## Task 17: Configure Native Features (iOS/Android)

**Files:**
- MODIFY `apps/mobile/app.json` (finalize iOS + Android configs)
- CREATE `apps/mobile/ios/.gitkeep` (placeholder for EAS build output)
- CREATE `apps/mobile/android/.gitkeep`

**Step 1: Configure deep linking**

Add to `app.json`:
```json
{
  "expo": {
    "scheme": "careergroove",
    "ios": {
      "associatedDomains": ["applinks:careergroove.website"],
      "usesAppleSignIn": true
    },
    "plugins": [
      ["expo-apple-authentication"],
      "expo-auth-session"
    ]
  }
}
```

**Step 2: Update `.env.example` with Expo-specific vars:**

```
EXPO_PUBLIC_API_URL=http://localhost:3001
EXPO_PUBLIC_AUTH_GOOGLE_ID=
EXPO_PUBLIC_AUTH_GITHUB_ID=
```

**Step 3: Test EAS build (optional — requires Expo account)**

```bash
npx eas build --platform ios --profile development
npx eas build --platform android --profile development
```

**Commit/push:** `feat: configure ios/android native features (deep linking, apple sign-in)`

---

## Task 18: Finalize Docker Production Build

**Files:**
- MODIFY `docker-compose.yml` (add web build step)
- CREATE `Dockerfile.web` (Expo web build container — optional, can pre-build)

**Step 1: Verify whole stack builds:**

```bash
# Build web
cd apps/mobile && npx expo export --platform web --output-dir dist/web

# Build and start containers
docker compose build
docker compose up -d

# Test
curl http://localhost:3000/  # Should serve web app
curl http://localhost:3001/api/health  # Should return {"status":"ok"}
```

**Step 2: Add a CI hint to `turbo.json` or a Makefile target:**

```makefile
build-web:
	cd apps/mobile && npx expo export --platform web

deploy: build-web
	docker compose build
	docker compose up -d
```

**Step 3: Update `README.md` with new dev and deploy instructions.**

**Commit/push:** `infra: finalize docker production build with expo web + hono api`

---

## Task 19: Clean Up Legacy Code

**Files to REMOVE** (after verifying everything is migrated):
- `app/` — Next.js pages directory
- `components/` — old Next.js components (verify each is ported)
- `ios/` — SwiftUI iOS app
- `next.config.ts`, `next-env.d.ts`, `postcss.config.js`
- `lib/` — old server lib (migrated to `packages/api/src/lib/`)
- Root-level config files no longer needed

**Step 1: Verify feature parity checklist:**

```
[ ] Landing page renders on web
[ ] Sign-in with credentials works
[ ] Sign-in with Google OAuth works
[ ] Sign-in with GitHub OAuth works
[ ] Sign-in with Apple OAuth works (iOS)
[ ] Dashboard loads stats
[ ] Journey manager CRUD
[ ] Applications list + create + edit + delete
[ ] Application tracker canvas renders
[ ] Application pipeline signals
[ ] Capture modal works
[ ] Application events/interviews/scores/outcomes CRUD
[ ] Network manager CRUD
[ ] Document studio CRUD + AI generation
[ ] Settings panel loads/saves
[ ] Provider connections CRUD
[ ] AI interviewer streaming
[ ] Mock interviewer streaming
[ ] Music player renders and plays
[ ] Token refresh works automatically
[ ] Sign out clears tokens
[ ] Responsive layout (mobile tabs / web sidebar)
[ ] Docker compose up builds and serves everything
```

**Step 2: Remove each legacy directory after confirming its replacement works.**

**Step 3: Final commit/push:**

```bash
git add -A
git commit -m "cleanup: remove legacy next.js, swiftui, and old lib code after full expo migration"
git push
```

---

## Execution Checklist

| Task | Rebuild Docker? | Push? |
|------|----------------|-------|
| 1 — Turborepo scaffold | No | Yes |
| 2 — Zod schemas | No | Yes |
| 3 — Hono scaffold | **Yes** (`api`) | Yes |
| 4 — Core CRUD routes | No | Yes |
| 5 — Application routes | No | Yes |
| 6 — Settings/providers | No | Yes |
| 7 — Documents/AI routes | **Yes** (`api`) | Yes |
| 8 — Auth routes | No | Yes |
| 9 — Webhooks | No | Yes |
| 10 — Docker compose | **Yes** (full stack) | Yes |
| 11 — Expo scaffold | No | Yes |
| 12 — Shared UI | No | Yes |
| 13 — Landing page | No | Yes |
| 14 — Dashboard/journey/analytics | No | Yes |
| 15 — Applications/tracker | No | Yes |
| 16 — Network/documents/settings/interview | No | Yes |
| 17 — Native features (iOS/Android) | No | Yes |
| 18 — Finalize Docker | **Yes** (full stack) | Yes |
| 19 — Cleanup legacy code | No | Yes |

