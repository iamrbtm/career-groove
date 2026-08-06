import { z } from "zod";
import { requireUser, unauthorized } from "@/lib/api-auth";
import { acceptOpportunities } from "@/lib/opportunity-search";

const requestSchema = z.object({
  ids: z.array(z.string().uuid()).max(10).default([]),
});

export async function POST(request: Request) {
  const user = await requireUser();
  if (!user) return unauthorized();
  const parsed = requestSchema.safeParse(await request.json());
  if (!parsed.success) return Response.json({ error: "Invalid selection" }, { status: 400 });
  try {
    const result = await acceptOpportunities(user, parsed.data.ids);
    return Response.json(result);
  } catch (error) {
    console.error("Opportunity accept failed", error);
    const message = error instanceof Error ? error.message : "The selected opportunities could not be added.";
    return Response.json({ error: message }, { status: 500 });
  }
}
