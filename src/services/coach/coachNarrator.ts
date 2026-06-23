/**
 * The pluggable "narration layer" — the only part of the coach an LLM touches.
 *
 * It hands the already-computed facts + fully-grounded candidate cards to a narrator
 * and gets back the final insight cards. On Apple-Intelligence devices the on-device
 * model selects and rewrites the prose of the candidates (it never invents actions or
 * numbers); everywhere else, and on any failure, it falls back to templated prose. The
 * rest of the pipeline is identical in both cases.
 */
import type { CoachWeeklyStats, CoachInsightCard, CoachNarrator } from '../../store/types';
import { candidateCards, templateCards, NarratorContext } from './coachTemplates';
import AiCoach from '../../../modules/ai-coach';

export type { NarratorContext } from './coachTemplates';

export interface NarrateResult {
  cards: CoachInsightCard[];
  narrator: CoachNarrator;
}

export async function narrate(
  stats: CoachWeeklyStats,
  ctx: NarratorContext
): Promise<NarrateResult> {
  const fallback = (): NarrateResult => ({
    cards: templateCards(stats, ctx),
    narrator: 'template',
  });

  try {
    if (!AiCoach) return fallback();
    const availability = await AiCoach.availability();
    if (availability !== 'available') return fallback();

    const candidates = candidateCards(stats, ctx);
    if (candidates.length === 0) return fallback();

    // Pass only the numbers the model may reference (no opaque ids), plus the grounded
    // candidates it chooses from by index.
    const payload = JSON.stringify({
      facts: {
        focusedMinutes: stats.totalMinutes,
        sessions: stats.totalSessions,
        activeDays: stats.activeDays,
        avgRating: stats.avgRating,
        ratedSessions: stats.ratedCount,
        peakHour: stats.peakHour,
        peakDay: stats.peakDay,
        minutesVsAverage: stats.deltaMinutesVsTrailingAvg,
        goalsMet: stats.goalsMet,
        goalsTracked: stats.goalsTracked,
      },
      candidates: candidates.map((c, i) => ({ index: i, headline: c.headline, body: c.body })),
    });

    const raw = await AiCoach.generateReport(payload);
    if (!raw) return fallback();

    const parsed = JSON.parse(raw) as { index: number; headline?: string; body?: string }[];
    const seen = new Set<number>();
    const cards: CoachInsightCard[] = [];
    for (const p of parsed) {
      const base = candidates[p.index];
      if (!base || seen.has(p.index)) continue; // ignore invented/duplicate indices
      seen.add(p.index);
      // Keep the grounded action/severity; only the prose is model-written.
      cards.push({
        ...base,
        headline: (p.headline || base.headline).trim(),
        body: (p.body || base.body).trim(),
      });
      if (cards.length >= 3) break;
    }

    if (cards.length === 0) return fallback();
    return { cards, narrator: 'apple_fm' };
  } catch (error) {
    console.error('[coach] on-device narration failed, using templates:', error);
    return fallback();
  }
}
