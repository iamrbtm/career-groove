import Foundation

struct Job: Codable, Identifiable, Hashable, Sendable {
    let id: String
    var company: String
    var title: String
    var location: String?
    var startedOn: String?
    var endedOn: String?
    var current: Bool
    var rawNotes: String?
    var achievements: [String]
    var metadata: [String: JSONValue]?
    var createdAt: String?
}

struct JobsResponse: Codable, Sendable { let jobs: [Job] }
struct JobResponse: Codable, Sendable { let job: Job }

struct JobPayload: Encodable, Sendable {
    let company: String
    let title: String
    let location: String
    let startedOn: String
    let endedOn: String
    let current: Bool
    let rawNotes: String
    let achievements: [String]
    let metadata: [String: JSONValue]
    let inferredSkills: [InferredSkill]
}

struct InferredSkill: Codable, Hashable, Sendable {
    let name: String
    let category: String
}
