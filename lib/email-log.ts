import { db } from "./db";

export type EmailSendLogInput = {
  userId: string;
  followUpId?: string | null;
  applicationId?: string | null;
  emailConnectionId?: string | null;
  provider?: string | null;
  recipientEmail: string;
  subject: string;
  body: string;
  status: "sent" | "failed";
  error?: string | null;
  providerMessageId?: string | null;
};

/**
 * Persists a record of every attempted follow-up email send.
 *
 * On success this is the authoritative proof an email actually went out:
 * it stores the real recipient, subject and message body. Failures are
 * logged too (with the error) so delivery problems are never silent.
 */
export async function recordEmailSend(input: EmailSendLogInput): Promise<void> {
  await db.query(
    `INSERT INTO email_send_log(
       user_id, follow_up_id, application_id, email_connection_id, provider,
       recipient_email, subject, body, status, error, provider_message_id, created_at
     ) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,now())`,
    [
      input.userId,
      input.followUpId ?? null,
      input.applicationId ?? null,
      input.emailConnectionId ?? null,
      input.provider ?? null,
      input.recipientEmail,
      input.subject,
      input.body,
      input.status,
      input.error ?? null,
      input.providerMessageId ?? null,
    ],
  );
}
