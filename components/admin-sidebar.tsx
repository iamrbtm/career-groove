"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, CreditCard, Home, Settings2, Users, ArrowLeftFromLine, Cpu } from "lucide-react";

const items = [
  { href: "/admin", name: "Dashboard", icon: Home },
  { href: "/admin/ai", name: "AI Config", icon: Cpu },
  { href: "/admin/stripe", name: "Stripe", icon: CreditCard },
  { href: "/admin/users", name: "Users", icon: Users },
  { href: "/admin/payments", name: "Payments", icon: BarChart3 },
];

export function AdminSidebar({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  return (
    <div className="flex min-h-dvh">
      <aside className="fixed inset-y-0 left-0 z-30 flex w-56 flex-col border-r-2 border-ink/10 bg-ink py-7 text-cream">
        <Link href="/admin" className="px-5 font-[var(--font-display)] text-xl font-black tracking-tight">CG Admin</Link>
        <nav className="mt-8 flex flex-1 flex-col gap-1 px-3">
          {items.map(({ href, name, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-bold transition ${
                path === href ? "bg-cream text-ink" : "text-cream/60 hover:text-cream"
              }`}
            >
              <Icon size={18} />{name}
            </Link>
          ))}
        </nav>
        <Link href="/dashboard" className="flex items-center gap-2 px-5 text-xs font-bold text-cream/40 hover:text-cream">
          <ArrowLeftFromLine size={14} /> Back to app
        </Link>
      </aside>
      <main className="ml-56 flex-1 px-8 py-8">{children}</main>
    </div>
  );
}
