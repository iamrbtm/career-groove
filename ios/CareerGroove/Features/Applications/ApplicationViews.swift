import Observation
import SwiftUI

@MainActor
@Observable
final class ApplicationsViewModel {
    var applications: [Application] = []
    var isLoading = false
    var errorMessage: String?

    func load() async {
        isLoading = true
        defer { isLoading = false }
        do { applications = try await APIApplications().list(); errorMessage = nil }
        catch { errorMessage = error.localizedDescription }
    }

    func add(_ payload: ApplicationPayload) async throws {
        applications.insert(try await APIApplications().create(payload), at: 0)
    }
}

struct ApplicationListView: View {
    enum DisplayMode: String, CaseIterable { case pipeline = "Pipeline", list = "List" }
    @State private var model = ApplicationsViewModel()
    @State private var mode: DisplayMode = .pipeline
    @State private var showsForm = false

    var body: some View {
        VStack(spacing: 0) {
            Picker("Display", selection: $mode) {
                ForEach(DisplayMode.allCases, id: \.self) { Text($0.rawValue).tag($0) }
            }
            .pickerStyle(.segmented)
            .padding()
            Group {
                if model.isLoading && model.applications.isEmpty { LoadingState() }
                else if let error = model.errorMessage, model.applications.isEmpty {
                    ErrorState(message: error) { Task { await model.load() } }
                } else if model.applications.isEmpty {
                    EmptyStateView(icon: "rectangle.3.group", title: "No opportunities yet", message: "Add a role to build your application pipeline.")
                } else if mode == .pipeline { PipelineView(applications: model.applications) }
                else { applicationList }
            }
        }
        .background(Color.cream)
        .navigationTitle("Applications")
        .toolbar {
            ToolbarItem(placement: .primaryAction) {
                Button { showsForm = true } label: { Image(systemName: "plus") }
                    .accessibilityLabel("Add application")
            }
        }
        .sheet(isPresented: $showsForm) { NavigationStack { ApplicationFormView(model: model) } }
        .refreshable { await model.load() }
        .task { if model.applications.isEmpty { await model.load() } }
    }

    private var applicationList: some View {
        List(model.applications) { application in
            NavigationLink { ApplicationDetailView(applicationID: application.id) } label: {
                ApplicationRow(application: application)
            }
        }
        .listStyle(.plain)
        .scrollContentBackground(.hidden)
    }
}

struct PipelineView: View {
    let applications: [Application]
    private let columns: [(String, Set<ApplicationStatus>)] = [
        ("Saved", [.saved]),
        ("Preparing", [.researching, .readyToApply]),
        ("Applied", [.applied, .followUp]),
        ("Interviewing", [.interviewing]),
        ("Offer", [.offer]),
        ("Closed", [.rejected, .withdrawn]),
    ]

    var body: some View {
        ScrollView(.horizontal) {
            LazyHStack(alignment: .top, spacing: 12) {
                ForEach(columns, id: \.0) { column in
                    VStack(alignment: .leading, spacing: 10) {
                        HStack {
                            Text(column.0).font(.headline).foregroundStyle(Color.ink)
                            Spacer()
                            Text(applications.filter { column.1.contains($0.status) }.count, format: .number)
                                .font(.caption.bold()).foregroundStyle(Color.plum)
                        }
                        ForEach(applications.filter { column.1.contains($0.status) }) { application in
                            NavigationLink { ApplicationDetailView(applicationID: application.id) } label: {
                                ApplicationRow(application: application).grooveCard()
                            }
                            .buttonStyle(BouncyPressStyle())
                        }
                    }
                    .frame(width: 270)
                    .padding(.vertical, 8)
                }
            }
            .padding(.horizontal)
        }
    }
}

struct ApplicationRow: View {
    let application: Application
    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(application.title).font(.headline).foregroundStyle(Color.ink).lineLimit(2)
            Text(application.company).font(.subheadline).foregroundStyle(Color.plum).lineLimit(1)
            HStack {
                StatusPill(text: application.status.title, color: statusColor)
                Spacer()
                if let fit = application.latestScore?.fit {
                    Label("\(fit)%", systemImage: "scope").font(.caption.bold()).foregroundStyle(Color.ink)
                }
            }
        }
        .padding(.vertical, 4)
    }
    private var statusColor: Color {
        switch application.status {
        case .offer: .mint
        case .interviewing: .sun
        case .rejected, .withdrawn: .plum
        default: .coral
        }
    }
}

struct ApplicationFormView: View {
    @Environment(\.dismiss) private var dismiss
    let model: ApplicationsViewModel
    @State private var title = ""
    @State private var company = ""
    @State private var location = ""
    @State private var workMode = "unknown"
    @State private var sourceURL = ""
    @State private var description = ""
    @State private var notes = ""
    @State private var isSaving = false
    @State private var errorMessage: String?

    var body: some View {
        Form {
            Section("Opportunity") {
                TextField("Role title", text: $title)
                TextField("Company", text: $company)
                TextField("Location", text: $location)
                Picker("Work mode", selection: $workMode) {
                    ForEach(["unknown", "remote", "hybrid", "onsite", "flexible"], id: \.self) {
                        Text($0.capitalized).tag($0)
                    }
                }
            }
            Section("Source") {
                TextField("Job posting URL", text: $sourceURL).keyboardType(.URL).textInputAutocapitalization(.never)
            }
            Section("Job description") { TextEditor(text: $description).frame(minHeight: 180) }
            Section("Notes") { TextEditor(text: $notes).frame(minHeight: 90) }
            if let errorMessage { Section { Text(errorMessage).foregroundStyle(.red) } }
        }
        .navigationTitle("New Application")
        .navigationBarTitleDisplayMode(.inline)
        .scrollContentBackground(.hidden)
        .background(Color.cream)
        .toolbar {
            ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
            ToolbarItem(placement: .confirmationAction) {
                Button("Save") { save() }.disabled(title.isEmpty || company.isEmpty || description.isEmpty || isSaving)
            }
        }
    }

    private func save() {
        isSaving = true
        Task {
            defer { isSaving = false }
            do {
                try await model.add(ApplicationPayload(
                    title: title, company: company, location: location.isEmpty ? nil : location,
                    workMode: workMode, sourceUrl: sourceURL.isEmpty ? nil : sourceURL,
                    source: "iOS", description: description, notes: notes.isEmpty ? nil : notes,
                    salaryCurrency: "USD"
                ))
                dismiss()
            } catch { errorMessage = error.localizedDescription }
        }
    }
}
