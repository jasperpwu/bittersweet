import React, { useMemo } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Typography } from './Typography';

interface UnlockTrendChartProps {
  /** Map of YYYY-MM-DD (local) -> total minutes unlocked that day. */
  history: Record<string, number>;
  /** Currently selected slider duration, previewed on top of today's bar. */
  previewMinutes: number;
  /** Number of days to show, including today. */
  days?: number;
}

const BAR_AREA_HEIGHT = 72; // px available for the tallest bar
const MIN_BAR_HEIGHT = 4; // sliver so a non-zero day is always visible
const AVG_GUTTER = 46; // px reserved on the left to label the average line
const AVG_LABEL_HEIGHT = 16; // approx line-height of the average label, for centering

export const UnlockTrendChart: React.FC<UnlockTrendChartProps> = ({
  history,
  previewMinutes,
  days = 7,
}) => {
  const { t, i18n } = useTranslation();

  const bars = useMemo(() => {
    const today = new Date();
    const result: {
      key: string;
      label: string;
      base: number; // minutes already unlocked that day
      preview: number; // slider preview (today only)
      isToday: boolean;
    }[] = [];

    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const key = d.toLocaleDateString('en-CA'); // YYYY-MM-DD (local)
      const isToday = i === 0;
      result.push({
        key,
        label: isToday
          ? t('unlock.today')
          : d.toLocaleDateString(i18n.language, { weekday: 'short' }),
        base: history?.[key] ?? 0,
        preview: isToday ? Math.max(0, previewMinutes) : 0,
        isToday,
      });
    }
    return result;
  }, [history, previewMinutes, days, i18n.language, t]);

  // Average daily unlock minutes over the visible past days — i.e. every day shown
  // except today, which is still in progress (so with a 7-day window the average is
  // over the last 6 completed days). Denominator is the full past window so the
  // baseline is a true windowed average the user can compare each day against;
  // committed history only, excluding the live slider preview.
  const average = useMemo(() => {
    const past = bars.filter((b) => !b.isToday);
    if (past.length === 0) return 0;
    const sum = past.reduce((acc, b) => acc + b.base, 0);
    if (sum <= 0) return 0;
    return sum / past.length;
  }, [bars]);

  const maxValue = useMemo(
    () => Math.max(1, average, ...bars.map((b) => b.base + b.preview)),
    [bars, average]
  );

  const heightFor = (minutes: number) =>
    minutes <= 0 ? 0 : Math.max(MIN_BAR_HEIGHT, (minutes / maxValue) * BAR_AREA_HEIGHT);

  const averageHeight = (average / maxValue) * BAR_AREA_HEIGHT;

  return (
    <View>
      <Typography variant="body-12" color="secondary" className="mb-2">
        {t('unlock.trendTitle')}
      </Typography>

      {/* Bars */}
      <View className="flex-row" style={{ height: BAR_AREA_HEIGHT + 18 }}>
        {/* Left gutter: labels the average line without obstructing the bars */}
        <View style={{ width: AVG_GUTTER }}>
          {average > 0 && (
            <View
              pointerEvents="none"
              className="absolute right-1.5 items-end"
              style={{
                bottom: Math.max(0, averageHeight - AVG_LABEL_HEIGHT / 2),
              }}
            >
              <Typography variant="body-12" color="secondary">
                {t('unlock.avgLabel', { minutes: Math.round(average) })}
              </Typography>
            </View>
          )}
        </View>

        {/* Bars area */}
        <View className="flex-1 flex-row items-end relative">
        {bars.map((bar) => {
          const total = bar.base + bar.preview;
          const totalHeight = heightFor(total);
          const previewHeight =
            total > 0 ? Math.round((bar.preview / total) * totalHeight) : 0;
          const baseHeight = Math.max(0, totalHeight - previewHeight);

          return (
            <View key={bar.key} className="flex-1 items-center justify-end">
              {/* Value label above today's dynamic bar */}
              {bar.isToday ? (
                <Typography variant="body-12" color="primary" className="mb-0.5">
                  {`${total}m`}
                </Typography>
              ) : (
                <View className="mb-0.5" style={{ height: 16 }} />
              )}

              {/* The bar itself */}
              <View
                className="rounded-t-md overflow-hidden"
                style={{
                  width: 18,
                  height: Math.max(totalHeight, total > 0 ? MIN_BAR_HEIGHT : 2),
                }}
              >
                {bar.isToday ? (
                  <>
                    {/* Slider preview stacked on top */}
                    {previewHeight > 0 && (
                      <View className="bg-primary" style={{ height: previewHeight }} />
                    )}
                    {/* Minutes already unlocked today */}
                    {baseHeight > 0 && (
                      <View className="bg-primary/40" style={{ height: baseHeight }} />
                    )}
                  </>
                ) : total > 0 ? (
                  <View className="flex-1 bg-light-border dark:bg-dark-border" />
                ) : (
                  <View className="flex-1 bg-light-border/40 dark:bg-dark-border/40" />
                )}
              </View>
            </View>
          );
        })}

        {/* Average reference line, spanning first day to last */}
        {average > 0 && (
          <View
            pointerEvents="none"
            className="absolute left-0 right-0 border-t border-dashed border-light-text-secondary dark:border-dark-text-secondary"
            style={{ bottom: averageHeight }}
          />
        )}
        </View>
      </View>

      {/* Day labels */}
      <View className="flex-row mt-1">
        <View style={{ width: AVG_GUTTER }} />
        <View className="flex-1 flex-row">
          {bars.map((bar) => (
            <Typography
              key={bar.key}
              variant="body-12"
              color={bar.isToday ? 'primary' : 'secondary'}
              className="flex-1 text-center"
            >
              {bar.label}
            </Typography>
          ))}
        </View>
      </View>
    </View>
  );
};
