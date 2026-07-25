import Observation
import SwiftUI

@MainActor
@Observable
final class MockInterviewViewModel {
    var messages: [ChatMessage] = [
        ChatMessage(role: "assistant", content: "What role are you preparing for, and what part of the interview feels most important to practice?")
    ]
    var draft = ""
    var isLoading = false
    var errorMessage: String?

    func send() async {
        let text = draft.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !text.isEmpty, !isLoading else { return }
        draft = ""
        messages.append(ChatMessage(role: "user", content: text))
        isLoading = true
        defer { isLoading = false }
        struct APIMessage: Encodable { let role: String; let content: String }
        struct Payload: Encodable { let purpose: String; let messages: [APIMessage] }
        do {
            let response = try await APIClient.shared.requestText(
                .post, "/api/ai",
                body: Payload(
                    purpose: "mock-interview",
                    messages: messages.map { APIMessage(role: $0.role, content: $0.content) }
                )
            )
            messages.append(ChatMessage(role: "assistant", content: response))
        } catch { errorMessage = error.localizedDescription }
    }
}

struct MockInterviewView: View {
    @State private var model = MockInterviewViewModel()

    var body: some View {
        VStack(spacing: 0) {
            ScrollView {
                LazyVStack(spacing: 12) {
                    ForEach(model.messages) { message in
                        HStack {
                            if message.role == "user" { Spacer(minLength: 40) }
                            Text(message.content)
                                .padding(12)
                                .background(message.role == "user" ? Color.coral.opacity(0.22) : Color.white)
                                .foregroundStyle(Color.ink)
                                .clipShape(RoundedRectangle(cornerRadius: 8))
                            if message.role != "user" { Spacer(minLength: 40) }
                        }
                    }
                    if model.isLoading { ProgressView().padding() }
                }.padding()
            }
            Divider()
            HStack(alignment: .bottom) {
                TextField("Your answer…", text: $model.draft, axis: .vertical)
                    .textFieldStyle(.roundedBorder).lineLimit(1...6)
                Button { Task { await model.send() } } label: {
                    Image(systemName: "arrow.up.circle.fill").font(.title)
                }
                .disabled(model.draft.isEmpty || model.isLoading)
                .accessibilityLabel("Send answer")
            }.padding()
        }
        .background(Color.cream)
        .navigationTitle("Mock Interview")
        .navigationBarTitleDisplayMode(.inline)
        .alert("Interview Paused", isPresented: Binding(
            get: { model.errorMessage != nil }, set: { if !$0 { model.errorMessage = nil } }
        )) { Button("OK", role: .cancel) {} } message: { Text(model.errorMessage ?? "") }
    }
}
