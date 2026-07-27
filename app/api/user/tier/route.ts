import { requireUser, unauthorized, getUserTier, isAdmin } from "@/lib/api-auth";

export async function GET() {
  const user = await requireUser();
  if (!user) return unauthorized();
  const [tier, admin] = await Promise.all([getUserTier(user), isAdmin(user)]);
  return Response.json({ tier, isAdmin: admin });
}
