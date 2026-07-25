import Foundation
import Security

actor KeychainStore {
    static let shared = KeychainStore()
    private let service = "com.careergroove.careergroove.auth"

    enum Key: String {
        case accessToken
        case refreshToken
        case accessTokenExpiresAt
        case refreshTokenExpiresAt
    }

    func read(_ key: Key) -> String? {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: key.rawValue,
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne,
        ]
        var item: CFTypeRef?
        guard SecItemCopyMatching(query as CFDictionary, &item) == errSecSuccess,
              let data = item as? Data else { return nil }
        return String(data: data, encoding: .utf8)
    }

    func write(_ value: String, for key: Key) throws {
        let data = Data(value.utf8)
        let lookup: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: key.rawValue,
        ]
        let attributes: [String: Any] = [
            kSecValueData as String: data,
            kSecAttrAccessible as String: kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly,
        ]
        let status: OSStatus
        if SecItemCopyMatching(lookup as CFDictionary, nil) == errSecSuccess {
            status = SecItemUpdate(lookup as CFDictionary, attributes as CFDictionary)
        } else {
            status = SecItemAdd(lookup.merging(attributes) { _, new in new } as CFDictionary, nil)
        }
        guard status == errSecSuccess else { throw APIError.transport("Keychain error \(status)") }
    }

    func store(_ tokens: TokenPair) throws {
        try write(tokens.accessToken, for: .accessToken)
        try write(tokens.refreshToken, for: .refreshToken)
        try write(tokens.accessTokenExpiresAt, for: .accessTokenExpiresAt)
        try write(tokens.refreshTokenExpiresAt, for: .refreshTokenExpiresAt)
    }

    func clear() {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
        ]
        SecItemDelete(query as CFDictionary)
    }
}
