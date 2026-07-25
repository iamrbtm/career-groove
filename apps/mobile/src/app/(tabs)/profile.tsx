import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Text, View } from "react-native";

import { Field, GrooveButton, GrooveCard, Heading, LoadingState, Screen } from "@/components/ui";
import { apiJson } from "@/lib/api";

interface Profile { email: string; name: string; phone: string }

export default function ProfileRoute() {
  const client = useQueryClient();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const query = useQuery({
    queryFn: () => apiJson<{ profile: Profile }>("/api/profile"),
    queryKey: ["profile"],
  });
  useEffect(() => {
    if (query.data) {
      setName(query.data.profile.name ?? "");
      setPhone(query.data.profile.phone ?? "");
    }
  }, [query.data]);
  const save = useMutation({
    mutationFn: () => apiJson("/api/profile", {
      body: JSON.stringify({ name, phone }),
      headers: { "Content-Type": "application/json" },
      method: "PATCH",
    }),
    onSuccess: async () => client.invalidateQueries({ queryKey: ["profile"] }),
  });
  if (query.isLoading) return <Screen><LoadingState label="Loading your profile" /></Screen>;
  return (
    <Screen>
      <Heading eyebrow="Your liner notes">Profile & settings</Heading>
      <GrooveCard>
        <View className="gap-4">
          <Field label="Name" onChangeText={setName} value={name} />
          <Field editable={false} label="Email" value={query.data?.profile.email ?? ""} />
          <Field keyboardType="phone-pad" label="Phone" onChangeText={setPhone} value={phone} />
          {save.isError ? <Text accessibilityRole="alert" className="font-bold text-coral">{save.error.message}</Text> : null}
          <GrooveButton disabled={save.isPending || name.trim().length < 2} onPress={() => save.mutate()}>
            {save.isPending ? "Saving…" : "Save profile"}
          </GrooveButton>
        </View>
      </GrooveCard>
    </Screen>
  );
}
