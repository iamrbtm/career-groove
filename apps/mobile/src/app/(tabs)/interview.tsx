import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { Text, View } from "react-native";

import { Field, GrooveButton, GrooveCard, Heading, Screen } from "@/components/ui";
import { apiClient } from "@/lib/api";

type Message = { content: string; role: "user" | "assistant" };

export default function InterviewRoute() {
  const [answer, setAnswer] = useState("");
  const [messages, setMessages] = useState<Message[]>([
    {
      content:
        "Tell me about the role you’re preparing for and the part you most want to rehearse.",
      role: "assistant",
    },
  ]);
  const coach = useMutation({
    mutationFn: async (nextMessages: Message[]) => {
      const response = await apiClient.request("/api/ai", {
        body: JSON.stringify({
          messages: nextMessages,
          purpose: "mock-interview",
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error?.message ?? "Coaching is unavailable");
      }
      return response.text();
    },
    onSuccess: (content) => {
      setMessages((current) => [...current, { content, role: "assistant" }]);
    },
  });

  function send() {
    const content = answer.trim();
    if (!content || coach.isPending) return;
    const next = [...messages, { content, role: "user" as const }];
    setMessages(next);
    setAnswer("");
    coach.mutate(next);
  }

  return (
    <Screen>
      <Heading eyebrow="Soundcheck">Interview practice</Heading>
      <View className="gap-3">
        {messages.map((message, index) => (
          <View
            className={message.role === "user" ? "ml-8" : "mr-8"}
            key={`${message.role}-${index}`}
          >
            <GrooveCard>
              <Text className="mb-1 text-xs font-bold uppercase tracking-wider text-plum">
                {message.role === "user" ? "You" : "Career coach"}
              </Text>
              <Text className="text-base leading-6 text-ink">{message.content}</Text>
            </GrooveCard>
          </View>
        ))}
      </View>
      {coach.isError ? (
        <Text accessibilityRole="alert" className="font-bold text-coral">
          {coach.error.message} Your answer is still here in the conversation.
        </Text>
      ) : null}
      <View className="gap-3">
        <Field
          label="Your answer"
          multiline
          onChangeText={setAnswer}
          onSubmitEditing={send}
          value={answer}
        />
        <GrooveButton disabled={!answer.trim() || coach.isPending} onPress={send}>
          {coach.isPending ? "Coach is listening…" : "Send answer"}
        </GrooveButton>
      </View>
    </Screen>
  );
}
