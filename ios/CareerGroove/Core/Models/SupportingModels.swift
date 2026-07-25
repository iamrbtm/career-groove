import Foundation

struct Contact: Codable, Identifiable, Hashable, Sendable {
    let id: String
    var jobId: String?
    var name: String
    var company: String?
    var role: String?
    var email: String?
    var phone: String?
    var relationshipStrength: Int
    var notes: [JSONValue]?
    var links: [String: JSONValue]?
    var createdAt: String?
}
struct ContactsResponse: Codable, Sendable { let contacts: [Contact] }
struct ContactResponse: Codable, Sendable { let contact: Contact }

struct Document: Codable, Identifiable, Hashable, Sendable {
    let id: String
    let kind: String
    let title: String
    let content: [String: JSONValue]
    let targetJob: [String: JSONValue]
    let createdAt: String?
    var text: String { content["text"]?.stringValue ?? "" }
}
struct DocumentsResponse: Codable, Sendable { let documents: [Document] }

struct DocumentJob: Codable, Identifiable, Hashable, Sendable {
    let id: String
    let kind: String
    let status: String
    let targetJob: [String: JSONValue]
    let result: [String: JSONValue]
    let error: String?
    let attempts: Int?
    let createdAt: String
    let completedAt: String?
}
struct DocumentJobsResponse: Codable, Sendable { let jobs: [DocumentJob] }

struct Residence: Codable, Identifiable, Hashable, Sendable {
    let id: String
    var label: String?
    var address: [String: JSONValue]
    var startedOn: String?
    var endedOn: String?
    var metadata: [String: JSONValue]?
}
struct ResidencesResponse: Codable, Sendable { let residences: [Residence] }

struct Credential: Codable, Identifiable, Hashable, Sendable {
    let id: String
    let kind: String
    let name: String
    let issuer: String?
    let issuedOn: String?
    let expiresOn: String?
    let details: [String: JSONValue]
}
struct CredentialsResponse: Codable, Sendable { let credentials: [Credential] }

struct Skill: Codable, Identifiable, Hashable, Sendable {
    let id: String
    var name: String
    var proficiency: Int
    var category: String
}
struct SkillsResponse: Codable, Sendable { let skills: [Skill] }

struct ProviderConnection: Codable, Identifiable, Hashable, Sendable {
    let provider: String
    let keyHint: String?
    let baseUrl: String?
    let selectedModel: String?
    let models: [ProviderModel]
    let active: Bool
    let lastCheckedAt: String?
    let lastError: String?

    var id: String { provider }
}
struct ProviderModel: Codable, Identifiable, Hashable, Sendable {
    let id: String
    let label: String?
}
struct ProvidersResponse: Codable, Sendable {
    let connections: [ProviderConnection]
    let defaultProvider: String?
}

struct CommandSession: Codable, Identifiable, Hashable, Sendable {
    let id: String
    let mode: String
    let status: String
    let title: String
    let recap: [String: JSONValue]
    let startedAt: String
    let finishedAt: String?
    let actions: [CommandAction]
}
struct CommandAction: Codable, Identifiable, Hashable, Sendable {
    let id: String
    let applicationId: String?
    let actionType: String
    let title: String
    let reason: String?
    let routeTarget: String
    let status: String
    let dueAt: String?
}
struct CommandSessionResponse: Codable, Sendable { let session: CommandSession? }

struct ChatMessage: Identifiable, Codable, Hashable, Sendable {
    let id: UUID
    let role: String
    let content: String
    init(id: UUID = UUID(), role: String, content: String) {
        self.id = id
        self.role = role
        self.content = content
    }
}
