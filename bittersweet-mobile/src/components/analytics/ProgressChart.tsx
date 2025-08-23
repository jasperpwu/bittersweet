import React, { FC } from 'react';
import { View } from 'react-native';
import { Typography } from '../ui/Typography';

interface ChartDataPoint {
  date: string;
  value: number;
  label: string;
}

interface ProgressChartProps {
  data: ChartDataPoint[];
  title: string;
  subtitle?: string;
  chartType?: 'line' | 'bar';
  color?: string;
  height?: number;
  showGrid?: boolean;
  showLabels?: boolean;
}

export const ProgressChart: FC<ProgressChartProps> = ({
  data,
  title,
  subtitle,
  chartType = 'line',
  color = '#6592E9',
  height = 200,
  showGrid = true,
  showLabels = true,
}) => {
  const maxValue = Math.max(...data.map(d => d.value));
  
  return (
    <View className="px-4 mb-6">
      <View className="bg-white dark:bg-gray-800 rounded-2xl p-4">
        <View className="mb-4">
          <Typography variant="subtitle-16" color="primary">
            {title}
          </Typography>
          {subtitle && (
            <Typography variant="body-12" color="secondary" className="mt-1">
              {subtitle}
            </Typography>
          )}
        </View>
        
        {/* Simple chart placeholder */}
        <View 
          className="bg-gray-100 dark:bg-gray-700 rounded-xl items-center justify-center"
          style={{ height }}
        >
          <Typography variant="body-14" color="secondary">
            Chart visualization
          </Typography>
          <Typography variant="body-12" color="secondary" className="mt-1">
            {data.length} data points
          </Typography>
        </View>
        
        {showLabels && (
          <View className="flex-row justify-between mt-3">
            {data.slice(0, 7).map((point, index) => (
              <View key={index} className="items-center">
                <Typography variant="tiny-10" color="secondary">
                  {point.label}
                </Typography>
              </View>
            ))}
          </View>
        )}
      </View>
    </View>
  );
};