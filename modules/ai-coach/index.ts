import { requireOptionalNativeModule } from 'expo-modules-core';

/**
 * Raw native interface for the on-device AI coach (Apple FoundationModels).
 * Optional — resolves to `null` when the native build isn't present (web, or before
 * prebuild), so callers must guard. Prefer the `coachNarrator` wrapper which handles
 * availability and the templated fallback.
 */
export interface AiCoachNativeModule {
  /** 'available' when the on-device model can run now; otherwise a reason string. */
  availability(): Promise<string>;
  /**
   * Given JSON `{ facts, candidates:[{index,headline,body}] }`, returns JSON
   * `[{ index, headline, body }]` of chosen, rewritten cards — or null when the
   * model can't run.
   */
  generateReport(payloadJson: string): Promise<string | null>;
}

export default requireOptionalNativeModule<AiCoachNativeModule>('AiCoach');
