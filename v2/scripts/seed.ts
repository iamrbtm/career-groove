import { readFileSync } from "node:fs";
import { Pool } from "pg";

type SeedUser = {
  id: string;
  name: string;
  email: string;
  image: string | null;
  createdAt: string;
  preferences: Record<string, unknown>;
  passwordHash: string;
  emailVerified: string | null;
};

type SeedJob = {
  id: string;
  userId: string;
  company: string;
  title: string;
  location?: string | null;
  startedOn?: string | null;
  endedOn?: string | null;
  current?: string | null;
  description?: string | null;
  highlights?: string[] | null;
  metadata?: Record<string, unknown> | null;
};

type SeedResidence = {
  id: string;
  userId: string;
  label?: string | null;
  address?: {
    street?: string;
    city?: string;
    region?: string;
    country?: string;
    postalCode?: string;
  };
  startedOn?: string | null;
  endedOn?: string | null;
  notes?: string | null;
};

type SeedCredential = {
  id: string;
  userId: string;
  kind: string;
  name: string;
  issuer?: string | null;
  issuedOn?: string | null;
  expiresOn?: string | null;
  url?: string | null;
  notes?: string | null;
};

type SeedSkill = {
  id: string;
  userId: string;
  name: string;
  category?: string | null;
  proficiency?: number | null;
  notes?: string | null;
};

type Seed = {
  users: SeedUser[];
  jobs: SeedJob[];
  residences: SeedResidence[];
  credentials: SeedCredential[];
  skills: SeedSkill[];
  jobSkills: { jobId: string; skillId: string }[];
};

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("DATABASE_URL is required");
  process.exit(1);
}

const seed = JSON.parse(
  readFileSync(new URL("../seed/seed.json", import.meta.url), "utf8"),
) as Seed;
const adminEmail = process.env.BOOTSTRAP_ADMIN_EMAIL || "rbtm2006@me.com";
const pool = new Pool({ connectionString, max: 1 });

function addr(residence: SeedResidence) {
  return residence.address ?? {};
}

async function main() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    for (const user of seed.users) {
      const isAdmin = user.email === adminEmail;
      await client.query(
        `INSERT INTO "user" (id, name, email, email_verified, image, is_admin, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, now())
         ON CONFLICT (id) DO UPDATE SET
           name = EXCLUDED.name,
           email = EXCLUDED.email,
           email_verified = EXCLUDED.email_verified,
           image = EXCLUDED.image,
           is_admin = EXCLUDED.is_admin,
           updated_at = now()`,
        [
          user.id,
          user.name,
          user.email,
          Boolean(user.emailVerified),
          user.image,
          isAdmin,
          user.createdAt,
        ],
      );

      await client.query(
        `INSERT INTO account (id, account_id, provider_id, user_id, password, created_at, updated_at)
         VALUES ($1, $2, 'credential', $3, $4, now(), now())
         ON CONFLICT (id) DO UPDATE SET password = EXCLUDED.password, updated_at = now()`,
        [`credential:${user.id}`, user.id, user.id, user.passwordHash],
      );

      const phone = typeof user.preferences?.phone === "string" ? user.preferences.phone : null;
      await client.query(
        `INSERT INTO profiles (user_id, name, phone, updated_at)
         VALUES ($1, $2, $3, now())
         ON CONFLICT (user_id) DO UPDATE SET
           name = EXCLUDED.name,
           phone = COALESCE(EXCLUDED.phone, profiles.phone),
           updated_at = now()`,
        [user.id, user.name, phone],
      );
    }

    for (const job of seed.jobs) {
      await client.query(
        `INSERT INTO jobs
           (id, user_id, company, title, location, started_on, ended_on, current, description, highlights, metadata, created_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11::jsonb,now(),now())
         ON CONFLICT (id) DO UPDATE SET
           company = EXCLUDED.company,
           title = EXCLUDED.title,
           location = EXCLUDED.location,
           started_on = EXCLUDED.started_on,
           ended_on = EXCLUDED.ended_on,
           current = EXCLUDED.current,
           description = EXCLUDED.description,
           highlights = EXCLUDED.highlights,
           metadata = EXCLUDED.metadata,
           updated_at = now()`,
        [
          job.id,
          job.userId,
          job.company,
          job.title,
          job.location ?? null,
          job.startedOn ?? null,
          job.endedOn ?? null,
          String(job.current ?? "").toLowerCase() === "yes" || job.current === "true",
          job.description ?? null,
          JSON.stringify(job.highlights ?? []),
          JSON.stringify(job.metadata ?? {}),
        ],
      );
    }

    for (const residence of seed.residences) {
      const a = addr(residence);
      await client.query(
        `INSERT INTO residences
           (id, user_id, label, street, city, region, country, postal_code, started_on, ended_on, notes)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
         ON CONFLICT (id) DO UPDATE SET
           label = EXCLUDED.label,
           street = EXCLUDED.street,
           city = EXCLUDED.city,
           region = EXCLUDED.region,
           country = EXCLUDED.country,
           postal_code = EXCLUDED.postal_code,
           started_on = EXCLUDED.started_on,
           ended_on = EXCLUDED.ended_on,
           notes = EXCLUDED.notes`,
        [
          residence.id,
          residence.userId,
          residence.label ?? null,
          a.street ?? null,
          a.city ?? null,
          a.region ?? null,
          a.country ?? null,
          a.postalCode ?? null,
          residence.startedOn ?? null,
          residence.endedOn ?? null,
          residence.notes ?? null,
        ],
      );
    }

    for (const credential of seed.credentials) {
      await client.query(
        `INSERT INTO credentials
           (id, user_id, kind, name, issuer, issued_on, expires_on, url, notes)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
         ON CONFLICT (id) DO UPDATE SET
           kind = EXCLUDED.kind,
           name = EXCLUDED.name,
           issuer = EXCLUDED.issuer,
           issued_on = EXCLUDED.issued_on,
           expires_on = EXCLUDED.expires_on,
           url = EXCLUDED.url,
           notes = EXCLUDED.notes`,
        [
          credential.id,
          credential.userId,
          credential.kind,
          credential.name,
          credential.issuer ?? null,
          credential.issuedOn ?? null,
          credential.expiresOn ?? null,
          credential.url ?? null,
          credential.notes ?? null,
        ],
      );
    }

    for (const skill of seed.skills) {
      await client.query(
        `INSERT INTO skills (id, user_id, name, category, proficiency, notes)
         VALUES ($1,$2,$3,$4,$5,$6)
         ON CONFLICT (id) DO UPDATE SET
           name = EXCLUDED.name,
           category = EXCLUDED.category,
           proficiency = EXCLUDED.proficiency,
           notes = EXCLUDED.notes`,
        [
          skill.id,
          skill.userId,
          skill.name,
          skill.category ?? "other",
          skill.proficiency ?? 3,
          skill.notes ?? null,
        ],
      );
    }

    for (const link of seed.jobSkills) {
      await client.query(
        `INSERT INTO job_skills (job_id, skill_id) VALUES ($1,$2)
         ON CONFLICT (job_id, skill_id) DO NOTHING`,
        [link.jobId, link.skillId],
      );
    }

    await client.query("COMMIT");
    console.log(
      `seed: ${seed.users.length} users, ${seed.jobs.length} jobs, ${seed.skills.length} skills, ${seed.residences.length} residences, ${seed.credentials.length} credentials`,
    );
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
