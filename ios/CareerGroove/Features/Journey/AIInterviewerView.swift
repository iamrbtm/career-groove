import Observation
import SwiftUI

@MainActor
@Observable
final class AIInterviewerViewModel {
    var messages: [ChatMessage] = []
    var draft = ""
    var isLoading = false
    var errorMessage: String?

    func send(job: Job) async {
        let text = draft.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !text.isEmpty, !isLoading else { return }
        draft = ""
        messages.append(ChatMessage(role: "user", content: text))
        isLoading = true
        defer { isLoading = false }
        struct APIMessage: Encodable { let role: String; let content: String }
        struct Payload: Encodable {
            let purpose: String
            let messages: [APIMessage]
            let context: [String: JSONValue]
        }
        do {
            let response = try await APIClient.shared.requestText(
                .post,
                "/api/ai",
                body: Payload(
                    purpose: "job-interview-probe",
                    messages: messages.map { APIMessage(role: $0.role, content: $0.content) },
                    context: ["jobId": .string(job.id), "company": .string(job.company), "title": .string(job.title)]
                )
            )
            messages.append(ChatMessage(role: "assistant", content: response))
        } catch { errorMessage = error.localizedDescription }
    }
}

struct AIInterviewerView: View {
    @Environment(\.dismiss) private var dismiss
    let job: Job
    @State private var model = AIInterviewerViewModel()

    var body: some View {
        VStack(spacing: 0) {
            ScrollViewReader { proxy in
                ScrollView {
                    LazyVStack(spacing: 12) {
                        if model.messages.isEmpty {
                            Text("Describe what you did, who it helped, and what changed.")
                                .foregroundStyle(Color.plum).padding(24)
                        }
                        ForEach(model.messages) { message in
                            HStack {
                                if message.role == "user" { Spacer(minLength: 44) }
                                Text(message.content)
                                    .padding(12)
                                    .background(message.role == "user" ? Color.coral.opacity(0.22) : Color.white)
                                    .clipShape(RoundedRectangle(cornerRadius: 8))
                                    .foregroundStyle(Color.ink)
                                if message.role != "user" { Spacer(minLength: 44) }
                            }
                            .id(message.id)
                        }
                        if model.isLoading { ProgressView().padding() }
                    }
                    .padding()
                }
                .onChange(of: model.messages.count) { _, _ in
                    if let id = model.messages.last?.id { withAnimation { proxy.scrollTo(id, anchor: .bottom) } }
                }
            }
            Divider()
            HStack(alignment: .bottom) {
                TextField("Share a detail…", text: $model.draft, axis: .vertical)
                    .textFieldStyle(.roundedBorder).lineLimit(1...5)
                Button { Task { await model.send(job: job) } } label: {
                    Image(systemName: "arrow.up.circle.fill").font(.title)
                }
                .disabled(model.draft.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || model.isLoading)
                .accessibilityLabel("Send")
            }
            .padding()
        }
        .background(Color.cream)
        .navigationTitle("Career Interview")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar { ToolbarItem(placement: .cancellationAction) { Button("Done") { dismiss() } } }
        .alert("Message Not Sent", isPresented: Binding(
            get: { model.errorMessage != nil },
            set: { if !$0 { model.errorMessage = nil } }
        )) { Button("OK", role: .cancel) {} } message: { Text(model.errorMessage ?? "") }
    }
}
