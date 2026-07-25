import { serve } from "@hono/node-server";

import { createApp } from "./app.js";
import { loadConfig } from "./config.js";
import { createDatabase } from "./db.js";

const config = loadConfig();
const database = createDatabase(config.databaseUrl);
const app = createApp({ config, database });
const server = serve({ fetch: app.fetch, port: config.port });

console.log(
  JSON.stringify({
    event: "server_started",
    port: config.port,
    service: "career-groove-api",
  }),
);

let shuttingDown = false;
async function shutdown(signal: string) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(JSON.stringify({ event: "server_stopping", signal }));
  server.close();
  await database.end();
  process.exitCode = 0;
}

process.once("SIGINT", () => void shutdown("SIGINT"));
process.once("SIGTERM", () => void shutdown("SIGTERM"));
