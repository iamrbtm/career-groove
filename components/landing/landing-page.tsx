import { Features, HowItWorks } from "./features";
import { LandingFooter } from "./footer";
import { LandingHeader } from "./header";
import { Hero } from "./hero";
import { Pricing } from "./pricing";

interface LandingPageProps { signedIn: boolean }

export function LandingPage({ signedIn }: LandingPageProps) {
  return <div className="min-h-dvh"><LandingHeader signedIn={signedIn}/><main><Hero/><Features/><HowItWorks/><Pricing signedIn={signedIn}/></main><LandingFooter/></div>;
}
