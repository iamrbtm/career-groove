import SwiftUI

struct ResidencesView: View {
    @State private var items: [Residence] = []
    @State private var showsAdd = false
    @State private var errorMessage: String?
    var body: some View {
        List {
            ForEach(items) { residence in
                VStack(alignment: .leading) {
                    Text(residence.label ?? "Residence").font(.headline)
                    Text(address(residence)).font(.subheadline).foregroundStyle(Color.plum)
                }
            }
            .onDelete { offsets in
                for offset in offsets {
                    let item = items[offset]
                    Task {
                        do {
                            try await APIClient.shared.requestVoid(.delete, "/api/residences/\(item.id)")
                            items.removeAll { $0.id == item.id }
                        } catch { errorMessage = error.localizedDescription }
                    }
                }
            }
        }
        .scrollContentBackground(.hidden).background(Color.cream)
        .navigationTitle("Residences")
        .toolbar { Button { showsAdd = true } label: { Image(systemName: "plus") } }
        .sheet(isPresented: $showsAdd) { NavigationStack { ResidenceForm { await load() } } }
        .task { await load() }
    }
    private func address(_ item: Residence) -> String {
        ["street", "city", "region", "country"].compactMap { item.address[$0]?.stringValue }.joined(separator: ", ")
    }
    private func load() async {
        do {
            let response: ResidencesResponse = try await APIClient.shared.request(.get, "/api/residences")
            items = response.residences
        } catch { errorMessage = error.localizedDescription }
    }
}

struct ResidenceForm: View {
    @Environment(\.dismiss) private var dismiss
    let onSaved: () async -> Void
    @State private var label = ""
    @State private var street = ""
    @State private var city = ""
    @State private var region = ""
    @State private var country = ""
    @State private var postalCode = ""
    @State private var errorMessage: String?
    var body: some View {
        Form {
            Section("Address") {
                TextField("Label", text: $label)
                TextField("Street", text: $street)
                TextField("City", text: $city)
                TextField("State or region", text: $region)
                TextField("Postal code", text: $postalCode)
                TextField("Country", text: $country)
            }
            if let errorMessage { Text(errorMessage).foregroundStyle(.red) }
        }
        .navigationTitle("Add Residence").navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
            ToolbarItem(placement: .confirmationAction) {
                Button("Save") {
                    struct Payload: Encodable {
                        let label: String; let street: String; let city: String
                        let region: String; let country: String; let postalCode: String
                    }
                    Task {
                        do {
                            try await APIClient.shared.requestVoid(
                                .post, "/api/residences",
                                body: Payload(label: label, street: street, city: city, region: region, country: country, postalCode: postalCode)
                            )
                            await onSaved(); dismiss()
                        } catch { errorMessage = error.localizedDescription }
                    }
                }.disabled(label.isEmpty || street.isEmpty || city.isEmpty || country.isEmpty)
            }
        }
    }
}

struct CredentialsView: View {
    @State private var items: [Credential] = []
    @State private var showsAdd = false
    @State private var errorMessage: String?
    var body: some View {
        List {
            ForEach(items) { credential in
                VStack(alignment: .leading) {
                    Text(credential.name).font(.headline)
                    Text([credential.kind.capitalized, credential.issuer].compactMap { $0 }.joined(separator: " · "))
                        .font(.subheadline).foregroundStyle(Color.plum)
                }
            }
            .onDelete { offsets in
                for offset in offsets {
                    let item = items[offset]
                    Task {
                        do {
                            try await APIClient.shared.requestVoid(.delete, "/api/credentials/\(item.id)")
                            items.removeAll { $0.id == item.id }
                        } catch { errorMessage = error.localizedDescription }
                    }
                }
            }
        }
        .scrollContentBackground(.hidden).background(Color.cream)
        .navigationTitle("Credentials")
        .toolbar { Button { showsAdd = true } label: { Image(systemName: "plus") } }
        .sheet(isPresented: $showsAdd) { NavigationStack { CredentialForm { await load() } } }
        .task { await load() }
    }
    private func load() async {
        do {
            let response: CredentialsResponse = try await APIClient.shared.request(.get, "/api/credentials")
            items = response.credentials
        } catch { errorMessage = error.localizedDescription }
    }
}

struct CredentialForm: View {
    @Environment(\.dismiss) private var dismiss
    let onSaved: () async -> Void
    @State private var kind = "certification"
    @State private var name = ""
    @State private var issuer = ""
    @State private var errorMessage: String?
    var body: some View {
        Form {
            Picker("Type", selection: $kind) {
                ForEach(["license", "education", "certification"], id: \.self) { Text($0.capitalized).tag($0) }
            }
            TextField("Name", text: $name)
            TextField("Issuer", text: $issuer)
            if let errorMessage { Text(errorMessage).foregroundStyle(.red) }
        }
        .navigationTitle("Add Credential").navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
            ToolbarItem(placement: .confirmationAction) {
                Button("Save") {
                    struct Payload: Encodable {
                        let kind: String; let name: String; let issuer: String
                        let details: [String: JSONValue] = [:]
                    }
                    Task {
                        do {
                            try await APIClient.shared.requestVoid(
                                .post, "/api/credentials", body: Payload(kind: kind, name: name, issuer: issuer)
                            )
                            await onSaved(); dismiss()
                        } catch { errorMessage = error.localizedDescription }
                    }
                }.disabled(name.isEmpty)
            }
        }
    }
}

struct SkillsView: View {
    @State private var items: [Skill] = []
    @State private var errorMessage: String?
    var body: some View {
        List {
            Section {
                Text("Skills are added from your career chapters and can be refined here.")
                    .font(.subheadline).foregroundStyle(Color.plum)
            }
            ForEach($items) { $skill in
                VStack(alignment: .leading, spacing: 8) {
                    TextField("Skill", text: $skill.name)
                    Stepper("Proficiency: \(skill.proficiency)", value: $skill.proficiency, in: 1...5)
                    Button("Save") { Task { await save(skill) } }.font(.caption.bold())
                }.padding(.vertical, 4)
            }
            .onDelete { offsets in
                for offset in offsets {
                    let item = items[offset]
                    Task {
                        do {
                            try await APIClient.shared.requestVoid(.delete, "/api/skills/\(item.id)")
                            items.removeAll { $0.id == item.id }
                        } catch { errorMessage = error.localizedDescription }
                    }
                }
            }
        }
        .scrollContentBackground(.hidden).background(Color.cream)
        .navigationTitle("Skills")
        .task { await load() }
    }
    private func load() async {
        do {
            let response: SkillsResponse = try await APIClient.shared.request(.get, "/api/skills")
            items = response.skills
        } catch { errorMessage = error.localizedDescription }
    }
    private func save(_ skill: Skill) async {
        struct Payload: Encodable { let name: String; let proficiency: Int; let category: String }
        do {
            try await APIClient.shared.requestVoid(
                .patch, "/api/skills/\(skill.id)",
                body: Payload(name: skill.name, proficiency: skill.proficiency, category: skill.category)
            )
        } catch { errorMessage = error.localizedDescription }
    }
}
