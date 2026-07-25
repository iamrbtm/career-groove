import Foundation

enum ApplicationStatus: String, Codable, CaseIterable, Identifiable, Sendable {
    case saved, researching, readyToApply = "ready_to_apply", applied, followUp = "follow_up"
    case interviewing, offer, rejected, withdrawn, archived

    var id: String { rawValue }
    var title: String {
        switch self {
        case .readyToApply: "Ready"
        case .followUp: "Follow Up"
        default: rawValue.replacingOccurrences(of: "_", with: " ").capitalized
        }
    }
}

struct ApplicationScore: Codable, Identifiable, Hashable, Sendable {
    let id: String
    let label: String
    let fit: Int
    let readiness: Int
    let desire: Int
    let leverage: Int
    let risk: Int
    let timing: Int
    let reasons: [String]
    let gaps: [String]
    let nextAction: String
    let createdAt: String?
}

struct Application: Codable, Identifiable, Hashable, Sendable {
    let id: String
    var status: ApplicationStatus
    var title: String
    var company: String
    var location: String?
    var workMode: String?
    var salaryMin: Int?
    var salaryMax: Int?
    var salaryCurrency: String
    var sourceUrl: String?
    var source: String?
    var description: String
    var notes: String?
    var priorityLabel: String?
    var nextActionType: String?
    var nextActionReason: String?
    var followUpDueAt: String?
    var appliedAt: String?
    var archivedAt: String?
    var metadata: [String: JSONValue]?
    var createdAt: String
    var updatedAt: String
    var latestScore: ApplicationScore?
}

struct ApplicationsResponse: Codable, Sendable { let applications: [Application] }

struct ApplicationPayload: Encodable, Sendable {
    let title: String
    let company: String
    let location: String?
    let workMode: String?
    let sourceUrl: String?
    let source: String?
    let description: String
    let notes: String?
    let salaryCurrency: String
}

struct ApplicationEvent: Codable, Identifiable, Hashable, Sendable {
    let id: String
    let eventType: String
    let title: String
    let body: String?
    let occurredAt: String
    let createdAt: String?
}

struct ApplicationInterview: Codable, Identifiable, Hashable, Sendable {
    let id: String
    let roundType: String
    let scheduledAt: String?
    let interviewer: String?
    let meetingLink: String?
    let prepStatus: String
    let notes: String?
    let createdAt: String?
}

struct ApplicationOutcome: Codable, Identifiable, Hashable, Sendable {
    let id: String
    let outcome: String
    let stage: String?
    let reason: String?
    let userNote: String?
    let occurredAt: String
    let createdAt: String?
}

struct ApplicationDetailResponse: Codable, Sendable {
    let application: Application
    let events: [ApplicationEvent]
    let contacts: [ApplicationContact]
    let documents: [ApplicationDocument]
    let interviews: [ApplicationInterview]
    let outcomes: [ApplicationOutcome]
}

struct ApplicationContact: Codable, Identifiable, Hashable, Sendable {
    let id: String
    let name: String?
    let company: String?
    let role: String?
    let email: String?
    let phone: String?
    let relationship: String?
    let notes: String?
}

struct ApplicationDocument: Codable, Identifiable, Hashable, Sendable {
    let id: String
    let documentGenerationJobId: String?
    let documentId: String?
    let kind: String
    let title: String?
    let status: String
    let submittedAt: String?
    let createdAt: String?
}
