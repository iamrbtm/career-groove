import Observation
import SwiftUI

@MainActor
@Observable
final class DashboardViewModel {
    var applications: [Application] = []
    var jobs: [Job] = []
    var documents: [Document] = []
    var commandSession: CommandSession?
    var isLoading = false
    var errorMessage: String?

    func load() async {
        guard !isLoading else { return }
        isLoading = true
        defer { isLoading = false }
        do {
            async let applicationRequest = APIApplications().list()
            async let jobRequest = APIJobs().list()
            async let documentRequest = APIDocuments().list()
            async let sessionRequest: CommandSessionResponse = APIClient.shared.request(.get, "/api/command-sessions")
            let results = try await (applicationRequest, jobRequest, documentRequest, sessionRequest)
            applications = results.0
            jobs = results.1
            documents = results.2
            commandSession = results.3.session
            errorMessage = nil
        } catch { errorMessage = error.localizedDescription }
    }
}

struct DashboardView: View {
    @State private var model = DashboardViewModel()

    var body: some View {
        ScrollView {
            LazyVStack(alignment: .leading, spacing: 18) {
                PageHeadingView("Today’s Mix", subtitle: "Your next useful career moves")
                if model.isLoading && model.applications.isEmpty {
                    LoadingState().frame(height: 240)
                } else if let error = model.errorMessage, model.applications.isEmpty {
                    ErrorState(message: error) { Task { await model.load() } }.frame(height: 300)
                } else {
                    metrics
                    commandCard
                    hotOpportunities
                    quickTools
                }
            }
            .padding()
        }
        .background(Color.cream)
        .navigationTitle("Dashboard")
        .navigationBarTitleDisplayMode(.inline)
        .refreshable { await model.load() }
        .task { await model.load() }
    }

    private var metrics: some View {
        HStack(spacing: 10) {
            metric(value: model.applications.count, title: "Active", color: .coral)
            metric(value: model.applications.filter { $0.status == .interviewing }.count, title: "Interviews", color: .sun)
            metric(value: model.documents.count, title: "Documents", color: .mint)
        }
    }

    private func metric(value: Int, title: String, color: Color) -> some View {
        VStack(alignment: .leading, spacing: 3) {
            Text(value, format: .number).font(.title2.bold()).foregroundStyle(Color.ink)
            Text(title).font(.caption).foregroundStyle(Color.plum).lineLimit(1).minimumScaleFactor(0.8)
            Rectangle().fill(color).frame(height: 3)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .grooveCard()
    }

    @ViewBuilder private var commandCard: some View {
        if let session = model.commandSession {
            VStack(alignment: .leading, spacing: 12) {
                HStack {
                    Label(session.title, systemImage: "slider.horizontal.3")
                        .font(.headline).foregroundStyle(Color.ink)
                    Spacer()
                    StatusPill(text: session.mode.capitalized, color: .mint)
                }
                ForEach(session.actions.prefix(3)) { action in
                    HStack(alignment: .top) {
                        Image(systemName: action.status == "completed" ? "checkmark.circle.fill" : "circle")
                            .foregroundStyle(action.status == "completed" ? Color.mint : Color.plum)
                        Text(action.title).font(.subheadline).foregroundStyle(Color.ink)
                    }
                }
                NavigationLink("Open command session") { CommandSessionView(session: session) }
                    .font(.subheadline.bold())
            }
            .grooveCard()
        } else {
            NavigationLink { CommandSessionView(session: nil) } label: {
                Label("Build today’s command session", systemImage: "wand.and.stars")
                    .font(.headline).frame(maxWidth: .infinity, minHeight: 48)
            }
            .buttonStyle(PrimaryButtonStyle())
        }
    }

    private var hotOpportunities: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("Hot Opportunities").font(.title3.bold()).foregroundStyle(Color.ink)
            if model.applications.isEmpty {
                Text("Add an opportunity to start prioritizing your pipeline.")
                    .font(.subheadline).foregroundStyle(Color.plum)
            } else {
                ForEach(model.applications.sorted {
                    ($0.latestScore?.fit ?? 0) > ($1.latestScore?.fit ?? 0)
                }.prefix(4)) { application in
                    NavigationLink {
                        ApplicationDetailView(applicationID: application.id)
                    } label: {
                        HStack {
                            VStack(alignment: .leading) {
                                Text(application.title).font(.headline).foregroundStyle(Color.ink).lineLimit(1)
                                Text(application.company).font(.subheadline).foregroundStyle(Color.plum)
                            }
                            Spacer()
                            if let fit = application.latestScore?.fit {
                                Text("\(fit)%").font(.headline.monospacedDigit()).foregroundStyle(Color.ink)
                            }
                            Image(systemName: "chevron.right").foregroundStyle(Color.plum)
                        }
                        .contentShape(Rectangle())
                    }
                    Divider()
                }
            }
        }
        .grooveCard()
    }

    private var quickTools: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("Quick Tools").font(.title3.bold()).foregroundStyle(Color.ink)
            HStack(spacing: 10) {
                NavigationLink { MockInterviewView() } label: {
                    Label("Mock Interview", systemImage: "mic").frame(maxWidth: .infinity, minHeight: 48)
                }
                .buttonStyle(.bordered)
                NavigationLink { AIStudioView() } label: {
                    Label("AI Studio", systemImage: "doc.badge.gearshape").frame(maxWidth: .infinity, minHeight: 48)
                }
                .buttonStyle(.bordered)
            }
            .tint(.ink)
        }
    }
}
