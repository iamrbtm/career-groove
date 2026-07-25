import { Redirect, Tabs } from "expo-router";
import {
  BriefcaseBusiness,
  Compass,
  Home,
  Menu,
  Network,
} from "lucide-react-native";

import { LoadingState } from "@/components/ui";
import { MusicPlayer } from "@/components/music-player";
import { colors } from "@/design/theme";
import { useAuth } from "@/providers/auth-provider";

export default function TabsLayout() {
  const { isLoading, user } = useAuth();
  if (isLoading) return <LoadingState label="Loading your mix" />;
  if (!user) return <Redirect href="/(auth)/sign-in" />;

  return (
    <>
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.coral,
        tabBarInactiveTintColor: `${colors.cream}99`,
        tabBarStyle: {
          backgroundColor: colors.ink,
          borderTopColor: colors.ink,
          minHeight: 68,
          paddingBottom: 8,
          paddingTop: 8,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          tabBarIcon: ({ color }) => <Home color={color} size={22} />,
          title: "Home",
        }}
      />
      <Tabs.Screen
        name="journey"
        options={{
          tabBarIcon: ({ color }) => <Compass color={color} size={22} />,
          title: "Journey",
        }}
      />
      <Tabs.Screen
        name="applications"
        options={{
          tabBarIcon: ({ color }) => (
            <BriefcaseBusiness color={color} size={22} />
          ),
          title: "Applications",
        }}
      />
      <Tabs.Screen
        name="network"
        options={{
          tabBarIcon: ({ color }) => <Network color={color} size={22} />,
          title: "Network",
        }}
      />
      <Tabs.Screen
        name="more"
        options={{
          tabBarIcon: ({ color }) => <Menu color={color} size={22} />,
          title: "More",
        }}
      />
      <Tabs.Screen name="documents" options={{ href: null }} />
      <Tabs.Screen name="analytics" options={{ href: null }} />
      <Tabs.Screen name="providers" options={{ href: null }} />
      <Tabs.Screen name="profile" options={{ href: null }} />
      <Tabs.Screen name="interview" options={{ href: null }} />
    </Tabs>
    <MusicPlayer />
    </>
  );
}
