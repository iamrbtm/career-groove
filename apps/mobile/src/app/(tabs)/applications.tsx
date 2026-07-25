import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Text, View } from "react-native";

import {
  EmptyState,
  Field,
  GrooveButton,
  GrooveCard,
  Heading,
  LoadingState,
  Screen,
} from "@/components/ui";
import {
  groupApplications,
  type ApplicationSummary,
} from "@/features/applications/model";
import { apiJson } from "@/lib/api";

export default function ApplicationsRoute() {
  const queryClient = useQueryClient();
  const [capturing, setCapturing] = useState(false);
  const [title, setTitle] = useState("");
  const [company, setCompany] = useState("");
  const [description, setDescription] = useState("");
  const query = useQuery({
    queryFn: () =>
      apiJson<{ applications: ApplicationSummary[] }>("/api/applications"),
    queryKey: ["applications"],
  });
  const create = useMutation({
    mutationFn: () =>
      apiJson("/api/applications", {
        body: JSON.stringify({ company, description, title }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      }),
    onSuccess: async () => {
      setCapturing(false);
      setCompany("");
      setDescription("");
      setTitle("");
      await queryClient.invalidateQueries({ queryKey: ["applications"] });
    },
  });

  const groups = groupApplications(query.data?.applications ?? []);
  return (
    <Screen>
      <View className="gap-5 md:flex-row md:items-end md:justify-between">
        <Heading eyebrow="Pipeline">Applications</Heading>
        <View className="max-w-xs">
          <GrooveButton onPress={() => setCapturing((value) => !value)}>
            {capturing ? "Close capture" : "Capture a role"}
          </GrooveButton>
        </View>
      </View>

      {capturing ? (
        <GrooveCard>
          <View className="gap-4">
            <Text className="text-2xl font-black text-ink">New opportunity</Text>
            <Field label="Role title" onChangeText={setTitle} value={title} />
            <Field label="Company" onChangeText={setCompany} value={company} />
            <Field
              label="Job description"
              multiline
              numberOfLines={6}
              onChangeText={setDescription}
              textAlignVertical="top"
              value={description}
            />
            {create.error ? (
              <Text accessibilityRole="alert" className="font-semibold text-coral">
                {create.error.message}
              </Text>
            ) : null}
            <GrooveButton
              disabled={
                create.isPending ||
                !title.trim() ||
                !company.trim() ||
                !description.trim()
              }
              onPress={() => create.mutate()}
            >
              {create.isPending ? "Saving…" : "Save opportunity"}
            </GrooveButton>
          </View>
        </GrooveCard>
      ) : null}

      {query.isLoading ? <LoadingState label="Loading applications" /> : null}
      {query.error ? (
        <GrooveCard>
          <Text className="font-bold text-coral">{query.error.message}</Text>
        </GrooveCard>
      ) : null}
      {query.data?.applications.length === 0 && !capturing ? (
        <EmptyState
          action={
            <GrooveButton onPress={() => setCapturing(true)}>
              Capture your first role
            </GrooveButton>
          }
          description="Capture a role to research, tailor materials, follow up, and prepare for interviews in one workspace."
          title="No roles in the mix yet"
        />
      ) : null}

      <View className="gap-6 md:grid md:grid-cols-3">
        {groups
          .filter((group) => group.items.length > 0)
          .map((group) => (
            <View className="gap-3" key={group.key}>
              <View className="flex-row items-center justify-between">
                <Text className="text-lg font-black text-ink">{group.label}</Text>
                <Text className="font-bold text-plum">{group.items.length}</Text>
              </View>
              {group.items.map((application) => (
                <GrooveCard key={application.id}>
                  <View className="gap-1">
                    <Text className="text-lg font-black text-ink">
                      {application.title}
                    </Text>
                    <Text className="text-ink/60">{application.company}</Text>
                    {application.priorityLabel ? (
                      <Text className="mt-2 text-sm font-bold text-plum">
                        {application.priorityLabel.replaceAll("_", " ")}
                      </Text>
                    ) : null}
                  </View>
                </GrooveCard>
              ))}
            </View>
          ))}
      </View>
    </Screen>
  );
}
