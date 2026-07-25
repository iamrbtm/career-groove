import StoreKit
import SwiftUI
import UIKit

struct SettingsListView: View {
    @Environment(\.dismiss) private var dismiss
    @Environment(AuthManager.self) private var auth

    var body: some View {
        List {
            Section {
                NavigationLink { ProfileEditView() } label: {
                    Label(auth.user?.name ?? auth.user?.email ?? "Profile", systemImage: "person.crop.circle")
                }
            }
            Section("Career Setup") {
                NavigationLink { AIProvidersView() } label: { Label("AI Providers", systemImage: "sparkles") }
                NavigationLink { ApplicationPreferencesView() } label: { Label("Application Preferences", systemImage: "slider.horizontal.3") }
                NavigationLink { ResidencesView() } label: { Label("Residences", systemImage: "house") }
                NavigationLink { CredentialsView() } label: { Label("Credentials", systemImage: "checkmark.seal") }
                NavigationLink { SkillsView() } label: { Label("Skills", systemImage: "hammer") }
            }
            Section("App") {
                NavigationLink { NotificationSettingsView() } label: { Label("Notifications", systemImage: "bell") }
                NavigationLink { MusicPlayerView() } label: { Label("Music Player", systemImage: "music.note") }
                NavigationLink { BillingView() } label: { Label("Billing", systemImage: "creditcard") }
            }
            Section("Legal") {
                Link(destination: URL(string: "https://careergroove.website/privacy")!) { Label("Privacy", systemImage: "hand.raised") }
                Link(destination: URL(string: "https://careergroove.website/terms")!) { Label("Terms", systemImage: "doc.plaintext") }
            }
            Section {
                Button("Sign Out", role: .destructive) { Task { await auth.signOut(); dismiss() } }
                NavigationLink { DeleteAccountView() } label: {
                    Label("Delete Account", systemImage: "trash")
                }
                .foregroundStyle(.red)
            }
            Section {
                LabeledContent("Version", value: Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "1.0")
            }
        }
        .scrollContentBackground(.hidden).background(Color.cream)
        .navigationTitle("Settings")
        .toolbar { ToolbarItem(placement: .confirmationAction) { Button("Done") { dismiss() } } }
    }
}

struct DeleteAccountView: View {
    @Environment(\.dismiss) private var dismiss
    @Environment(AuthManager.self) private var auth
    @State private var confirmation = ""
    @State private var isDeleting = false
    @State private var errorMessage: String?

    var body: some View {
        Form {
            Section {
                Text("This permanently deletes your Career Groove account and career data. Web subscriptions are canceled. App Store subscriptions must be managed through Apple.")
                    .foregroundStyle(Color.ink)
            }
            Section {
                TextField("Type DELETE", text: $confirmation)
                    .textInputAutocapitalization(.characters)
                    .autocorrectionDisabled()
            } header: { Text("Confirmation") }
            Section {
                Button("Permanently Delete Account", role: .destructive) {
                    isDeleting = true
                    Task {
                        defer { isDeleting = false }
                        do {
                            try await auth.deleteAccount()
                            dismiss()
                        } catch { errorMessage = error.localizedDescription }
                    }
                }
                .disabled(confirmation != "DELETE" || isDeleting)
            }
            if let errorMessage { Section { Text(errorMessage).foregroundStyle(.red) } }
        }
        .scrollContentBackground(.hidden).background(Color.cream)
        .navigationTitle("Delete Account")
    }
}

struct ProfileEditView: View {
    @Environment(AuthManager.self) private var auth
    @State private var name = ""
    @State private var phone = ""
    @State private var isSaving = false
    @State private var message: String?

    var body: some View {
        Form {
            Section("Profile") {
                TextField("Name", text: $name).textContentType(.name)
                TextField("Phone", text: $phone).textContentType(.telephoneNumber).keyboardType(.phonePad)
                LabeledContent("Email", value: auth.user?.email ?? "")
            }
            Section {
                Button("Save Profile") {
                    isSaving = true
                    Task {
                        defer { isSaving = false }
                        struct Payload: Encodable { let name: String; let phone: String }
                        do {
                            let _: ProfileResponse = try await APIClient.shared.request(
                                .patch, "/api/profile", body: Payload(name: name, phone: phone)
                            )
                            message = "Profile saved."
                        } catch { message = error.localizedDescription }
                    }
                }.disabled(name.count < 2 || isSaving)
            }
        }
        .scrollContentBackground(.hidden).background(Color.cream)
        .navigationTitle("Profile")
        .task {
            if name.isEmpty {
                do {
                    let response: ProfileResponse = try await APIClient.shared.request(.get, "/api/profile")
                    name = response.profile.name ?? ""
                    phone = response.profile.phone ?? ""
                } catch { message = error.localizedDescription }
            }
        }
        .alert("Profile", isPresented: Binding(get: { message != nil }, set: { if !$0 { message = nil } })) {
            Button("OK") {}
        } message: { Text(message ?? "") }
    }
}

struct MusicPlayerView: View {
    var body: some View {
        ContentUnavailableView {
            Label("Music Player Disabled", systemImage: "speaker.slash")
        } description: {
            Text("No licensed audio source is configured for this release.")
        }
        .background(Color.cream)
        .navigationTitle("Music Player")
    }
}

struct NotificationSettingsView: View {
    @State private var manager = NotificationManager.shared
    var body: some View {
        List {
            Section {
                Toggle("Allow Notifications", isOn: Binding(
                    get: { manager.isEnabled },
                    set: { enabled in
                        if enabled {
                            Task { await manager.requestAuthorization() }
                        } else if let url = URL(string: UIApplication.openSettingsURLString) {
                            UIApplication.shared.open(url)
                        }
                    }
                ))
            }
            Section("Notification Types") {
                Label("Interview reminders", systemImage: "calendar")
                Label("Application follow-ups", systemImage: "arrow.uturn.forward")
                Label("Document status", systemImage: "doc.badge.clock")
                Label("Command session actions", systemImage: "checklist")
                Label("Subscription status", systemImage: "creditcard")
            }
            if let error = manager.registrationError { Section { Text(error).foregroundStyle(.red) } }
        }
        .scrollContentBackground(.hidden).background(Color.cream)
        .navigationTitle("Notifications")
        .task { await manager.refreshAuthorizationStatus() }
    }
}

struct BillingView: View {
    @Environment(AuthManager.self) private var auth
    @State private var store = StoreKitManager.shared

    var body: some View {
        List {
            if store.isLoading {
                HStack { Spacer(); ProgressView(); Spacer() }
            } else if store.products.isEmpty {
                ContentUnavailableView(
                    "Subscriptions Unavailable",
                    systemImage: "creditcard",
                    description: Text("App Store products will appear after they are configured in App Store Connect.")
                )
            } else {
                Section("Career Groove Pro") {
                    ForEach(store.products) { product in
                        VStack(alignment: .leading, spacing: 8) {
                            HStack {
                                VStack(alignment: .leading) {
                                    Text(product.displayName).font(.headline)
                                    Text(product.description).font(.subheadline).foregroundStyle(Color.plum)
                                }
                                Spacer()
                                Text(product.displayPrice).font(.headline)
                            }
                            Button(store.purchasedProductIDs.contains(product.id) ? "Active" : "Subscribe") {
                                if let id = auth.user?.id { Task { await store.purchase(product, userID: id) } }
                            }
                            .buttonStyle(.borderedProminent)
                            .disabled(store.purchasedProductIDs.contains(product.id))
                        }.padding(.vertical, 6)
                    }
                }
                Section {
                    Button("Restore Purchases") { Task { await store.restore() } }
                    Button("Manage Subscription") {
                        Task {
                            if let scene = UIApplication.shared.connectedScenes.first as? UIWindowScene {
                                try? await AppStore.showManageSubscriptions(in: scene)
                            }
                        }
                    }
                }
            }
            if let error = store.errorMessage { Section { Text(error).foregroundStyle(.red) } }
        }
        .scrollContentBackground(.hidden).background(Color.cream)
        .navigationTitle("Billing")
        .task { await store.load() }
    }
}
