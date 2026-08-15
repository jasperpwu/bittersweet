import ExpoModulesCore

#if canImport(FoundationModels)
  import FoundationModels
#endif

/**
 * On-device narration for the AI Focus Coach using Apple's FoundationModels
 * framework (iOS 26+, Apple-Intelligence devices).
 *
 * The JS engine computes everything and builds fully-grounded candidate cards; this
 * module only lets the on-device model *select and rewrite the prose*. It never
 * invents actions or numbers — it returns the chosen candidates' original indices
 * plus rewritten headline/body. Resolves null (or reports unavailability) whenever the
 * model can't run, so JS falls back to the templated narrator.
 */
public class AiCoachModule: Module {
  public func definition() -> ModuleDefinition {
    Name("AiCoach")

    // Whether the on-device model can be used right now.
    AsyncFunction("availability") { () -> String in
      #if canImport(FoundationModels)
        if #available(iOS 26.0, *) {
          switch SystemLanguageModel.default.availability {
          case .available:
            return "available"
          case .unavailable(let reason):
            switch reason {
            case .deviceNotEligible: return "device_not_eligible"
            case .appleIntelligenceNotEnabled: return "not_enabled"
            case .modelNotReady: return "model_not_ready"
            @unknown default: return "unavailable"
            }
          @unknown default:
            return "unavailable"
          }
        } else {
          return "unsupported_os"
        }
      #else
        return "unsupported_os"
      #endif
    }

    // Input: JSON { facts, candidates:[{index,headline,body}] }.
    // Output: JSON [{ index:Int, headline:String, body:String }], or null when unavailable.
    AsyncFunction("generateReport") { (payloadJson: String, promise: Promise) in
      #if canImport(FoundationModels)
        if #available(iOS 26.0, *) {
          Task {
            do {
              let json = try await AiCoachGenerator.generate(payloadJson: payloadJson)
              promise.resolve(json)
            } catch {
              promise.reject("ERR_AI_COACH", error.localizedDescription)
            }
          }
        } else {
          promise.resolve(nil)
        }
      #else
        promise.resolve(nil)
      #endif
    }
  }
}

#if canImport(FoundationModels)
  @available(iOS 26.0, *)
  enum AiCoachGenerator {
    @Generable
    struct CoachCardOut {
      @Guide(description: "The 0-based index of the chosen candidate insight")
      let index: Int
      @Guide(description: "A short, warm, specific headline under 8 words")
      let headline: String
      @Guide(description: "One or two encouraging, concrete sentences grounded in the facts")
      let body: String
    }

    @Generable
    struct CoachOutput {
      @Guide(.maximumCount(3))
      let cards: [CoachCardOut]
    }

    static func generate(payloadJson: String) async throws -> String {
      let session = LanguageModelSession(
        instructions: """
          You are a supportive, concise focus coach inside a productivity app. You receive \
          this week's stats and a numbered list of candidate insights (each with its index). \
          Choose the 1-3 most important and rewrite each as a warm, specific, encouraging \
          headline and body. Keep headlines under 8 words. Only use the numbers provided — \
          never invent statistics. Write the headline and body in the same language as the \
          candidate insights you are given. Return the original index of each chosen insight.
          """
      )

      let promptText = "This week's data and candidate insights as JSON:\n\(payloadJson)"

      let response = try await session.respond(
        to: Prompt(promptText),
        generating: CoachOutput.self,
        options: GenerationOptions(temperature: 0.6)
      )

      let arr: [[String: Any]] = response.content.cards.map {
        ["index": $0.index, "headline": $0.headline, "body": $0.body]
      }
      let data = try JSONSerialization.data(withJSONObject: arr, options: [])
      return String(data: data, encoding: .utf8) ?? "[]"
    }
  }
#endif
