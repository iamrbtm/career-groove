import { spawn } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const repoRoot = path.resolve(new URL("../..", import.meta.url).pathname);
const backupRoot = process.env.CAREER_GROOVE_BACKUP_ROOT || path.join(repoRoot, "backups");
const statePath = process.env.CAREER_GROOVE_BACKUP_STATE || path.join(backupRoot, ".scheduler-state.json");
const checkEveryMs = Number(process.env.CAREER_GROOVE_BACKUP_CHECK_MS || 60_000);
const maintenanceScript = path.join(repoRoot, "scripts/backup/maintenance.mjs");

let state = await readState();
let running = false;

console.log("CareerGroove backup scheduler started.");
console.log(`Backup root: ${backupRoot}`);
console.log("Source backup: Wednesday 00:00 local time.");
console.log("Database backup: every hour at minute 30 local time.");

await tick();
setInterval(() => void tick(), checkEveryMs);

async function tick() {
  if (running) return;
  running = true;
  try {
    const now = new Date();
    const jobs = [];

    const databaseKey = hourlyKey(now);
    if (now.getMinutes() >= 30 && state.databaseLastPeriod !== databaseKey) {
      jobs.push(["database", databaseKey, path.join(repoRoot, "scripts/backup/database-hourly.sh")]);
    }

    const sourceKey = weeklyKey(now);
    if (now.getDay() === 3 && now.getHours() === 0 && state.sourceLastPeriod !== sourceKey) {
      jobs.push(["source", sourceKey, path.join(repoRoot, "scripts/backup/source-weekly.sh")]);
    }

    for (const [kind, key, script] of jobs) {
      await runBackup(kind, key, script);
    }

    await runMaintenance();
  } catch (error) {
    console.error("Backup scheduler tick failed.", error);
  } finally {
    running = false;
  }
}

async function runBackup(kind, key, script) {
  console.log(`Starting ${kind} backup for period ${key}.`);
  await run(script);

  if (kind === "database") state.databaseLastPeriod = key;
  if (kind === "source") state.sourceLastPeriod = key;

  await mkdir(path.dirname(statePath), { recursive: true });
  await writeFile(statePath, `${JSON.stringify(state, null, 2)}\n`);
  console.log(`Finished ${kind} backup for period ${key}.`);
}

async function runMaintenance() {
  try {
    await run("node", [maintenanceScript]);
  } catch (error) {
    console.error("Backup maintenance failed.", error);
  }
}

function run(command, args = []) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: repoRoot,
      env: process.env,
      stdio: "inherit",
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} exited with ${code}`));
    });
  });
}

async function readState() {
  try {
    return JSON.parse(await readFile(statePath, "utf8"));
  } catch {
    return {};
  }
}

function hourlyKey(date) {
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
    pad(date.getHours()),
  ].join("-");
}

function weeklyKey(date) {
  return `${date.getFullYear()}-${isoWeek(date)}`;
}

function isoWeek(date) {
  const copy = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNumber = copy.getUTCDay() || 7;
  copy.setUTCDate(copy.getUTCDate() + 4 - dayNumber);
  const yearStart = new Date(Date.UTC(copy.getUTCFullYear(), 0, 1));
  return pad(Math.ceil(((copy - yearStart) / 86400000 + 1) / 7));
}

function pad(value) {
  return String(value).padStart(2, "0");
}
