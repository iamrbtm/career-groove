import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Text, View } from "react-native";

import { Field, GrooveButton, GrooveCard, Heading, LoadingState, Screen } from "@/components/ui";
import { apiJson } from "@/lib/api";

type ProviderName = "openai" | "anthropic" | "google" | "ollama";
interface Provider { active: boolean; keyHint: string | null; provider: ProviderName; selectedModel: string | null }

export default function ProvidersRoute() {
  const client = useQueryClient();
  const [provider, setProvider] = useState<ProviderName>("openai");
  const [apiKey, setApiKey] = useState("");
  const query = useQuery({
    queryFn: () => apiJson<{ providers: Provider[] }>("/api/providers"),
    queryKey: ["providers"],
  });
  const connect = useMutation({
    mutationFn: () => apiJson("/api/providers", {
      body: JSON.stringify({ action: "connect", apiKey, provider }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    }),
    onSuccess: async () => {
      setApiKey("");
      await client.invalidateQueries({ queryKey: ["providers"] });
    },
  });
  return (
    <Screen>
      <Heading eyebrow="Choose your sound">AI providers</Heading>
      {query.isLoading ? <LoadingState label="Checking connections" /> : null}
      <View className="gap-4">
        {query.data?.providers.map((item) => (
          <GrooveCard key={item.provider}>
            <Text className="text-xl font-black capitalize text-ink">{item.provider}</Text>
            <Text className="mt-1 text-ink/60">{item.selectedModel ?? "No model selected"} · {item.keyHint ?? "local"}</Text>
          </GrooveCard>
        ))}
      </View>
      <GrooveCard>
        <View className="gap-4">
          <Field autoCapitalize="none" label="Provider (openai, anthropic, google, ollama)" onChangeText={(value) => {
            if (["openai", "anthropic", "google", "ollama"].includes(value)) setProvider(value as ProviderName);
          }} value={provider} />
          {provider !== "ollama" ? <Field autoCapitalize="none" label="API key" onChangeText={setApiKey} secureTextEntry value={apiKey} /> : null}
          {connect.isError ? <Text accessibilityRole="alert" className="font-bold text-coral">{connect.error.message}</Text> : null}
          <GrooveButton disabled={connect.isPending || (provider !== "ollama" && !apiKey)} onPress={() => connect.mutate()}>
            {connect.isPending ? "Connecting…" : "Connect provider"}
          </GrooveButton>
        </View>
      </GrooveCard>
    </Screen>
  );
}
