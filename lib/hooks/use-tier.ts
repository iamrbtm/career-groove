"use client";
import { useEffect, useState } from "react";

export type Tier = "free" | "pro";

type CacheEntry = { tier: Tier; at: number };

const TTL_MS = 30_000;

let cache: CacheEntry | null = null;
let inflight: Promise<Tier | null> | null = null;

function loadTier(): Promise<Tier | null> {
  if (cache && Date.now() - cache.at < TTL_MS) return Promise.resolve(cache.tier);
  if (!inflight) {
    inflight = fetch("/api/user/tier", { cache: "no-store" })
      .then(r => (r.ok ? r.json() : null))
      .then((d: { tier?: string } | null) => {
        const tier: Tier | null = d?.tier === "pro" ? "pro" : d?.tier === "free" ? "free" : null;
        if (tier) cache = { tier, at: Date.now() };
        return tier;
      })
      .catch(() => null)
      .finally(() => { inflight = null; });
  }
  return inflight;
}

export function useTier(): { tier: Tier | null; loading: boolean } {
  const [tier, setTier] = useState<Tier | null>(cache ? cache.tier : null);
  const [loading, setLoading] = useState(!cache);
  useEffect(() => {
    if (cache) {
      setTier(cache.tier);
      setLoading(false);
      return;
    }
    let alive = true;
    loadTier().then(t => {
      if (!alive) return;
      if (t) setTier(t);
      setLoading(false);
    });
    return () => { alive = false; };
  }, []);
  return { tier, loading };
}
