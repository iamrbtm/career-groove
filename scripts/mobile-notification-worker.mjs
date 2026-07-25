const intervalMs = Number(process.env.MOBILE_NOTIFICATION_INTERVAL_MS || 300000);
const endpoint = process.env.MOBILE_NOTIFICATION_ENDPOINT || "http://app:3000/api/internal/mobile-notifications";
const secret = process.env.MOBILE_NOTIFICATION_WORKER_SECRET;

if (!secret) {
  console.error("MOBILE_NOTIFICATION_WORKER_SECRET is required.");
  process.exit(1);
}

async function run() {
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { Authorization: `Bearer ${secret}` },
      signal: AbortSignal.timeout(120000),
    });
    const body = await response.text();
    if (!response.ok) throw new Error(`${response.status} ${body}`);
    console.log(new Date().toISOString(), body);
  } catch (error) {
    console.error(new Date().toISOString(), "Mobile notification run failed:", error);
  }
}

await new Promise((resolve) => setTimeout(resolve, 15000));
while (true) {
  await run();
  await new Promise((resolve) => setTimeout(resolve, intervalMs));
}
