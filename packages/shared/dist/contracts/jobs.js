import { z } from "zod";
import { dateSchema, jsonObjectSchema, timestampSchema, uuidSchema, } from "./common.js";
const jobMutableShape = {
    company: z.string().trim().min(1).max(200),
    title: z.string().trim().min(1).max(200),
    location: z.string().trim().max(300).nullable().default(null),
    startedOn: dateSchema.nullable().default(null),
    endedOn: dateSchema.nullable().default(null),
    current: z.boolean().default(false),
    rawNotes: z.string().max(100_000).nullable().default(null),
    achievements: z.array(z.unknown()).max(1_000).default([]),
    metadata: jsonObjectSchema.default({}),
};
function validDateRange(value) {
    return !value.startedOn || !value.endedOn || value.startedOn <= value.endedOn;
}
export const createJobSchema = z
    .object(jobMutableShape)
    .strict()
    .refine(validDateRange, {
    message: "endedOn must not be before startedOn",
    path: ["endedOn"],
});
export const updateJobSchema = z
    .object(jobMutableShape)
    .partial()
    .strict()
    .refine(validDateRange, {
    message: "endedOn must not be before startedOn",
    path: ["endedOn"],
});
export const jobSchema = z.object({
    id: uuidSchema,
    userId: uuidSchema,
    ...jobMutableShape,
    createdAt: timestampSchema,
    updatedAt: timestampSchema,
});
export const databaseJobSchema = z.object({
    id: uuidSchema,
    user_id: uuidSchema,
    company: z.string(),
    title: z.string(),
    location: z.string().nullable(),
    started_on: dateSchema.nullable(),
    ended_on: dateSchema.nullable(),
    current: z.boolean(),
    raw_notes: z.string().nullable(),
    achievements: z.array(z.unknown()),
    metadata: jsonObjectSchema,
    created_at: z.coerce.date(),
    updated_at: z.coerce.date(),
});
export function serializeJob(row) {
    return jobSchema.parse({
        id: row.id,
        userId: row.user_id,
        company: row.company,
        title: row.title,
        location: row.location,
        startedOn: row.started_on,
        endedOn: row.ended_on,
        current: row.current,
        rawNotes: row.raw_notes,
        achievements: row.achievements,
        metadata: row.metadata,
        createdAt: row.created_at.toISOString(),
        updatedAt: row.updated_at.toISOString(),
    });
}
//# sourceMappingURL=jobs.js.map