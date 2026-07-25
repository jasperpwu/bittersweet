import { requireOptionalNativeModule } from 'expo-modules-core';

/**
 * Raw native interface for the MotionInsights module. Optional — resolves to
 * `null` when the native build isn't present (e.g. before prebuild, or on a
 * platform without the module), so JS callers must guard. Prefer the wrapper in
 * `src/services/motionInsights.ts` which adds fallbacks and typing.
 */
export interface MotionInsightsNativeModule {
  /** Summarise CMMotionActivity over a window. Returns null when unavailable. */
  getMotionActivitySummary(
    startMs: number,
    endMs: number
  ): Promise<{
    stationarySec: number;
    walkingSec: number;
    runningSec: number;
    cyclingSec: number;
    automotiveSec: number;
    unknownSec: number;
    totalSec: number;
  } | null>;
}

export default requireOptionalNativeModule<MotionInsightsNativeModule>('MotionInsights');
