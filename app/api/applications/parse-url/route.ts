import { auth } from "@/auth";
import { limitRequest, limitMax } from "@/lib/rate-limit";
import { parseJobPost } from "@/lib/job-post-parser";
import { safeFetchUrl, UnsafeUrlError } from "@/lib/fetch-url";
import { writeFile, unlink } from "node:fs/promises";
import { randomUUID } from "node:crypto";

function isSafeUrl(input: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(input);
  } catch {
    return false;
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return false;
  const hostname = parsed.hostname.toLowerCase();
  if (hostname === "localhost" || hostname === "127.0.0.1" || hostname === "0.0.0.0" || hostname === "[::1]") return false;
  if (hostname.endsWith(".local") || hostname.endsWith(".internal")) return false;
  if (/^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname)) return false;
  if (/^172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}$/.test(hostname)) return false;
  if (/^192\.168\.\d{1,3}\.\d{1,3}$/.test(hostname)) return false;
  if (/^169\.254\.\d{1,3}\.\d{1,3}$/.test(hostname)) return false;
  return true;
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await limitRequest(`parse-url:${session.user.id}`, limitMax("RATE_LIMIT_PARSE_URL_PER_HOUR", 10), 3600000)))
    return Response.json({ error: "Slow down — try again in a bit." }, { status: 429 });
  const { url, description } = await request.json();
  if (!url && !description) return Response.json({ error: "URL or description is required" }, { status: 400 });
  if (url && !isSafeUrl(url)) return Response.json({ error: "Only public job posting URLs are supported." }, { status: 400 });
  let text = description || "";
  if (url) {
    try {
      const { status, text: html } = await safeFetchUrl(url);
      if (status < 200 || status >= 300) {
        return Response.json({ error: `Could not fetch URL (${status})` }, { status: 400 });
      }
      const tmpPath = `/tmp/cg-parse-${randomUUID()}.html`;
      await writeFile(tmpPath, html);
      text = html
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
        .replace(/<[^>]+>/g, " ")
        .replace(/&[^;]+;/g, " ")
        .replace(/\s+/g, " ")
        .trim();
      await unlink(tmpPath).catch(() => {});
    } catch (error) {
      if (
        error instanceof UnsafeUrlError ||
        (error as { name?: string } | null)?.name === "TimeoutError"
      ) {
        return Response.json({ error: "Only public job posting URLs are supported." }, { status: 400 });
      }
      return Response.json({ error: "Could not fetch the URL content." }, { status: 400 });
    }
  }
  if (!text.trim()) return Response.json({ error: "No parseable content found." }, { status: 400 });
  const parsed = parseJobPost({ text, sourceUrl: url || undefined });
  return Response.json({ parsed, rawText: text });
}
