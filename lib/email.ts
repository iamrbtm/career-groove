import nodemailer from "nodemailer";
import { decryptSecret } from "./secret-box";
import { db } from "./db";

export type EmailProvider = "gmail" | "icloud" | "yahoo" | "outlook" | "smtp";

export type EmailConnection = {
  id: string;
  provider: EmailProvider;
  email: string;
  senderName: string | null;
  active: boolean;
  lastSyncAt: string | null;
};

export type EmailPayload = {
  to: string;
  subject: string;
  body: string;
  htmlBody?: string;
  attachments?: Array<{ filename: string; content: Buffer; contentType: string }>;
};

/** Provider presets for SMTP auto-fill in the UI and for sending. */
export const EMAIL_PROVIDER_PRESETS: Record<
  Exclude<EmailProvider, "smtp">,
  { smtpHost: string; smtpPort: number; label: string; appPasswordNote: string }
> = {
  gmail: {
    smtpHost: "smtp.gmail.com",
    smtpPort: 587,
    label: "Gmail",
    appPasswordNote:
      "Go to your Google Account → Security → 2-Step Verification → App passwords. Generate one for \"Mail\" and paste it below.",
  },
  icloud: {
    smtpHost: "smtp.mail.me.com",
    smtpPort: 587,
    label: "iCloud",
    appPasswordNote:
      "Sign in at appleid.apple.com → Sign-In and Security → App-Specific Passwords. Generate one and paste it below.",
  },
  yahoo: {
    smtpHost: "smtp.mail.yahoo.com",
    smtpPort: 587,
    label: "Yahoo",
    appPasswordNote:
      "In Yahoo Mail go to Account Security → Generate app password. Select \"Other App\", then paste the generated password below.",
  },
  outlook: {
    smtpHost: "smtp-mail.outlook.com",
    smtpPort: 587,
    label: "Outlook",
    appPasswordNote:
      "Use your regular Outlook password. If your account has two-factor authentication enabled, generate an app password at account.microsoft.com → Security.",
  },
};

export async function getUserEmailConnections(userId: string): Promise<EmailConnection[]> {
  const result = await db.query(
    `SELECT id, provider, email, sender_name AS "senderName", active, last_sync_at AS "lastSyncAt"
     FROM email_connections WHERE user_id=$1 ORDER BY active DESC, created_at DESC`,
    [userId],
  );
  return result.rows;
}

export async function getActiveEmailConnection(userId: string): Promise<EmailConnection | null> {
  const result = await db.query(
    `SELECT id, provider, email, sender_name AS "senderName", active, last_sync_at AS "lastSyncAt"
     FROM email_connections WHERE user_id=$1 AND active=true LIMIT 1`,
    [userId],
  );
  return result.rows[0] ?? null;
}

export async function sendEmail(
  userId: string,
  connectionId: string,
  payload: EmailPayload,
): Promise<{ ok: boolean; error?: string }> {
  const conn = await db.query(
    `SELECT provider, email, encrypted_access_token, encrypted_refresh_token, smtp_host, smtp_port,
            smtp_username, encrypted_smtp_password, sender_name
     FROM email_connections WHERE id=$1 AND user_id=$2`,
    [connectionId, userId],
  );
  if (!conn.rowCount) return { ok: false, error: "Email connection not found." };

  const connection = conn.rows[0];

  try {
    // gmail and outlook with access tokens use the API path
    if (connection.provider === "gmail" && connection.encrypted_access_token) {
      return await sendViaGmailApi(connection, payload);
    }
    if (connection.provider === "outlook" && connection.encrypted_access_token) {
      return await sendViaOutlookApi(connection, payload);
    }
    // icloud, yahoo, smtp, and gmail/outlook without tokens use SMTP
    return await sendViaSMTP(connection, payload);
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Failed to send email." };
  }
}

async function sendViaSMTP(
  connection: Record<string, unknown>,
  payload: EmailPayload,
): Promise<{ ok: boolean; error?: string }> {
  const provider = connection.provider as EmailProvider;
  const preset = provider !== "smtp" ? EMAIL_PROVIDER_PRESETS[provider as Exclude<EmailProvider, "smtp">] : null;

  const host = (connection.smtp_host as string | null) ?? preset?.smtpHost;
  const port = (connection.smtp_port as number | null) ?? preset?.smtpPort ?? 587;
  const username = (connection.smtp_username as string | null) ?? (connection.email as string);

  const encryptedPassword = connection.encrypted_smtp_password as string | null;
  if (!encryptedPassword) {
    return {
      ok: false,
      error: "No SMTP password configured. Add your app password in Settings → Email.",
    };
  }
  if (!host) {
    return { ok: false, error: "No SMTP host configured." };
  }

  let password: string;
  try {
    password = decryptSecret(encryptedPassword);
  } catch {
    return { ok: false, error: "Could not decrypt SMTP password. Please re-save your email settings." };
  }

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user: username, pass: password },
  });

  const from = connection.sender_name
    ? `${connection.sender_name} <${connection.email}>`
    : (connection.email as string);

  await transporter.sendMail({
    from,
    to: payload.to,
    subject: payload.subject,
    text: payload.body,
    html: payload.htmlBody ?? undefined,
    attachments: payload.attachments?.map((a) => ({
      filename: a.filename,
      content: a.content,
      contentType: a.contentType,
    })),
  });

  return { ok: true };
}

async function sendViaGmailApi(
  connection: Record<string, unknown>,
  payload: EmailPayload,
): Promise<{ ok: boolean; error?: string }> {
  let token: string;
  try {
    token = decryptSecret(connection.encrypted_access_token as string);
  } catch {
    return { ok: false, error: "Could not decrypt Gmail access token." };
  }

  const utf8Subject = `=?utf-8?B?${Buffer.from(payload.subject).toString("base64")}?=`;
  const messageParts = [
    `From: ${connection.sender_name ?? "Me"} <${connection.email}>`,
    `To: ${payload.to}`,
    `Subject: ${utf8Subject}`,
    "MIME-Version: 1.0",
    "Content-Type: text/html; charset=utf-8",
    "Content-Transfer-Encoding: base64",
    "",
    Buffer.from(payload.htmlBody ?? payload.body).toString("base64"),
  ];
  const raw = Buffer.from(messageParts.join("\n")).toString("base64url");
  const response = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
    method: "POST",
    headers: {
        Authorization: "Bearer " + token,
        "Content-Type": "application/json",
      },
    body: JSON.stringify({ raw }),
  });
  if (!response.ok) {
    const error = await response.text();
    return { ok: false, error: `Gmail API error: ${error}` };
  }
  return { ok: true };
}

async function sendViaOutlookApi(
  connection: Record<string, unknown>,
  payload: EmailPayload,
): Promise<{ ok: boolean; error?: string }> {
  let token: string;
  try {
    token = decryptSecret(connection.encrypted_access_token as string);
  } catch {
    return { ok: false, error: "Could not decrypt Outlook access token." };
  }

  const response = await fetch("https://graph.microsoft.com/v1.0/me/sendMail", {
    method: "POST",
    headers: {
        Authorization: "Bearer " + token,
        "Content-Type": "application/json",
      },
    body: JSON.stringify({
      message: {
        subject: payload.subject,
        body: { contentType: "html", content: payload.htmlBody ?? payload.body },
        toRecipients: [{ emailAddress: { address: payload.to } }],
      },
    }),
  });
  if (!response.ok) {
    const error = await response.text();
    return { ok: false, error: `Outlook API error: ${error}` };
  }
  return { ok: true };
}
