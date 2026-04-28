import React, { FC, useState } from 'react';
import { View, Dimensions, Pressable, Modal } from 'react-native';
import Svg, { Rect, Line, Text, Path, G } from 'react-native-svg';
import { Typography } from '../../ui/Typography';
import { Button } from '../../ui/Button';
import { ChartDataPoint, ChartSegment, TimePeriod } from '../../../store/types';

interface FocusSessionsChartProps {
  data: ChartDataPoint[];
  period: TimePeriod;
  onPeriodChange: (period: TimePeriod) => void;
  height?: number;
}

const { width: screenWidth } = Dimensions.get('window');
const CHART_PADDING = 40;
const Y_AXIS_WIDTH = 50;
const CHART_WIDTH = screenWidth - (CHART_PADDING * 2) - Y_AXIS_WIDTH;
const GRID_LINES = 4;
const BAR_RADIUS = 4;

// Pie chart constants
const PIE_SIZE = 180;
const PIE_RADIUS = 70;
const PIE_CENTER = PIE_SIZE / 2;

const formatMinutes = (minutes: number): string => {
  if (minutes >= 60) {
    const h = Math.floor(minutes / 60);
    const m = Math.round(minutes % 60);
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
  }
  return `${Math.round(minutes)}m`;
};

// Generate SVG arc path for a pie slice
const describeArc = (cx: number, cy: number, radius: number, startAngle: number, endAngle: number): string => {
  // Handle full circle case
  if (endAngle - startAngle >= 359.99) {
    const half = (startAngle + endAngle) / 2;
    return describeArc(cx, cy, radius, startAngle, half) + ' ' + describeArc(cx, cy, radius, half, endAngle);
  }

  const startRad = (startAngle - 90) * Math.PI / 180;
  const endRad = (endAngle - 90) * Math.PI / 180;

  const x1 = cx + radius * Math.cos(startRad);
  const y1 = cy + radius * Math.sin(startRad);
  const x2 = cx + radius * Math.cos(endRad);
  const y2 = cy + radius * Math.sin(endRad);

  const largeArc = endAngle - startAngle > 180 ? 1 : 0;

  return `M ${cx} ${cy} L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2} Z`;
};

export const FocusSessionsChart: FC<FocusSessionsChartProps> = ({
  data,
  period,
  onPeriodChange: _onPeriodChange,
  height = 200
}) => {
  const [selectedBar, setSelectedBar] = useState<ChartDataPoint | null>(null);

  // Validate and sanitize data
  const validData = data?.filter(point =>
    point &&
    typeof point.value === 'number' &&
    !isNaN(point.value) &&
    point.value >= 0 &&
    point.label
  ) || [];

  if (validData.length === 0) {
    return (
      <View className="px-4 mb-6">
        <View className="flex-row items-center justify-between mb-4">
          <Typography variant="subtitle-16" color="primary">
            Focus sessions
          </Typography>
          <Button
            variant="outline"
            size="small"
            onPress={() => {}}
          >
            {period === 'daily' ? 'Today' : period === 'weekly' ? 'This week' : 'This month'}
          </Button>
        </View>
        <View
          className="bg-dark-bg border border-dark-border rounded-xl items-center justify-center"
          style={{ height }}
        >
          <Typography variant="body-14" color="secondary">
            No focus session data available
          </Typography>
        </View>
      </View>
    );
  }

  // Dynamic scaling - round up to whole hours
  const actualMaxValue = Math.max(...validData.map(d => d.value));
  const maxHours = actualMaxValue > 0 ? Math.ceil(actualMaxValue / 60) : 1;
  const maxValue = maxHours * 60;

  // Chart dimensions
  const chartTop = 20;
  const chartBottom = height - 40;
  const chartHeight = chartBottom - chartTop;
  const barCount = validData.length;
  const barWidth = Math.min(
    (CHART_WIDTH - (8 * (barCount + 1))) / barCount,
    40
  );

  // Collect unique tags for legend
  const legendTags = new Map<string, string>();
  validData.forEach(point => {
    point.segments?.forEach(seg => {
      if (!legendTags.has(seg.tagName)) {
        legendTags.set(seg.tagName, seg.color);
      }
    });
  });

  return (
    <View className="px-4 mb-6">
      {/* Header */}
      <View className="flex-row items-center justify-between mb-4">
        <Typography variant="subtitle-16" color="white">
          Focus sessions
        </Typography>
        <Button
          variant="outline"
          size="small"
          onPress={() => {}}
        >
          {period === 'daily' ? 'Today' : period === 'weekly' ? 'This week' : 'This month'}
        </Button>
      </View>

      {/* Chart */}
      <View className="bg-dark-bg border border-dark-border rounded-xl p-4">
        <Svg width={CHART_WIDTH + Y_AXIS_WIDTH} height={height}>
          {/* Y-axis labels and grid lines */}
          {Array.from({ length: GRID_LINES + 1 }).map((_, index) => {
            const y = chartTop + (index * chartHeight / GRID_LINES);
            const minuteValue = maxValue - (index * maxValue / GRID_LINES);

            let label: string;
            if (minuteValue >= 60) {
              const hours = Math.floor(minuteValue / 60);
              const mins = minuteValue % 60;
              label = mins === 0 ? `${hours}h` : `${hours}h ${Math.round(mins)}m`;
            } else {
              label = `${Math.round(minuteValue)}m`;
            }

            if (minuteValue < 0) return null;

            return (
              <React.Fragment key={index}>
                <Text
                  x={Y_AXIS_WIDTH - 10}
                  y={y + 4}
                  fontSize="10"
                  fill="#9CA3AF"
                  textAnchor="end"
                >
                  {label}
                </Text>
                <Line
                  x1={Y_AXIS_WIDTH}
                  y1={y}
                  x2={CHART_WIDTH + Y_AXIS_WIDTH}
                  y2={y}
                  stroke="#575757"
                  strokeOpacity="0.5"
                  strokeWidth="1"
                />
              </React.Fragment>
            );
          })}

          {/* Bars - tap areas rendered as transparent rects over the bars */}
          {validData.map((point, index) => {
            const totalBarSpace = CHART_WIDTH / barCount;
            const barX = Y_AXIS_WIDTH + (index * totalBarSpace) + (totalBarSpace - barWidth) / 2;
            const segments = point.segments || [];

            // Draw stacked segments bottom-up
            let currentY = chartBottom;

            return (
              <G key={index} onPress={() => point.value > 0 && setSelectedBar(point)}>
                {/* Invisible tap target covering the full bar area */}
                <Rect
                  x={barX - 4}
                  y={chartTop}
                  width={barWidth + 8}
                  height={chartHeight}
                  fill="transparent"
                />
                {segments.map((segment, segIndex) => {
                  const segHeight = (segment.value / maxValue) * chartHeight;
                  if (segHeight <= 0) return null;

                  currentY -= segHeight;
                  const isTop = segIndex === segments.length - 1;

                  return (
                    <Rect
                      key={segIndex}
                      x={barX}
                      y={currentY}
                      width={barWidth}
                      height={segHeight}
                      fill={segment.color}
                      rx={isTop || (segments.length === 1) ? BAR_RADIUS : 0}
                      ry={isTop || (segments.length === 1) ? BAR_RADIUS : 0}
                      opacity={0.9}
                    />
                  );
                })}
                {/* If no segments but has value, draw a default bar */}
                {segments.length === 0 && point.value > 0 && (
                  <Rect
                    x={barX}
                    y={chartBottom - (point.value / maxValue) * chartHeight}
                    width={barWidth}
                    height={(point.value / maxValue) * chartHeight}
                    fill="#6592E9"
                    rx={BAR_RADIUS}
                    ry={BAR_RADIUS}
                    opacity={0.9}
                  />
                )}
              </G>
            );
          })}
        </Svg>

        {/* X-axis labels */}
        <View className="flex-row justify-between mt-2" style={{ paddingLeft: Y_AXIS_WIDTH }}>
          {validData.map((point, index) => (
            <Typography
              key={index}
              variant="body-12"
              color="secondary"
              className="flex-1 text-center"
            >
              {point.label}
            </Typography>
          ))}
        </View>

        {/* Legend */}
        {legendTags.size > 0 && (
          <View className="flex-row flex-wrap mt-3 gap-x-4 gap-y-1">
            {Array.from(legendTags.entries()).map(([name, color]) => (
              <View key={name} className="flex-row items-center">
                <View
                  style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: color }}
                />
                <Typography variant="body-12" color="secondary" className="ml-1.5">
                  {name}
                </Typography>
              </View>
            ))}
          </View>
        )}
      </View>

      {/* Pie Chart Modal */}
      <Modal
        visible={selectedBar !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedBar(null)}
      >
        <Pressable
          className="flex-1 items-center justify-center"
          style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}
          onPress={() => setSelectedBar(null)}
        >
          <Pressable
            className="bg-dark-bg border border-dark-border rounded-2xl p-5"
            style={{ width: screenWidth - 80 }}
            onPress={() => {/* prevent dismiss when tapping inside */}}
          >
            {/* Title */}
            <Typography variant="subtitle-16" color="white" className="text-center mb-1">
              {selectedBar?.label}
            </Typography>
            <Typography variant="body-12" color="secondary" className="text-center mb-4">
              Total: {selectedBar ? formatMinutes(selectedBar.value) : ''}
            </Typography>

            {/* Pie Chart */}
            {selectedBar && selectedBar.segments && selectedBar.segments.length > 0 && (
              <View className="items-center mb-4">
                <Svg width={PIE_SIZE} height={PIE_SIZE}>
                  {(() => {
                    const segments = selectedBar.segments!;
                    const total = segments.reduce((sum, s) => sum + s.value, 0);
                    let startAngle = 0;

                    return segments.map((segment, i) => {
                      const sliceAngle = (segment.value / total) * 360;
                      const path = describeArc(PIE_CENTER, PIE_CENTER, PIE_RADIUS, startAngle, startAngle + sliceAngle);
                      startAngle += sliceAngle;
                      return (
                        <Path
                          key={i}
                          d={path}
                          fill={segment.color}
                          opacity={0.9}
                        />
                      );
                    });
                  })()}
                </Svg>
              </View>
            )}

            {/* Breakdown list */}
            {selectedBar?.segments?.map((segment, i) => {
              const total = selectedBar.segments!.reduce((sum, s) => sum + s.value, 0);
              const pct = total > 0 ? Math.round((segment.value / total) * 100) : 0;
              return (
                <View key={i} className="flex-row items-center justify-between py-1.5">
                  <View className="flex-row items-center flex-1">
                    <View
                      style={{ width: 12, height: 12, borderRadius: 3, backgroundColor: segment.color }}
                    />
                    <Typography variant="body-14" color="white" className="ml-2">
                      {segment.tagName}
                    </Typography>
                  </View>
                  <Typography variant="body-14" color="secondary">
                    {formatMinutes(segment.value)} ({pct}%)
                  </Typography>
                </View>
              );
            })}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
};
