import { z } from "zod";
export declare const contactCreateSchema: z.ZodObject<{
    jobId: z.ZodDefault<z.ZodNullable<z.ZodString>>;
    name: z.ZodString;
    company: z.ZodEffects<z.ZodDefault<z.ZodNullable<z.ZodString>>, string | null, unknown>;
    role: z.ZodEffects<z.ZodDefault<z.ZodNullable<z.ZodString>>, string | null, unknown>;
    email: z.ZodEffects<z.ZodDefault<z.ZodNullable<z.ZodString>>, string | null, unknown>;
    phone: z.ZodEffects<z.ZodDefault<z.ZodNullable<z.ZodString>>, string | null, unknown>;
    relationshipStrength: z.ZodDefault<z.ZodNumber>;
    note: z.ZodEffects<z.ZodDefault<z.ZodNullable<z.ZodString>>, string | null, unknown>;
}, "strict", z.ZodTypeAny, {
    email: string | null;
    company: string | null;
    jobId: string | null;
    name: string;
    role: string | null;
    phone: string | null;
    relationshipStrength: number;
    note: string | null;
}, {
    name: string;
    email?: unknown;
    company?: unknown;
    jobId?: string | null | undefined;
    role?: unknown;
    phone?: unknown;
    relationshipStrength?: number | undefined;
    note?: unknown;
}>;
export declare const contactUpdateSchema: z.ZodObject<{
    jobId: z.ZodOptional<z.ZodDefault<z.ZodNullable<z.ZodString>>>;
    name: z.ZodOptional<z.ZodString>;
    company: z.ZodOptional<z.ZodEffects<z.ZodDefault<z.ZodNullable<z.ZodString>>, string | null, unknown>>;
    role: z.ZodOptional<z.ZodEffects<z.ZodDefault<z.ZodNullable<z.ZodString>>, string | null, unknown>>;
    email: z.ZodOptional<z.ZodEffects<z.ZodDefault<z.ZodNullable<z.ZodString>>, string | null, unknown>>;
    phone: z.ZodOptional<z.ZodEffects<z.ZodDefault<z.ZodNullable<z.ZodString>>, string | null, unknown>>;
    relationshipStrength: z.ZodOptional<z.ZodDefault<z.ZodNumber>>;
    note: z.ZodOptional<z.ZodEffects<z.ZodDefault<z.ZodNullable<z.ZodString>>, string | null, unknown>>;
}, "strict", z.ZodTypeAny, {
    email?: string | null | undefined;
    company?: string | null | undefined;
    jobId?: string | null | undefined;
    name?: string | undefined;
    role?: string | null | undefined;
    phone?: string | null | undefined;
    relationshipStrength?: number | undefined;
    note?: string | null | undefined;
}, {
    email?: unknown;
    company?: unknown;
    jobId?: string | null | undefined;
    name?: string | undefined;
    role?: unknown;
    phone?: unknown;
    relationshipStrength?: number | undefined;
    note?: unknown;
}>;
export declare const residenceAddressSchema: z.ZodObject<{
    street: z.ZodString;
    city: z.ZodString;
    region: z.ZodEffects<z.ZodDefault<z.ZodNullable<z.ZodString>>, string | null, unknown>;
    country: z.ZodString;
    postalCode: z.ZodEffects<z.ZodDefault<z.ZodNullable<z.ZodString>>, string | null, unknown>;
}, "strict", z.ZodTypeAny, {
    street: string;
    city: string;
    region: string | null;
    country: string;
    postalCode: string | null;
}, {
    street: string;
    city: string;
    country: string;
    region?: unknown;
    postalCode?: unknown;
}>;
export declare const residenceCreateSchema: z.ZodEffects<z.ZodObject<{
    label: z.ZodString;
    address: z.ZodObject<{
        street: z.ZodString;
        city: z.ZodString;
        region: z.ZodEffects<z.ZodDefault<z.ZodNullable<z.ZodString>>, string | null, unknown>;
        country: z.ZodString;
        postalCode: z.ZodEffects<z.ZodDefault<z.ZodNullable<z.ZodString>>, string | null, unknown>;
    }, "strict", z.ZodTypeAny, {
        street: string;
        city: string;
        region: string | null;
        country: string;
        postalCode: string | null;
    }, {
        street: string;
        city: string;
        country: string;
        region?: unknown;
        postalCode?: unknown;
    }>;
    startedOn: z.ZodEffects<z.ZodDefault<z.ZodNullable<z.ZodString>>, string | null, unknown>;
    endedOn: z.ZodEffects<z.ZodDefault<z.ZodNullable<z.ZodString>>, string | null, unknown>;
    metadata: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
}, "strict", z.ZodTypeAny, {
    metadata: Record<string, unknown>;
    label: string;
    address: {
        street: string;
        city: string;
        region: string | null;
        country: string;
        postalCode: string | null;
    };
    startedOn: string | null;
    endedOn: string | null;
}, {
    label: string;
    address: {
        street: string;
        city: string;
        country: string;
        region?: unknown;
        postalCode?: unknown;
    };
    metadata?: Record<string, unknown> | undefined;
    startedOn?: unknown;
    endedOn?: unknown;
}>, {
    metadata: Record<string, unknown>;
    label: string;
    address: {
        street: string;
        city: string;
        region: string | null;
        country: string;
        postalCode: string | null;
    };
    startedOn: string | null;
    endedOn: string | null;
}, {
    label: string;
    address: {
        street: string;
        city: string;
        country: string;
        region?: unknown;
        postalCode?: unknown;
    };
    metadata?: Record<string, unknown> | undefined;
    startedOn?: unknown;
    endedOn?: unknown;
}>;
export declare const credentialCreateSchema: z.ZodEffects<z.ZodObject<{
    kind: z.ZodEnum<["license", "education", "certification"]>;
    name: z.ZodString;
    issuer: z.ZodEffects<z.ZodDefault<z.ZodNullable<z.ZodString>>, string | null, unknown>;
    issuedOn: z.ZodEffects<z.ZodDefault<z.ZodNullable<z.ZodString>>, string | null, unknown>;
    expiresOn: z.ZodEffects<z.ZodDefault<z.ZodNullable<z.ZodString>>, string | null, unknown>;
    details: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
}, "strict", z.ZodTypeAny, {
    details: Record<string, unknown>;
    name: string;
    kind: "license" | "education" | "certification";
    issuer: string | null;
    issuedOn: string | null;
    expiresOn: string | null;
}, {
    name: string;
    kind: "license" | "education" | "certification";
    details?: Record<string, unknown> | undefined;
    issuer?: unknown;
    issuedOn?: unknown;
    expiresOn?: unknown;
}>, {
    details: Record<string, unknown>;
    name: string;
    kind: "license" | "education" | "certification";
    issuer: string | null;
    issuedOn: string | null;
    expiresOn: string | null;
}, {
    name: string;
    kind: "license" | "education" | "certification";
    details?: Record<string, unknown> | undefined;
    issuer?: unknown;
    issuedOn?: unknown;
    expiresOn?: unknown;
}>;
export declare const skillCategories: readonly ["interpersonal_behavioral", "cognitive_methodological", "technical_digital", "business_operational", "specialized_vocational", "other"];
export declare const skillCreateSchema: z.ZodObject<{
    name: z.ZodString;
    proficiency: z.ZodDefault<z.ZodNumber>;
    category: z.ZodDefault<z.ZodEnum<["interpersonal_behavioral", "cognitive_methodological", "technical_digital", "business_operational", "specialized_vocational", "other"]>>;
}, "strict", z.ZodTypeAny, {
    name: string;
    proficiency: number;
    category: "interpersonal_behavioral" | "cognitive_methodological" | "technical_digital" | "business_operational" | "specialized_vocational" | "other";
}, {
    name: string;
    proficiency?: number | undefined;
    category?: "interpersonal_behavioral" | "cognitive_methodological" | "technical_digital" | "business_operational" | "specialized_vocational" | "other" | undefined;
}>;
export declare const skillUpdateSchema: z.ZodObject<{
    name: z.ZodOptional<z.ZodString>;
    proficiency: z.ZodOptional<z.ZodDefault<z.ZodNumber>>;
    category: z.ZodOptional<z.ZodDefault<z.ZodEnum<["interpersonal_behavioral", "cognitive_methodological", "technical_digital", "business_operational", "specialized_vocational", "other"]>>>;
}, "strict", z.ZodTypeAny, {
    name?: string | undefined;
    proficiency?: number | undefined;
    category?: "interpersonal_behavioral" | "cognitive_methodological" | "technical_digital" | "business_operational" | "specialized_vocational" | "other" | undefined;
}, {
    name?: string | undefined;
    proficiency?: number | undefined;
    category?: "interpersonal_behavioral" | "cognitive_methodological" | "technical_digital" | "business_operational" | "specialized_vocational" | "other" | undefined;
}>;
export declare const documentCreateSchema: z.ZodObject<{
    kind: z.ZodEnum<["resume", "cover_letter", "other"]>;
    title: z.ZodString;
    text: z.ZodString;
    targetJob: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
}, "strict", z.ZodTypeAny, {
    title: string;
    kind: "other" | "resume" | "cover_letter";
    text: string;
    targetJob: Record<string, unknown>;
}, {
    title: string;
    kind: "other" | "resume" | "cover_letter";
    text: string;
    targetJob?: Record<string, unknown> | undefined;
}>;
export declare const settingsUpdateSchema: z.ZodEffects<z.ZodObject<{
    musicStation: z.ZodOptional<z.ZodEnum<["Lo-Fi", "Ambient", "Classical", "Brain Waves"]>>;
    reducedMotion: z.ZodOptional<z.ZodBoolean>;
    aiProvider: z.ZodOptional<z.ZodEnum<["openai", "anthropic", "google", "ollama"]>>;
}, "strict", z.ZodTypeAny, {
    musicStation?: "Lo-Fi" | "Ambient" | "Classical" | "Brain Waves" | undefined;
    reducedMotion?: boolean | undefined;
    aiProvider?: "google" | "openai" | "anthropic" | "ollama" | undefined;
}, {
    musicStation?: "Lo-Fi" | "Ambient" | "Classical" | "Brain Waves" | undefined;
    reducedMotion?: boolean | undefined;
    aiProvider?: "google" | "openai" | "anthropic" | "ollama" | undefined;
}>, {
    musicStation?: "Lo-Fi" | "Ambient" | "Classical" | "Brain Waves" | undefined;
    reducedMotion?: boolean | undefined;
    aiProvider?: "google" | "openai" | "anthropic" | "ollama" | undefined;
}, {
    musicStation?: "Lo-Fi" | "Ambient" | "Classical" | "Brain Waves" | undefined;
    reducedMotion?: boolean | undefined;
    aiProvider?: "google" | "openai" | "anthropic" | "ollama" | undefined;
}>;
export declare const providerSchema: z.ZodEnum<["openai", "anthropic", "google", "ollama"]>;
export type ProviderName = z.infer<typeof providerSchema>;
//# sourceMappingURL=domains.d.ts.map