import { auth } from "@/auth";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import { AdminSidebar } from "@/components/admin-sidebar";
import { ClaimAdmin } from "@/components/claim-admin";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user?.id) { redirect("/signin?callbackUrl=/admin"); return; }
  const isAdmin = (await db.query("SELECT 1 FROM admins WHERE user_id = $1", [session.user.id])).rowCount! > 0;
  const hasAdmin = (await db.query("SELECT 1 FROM admins LIMIT 1")).rowCount! > 0;
  if (!hasAdmin) return <AdminClaimFlow />;
  if (!isAdmin) redirect("/dashboard");
  return <AdminSidebar>{children}</AdminSidebar>;
}

function AdminClaimFlow() {
  return (
    <div className="flex min-h-dvh items-center justify-center px-5">
      <div className="max-w-md text-center">
        <h1 className="font-[var(--font-display)] text-3xl font-black">Welcome to Admin</h1>
        <p className="mt-3 text-sm text-ink/60">No admin has been claimed yet. If you are the owner, claim admin access now.</p>
        <ClaimAdmin />
      </div>
    </div>
  );
}
