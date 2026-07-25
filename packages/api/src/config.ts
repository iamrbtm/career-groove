import { z } from "zod";

const productionSecret = z.string().min(32);

export const apiConfigSchema = z.object({
  allowedOrigins: z.array(z.string().url()).min(1),
  bodyLimitBytes: z.number().int().positive().max(10 * 1024 * 1024),
  databaseUrl: z.string().min(1),
  internalWorkerSecret: productionSecret,
  nodeEnv: z.enum(["development", "test", "production"]),
  port: z.number().int().min(1).max(65_535),
  providerEncryptionKey: productionSecret,
});

export type ApiConfig = z.infer<typeof apiConfigSchema>;

function commaSeparated(value: string | undefined): string[] {
  return (value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export function loadConfig(environment: NodeJS.ProcessEnv = process.env): ApiConfig {
  return apiConfigSchema.parse({
    allowedOrigins: commaSeparated(environment.ALLOWED_ORIGINS),
    bodyLimitBytes: Number(environment.API_BODY_LIMIT_BYTES ?? 2 * 1024 * 1024),
    databaseUrl: environment.DATABASE_URL,
    internalWorkerSecret: environment.INTERNAL_WORKER_SECRET,
    nodeEnv: environment.NODE_ENV ?? "development",
    port: Number(environment.PORT ?? 3_001),
    providerEncryptionKey:
      environment.PROVIDER_ENCRYPTION_KEY ?? environment.AUTH_SECRET,
  });
}
