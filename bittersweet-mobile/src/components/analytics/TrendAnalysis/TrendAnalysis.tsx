import React, { FC } from 'react';
import { View, ScrollView } from 'react-native';
import { Typography } from '../../ui/Typography';
import { Card } from '../../ui/Card';

interface TrendData {
  period: string;
  value: number;
  change: number;
  changePercentage: number;
}

interface Insight {
  id: string;
  type: 'positive' | 'negative' | 'neutral';
  title: string;
  description: string;
  actionable?: boolean;
}

interface TrendAnalysisProps {
  title: string;
  data: TrendData[];
  insights: Insight[];
  period: 'daily' | 'weekly' | 'monthly';
  onPeriodChange: (period: 'daily' | 'weekly' | 'monthly') => void;
}


export const TrendAnalysis: FC<TrendAnalysisProps> = ({
  title,
  data,
  insights,
  period,
  onPeriodChange,
}) => {
  const getInsightColor = (type: Insight['type']) => {
    switch (type) {
      case 'positive':
        return 'success';
      case 'negative':
        return 'error';
      default:
        return 'primary';
    }
  };

  const getInsightIcon = (type: Insight['type']) => {
    switch (type) {
      case 'positive':
        return '✓';
      case 'negative':
        return '⚠';
      default:
        return 'ℹ';
    }
  };

  return (
    <Card variant="default" padding="medium" className="mx-4 mb-4">
      <View className="mb-4">
        <Typography variant="subtitle-16" color="primary" className="mb-2">
          {title}
        </Typography>
        
        {/* Period Selector */}
        <View className="flex-row space-x-2">
          {(['daily', 'weekly', 'monthly'] as const).map((p) => (
            <View
              key={p}
              className={`
                px-3 py-1 rounded-full
                ${period === p ? 'bg-primary' : 'bg-light-bg dark:bg-dark-bg'}
              `}
              onTouchEnd={() => onPeriodChange(p)}
            >
              <Typography 
                variant="body-12" 
                color={period === p ? 'white' : 'primary'}
              >
                {p.charAt(0).toUpperCase() + p.slice(1)}
              </Typography>
            </View>
          ))}
        </View>
      </View>

      {/* Trend Data Summary */}
      {data.length > 0 && (
        <View className="mb-4 p-3 bg-light-bg dark:bg-dark-bg rounded-xl">
          <View className="flex-row justify-between items-center">
            <Typography variant="body-12" color="secondary">
              Latest Period:
            </Typography>
            <Typography variant="subtitle-14-semibold" color="primary">
              {data[data.length - 1]?.value || 0}
            </Typography>
          </View>
          <View className="flex-row justify-between items-center mt-1">
            <Typography variant="body-12" color="secondary">
              Change:
            </Typography>
            <Typography 
              variant="body-12" 
              color={data[data.length - 1]?.change >= 0 ? 'success' : 'error'}
            >
              {data[data.length - 1]?.change >= 0 ? '+' : ''}{data[data.length - 1]?.change} 
              ({data[data.length - 1]?.changePercentage >= 0 ? '+' : ''}{data[data.length - 1]?.changePercentage}%)
            </Typography>
          </View>
        </View>
      )}

      {/* Insights */}
      <View>
        <Typography variant="subtitle-14-semibold" color="primary" className="mb-3">
          Insights
        </Typography>
        <ScrollView showsVerticalScrollIndicator={false}>
          {insights.map((insight) => (
            <View 
              key={insight.id}
              className="flex-row p-3 mb-2 bg-light-bg dark:bg-dark-bg rounded-xl"
            >
              <Typography 
                variant="body-14" 
                color={getInsightColor(insight.type)}
                className="mr-3"
              >
                {getInsightIcon(insight.type)}
              </Typography>
              <View className="flex-1">
                <Typography variant="subtitle-14-medium" color="primary" className="mb-1">
                  {insight.title}
                </Typography>
                <Typography variant="body-12" color="secondary">
                  {insight.description}
                </Typography>
                {insight.actionable && (
                  <Typography variant="tiny-10" color="primary" className="mt-1">
                    Tap for suggestions
                  </Typography>
                )}
              </View>
            </View>
          ))}
        </ScrollView>
      </View>
    </Card>
  );
};