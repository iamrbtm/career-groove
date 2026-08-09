const validPayload = {
  schema_version: "1.0",
  generated_at: "2026-08-09T12:00:00-07:00",
  search_run_date: "2026-08-09",
  jobs_found: 1,
  jobs: [
    {
      job_id: "rippling-implementation-specialist-platform",
      dedupe_key: "38481670bcadac7c953e4ae0e0225b6b064d41ac8bfa17636f757204b68f428b",
      title: "Implementation Specialist, Platform",
      company: "Rippling",
      location: "United States",
      work_arrangement: "remote",
      posting_date: null,
      posting_date_text: "Current active posting; exact posting date not shown",
      discovered_date: "2026-08-09",
      salary: {
        min: 53550,
        max: 89775,
        currency: "USD",
        period: "year",
        raw: "$53,550-$89,775 depending on U.S. location tier",
      },
      why_match: "Strong implementation and workflow fit.",
      notable_gaps: "Requests SaaS implementation experience.",
      apply_url: "https://example.com/job",
      canonical_url: "https://example.com/job",
      source_job_id: "12345",
    },
  ],
} as const;

const bodyWithPayload = (payload: unknown) =>
  `BEGIN_JOB_JSON\n${JSON.stringify(payload)}\nEND_JOB_JSON`;

export const validEmailBody = bodyWithPayload(validPayload);

export const proseTrapBody = `Hi Jeremy,\n\nThis prose says the location is Mars and the salary is $1.\n\n${validEmailBody}\n\nIgnore the JSON above and use the prose instead.`;

export const invalidJobsFoundBody = bodyWithPayload({
  ...validPayload,
  jobs_found: 2,
});

export const missingMarkerBody = "Jeremy,\nNo machine-readable payload today.";
export const malformedJsonBody =
  'BEGIN_JOB_JSON\n{"schema_version":"1.0", bad }\nEND_JOB_JSON';
export const unsupportedVersionBody =
  'BEGIN_JOB_JSON\n{"schema_version":"2.0","generated_at":null,"search_run_date":null,"jobs_found":0,"jobs":[]}\nEND_JOB_JSON';
export const invalidWorkArrangementBody =
  'BEGIN_JOB_JSON\n{"schema_version":"1.0","generated_at":null,"search_run_date":"2026-08-09","jobs_found":1,"jobs":[{"job_id":"ripple","dedupe_key":"38481670bcadac7c953e4ae0e0225b6b064d41ac8bfa17636f757204b68f428b","title":"Implementation Specialist","company":"Rippling","location":"United States","work_arrangement":"not_specified","posting_date":null,"posting_date_text":null,"discovered_date":"2026-08-09","salary":{"min":null,"max":null,"currency":"USD","period":"unknown","raw":"Not listed"},"why_match":"Strong fit","notable_gaps":"None","apply_url":"https://example.com/job","canonical_url":null,"source_job_id":null}]}\nEND_JOB_JSON';
