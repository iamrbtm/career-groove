import { z } from "zod";

const optionalDate = z.union([z.string().date(), z.literal(""), z.null()]).optional();

export const jobInput = z.object({
  company: z.string().trim().min(1).max(160),
  title: z.string().trim().min(1).max(160),
  location: z.string().trim().max(160).optional().nullable(),
  startedOn: optionalDate,
  endedOn: optionalDate,
  current: z.boolean().default(false),
  rawNotes: z.string().max(30000).optional().nullable(),
  achievements: z.array(z.string().trim().min(1).max(1000)).default([]),
  inferredSkills: z.array(z.object({
    name: z.string().trim().min(1).max(120),
    category: z.enum(["interpersonal_behavioral", "cognitive_methodological", "technical_digital", "business_operational", "specialized_vocational", "other"]),
  })).max(30).default([]),
  metadata: z.record(z.unknown()).default({}),
});

export const jobUpdate = jobInput.partial();
