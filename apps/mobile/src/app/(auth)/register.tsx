import { useRouter } from "expo-router";
import { useState } from "react";
import { Text, View } from "react-native";

import { Field, GrooveButton, Heading, Screen } from "@/components/ui";
import { useAuth } from "@/providers/auth-provider";

export default function RegisterRoute() {
  const router = useRouter();
  const { register } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    setSubmitting(true);
    setError("");
    try {
      await register(name, email, password);
      router.replace("/(tabs)");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Account creation failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Screen>
      <View className="mx-auto w-full max-w-lg gap-8 py-12">
        <Heading eyebrow="Your first track">Start your mix.</Heading>
        <View className="gap-5">
          <Field autoComplete="name" label="Name" onChangeText={setName} textContentType="name" value={name} />
          <Field autoCapitalize="none" autoComplete="email" keyboardType="email-address" label="Email" onChangeText={setEmail} textContentType="emailAddress" value={email} />
          <Field autoComplete="new-password" label="Password" onChangeText={setPassword} onSubmitEditing={() => void submit()} secureTextEntry textContentType="newPassword" value={password} />
          <Text className="text-sm leading-5 text-ink/60">
            Use at least 10 characters with a letter and a number.
          </Text>
          {error ? <Text accessibilityRole="alert" className="font-semibold text-coral">{error}</Text> : null}
          <GrooveButton disabled={submitting || name.trim().length < 2 || !email || password.length < 10} onPress={() => void submit()}>
            {submitting ? "Creating your mix…" : "Create account"}
          </GrooveButton>
          <GrooveButton onPress={() => router.replace("/(auth)/sign-in")} variant="quiet">
            I already have an account
          </GrooveButton>
        </View>
      </View>
    </Screen>
  );
}
