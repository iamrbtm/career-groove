import { JobEmailImportError } from "@/lib/job-email-json/errors";

const BASE64_START_MARKER = "BEGIN_JOB_JSON_BASE64";
const BASE64_END_MARKER = "END_JOB_JSON_BASE64";
const START_MARKER = "BEGIN_JOB_JSON";
const END_MARKER = "END_JOB_JSON";

function extractMarkedBlock(
  emailBody: string,
  startMarker: string,
  endMarker: string,
  missingMarkersMessage: string,
  missingEndMessage: string,
) {
  const start = emailBody.indexOf(startMarker);
  const end = emailBody.indexOf(endMarker);

  if (start < 0) {
    throw new JobEmailImportError("JOB_JSON_MARKERS_NOT_FOUND", missingMarkersMessage);
  }
  if (end < 0) {
    throw new JobEmailImportError("JOB_JSON_END_MARKER_MISSING", missingEndMessage);
  }
  if (end <= start) {
    throw new JobEmailImportError("JOB_JSON_INVALID", "The job JSON markers are out of order.");
  }

  const blockText = emailBody.slice(start + startMarker.length, end).trim();
  if (!blockText) {
    throw new JobEmailImportError("JOB_JSON_EMPTY", "The job JSON block is empty.");
  }

  return blockText;
}

function decodeBase64Json(blockText: string) {
  const compact = blockText.replace(/\s+/g, "");
  if (!compact || compact.length % 4 !== 0 || /[^A-Za-z0-9+/=]/.test(compact)) {
    throw new JobEmailImportError("JOB_JSON_INVALID", "The job JSON base64 block is invalid.");
  }

  const buffer = Buffer.from(compact, "base64");
  if (buffer.length === 0 || buffer.toString("base64").replace(/=+$/u, "") !== compact.replace(/=+$/u, "")) {
    throw new JobEmailImportError("JOB_JSON_INVALID", "The job JSON base64 block is invalid.");
  }

  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(buffer);
  } catch {
    throw new JobEmailImportError("JOB_JSON_INVALID", "The job JSON base64 block is invalid.");
  }
}

export function extractJobJson(emailBody: string): string {
  if (emailBody.includes(BASE64_START_MARKER) || emailBody.includes(BASE64_END_MARKER)) {
    const base64Block = extractMarkedBlock(
      emailBody,
      BASE64_START_MARKER,
      BASE64_END_MARKER,
      "No JSON base64 block markers were found.",
      "The job JSON base64 end marker is missing.",
    );
    return decodeBase64Json(base64Block);
  }

  return extractMarkedBlock(
    emailBody,
    START_MARKER,
    END_MARKER,
    "No JSON block markers were found.",
    "The job JSON end marker is missing.",
  );
}
