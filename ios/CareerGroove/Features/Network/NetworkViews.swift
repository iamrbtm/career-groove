import Observation
import SwiftUI

@MainActor
@Observable
final class NetworkViewModel {
    var contacts: [Contact] = []
    var isLoading = false
    var errorMessage: String?

    func load() async {
        isLoading = true
        defer { isLoading = false }
        do { contacts = try await APIContacts().list(); errorMessage = nil }
        catch { errorMessage = error.localizedDescription }
    }

    func add(_ payload: APIContacts.Payload) async throws {
        let contact = try await APIContacts().create(payload)
        contacts.append(contact)
        contacts.sort { $0.name.localizedCaseInsensitiveCompare($1.name) == .orderedAscending }
    }

    func delete(_ contact: Contact) async throws {
        try await APIContacts().delete(id: contact.id)
        contacts.removeAll { $0.id == contact.id }
    }
}

struct ContactListView: View {
    @State private var model = NetworkViewModel()
    @State private var query = ""
    @State private var showsForm = false

    var body: some View {
        Group {
            if model.isLoading && model.contacts.isEmpty { LoadingState() }
            else if let error = model.errorMessage, model.contacts.isEmpty {
                ErrorState(message: error) { Task { await model.load() } }
            } else if filtered.isEmpty {
                EmptyStateView(icon: "person.2", title: query.isEmpty ? "Build your network" : "No matches", message: query.isEmpty ? "Keep useful professional relationships in one place." : "Try another name or company.")
            } else {
                List(filtered) { contact in
                    NavigationLink { ContactDetailView(contact: contact, model: model) } label: {
                        HStack(spacing: 12) {
                            Text(contact.name.prefix(1).uppercased())
                                .font(.headline).frame(width: 40, height: 40)
                                .background(Color.mint.opacity(0.25)).clipShape(Circle())
                            VStack(alignment: .leading) {
                                Text(contact.name).font(.headline).foregroundStyle(Color.ink)
                                Text([contact.role, contact.company].compactMap { $0 }.joined(separator: " · "))
                                    .font(.subheadline).foregroundStyle(Color.plum).lineLimit(1)
                            }
                            Spacer()
                            Text(String(repeating: "•", count: contact.relationshipStrength))
                                .foregroundStyle(Color.coral).accessibilityLabel("Relationship strength \(contact.relationshipStrength) of 5")
                        }
                        .padding(.vertical, 4)
                    }
                }
                .listStyle(.plain).scrollContentBackground(.hidden)
            }
        }
        .background(Color.cream)
        .navigationTitle("Network")
        .searchable(text: $query, prompt: "Name or company")
        .toolbar {
            ToolbarItem(placement: .primaryAction) {
                Button { showsForm = true } label: { Image(systemName: "person.badge.plus") }
                    .accessibilityLabel("Add contact")
            }
        }
        .sheet(isPresented: $showsForm) { NavigationStack { ContactFormView(model: model) } }
        .refreshable { await model.load() }
        .task { if model.contacts.isEmpty { await model.load() } }
    }

    private var filtered: [Contact] {
        guard !query.isEmpty else { return model.contacts }
        return model.contacts.filter {
            $0.name.localizedCaseInsensitiveContains(query)
                || ($0.company?.localizedCaseInsensitiveContains(query) ?? false)
        }
    }
}

struct ContactDetailView: View {
    @Environment(\.dismiss) private var dismiss
    let contact: Contact
    let model: NetworkViewModel

    var body: some View {
        List {
            Section {
                VStack(alignment: .leading, spacing: 6) {
                    Text(contact.name).font(.title.bold())
                    Text([contact.role, contact.company].compactMap { $0 }.joined(separator: " · "))
                        .foregroundStyle(Color.plum)
                }.padding(.vertical, 8)
            }
            Section("Contact") {
                if let email = contact.email, let url = URL(string: "mailto:\(email)") {
                    Link(destination: url) { Label(email, systemImage: "envelope") }
                }
                if let phone = contact.phone, let url = URL(string: "tel:\(phone.filter { $0.isNumber || $0 == "+" })") {
                    Link(destination: url) { Label(phone, systemImage: "phone") }
                }
            }
            Section("Relationship") {
                LabeledContent("Strength", value: "\(contact.relationshipStrength) of 5")
            }
            Section {
                Button("Delete Contact", role: .destructive) {
                    Task { try? await model.delete(contact); dismiss() }
                }
            }
        }
        .scrollContentBackground(.hidden).background(Color.cream)
        .navigationTitle("Contact")
        .navigationBarTitleDisplayMode(.inline)
    }
}

struct ContactFormView: View {
    @Environment(\.dismiss) private var dismiss
    let model: NetworkViewModel
    @State private var name = ""
    @State private var company = ""
    @State private var role = ""
    @State private var email = ""
    @State private var phone = ""
    @State private var strength = 3
    @State private var note = ""
    @State private var isSaving = false
    @State private var errorMessage: String?

    var body: some View {
        Form {
            Section("Contact") {
                TextField("Name", text: $name)
                TextField("Company", text: $company)
                TextField("Role", text: $role)
                TextField("Email", text: $email).keyboardType(.emailAddress).textInputAutocapitalization(.never)
                TextField("Phone", text: $phone).keyboardType(.phonePad)
            }
            Section("Relationship") {
                Stepper("Strength: \(strength)", value: $strength, in: 1...5)
                TextEditor(text: $note).frame(minHeight: 100)
            }
            if let errorMessage { Section { Text(errorMessage).foregroundStyle(.red) } }
        }
        .navigationTitle("New Contact").navigationBarTitleDisplayMode(.inline)
        .scrollContentBackground(.hidden).background(Color.cream)
        .toolbar {
            ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
            ToolbarItem(placement: .confirmationAction) {
                Button("Save") {
                    isSaving = true
                    Task {
                        defer { isSaving = false }
                        do {
                            try await model.add(.init(
                                name: name, company: company, role: role, email: email,
                                phone: phone, relationshipStrength: strength, note: note
                            ))
                            dismiss()
                        } catch { errorMessage = error.localizedDescription }
                    }
                }.disabled(name.isEmpty || isSaving)
            }
        }
    }
}
