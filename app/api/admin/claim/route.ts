import { timingSafeEqual } from "node:crypto";
import { withTransaction } from "@/lib/db";
import { requireUser, unauthorized } from "@/lib/api-auth";

function setupTokenMatches(request: Request) {
  const expected = process.env.CAREER_GROOVE_SETUP_TOKEN;
  const actual = request.headers.get("x-setup-token");
  if (!expected || !actual) return false;
  const left = Buffer.from(expected);
  const right = Buffer.from(actual);
  return left.length === right.length && timingSafeEqual(left, right);
}

export async function POST(request: Request) {
  const user = await requireUser();
  if (!user) return unauthorized();
  if (process.env.CAREER_GROOVE_SETUP_TOKEN && !setupTokenMatches(request))
    return Response.json({ error: "Setup token required." }, { status: 401 });
  const claim = await withTransaction((client) =>
    client.query("INSERT INTO admins (user_id) SELECT $1 WHERE NOT EXISTS (SELECT 1 FROM admins) RETURNING user_id", [user]),
  );
  if (!claim.rowCount) return Response.json({ error: "Admin already claimed." }, { status: 403 });
  return Response.json({ ok: true });
}
