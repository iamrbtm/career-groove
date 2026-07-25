import Foundation

enum HTTPMethod: String { case get = "GET", post = "POST", put = "PUT", patch = "PATCH", delete = "DELETE" }

private struct AnyEncodable: Encodable {
    private let encodeValue: (Encoder) throws -> Void
    init(_ value: any Encodable) { encodeValue = value.encode }
    func encode(to encoder: Encoder) throws { try encodeValue(encoder) }
}

actor APIClient {
    static let shared = APIClient()

    let baseURL: URL
    private let session: URLSession
    private let keychain: KeychainStore
    private let encoder = JSONEncoder()
    private let decoder = JSONDecoder()
    private var refreshTask: Task<Bool, Error>?

    init(
        baseURL: URL? = nil,
        session: URLSession = .shared,
        keychain: KeychainStore = .shared
    ) {
        let configured = Bundle.main.object(forInfoDictionaryKey: "APIBaseURL") as? String
        self.baseURL = baseURL
            ?? configured.flatMap(URL.init(string:))
            ?? URL(string: "https://careergroove.website")!
        self.session = session
        self.keychain = keychain
    }

    func request<T: Decodable>(
        _ method: HTTPMethod,
        _ path: String,
        body: (any Encodable)? = nil
    ) async throws -> T {
        let data = try await perform(method, path, body: body, mayRefresh: true)
        do { return try decoder.decode(T.self, from: data) }
        catch { throw APIError.decoding(String(describing: error)) }
    }

    func requestText(
        _ method: HTTPMethod,
        _ path: String,
        body: (any Encodable)? = nil
    ) async throws -> String {
        let data = try await perform(method, path, body: body, mayRefresh: true)
        guard let text = String(data: data, encoding: .utf8) else { throw APIError.invalidResponse }
        return text
    }

    func requestVoid(
        _ method: HTTPMethod,
        _ path: String,
        body: (any Encodable)? = nil
    ) async throws {
        _ = try await perform(method, path, body: body, mayRefresh: true)
    }

    func store(tokens: TokenPair) async throws { try await keychain.store(tokens) }
    func hasSession() async -> Bool { await keychain.read(.refreshToken) != nil }
    func clearSession() async { await keychain.clear() }
    func signOut() async {
        if let refreshToken = await keychain.read(.refreshToken) {
            try? await requestVoid(
                .post,
                "/api/mobile/auth/signout",
                body: ["refreshToken": refreshToken]
            )
        }
        await keychain.clear()
    }

    private func perform(
        _ method: HTTPMethod,
        _ path: String,
        body: (any Encodable)?,
        mayRefresh: Bool
    ) async throws -> Data {
        guard let url = URL(string: path, relativeTo: baseURL)?.absoluteURL else { throw APIError.invalidURL }
        var request = URLRequest(url: url)
        request.httpMethod = method.rawValue
        request.timeoutInterval = 30
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        request.setValue("CareerGroove-iOS/1", forHTTPHeaderField: "X-Client")
        if let body {
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
            request.httpBody = try encoder.encode(AnyEncodable(body))
        }
        if let accessToken = await keychain.read(.accessToken) {
            request.setValue("Bearer \(accessToken)", forHTTPHeaderField: "Authorization")
        }

        let data: Data
        let response: URLResponse
        do { (data, response) = try await session.data(for: request) }
        catch { throw APIError.transport(String(describing: error)) }
        guard let http = response as? HTTPURLResponse else { throw APIError.invalidResponse }

        if http.statusCode == 401, mayRefresh, try await refreshTokens() {
            return try await perform(method, path, body: body, mayRefresh: false)
        }
        guard (200..<300).contains(http.statusCode) else {
            if http.statusCode == 401 {
                await keychain.clear()
                throw APIError.unauthorized
            }
            let message = (try? decoder.decode(APIErrorBody.self, from: data).message)
                ?? HTTPURLResponse.localizedString(forStatusCode: http.statusCode)
            throw APIError.server(status: http.statusCode, message: message)
        }
        return data
    }

    private func refreshTokens() async throws -> Bool {
        if let refreshTask { return try await refreshTask.value }
        let task = Task { try await self.performTokenRefresh() }
        refreshTask = task
        do {
            let result = try await task.value
            refreshTask = nil
            return result
        } catch {
            refreshTask = nil
            throw error
        }
    }

    private func performTokenRefresh() async throws -> Bool {
        guard let refreshToken = await keychain.read(.refreshToken),
              let url = URL(string: "/api/mobile/auth/refresh", relativeTo: baseURL) else { return false }
        var request = URLRequest(url: url)
        request.httpMethod = HTTPMethod.post.rawValue
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try encoder.encode(["refreshToken": refreshToken])
        let (data, response) = try await session.data(for: request)
        guard let http = response as? HTTPURLResponse, http.statusCode == 200,
              let tokens = try? decoder.decode(TokenPair.self, from: data) else {
            await keychain.clear()
            return false
        }
        try await keychain.store(tokens)
        return true
    }
}
