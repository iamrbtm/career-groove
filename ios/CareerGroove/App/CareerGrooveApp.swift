import SwiftUI

@main
struct CareerGrooveApp: App {
    @UIApplicationDelegateAdaptor(AppDelegate.self) private var appDelegate
    @State private var auth = AuthManager()

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environment(auth)
                .tint(.coral)
                .preferredColorScheme(.light)
                .task { await auth.restore() }
        }
    }
}
