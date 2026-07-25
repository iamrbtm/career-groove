import Foundation
import Observation
import UIKit

@MainActor
@Observable
final class AuthManager {
    enum State: Equatable { case restoring, signedOut, signedIn }

    private(set) var state: State = .restoring
    private(set) var user: User?
    private(set) var capabilities: AuthCapabilities.Methods?
    var errorMessage: String?

    private let client: APIClient
    private let oauth = OAuthProvider()
    private let apple = AppleSignInProvider()
    private let passkeys = PasskeyManager()

    init(client: APIClient = .shared) { self.client = client }

    func restore() async {
        await loadCapabilities()
        guard await client.hasSession() else {
            state = .signedOut
            return
        }
        do {
            let response: ProfileResponse = try await client.request(.get, "/api/profile")
            user = response.profile
            state = .signedIn
        } catch {
            await client.clearSession()
            state = .signedOut
        }
    }

    func signIn(email: String, password: String) async throws {
        struct Payload: Encodable {
            let email: String
            let password: String
            let deviceName: String
        }
        let response: SignInResponse = try await client.request(
            .post,
            "/api/mobile/auth/signin",
            body: Payload(email: email, password: password, deviceName: UIDevice.current.name)
        )
        try await finish(response)
    }

    func register(name: String, email: String, password: String) async throws {
        struct Payload: Encodable { let name: String; let email: String; let password: String }
        struct Response: Decodable { let user: User }
        let _: Response = try await client.request(
            .post, "/api/register", body: Payload(name: name, email: email, password: password)
        )
        try await signIn(email: email, password: password)
    }

    func signIn(method: OAuthMethod) async throws {
        let result = try await oauth.authenticate(method: method, baseURL: await client.baseURL)
        struct Payload: Encodable {
            let code: String
            let state: String
            let codeVerifier: String
            let deviceName: String
        }
        let response: SignInResponse = try await client.request(
            .post,
            "/api/mobile/auth/oauth/exchange",
            body: Payload(
                code: result.code,
                state: result.state,
                codeVerifier: result.verifier,
                deviceName: UIDevice.current.name
            )
        )
        try await finish(response)
    }

    func signInWithApple() async throws {
        let authorization = try await apple.authenticate()
        struct Payload: Encodable {
            let identityToken: String
            let nonce: String
            let givenName: String?
            let familyName: String?
            let deviceName: String
        }
        let response: SignInResponse = try await client.request(
            .post,
            "/api/mobile/auth/apple",
            body: Payload(
                identityToken: authorization.identityToken,
                nonce: authorization.nonce,
                givenName: authorization.givenName,
                familyName: authorization.familyName,
                deviceName: UIDevice.current.name
            )
        )
        try await finish(response)
    }

    func signInWithPasskey() async throws {
        let options: PasskeyOptions = try await client.request(
            .post, "/api/mobile/auth/passkey/options"
        )
        let payload = try await passkeys.assertion(options: options)
        let response: SignInResponse = try await client.request(
            .post, "/api/mobile/auth/passkey/verify", body: payload
        )
        try await finish(response)
    }

    func signOut() async {
        await client.signOut()
        user = nil
        state = .signedOut
    }

    func deleteAccount() async throws {
        try await client.requestVoid(
            .delete,
            "/api/mobile/account",
            body: ["confirmation": "DELETE"]
        )
        await client.clearSession()
        user = nil
        state = .signedOut
    }

    private func finish(_ response: SignInResponse) async throws {
        try await client.store(tokens: response.tokens)
        user = response.user
        state = .signedIn
        errorMessage = nil
    }

    private func loadCapabilities() async {
        let response: AuthCapabilities? = try? await client.request(.get, "/api/mobile/auth/capabilities")
        capabilities = response?.methods
    }
}
