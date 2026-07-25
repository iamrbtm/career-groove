import SwiftUI

struct ApplicationDetailView: View {
    enum Tab: String, CaseIterable { case overview, activity, interviews, outcomes, documents }
    let applicationID: String
    @State private var detail: ApplicationDetailResponse?
    @State private var selectedTab: Tab = .overview
    @State private var isLoading = false
    @State private var errorMessage: String?
    @State private var showsNote = false
    @State private var showsInterview = false
    @State private var showsOutcome = false

    var body: some View {
        Group {
            if isLoading && detail == nil { LoadingState() }
            else if let errorMessage, detail == nil { ErrorState(message: errorMessage) { Task { await load() } } }
            else if let detail {
                ScrollView {
                    VStack(alignment: .leading, spacing: 16) {
                        PageHeadingView(detail.application.title, subtitle: detail.application.company)
                        Picker("Section", selection: $selectedTab) {
                            ForEach(Tab.allCases, id: \.self) { Text($0.rawValue.capitalized).tag($0) }
                        }
                        .pickerStyle(.menu)
                        tabContent(detail)
                    }
                    .padding()
                }
            }
        }
        .background(Color.cream)
        .navigationTitle("Application")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItemGroup(placement: .primaryAction) {
                Menu {
                    Button("Add note", systemImage: "note.text.badge.plus") { showsNote = true }
                    Button("Add interview", systemImage: "calendar.badge.plus") { showsInterview = true }
                    Button("Log outcome", systemImage: "flag.checkered") { showsOutcome = true }
                } label: { Image(systemName: "plus.circle") }
            }
        }
        .sheet(isPresented: $showsNote) { NavigationStack { ApplicationNoteForm(applicationID: applicationID) { await load() } } }
        .sheet(isPresented: $showsInterview) { NavigationStack { InterviewForm(applicationID: applicationID) { await load() } } }
        .sheet(isPresented: $showsOutcome) { NavigationStack { OutcomeForm(applicationID: applicationID) { await load() } } }
        .task { await load() }
    }

    @ViewBuilder private func tabContent(_ detail: ApplicationDetailResponse) -> some View {
        switch selectedTab {
        case .overview:
            VStack(alignment: .leading, spacing: 14) {
                HStack {
                    StatusPill(text: detail.application.status.title, color: .coral)
                    if let label = detail.application.priorityLabel {
                        StatusPill(text: label.replacingOccurrences(of: "_", with: " ").capitalized, color: .sun)
                    }
                }
                if let score = detail.application.latestScore {
                    VStack(alignment: .leading, spacing: 8) {
                        Text("Career DJ Score").font(.headline)
                        scoreRow("Fit", score.fit); scoreRow("Readiness", score.readiness)
                        Text(score.nextAction).font(.subheadline).foregroundStyle(Color.plum)
                    }.grooveCard()
                }
                Text(detail.application.description).font(.body).foregroundStyle(Color.ink)
            }
        case .activity:
            itemList(detail.events, empty: "No activity yet") { event in
                VStack(alignment: .leading) {
                    Text(event.title).font(.headline)
                    if let body = event.body { Text(body).font(.subheadline).foregroundStyle(Color.plum) }
                    Text(event.occurredAt.careerDate).font(.caption).foregroundStyle(Color.plum)
                }
            }
        case .interviews:
            itemList(detail.interviews, empty: "No interviews scheduled") { interview in
                VStack(alignment: .leading) {
                    Text(interview.roundType.capitalized).font(.headline)
                    Text(interview.scheduledAt?.careerDate ?? "Date not set").foregroundStyle(Color.plum)
                    if let interviewer = interview.interviewer { Text(interviewer).font(.subheadline) }
                }
            }
        case .outcomes:
            itemList(detail.outcomes, empty: "No outcomes logged") { outcome in
                VStack(alignment: .leading) {
                    Text(outcome.outcome.replacingOccurrences(of: "_", with: " ").capitalized).font(.headline)
                    if let note = outcome.userNote { Text(note).foregroundStyle(Color.plum) }
                    Text(outcome.occurredAt.careerDate).font(.caption).foregroundStyle(Color.plum)
                }
            }
        case .documents:
            itemList(detail.documents, empty: "No documents linked") { document in
                HStack {
                    Image(systemName: "doc.text").foregroundStyle(Color.coral)
                    VStack(alignment: .leading) {
                        Text(document.title ?? document.kind.capitalized).font(.headline)
                        Text(document.status.capitalized).font(.caption).foregroundStyle(Color.plum)
                    }
                }
            }
        }
    }

    private func scoreRow(_ title: String, _ value: Int) -> some View {
        HStack {
            Text(title).font(.subheadline)
            ProgressView(value: Double(value), total: 100).tint(.mint)
            Text("\(value)").font(.caption.monospacedDigit())
        }
    }

    private func itemList<T: Identifiable, Content: View>(
        _ items: [T], empty: String, @ViewBuilder row: (T) -> Content
    ) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            if items.isEmpty { Text(empty).foregroundStyle(Color.plum) }
            ForEach(items) { item in row(item).frame(maxWidth: .infinity, alignment: .leading).grooveCard() }
        }
    }

    private func load() async {
        isLoading = true
        defer { isLoading = false }
        do { detail = try await APIApplications().detail(id: applicationID); errorMessage = nil }
        catch { errorMessage = error.localizedDescription }
    }
}
