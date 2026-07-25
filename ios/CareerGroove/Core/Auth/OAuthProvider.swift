import AuthenticationServices
import CryptoKit
import Foundation
import UIKit

enum OAuthMethod: String { case google, github }

@MainActor
final class OAuthProvider: NSObject, ASWebAuthenticationPresentationContextProviding {
    private var session: ASWebAuthenticationSession?

    func authenticate(method: OAuthMethod, baseURL: URL) async throws -> (code: String, state: String, verifier: String) {
        let state = Self.randomURLSafe(count: 32)
        let verifier = Self.randomURLSafe(count: 64)
        let challenge = Data(SHA256.hash(data: Data(verifier.utf8))).base64URLEncodedString()
        var components = URLComponents(
            url: URL(string: "/api/mobile/auth/oauth/start", relativeTo: baseURL)!.absoluteURL,
            resolvingAgainstBaseURL: false
        )!
        components.queryItems = [
            URLQueryItem(name: "provider", value: method.rawValue),
            URLQueryItem(name: "state", value: state),
            URLQueryItem(name: "code_challenge", value: challenge),
        ]
        guard let url = components.url else { throw APIError.invalidURL }

        let callbackURL = try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<URL, Error>) in
            let session = ASWebAuthenticationSession(url: url, callbackURLScheme: "careergroove") { [weak self] url, error in
                self?.session = nil
                if let error { continuation.resume(throwing: error); return }
                guard let url else { continuation.resume(throwing: APIError.invalidResponse); return }
                continuation.resume(returning: url)
            }
            session.presentationContextProvider = self
            session.prefersEphemeralWebBrowserSession = false
            self.session = session
            guard session.start() else {
                self.session = nil
                continuation.resume(throwing: APIError.invalidResponse)
                return
            }
        }
        guard let values = URLComponents(url: callbackURL, resolvingAgainstBaseURL: false)?.queryItems,
              let code = values.first(where: { $0.name == "code" })?.value,
              values.first(where: { $0.name == "state" })?.value == state else {
            throw APIError.unauthorized
        }
        return (code, state, verifier)
    }

    func presentationAnchor(for session: ASWebAuthenticationSession) -> ASPresentationAnchor {
        UIApplication.shared.connectedScenes
            .compactMap { $0 as? UIWindowScene }
            .flatMap(\.windows)
            .first(where: \.isKeyWindow) ?? ASPresentationAnchor()
    }

    private static func randomURLSafe(count: Int) -> String {
        var bytes = [UInt8](repeating: 0, count: count)
        _ = SecRandomCopyBytes(kSecRandomDefault, bytes.count, &bytes)
        return Data(bytes).base64URLEncodedString()
    }
}

extension Data {
    func base64URLEncodedString() -> String {
        base64EncodedString()
            .replacingOccurrences(of: "+", with: "-")
            .replacingOccurrences(of: "/", with: "_")
            .replacingOccurrences(of: "=", with: "")
    }
}
