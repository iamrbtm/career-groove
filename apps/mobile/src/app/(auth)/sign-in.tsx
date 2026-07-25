import { useRouter } from "expo-router";
import { useState } from "react";
import { Text, View } from "react-native";

import { Field, GrooveButton, Heading, Screen } from "@/components/ui";
import { useAuth } from "@/providers/auth-provider";

export default function SignInRoute() {
  const router = useRouter();
  const { signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    setSubmitting(true);
    setError("");
    try {
      await signIn(email, password);
      router.replace("/(tabs)");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Sign in failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Screen>
      <View className="mx-auto w-full max-w-lg gap-8 py-16">
        <Heading eyebrow="Welcome back">Drop the needle.</Heading>
        <View className="gap-5">
          <Field
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            label="Email"
            onChangeText={setEmail}
            textContentType="emailAddress"
            value={email}
          />
          <Field
            autoComplete="current-password"
            label="Password"
            onChangeText={setPassword}
            onSubmitEditing={() => void submit()}
            secureTextEntry
            textContentType="password"
            value={password}
          />
          {error ? (
            <Text accessibilityRole="alert" className="font-semibold text-coral">
              {error}
            </Text>
          ) : null}
          <GrooveButton
            disabled={submitting || !email || password.length < 8}
            onPress={() => void submit()}
          >
            {submitting ? "Signing in…" : "Sign in"}
          </GrooveButton>
          <GrooveButton onPress={() => router.back()} variant="quiet">
            Back
          </GrooveButton>
        </View>
      </View>
    </Screen>
  );
}
