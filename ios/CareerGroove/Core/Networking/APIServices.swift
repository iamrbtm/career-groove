import Foundation

struct APIJobs {
    let client: APIClient = .shared
    func list() async throws -> [Job] {
        let response: JobsResponse = try await client.request(.get, "/api/jobs")
        return response.jobs
    }
    func create(_ payload: JobPayload) async throws -> Job {
        let response: JobResponse = try await client.request(.post, "/api/jobs", body: payload)
        return response.job
    }
    func delete(id: String) async throws {
        try await client.requestVoid(.delete, "/api/jobs/\(id)")
    }
}

struct APIApplications {
    let client: APIClient = .shared
    func list() async throws -> [Application] {
        let response: ApplicationsResponse = try await client.request(.get, "/api/applications")
        return response.applications
    }
    func detail(id: String) async throws -> ApplicationDetailResponse {
        try await client.request(.get, "/api/applications/\(id)")
    }
    func create(_ payload: ApplicationPayload) async throws -> Application {
        struct Response: Decodable { let application: Application }
        let response: Response = try await client.request(.post, "/api/applications", body: payload)
        return response.application
    }
    func updateStatus(id: String, status: ApplicationStatus) async throws -> Application {
        struct Payload: Encodable { let status: String }
        struct Response: Decodable { let application: Application }
        let response: Response = try await client.request(
            .patch, "/api/applications/\(id)", body: Payload(status: status.rawValue)
        )
        return response.application
    }
}

struct APIContacts {
    struct Payload: Encodable {
        let name: String
        let company: String
        let role: String
        let email: String
        let phone: String
        let relationshipStrength: Int
        let note: String
    }
    let client: APIClient = .shared
    func list() async throws -> [Contact] {
        let response: ContactsResponse = try await client.request(.get, "/api/contacts")
        return response.contacts
    }
    func create(_ payload: Payload) async throws -> Contact {
        let response: ContactResponse = try await client.request(.post, "/api/contacts", body: payload)
        return response.contact
    }
    func delete(id: String) async throws {
        try await client.requestVoid(.delete, "/api/contacts/\(id)")
    }
}

struct APIDocuments {
    struct GenerationPayload: Encodable {
        let kind: String
        let applicationId: String?
        let target: Target?
        struct Target: Encodable { let title: String; let company: String; let description: String }
    }
    let client: APIClient = .shared
    func list() async throws -> [Document] {
        let response: DocumentsResponse = try await client.request(.get, "/api/documents")
        return response.documents
    }
    func jobs() async throws -> [DocumentJob] {
        let response: DocumentJobsResponse = try await client.request(.get, "/api/document-jobs")
        return response.jobs
    }
    func generate(_ payload: GenerationPayload) async throws -> DocumentJob {
        struct Response: Decodable { let job: DocumentJob }
        let response: Response = try await client.request(.post, "/api/document-jobs", body: payload)
        return response.job
    }
}
