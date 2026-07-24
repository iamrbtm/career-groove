import { spawn } from "node:child_process";
import {
  mkdir,
  readdir,
  rename,
  rm,
  stat,
} from "node:fs/promises";
import path from "node:path";

const repoRoot = path.resolve(new URL("../..", import.meta.url).pathname);
const backupRoot = process.env.CAREER_GROOVE_BACKUP_ROOT || path.join(repoRoot, "backups");
const databaseRoot = path.join(backupRoot, "database");
const archiveRoot = path.join(backupRoot, "archive");
const retentionMonths = readPositiveInteger(process.env.CAREER_GROOVE_DATABASE_BACKUP_RETENTION_MONTHS, 6);
const now = process.env.CAREER_GROOVE_BACKUP_MAINTENANCE_NOW
  ? new Date(process.env.CAREER_GROOVE_BACKUP_MAINTENANCE_NOW)
  : new Date();

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

try {
  await archiveCompletedDays();
  await archiveCompletedWeeks();
  await pruneDatabaseBackups();
} catch (error) {
  console.error("Backup maintenance failed unexpectedly.", error);
  process.exitCode = 1;
}

async function archiveCompletedDays() {
  const weeks = await listWeekDirs();
  for (const week of weeks) {
    const entries = await safeReaddir(week.path, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory() || !isDayFolder(entry.name)) continue;

      const dayDate = findDateForDayFolder(week.year, week.week, entry.name);
      if (!dayDate || !isDayReadyForArchive(dayDate, now)) continue;

      const source = path.join(week.path, entry.name);
      const target = path.join(week.path, `${entry.name}_database_backup.tar.gz`);
      const label = `daily database archive ${week.name}/${entry.name}`;

      await withTwoAttempts(label, async () => {
        await createTarGz(source, target);
        await rm(source, { recursive: true, force: false });
        console.log(`Archived ${source} to ${target}`);
      });
    }
  }
}

async function archiveCompletedWeeks() {
  const weeks = await listWeekDirs();
  for (const week of weeks) {
    const weekEnd = findWeekEndDate(week.year, week.week);
    if (!weekEnd || !isDayReadyForArchive(weekEnd, now)) continue;

    const entries = await safeReaddir(week.path, { withFileTypes: true });
    const hasUnarchivedDayFolders = entries.some((entry) => entry.isDirectory() && isDayFolder(entry.name));
    const hasDailyArchives = entries.some((entry) => entry.isFile() && isDailyArchive(entry.name));
    if (hasUnarchivedDayFolders || !hasDailyArchives) continue;

    const target = path.join(archiveRoot, `${week.year}_Wk${week.week}_database.tar.gz`);
    const label = `weekly database archive ${week.name}`;

    await withTwoAttempts(label, async () => {
      await createTarGz(week.path, target);
      await rm(week.path, { recursive: true, force: false });
      console.log(`Archived ${week.path} to ${target}`);
    });
  }

  await removeEmptyYearDirs();
}

async function pruneDatabaseBackups() {
  if (retentionMonths <= 0) return;

  const cutoff = startOfDay(subtractCalendarMonths(now, retentionMonths));

  for (const week of await listWeekDirs()) {
    const entries = await safeReaddir(week.path, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory() && isDayFolder(entry.name)) {
        const dayDate = findDateForDayFolder(week.year, week.week, entry.name);
        if (dayDate && dayDate < cutoff) {
          await deleteOldPath(path.join(week.path, entry.name), `expired database backup day ${week.name}/${entry.name}`);
        }
      }

      if (entry.isFile() && isDailyArchive(entry.name)) {
        const dayName = entry.name.replace(/_database_backup\.tar\.gz$/, "");
        const dayDate = findDateForDayFolder(week.year, week.week, dayName);
        if (dayDate && dayDate < cutoff) {
          await deleteOldPath(path.join(week.path, entry.name), `expired database backup day archive ${week.name}/${entry.name}`);
        }
      }
    }
  }

  for (const entry of await safeReaddir(archiveRoot, { withFileTypes: true })) {
    if (!entry.isFile()) continue;

    const match = entry.name.match(/^(\d{4})_Wk(\d{2})_database\.tar\.gz$/);
    if (!match) continue;

    const weekEnd = findWeekEndDate(Number(match[1]), match[2]);
    if (weekEnd && weekEnd < cutoff) {
      await deleteOldPath(path.join(archiveRoot, entry.name), `expired weekly database archive ${entry.name}`);
    }
  }

  await removeEmptyWeekDirs();
  await removeEmptyYearDirs();
}

async function withTwoAttempts(label, operation) {
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      await operation();
      return;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`${label} failed on attempt ${attempt}: ${message}`);
      if (attempt === 1) {
        console.error(`Retrying ${label}.`);
      } else {
        console.error(`Leaving ${label} files in place after two failed attempts.`);
      }
    }
  }
}

async function createTarGz(source, target) {
  if (await isNonEmptyFile(target)) return;

  await mkdir(path.dirname(target), { recursive: true });
  const temp = path.join(path.dirname(target), `.${path.basename(target)}.${process.pid}.${Date.now()}.tmp`);

  try {
    await run("tar", ["-czf", temp, "-C", source, "."]);
    await rename(temp, target);
  } catch (error) {
    await rm(temp, { force: true });
    throw error;
  }
}

async function deleteOldPath(target, label) {
  await withTwoAttempts(label, async () => {
    await rm(target, { recursive: true, force: false });
    console.log(`Deleted ${target}`);
  });
}

async function listWeekDirs() {
  const weeks = [];
  const years = await safeReaddir(databaseRoot, { withFileTypes: true });
  for (const yearEntry of years) {
    if (!yearEntry.isDirectory() || !/^\d{4}$/.test(yearEntry.name)) continue;

    const yearPath = path.join(databaseRoot, yearEntry.name);
    const weekEntries = await safeReaddir(yearPath, { withFileTypes: true });
    for (const weekEntry of weekEntries) {
      const match = weekEntry.name.match(/^WK(\d{2})$/);
      if (!weekEntry.isDirectory() || !match) continue;

      weeks.push({
        year: Number(yearEntry.name),
        week: match[1],
        name: weekEntry.name,
        path: path.join(yearPath, weekEntry.name),
      });
    }
  }

  return weeks.sort((a, b) => a.path.localeCompare(b.path));
}

async function removeEmptyWeekDirs() {
  for (const week of await listWeekDirs()) {
    const entries = await safeReaddir(week.path, { withFileTypes: true });
    if (entries.length === 0) {
      await rm(week.path, { recursive: true, force: true });
    }
  }
}

async function removeEmptyYearDirs() {
  const years = await safeReaddir(databaseRoot, { withFileTypes: true });
  for (const yearEntry of years) {
    if (!yearEntry.isDirectory() || !/^\d{4}$/.test(yearEntry.name)) continue;

    const yearPath = path.join(databaseRoot, yearEntry.name);
    const entries = await safeReaddir(yearPath, { withFileTypes: true });
    if (entries.length === 0) {
      await rm(yearPath, { recursive: true, force: true });
    }
  }
}

function isDayFolder(name) {
  return /^[A-Za-z]{3}\d{2}$/.test(name);
}

function isDailyArchive(name) {
  return /^[A-Za-z]{3}\d{2}_database_backup\.tar\.gz$/.test(name);
}

function findDateForDayFolder(year, week, dayFolder) {
  const match = dayFolder.match(/^([A-Za-z]{3})(\d{2})$/);
  if (!match) return null;

  const dayName = titleCaseDay(match[1]);
  const dayOfMonth = Number(match[2]);
  const date = new Date(year, 0, 1, 12);

  while (date.getFullYear() === year) {
    if (
      isoWeek(date) === week &&
      DAY_NAMES[date.getDay()] === dayName &&
      date.getDate() === dayOfMonth
    ) {
      return startOfDay(date);
    }
    date.setDate(date.getDate() + 1);
  }

  return null;
}

function findWeekEndDate(year, week) {
  let latest = null;
  const date = new Date(year, 0, 1, 12);

  while (date.getFullYear() === year) {
    if (isoWeek(date) === week) {
      latest = new Date(date);
    }
    date.setDate(date.getDate() + 1);
  }

  return latest ? startOfDay(latest) : null;
}

function isDayReadyForArchive(day, current) {
  const today = startOfDay(current);
  if (day < today) return true;
  return day.getTime() === today.getTime() && (current.getHours() > 23 || (current.getHours() === 23 && current.getMinutes() >= 30));
}

function subtractCalendarMonths(date, months) {
  const target = new Date(date);
  const originalDay = target.getDate();

  target.setDate(1);
  target.setMonth(target.getMonth() - months);
  target.setDate(Math.min(originalDay, daysInMonth(target.getFullYear(), target.getMonth())));

  return target;
}

function daysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate();
}

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function isoWeek(date) {
  const copy = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNumber = copy.getUTCDay() || 7;
  copy.setUTCDate(copy.getUTCDate() + 4 - dayNumber);
  const yearStart = new Date(Date.UTC(copy.getUTCFullYear(), 0, 1));
  return pad(Math.ceil(((copy - yearStart) / 86400000 + 1) / 7));
}

function titleCaseDay(value) {
  return `${value.slice(0, 1).toUpperCase()}${value.slice(1).toLowerCase()}`;
}

function readPositiveInteger(value, fallback) {
  if (value === undefined || value === "") return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function pad(value) {
  return String(value).padStart(2, "0");
}

async function isNonEmptyFile(target) {
  try {
    const info = await stat(target);
    if (info.isFile() && info.size > 0) return true;
    throw new Error(`${target} exists but is not a non-empty file`);
  } catch (error) {
    if (error && error.code === "ENOENT") return false;
    throw error;
  }
}

async function safeReaddir(target, options) {
  try {
    return await readdir(target, options);
  } catch (error) {
    if (error && error.code === "ENOENT") return [];
    throw error;
  }
}

function run(command, args) {
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
