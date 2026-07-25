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

interface Contact {
  company: string | null;
  id: string;
  name: string;
  role: string | null;
}

export default function NetworkRoute() {
  const query = useQuery({
    queryFn: () => apiJson<{ contacts: Contact[] }>("/api/contacts"),
    queryKey: ["contacts"],
  });
  return (
    <Screen>
      <Heading eyebrow="People, not leads">Network</Heading>
      {query.isLoading ? <LoadingState label="Loading your network" /> : null}
      {query.data?.contacts.length === 0 ? (
        <EmptyState
          description="Save the people who can offer context, perspective, and a warm introduction."
          title="Start with one real connection"
        />
      ) : null}
      <View className="gap-4">
        {query.data?.contacts.map((contact) => (
          <GrooveCard key={contact.id}>
            <Text className="text-xl font-black text-ink">{contact.name}</Text>
            <Text className="mt-1 text-ink/60">
              {[contact.role, contact.company].filter(Boolean).join(" · ")}
            </Text>
          </GrooveCard>
        ))}
      </View>
    </Screen>
  );
}
