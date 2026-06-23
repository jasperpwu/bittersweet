import React, { FC } from 'react';
import { View, useColorScheme } from 'react-native';
import Svg, { Circle, Polyline } from 'react-native-svg';
import { Typography } from '../../ui/Typography';
import { colors } from '../../../config/theme';

/** Score → semantic color band, shared across the coach UI. */
export const scoreColor = (score: number): string =>
  score >= 75 ? colors.success : score >= 50 ? colors.primary : colors.error;

/** Circular progress ring with the score centered. */
export const ScoreRing: FC<{ score: number; size?: number; fontVariant?: any }> = ({
  score,
  size = 60,
  fontVariant = 'headline-18',
}) => {
  const scheme = useColorScheme();
  const stroke = size >= 96 ? 8 : 6;
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, score)) / 100;
  const track = scheme === 'dark' ? colors.dark.border : colors.light.border;

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={track} strokeWidth={stroke} fill="none" />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={scoreColor(score)}
          strokeWidth={stroke}
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - pct)}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      <View style={{ position: 'absolute' }}>
        <Typography variant={fontVariant} color="primary">
          {score}
        </Typography>
      </View>
    </View>
  );
};

/** Tiny score-over-weeks sparkline (values oldest → newest, fixed 0–100 range). */
export const Sparkline: FC<{ values: number[]; width?: number; height?: number }> = ({
  values,
  width = 84,
  height = 28,
}) => {
  if (values.length < 2) return null;
  const points = values
    .map((v, i) => {
      const x = (i / (values.length - 1)) * width;
      const y = height - (Math.max(0, Math.min(100, v)) / 100) * height;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
  return (
    <Svg width={width} height={height}>
      <Polyline
        points={points}
        fill="none"
        stroke={colors.primary}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
};
