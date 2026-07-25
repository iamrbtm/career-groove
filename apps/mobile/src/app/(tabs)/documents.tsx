import { useQuery } from "@tanstack/react-query";
import { Text, View } from "react-native";

import { EmptyState, GrooveCard, Heading, LoadingState, Screen } from "@/components/ui";
import { apiJson } from "@/lib/api";

interface Document {
  createdAt: string;
  id: string;
  kind: "resume" | "cover_letter" | "other";
  title: string;
}

export default function DocumentsRoute() {
  const query = useQuery({
    queryFn: () => apiJson<{ documents: Document[] }>("/api/documents"),
    queryKey: ["documents"],
  });
  return (
    <Screen>
      <Heading eyebrow="Your catalog">Documents</Heading>
      {query.isLoading ? <LoadingState label="Loading your documents" /> : null}
      {query.isError ? (
        <Text accessibilityRole="alert" className="font-bold text-coral">
          {query.error.message}
        </Text>
      ) : null}
      {query.data?.documents.length === 0 ? (
        <EmptyState
          description="Your tailored resumes and cover letters will collect here."
          title="No tracks recorded yet"
        />
      ) : null}
      <View className="gap-4">
        {query.data?.documents.map((document) => (
          <GrooveCard key={document.id}>
            <Text className="text-xl font-black text-ink">{document.title}</Text>
            <Text className="mt-1 uppercase tracking-wider text-plum">
              {document.kind.replace("_", " ")}
            </Text>
          </GrooveCard>
        ))}
      </View>
    </Screen>
  );
}
