import SwiftUI

struct ApplicationPreferences: Codable {
    var desiredTitles: [String] = []
    var workModes: [String] = []
    var salaryTarget: Int?
    var locationPreference: String?
    var industries: [String] = []
    var values: [String] = []
    var redFlags: [String] = []
    var weeklyPace: Int?
    var defaultFollowUpDays: Int = 7
}

struct ApplicationPreferencesView: View {
    @State private var preferences = ApplicationPreferences()
    @State private var titles = ""
    @State private var industries = ""
    @State private var values = ""
    @State private var redFlags = ""
    @State private var isSaving = false
    @State private var message: String?

    var body: some View {
        Form {
            Section("Targets") {
                TextField("Desired titles, separated by commas", text: $titles, axis: .vertical)
                TextField("Location preference", text: Binding(
                    get: { preferences.locationPreference ?? "" },
                    set: { preferences.locationPreference = $0 }
                ))
                TextField("Salary target", value: $preferences.salaryTarget, format: .number)
                    .keyboardType(.numberPad)
            }
            Section("Work Modes") {
                ForEach(["remote", "hybrid", "onsite", "flexible"], id: \.self) { mode in
                    Toggle(mode.capitalized, isOn: Binding(
                        get: { preferences.workModes.contains(mode) },
                        set: { enabled in
                            if enabled { preferences.workModes.append(mode) }
                            else { preferences.workModes.removeAll { $0 == mode } }
                        }
                    ))
                }
            }
            Section("Fit") {
                TextField("Industries, separated by commas", text: $industries, axis: .vertical)
                TextField("Values, separated by commas", text: $values, axis: .vertical)
                TextField("Red flags, separated by commas", text: $redFlags, axis: .vertical)
            }
            Section("Pace") {
                Stepper("Weekly applications: \(preferences.weeklyPace ?? 0)", value: Binding(
                    get: { preferences.weeklyPace ?? 0 },
                    set: { preferences.weeklyPace = $0 }
                ), in: 0...50)
                Stepper("Follow up after \(preferences.defaultFollowUpDays) days", value: $preferences.defaultFollowUpDays, in: 1...60)
            }
            Section {
                Button("Save Preferences") { Task { await save() } }.disabled(isSaving)
            }
        }
        .scrollContentBackground(.hidden).background(Color.cream)
        .navigationTitle("Preferences")
        .task { await load() }
        .alert("Preferences", isPresented: Binding(get: { message != nil }, set: { if !$0 { message = nil } })) {
            Button("OK") {}
        } message: { Text(message ?? "") }
    }

    private func split(_ value: String) -> [String] {
        value.split(separator: ",").map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }.filter { !$0.isEmpty }
    }

    private func load() async {
        struct Response: Decodable { let preferences: ApplicationPreferences }
        do {
            let response: Response = try await APIClient.shared.request(.get, "/api/application-preferences")
            preferences = response.preferences
            titles = preferences.desiredTitles.joined(separator: ", ")
            industries = preferences.industries.joined(separator: ", ")
            values = preferences.values.joined(separator: ", ")
            redFlags = preferences.redFlags.joined(separator: ", ")
        } catch { message = error.localizedDescription }
    }

    private func save() async {
        struct Response: Decodable { let preferences: ApplicationPreferences }
        isSaving = true
        defer { isSaving = false }
        preferences.desiredTitles = split(titles)
        preferences.industries = split(industries)
        preferences.values = split(values)
        preferences.redFlags = split(redFlags)
        do {
            let _: Response = try await APIClient.shared.request(
                .patch, "/api/application-preferences", body: preferences
            )
            message = "Preferences saved."
        } catch { message = error.localizedDescription }
    }
}
