import { Text, View } from "react-native";

import { GrooveCard, Heading, Screen } from "@/components/ui";
import { useAuth } from "@/providers/auth-provider";

export default function HomeRoute() {
  const { user } = useAuth();
  return (
    <Screen>
      <Heading eyebrow="Today’s mix">
        {user?.name ? `Ready, ${user.name}?` : "Ready for your next move?"}
      </Heading>
      <Text className="max-w-2xl text-lg leading-7 text-ink/65">
        A focused set of moves keeps momentum without turning the search into a
        second full-time job.
      </Text>
      <View className="gap-4 md:flex-row">
        {[
          ["Capture a role", "Save a promising job and score its signal."],
          ["Follow the beat", "See which application needs attention today."],
          ["Practice out loud", "Warm up for the next conversation."],
        ].map(([title, description]) => (
          <View className="flex-1" key={title}>
            <GrooveCard>
              <View className="gap-2">
                <Text className="text-xl font-black text-ink">{title}</Text>
                <Text className="leading-6 text-ink/60">{description}</Text>
              </View>
            </GrooveCard>
          </View>
        ))}
      </View>
    </Screen>
  );
}
