import React, { FC } from 'react';
import { View, Pressable } from 'react-native';
import { Typography } from '../ui/Typography';

interface TrendDataPoint {
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
  actionable: boolean;
}

interface TrendAnalysisProps {
  title: string;
  data: TrendDataPoint[];
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
      case 'positive': return 'text-success';
      case 'negative': return 'text-error';
      default: return 'text-primary';
    }
  };

  return (
    <View className="px-4 mb-6">
      <View className="bg-white dark:bg-gray-800 rounded-2xl p-4">
        <View className="flex-row justify-between items-center mb-4">
          <Typography variant="subtitle-16" color="primary">
            {title}
          </Typography>
          
          <View className="flex-row bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
            {(['daily', 'weekly', 'monthly'] as const).map((p) => (
              <Pressable
                key={p}
                onPress={() => onPeriodChange(p)}
                className={`px-3 py-1 rounded-md ${
                  period === p ? 'bg-primary' : ''
                }`}
              >
                <Typography 
                  variant="body-12" 
                  color={period === p ? 'white' : 'secondary'}
                  className="capitalize"
                >
                  {p}
                </Typography>
              </Pressable>
            ))}
          </View>
        </View>

        {/* Trend Data */}
        <View className="mb-4">
          {data.map((point, index) => (
            <View key={index} className="flex-row justify-between items-center py-2">
              <Typography variant="body-14" color="primary">
                {point.period}
              </Typography>
              <View className="flex-row items-center">
                <Typography variant="body-14" color="primary" className="mr-2">
                  {point.value}
                </Typography>
                <Typography 
                  variant="body-12" 
                  style={{ 
                    color: point.change >= 0 ? '#51BC6F' : '#EF786C' 
                  }}
                >
                  {point.change >= 0 ? '+' : ''}{point.changePercentage}%
                </Typography>
              </View>
            </View>
          ))}
        </View>

        {/* Insights */}
        <View>
          <Typography variant="body-14" color="primary" className="mb-3">
            Insights
          </Typography>
          {insights.map((insight) => (
            <View key={insight.id} className="mb-3 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
              <Typography 
                variant="body-12" 
                className={`mb-1 ${getInsightColor(insight.type)}`}
              >
                {insight.title}
              </Typography>
              <Typography variant="body-12" color="secondary">
                {insight.description}
              </Typography>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
};