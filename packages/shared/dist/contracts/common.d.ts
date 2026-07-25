import { z } from "zod";
export declare const uuidSchema: z.ZodString;
export declare const dateSchema: z.ZodString;
export declare const timestampSchema: z.ZodString;
export declare const jsonObjectSchema: z.ZodRecord<z.ZodString, z.ZodUnknown>;
export declare const apiErrorSchema: z.ZodObject<{
    error: z.ZodObject<{
        code: z.ZodString;
        message: z.ZodString;
        requestId: z.ZodString;
        details: z.ZodOptional<z.ZodUnknown>;
    }, "strip", z.ZodTypeAny, {
        code: string;
        message: string;
        requestId: string;
        details?: unknown;
    }, {
        code: string;
        message: string;
        requestId: string;
        details?: unknown;
    }>;
}, "strip", z.ZodTypeAny, {
    error: {
        code: string;
        message: string;
        requestId: string;
        details?: unknown;
    };
}, {
    error: {
        code: string;
        message: string;
        requestId: string;
        details?: unknown;
    };
}>;
export type ApiError = z.infer<typeof apiErrorSchema>;
//# sourceMappingURL=common.d.ts.map