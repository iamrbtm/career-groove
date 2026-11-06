import { renderPdf } from "#lib/server/pdf";
import { getDocument } from "#lib/server/documents";

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "document";
}

export async function GET({ locals, params }: { locals: App.Locals; params: { id: string } }) {
  const user = locals.user!;
  const row = await getDocument(user.id, params.id);
  if (!row) return new Response("Not found", { status: 404 });
  const pdf = await renderPdf(row.document.title, row.document.bodyMarkdown);
  return new Response(Buffer.from(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${slugify(row.document.title)}.pdf"`,
    },
  });
}