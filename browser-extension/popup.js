const DEFAULT_APP_URL = "http://localhost:3000";
const extensionApi = globalThis.browser || globalThis.chrome;
const usesPromiseApi = typeof globalThis.browser !== "undefined";
const elements = {
  appUrl: document.querySelector("#app-url"),
  saveUrl: document.querySelector("#save-url"),
  status: document.querySelector("#status"),
  preview: document.querySelector("#preview"),
  insights: document.querySelector("#insights"),
  openApp: document.querySelector("#open-app"),
  refresh: document.querySelector("#refresh"),
  saveApplication: document.querySelector("#save-application"),
  title: document.querySelector("#title"),
  company: document.querySelector("#company"),
  location: document.querySelector("#location"),
  workMode: document.querySelector("#work-mode"),
  salaryMin: document.querySelector("#salary-min"),
  salaryMax: document.querySelector("#salary-max"),
  sourceUrl: document.querySelector("#source-url"),
  notes: document.querySelector("#notes"),
  description: document.querySelector("#description"),
};

let captured = null;
let parsedJob = null;

function toPromise(method, ...args) {
  if (usesPromiseApi) return method(...args);
  return new Promise((resolve, reject) => {
    try {
      method(...args, (result) => {
        const lastError = extensionApi.runtime.lastError;
        if (lastError) reject(new Error(lastError.message));
        else resolve(result);
      });
    } catch (error) {
      reject(error);
    }
  });
}

function storageArea(kind) {
  if (kind === "session") return extensionApi.storage.session || extensionApi.storage.local;
  return extensionApi.storage.sync || extensionApi.storage.local;
}

function setStatus(message, type = "") {
  elements.status.textContent = message;
  elements.status.className = `status ${type}`.trim();
}

function normalizeAppUrl(value) {
  const raw = String(value || DEFAULT_APP_URL).trim().replace(/\/+$/, "");
  try {
    return new URL(raw).origin;
  } catch {
    return DEFAULT_APP_URL;
  }
}

async function getAppUrl() {
  const area = storageArea("sync");
  const stored = await toPromise(area.get.bind(area), { appUrl: DEFAULT_APP_URL });
  return normalizeAppUrl(stored.appUrl);
}

async function saveAppUrl() {
  const appUrl = normalizeAppUrl(elements.appUrl.value);
  elements.appUrl.value = appUrl;
  const area = storageArea("sync");
  await toPromise(area.set.bind(area), { appUrl });
  setStatus("Connection saved. The next capture will use this URL.", "success");
}

function numberOrNull(value) {
  const clean = String(value || "").replace(/[^\d]/g, "");
  if (!clean) return null;
  const parsed = Number.parseInt(clean, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

async function getActiveTab() {
  const tabs = await toPromise(extensionApi.tabs.query.bind(extensionApi.tabs), { active: true, currentWindow: true });
  const [tab] = tabs || [];
  return tab;
}

async function sendCaptureMessage(tabId) {
  try {
    return await toPromise(extensionApi.tabs.sendMessage.bind(extensionApi.tabs), tabId, { type: "CAREER_GROOVE_CAPTURE_JOB" });
  } catch {
    await toPromise(extensionApi.scripting.executeScript.bind(extensionApi.scripting), { target: { tabId }, files: ["content-script.js"] });
    return toPromise(extensionApi.tabs.sendMessage.bind(extensionApi.tabs), tabId, { type: "CAREER_GROOVE_CAPTURE_JOB" });
  }
}

async function captureCurrentPage() {
  setStatus("Reading the page...");
  elements.saveApplication.disabled = true;
  const tab = await getActiveTab();
  if (!tab?.id || !/^https?:\/\//.test(tab.url || "")) {
    throw new Error("Open a public job post page before capturing.");
  }
  const response = await sendCaptureMessage(tab.id);
  if (!response?.ok || !response.capture?.description) {
    throw new Error(response?.error || "This page did not expose enough job text.");
  }
  captured = response.capture;
  const sessionArea = storageArea("session");
  const session = await toPromise(sessionArea.get.bind(sessionArea), "careerGrooveContextCapture");
  const contextCapture = session.careerGrooveContextCapture;
  if (contextCapture?.tabId === tab.id && contextCapture.selectionText?.trim().length > 40) {
    const selection = contextCapture.selectionText.trim();
    captured.description = captured.description.includes(selection)
      ? captured.description
      : `${selection}\n\n${captured.description}`.slice(0, 50000);
  }
  await toPromise(sessionArea.remove.bind(sessionArea), "careerGrooveContextCapture");
  await toPromise(sessionArea.set.bind(sessionArea), { careerGrooveLastCapture: captured });
  return captured;
}

async function parseCapture(capture) {
  const appUrl = await getAppUrl();
  setStatus("Parsing the posting...");
  const response = await fetch(`${appUrl}/api/applications/parse`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      text: capture.description,
      sourceUrl: capture.sourceUrl,
      fallbackTitle: capture.title,
      fallbackCompany: capture.company,
    }),
  });

  if (response.status === 401) {
    throw new Error("Sign in to CareerGroove, then run capture again.");
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "CareerGroove could not parse this posting.");
  parsedJob = data.parsed;
  return parsedJob;
}

function fillForm(capture, parsed) {
  elements.title.value = parsed.title || capture.title || "";
  elements.company.value = parsed.company || capture.company || "";
  elements.location.value = parsed.location || "";
  elements.workMode.value = parsed.workMode || "unknown";
  elements.salaryMin.value = parsed.salaryMin || "";
  elements.salaryMax.value = parsed.salaryMax || "";
  elements.sourceUrl.value = parsed.sourceUrl || capture.sourceUrl || "";
  elements.description.value = capture.description || "";
  elements.notes.value = [
    parsed.summary ? `Summary: ${parsed.summary}` : "",
    parsed.mustHaveSkills?.length ? `Must-have skills: ${parsed.mustHaveSkills.join(", ")}` : "",
    parsed.niceToHaveSkills?.length ? `Nice-to-have skills: ${parsed.niceToHaveSkills.join(", ")}` : "",
    parsed.requirements?.length ? `Requirements: ${parsed.requirements.join(" | ")}` : "",
    parsed.applicationInstructions?.length ? `Apply notes: ${parsed.applicationInstructions.join(" | ")}` : "",
    parsed.screeningQuestions?.length ? `Screening questions: ${parsed.screeningQuestions.join(" | ")}` : "",
    parsed.redFlags?.length ? `Watch-outs: ${parsed.redFlags.join(", ")}` : "",
  ].filter(Boolean).join("\n");

  elements.preview.classList.remove("hidden");
  elements.saveApplication.disabled = false;
  renderInsights(parsed);
}

function renderInsights(parsed) {
  const notes = [
    parsed.confidence ? `Parse confidence: ${parsed.confidence}. Review before saving.` : "",
    ...(parsed.missingDetails || []).slice(0, 4),
    ...(parsed.contactHints || []).slice(0, 2).map((hint) => `Networking clue: ${hint}`),
  ].filter(Boolean);

  elements.insights.innerHTML = "";
  if (!notes.length) {
    elements.insights.classList.add("hidden");
    return;
  }

  for (const note of notes) {
    const item = document.createElement("div");
    item.className = "insight";
    item.textContent = note;
    elements.insights.append(item);
  }
  elements.insights.classList.remove("hidden");
}

async function saveApplication() {
  const appUrl = await getAppUrl();
  const title = elements.title.value.trim();
  const company = elements.company.value.trim();
  const description = elements.description.value.trim();
  if (!title || !company || !description) {
    setStatus("Title, company, and posting text are required before saving.", "error");
    return;
  }

  setStatus("Saving to Tracker Studio...");
  elements.saveApplication.disabled = true;
  const payload = {
    title,
    company,
    location: elements.location.value.trim() || null,
    workMode: elements.workMode.value || "unknown",
    salaryMin: numberOrNull(elements.salaryMin.value),
    salaryMax: numberOrNull(elements.salaryMax.value),
    salaryCurrency: "USD",
    sourceUrl: elements.sourceUrl.value.trim(),
    source: captured?.source || "",
    description,
    notes: elements.notes.value.trim() || null,
    metadata: {
      browserExtension: {
        capturedAt: captured?.capturedAt || new Date().toISOString(),
        parserConfidence: parsedJob?.confidence || "unknown",
      },
      parsedJob: parsedJob || undefined,
    },
  };

  const response = await fetch(`${appUrl}/api/applications`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await response.json().catch(() => ({}));
  if (response.status === 401) {
    elements.saveApplication.disabled = false;
    throw new Error("Sign in to CareerGroove, then save again.");
  }
  if (!response.ok) {
    elements.saveApplication.disabled = false;
    throw new Error(data.error || "CareerGroove could not save this role.");
  }
  const sessionArea = storageArea("session");
  await toPromise(sessionArea.set.bind(sessionArea), { careerGrooveLastSavedApplicationId: data.application?.id || "" });
  setStatus("Saved. It is queued in Applications with Career DJ ready.", "success");
}

async function refresh() {
  try {
    const capture = await captureCurrentPage();
    const parsed = await parseCapture(capture);
    fillForm(capture, parsed);
    setStatus("Captured. Review the mix, then save when it feels right.", "success");
  } catch (error) {
    setStatus(error instanceof Error ? error.message : "Capture failed.", "error");
  }
}

async function openTracker() {
  const appUrl = await getAppUrl();
  await toPromise(extensionApi.tabs.create.bind(extensionApi.tabs), { url: `${appUrl}/applications` });
}

document.addEventListener("DOMContentLoaded", async () => {
  elements.appUrl.value = await getAppUrl();
  elements.saveUrl.addEventListener("click", () => void saveAppUrl());
  elements.refresh.addEventListener("click", () => void refresh());
  elements.openApp.addEventListener("click", () => void openTracker());
  elements.saveApplication.addEventListener("click", () => {
    saveApplication().catch((error) => setStatus(error instanceof Error ? error.message : "Save failed.", "error"));
  });
  await refresh();
});
