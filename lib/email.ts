import { db } from "./db";

export type EmailProvider = "gmail" | "outlook" | "smtp";

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

export async function sendEmail(userId: string, connectionId: string, payload: EmailPayload): Promise<{ ok: boolean; error?: string }> {
  const conn = await db.query(
    `SELECT provider, email, encrypted_access_token, encrypted_refresh_token, smtp_host, smtp_port,
            smtp_username, encrypted_smtp_password, sender_name
     FROM email_connections WHERE id=$1 AND user_id=$2`,
    [connectionId, userId],
  );
  if (!conn.rowCount) return { ok: false, error: "Email connection not found." };

  const connection = conn.rows[0];

  try {
    if (connection.provider === "smtp") {
      return await sendViaSMTP(connection, payload);
    }
    return await sendViaAPI(connection, payload);
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Failed to send email." };
  }
}

async function sendViaSMTP(connection: Record<string, unknown>, payload: EmailPayload): Promise<{ ok: boolean; error?: string }> {
  return { ok: false, error: "SMTP sending requires nodemailer. Configure your SMTP credentials in Settings." };
}

async function sendViaAPI(connection: Record<string, unknown>, payload: EmailPayload): Promise<{ ok: boolean; error?: string }> {
  const provider = connection.provider as string;
  const accessToken = connection.encrypted_access_token as string | null;

  if (!accessToken) return { ok: false, error: "No access token. Reconnect your email account." };

  if (provider === "gmail") {
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
        Authorization: `Bearer ${accessToken}`,
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

  if (provider === "outlook") {
    const response = await fetch("https://graph.microsoft.com/v1.0/me/sendMail", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
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

  return { ok: false, error: `Provider ${provider} is not supported yet.` };
}
