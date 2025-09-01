import React, { FC } from 'react';
import { View, Dimensions } from 'react-native';
import Svg, { Path, Defs, LinearGradient, Stop, Line, Text } from 'react-native-svg';
import { Typography } from '../../ui/Typography';
import { Button } from '../../ui/Button';
import { ChartDataPoint, TimePeriod } from '../../../store/types';

interface FocusSessionsChartProps {
  data: ChartDataPoint[];
  period: TimePeriod;
  onPeriodChange: (period: TimePeriod) => void;
  height?: number;
}

const { width: screenWidth } = Dimensions.get('window');
const CHART_PADDING = 40;
const Y_AXIS_WIDTH = 50; // Space for Y-axis labels
const CHART_WIDTH = screenWidth - (CHART_PADDING * 2) - Y_AXIS_WIDTH;
const GRID_LINES = 4;

export const FocusSessionsChart: FC<FocusSessionsChartProps> = ({
  data,
  period,
  onPeriodChange: _onPeriodChange,
  height = 200
}) => {
  // Validate and sanitize data
  const validData = data?.filter(point => 
    point && 
    typeof point.value === 'number' && 
    !isNaN(point.value) && 
    point.value >= 0 &&
    point.label &&
    point.date
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
            onPress={() => {/* Period selector logic - could open modal */}}
          >
            {period === 'daily' ? 'This week' : period === 'weekly' ? 'This week' : 'This month'}
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

  // Dynamic scaling based on actual data - always round up to whole hours
  const actualMaxValue = Math.max(...validData.map(d => d.value));
  const maxHours = actualMaxValue > 0 ? Math.ceil(actualMaxValue / 60) : 1; // Round up to next whole hour
  const maxValue = maxHours * 60; // Convert back to minutes for calculations
  
  // Generate path for area chart
  const generatePath = () => {
    if (validData.length === 0) return '';
    
    // Handle single data point case
    if (validData.length === 1) {
      const x = CHART_WIDTH / 2;
      const y = height - 40 - ((validData[0].value / maxValue) * (height - 80));
      if (isNaN(x) || isNaN(y)) return '';
      return `M ${Y_AXIS_WIDTH} ${height - 40} L ${Y_AXIS_WIDTH + x} ${y} L ${Y_AXIS_WIDTH + CHART_WIDTH} ${y} L ${Y_AXIS_WIDTH + CHART_WIDTH} ${height - 40} Z`;
    }
    
    const stepX = CHART_WIDTH / Math.max(validData.length - 1, 1);
    let path = '';
    
    validData.forEach((point, index) => {
      const x = Y_AXIS_WIDTH + (index * stepX);
      const y = height - 40 - ((point.value / maxValue) * (height - 80));
      
      // Ensure values are valid numbers
      if (isNaN(x) || isNaN(y) || !isFinite(x) || !isFinite(y)) return;
      
      if (index === 0) {
        path += `M ${x} ${y}`;
      } else {
        // Create smooth curves
        const prevX = Y_AXIS_WIDTH + ((index - 1) * stepX);
        const prevY = height - 40 - ((validData[index - 1].value / maxValue) * (height - 80));
        
        // Ensure previous values are valid
        if (isNaN(prevX) || isNaN(prevY) || !isFinite(prevX) || !isFinite(prevY)) return;
        
        const cpX1 = prevX + stepX * 0.4;
        const cpX2 = x - stepX * 0.4;
        path += ` C ${cpX1} ${prevY} ${cpX2} ${y} ${x} ${y}`;
      }
    });
    
    // Close the area
    const lastX = Y_AXIS_WIDTH + ((validData.length - 1) * stepX);
    if (!isNaN(lastX) && isFinite(lastX)) {
      path += ` L ${lastX} ${height - 40}`;
      path += ` L ${Y_AXIS_WIDTH} ${height - 40}`;
      path += ' Z';
    }
    
    return path;
  };

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
          onPress={() => {/* Period selector logic - could open modal */}}
        >
          {period === 'daily' ? 'This week' : period === 'weekly' ? 'This week' : 'This month'}
        </Button>
      </View>

      {/* Chart */}
      <View className="bg-dark-bg border border-dark-border rounded-xl p-4">
        <Svg width={CHART_WIDTH + Y_AXIS_WIDTH} height={height}>
          <Defs>
            <LinearGradient id="chartGradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <Stop offset="0%" stopColor="#6592E9" stopOpacity="0.3" />
              <Stop offset="100%" stopColor="#6592E9" stopOpacity="0.05" />
            </LinearGradient>
          </Defs>
          
          {/* Y-axis labels and grid lines */}
          {Array.from({ length: GRID_LINES + 1 }).map((_, index) => {
            const y = 20 + (index * (height - 60) / GRID_LINES);
            // Calculate the actual value in minutes for this grid line
            const minuteValue = maxValue - (index * maxValue / GRID_LINES);
            
            // Format label based on the value - top label is always whole hours
            let label: string;
            if (index === 0) {
              // Top label is always the max hours value
              label = `${maxHours}h`;
            } else if (minuteValue >= 60) {
              const hours = Math.floor(minuteValue / 60);
              const mins = minuteValue % 60;
              if (mins === 0) {
                label = `${hours}h`;
              } else {
                label = `${hours}h ${Math.round(mins)}m`;
              }
            } else {
              label = `${Math.round(minuteValue)}m`;
            }
            
            // Don't show duplicate labels or negative values
            if (minuteValue < 0) return null;
            
            return (
              <React.Fragment key={index}>
                {/* Y-axis label */}
                <Text
                  x={Y_AXIS_WIDTH - 10}
                  y={y + 4}
                  fontSize="10"
                  fill="#9CA3AF"
                  textAnchor="end"
                >
                  {label}
                </Text>
                {/* Grid line */}
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
          
          {/* Area chart */}
          <Path
            d={generatePath()}
            fill="url(#chartGradient)"
            stroke="#6592E9"
            strokeWidth="2"
          />
        </Svg>
        
        {/* Day labels */}
        <View className="flex-row justify-between mt-2">
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
      </View>
    </View>
  );
};