import AppIntents
import Foundation
import UIKit

@available(iOS 16.0, *)
struct ReviewPaymentTextIntent: AppIntent {
  static var title: LocalizedStringResource = "Review payment text"
  static var description = IntentDescription("Prepare transaction drafts from text. Review and save them in FinancialAdvisor.")
  @Parameter(title: "Payment text") var text: String
  static var openAppWhenRun: Bool = true
  @MainActor func perform() async throws -> some IntentResult {
    var link = URLComponents()
    link.scheme = "com.wacns.financialadvisor"; link.host = "capture"
    link.queryItems = [URLQueryItem(name: "text", value: String(text.prefix(20000)))]
    guard let url = link.url else { throw CaptureIntentError.invalidInput }
    guard await UIApplication.shared.open(url) else { throw CaptureIntentError.invalidInput }
    return .result()
  }
}

@available(iOS 16.0, *)
struct ReviewExpenseIntent: AppIntent {
  static var title: LocalizedStringResource = "Review expense"
  static var description = IntentDescription("Open an expense draft. This does not save a payment or move money.")
  @Parameter(title: "Amount") var amount: Double
  @Parameter(title: "Description", default: "Captured expense") var paymentDescription: String
  @Parameter(title: "Currency", default: "BHD") var currency: String
  static var openAppWhenRun: Bool = true
  @MainActor func perform() async throws -> some IntentResult {
    let supported = ["BHD", "USD", "EUR", "GBP", "SAR", "AED", "KWD", "OMR", "QAR", "INR"]
    guard amount.isFinite, amount > 0, amount <= 1000000000, supported.contains(currency.uppercased()) else { throw CaptureIntentError.invalidInput }
    var link = URLComponents()
    link.scheme = "com.wacns.financialadvisor"; link.host = "capture"
    link.queryItems = [
      URLQueryItem(name: "amount", value: String(format: "%.3f", locale: Locale(identifier: "en_US_POSIX"), amount)),
      URLQueryItem(name: "currency", value: currency.uppercased()),
      URLQueryItem(name: "name", value: String(paymentDescription.prefix(80)))
    ]
    guard let url = link.url else { throw CaptureIntentError.invalidInput }
    guard await UIApplication.shared.open(url) else { throw CaptureIntentError.invalidInput }
    return .result()
  }
}

enum CaptureIntentError: Error, LocalizedError {
  case invalidInput
  var errorDescription: String? { "Enter a positive amount and a supported three-letter currency, or use payment text." }
}

@available(iOS 16.0, *)
struct FinancialAdvisorShortcuts: AppShortcutsProvider {
  static var appShortcuts: [AppShortcut] {
    AppShortcut(intent: ReviewPaymentTextIntent(), phrases: ["Review payment in \(.applicationName)"], shortTitle: "Review payment text", systemImageName: "text.badge.plus")
    AppShortcut(intent: ReviewExpenseIntent(), phrases: ["Review expense in \(.applicationName)"], shortTitle: "Review expense", systemImageName: "creditcard")
  }
}
