import SwiftUI

struct CommandSessionView: View {
    @Environment(\.dismiss) private var dismiss
    @State private var session: CommandSession?
    @State private var isLoading = false
    @State private var errorMessage: String?
    @State private var mode = "standard"

    init(session: CommandSession?) { _session = State(initialValue: session) }

    var body: some View {
        List {
            if let session {
                Section {
                    ForEach(session.actions) { action in
                        VStack(alignment: .leading, spacing: 4) {
                            HStack {
                                Image(systemName: action.status == "completed" ? "checkmark.circle.fill" : "circle")
                                    .foregroundStyle(action.status == "completed" ? Color.mint : Color.plum)
                                Text(action.title).font(.headline)
                            }
                            if let reason = action.reason { Text(reason).font(.subheadline).foregroundStyle(Color.plum) }
                        }
                        .padding(.vertical, 4)
                    }
                } header: { Text(session.title) }
            } else {
                Section("Session Depth") {
                    Picker("Mode", selection: $mode) {
                        ForEach(["light", "standard", "deep", "recovery", "interview"], id: \.self) {
                            Text($0.capitalized).tag($0)
                        }
                    }
                    .pickerStyle(.segmented)
                    Button("Build Session") { Task { await create() } }
                        .disabled(isLoading)
                }
            }
            if let errorMessage { Section { Text(errorMessage).foregroundStyle(.red) } }
        }
        .navigationTitle("Command Session")
        .scrollContentBackground(.hidden)
        .background(Color.cream)
    }

    private func create() async {
        struct Payload: Encodable { let mode: String }
        struct Response: Decodable { let session: CommandSession }
        isLoading = true
        defer { isLoading = false }
        do {
            let response: Response = try await APIClient.shared.request(
                .post, "/api/command-sessions", body: Payload(mode: mode)
            )
            session = response.session
        } catch { errorMessage = error.localizedDescription }
    }
}
