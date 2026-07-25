import Foundation

enum APIError: LocalizedError, Equatable {
    case invalidURL
    case invalidResponse
    case unauthorized
    case server(status: Int, message: String)
    case decoding(String)
    case transport(String)

    var errorDescription: String? {
        switch self {
        case .invalidURL: "The server address is invalid."
        case .invalidResponse: "The server returned an invalid response."
        case .unauthorized: "Your session has expired. Sign in again."
        case .server(_, let message): message
        case .decoding: "Career Groove received data it could not read."
        case .transport: "The server could not be reached. Check your connection and try again."
        }
    }
}

struct APIErrorBody: Decodable {
    let error: JSONValue?

    var message: String? {
        switch error {
        case .string(let value): value
        case .object: "Some information needs your attention."
        default: nil
        }
    }
}
