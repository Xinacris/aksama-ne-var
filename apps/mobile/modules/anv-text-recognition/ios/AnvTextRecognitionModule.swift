import ExpoModulesCore
import Vision

// On-device text recognition for "Ekran görüntüsünden oku", with Turkish. Based on
// expo-text-extractor's iOS module (MIT, github.com/pchalupa/expo-text-extractor), which runs Vision
// with its default language (English) and so reads "ş" as "s". This one asks Vision for Turkish
// first, when this iPhone's Vision offers it (Apple doesn't publish the list per iOS version, so it
// is checked on the device), with English next and language correction on. Linked unless the build
// sets ANV_IOS_TR_OCR=0 (plugins/withTurkishOcr.js); the app then falls back to expo-text-extractor.

public class AnvTextRecognitionModule: Module {
  static let wanted = ["tr-TR", "en-US"]

  public func definition() -> ModuleDefinition {
    Name("AnvTextRecognition")

    Constants([
      "isSupported": true
    ])

    // The languages this device's Vision will use for the request (for the app's own check).
    Function("recognitionLanguages") { () -> [String] in
      return AnvTextRecognitionModule.languages(for: VNRecognizeTextRequest())
    }

    AsyncFunction("extractTextFromImage") { (url: URL, promise: Promise) in
      do {
        let imageData = try Data(contentsOf: url)
        let image = UIImage(data: imageData)
        guard let cgImage = image?.cgImage else {
          throw Exception(name: "err", description: "The image could not be read")
        }

        let requestHandler = VNImageRequestHandler(cgImage: cgImage)
        let request = VNRecognizeTextRequest { (request, error) in
          guard let observations = request.results as? [VNRecognizedTextObservation] else {
            return promise.resolve([])
          }
          let recognizedTexts = observations.compactMap { observation in
            observation.topCandidates(1).first?.string
          }
          promise.resolve(recognizedTexts)
        }
        request.recognitionLevel = .accurate
        request.usesLanguageCorrection = true
        let languages = AnvTextRecognitionModule.languages(for: request)
        if !languages.isEmpty {
          request.recognitionLanguages = languages
        }

        try requestHandler.perform([request])
      } catch {
        promise.reject(error)
      }
    }
  }

  // Turkish and English, in that order, as far as this device supports them; empty = Vision's default.
  static func languages(for request: VNRecognizeTextRequest) -> [String] {
    request.recognitionLevel = .accurate
    guard let supported = try? request.supportedRecognitionLanguages() else { return [] }
    return wanted.filter { supported.contains($0) }
  }
}
