import SwiftUI

struct AIProvidersView: View {
    @State private var connections: [ProviderConnection] = []
    @State private var defaultProvider: String?
    @State private var selectedProvider = "openai"
    @State private var apiKey = ""
    @State private var isWorking = false
    @State private var errorMessage: String?

    var body: some View {
        List {
            Section("Connections") {
                ForEach(connections) { connection in
                    VStack(alignment: .leading, spacing: 8) {
                        HStack {
                            Text(connection.provider.capitalized).font(.headline)
                            Spacer()
                            StatusPill(
                                text: connection.active ? "Connected" : "Needs attention",
                                color: connection.active ? .mint : .sun
                            )
                        }
                        if let model = connection.selectedModel {
                            Text(model).font(.subheadline).foregroundStyle(Color.plum)
                        }
                        if let error = connection.lastError { Text(error).font(.caption).foregroundStyle(.red) }
                        if connection.active && connection.selectedModel != nil {
                            Button(defaultProvider == connection.provider ? "Default" : "Make Default") {
                                Task { await setDefault(connection.provider) }
                            }
                            .disabled(defaultProvider == connection.provider)
                        }
                    }
                    .padding(.vertical, 4)
                }
            }
            Section("Connect Provider") {
                Picker("Provider", selection: $selectedProvider) {
                    ForEach(["openai", "anthropic", "google", "ollama"], id: \.self) {
                        Text($0.capitalized).tag($0)
                    }
                }
                if selectedProvider != "ollama" {
                    SecureField("API key", text: $apiKey).textContentType(.password)
                }
                Button("Connect and Discover Models") { Task { await connect() } }
                    .disabled(isWorking || (selectedProvider != "ollama" && apiKey.isEmpty))
            }
            if let errorMessage { Section { Text(errorMessage).foregroundStyle(.red) } }
        }
        .scrollContentBackground(.hidden).background(Color.cream)
        .navigationTitle("AI Providers")
        .task { await load() }
    }

    private func load() async {
        do {
            let response: ProvidersResponse = try await APIClient.shared.request(.get, "/api/providers")
            connections = response.connections
            defaultProvider = response.defaultProvider
        } catch { errorMessage = error.localizedDescription }
    }

    private func connect() async {
        struct Payload: Encodable { let action = "connect"; let provider: String; let apiKey: String? }
        isWorking = true
        defer { isWorking = false }
        do {
            try await APIClient.shared.requestVoid(
                .post, "/api/providers",
                body: Payload(provider: selectedProvider, apiKey: selectedProvider == "ollama" ? nil : apiKey)
            )
            apiKey = ""
            await load()
        } catch { errorMessage = error.localizedDescription }
    }

    private func setDefault(_ provider: String) async {
        struct Payload: Encodable { let action = "setDefault"; let provider: String }
        do {
            try await APIClient.shared.requestVoid(.post, "/api/providers", body: Payload(provider: provider))
            defaultProvider = provider
        } catch { errorMessage = error.localizedDescription }
    }
}
