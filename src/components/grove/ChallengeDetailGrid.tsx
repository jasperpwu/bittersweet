import React from 'react';
import { View } from 'react-native';
import { Typography } from '../ui/Typography';
import { colors } from '../../config/theme';
import type { ParticipantPeriodData } from '../../services/grove/GroveChallengeService';

const HIT_COLOR = '#C6EFCE';

interface ChallengeDetailGridProps {
  participants: ParticipantPeriodData[];
  periodType: 'daily' | 'weekly';
  targetMinutes: number;
  startDate: string;
  totalPeriods: number;
  currentUserId: string;
}

function fillPercent(minutes: number, target: number): number {
  if (target <= 0) return 0;
  return Math.min((minutes / target) * 100, 100);
}

const DAY_HEADERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

// Row height for the daily 7-column grid: the 20px square plus breathing room.
// Deliberately not a square cell (`aspectRatio: 1`), which at 1/7th of the card
// width made rows ~45px tall and left a big empty band under the grid.
const DAY_CELL_ROW_HEIGHT = 32;

interface PeriodSquareProps {
  minutes: number;
  target: number;
  size?: number;
}

const PeriodSquare: React.FC<PeriodSquareProps> = ({ minutes, target, size = 20 }) => {
  const hit = minutes >= target;
  const fill = fillPercent(minutes, target);

  if (hit) {
    return (
      <View
        className="rounded-sm"
        style={{ width: size, height: size, backgroundColor: HIT_COLOR }}
      />
    );
  }

  return (
    <View
      className="rounded-sm bg-light-border dark:bg-dark-border overflow-hidden"
      style={{ width: size, height: size }}
    >
      {fill > 0 && (
        <View
          className="absolute bottom-0 left-0 right-0"
          style={{ height: `${fill}%`, backgroundColor: colors.challenge }}
        />
      )}
    </View>
  );
};

interface UserGridProps {
  label: string;
  minutesPerPeriod: number[];
  target: number;
  periodType: 'daily' | 'weekly';
  startDate: string;
}

export const UserGrid: React.FC<UserGridProps> = ({ label, minutesPerPeriod, target, periodType, startDate }) => {
  const hitCount = minutesPerPeriod.filter(m => m >= target).length;

  if (periodType === 'daily') {
    // Pad with empty squares so the grid aligns to day-of-week columns
    const firstDayOfWeek = new Date(startDate + 'T00:00:00').getDay();
    const paddedMinutes: (number | null)[] = [
      ...Array(firstDayOfWeek).fill(null),
      ...minutesPerPeriod,
    ];

    return (
      <View className="mb-3">
        <View className="flex-row items-center justify-between mb-2">
          <Typography variant="body-12" color="secondary">{label}</Typography>
          <Typography variant="body-12" color="primary">{hitCount}/{minutesPerPeriod.length} hit</Typography>
        </View>
        {/* Day headers */}
        <View className="flex-row mb-1">
          {DAY_HEADERS.map((d, i) => (
            <View key={i} className="flex-1 items-center">
              <Typography variant="tiny-10" color="secondary">{d}</Typography>
            </View>
          ))}
        </View>
        {/* Grid — rows are sized to the 20px square, not to a full square cell
            (aspectRatio: 1 made each row ~45px tall, so the last, usually
            partial row left a large blank band under the grid). */}
        <View className="flex-row flex-wrap">
          {paddedMinutes.map((m, i) => (
            <View key={i} className="items-center justify-center" style={{ width: '14.28%', height: DAY_CELL_ROW_HEIGHT }}>
              {m !== null ? (
                <PeriodSquare minutes={m} target={target} />
              ) : (
                <View style={{ width: 20, height: 20 }} />
              )}
            </View>
          ))}
        </View>
      </View>
    );
  }

  // Weekly: horizontal row of blocks with W1, W2, etc. labels
  return (
    <View className="mb-3">
      <View className="flex-row items-center justify-between mb-2">
        <Typography variant="body-12" color="secondary">{label}</Typography>
        <Typography variant="body-12" color="primary">{hitCount}/{minutesPerPeriod.length} hit</Typography>
      </View>
      <View className="flex-row justify-between">
        {minutesPerPeriod.map((m, i) => (
          <View key={i} className="items-center" style={{ flex: 1 }}>
            <PeriodSquare minutes={m} target={target} />
            <Typography variant="tiny-10" color="secondary" className="mt-1">
              W{i + 1}
            </Typography>
          </View>
        ))}
      </View>
    </View>
  );
};

export const ChallengeDetailGrid: React.FC<ChallengeDetailGridProps> = ({
  participants,
  periodType,
  targetMinutes,
  startDate,
  totalPeriods,
  currentUserId,
}) => {
  if (!participants || participants.length === 0) return null;

  // Sort: current user first, then by hits descending
  const sorted = [...participants].sort((a, b) => {
    if (a.user_id === currentUserId) return -1;
    if (b.user_id === currentUserId) return 1;
    return b.hits - a.hits;
  });

  return (
    <View className="bg-light-bg dark:bg-dark-bg border border-light-border dark:border-dark-border rounded-xl p-4 mt-2">
      {sorted.map((participant) => (
        <UserGrid
          key={participant.user_id}
          label={participant.user_id === currentUserId ? 'You' : participant.display_name}
          minutesPerPeriod={participant.minutes}
          target={targetMinutes}
          periodType={periodType}
          startDate={startDate}
        />
      ))}
    </View>
  );
};
