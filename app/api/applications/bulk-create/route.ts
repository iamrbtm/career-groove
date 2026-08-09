import { db } from "@/lib/db";
import { getUserTier, requireUser, unauthorized } from "@/lib/api-auth";
import { JobEmailImportError } from "@/lib/job-email-json/errors";
import { classifyJobEmailEntries, importJobEmailEntries } from "@/lib/job-email-json/importer";
import {
  exceedsFreeTierImportLimit,
  inputSchema,
  parseBulkEmailImportRequest,
} from "@/lib/job-email-json/bulk-import-schema";

export async function POST(request: Request) {
  const user = await requireUser();
  if (!user) return unauthorized();
  const parsed = inputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: parsed.error.flatten() }, { status: 400 });

  let importRequest: ReturnType<typeof parseBulkEmailImportRequest>;
  try {
    importRequest = parseBulkEmailImportRequest(parsed.data);
  } catch (error) {
    if (error instanceof JobEmailImportError) {
      return Response.json({ error: error.message, code: error.code }, { status: 400 });
    }
    console.error("Bulk email import validation failed", error);
    return Response.json({ error: "The email could not be parsed." }, { status: 500 });
  }

  const client = await db.connect();
  try {
    const tier = await getUserTier(user);
    const duplicateChecks = tier === "free"
      ? await classifyJobEmailEntries(client, user, importRequest.jobs)
      : null;

    if (tier === "free") {
      const countResult = await client.query(
        `SELECT COUNT(*) FROM applications WHERE user_id=$1 AND archived_at IS NULL AND status <> 'archived'`,
        [user],
      );
      const activeCount = parseInt(countResult.rows[0]?.count || "0", 10);
      const newJobCount = duplicateChecks?.filter((job) => job.status === "new").length ?? 0;
      if (exceedsFreeTierImportLimit(activeCount, newJobCount)) {
        return Response.json(
          { error: `Free plan is limited to 5 active roles. You have ${activeCount} active and tried to add ${newJobCount} new roles. Upgrade to Pro for unlimited tracking.` },
          { status: 403 },
        );
      }
    }

    const result = await importJobEmailEntries(client, user, importRequest.jobs, {
      searchRunDate: importRequest.searchRunDate,
    });
    return Response.json(result, { status: 201 });
  } catch (error) {
    console.error("Bulk create failed", error);
    return Response.json({ error: "The applications could not be created. No changes were made." }, { status: 500 });
  } finally {
    client.release();
  }
}
