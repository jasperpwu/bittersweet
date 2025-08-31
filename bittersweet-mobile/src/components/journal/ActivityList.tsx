import React, { FC } from 'react';
import { View, ScrollView, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Typography } from '../ui/Typography';

interface ActivityEntry {
  id: string;
  startTime: Date;
  endTime: Date;
  duration: number;
  tags: string[];
  description?: string;
  isManualEntry: boolean;
}

interface ActivityListProps {
  entries: ActivityEntry[];
  onEditEntry: (entry: ActivityEntry) => void;
  onDeleteEntry: (entryId: string) => void;
  emptyMessage?: string;
}

export const ActivityList: FC<ActivityListProps> = ({
  entries,
  onEditEntry,
  onDeleteEntry,
  emptyMessage = 'No activities recorded',
}) => {
  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: false 
    });
  };

  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0) {
      return `${hours}h ${mins}m`;
    }
    return `${mins}m`;
  };

  if (entries.length === 0) {
    return (
      <View className="flex-1 items-center justify-center px-4">
        <Ionicons name="calendar-outline" size={48} color="#8A8A8A" />
        <Typography variant="body-14" color="secondary" className="mt-4 text-center">
          {emptyMessage}
        </Typography>
      </View>
    );
  }

  return (
    <ScrollView className="flex-1 px-4 py-4">
      {entries.map((entry) => (
        <View 
          key={entry.id}
          className="bg-white dark:bg-gray-800 rounded-2xl p-4 mb-3"
        >
          <View className="flex-row justify-between items-start mb-2">
            <View className="flex-1">
              <View className="flex-row items-center mb-1">
                <Typography variant="subtitle-14-semibold" color="primary">
                  {entry.tags[0]}
                </Typography>
                {entry.isManualEntry && (
                  <View className="ml-2 px-2 py-1 bg-gray-200 dark:bg-gray-600 rounded-full">
                    <Typography variant="tiny-10" color="secondary">
                      Manual
                    </Typography>
                  </View>
                )}
              </View>
              
              <Typography variant="body-12" color="secondary">
                {formatTime(entry.startTime)} - {formatTime(entry.endTime)} • {formatDuration(entry.duration)}
              </Typography>
              
              {entry.description && (
                <Typography variant="body-12" color="primary" className="mt-2">
                  {entry.description}
                </Typography>
              )}
              
              {entry.tags.length > 0 && (
                <View className="flex-row flex-wrap mt-2">
                  {entry.tags.map((tag, index) => (
                    <View 
                      key={index}
                      className="bg-primary/10 px-2 py-1 rounded-full mr-2 mb-1"
                    >
                      <Typography variant="tiny-10" color="primary">
                        {tag}
                      </Typography>
                    </View>
                  ))}
                </View>
              )}
            </View>
            
            <View className="flex-row ml-3">
              <Pressable
                onPress={() => onEditEntry(entry)}
                className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-700 items-center justify-center mr-2"
              >
                <Ionicons name="pencil" size={16} color="#6592E9" />
              </Pressable>
              
              <Pressable
                onPress={() => onDeleteEntry(entry.id)}
                className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-700 items-center justify-center"
              >
                <Ionicons name="trash" size={16} color="#EF786C" />
              </Pressable>
            </View>
          </View>
        </View>
      ))}
    </ScrollView>
  );
};