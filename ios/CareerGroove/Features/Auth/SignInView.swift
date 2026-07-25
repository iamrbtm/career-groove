import SwiftUI

struct SignInView: View {
    @Environment(AuthManager.self) private var auth
    @State private var email = ""
    @State private var password = ""
    @State private var isWorking = false
    @State private var showsRegistration = false
    @State private var errorMessage: String?

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 24) {
                    VStack(alignment: .leading, spacing: 8) {
                        Image(systemName: "chart.bar.fill")
                            .font(.system(size: 44, weight: .bold))
                            .foregroundStyle(Color.coral)
                        Text("Career Groove").font(.largeTitle.bold()).foregroundStyle(Color.ink)
                        Text("Pick up where your career left off.")
                            .font(.body).foregroundStyle(Color.plum)
                    }
                    .padding(.top, 40)

                    VStack(spacing: 14) {
                        TextField("Email", text: $email)
                            .textContentType(.username)
                            .keyboardType(.emailAddress)
                            .textInputAutocapitalization(.never)
                            .autocorrectionDisabled()
                            .submitLabel(.next)
                        SecureField("Password", text: $password)
                            .textContentType(.password)
                            .submitLabel(.go)
                            .onSubmit(signIn)
                    }
                    .textFieldStyle(.roundedBorder)

                    Button(action: signIn) {
                        Group {
                            if isWorking { ProgressView().tint(.ink) }
                            else { Text("Sign In") }
                        }
                    }
                    .buttonStyle(PrimaryButtonStyle())
                    .disabled(!canSubmit || isWorking)

                    providers

                    Button("Create an account") { showsRegistration = true }
                        .font(.headline)
                        .frame(maxWidth: .infinity)
                        .foregroundStyle(Color.ink)

                    HStack(spacing: 16) {
                        Link("Privacy", destination: URL(string: "https://careergroove.website/privacy")!)
                        Link("Terms", destination: URL(string: "https://careergroove.website/terms")!)
                    }
                    .font(.footnote)
                    .frame(maxWidth: .infinity)
                }
                .frame(maxWidth: 480)
                .padding(24)
                .frame(maxWidth: .infinity)
            }
            .background(Color.cream.ignoresSafeArea())
            .sheet(isPresented: $showsRegistration) { NavigationStack { RegisterView() } }
            .alert("Sign In Failed", isPresented: Binding(
                get: { errorMessage != nil },
                set: { if !$0 { errorMessage = nil } }
            )) { Button("OK", role: .cancel) {} } message: { Text(errorMessage ?? "") }
        }
    }

    @ViewBuilder private var providers: some View {
        if let methods = auth.capabilities {
            VStack(spacing: 10) {
                HStack {
                    Rectangle().frame(height: 1).foregroundStyle(Color.ink.opacity(0.15))
                    Text("OR").font(.caption.bold()).foregroundStyle(Color.plum)
                    Rectangle().frame(height: 1).foregroundStyle(Color.ink.opacity(0.15))
                }
                if methods.apple {
                    AppleSignInButton { run { try await auth.signInWithApple() } }
                        .frame(height: 50)
                }
                if methods.google {
                    providerButton("Continue with Google", icon: "g.circle", method: .google)
                }
                if methods.github {
                    providerButton("Continue with GitHub", icon: "chevron.left.forwardslash.chevron.right", method: .github)
                }
                if methods.passkey {
                    Button { run { try await auth.signInWithPasskey() } } label: {
                        Label("Sign in with a passkey", systemImage: "person.badge.key")
                            .frame(maxWidth: .infinity, minHeight: 46)
                    }
                    .buttonStyle(.bordered)
                    .tint(.ink)
                    .disabled(isWorking)
                }
            }
        }
    }

    private func providerButton(_ title: String, icon: String, method: OAuthMethod) -> some View {
        Button { run { try await auth.signIn(method: method) } } label: {
            Label(title, systemImage: icon).frame(maxWidth: .infinity, minHeight: 46)
        }
        .buttonStyle(.bordered)
        .tint(.ink)
        .disabled(isWorking)
    }

    private var canSubmit: Bool { email.contains("@") && password.count >= 8 }
    private func signIn() { run { try await auth.signIn(email: email, password: password) } }
    private func run(_ operation: @escaping () async throws -> Void) {
        guard !isWorking else { return }
        isWorking = true
        Task {
            defer { isWorking = false }
            do { try await operation() }
            catch { errorMessage = error.localizedDescription }
        }
    }
}
