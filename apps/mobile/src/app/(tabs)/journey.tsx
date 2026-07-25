import { useQuery } from "@tanstack/react-query";
import { Text, View } from "react-native";

import {
  EmptyState,
  GrooveCard,
  Heading,
  LoadingState,
  Screen,
} from "@/components/ui";
import { apiJson } from "@/lib/api";

interface Job {
  company: string;
  current: boolean;
  id: string;
  title: string;
}

export default function JourneyRoute() {
  const query = useQuery({
    queryFn: () => apiJson<{ jobs: Job[] }>("/api/jobs"),
    queryKey: ["jobs"],
  });
  return (
    <Screen>
      <Heading eyebrow="Your story">Career journey</Heading>
      {query.isLoading ? <LoadingState label="Loading your journey" /> : null}
      {query.data?.jobs.length === 0 ? (
        <EmptyState
          description="Add the roles and wins that make your experience unmistakably yours."
          title="Your first track is waiting"
        />
      ) : null}
      <View className="gap-4">
        {query.data?.jobs.map((job) => (
          <GrooveCard key={job.id}>
            <Text className="text-xl font-black text-ink">{job.title}</Text>
            <Text className="mt-1 text-base text-ink/65">{job.company}</Text>
          </GrooveCard>
        ))}
      </View>
    </Screen>
  );
}
