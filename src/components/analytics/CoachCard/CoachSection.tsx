import React, { FC, useEffect, useMemo, useState } from 'react';
import { View, Pressable, useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Typography } from '../../ui/Typography';
import { Card } from '../../ui/Card';
import { useAppStore } from '../../../store';
import { colors } from '../../../config/theme';
import { weekProgress, MIN_SESSIONS, MIN_ACTIVE_DAYS } from '../../../services/coach';
import type { WeeklyCoachReport } from '../../../store/types';
import { ScoreRing } from './CoachVisuals';
import { useTranslation } from 'react-i18next';
import i18n from '../../../i18n';

const SEEN_KEY = 'bittersweet-coach-last-seen';

const weekStartISO = (r: WeeklyCoachReport) => new Date(r.weekStart).toISOString().slice(0, 10);
const fmtDay = (d: Date | string) =>
  new Date(d).toLocaleDateString(i18n.language, { month: 'short', day: 'numeric' });

/** A square score tile for one weekly report. */
const ReportTile: FC<{ report: WeeklyCoachReport }> = ({ report }) => (
  <View className="mb-3 w-1/3 px-1.5">
    <Pressable
      className="active:opacity-80"
      onPress={() =>
        router.push({ pathname: '/(modals)/ai-coach', params: { reportId: report.id } })
      }>
      <Card variant="outlined" padding="small" borderRadius="medium">
        <View style={{ aspectRatio: 1 }} className="items-center justify-center">
          <ScoreRing score={report.focusScore} size={46} fontVariant="body-14" />
          <Typography variant="tiny-10" color="secondary" className="mt-1.5">
            {fmtDay(report.weekStart)}
          </Typography>
        </View>
      </Card>
    </Pressable>
  </View>
);

/** Progress-aware empty state (no report yet, but the user has some activity). */
const Teaser: FC = () => {
  const { t } = useTranslation();
  const progress = weekProgress();
  const remainingSessions = Math.max(0, MIN_SESSIONS - progress.sessions);
  const remainingDays = Math.max(0, MIN_ACTIVE_DAYS - progress.activeDays);
  const closerByDays = remainingDays <= remainingSessions;
  const line = progress.meetsGate
    ? t('coach.teaserReady')
    : closerByDays
      ? t('coach.teaserDays', { count: remainingDays })
      : t('coach.teaserSessions', { count: remainingSessions });
  const chip = closerByDays
    ? t('coach.chipDays', { current: progress.activeDays, total: MIN_ACTIVE_DAYS })
    : t('coach.chipSessions', { current: progress.sessions, total: MIN_SESSIONS });

  return (
    <View className="mb-6 px-5">
      <Card variant="outlined" padding="medium">
        <View className="flex-row items-center justify-between">
          <View className="flex-1 pr-3">
            <Typography variant="subtitle-16" color="primary" className="mb-1">
              {t('coach.title')}
            </Typography>
            <Typography variant="body-12" color="secondary">
              {line}
            </Typography>
            {!progress.meetsGate && (
              <Typography variant="tiny-10" color="secondary" className="mt-1">
                {chip}
              </Typography>
            )}
          </View>
          <Typography variant="headline-24" color="primary">
            🧭
          </Typography>
        </View>
      </Card>
    </View>
  );
};

/**
 * AI Focus Coach section on the Goals tab — a collapsible grid of weekly report
 * tiles (mirrors the Badges section). Collapsed by default, with a red dot when a
 * new report the user hasn't opened the section for is available.
 */
export const CoachSection: FC = () => {
  const { t } = useTranslation();
  const coachReports = useAppStore((s) => s.focus.coachReports);
  const sessionCount = useAppStore((s) => s.focus.sessions.allIds.length);
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const [isCollapsed, setIsCollapsed] = useState(true);
  const [lastSeen, setLastSeen] = useState<string | null>(null);
  const [seenLoaded, setSeenLoaded] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(SEEN_KEY).then((v) => {
      setLastSeen(v);
      setSeenLoaded(true);
    });
  }, []);

  const reports = useMemo<WeeklyCoachReport[]>(() => {
    if (!coachReports?.allIds) return [];
    return coachReports.allIds
      .map((id: string) => coachReports.byId[id])
      .filter(Boolean)
      .filter((r: any) => !r.deletedAt)
      .sort((a: any, b: any) => new Date(b.weekStart).getTime() - new Date(a.weekStart).getTime());
  }, [coachReports]);

  const latest = reports[0];
  const latestISO = latest ? weekStartISO(latest) : null;
  // Gate on seenLoaded so the dot never flashes before AsyncStorage resolves.
  const hasUnseen = seenLoaded && !!latestISO && (!lastSeen || latestISO > lastSeen);

  const markSeen = () => {
    if (latestISO) {
      setLastSeen(latestISO);
      void AsyncStorage.setItem(SEEN_KEY, latestISO);
    }
  };

  const toggle = () => {
    setIsCollapsed((prev) => {
      const next = !prev;
      if (!next) markSeen(); // expanding → the user has now seen the latest report
      return next;
    });
  };

  // No reports yet: teaser (or nothing at all for a brand-new user).
  if (!latest) {
    if (sessionCount === 0) return null;
    return <Teaser />;
  }

  return (
    <View className="mb-6 px-5">
      <Pressable
        className="mb-3 flex-row items-center"
        onPress={toggle}
        style={{ paddingVertical: 4 }}>
        <Typography variant="subtitle-16" color="primary" className="mr-2">
          {t('coach.title')}
        </Typography>
        {hasUnseen && (
          <View
            style={{
              width: 8,
              height: 8,
              borderRadius: 4,
              backgroundColor: colors.error,
              marginRight: 8,
            }}
          />
        )}
        <Typography variant="body-12" color="secondary" className="mr-2">
          {reports.length}
        </Typography>
        <Ionicons
          name={isCollapsed ? 'chevron-down' : 'chevron-up'}
          size={16}
          color={isDark ? colors.dark.textSecondary : colors.light.textSecondary}
        />
      </Pressable>

      {!isCollapsed && (
        <View className="-mx-1.5 flex-row flex-wrap">
          {reports.map((r) => (
            <ReportTile key={r.id} report={r} />
          ))}
        </View>
      )}
    </View>
  );
};
