import React from 'react';
import { View } from 'react-native';
import { Typography } from '../ui/Typography';
import type { ChallengePeriodDetail } from '../../services/grove/GroveChallengeService';

const HIT_COLOR = '#C6EFCE';

interface ChallengeDetailGridProps {
  periods: ChallengePeriodDetail[];
  periodType: 'daily' | 'weekly';
  targetMinutes: number;
  startDate: string;
  myLabel: string;
  theirLabel: string;
  isChallenger: boolean;
}

function getMyMinutes(p: ChallengePeriodDetail, isChallenger: boolean): number {
  return isChallenger ? p.challenger_minutes : p.challengee_minutes;
}

function getTheirMinutes(p: ChallengePeriodDetail, isChallenger: boolean): number {
  return isChallenger ? p.challengee_minutes : p.challenger_minutes;
}

function fillPercent(minutes: number, target: number): number {
  if (target <= 0) return 0;
  return Math.min((minutes / target) * 100, 100);
}

const DAY_HEADERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

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
          className="absolute bottom-0 left-0 right-0 bg-primary"
          style={{ height: `${fill}%` }}
        />
      )}
    </View>
  );
};

interface UserGridProps {
  label: string;
  periods: ChallengePeriodDetail[];
  getMinutes: (p: ChallengePeriodDetail) => number;
  target: number;
  periodType: 'daily' | 'weekly';
  startDate: string;
}

const UserGrid: React.FC<UserGridProps> = ({ label, periods, getMinutes, target, periodType, startDate }) => {
  const hitCount = periods.filter(p => getMinutes(p) >= target).length;

  if (periodType === 'daily') {
    // Pad with empty squares so the grid aligns to day-of-week columns
    const firstDayOfWeek = new Date(startDate + 'T00:00:00').getDay();
    const paddedPeriods: (ChallengePeriodDetail | null)[] = [
      ...Array(firstDayOfWeek).fill(null),
      ...periods,
    ];

    return (
      <View className="mb-3">
        <View className="flex-row items-center justify-between mb-2">
          <Typography variant="body-12" color="secondary">{label}</Typography>
          <Typography variant="body-12" color="primary">{hitCount}/{periods.length} hit</Typography>
        </View>
        {/* Day headers */}
        <View className="flex-row mb-1">
          {DAY_HEADERS.map((d, i) => (
            <View key={i} className="flex-1 items-center">
              <Typography variant="tiny-10" color="secondary">{d}</Typography>
            </View>
          ))}
        </View>
        {/* Grid */}
        <View className="flex-row flex-wrap">
          {paddedPeriods.map((p, i) => (
            <View key={i} className="items-center justify-center" style={{ width: '14.28%', aspectRatio: 1 }}>
              {p ? (
                <PeriodSquare minutes={getMinutes(p)} target={target} />
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
        <Typography variant="body-12" color="primary">{hitCount}/{periods.length} hit</Typography>
      </View>
      <View className="flex-row justify-between">
        {periods.map((p, i) => (
          <View key={i} className="items-center" style={{ flex: 1 }}>
            <PeriodSquare minutes={getMinutes(p)} target={target} />
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
  periods,
  periodType,
  targetMinutes,
  startDate,
  myLabel,
  theirLabel,
  isChallenger,
}) => {
  if (!periods || periods.length === 0) return null;

  return (
    <View className="bg-light-bg dark:bg-dark-bg border border-light-border dark:border-dark-border rounded-xl p-4 mt-2">
      <UserGrid
        label={myLabel}
        periods={periods}
        getMinutes={(p) => getMyMinutes(p, isChallenger)}
        target={targetMinutes}
        periodType={periodType}
        startDate={startDate}
      />
      <UserGrid
        label={theirLabel}
        periods={periods}
        getMinutes={(p) => getTheirMinutes(p, isChallenger)}
        target={targetMinutes}
        periodType={periodType}
        startDate={startDate}
      />
    </View>
  );
};
