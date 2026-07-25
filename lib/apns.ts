import { connect } from "node:http2";
import { importPKCS8, SignJWT } from "jose";

const bundleId = "com.careergroove.careergroove";
let cachedToken: { value: string; expiresAt: number } | null = null;

async function providerToken() {
  if (cachedToken && cachedToken.expiresAt > Date.now()) return cachedToken.value;
  const keyId = process.env.APNS_KEY_ID;
  const teamId = process.env.APNS_TEAM_ID;
  const privateKey = process.env.APNS_PRIVATE_KEY?.replace(/\\n/g, "\n");
  if (!keyId || !teamId || !privateKey) throw new Error("APNs credentials are not configured.");
  const key = await importPKCS8(privateKey, "ES256");
  const value = await new SignJWT({})
    .setProtectedHeader({ alg: "ES256", kid: keyId })
    .setIssuer(teamId)
    .setIssuedAt()
    .sign(key);
  cachedToken = { value, expiresAt: Date.now() + 50 * 60 * 1000 };
  return value;
}

export async function sendAPNsNotification(input: {
  deviceToken: string;
  environment: "sandbox" | "production";
  title: string;
  body: string;
  category: string;
  path?: string;
}) {
  const host = input.environment === "sandbox"
    ? "https://api.sandbox.push.apple.com"
    : "https://api.push.apple.com";
  const token = await providerToken();
  const client = connect(host);
  const payload = JSON.stringify({
    aps: {
      alert: { title: input.title, body: input.body },
      sound: "default",
      "thread-id": input.category,
    },
    category: input.category,
    path: input.path ?? null,
  });
  if (Buffer.byteLength(payload) > 4096) throw new Error("APNs payload exceeds 4 KB.");

  return new Promise<{ status: number; reason?: string }>((resolve, reject) => {
    client.once("error", reject);
    const request = client.request({
      ":method": "POST",
      ":path": `/3/device/${input.deviceToken}`,
      authorization: `bearer ${token}`,
      "apns-topic": bundleId,
      "apns-push-type": "alert",
      "apns-priority": "10",
      "content-type": "application/json",
    });
    let status = 0;
    let response = "";
    request.setEncoding("utf8");
    request.on("response", (headers) => { status = Number(headers[":status"] ?? 0); });
    request.on("data", (chunk) => { response += chunk; });
    request.on("end", () => {
      client.close();
      let reason: string | undefined;
      try { reason = JSON.parse(response).reason; } catch {}
      resolve({ status, reason });
    });
    request.on("error", (error) => { client.close(); reject(error); });
    request.end(payload);
  });
}
