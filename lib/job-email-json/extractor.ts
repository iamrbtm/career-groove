import { JobEmailImportError } from "@/lib/job-email-json/errors";

const START_MARKER = "BEGIN_JOB_JSON";
const END_MARKER = "END_JOB_JSON";

export function extractJobJson(emailBody: string): string {
  const start = emailBody.indexOf(START_MARKER);
  const end = emailBody.indexOf(END_MARKER);

  if (start < 0) {
    throw new JobEmailImportError("JOB_JSON_MARKERS_NOT_FOUND", "No JSON block markers were found.");
  }
  if (end < 0) {
    throw new JobEmailImportError("JOB_JSON_END_MARKER_MISSING", "The job JSON end marker is missing.");
  }
  if (end <= start) {
    throw new JobEmailImportError("JOB_JSON_INVALID", "The job JSON markers are out of order.");
  }

  const jsonText = emailBody.slice(start + START_MARKER.length, end).trim();
  if (!jsonText) {
    throw new JobEmailImportError("JOB_JSON_EMPTY", "The job JSON block is empty.");
  }

  return jsonText;
}
