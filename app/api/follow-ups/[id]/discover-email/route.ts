import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser, unauthorized } from "@/lib/api-auth";

const idSchema = z.string().uuid();

/**
 * POST /api/follow-ups/[id]/discover-email
 *
 * Resolves a recipient email address for the given follow-up.
 * Priority:
 *   1. Saved recipient_email already on the follow-up row.
 *   2. Any contact linked to the application that has an email.
 *   3. Google Custom Search API for the company's careers address.
 *   4. Common fallback guesses (careers@, jobs@, info@, support@).
 *
 * If a new address is found via search, a contact is created in the
 * network tab and linked to the application.
 */
export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  if (!user) return unauthorized();

  const id = idSchema.safeParse((await params).id);
  if (!id.success) return Response.json({ error: "Invalid follow-up id." }, { status: 400 });

  // Load follow-up + application
  const fuRow = await db.query(
    `SELECT af.id, af.application_id AS "applicationId", af.recipient_email AS "recipientEmail",
            a.company, a.source_url AS "sourceUrl"
     FROM application_follow_ups af
     JOIN applications a ON a.id = af.application_id AND a.user_id = af.user_id
     WHERE af.id=$1 AND af.user_id=$2`,
    [id.data, user],
  );
  if (!fuRow.rowCount) return Response.json({ error: "Follow-up not found." }, { status: 404 });

  const fu = fuRow.rows[0];

  // 1. Already resolved
  if (fu.recipientEmail) {
    return Response.json({ email: fu.recipientEmail, source: "saved" });
  }

  // 2. Linked contact with email
  const contactRow = await db.query(
    `SELECT COALESCE(c.email, ac.email) AS email, COALESCE(c.name, ac.name) AS name
     FROM application_contacts ac
     LEFT JOIN contacts c ON c.id = ac.contact_id AND c.user_id = ac.user_id
     WHERE ac.user_id=$1 AND ac.application_id=$2
       AND (c.email IS NOT NULL OR ac.email IS NOT NULL)
     ORDER BY ac.created_at ASC
     LIMIT 1`,
    [user, fu.applicationId],
  );
  if (contactRow.rowCount) {
    const email = contactRow.rows[0].email as string;
    await saveRecipientEmail(id.data, user, email);
    return Response.json({ email, source: "contact", contactName: contactRow.rows[0].name });
  }

  // 3. Google Custom Search
  const searchApiKey = process.env.SEARCH_ENGINE_API_KEY;
  const searchCx = process.env.SEARCH_ENGINE_CX;
  if (searchApiKey && searchCx) {
    const query = encodeURIComponent(`"${fu.company}" careers email address`);
    const searchUrl = `https://www.googleapis.com/customsearch/v1?key=${searchApiKey}&cx=${searchCx}&q=${query}`;
    try {
      const res = await fetch(searchUrl);
      if (res.ok) {
        const data = (await res.json()) as { items?: Array<{ snippet?: string; link?: string }> };
        const emailRegex = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g;
        for (const item of data.items ?? []) {
          const text = `${item.snippet ?? ""} ${item.link ?? ""}`;
          const matches = text.match(emailRegex);
          if (matches?.length) {
            const foundEmail = matches[0].toLowerCase();
            // Create a contact for the discovered address
            const contactResult = await db.query(
              `INSERT INTO contacts(user_id, name, company, email, relationship_strength)
               VALUES($1,$2,$3,$4,1)
               ON CONFLICT DO NOTHING
               RETURNING id`,
              [user, `${fu.company} Careers`, fu.company, foundEmail],
            );
            if (contactResult.rowCount) {
              await db.query(
                `INSERT INTO application_contacts(user_id, application_id, contact_id, name, company, email, relationship)
                 VALUES($1,$2,$3,$4,$5,$6,'careers')
                 ON CONFLICT DO NOTHING`,
                [user, fu.applicationId, contactResult.rows[0].id, `${fu.company} Careers`, fu.company, foundEmail],
              );
            }
            await saveRecipientEmail(id.data, user, foundEmail);
            return Response.json({ email: foundEmail, source: "search", contactCreated: !!contactResult.rowCount });
          }
        }
      }
    } catch {
      // Search failed — fall through to guesses
    }
  }

  // 4. Fallback guesses derived from company domain
  const guesses = buildEmailGuesses(fu.company, fu.sourceUrl as string | null);
  return Response.json({ guesses, source: "guesses" });
}

async function saveRecipientEmail(followUpId: string, userId: string, email: string) {
  await db.query(
    "UPDATE application_follow_ups SET recipient_email=$3, updated_at=now() WHERE id=$1 AND user_id=$2",
    [followUpId, userId, email],
  );
}

function buildEmailGuesses(company: string, sourceUrl: string | null): string[] {
  let domain: string | null = null;

  if (sourceUrl) {
    try {
      const hostname = new URL(sourceUrl).hostname.replace(/^www\./, "");
      // Only use if it looks like a plausible company domain (not job boards)
      const jobBoards = ["linkedin.com", "indeed.com", "glassdoor.com", "ziprecruiter.com", "monster.com", "lever.co", "greenhouse.io", "workday.com"];
      if (!jobBoards.some((board) => hostname.endsWith(board))) {
        domain = hostname;
      }
    } catch {
      // ignore invalid URL
    }
  }

  if (!domain) {
    // Derive a best-guess domain from company name
    const slug = company.toLowerCase().replace(/[^a-z0-9]+/g, "").slice(0, 30);
    domain = `${slug}.com`;
  }

  return ["careers", "jobs", "info", "support"].map((prefix) => `${prefix}@${domain}`);
}
