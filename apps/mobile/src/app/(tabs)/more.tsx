import { useRouter } from "expo-router";
import {
  BarChart3,
  Bot,
  ChevronRight,
  FileText,
  MessagesSquare,
  UserRound,
} from "lucide-react-native";
import { Pressable, Text, View } from "react-native";

import { GrooveButton, GrooveCard, Heading, Screen } from "@/components/ui";
import { useAuth } from "@/providers/auth-provider";

export default function MoreRoute() {
  const router = useRouter();
  const { signOut } = useAuth();
  return (
    <Screen>
      <Heading eyebrow="Studio">More tools</Heading>
      <View className="gap-4">
        {[
          { href: "/(tabs)/documents", icon: FileText, title: "Documents" },
          { href: "/(tabs)/analytics", icon: BarChart3, title: "Analytics" },
          { href: "/(tabs)/interview", icon: MessagesSquare, title: "Interview practice" },
          { href: "/(tabs)/providers", icon: Bot, title: "AI providers" },
          { href: "/(tabs)/profile", icon: UserRound, title: "Profile & settings" },
        ].map(({ href, icon: Icon, title }) => (
          <Pressable
            accessibilityRole="button"
            key={title}
            onPress={() => router.push(href as never)}
          >
            <GrooveCard>
              <View className="flex-row items-center gap-3">
                <Icon color="#ef6a5b" size={24} />
                <Text className="flex-1 text-lg font-black text-ink">{title}</Text>
                <ChevronRight color="#26312c" size={20} />
              </View>
            </GrooveCard>
          </Pressable>
        ))}
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
