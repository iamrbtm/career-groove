import { randomBytes } from "node:crypto";

const baseURL = process.env.MOBILE_AUTH_TEST_BASE_URL || "http://127.0.0.1:3000";
const suffix = randomBytes(8).toString("hex");
const email = `ios-smoke-${suffix}@example.invalid`;
const password = `Smoke-${suffix}-9z`;
let accessToken = null;

async function request(path, options = {}) {
  const response = await fetch(`${baseURL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers ?? {}),
    },
  });
  const text = await response.text();
  const body = text ? JSON.parse(text) : null;
  return { response, body };
}

try {
  let result = await request("/api/register", {
    method: "POST",
    body: JSON.stringify({ name: "iOS Smoke Test", email, password }),
  });
  if (result.response.status !== 201) throw new Error(`Register failed: ${result.response.status}`);

  result = await request("/api/mobile/auth/signin", {
    method: "POST",
    body: JSON.stringify({ email, password, deviceName: "CI Simulator" }),
  });
  if (result.response.status !== 200) throw new Error(`Sign in failed: ${result.response.status}`);
  const oldAccessToken = result.body.accessToken;
  const refreshToken = result.body.refreshToken;
  accessToken = oldAccessToken;

  result = await request("/api/profile", {
    headers: { Authorization: `Bearer ${oldAccessToken}` },
  });
  if (result.response.status !== 200 || result.body.profile.email !== email) {
    throw new Error(`Bearer profile failed: ${result.response.status}`);
  }

  result = await request("/api/mobile/auth/refresh", {
    method: "POST",
    body: JSON.stringify({ refreshToken }),
  });
  if (result.response.status !== 200) throw new Error(`Refresh failed: ${result.response.status}`);
  accessToken = result.body.accessToken;

  result = await request("/api/profile", {
    headers: { Authorization: `Bearer ${oldAccessToken}` },
  });
  if (result.response.status !== 401) throw new Error("Rotated access token remained valid.");

  result = await request("/api/profile", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (result.response.status !== 200) throw new Error(`New access token failed: ${result.response.status}`);

  result = await request("/api/mobile/account", {
    method: "DELETE",
    headers: { Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({ confirmation: "DELETE" }),
  });
  if (result.response.status !== 204) throw new Error(`Account deletion failed: ${result.response.status}`);
  accessToken = null;
  console.log("Mobile auth lifecycle passed.");
} finally {
  if (accessToken) {
    await request("/api/mobile/account", {
      method: "DELETE",
      headers: { Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({ confirmation: "DELETE" }),
    }).catch(() => undefined);
  }
}
