import { EmptyState, Heading, Screen } from "@/components/ui";

export default function ApplicationsRoute() {
  return (
    <Screen>
      <Heading eyebrow="Pipeline">Applications</Heading>
      <EmptyState
        description="Capture a role to start research, tailor materials, follow up, and prepare for interviews in one workspace."
        title="No roles in the mix yet"
      />
    </Screen>
  );
}
