import Foundation
import Observation
import StoreKit

@MainActor
@Observable
final class StoreKitManager {
    static let shared = StoreKitManager()
    static let productIDs = [
        "com.careergroove.careergroove.pro.monthly",
        "com.careergroove.careergroove.pro.yearly",
    ]

    var products: [Product] = []
    var purchasedProductIDs: Set<String> = []
    var isLoading = false
    var errorMessage: String?
    private var updatesTask: Task<Void, Never>?

    init() {
        updatesTask = observeTransactions()
    }

    deinit { updatesTask?.cancel() }

    func load() async {
        isLoading = true
        defer { isLoading = false }
        do {
            products = try await Product.products(for: Self.productIDs).sorted { $0.price < $1.price }
            await refreshEntitlements()
        } catch { errorMessage = error.localizedDescription }
    }

    func purchase(_ product: Product, userID: String) async {
        guard let accountToken = UUID(uuidString: userID) else {
            errorMessage = "This account cannot be linked to an App Store purchase."
            return
        }
        do {
            let result = try await product.purchase(options: [.appAccountToken(accountToken)])
            switch result {
            case .success(let verification):
                let transaction = try verified(verification)
                try await sync(verification.jwsRepresentation)
                await transaction.finish()
                await refreshEntitlements()
            case .pending: errorMessage = "The purchase is awaiting approval."
            case .userCancelled: break
            @unknown default: break
            }
        } catch { errorMessage = error.localizedDescription }
    }

    func restore() async {
        do {
            try await AppStore.sync()
            await refreshEntitlements()
        } catch { errorMessage = error.localizedDescription }
    }

    private func observeTransactions() -> Task<Void, Never> {
        Task {
            for await result in Transaction.updates {
                do {
                    let transaction = try verified(result)
                    try await sync(result.jwsRepresentation)
                    await transaction.finish()
                    await refreshEntitlements()
                } catch { errorMessage = error.localizedDescription }
            }
        }
    }

    private func refreshEntitlements() async {
        var active: Set<String> = []
        for await result in Transaction.currentEntitlements {
            if let transaction = try? verified(result), transaction.revocationDate == nil {
                active.insert(transaction.productID)
                try? await sync(result.jwsRepresentation)
            }
        }
        purchasedProductIDs = active
    }

    private func sync(_ signedTransaction: String) async throws {
        struct Payload: Encodable { let signedTransaction: String }
        try await APIClient.shared.requestVoid(
            .post,
            "/api/mobile/storekit/transactions",
            body: Payload(signedTransaction: signedTransaction)
        )
    }

    private func verified<T>(_ result: VerificationResult<T>) throws -> T {
        switch result {
        case .verified(let value): value
        case .unverified: throw APIError.server(status: 400, message: "The App Store transaction could not be verified.")
        }
    }
}
