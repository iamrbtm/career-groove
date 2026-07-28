"use client";
import { useEffect, useState } from "react";

export default function AdminStripeConfig() {
  const [monthly, setMonthly] = useState("");
  const [yearly, setYearly] = useState("");
  const [lifetime, setLifetime] = useState("");
  const [publishableKey, setPublishableKey] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    fetch("/api/admin/settings")
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        const cfg = data?.settings?.stripe_config;
        if (cfg) {
          setMonthly(cfg.price_monthly || "");
          setYearly(cfg.price_yearly || "");
          setLifetime(cfg.price_lifetime || "");
          setPublishableKey(cfg.publishable_key || "");
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
          stripe_config: { price_monthly: monthly, price_yearly: yearly, price_lifetime: lifetime, publishable_key: publishableKey },
        }),
      });
      if (r.ok) setMessage("Saved successfully.");
      else setMessage("Failed to save.");
    } catch { setMessage("Failed to save."); }
    finally { setSaving(false); }
  }

  return (
    <div>
      <h1 className="font-[var(--font-display)] text-3xl font-black">Stripe Configuration</h1>
      <p className="mt-1 text-sm text-ink/55">Manage payment integration settings.</p>

      <section className="mt-8 rounded-3xl border-2 border-ink bg-mint/10 p-6">
        <h2 className="font-[var(--font-display)] text-xl font-black">Step-by-Step Stripe Setup</h2>
        <ol className="mt-4 space-y-3 text-sm">
          <li><strong>1.</strong> Go to <a href="https://dashboard.stripe.com" target="_blank" className="font-bold underline">Stripe Dashboard</a> → <strong>Products</strong> → <strong>Add Product</strong></li>
          <li><strong>2.</strong> Create <strong>Pro Monthly</strong> ($15/mo recurring), <strong>Pro Yearly</strong> ($99/yr recurring), <strong>Lifetime</strong> ($199 one-time)</li>
          <li><strong>3.</strong> Copy each <strong>Price ID</strong> (starts with <code>price_</code>) and paste below</li>
          <li><strong>4.</strong> Go to <strong>Developers</strong> → <strong>Webhooks</strong> → <strong>Add endpoint</strong>: <code>https://yourdomain.com/api/webhooks/stripe</code></li>
          <li><strong>5.</strong> Select events: <code>checkout.session.completed</code>, <code>customer.subscription.updated</code>, <code>customer.subscription.deleted</code></li>
          <li><strong>6.</strong> Copy the <strong>Signing secret</strong> (<code>whsec_...</code>) and add to <code>.env</code> as <code>STRIPE_WEBHOOK_SECRET</code></li>
          <li><strong>7.</strong> Add <code>STRIPE_SECRET_KEY</code> (sk_live_...) and <code>NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY</code> to <code>.env</code></li>
        </ol>
      </section>

      <div className="mt-8 max-w-lg space-y-5">
        <div>
          <label className="text-xs font-black uppercase tracking-wider text-plum">Monthly Price ID</label>
          <input value={monthly} onChange={e => setMonthly(e.target.value)} placeholder="price_live_..." className="mt-1.5 block w-full rounded-2xl border-2 border-ink bg-white px-4 py-3 font-mono text-sm" />
        </div>
        <div>
          <label className="text-xs font-black uppercase tracking-wider text-plum">Yearly Price ID</label>
          <input value={yearly} onChange={e => setYearly(e.target.value)} placeholder="price_live_..." className="mt-1.5 block w-full rounded-2xl border-2 border-ink bg-white px-4 py-3 font-mono text-sm" />
        </div>
        <div>
          <label className="text-xs font-black uppercase tracking-wider text-plum">Lifetime Price ID</label>
          <input value={lifetime} onChange={e => setLifetime(e.target.value)} placeholder="price_live_..." className="mt-1.5 block w-full rounded-2xl border-2 border-ink bg-white px-4 py-3 font-mono text-sm" />
        </div>
        <div>
          <label className="text-xs font-black uppercase tracking-wider text-plum">Publishable Key</label>
          <input value={publishableKey} onChange={e => setPublishableKey(e.target.value)} placeholder="pk_live_..." className="mt-1.5 block w-full rounded-2xl border-2 border-ink bg-white px-4 py-3 font-mono text-sm" />
        </div>
        {message && <p className={`text-sm font-bold ${message.includes("Saved") ? "text-green-700" : "text-coral"}`}>{message}</p>}
        <button disabled={saving} onClick={save} className="rounded-2xl border-2 border-ink bg-ink px-6 py-3 font-black text-cream transition active:translate-y-1 disabled:opacity-60">
          {saving ? "Saving..." : "Save Stripe Config"}
        </button>
      </div>
    </div>
  );
}
