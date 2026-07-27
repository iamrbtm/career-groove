"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Bot, LoaderCircle, Search } from "lucide-react";
import { AI_TASKS } from "@/lib/ai-tasks";

type Provider = "openai" | "anthropic" | "google" | "ollama" | "nvidia";
type Connection = { provider: Provider; selectedModel: string; active: boolean; models: { id: string; name: string }[] };
type Mapping = { task: string; provider: Provider; model: string };

const providerNames: Record<Provider, string> = {
  openai: "OpenAI",
  anthropic: "Claude",
  google: "Gemini",
  ollama: "Ollama",
  nvidia: "NVIDIA",
};

function SearchableSelect({
  options,
  value,
  onChange,
  disabled,
  placeholder,
}: {
  options: { value: string; label: string }[];
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  placeholder: string;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  const selectedLabel = options.find((o) => o.value === value)?.label ?? "";

  const filtered = search
    ? options.filter((o) => o.label.toLowerCase().includes(search.toLowerCase()))
    : options;

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setSearch("");
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <div className="relative">
        <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink/35" />
        <input
          value={open ? search : selectedLabel || ""}
          onChange={(e) => setSearch(e.target.value)}
          onFocus={() => { if (!disabled) setOpen(true); }}
          placeholder={placeholder}
          disabled={disabled}
          className="w-full rounded-xl border-2 border-ink/15 bg-white py-2 pl-8 pr-3 text-sm font-bold outline-none focus:border-coral"
        />
      </div>
      {open && (
        <div className="absolute z-50 mt-1 w-full max-h-60 overflow-y-auto rounded-xl border-2 border-ink/15 bg-white shadow-lg">
          <div
            className={`cursor-pointer border-b border-ink/10 px-3 py-2 text-sm ${
              !value ? "bg-sun/20 font-black" : "hover:bg-cream"
            }`}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => { onChange(""); setOpen(false); setSearch(""); }}
          >
            {placeholder}
          </div>
          {!filtered.length && (
            <div className="px-3 py-4 text-center text-xs text-ink/40">No models match your search</div>
          )}
          {filtered.map((option) => (
            <div
              key={option.value}
              className={`cursor-pointer px-3 py-2 text-sm ${
                value === option.value ? "bg-sun/20 font-black" : "hover:bg-cream"
              }`}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => { onChange(option.value); setOpen(false); setSearch(""); }}
            >
              {option.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function TaskModelAssigner({ refreshKey = 0, onChanged }: { refreshKey?: number; onChanged?: () => void }) {
  const [connections, setConnections] = useState<Connection[]>([]);
  const [mappings, setMappings] = useState<Map<string, Mapping>>(new Map());
  const [saving, setSaving] = useState<string | null>(null);
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    const [providersRes, mappingsRes] = await Promise.all([
      fetch("/api/providers", { cache: "no-store" }),
      fetch("/api/task-models", { cache: "no-store" }),
    ]);
    if (providersRes.ok) {
      const body = await providersRes.json();
      setConnections((body.connections as Connection[]).filter((c) => c.active && c.models?.length));
    }
    if (mappingsRes.ok) {
      const body = await mappingsRes.json();
      setMappings(new Map((body.mappings as Mapping[]).map((m) => [m.task, m])));
    }
  }, []);

  useEffect(() => { void load(); }, [load, refreshKey]);

  async function assign(task: string, value: string) {
    setSaving(task);
    setNotice("");
    if (!value) {
      await fetch("/api/task-models", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "remove", task }),
      });
      setMappings((prev) => { const next = new Map(prev); next.delete(task); return next; });
    } else {
      const [provider, model] = value.split(":", 2) as [Provider, string];
      const response = await fetch("/api/task-models", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "set", task, provider, model }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        setNotice(body?.error || "Could not save the task assignment.");
        setSaving(null);
        return;
      }
      setMappings((prev) => { const next = new Map(prev); next.set(task, { task, provider, model }); return next; });
    }
    setSaving(null);
    onChanged?.();
  }

  const activeConnections = connections.filter((c) => c.active && c.models?.length);
  const modelOptions = activeConnections.flatMap((connection) =>
    connection.models.filter((m) => m.id).map((model) => ({
      value: `${connection.provider}:${model.id}`,
      label: `${providerNames[connection.provider]} — ${model.name || model.id}`,
    })),
  );

  return (
    <section className="lg:col-span-2 rounded-3xl border-2 border-ink bg-white p-6 shadow-[0_5px_0_#26312c]">
      <div className="flex items-start gap-3">
        <div className="grid size-11 place-items-center rounded-2xl bg-sun"><Bot /></div>
        <div>
          <h2 className="font-[var(--font-display)] text-xl font-black">AI task assignments</h2>
          <p className="mt-1 text-sm text-ink/55">Assign a specific provider and model to each AI task. The assigned model is tried first; if it fails, other active AIs are used as fallback.</p>
        </div>
      </div>
      {notice && <p role="status" className="mt-4 rounded-2xl bg-coral/15 px-4 py-3 text-sm font-bold">{notice}</p>}
      <div className="mt-6 space-y-3">
        {AI_TASKS.map((task) => {
          const mapping = mappings.get(task.id);
          const currentValue = mapping ? `${mapping.provider}:${mapping.model}` : "";
          const isSaving = saving === task.id;
          return (
            <div key={task.id} className={`rounded-2xl border-2 p-4 ${mapping ? "border-sun bg-sun/10" : "border-ink/10 bg-cream/30"}`}>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-black text-sm">{task.label}</span>
                    {mapping && <span className="rounded-full bg-sun px-2 py-0.5 text-[10px] font-black uppercase">Assigned</span>}
                  </div>
                  <p className="mt-0.5 text-xs text-ink/50">{task.description}</p>
                </div>
                <div className="w-full shrink-0 sm:mt-0 sm:w-64">
                  <SearchableSelect
                    options={modelOptions}
                    value={currentValue}
                    onChange={(v) => void assign(task.id, v)}
                    disabled={isSaving || !modelOptions.length}
                    placeholder="Default AI preference"
                  />
                  {isSaving && <p className="mt-1 flex items-center gap-1 text-[10px] font-bold text-plum"><LoaderCircle className="animate-spin" size={12} /> Saving…</p>}
                </div>
              </div>
            </div>
          );
        })}
      </div>
      {!modelOptions.length && (
        <p className="mt-4 text-center text-sm font-bold text-ink/40">Connect an AI provider and select a model first.</p>
      )}
    </section>
  );
}
