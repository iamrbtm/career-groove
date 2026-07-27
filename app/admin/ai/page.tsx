"use client";
import { useEffect, useState } from "react";

const PROVIDERS = ["openai", "anthropic", "google", "ollama"] as const;
type Provider = typeof PROVIDERS[number];

const MODEL_OPTIONS: Record<Provider, string[]> = {
  openai: ["gpt-4o", "gpt-4o-mini", "gpt-4-turbo", "gpt-4", "gpt-3.5-turbo"],
  anthropic: ["claude-sonnet-4-20250514", "claude-opus-4-20250514", "claude-sonnet-4-0", "claude-opus-4-0", "claude-3-5-sonnet-20241022", "claude-3-opus-20240307"],
  google: ["gemini-1.5-pro", "gemini-1.5-flash", "gemini-1.0-pro"],
  ollama: ["llama3", "mistral", "mixtral", "gemma2", "qwen2.5-coder"],
};

export default function AdminAIConfig() {
  const [provider, setProvider] = useState<Provider>("openai");
  const [model, setModel] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    fetch("/api/admin/settings")
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        const cfg = data?.settings?.premium_ai_config;
        if (cfg) {
          setProvider((cfg.provider as Provider) || "openai");
          setModel(cfg.model || "");
          setApiKey(cfg.api_key || "");
          setBaseUrl(cfg.base_url || "");
        }
      })
      .catch(() => {});
  }, []);

  async function save() {
    setSaving(true); setMessage("");
    try {
      const r = await fetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          premium_ai_config: { provider, model, api_key: apiKey, base_url: baseUrl || null },
        }),
      });
      if (r.ok) setMessage("Saved successfully.");
      else setMessage("Failed to save.");
    } catch { setMessage("Failed to save."); }
    finally { setSaving(false); }
  }

  return (
    <div>
      <h1 className="font-[var(--font-display)] text-3xl font-black">Premium AI Config</h1>
      <p className="mt-1 text-sm text-ink/55">Set the default AI model for Pro users when they haven't brought their own API key.</p>
      <div className="mt-8 max-w-lg space-y-5">
        <div>
          <label className="text-xs font-black uppercase tracking-wider text-plum">Provider</label>
          <select value={provider} onChange={e => setProvider(e.target.value as Provider)} className="mt-1.5 block w-full rounded-2xl border-2 border-ink bg-white px-4 py-3 font-bold">
            {PROVIDERS.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs font-black uppercase tracking-wider text-plum">Model</label>
          <select value={model} onChange={e => setModel(e.target.value)} className="mt-1.5 block w-full rounded-2xl border-2 border-ink bg-white px-4 py-3 font-bold">
            <option value="">Select a model</option>
            {MODEL_OPTIONS[provider].map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs font-black uppercase tracking-wider text-plum">API Key</label>
          <input value={apiKey} onChange={e => setApiKey(e.target.value)} type="password" placeholder="sk-..." className="mt-1.5 block w-full rounded-2xl border-2 border-ink bg-white px-4 py-3 font-bold placeholder:text-ink/30" />
        </div>
        <div>
          <label className="text-xs font-black uppercase tracking-wider text-plum">Base URL (optional)</label>
          <input value={baseUrl} onChange={e => setBaseUrl(e.target.value)} placeholder="https://api.openai.com/v1" className="mt-1.5 block w-full rounded-2xl border-2 border-ink bg-white px-4 py-3 font-bold placeholder:text-ink/30" />
        </div>
        {message && <p className={`text-sm font-bold ${message.includes("Saved") ? "text-green-700" : "text-coral"}`}>{message}</p>}
        <button disabled={saving} onClick={save} className="rounded-2xl border-2 border-ink bg-ink px-6 py-3 font-black text-cream transition active:translate-y-1 disabled:opacity-60">
          {saving ? "Saving..." : "Save Config"}
        </button>
      </div>
    </div>
  );
}
