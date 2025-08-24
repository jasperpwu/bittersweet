import React, { FC } from 'react';
import { View, ScrollView, Pressable } from 'react-native';
import { Typography } from '../ui/Typography';
import { Task } from '../../store/types';

interface TimelineProps {
  tasks: Task[];
  currentTime: Date;
  onTaskPress: (taskId: string) => void;
}

export const Timeline: FC<TimelineProps> = ({
  tasks,
  currentTime,
  onTaskPress,
}) => {
  const hours = Array.from({ length: 24 }, (_, i) => i);

  const formatHour = (hour: number) => {
    return `${hour.toString().padStart(2, '0')}:00`;
  };

  const getTasksForHour = (hour: number) => {
    return tasks.filter(task => {
      const taskHour = task.startTime.getHours();
      return taskHour === hour;
    });
  };

  const getEndTime = (task: Task) => {
    return new Date(task.startTime.getTime() + task.duration * 60000);
  };

  const isCurrentHour = (hour: number) => {
    return currentTime.getHours() === hour;
  };

  return (
    <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
      {hours.map((hour) => {
        const hourTasks = getTasksForHour(hour);
        const isCurrent = isCurrentHour(hour);
        
        return (
          <View key={hour} className="flex-row mb-4">
            {/* Time column */}
            <View className="w-16 items-end pr-3 pt-1">
              <Typography 
                variant="body-12" 
                color={isCurrent ? 'primary' : 'secondary'}
              >
                {formatHour(hour)}
              </Typography>
            </View>
            
            {/* Timeline line */}
            <View className="w-px bg-gray-300 dark:bg-gray-600 relative">
              {isCurrent && (
                <View className="absolute w-3 h-3 bg-primary rounded-full -left-1.5 top-1" />
              )}
            </View>
            
            {/* Tasks column */}
            <View className="flex-1 ml-4">
              {hourTasks.length > 0 ? (
                hourTasks.map((task) => (
                  <Pressable
                    key={task.id}
                    onPress={() => onTaskPress(task.id)}
                    className={`p-3 rounded-xl mb-2 ${
                      task.status === 'completed' ? 'bg-success/20' : 'bg-gray-100 dark:bg-gray-700'
                    }`}
                    style={{ borderLeftWidth: 4, borderLeftColor: '#6592E9' }}
                  >
                    <Typography 
                      variant="subtitle-14-semibold" 
                      color="primary"
                      className={task.status === 'completed' ? 'line-through' : ''}
                    >
                      {task.title}
                    </Typography>
                    <Typography variant="body-12" color="secondary" className="mt-1">
                      {task.startTime.toLocaleTimeString('en-US', { 
                        hour: '2-digit', 
                        minute: '2-digit',
                        hour12: false 
                      })} - {getEndTime(task).toLocaleTimeString('en-US', { 
                        hour: '2-digit', 
                        minute: '2-digit',
                        hour12: false 
                      })}
                    </Typography>
                    <Typography variant="body-12" color="secondary">
                      {task.categoryId} • {task.duration}min
                    </Typography>
                  </Pressable>
                ))
              ) : (
                <View className="h-8" />
              )}
            </View>
          </View>
        );
      })}
    </ScrollView>
  );
};