"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { CheckCircle2, KeyRound, LoaderCircle, RefreshCw, Unplug } from "lucide-react";

type Provider = "openai" | "anthropic" | "google" | "ollama";
type Model = { id: string; name: string };
type Connection = {
  provider: Provider;
  keyHint: string;
  selectedModel: string;
  models: Model[];
  active: boolean;
  lastCheckedAt?: string;
  lastError?: string;
};
type BusyState = { provider: Provider; action: "connect" | "refresh" | "select" | "disconnect" } | null;

const providers: { id: Provider; name: string; copy: string; key: boolean }[] = [
  { id: "openai", name: "OpenAI", copy: "GPT and compatible models available to your account.", key: true },
  { id: "anthropic", name: "Claude", copy: "Claude models enabled for your Anthropic workspace.", key: true },
  { id: "google", name: "Gemini", copy: "Gemini models supporting generateContent.", key: true },
  { id: "ollama", name: "Ollama", copy: "Models installed on your configured Ollama server.", key: false },
];

export function ProviderConnections({ onConnectionsChanged }: { onConnectionsChanged?: () => void }) {
  const [connections, setConnections] = useState<Connection[]>([]);
  const [busy, setBusy] = useState<BusyState>(null);
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    const response = await fetch("/api/providers", { cache: "no-store" });
    if (!response.ok) return;
    const loaded = ((await response.json()).connections || []) as Connection[];
    setConnections(loaded);
    const stale = loaded.find((connection) => connection.lastError?.includes("no longer be decrypted"));
    if (stale) {
      setNotice(`${providers.find((provider) => provider.id === stale.provider)?.name}: ${stale.lastError}`);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function connect(event: FormEvent<HTMLFormElement>, provider: Provider) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setBusy({ provider, action: "connect" });
    setNotice("");
    try {
      const response = await fetch("/api/providers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "connect", provider, apiKey: data.get("apiKey") || undefined }),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) throw new Error(body?.error || "Connection failed.");
      form.reset();
      setNotice(`${providers.find((item) => item.id === provider)?.name} connected. ${body.connection.models.length} models found.`);
      await load();
      onConnectionsChanged?.();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Connection failed.");
    } finally {
      setBusy(null);
    }
  }

  async function refresh(provider: Provider) {
    setBusy({ provider, action: "refresh" });
    setNotice("");
    try {
      const response = await fetch("/api/providers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "refresh", provider }),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) throw new Error(body?.error || "Refresh failed.");
      setNotice(`Model list refreshed. ${body.connection.models.length} models available.`);
      await load();
      onConnectionsChanged?.();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Refresh failed.");
    } finally {
      setBusy(null);
    }
  }

  async function select(provider: Provider, model: string) {
    setBusy({ provider, action: "select" });
    setNotice("");
    try {
      const response = await fetch("/api/providers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "select", provider, model }),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) throw new Error(body?.error || "That model could not be selected.");
      setNotice("Default model updated.");
      await load();
      onConnectionsChanged?.();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "That model could not be selected.");
      await load();
    } finally {
      setBusy(null);
    }
  }

  async function disconnect(provider: Provider) {
    setBusy({ provider, action: "disconnect" });
    setNotice("");
    try {
      const response = await fetch(`/api/providers?provider=${provider}`, { method: "DELETE" });
      if (!response.ok) throw new Error("Disconnect failed.");
      await load();
      onConnectionsChanged?.();
      setNotice(`${providers.find((item) => item.id === provider)?.name} disconnected.`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Disconnect failed.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="lg:col-span-2 rounded-3xl border-2 border-ink bg-white p-6 shadow-[0_5px_0_#26312c]">
      <div className="flex items-start gap-3">
        <div className="grid size-11 place-items-center rounded-2xl bg-coral"><KeyRound /></div>
        <div>
          <h2 className="font-[var(--font-display)] text-xl font-black">AI provider connections</h2>
          <p className="mt-1 text-sm text-ink/55">Keys are encrypted before storage. Connecting verifies the key and asks the provider for models currently available to it.</p>
        </div>
      </div>
      {notice && <p role="status" className="mt-4 rounded-2xl bg-mint/25 px-4 py-3 text-sm font-bold">{notice}</p>}
      <div className="mt-6 grid gap-4 md:grid-cols-2">
        {providers.map((provider) => {
          const connection = connections.find((item) => item.provider === provider.id && item.active);
          const isBusy = busy?.provider === provider.id;
          const isDiscovering = isBusy && (busy.action === "connect" || busy.action === "refresh");
          return (
            <article key={provider.id} className={`rounded-3xl border-2 p-5 ${connection ? "border-mint bg-mint/10" : "border-ink/15 bg-cream/35"}`}>
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-black">{provider.name}</h3>
                    {connection && <span className="flex items-center gap-1 rounded-full bg-mint px-2 py-1 text-[10px] font-black uppercase"><CheckCircle2 size={12} />Active</span>}
                  </div>
                  <p className="mt-1 text-xs leading-5 text-ink/50">{provider.copy}</p>
                </div>
                {connection && (
                  <button onClick={() => void disconnect(provider.id)} disabled={isBusy} title="Disconnect" aria-label={`Disconnect ${provider.name}`}>
                    {isBusy && busy.action === "disconnect" ? <LoaderCircle size={17} className="animate-spin text-ink/35" /> : <Unplug size={17} className="text-ink/35 hover:text-coral" />}
                  </button>
                )}
              </div>
              {connection ? (
                <div className="mt-4">
                  <div className="flex items-end gap-2">
                    <label className="min-w-0 flex-1 text-[10px] font-black uppercase tracking-wider text-plum">
                      Model
                      <select value={connection.selectedModel} onChange={(event) => void select(provider.id, event.target.value)} disabled={isBusy} className="mt-1 w-full rounded-xl border-2 border-ink/15 bg-white px-3 py-2.5 text-sm font-bold normal-case">
                        <option value="" disabled>Select a model</option>
                        {connection.models.map((model) => <option key={model.id} value={model.id}>{model.name}</option>)}
                      </select>
                    </label>
                    <button onClick={() => void refresh(provider.id)} disabled={isBusy} className="grid size-10 place-items-center rounded-xl border-2 border-ink/15 bg-white" title="Refresh models" aria-label={`Refresh ${provider.name} models`}>
                      {isDiscovering ? <LoaderCircle className="animate-spin" size={16} /> : <RefreshCw size={16} />}
                    </button>
                  </div>
                  <p className="mt-2 text-xs text-ink/40">{connection.keyHint} · {connection.models.length} models discovered</p>
                </div>
              ) : (
                <form onSubmit={(event) => void connect(event, provider.id)} className="mt-4">
                  {provider.key && <input name="apiKey" type="password" required autoComplete="off" placeholder={`${provider.name} API key`} className="w-full rounded-xl border-2 border-ink/15 bg-white px-3 py-2.5 text-sm outline-none focus:border-coral" />}
                  <button disabled={isBusy} className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl border-2 border-ink bg-sun py-2.5 text-sm font-black shadow-[0_3px_0_#26312c]">
                    {isDiscovering ? <LoaderCircle className="animate-spin" size={16} /> : <KeyRound size={16} />}
                    {isDiscovering ? "Connecting & discovering…" : "Connect & discover models"}
                  </button>
                </form>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}
