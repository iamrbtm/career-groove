import AuthenticationServices
import Foundation
import UIKit

struct PasskeyOptions: Decodable {
    let requestId: String
    let challenge: String
    let relyingPartyIdentifier: String
}

struct PasskeyAssertionPayload: Encodable {
    struct Response: Encodable {
        let authenticatorData: String
        let clientDataJSON: String
        let signature: String
        let userHandle: String?
    }
    let requestId: String
    let id: String
    let rawId: String
    let type = "public-key"
    let response: Response
    let deviceName: String
}

@MainActor
final class PasskeyManager: NSObject,
    ASAuthorizationControllerDelegate,
    ASAuthorizationControllerPresentationContextProviding {
    private var continuation: CheckedContinuation<ASAuthorizationPlatformPublicKeyCredentialAssertion, Error>?

    func assertion(options: PasskeyOptions) async throws -> PasskeyAssertionPayload {
        guard let challenge = Data(base64URLEncoded: options.challenge) else { throw APIError.invalidResponse }
        let provider = ASAuthorizationPlatformPublicKeyCredentialProvider(
            relyingPartyIdentifier: options.relyingPartyIdentifier
        )
        let request = provider.createCredentialAssertionRequest(challenge: challenge)
        let controller = ASAuthorizationController(authorizationRequests: [request])
        controller.delegate = self
        controller.presentationContextProvider = self
        let credential = try await withCheckedThrowingContinuation { continuation in
            self.continuation = continuation
            controller.performRequests()
        }
        let credentialID = credential.credentialID.base64URLEncodedString()
        return PasskeyAssertionPayload(
            requestId: options.requestId,
            id: credentialID,
            rawId: credentialID,
            response: .init(
                authenticatorData: credential.rawAuthenticatorData.base64URLEncodedString(),
                clientDataJSON: credential.rawClientDataJSON.base64URLEncodedString(),
                signature: credential.signature.base64URLEncodedString(),
                userHandle: credential.userID.isEmpty ? nil : credential.userID.base64URLEncodedString()
            ),
            deviceName: UIDevice.current.name
        )
    }

    func authorizationController(controller: ASAuthorizationController, didCompleteWithAuthorization authorization: ASAuthorization) {
        guard let credential = authorization.credential as? ASAuthorizationPlatformPublicKeyCredentialAssertion else {
            continuation?.resume(throwing: APIError.invalidResponse)
            continuation = nil
            return
        }
        continuation?.resume(returning: credential)
        continuation = nil
    }

    func authorizationController(controller: ASAuthorizationController, didCompleteWithError error: Error) {
        continuation?.resume(throwing: error)
        continuation = nil
    }

    func presentationAnchor(for controller: ASAuthorizationController) -> ASPresentationAnchor {
        UIApplication.shared.connectedScenes
            .compactMap { $0 as? UIWindowScene }
            .flatMap(\.windows)
            .first(where: \.isKeyWindow) ?? ASPresentationAnchor()
    }
}

private extension Data {
    init?(base64URLEncoded value: String) {
        var input = value.replacingOccurrences(of: "-", with: "+").replacingOccurrences(of: "_", with: "/")
        input += String(repeating: "=", count: (4 - input.count % 4) % 4)
        self.init(base64Encoded: input)
    }
}
