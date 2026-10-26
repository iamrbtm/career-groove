const ALLOWED_STATUSES = ["saved","researching","ready_to_apply","applied","follow_up","interviewing","offer","rejected","withdrawn","archived"];

const ALLOWED_WORK_MODES = ["remote","hybrid","onsite","flexible","unknown"];

export function normalizeStatus(raw: string) {
  const value = raw.trim().toLowerCase().replace(/\s+/g, "_");
  return ALLOWED_STATUSES.includes(value) ? value : "saved";
}

export function normalizeCsvDate(raw: string) {
  const value = raw.trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T12:00:00Z` : value;
}

export function normalizeWorkMode(raw: string) {
  const value = raw.trim().toLowerCase().replace(/\s+/g, "_");
  return ALLOWED_WORK_MODES.includes(value) ? value : null;
}
