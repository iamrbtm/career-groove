import { db } from "@/lib/db";
import { requireUser, unauthorized } from "@/lib/api-auth";
import { importJobEmailEntries } from "@/lib/job-email-json/importer";
import { inputSchema, toJobEmailEntries } from "@/lib/job-email-json/bulk-import-schema";

export async function POST(request: Request) {
  const user = await requireUser();
  if (!user) return unauthorized();
  const parsed = inputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: parsed.error.flatten() }, { status: 400 });

  const client = await db.connect();
  try {
    const result = await importJobEmailEntries(client, user, toJobEmailEntries(parsed.data.entries), {
      searchRunDate: parsed.data.searchRunDate ?? null,
    });
    return Response.json(result, { status: 201 });
  } catch (error) {
    console.error("Bulk create failed", error);
    return Response.json({ error: "The applications could not be created. No changes were made." }, { status: 500 });
  } finally {
    client.release();
  }
}
