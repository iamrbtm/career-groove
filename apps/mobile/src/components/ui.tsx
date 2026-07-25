import type { ReactNode } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
  type PressableProps,
  type TextInputProps,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { colors, shadows } from "@/design/theme";

export function Screen({
  children,
  scroll = true,
}: {
  children: ReactNode;
  scroll?: boolean;
}) {
  const content = (
    <View className="mx-auto w-full max-w-6xl gap-6 px-5 pb-24 pt-4">
      {children}
    </View>
  );
  return (
    <SafeAreaView className="flex-1 bg-cream" edges={["top"]}>
      {scroll ? (
        <ScrollView
          contentInsetAdjustmentBehavior="automatic"
          keyboardShouldPersistTaps="handled"
        >
          {content}
        </ScrollView>
      ) : (
        content
      )}
    </SafeAreaView>
  );
}

export function Heading({
  children,
  eyebrow,
}: {
  children: ReactNode;
  eyebrow?: string;
}) {
  return (
    <View className="gap-1">
      {eyebrow ? (
        <Text className="text-sm font-extrabold uppercase tracking-widest text-plum">
          {eyebrow}
        </Text>
      ) : null}
      <Text
        accessibilityRole="header"
        className="max-w-5xl text-4xl font-black leading-tight text-ink md:text-6xl"
      >
        {children}
      </Text>
    </View>
  );
}

export function GrooveCard({ children }: { children: ReactNode }) {
  return (
    <View
      className="rounded-groove border-2 border-ink/10 bg-white p-5"
      style={shadows.pop}
    >
      {children}
    </View>
  );
}

export function GrooveButton({
  children,
  disabled,
  variant = "primary",
  ...props
}: PressableProps & {
  children: ReactNode;
  variant?: "primary" | "secondary" | "quiet";
}) {
  const background =
    variant === "primary"
      ? "bg-coral"
      : variant === "secondary"
        ? "bg-ink"
        : "bg-transparent";
  const foreground = variant === "quiet" ? "text-ink" : "text-white";
  return (
    <Pressable
      accessibilityRole="button"
      className={`min-h-12 items-center justify-center rounded-2xl px-5 py-3 ${background} ${disabled ? "opacity-50" : "active:scale-[0.98]"}`}
      disabled={disabled}
      {...props}
    >
      <Text className={`text-base font-extrabold ${foreground}`}>{children}</Text>
    </Pressable>
  );
}

export function Field({
  label,
  ...props
}: TextInputProps & { label: string }) {
  return (
    <View className="gap-2">
      <Text className="text-sm font-bold text-ink">{label}</Text>
      <TextInput
        accessibilityLabel={label}
        className="min-h-12 rounded-2xl border-2 border-ink/15 bg-white px-4 py-3 text-base text-ink"
        placeholderTextColor={`${colors.ink}80`}
        {...props}
      />
    </View>
  );
}

export function LoadingState({ label = "Loading" }: { label?: string }) {
  return (
    <View
      accessibilityLabel={label}
      accessibilityRole="progressbar"
      className="min-h-48 items-center justify-center gap-3"
    >
      <ActivityIndicator color={colors.coral} size="large" />
      <Text className="font-semibold text-ink/60">{label}</Text>
    </View>
  );
}

export function EmptyState({
  action,
  description,
  title,
}: {
  action?: ReactNode;
  description: string;
  title: string;
}) {
  return (
    <View className="items-center gap-3 py-16">
      <Text className="text-center text-2xl font-black text-ink">{title}</Text>
      <Text className="max-w-md text-center text-base leading-6 text-ink/60">
        {description}
      </Text>
      {action}
    </View>
  );
}
