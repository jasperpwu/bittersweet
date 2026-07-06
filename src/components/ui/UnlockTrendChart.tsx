import React, { useMemo, useState } from 'react';
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
const AVG_LABEL_MAX_WIDTH = 80; // cap so long labels wrap to two lines
const AVG_LABEL_GAP = 8; // space between the label and the first bar
const AVG_LABEL_HEIGHT = 36; // up to two body-12 lines, used to clamp the label inside the chart

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

  // Average daily unlock minutes over the visible past days that actually had
  // unlocks — zero days are excluded so the baseline reflects typical usage on
  // days the user unlocked at all. Today is excluded (still in progress);
  // committed history only, excluding the live slider preview.
  const average = useMemo(() => {
    const past = bars.filter((b) => !b.isToday && b.base > 0);
    if (past.length === 0) return 0;
    return past.reduce((acc, b) => acc + b.base, 0) / past.length;
  }, [bars]);

  const maxValue = useMemo(
    () => Math.max(1, average, ...bars.map((b) => b.base + b.preview)),
    [bars, average]
  );

  const heightFor = (minutes: number) =>
    minutes <= 0 ? 0 : Math.max(MIN_BAR_HEIGHT, (minutes / maxValue) * BAR_AREA_HEIGHT);

  const averageHeight = (average / maxValue) * BAR_AREA_HEIGHT;

  // The left gutter shrink-wraps the measured label width, so short labels
  // (e.g. CJK locales) don't waste horizontal space that the bars could use.
  const [avgLabelWidth, setAvgLabelWidth] = useState(0);
  const gutterWidth = average > 0 ? avgLabelWidth + AVG_LABEL_GAP : 0;

  return (
    <View>
      <Typography variant="body-12" color="secondary" className="mb-2">
        {t('unlock.trendTitle')}
      </Typography>

      {/* Bars */}
      <View className="flex-row" style={{ height: BAR_AREA_HEIGHT + 18 }}>
        {/* Left gutter: labels the average line without obstructing the bars */}
        <View style={{ width: gutterWidth }}>
          {average > 0 && (
            <View
              pointerEvents="none"
              className="absolute items-end"
              style={{
                // Fixed width so the text lays out (and is measured) at its
                // intrinsic size, independent of the shrink-wrapped gutter.
                width: AVG_LABEL_MAX_WIDTH,
                right: AVG_LABEL_GAP,
                // Hide the label until measured so it doesn't flash mid-chart
                opacity: avgLabelWidth > 0 ? 1 : 0,
                // Sit just above the line, but never poke out of the chart area
                bottom: Math.min(averageHeight + 2, BAR_AREA_HEIGHT + 18 - AVG_LABEL_HEIGHT),
              }}
            >
              <Typography
                variant="body-12"
                numberOfLines={2}
                className="text-error-light dark:text-error text-right"
                // onTextLayout (not onLayout): a wrapped Text box reports the
                // full 80px constraint width, but the gutter should hug the
                // widest rendered line instead.
                onTextLayout={(e) => {
                  const w = Math.ceil(Math.max(0, ...e.nativeEvent.lines.map((l) => l.width)));
                  setAvgLabelWidth((prev) => (prev === w ? prev : w));
                }}
              >
                {t('unlock.avgLabel')}
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

        </View>

        {/* Average reference line, striking across the entire chart.
            iOS only draws dashed borders when all four sides are set, so clip a
            fully-bordered view down to 1px to get a single dashed line. */}
        {average > 0 && (
          <View
            pointerEvents="none"
            className="absolute left-0 right-0 overflow-hidden"
            style={{ bottom: averageHeight, height: 1 }}
          >
            <View
              className="border border-dashed border-error-light dark:border-error"
              style={{ height: 4 }}
            />
          </View>
        )}
      </View>

      {/* Day labels */}
      <View className="flex-row mt-1">
        <View style={{ width: gutterWidth }} />
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
