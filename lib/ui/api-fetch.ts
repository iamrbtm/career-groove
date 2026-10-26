export async function apiFetch(input: string, init?: RequestInit): Promise<Response> {
  const res = await fetch(input, init);
  if (res.ok) return res;
  const error = await res.json().catch(() => null);
  const err = new Error(error?.error || error?.message || `Request failed (${res.status})`);
  (err as { status?: number }).status = res.status;
  throw err;
}

export function getApiError(err: unknown): string {
  if (err instanceof Error && err.message) return err.message;
  if (typeof err === "string" && err) return err;
  return "Something went wrong.";
}
