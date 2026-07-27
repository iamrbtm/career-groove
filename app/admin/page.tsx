"use client";
import { useEffect, useState } from "react";

export default function AdminDashboard() {
  const [stats, setStats] = useState<{ totalUsers: number; proUsers: number; freeUsers: number; pastDueUsers: number; estimatedMRR: number; monthlyPrice: number } | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    fetch("/api/admin/stats")
      .then(r => r.ok ? r.json() : Promise.reject("Failed to load"))
      .then(setStats)
      .catch(e => setError(String(e)));
  }, []);
  return (
    <div>
      <h1 className="font-[var(--font-display)] text-3xl font-black">Admin Dashboard</h1>
      <p className="mt-1 text-sm text-ink/55">Overview of CareerGroove</p>
      {error && <p className="mt-4 rounded-2xl bg-coral/10 px-4 py-3 text-sm font-bold">{error}</p>}
      {stats && (
        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          <StatCard label="Total Users" value={stats.totalUsers} />
          <StatCard label="Pro Users" value={stats.proUsers} />
          <StatCard label="Free Users" value={stats.freeUsers} />
          <StatCard label="Past Due" value={stats.pastDueUsers} />
          <StatCard label="Est. MRR" value={`$${stats.estimatedMRR}`} />
          <StatCard label="Monthly Price" value={`$${stats.monthlyPrice}`} />
        </div>
      )}
      {!stats && !error && <p className="mt-8 text-sm text-ink/40">Loading stats...</p>}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-3xl border-2 border-ink bg-white p-5 shadow-[4px_5px_0_#26312c]">
      <p className="text-xs font-black uppercase tracking-wider text-plum">{label}</p>
      <p className="mt-1 font-[var(--font-display)] text-3xl font-black">{value}</p>
    </div>
  );
}
