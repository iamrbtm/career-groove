import { auth } from "@/auth";
import { ProfilePanel } from "@/components/profile-panel";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";

export default async function ProfilePage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/signin?callbackUrl=/profile");
  const result = await db.query(`SELECT name,email,COALESCE(preferences->>'phone','') AS phone,created_at AS "createdAt" FROM users WHERE id=$1`, [session.user.id]);
  if (!result.rows[0]) redirect("/signin");
  return <ProfilePanel profile={result.rows[0]}/>;
}
