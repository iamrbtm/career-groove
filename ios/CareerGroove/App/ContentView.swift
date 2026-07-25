import SwiftUI

struct ContentView: View {
    @Environment(AuthManager.self) private var auth

    var body: some View {
        Group {
            switch auth.state {
            case .restoring: LaunchView()
            case .signedOut: SignInView()
            case .signedIn: AppShellView()
            }
        }
        .background(Color.cream.ignoresSafeArea())
        .animation(.easeInOut(duration: 0.2), value: auth.state)
    }
}

private struct LaunchView: View {
    var body: some View {
        VStack(spacing: 16) {
            Image(systemName: "chart.bar.fill").font(.system(size: 42)).foregroundStyle(Color.coral)
            Text("Career Groove").font(.title.bold()).foregroundStyle(Color.ink)
            ProgressView().tint(.coral)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}

enum AppDestination: String, CaseIterable, Identifiable {
    case dashboard, journey, applications, network, documents
    var id: String { rawValue }
    var title: String { rawValue.capitalized }
    var icon: String {
        switch self {
        case .dashboard: "square.grid.2x2"
        case .journey: "point.topleft.down.to.point.bottomright.curvepath"
        case .applications: "rectangle.3.group"
        case .network: "person.2"
        case .documents: "doc.text"
        }
    }
}

private struct ApplicationDeepLink: Identifiable {
    let id: String
}

struct AppShellView: View {
    @Environment(\.horizontalSizeClass) private var sizeClass
    @State private var selection: AppDestination = .dashboard
    @State private var showsSettings = false
    @State private var notificationRouter = NotificationRouter.shared
    @State private var notificationApplication: ApplicationDeepLink?

    var body: some View {
        Group {
            if sizeClass == .regular {
                NavigationSplitView {
                    List(AppDestination.allCases, selection: $selection) { destination in
                        Label(destination.title, systemImage: destination.icon).tag(destination)
                    }
                    .navigationTitle("Career Groove")
                    .safeAreaInset(edge: .bottom) {
                        Button { showsSettings = true } label: {
                            Label("Settings", systemImage: "gearshape").frame(maxWidth: .infinity, alignment: .leading)
                        }
                        .padding()
                    }
                } detail: { destinationView(selection) }
            } else {
                TabView(selection: $selection) {
                    ForEach(AppDestination.allCases) { destination in
                        destinationView(destination)
                            .tabItem { Label(destination.title, systemImage: destination.icon) }
                            .tag(destination)
                    }
                }
                .safeAreaInset(edge: .top, alignment: .trailing) {
                    Button { showsSettings = true } label: {
                        Image(systemName: "gearshape.fill").frame(width: 44, height: 44)
                    }
                    .background(.thinMaterial)
                    .clipShape(Circle())
                    .padding(.trailing, 12)
                    .accessibilityLabel("Settings")
                }
            }
        }
        .sheet(isPresented: $showsSettings) { NavigationStack { SettingsListView() } }
        .sheet(item: $notificationApplication) { application in
            NavigationStack { ApplicationDetailView(applicationID: application.id) }
        }
        .task { await NotificationManager.shared.sync() }
        .onChange(of: notificationRouter.pendingPath) { _, path in
            guard let path else { return }
            if path.hasPrefix("/applications/") {
                selection = .applications
                notificationApplication = ApplicationDeepLink(id: String(path.dropFirst("/applications/".count)))
            } else if path == "/documents" {
                selection = .documents
            } else if path.hasPrefix("/settings") {
                showsSettings = true
            }
            notificationRouter.consume()
        }
    }

    @ViewBuilder private func destinationView(_ destination: AppDestination) -> some View {
        switch destination {
        case .dashboard: NavigationStack { DashboardView() }
        case .journey: NavigationStack { JourneyListView() }
        case .applications: NavigationStack { ApplicationListView() }
        case .network: NavigationStack { ContactListView() }
        case .documents: NavigationStack { DocumentListView() }
        }
    }
}
