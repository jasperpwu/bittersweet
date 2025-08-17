import React, { FC } from 'react';
import { View, Dimensions } from 'react-native';
import { Typography } from '../../ui/Typography';
import { Card } from '../../ui/Card';

interface ChartDataPoint {
  date: string;
  value: number;
  label?: string;
}

interface ProgressChartProps {
  data: ChartDataPoint[];
  title: string;
  subtitle?: string;
  chartType: 'line' | 'bar' | 'area';
  color?: string;
  height?: number;
  showGrid?: boolean;
  showLabels?: boolean;
}

const { width: screenWidth } = Dimensions.get('window');

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
  const chartWidth = screenWidth - 64; // Account for padding

  const maxValue = Math.max(...data.map(d => d.value));
  const minValue = Math.min(...data.map(d => d.value));

  const renderPlaceholderChart = () => (
    <View 
      className="bg-light-bg dark:bg-dark-bg rounded-xl items-center justify-center"
      style={{ height, width: chartWidth }}
    >
      <Typography variant="body-12" color="secondary">
        Chart will be implemented with react-native-svg-charts
      </Typography>
      <Typography variant="tiny-10" color="secondary" className="mt-1">
        Type: {chartType} | Data points: {data.length}
      </Typography>
    </View>
  );

  return (
    <Card variant="default" padding="medium" className="mx-4 mb-4">
      <View className="mb-4">
        <Typography variant="subtitle-16" color="primary" className="mb-1">
          {title}
        </Typography>
        {subtitle && (
          <Typography variant="body-12" color="secondary">
            {subtitle}
          </Typography>
        )}
      </View>

      {renderPlaceholderChart()}

      {showLabels && data.length > 0 && (
        <View className="mt-4">
          <View className="flex-row justify-between">
            <Typography variant="body-12" color="secondary">
              Min: {minValue}
            </Typography>
            <Typography variant="body-12" color="secondary">
              Max: {maxValue}
            </Typography>
          </View>
        </View>
      )}
    </Card>
  );
};