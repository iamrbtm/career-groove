import { z } from "zod";
import { dateSchema, jsonObjectSchema, uuidSchema } from "./common.js";
const emptyToNull = (value) => (value === "" ? null : value);
const nullableText = (max) => z.preprocess(emptyToNull, z.string().trim().max(max).nullable().default(null));
const nullableDate = z.preprocess(emptyToNull, dateSchema.nullable().default(null));
export const contactCreateSchema = z
    .object({
    jobId: uuidSchema.nullable().default(null),
    name: z.string().trim().min(1).max(160),
    company: nullableText(160),
    role: nullableText(160),
    email: z.preprocess(emptyToNull, z.string().trim().toLowerCase().email().max(320).nullable().default(null)),
    phone: nullableText(60),
    relationshipStrength: z.number().int().min(1).max(5).default(1),
    note: nullableText(3_000),
})
    .strict();
export const contactUpdateSchema = contactCreateSchema.partial();
export const residenceAddressSchema = z
    .object({
    street: z.string().trim().min(1).max(200),
    city: z.string().trim().min(1).max(120),
    region: nullableText(120),
    country: z.string().trim().min(2).max(120),
    postalCode: nullableText(30),
})
    .strict();
export const residenceCreateSchema = z
    .object({
    label: z.string().trim().min(1).max(160),
    address: residenceAddressSchema,
    startedOn: nullableDate,
    endedOn: nullableDate,
    metadata: jsonObjectSchema.default({}),
})
    .strict()
    .refine(({ startedOn, endedOn }) => !startedOn || !endedOn || startedOn <= endedOn, { message: "endedOn must not be before startedOn", path: ["endedOn"] });
export const credentialCreateSchema = z
    .object({
    kind: z.enum(["license", "education", "certification"]),
    name: z.string().trim().min(1).max(200),
    issuer: nullableText(200),
    issuedOn: nullableDate,
    expiresOn: nullableDate,
    details: jsonObjectSchema.default({}),
})
    .strict()
    .refine(({ issuedOn, expiresOn }) => !issuedOn || !expiresOn || issuedOn <= expiresOn, { message: "expiresOn must not be before issuedOn", path: ["expiresOn"] });
export const skillCategories = [
    "interpersonal_behavioral",
    "cognitive_methodological",
    "technical_digital",
    "business_operational",
    "specialized_vocational",
    "other",
];
export const skillCreateSchema = z
    .object({
    name: z.string().trim().min(1).max(160),
    proficiency: z.number().int().min(1).max(5).default(3),
    category: z.enum(skillCategories).default("other"),
})
    .strict();
export const skillUpdateSchema = skillCreateSchema.partial();
export const documentCreateSchema = z
    .object({
    kind: z.enum(["resume", "cover_letter", "other"]),
    title: z.string().trim().min(1).max(200),
    text: z.string().min(1).max(100_000),
    targetJob: jsonObjectSchema.default({}),
})
    .strict();
export const settingsUpdateSchema = z
    .object({
    musicStation: z.enum(["Lo-Fi", "Ambient", "Classical", "Brain Waves"]).optional(),
    reducedMotion: z.boolean().optional(),
    aiProvider: z.enum(["openai", "anthropic", "google", "ollama"]).optional(),
})
    .strict()
    .refine((value) => Object.keys(value).length > 0, "No settings supplied");
export const providerSchema = z.enum(["openai", "anthropic", "google", "ollama"]);
//# sourceMappingURL=domains.js.map