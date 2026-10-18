import ExpoModulesCore
import Vision
import Foundation

public class FinancialAdvisorNativeModule: Module {
  public func definition() -> ModuleDefinition {
    Name("FinancialAdvisorNative")
    AsyncFunction("recognize") { (uri: String) -> String in
      guard let url = URL(string: uri), url.isFileURL else {
        throw NSError(domain: "FinancialAdvisor", code: 1, userInfo: [NSLocalizedDescriptionKey: "Choose a local receipt image."])
      }
      let request = VNRecognizeTextRequest()
      request.recognitionLevel = .accurate
      request.recognitionLanguages = ["en-US"]
      request.usesLanguageCorrection = true
      try VNImageRequestHandler(url: url).perform([request])
      return (request.results ?? []).compactMap { $0.topCandidates(1).first?.string }.joined(separator: "\n")
    }
    AsyncFunction("updateWidgets") { (_: String) in }
    AsyncFunction("requestWidget") { return false }
  }
}
