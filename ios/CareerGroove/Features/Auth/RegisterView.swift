import SwiftUI

struct RegisterView: View {
    @Environment(\.dismiss) private var dismiss
    @Environment(AuthManager.self) private var auth
    @State private var name = ""
    @State private var email = ""
    @State private var password = ""
    @State private var confirmation = ""
    @State private var isWorking = false
    @State private var errorMessage: String?

    var body: some View {
        Form {
            Section {
                TextField("Name", text: $name).textContentType(.name)
                TextField("Email", text: $email)
                    .textContentType(.username)
                    .keyboardType(.emailAddress)
                    .textInputAutocapitalization(.never)
                    .autocorrectionDisabled()
                SecureField("Password", text: $password).textContentType(.newPassword)
                SecureField("Confirm password", text: $confirmation).textContentType(.newPassword)
            } footer: {
                Text("Use at least 10 characters with a letter and a number.")
            }
            if let validationMessage {
                Section { Label(validationMessage, systemImage: "info.circle").foregroundStyle(Color.plum) }
            }
            Section {
                Button {
                    isWorking = true
                    Task {
                        defer { isWorking = false }
                        do {
                            try await auth.register(name: name, email: email, password: password)
                            dismiss()
                        } catch { errorMessage = error.localizedDescription }
                    }
                } label: {
                    HStack {
                        Text("Create Account")
                        Spacer()
                        if isWorking { ProgressView() }
                    }
                }
                .disabled(validationMessage != nil || isWorking)
            }
        }
        .scrollContentBackground(.hidden)
        .background(Color.cream)
        .navigationTitle("Create Account")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar { ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } } }
        .alert("Account Not Created", isPresented: Binding(
            get: { errorMessage != nil },
            set: { if !$0 { errorMessage = nil } }
        )) { Button("OK", role: .cancel) {} } message: { Text(errorMessage ?? "") }
    }

    private var validationMessage: String? {
        if name.trimmingCharacters(in: .whitespaces).count < 2 { return "Enter your name." }
        if !email.contains("@") { return "Enter a valid email address." }
        if password.count < 10 || !password.contains(where: \.isLetter) || !password.contains(where: \.isNumber) {
            return "Choose a stronger password."
        }
        if confirmation != password { return "Passwords do not match." }
        return nil
    }
}
