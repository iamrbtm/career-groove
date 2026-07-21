"use client";

import { useCallback, useEffect, useState } from "react";
import { Bot, LoaderCircle } from "lucide-react";

type Provider = "openai" | "anthropic" | "google" | "ollama";
type Connection = { provider: Provider; selectedModel: string; active: boolean };

const names: Record<Provider, string> = {
  openai: "OpenAI",
  anthropic: "Claude",
  google: "Gemini",
  ollama: "Ollama",
};

export function DefaultAISelector() {
  const [connections, setConnections] = useState<Connection[]>([]);
  const [selected, setSelected] = useState<Provider | "">("");
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    const response = await fetch("/api/providers");
    if (!response.ok) return;
    const body = await response.json();
    setConnections(
      (body.connections as Connection[]).filter(
        (connection) => connection.active && connection.selectedModel,
      ),
    );
    setSelected(body.defaultProvider || "");
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function choose(provider: Provider) {
    setSelected(provider);
    setSaving(true);
    setNotice("");
    const response = await fetch("/api/providers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "setDefault", provider }),
    });
    const body = await response.json().catch(() => null);
    setNotice(
      response.ok
        ? `${names[provider]} will be tried first. Other active AIs remain available as backups.`
        : body?.error || "The default AI could not be updated.",
    );
    if (!response.ok) await load();
    setSaving(false);
  }

  return (
    <section className="h-fit rounded-3xl border-2 border-ink bg-white p-6 shadow-[0_5px_0_#26312c]">
      <h2 className="flex items-center gap-2 font-[var(--font-display)] text-xl font-black">
        <Bot /> Default AI
      </h2>
      <p className="mt-2 text-sm leading-6 text-ink/55">
        This AI is tried first. If it fails, CareerGroove automatically tries
        every other active connection.
      </p>
      <label className="mt-4 block text-xs font-black uppercase tracking-wider text-plum">
        First AI to try
        <select
          value={selected}
          onChange={(event) => void choose(event.target.value as Provider)}
          disabled={saving || !connections.length}
          className="mt-1 w-full rounded-2xl border-2 border-ink/15 bg-white px-3 py-3 text-sm font-bold normal-case text-ink"
        >
          <option value="" disabled>
            {connections.length ? "Select a default AI" : "Connect an AI first"}
          </option>
          {connections.map((connection) => (
            <option key={connection.provider} value={connection.provider}>
              {names[connection.provider]} · {connection.selectedModel}
            </option>
          ))}
        </select>
      </label>
      {saving && (
        <p className="mt-3 flex items-center gap-2 text-xs font-bold text-plum">
          <LoaderCircle className="animate-spin" size={15} /> Saving default…
        </p>
      )}
      {notice && <p className="mt-3 text-xs font-bold text-ink/60">{notice}</p>}
    </section>
  );
}
