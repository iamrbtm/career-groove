import Foundation

struct User: Codable, Identifiable, Hashable, Sendable {
    let id: String
    var name: String?
    let email: String
    var image: String?
    var phone: String?
    var createdAt: String?
}

struct ProfileResponse: Codable, Sendable { let profile: User }

struct AuthCapabilities: Codable, Sendable {
    struct Methods: Codable, Sendable {
        let credentials: Bool
        let apple: Bool
        let google: Bool
        let github: Bool
        let passkey: Bool
    }
    let methods: Methods
}

struct TokenPair: Codable, Sendable {
    let accessToken: String
    let refreshToken: String
    let accessTokenExpiresAt: String
    let refreshTokenExpiresAt: String
}

struct SignInResponse: Codable, Sendable {
    let accessToken: String
    let refreshToken: String
    let accessTokenExpiresAt: String
    let refreshTokenExpiresAt: String
    let user: User

    var tokens: TokenPair {
        TokenPair(
            accessToken: accessToken,
            refreshToken: refreshToken,
            accessTokenExpiresAt: accessTokenExpiresAt,
            refreshTokenExpiresAt: refreshTokenExpiresAt
        )
    }
}
