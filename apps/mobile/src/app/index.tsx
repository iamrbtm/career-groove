import { Redirect, useRouter } from "expo-router";
import { ArrowRight, Headphones, Sparkles } from "lucide-react-native";
import { Platform, Text, View } from "react-native";

import {
  GrooveButton,
  GrooveCard,
  Heading,
  LoadingState,
  Screen,
} from "@/components/ui";
import { colors } from "@/design/theme";
import { useAuth } from "@/providers/auth-provider";

const features = [
  {
    description: "Turn a scattered job search into one clear next move.",
    title: "Career DJ",
  },
  {
    description: "Keep every role, conversation, document, and follow-up in rhythm.",
    title: "Application tracker",
  },
  {
    description: "Practice interviews and remix your materials with the AI provider you choose.",
    title: "Your own AI stack",
  },
];

export default function LandingRoute() {
  const router = useRouter();
  const { isLoading, user } = useAuth();
  if (isLoading) return <LoadingState label="Tuning CareerGroove" />;
  if (user) return <Redirect href="/(tabs)" />;

  return (
    <Screen>
      <View className="flex-row items-center justify-between py-2">
        <View className="flex-row items-center gap-2">
          <View className="h-10 w-10 items-center justify-center rounded-full bg-ink">
            <Headphones color={colors.cream} size={20} />
          </View>
          <Text className="text-xl font-black text-ink">CareerGroove</Text>
        </View>
        {Platform.OS === "web" ? (
          <GrooveButton
            onPress={() => router.push("/(auth)/sign-in")}
            variant="quiet"
          >
            Sign in
          </GrooveButton>
        ) : null}
      </View>

      <View className="min-h-[580px] justify-center gap-8 py-20 md:flex-row md:items-center md:py-36">
        <View className="max-w-4xl flex-1 gap-6">
          <Heading eyebrow="Your career, back in rhythm">
            Make your next move sound like you.
          </Heading>
          <Text className="max-w-2xl text-lg leading-8 text-ink/70 md:text-xl">
            CareerGroove turns job-search noise into a focused daily mix of
            applications, relationships, documents, and interview practice.
          </Text>
          <View className="max-w-xl gap-3 sm:flex-row">
            <GrooveButton onPress={() => router.push("/(auth)/sign-in")}>
              Start your mix
            </GrooveButton>
            <GrooveButton
              onPress={() => router.push("/(auth)/sign-in")}
              variant="secondary"
            >
              I already have an account
            </GrooveButton>
          </View>
        </View>
        <View
          accessibilityElementsHidden
          className="relative h-72 flex-1 overflow-hidden rounded-[40px] bg-plum"
        >
          <View className="absolute -right-12 -top-12 h-56 w-56 rounded-full bg-sunshine" />
          <View className="absolute bottom-6 left-6 h-44 w-44 rounded-full border-[28px] border-ink bg-coral" />
          <View className="absolute bottom-12 right-10 rotate-[-9deg] rounded-groove bg-cream p-5">
            <Sparkles color={colors.plum} size={38} />
          </View>
        </View>
      </View>

      <View className="gap-4 py-20 md:grid md:grid-cols-12">
        {features.map((feature, index) => (
          <View
            className={
              index === 0
                ? "md:col-span-7"
                : index === 1
                  ? "md:col-span-5"
                  : "md:col-span-12"
            }
            key={feature.title}
          >
            <GrooveCard>
              <View className="gap-4">
                <Text className="text-2xl font-black text-ink">
                  {feature.title}
                </Text>
                <Text className="text-base leading-7 text-ink/65">
                  {feature.description}
                </Text>
                <ArrowRight color={colors.coral} size={24} />
              </View>
            </GrooveCard>
          </View>
        ))}
      </View>

      <View className="my-20 gap-5 rounded-[36px] bg-ink px-6 py-16 md:px-14">
        <Text className="max-w-4xl text-4xl font-black leading-tight text-cream md:text-6xl">
          Stop managing the search. Start moving it.
        </Text>
        <View className="max-w-xs">
          <GrooveButton onPress={() => router.push("/(auth)/sign-in")}>
            Get into the groove
          </GrooveButton>
        </View>
      </View>
    </Screen>
  );
}
