import { z } from "zod";

export const emailMatchParseInputSchema = z.object({
  text: z.string().trim().min(50).max(80000),
  enrich: z.boolean().optional(),
  useAI: z.boolean().optional(),
});

export const emailMatchEntrySchema = z.object({
  title: z.string().trim().max(200),
  company: z.string().trim().max(200),
  location: z.string().trim().max(200),
  workArrangement: z.string().trim().max(60),
  postingDate: z.string().trim().max(60),
  salaryMin: z.number().int().nullable(),
  salaryMax: z.number().int().nullable(),
  salaryCurrency: z.string().trim().length(3),
  whyItMatches: z.string(),
  notableGaps: z.string(),
  applyUrl: z.string(),
  rawText: z.string(),
  confidence: z.enum(["low", "medium", "high"]),
});

export const emailMatchParseResultSchema = z.object({
  header: z.string(),
  footer: z.string(),
  jobs: z.array(emailMatchEntrySchema),
  parseWarnings: z.array(z.string()),
});

export type EmailMatchParseInput = z.infer<typeof emailMatchParseInputSchema>;
export type EmailMatchEntry = z.infer<typeof emailMatchEntrySchema>;
export type EmailMatchParseResult = z.infer<typeof emailMatchParseResultSchema>;
