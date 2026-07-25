import Foundation

extension String {
    var careerDate: String {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        let date = formatter.date(from: self) ?? ISO8601DateFormatter().date(from: self)
        guard let date else { return self }
        return date.formatted(date: .abbreviated, time: .omitted)
    }
}
