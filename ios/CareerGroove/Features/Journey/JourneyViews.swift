import Observation
import SwiftUI

@MainActor
@Observable
final class JourneyViewModel {
    var jobs: [Job] = []
    var isLoading = false
    var errorMessage: String?

    func load() async {
        isLoading = true
        defer { isLoading = false }
        do { jobs = try await APIJobs().list(); errorMessage = nil }
        catch { errorMessage = error.localizedDescription }
    }

    func add(_ payload: JobPayload) async throws {
        let job = try await APIJobs().create(payload)
        jobs.insert(job, at: 0)
    }

    func delete(_ job: Job) async throws {
        try await APIJobs().delete(id: job.id)
        jobs.removeAll { $0.id == job.id }
    }
}

struct JourneyListView: View {
    @State private var model = JourneyViewModel()
    @State private var showsForm = false

    var body: some View {
        Group {
            if model.isLoading && model.jobs.isEmpty { LoadingState() }
            else if let error = model.errorMessage, model.jobs.isEmpty {
                ErrorState(message: error) { Task { await model.load() } }
            } else if model.jobs.isEmpty {
                EmptyStateView(icon: "point.topleft.down.to.point.bottomright.curvepath", title: "Your journey starts here", message: "Add a role, project, or career chapter.")
            } else {
                List {
                    ForEach(model.jobs) { job in
                        NavigationLink { JobDetailView(job: job, model: model) } label: {
                            HStack(alignment: .top, spacing: 12) {
                                Circle().fill(job.current == true ? Color.mint : Color.plum.opacity(0.35))
                                    .frame(width: 12, height: 12).padding(.top, 5)
                                VStack(alignment: .leading, spacing: 3) {
                                    Text(job.title).font(.headline).foregroundStyle(Color.ink)
                                    Text(job.company).font(.subheadline).foregroundStyle(Color.plum)
                                    Text(period(job)).font(.caption).foregroundStyle(Color.plum)
                                }
                            }
                            .padding(.vertical, 5)
                        }
                    }
                    .onDelete { offsets in
                        for offset in offsets { Task { try? await model.delete(model.jobs[offset]) } }
                    }
                }
                .listStyle(.plain)
                .scrollContentBackground(.hidden)
            }
        }
        .background(Color.cream)
        .navigationTitle("Journey")
        .toolbar {
            ToolbarItem(placement: .primaryAction) {
                Button { showsForm = true } label: { Image(systemName: "plus") }
                    .accessibilityLabel("Add career chapter")
            }
        }
        .sheet(isPresented: $showsForm) { NavigationStack { JobFormView(model: model) } }
        .refreshable { await model.load() }
        .task { if model.jobs.isEmpty { await model.load() } }
    }

    private func period(_ job: Job) -> String {
        [job.startedOn, job.current == true ? "Present" : job.endedOn].compactMap { $0 }.joined(separator: " – ")
    }
}

struct JobDetailView: View {
    @Environment(\.dismiss) private var dismiss
    let job: Job
    let model: JourneyViewModel
    @State private var showsInterview = false

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 18) {
                PageHeadingView(job.title, subtitle: job.company)
                if let location = job.location, !location.isEmpty {
                    Label(location, systemImage: "mappin.and.ellipse").foregroundStyle(Color.plum)
                }
                if let notes = job.rawNotes, !notes.isEmpty {
                    section("Story") { Text(notes).foregroundStyle(Color.ink) }
                }
                section("Achievements") {
                    if job.achievements.isEmpty { Text("No achievements saved yet.").foregroundStyle(Color.plum) }
                    else {
                        ForEach(job.achievements, id: \.self) { achievement in
                            Label(achievement, systemImage: "sparkle").foregroundStyle(Color.ink)
                        }
                    }
                }
                Button { showsInterview = true } label: {
                    Label("Open AI Interviewer", systemImage: "bubble.left.and.bubble.right")
                }
                .buttonStyle(PrimaryButtonStyle())
                Button("Delete Chapter", role: .destructive) {
                    Task { try? await model.delete(job); dismiss() }
                }
                .frame(maxWidth: .infinity)
            }
            .padding()
        }
        .background(Color.cream)
        .navigationBarTitleDisplayMode(.inline)
        .sheet(isPresented: $showsInterview) {
            NavigationStack { AIInterviewerView(job: job) }
        }
    }

    private func section<Content: View>(_ title: String, @ViewBuilder content: () -> Content) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            Text(title).font(.title3.bold()).foregroundStyle(Color.ink)
            content()
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .grooveCard()
    }
}

struct JobFormView: View {
    @Environment(\.dismiss) private var dismiss
    let model: JourneyViewModel
    @State private var company = ""
    @State private var title = ""
    @State private var location = ""
    @State private var startedOn = ""
    @State private var endedOn = ""
    @State private var current = false
    @State private var notes = ""
    @State private var isSaving = false
    @State private var errorMessage: String?

    var body: some View {
        Form {
            Section("Role") {
                TextField("Company or organization", text: $company)
                TextField("Title or chapter name", text: $title)
                TextField("Location", text: $location)
            }
            Section("Dates") {
                TextField("Start date (YYYY-MM-DD)", text: $startedOn).keyboardType(.numbersAndPunctuation)
                Toggle("I’m currently here", isOn: $current)
                if !current { TextField("End date (YYYY-MM-DD)", text: $endedOn).keyboardType(.numbersAndPunctuation) }
            }
            Section("Your story") {
                TextEditor(text: $notes).frame(minHeight: 140)
            }
            if let errorMessage { Section { Text(errorMessage).foregroundStyle(.red) } }
        }
        .navigationTitle("New Chapter")
        .navigationBarTitleDisplayMode(.inline)
        .scrollContentBackground(.hidden)
        .background(Color.cream)
        .toolbar {
            ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
            ToolbarItem(placement: .confirmationAction) {
                Button("Save") { save() }.disabled(company.isEmpty || title.isEmpty || isSaving)
            }
        }
    }

    private func save() {
        isSaving = true
        Task {
            defer { isSaving = false }
            do {
                try await model.add(JobPayload(
                    company: company, title: title, location: location, startedOn: startedOn,
                    endedOn: current ? "" : endedOn, current: current, rawNotes: notes,
                    achievements: [], metadata: [:], inferredSkills: []
                ))
                dismiss()
            } catch { errorMessage = error.localizedDescription }
        }
    }
}
