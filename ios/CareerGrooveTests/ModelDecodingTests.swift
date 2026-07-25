import XCTest
@testable import CareerGroove

final class ModelDecodingTests: XCTestCase {
    func testDecodesApplicationList() throws {
        let data = Data("""
        {
          "applications": [{
            "id": "83c688b0-7612-4691-bc94-54c5600c1111",
            "status": "interviewing",
            "title": "Product Designer",
            "company": "Example",
            "salaryCurrency": "USD",
            "description": "Design useful workflows.",
            "createdAt": "2026-07-24T10:00:00.000Z",
            "updatedAt": "2026-07-24T10:00:00.000Z",
            "latestScore": null
          }]
        }
        """.utf8)
        let response = try JSONDecoder().decode(ApplicationsResponse.self, from: data)
        XCTAssertEqual(response.applications.first?.status, .interviewing)
        XCTAssertEqual(response.applications.first?.company, "Example")
    }

    func testJSONValueRoundTrip() throws {
        let value: JSONValue = .object([
            "enabled": .bool(true),
            "count": .number(3),
            "tags": .array([.string("swift")]),
        ])
        let data = try JSONEncoder().encode(value)
        XCTAssertEqual(try JSONDecoder().decode(JSONValue.self, from: data), value)
    }

    func testTokenResponseBuildsPair() throws {
        let data = Data("""
        {
          "accessToken": "cg_access_test",
          "refreshToken": "cg_refresh_test",
          "accessTokenExpiresAt": "2026-07-24T10:15:00.000Z",
          "refreshTokenExpiresAt": "2026-08-23T10:00:00.000Z",
          "user": {"id":"83c688b0-7612-4691-bc94-54c5600c1111","email":"person@example.com"}
        }
        """.utf8)
        let response = try JSONDecoder().decode(SignInResponse.self, from: data)
        XCTAssertEqual(response.tokens.refreshToken, "cg_refresh_test")
        XCTAssertEqual(response.user.email, "person@example.com")
    }
}
