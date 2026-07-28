"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export function ClaimAdmin() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  async function claim() {
    setLoading(true); setError("");
    try {
      const r = await fetch("/api/admin/claim", { method: "POST" });
      if (r.ok) router.refresh();
      else setError((await r.json()).error || "Something went wrong.");
    } catch { setError("Something went wrong."); }
    finally { setLoading(false); }
  }

  return (
    <div className="mt-6">
      {error && <p className="mb-4 rounded-2xl bg-coral/10 px-4 py-3 text-sm font-bold text-coral">{error}</p>}
      <button disabled={loading} onClick={claim} className="rounded-2xl border-2 border-ink bg-ink px-8 py-4 font-black text-cream transition active:translate-y-1 disabled:opacity-60">
        {loading ? "Claiming..." : "Claim Admin Access"}
      </button>
    </div>
  );
}
