import Foundation
import Observation
import UIKit
import UserNotifications

@MainActor
@Observable
final class NotificationManager {
    static let shared = NotificationManager()
    var isEnabled = false
    var registrationError: String?
    private var deviceToken: String?

    let categories = [
        "interview_reminder",
        "application_follow_up",
        "document_status",
        "command_session_action",
        "subscription_status",
    ]

    func requestAuthorization() async {
        do {
            isEnabled = try await UNUserNotificationCenter.current()
                .requestAuthorization(options: [.alert, .badge, .sound])
            if isEnabled { UIApplication.shared.registerForRemoteNotifications() }
        } catch { registrationError = error.localizedDescription }
    }

    func refreshAuthorizationStatus() async {
        let settings = await UNUserNotificationCenter.current().notificationSettings()
        isEnabled = settings.authorizationStatus == .authorized
            || settings.authorizationStatus == .provisional
        if isEnabled { UIApplication.shared.registerForRemoteNotifications() }
    }

    func setDeviceToken(_ value: String) {
        deviceToken = value
        Task { await sync() }
    }

    func sync() async {
        guard let deviceToken else { return }
        struct Payload: Encodable {
            let deviceToken: String
            let environment: String
            let enabledCategories: [String]
            let appVersion: String
            let locale: String
        }
        #if DEBUG
        let environment = "sandbox"
        #else
        let environment = "production"
        #endif
        let version = Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "1"
        do {
            try await APIClient.shared.requestVoid(
                .put,
                "/api/mobile/push-devices",
                body: Payload(
                    deviceToken: deviceToken,
                    environment: environment,
                    enabledCategories: categories,
                    appVersion: version,
                    locale: Locale.current.identifier
                )
            )
        } catch APIError.unauthorized {
            return
        } catch {
            registrationError = error.localizedDescription
        }
    }
}

@MainActor
@Observable
final class NotificationRouter {
    static let shared = NotificationRouter()
    var pendingPath: String?
    func open(_ path: String) { pendingPath = path }
    func consume() { pendingPath = nil }
}
