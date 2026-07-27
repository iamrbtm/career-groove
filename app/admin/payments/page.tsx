"use client";
import { useEffect, useState } from "react";

export default function AdminPayments() {
  const [stats, setStats] = useState<{ totalUsers: number; proUsers: number; freeUsers: number; pastDueUsers: number; estimatedMRR: number; monthlyPrice: number } | null>(null);

  useEffect(() => {
    fetch("/api/admin/stats")
      .then(r => r.ok ? r.json() : null)
      .then(setStats)
      .catch(() => {});
  }, []);

  const [pastDueUsers, setPastDueUsers] = useState<Array<{ email: string; name: string | null }>>([]);
  useEffect(() => {
    fetch("/api/admin/users?search=")
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.users) setPastDueUsers(data.users.filter((u: any) => u.subscriptionStatus === "past_due"));
      })
      .catch(() => {});
  }, []);

  return (
    <div>
      <h1 className="font-[var(--font-display)] text-3xl font-black">Payments Dashboard</h1>
      <p className="mt-1 text-sm text-ink/55">Financial overview for CareerGroove.</p>

      {stats && (
        <div className="mt-8 grid gap-5 sm:grid-cols-3">
          <StatCard label="Pro Subscribers" value={stats.proUsers} />
          <StatCard label="Est. MRR" value={`$${stats.estimatedMRR}`} />
          <StatCard label="Past Due" value={stats.pastDueUsers} />
        </div>
      )}

      <section className="mt-10">
        <h2 className="font-[var(--font-display)] text-xl font-black">Past Due / Failed Payments</h2>
        {pastDueUsers.length === 0 && <p className="mt-3 text-sm text-ink/40">No users with failed payments.</p>}
        {pastDueUsers.length > 0 && (
          <div className="mt-4 space-y-2">
            {pastDueUsers.map(u => (
              <div key={u.email} className="rounded-2xl border-2 border-coral bg-coral/5 px-5 py-3">
                <p className="font-bold">{u.email}</p>
                {u.name && <p className="text-sm text-ink/50">{u.name}</p>}
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="mt-10">
        <h2 className="font-[var(--font-display)] text-xl font-black">Export</h2>
        <p className="mt-2 text-sm text-ink/55">Download user data for your records.</p>
        <a
          href="/api/admin/users"
          download
          className="mt-4 inline-block rounded-2xl border-2 border-ink bg-white px-5 py-3 font-black transition active:translate-y-1"
        >
          Export Users CSV
        </a>
      </section>
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
