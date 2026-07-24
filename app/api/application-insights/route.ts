import { z } from "zod";

import { db } from "@/lib/db";
import { requireUser, unauthorized } from "@/lib/api-auth";

const actionSchema = z.object({
  insightId: z.string().trim().min(1).max(120),
  action: z.enum(["dismissed", "later", "active"]),
});

type Insight = {
  id: string;
  kind: string;
  title: string;
  copy: string;
  evidence: string[];
  suggestion: string;
  confidence: "low" | "medium" | "high";
  state: "active" | "dismissed" | "later";
};

function pct(count: number, total: number) {
  return total ? Math.round((count / total) * 100) : 0;
}

function readState(preferences: unknown): Record<string, Insight["state"]> {
  if (!preferences || typeof preferences !== "object") return {};
  const raw = (preferences as Record<string, unknown>).applicationInsights;
  if (!raw || typeof raw !== "object") return {};
  return Object.fromEntries(Object.entries(raw as Record<string, unknown>).filter(([, value]) => value === "active" || value === "dismissed" || value === "later")) as Record<string, Insight["state"]>;
}

export async function GET() {
  const user = await requireUser();
  if (!user) return unauthorized();

  const [stateResult, sourceRows, gapsRows, stageRows, documentRows, networkRows, closedRows] = await Promise.all([
    db.query(`SELECT preferences FROM users WHERE id=$1`, [user]),
    db.query(
      `SELECT COALESCE(a.source,'Unknown') AS source,
        count(*)::int AS total,
        count(*) FILTER (WHERE o.outcome IN ('rejected','no_response'))::int AS closed
       FROM applications a
       LEFT JOIN LATERAL (
         SELECT outcome FROM application_outcomes
         WHERE user_id=a.user_id AND application_id=a.id
         ORDER BY occurred_at DESC,created_at DESC LIMIT 1
       ) o ON true
       WHERE a.user_id=$1 AND a.archived_at IS NULL
       GROUP BY 1
       HAVING count(*) >= 3
       ORDER BY closed DESC,total DESC
       LIMIT 8`,
      [user],
    ),
    db.query(
      `SELECT gap,count(*)::int AS count
       FROM application_scores s
       CROSS JOIN LATERAL jsonb_array_elements_text(s.gaps) gap
       JOIN applications a ON a.id=s.application_id AND a.user_id=s.user_id
       WHERE s.user_id=$1 AND a.status IN ('rejected','withdrawn')
       GROUP BY gap
       ORDER BY count DESC,gap ASC
       LIMIT 5`,
      [user],
    ),
    db.query(
      `SELECT COALESCE(NULLIF(stage,''),'Unspecified') AS stage,count(*)::int AS count
       FROM application_outcomes
       WHERE user_id=$1 AND outcome IN ('rejected','no_response')
       GROUP BY 1
       HAVING count(*) >= 2
       ORDER BY count DESC,stage ASC
       LIMIT 5`,
      [user],
    ),
    db.query(
      `SELECT
         count(*)::int AS closed,
         count(*) FILTER (WHERE NOT EXISTS (
           SELECT 1 FROM application_documents d
           WHERE d.application_id=a.id AND d.user_id=a.user_id AND d.status IN ('generated','submitted')
         ))::int AS "withoutReadyDoc",
         count(*) FILTER (WHERE EXISTS (
           SELECT 1 FROM application_documents d
           WHERE d.application_id=a.id AND d.user_id=a.user_id AND d.status='submitted'
         ))::int AS "submittedDoc"
       FROM applications a
       WHERE a.user_id=$1 AND a.status IN ('rejected','withdrawn')`,
      [user],
    ),
    db.query(
      `SELECT
         count(*) FILTER (WHERE c.id IS NOT NULL)::int AS "withContact",
         count(*) FILTER (WHERE c.id IS NOT NULL AND a.status IN ('interviewing','offer'))::int AS "withContactResponse",
         count(*) FILTER (WHERE c.id IS NULL)::int AS "withoutContact",
         count(*) FILTER (WHERE c.id IS NULL AND a.status IN ('interviewing','offer'))::int AS "withoutContactResponse"
       FROM applications a
       LEFT JOIN LATERAL (
         SELECT id FROM application_contacts
         WHERE application_id=a.id AND user_id=a.user_id LIMIT 1
       ) c ON true
       WHERE a.user_id=$1 AND a.archived_at IS NULL AND a.status <> 'saved'`,
      [user],
    ),
    db.query(
      `SELECT count(*)::int AS closed
       FROM applications
       WHERE user_id=$1 AND status IN ('rejected','withdrawn')`,
      [user],
    ),
  ]);

  const state = readState(stateResult.rows[0]?.preferences);
  const insights: Insight[] = [];
  const applyState = (insight: Omit<Insight, "state">): Insight => ({ ...insight, state: state[insight.id] ?? "active" });
  const closedCount = closedRows.rows[0]?.closed ?? 0;

  const source = sourceRows.rows.find((row) => row.total >= 3 && pct(row.closed, row.total) >= 60);
  if (source) {
    insights.push(applyState({
      id: `source-${String(source.source).toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
      kind: "source",
      title: `${source.source} may need a lighter touch`,
      copy: "This source has produced fewer responses in your recent tracker history. That does not make it bad; it means it may deserve less document energy until the signal changes.",
      evidence: [`${source.closed} of ${source.total} roles from this source closed as rejection or no response.`],
      suggestion: "Try one stronger source or add a referral step before spending time on another similar role.",
      confidence: source.total >= 6 ? "medium" : "low",
    }));
  }

  if (gapsRows.rows.length && closedCount >= 2) {
    const top = gapsRows.rows[0];
    insights.push(applyState({
      id: "missing-skill-themes",
      kind: "skills",
      title: "A repeat gap is worth naming",
      copy: "Career DJ keeps seeing one evidence gap near closed roles. Treat it as a resume remix prompt, not a verdict.",
      evidence: gapsRows.rows.slice(0, 3).map((row) => `${row.count}x: ${row.gap}`),
      suggestion: "Add one concrete project, metric, or Journey bullet that answers the most common gap.",
      confidence: closedCount >= 5 ? "medium" : "low",
    }));
  }

  if (stageRows.rows.length) {
    const stage = stageRows.rows[0];
    insights.push(applyState({
      id: "stage-dropoff",
      kind: "interview",
      title: `${stage.stage} is a useful review point`,
      copy: "A few outcomes cluster around the same stage. A short review can help you prep the next similar moment without replaying the whole search.",
      evidence: stageRows.rows.slice(0, 3).map((row) => `${row.stage}: ${row.count} closed outcome${row.count === 1 ? "" : "s"}`),
      suggestion: "Save one prep note or question pattern for the next interview in that stage.",
      confidence: stage.count >= 4 ? "medium" : "low",
    }));
  }

  const doc = documentRows.rows[0];
  if (doc && doc.closed >= 3 && pct(doc.withoutReadyDoc, doc.closed) >= 50) {
    insights.push(applyState({
      id: "document-readiness",
      kind: "documents",
      title: "Submitted-version tracking could sharpen the signal",
      copy: "Several closed roles do not have a generated or submitted document linked. The next improvement may simply be recording which version went out.",
      evidence: [`${doc.withoutReadyDoc} of ${doc.closed} closed roles do not have a generated or submitted draft linked.`],
      suggestion: "For the next few applications, link the submitted resume or cover letter before logging the outcome.",
      confidence: doc.closed >= 6 ? "medium" : "low",
    }));
  }

  const network = networkRows.rows[0];
  if (network && network.withContact + network.withoutContact >= 6 && network.withContact >= 2 && network.withoutContact >= 2) {
    const withRate = pct(network.withContactResponse, network.withContact);
    const withoutRate = pct(network.withoutContactResponse, network.withoutContact);
    if (withRate >= withoutRate + 15) {
      insights.push(applyState({
        id: "network-correlation",
        kind: "network",
        title: "Warm context appears to help",
        copy: "Applications with a linked contact are reaching active stages more often. That is a correlation, not a promise, but it is useful routing signal.",
        evidence: [`Linked contact response rate: ${withRate}%.`, `No linked contact response rate: ${withoutRate}%.`],
        suggestion: "When Career DJ recommends Network First, try a recruiter, referral, or warm intro before submitting cold.",
        confidence: network.withContact + network.withoutContact >= 10 ? "medium" : "low",
      }));
    }
  }

  return Response.json({
    lowData: closedCount < 2,
    closedCount,
    insights: insights.filter((insight) => insight.state !== "dismissed"),
  });
}

export async function POST(request: Request) {
  const user = await requireUser();
  if (!user) return unauthorized();
  const parsed = actionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Invalid insight action" }, { status: 400 });
  await db.query(
    `UPDATE users
     SET preferences=jsonb_set(COALESCE(preferences,'{}'::jsonb), ARRAY['applicationInsights',$2], to_jsonb($3::text), true)
     WHERE id=$1`,
    [user, parsed.data.insightId, parsed.data.action],
  );
  return Response.json({ ok: true });
}
