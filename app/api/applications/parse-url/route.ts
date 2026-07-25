import { auth } from "@/auth";
import { parseJobPost } from "@/lib/job-post-parser";
import { writeFile, unlink } from "node:fs/promises";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const { url, description } = await request.json();
  if (!url && !description) return Response.json({ error: "URL or description is required" }, { status: 400 });
  let text = description || "";
  if (url) {
    try {
      const response = await fetch(url);
      if (!response.ok) return Response.json({ error: `Could not fetch URL (${response.status})` }, { status: 400 });
      const html = await response.text();
      const tmpPath = `/tmp/cg-parse-${Date.now()}.html`;
      await writeFile(tmpPath, html);
      text = html
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
        .replace(/<[^>]+>/g, " ")
        .replace(/&[^;]+;/g, " ")
        .replace(/\s+/g, " ")
        .trim();
      await unlink(tmpPath).catch(() => {});
    } catch {
      return Response.json({ error: "Could not fetch the URL content." }, { status: 400 });
    }
  }
  if (!text.trim()) return Response.json({ error: "No parseable content found." }, { status: 400 });
  const parsed = parseJobPost({ text, sourceUrl: url || undefined });
  return Response.json({ parsed });
}
