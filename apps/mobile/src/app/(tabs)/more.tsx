import { useRouter } from "expo-router";
import { Text, View } from "react-native";

import { GrooveButton, GrooveCard, Heading, Screen } from "@/components/ui";
import { useAuth } from "@/providers/auth-provider";

export default function MoreRoute() {
  const router = useRouter();
  const { signOut } = useAuth();
  return (
    <Screen>
      <Heading eyebrow="Studio">More tools</Heading>
      <View className="gap-4">
        {["Documents", "Analytics", "Interview practice", "Settings"].map(
          (title) => (
            <GrooveCard key={title}>
              <Text className="text-lg font-black text-ink">{title}</Text>
            </GrooveCard>
          ),
        )}
      </View>
      <GrooveButton
        onPress={() => {
          void signOut().then(() => router.replace("/"));
        }}
        variant="secondary"
      >
        Sign out
      </GrooveButton>
    </Screen>
  );
}
