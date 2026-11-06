import { randomUUID } from "node:crypto";
import { createTransport } from "nodemailer";
import { and, eq } from "drizzle-orm";
import { db } from "./db";
import { emailLog } from "./db/schema";
import { getSetting } from "./settings";

export interface SmtpConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  from: string;
  secure: boolean;
}

export async function getSmtpConfig(): Promise<SmtpConfig | null> {
  const host = await getSetting("smtp.host");
  const port = await getSetting("smtp.port");
  if (!host) return null;
  return {
    host,
    port: port ? Number(port) : 587,
    user: (await getSetting("smtp.user")) ?? "",
    password: (await getSetting("smtp.password")) ?? "",
    from: (await getSetting("smtp.from")) ?? (await getSetting("smtp.user")) ?? "",
    secure: (await getSetting("smtp.secure")) === "true",
  };
}

export async function sendEmail(input: {
  userId: string;
  applicationId?: string | null;
  toEmail: string;
  subject: string;
  body: string;
}): Promise<{ ok: boolean; error?: string }> {
  const config = await getSmtpConfig();
  if (!config) return { ok: false, error: "SMTP is not configured." };
  try {
    const transport = createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth: config.user ? { user: config.user, pass: config.password } : undefined,
    });
    const info = await transport.sendMail({
      from: config.from || config.user,
      to: input.toEmail,
      subject: input.subject,
      text: input.body,
    });
    await db.insert(emailLog).values({
      userId: input.userId,
      applicationId: input.applicationId ?? null,
      toEmail: input.toEmail,
      subject: input.subject,
      body: input.body,
      provider: config.host,
      status: "sent",
      sentAt: new Date(),
    });
    return { ok: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Send failed.";
    await db.insert(emailLog).values({
      userId: input.userId,
      applicationId: input.applicationId ?? null,
      toEmail: input.toEmail,
      subject: input.subject,
      body: input.body,
      provider: config.host,
      status: "failed",
      error: message,
      sentAt: new Date(),
    });
    return { ok: false, error: message };
  }
}

export async function listEmailLog(userId: string) {
  return db.select().from(emailLog).where(eq(emailLog.userId, userId)).orderBy(emailLog.createdAt);
}