import SwiftUI

private struct NotePayload: Encodable {
    let eventType = "note_added"
    let title: String
    let body: String
    let metadata: [String: JSONValue] = [:]
}

private struct InterviewPayload: Encodable {
    let roundType: String
    let scheduledAt: String
    let interviewer: String
    let meetingLink: String
    let prepStatus = "not_started"
    let notes: String
}

private struct OutcomePayload: Encodable {
    let outcome: String
    let stage: String
    let reason: String
    let userNote: String
    let contactUsed = false
}

private struct AsyncFormContainer<Fields: View, Payload: Encodable>: View {
    @Environment(\.dismiss) private var dismiss
    let title: String
    let path: String
    let payload: () -> Payload
    let canSave: Bool
    let onSaved: () async -> Void
    @ViewBuilder let fields: () -> Fields
    @State private var isSaving = false
    @State private var errorMessage: String?

    var body: some View {
        Form {
            fields()
            if let errorMessage { Section { Text(errorMessage).foregroundStyle(.red) } }
        }
        .navigationTitle(title)
        .navigationBarTitleDisplayMode(.inline)
        .scrollContentBackground(.hidden)
        .background(Color.cream)
        .toolbar {
            ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
            ToolbarItem(placement: .confirmationAction) {
                Button("Save") {
                    isSaving = true
                    Task {
                        defer { isSaving = false }
                        do {
                            try await APIClient.shared.requestVoid(.post, path, body: payload())
                            await onSaved()
                            dismiss()
                        } catch { errorMessage = error.localizedDescription }
                    }
                }
                .disabled(!canSave || isSaving)
            }
        }
    }
}

struct ApplicationNoteForm: View {
    let applicationID: String
    let onSaved: () async -> Void
    @State private var title = ""
    @State private var note = ""

    var body: some View {
        AsyncFormContainer(
            title: "Add Note",
            path: "/api/applications/\(applicationID)/events",
            payload: { NotePayload(title: title, body: note) },
            canSave: !title.isEmpty,
            onSaved: onSaved
        ) {
            Section("Note") {
                TextField("Title", text: $title)
                TextEditor(text: $note).frame(minHeight: 150)
            }
        }
    }
}

struct InterviewForm: View {
    let applicationID: String
    let onSaved: () async -> Void
    @State private var roundType = "screen"
    @State private var scheduledAt = Date()
    @State private var interviewer = ""
    @State private var meetingLink = ""
    @State private var notes = ""

    var body: some View {
        AsyncFormContainer(
            title: "Add Interview",
            path: "/api/applications/\(applicationID)/interviews",
            payload: {
                InterviewPayload(
                    roundType: roundType,
                    scheduledAt: ISO8601DateFormatter().string(from: scheduledAt),
                    interviewer: interviewer,
                    meetingLink: meetingLink,
                    notes: notes
                )
            },
            canSave: !roundType.isEmpty,
            onSaved: onSaved
        ) {
            Section("Interview") {
                Picker("Round", selection: $roundType) {
                    ForEach(["screen", "technical", "panel", "final", "other"], id: \.self) {
                        Text($0.capitalized).tag($0)
                    }
                }
                DatePicker("Scheduled", selection: $scheduledAt)
                TextField("Interviewer", text: $interviewer)
                TextField("Meeting link", text: $meetingLink).keyboardType(.URL).textInputAutocapitalization(.never)
                TextEditor(text: $notes).frame(minHeight: 100)
            }
        }
    }
}

struct OutcomeForm: View {
    let applicationID: String
    let onSaved: () async -> Void
    @State private var outcome = "rejected"
    @State private var stage = ""
    @State private var reason = ""
    @State private var note = ""

    var body: some View {
        AsyncFormContainer(
            title: "Log Outcome",
            path: "/api/applications/\(applicationID)/outcomes",
            payload: { OutcomePayload(outcome: outcome, stage: stage, reason: reason, userNote: note) },
            canSave: !outcome.isEmpty,
            onSaved: onSaved
        ) {
            Section("Outcome") {
                Picker("Result", selection: $outcome) {
                    ForEach(["rejected", "no_response", "withdrew", "offer", "accepted", "declined", "archived"], id: \.self) {
                        Text($0.replacingOccurrences(of: "_", with: " ").capitalized).tag($0)
                    }
                }
                TextField("Stage", text: $stage)
                TextField("Reason", text: $reason, axis: .vertical)
                TextEditor(text: $note).frame(minHeight: 120)
            }
        }
    }
}
