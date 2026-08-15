export class JobEmailImportError extends Error {
  constructor(
    public readonly code:
      | "JOB_JSON_MARKERS_NOT_FOUND"
      | "JOB_JSON_END_MARKER_MISSING"
      | "JOB_JSON_EMPTY"
      | "JOB_JSON_INVALID"
      | "JOB_JSON_SCHEMA_UNSUPPORTED"
      | "JOB_JSON_VALIDATION_FAILED",
    message: string,
  ) {
    super(message);
    this.name = "JobEmailImportError";
  }
}
