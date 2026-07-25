import { auth } from "@/auth";
import { LandingPage } from "@/components/landing/landing-page";

export default async function HomePage() {
  const session = await auth();
  return <LandingPage signedIn={Boolean(session?.user)} />;
}
