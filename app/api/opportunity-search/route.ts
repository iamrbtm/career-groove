import { requireUser, unauthorized } from "@/lib/api-auth";
import { searchOpportunities } from "@/lib/opportunity-search";

export async function POST() {
  const user = await requireUser();
  if (!user) return unauthorized();
  try {
    const result = await searchOpportunities(user);
    return Response.json(result);
  } catch (error) {
    console.error("Opportunity search failed", error);
    const message = error instanceof Error ? error.message : "Could not search for opportunities.";
    return Response.json({ error: message }, { status: 500 });
  }
}
