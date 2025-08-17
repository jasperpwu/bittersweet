import React, { useState } from 'react';
import { View, ScrollView, SafeAreaView } from 'react-native';
import { ProgressChart } from '../../src/components/analytics/ProgressChart';
import { StatCard } from '../../src/components/analytics/StatCard';
import { TrendAnalysis } from '../../src/components/analytics/TrendAnalysis';
import { Typography } from '../../src/components/ui/Typography';



// Mock data for demonstration
const mockChartData = [
  { date: '2024-01-01', value: 45, label: 'Jan 1' },
  { date: '2024-01-02', value: 60, label: 'Jan 2' },
  { date: '2024-01-03', value: 30, label: 'Jan 3' },
  { date: '2024-01-04', value: 75, label: 'Jan 4' },
  { date: '2024-01-05', value: 90, label: 'Jan 5' },
  { date: '2024-01-06', value: 50, label: 'Jan 6' },
  { date: '2024-01-07', value: 85, label: 'Jan 7' },
];

const mockTrendData = [
  { period: 'Week 1', value: 250, change: 0, changePercentage: 0 },
  { period: 'Week 2', value: 320, change: 70, changePercentage: 28 },
  { period: 'Week 3', value: 280, change: -40, changePercentage: -12.5 },
  { period: 'Week 4', value: 380, change: 100, changePercentage: 35.7 },
];

const mockInsights = [
  {
    id: '1',
    type: 'positive' as const,
    title: 'Great Progress!',
    description: 'You\'ve increased your focus time by 28% this week compared to last week.',
    actionable: false,
  },
  {
    id: '2',
    type: 'neutral' as const,
    title: 'Peak Performance Time',
    description: 'Your most productive hours are between 9-11 AM. Consider scheduling important tasks during this time.',
    actionable: true,
  },
  {
    id: '3',
    type: 'negative' as const,
    title: 'Consistency Opportunity',
    description: 'You missed 2 days this week. Try setting daily reminders to maintain your streak.',
    actionable: true,
  },
];

export default function InsightsScreen() {
  const [selectedPeriod, setSelectedPeriod] = useState<'daily' | 'weekly' | 'monthly'>('weekly');

  const handlePeriodChange = (period: 'daily' | 'weekly' | 'monthly') => {
    setSelectedPeriod(period);
  };

  return (
    <SafeAreaView className="flex-1 bg-white dark:bg-dark-bg">
      <ScrollView 
        className="flex-1"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 20 }}
      >
        {/* Header */}
        <View className="px-4 py-4">
          <Typography variant="headline-24" color="primary">
            Insights
          </Typography>
          <Typography variant="body-14" color="secondary" className="mt-1">
            Understand your focus patterns and progress
          </Typography>
        </View>

        {/* Stats Overview */}
        <View className="px-4 mb-6">
          <View className="flex-row justify-between mb-4">
            <View className="flex-1 mr-2">
              <StatCard
                title="Today's Focus"
                value="2h 15m"
                trend={{
                  direction: 'up',
                  percentage: 15,
                  period: 'vs yesterday',
                }}
                color="primary"
                size="medium"
              />
            </View>
            <View className="flex-1 ml-2">
              <StatCard
                title="Current Streak"
                value="7 days"
                trend={{
                  direction: 'up',
                  percentage: 40,
                  period: 'personal best',
                }}
                color="success"
                size="medium"
              />
            </View>
          </View>

          <View className="flex-row justify-between">
            <View className="flex-1 mr-2">
              <StatCard
                title="Sessions"
                value="156"
                subtitle="This month"
                color="primary"
                size="medium"
              />
            </View>
            <View className="flex-1 ml-2">
              <StatCard
                title="Seeds Earned"
                value="1,247"
                trend={{
                  direction: 'up',
                  percentage: 23,
                  period: 'this week',
                }}
                color="success"
                size="medium"
              />
            </View>
          </View>
        </View>

        {/* Progress Chart */}
        <ProgressChart
          data={mockChartData}
          title="Weekly Focus Time"
          subtitle="Minutes per day"
          chartType="line"
          color="#6592E9"
          height={200}
          showGrid={true}
          showLabels={true}
        />

        {/* Trend Analysis */}
        <TrendAnalysis
          title="Focus Trends"
          data={mockTrendData}
          insights={mockInsights}
          period={selectedPeriod}
          onPeriodChange={handlePeriodChange}
        />

        {/* Additional Stats */}
        <View className="px-4 mt-4">
          <Typography variant="subtitle-16" color="primary" className="mb-4">
            This Week's Highlights
          </Typography>
          
          <View className="bg-light-bg dark:bg-dark-bg rounded-xl p-4 mb-4">
            <View className="flex-row justify-between items-center mb-2">
              <Typography variant="body-14" color="secondary">
                Most Productive Day:
              </Typography>
              <Typography variant="subtitle-14-semibold" color="primary">
                Wednesday
              </Typography>
            </View>
            
            <View className="flex-row justify-between items-center mb-2">
              <Typography variant="body-14" color="secondary">
                Favorite Category:
              </Typography>
              <Typography variant="subtitle-14-semibold" color="primary">
                Work (65%)
              </Typography>
            </View>
            
            <View className="flex-row justify-between items-center">
              <Typography variant="body-14" color="secondary">
                Average Session:
              </Typography>
              <Typography variant="subtitle-14-semibold" color="primary">
                28 minutes
              </Typography>
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}