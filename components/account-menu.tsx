"use client";

import { CreditCard, LogOut, UserRound } from "lucide-react";
import { signOut } from "next-auth/react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

interface AccountMenuProps { mobile?: boolean }

export function AccountMenu({ mobile = false }: AccountMenuProps) {
  const [open, setOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  async function handleSignOut() {
    setSigningOut(true);
    await signOut({ redirect: false });
    window.location.assign(window.location.origin);
  }

  useEffect(() => {
    function close(event: PointerEvent) {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, []);

  return <div ref={root} className={`relative ${mobile ? "md:hidden" : "hidden md:block"}`}>
    {open && <div className={`absolute z-50 w-52 overflow-hidden rounded-2xl border-2 border-ink bg-white p-2 text-ink shadow-[6px_7px_0_#26312c] ${mobile ? "bottom-[calc(100%+14px)] right-0" : "bottom-0 left-[calc(100%+18px)]"}`} role="menu">
      <p className="px-3 pb-2 pt-1 text-[10px] font-black uppercase tracking-[.18em] text-plum">Your account</p>
      <Link onClick={() => setOpen(false)} href="/profile" role="menuitem" className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-bold hover:bg-fog"><UserRound size={17}/>Profile</Link>
      <Link onClick={() => setOpen(false)} href="/billing" role="menuitem" className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-bold hover:bg-fog"><CreditCard size={17}/>Billing</Link>
      <div className="my-1 border-t border-ink/10"/>
      <button onClick={handleSignOut} disabled={signingOut} role="menuitem" className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-bold text-coral hover:bg-coral/10 disabled:cursor-wait disabled:opacity-60"><LogOut size={17}/>{signingOut ? "Signing out..." : "Sign out"}</button>
    </div>}
    <button onClick={() => setOpen(!open)} aria-label="Open account menu" aria-expanded={open} className={mobile ? "flex min-w-14 flex-col items-center gap-1 rounded-2xl px-2 py-2 text-[10px] font-bold text-cream/60" : "grid size-11 place-items-center rounded-full border border-cream/30 text-cream transition hover:border-cream hover:bg-cream hover:text-ink"}><UserRound size={mobile ? 18 : 20}/>{mobile && "Account"}</button>
  </div>;
}
