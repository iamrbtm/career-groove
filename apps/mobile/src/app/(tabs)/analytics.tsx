import { useQuery } from "@tanstack/react-query";
import { Text, View } from "react-native";

import { GrooveCard, Heading, LoadingState, Screen } from "@/components/ui";
import { apiJson } from "@/lib/api";

interface Analytics {
  interviewsActive?: number;
  responseRate?: number;
  submittedCount?: number;
  total?: number;
}

export default function AnalyticsRoute() {
  const query = useQuery({
    queryFn: () =>
      apiJson<{ summary: Analytics }>("/api/application-analytics"),
    queryKey: ["application-analytics"],
  });
  if (query.isLoading) return <Screen><LoadingState label="Mixing your numbers" /></Screen>;
  const metrics = [
    ["Applications", query.data?.summary.total ?? 0],
    ["Submitted", query.data?.summary.submittedCount ?? 0],
    ["Response rate", `${query.data?.summary.responseRate ?? 0}%`],
  ];
  return (
    <Screen>
      <Heading eyebrow="Listen back">Analytics</Heading>
      <View className="gap-4 md:flex-row">
        {metrics.map(([label, value]) => (
          <GrooveCard key={label}>
            <Text className="text-4xl font-black text-coral">{value}</Text>
            <Text className="mt-1 font-bold text-ink">{label}</Text>
          </GrooveCard>
        ))}
      </View>
    </Screen>
  );
}
