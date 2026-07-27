const intervalMs = Number(process.env.FOLLOW_UP_WORKER_INTERVAL_MS || 3600000);
const endpoint = process.env.FOLLOW_UP_WORKER_ENDPOINT || "http://app:3000/api/internal/follow-up-worker";
const secret = process.env.MOBILE_NOTIFICATION_WORKER_SECRET;

if (!secret) {
  console.error("MOBILE_NOTIFICATION_WORKER_SECRET is required for the follow-up worker.");
  process.exit(1);
}

async function run() {
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secret}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ checkOverdue: true, generateDrafts: true, sendNotifications: true }),
      signal: AbortSignal.timeout(120000),
    });
    const body = await response.text();
    if (!response.ok) throw new Error(`${response.status} ${body}`);
    console.log(new Date().toISOString(), "Follow-up worker:", body);
  } catch (error) {
    console.error(new Date().toISOString(), "Follow-up worker run failed:", error);
  }
}

await new Promise((resolve) => setTimeout(resolve, 15000));
while (true) {
  await run();
  await new Promise((resolve) => setTimeout(resolve, intervalMs));
}
