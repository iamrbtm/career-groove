"use client";
import { useEffect, useState } from "react";

interface AdminUser {
  id: string;
  email: string;
  name: string | null;
  image: string | null;
  subscriptionStatus: string | null;
  created_at: string;
  application_count: string;
}

export default function AdminUsers() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  function load(q: string) {
    setLoading(true);
    fetch(`/api/admin/users?search=${encodeURIComponent(q)}`)
      .then(r => r.ok ? r.json() : [])
      .then(data => setUsers(data.users || []))
      .catch(() => setUsers([]))
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(""); }, []);

  function togglePro(userId: string, currentlyPro: boolean) {
    fetch("/api/admin/users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, pro: !currentlyPro }),
    }).then(() => load(search));
  }

  return (
    <div>
      <h1 className="font-[var(--font-display)] text-3xl font-black">User Management</h1>
      <div className="mt-4 flex gap-3">
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          onKeyDown={e => e.key === "Enter" && load(search)}
          placeholder="Search by email or name..."
          className="flex-1 rounded-2xl border-2 border-ink bg-white px-4 py-3 font-bold placeholder:text-ink/30"
        />
        <button onClick={() => load(search)} className="rounded-2xl border-2 border-ink bg-ink px-5 py-3 font-black text-cream">Search</button>
      </div>
      <div className="mt-6 overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b-2 border-ink/10 text-xs font-black uppercase tracking-wider text-plum">
              <th className="pb-3 pr-4">Email</th>
              <th className="pb-3 pr-4">Name</th>
              <th className="pb-3 pr-4">Status</th>
              <th className="pb-3 pr-4">Roles</th>
              <th className="pb-3 pr-4">Joined</th>
              <th className="pb-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={6} className="pt-4 text-ink/40">Loading...</td></tr>}
            {!loading && users.length === 0 && <tr><td colSpan={6} className="pt-4 text-ink/40">No users found.</td></tr>}
            {users.map(u => {
              const isPro = u.subscriptionStatus === "active" || u.subscriptionStatus === "trialing" || u.subscriptionStatus === "lifetime";
              return (
                <tr key={u.id} className="border-b border-ink/5">
                  <td className="py-3 pr-4 font-bold">{u.email}</td>
                  <td className="py-3 pr-4 text-ink/70">{u.name || "—"}</td>
                  <td className="py-3 pr-4"><span className={`rounded-full px-3 py-1 text-xs font-black ${isPro ? "bg-mint text-ink" : "bg-ink/5 text-ink/50"}`}>{isPro ? "Pro" : "Free"}</span></td>
                  <td className="py-3 pr-4">{u.application_count}</td>
                  <td className="py-3 pr-4 text-ink/50">{new Date(u.created_at).toLocaleDateString()}</td>
                  <td className="py-3">
                    <button onClick={() => togglePro(u.id, isPro)} className="rounded-xl border-2 border-ink px-3 py-1.5 text-xs font-black transition active:translate-y-0.5">
                      {isPro ? "Set Free" : "Set Pro"}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
