import { connect } from "node:http2";

import { importPKCS8, SignJWT } from "jose";

let cachedToken: { expiresAt: number; value: string } | undefined;

async function providerToken() {
  if (cachedToken && cachedToken.expiresAt > Date.now()) return cachedToken.value;
  const keyId = process.env.APNS_KEY_ID;
  const teamId = process.env.APNS_TEAM_ID;
  const privateKey = process.env.APNS_PRIVATE_KEY?.replace(/\\n/g, "\n");
  if (!keyId || !teamId || !privateKey) {
    throw new Error("APNs credentials are not configured");
  }
  const key = await importPKCS8(privateKey, "ES256");
  const value = await new SignJWT({})
    .setProtectedHeader({ alg: "ES256", kid: keyId })
    .setIssuer(teamId)
    .setIssuedAt()
    .sign(key);
  cachedToken = { expiresAt: Date.now() + 50 * 60_000, value };
  return value;
}

export interface PushCandidate {
  body: string;
  category: string;
  deviceToken: string;
  environment: "sandbox" | "production";
  path: string | null;
  title: string;
}

export async function sendApns(candidate: PushCandidate) {
  const token = await providerToken();
  const payload = JSON.stringify({
    aps: {
      alert: { body: candidate.body, title: candidate.title },
      sound: "default",
      "thread-id": candidate.category,
    },
    category: candidate.category,
    path: candidate.path,
  });
  if (Buffer.byteLength(payload) > 4_096) {
    throw new Error("APNs payload exceeds 4 KB");
  }
  const client = connect(
    candidate.environment === "sandbox"
      ? "https://api.sandbox.push.apple.com"
      : "https://api.push.apple.com",
  );
  return new Promise<{ reason?: string; status: number }>((resolve, reject) => {
    client.once("error", reject);
    const request = client.request({
      ":method": "POST",
      ":path": `/3/device/${candidate.deviceToken}`,
      authorization: `bearer ${token}`,
      "apns-priority": "10",
      "apns-push-type": "alert",
      "apns-topic": process.env.APP_STORE_BUNDLE_ID ?? "website.careergroove.app",
      "content-type": "application/json",
    });
    let body = "";
    let status = 0;
    request.setEncoding("utf8");
    request.on("response", (headers) => {
      status = Number(headers[":status"] ?? 0);
    });
    request.on("data", (chunk) => {
      body += chunk;
    });
    request.on("error", (error) => {
      client.close();
      reject(error);
    });
    request.on("end", () => {
      client.close();
      let reason: string | undefined;
      try {
        reason = (JSON.parse(body) as { reason?: string }).reason;
      } catch {
        reason = undefined;
      }
      resolve({ reason, status });
    });
    request.end(payload);
  });
}
