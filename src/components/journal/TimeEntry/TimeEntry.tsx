import React, { FC } from 'react';
import { View, Pressable } from 'react-native';
import { Typography } from '../../ui/Typography';
import { Card } from '../../ui/Card';

interface TimeEntryData {
  id: string;
  startTime: Date;
  endTime: Date;
  duration: number; // in minutes
  tags: string[];
  description?: string;
  isManualEntry: boolean;
}

interface TimeEntryProps {
  entry: TimeEntryData;
  onEdit?: (entry: TimeEntryData) => void;
  onDelete?: (entryId: string) => void;
  showActions?: boolean;
}


export const TimeEntry: FC<TimeEntryProps> = ({
  entry,
  onEdit,
  onDelete,
  showActions = true,
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

  return (
    <Card variant="default" padding="medium" className="mx-4 mb-3">
      <View className="flex-row justify-between items-start">
        <View className="flex-1">
          <View className="flex-row items-center mb-2">
            <Typography variant="subtitle-14-semibold" color="primary">
              {entry.tags[0]}
            </Typography>
            {entry.isManualEntry && (
              <View className="ml-2 px-2 py-1 bg-primary/10 rounded">
                <Typography variant="tiny-10" color="primary">
                  Manual
                </Typography>
              </View>
            )}
          </View>
          
          <View className="flex-row items-center mb-2">
            <Typography variant="body-12" color="secondary">
              {formatTime(entry.startTime)} - {formatTime(entry.endTime)}
            </Typography>
            <View className="mx-2 w-1 h-1 bg-light-text-secondary rounded-full" />
            <Typography variant="body-12" color="primary">
              {formatDuration(entry.duration)}
            </Typography>
          </View>

          {entry.tags.length > 0 && (
            <View className="flex-row flex-wrap mb-2">
              {entry.tags.map((tag, index) => (
                <View 
                  key={index}
                  className="bg-light-bg dark:bg-dark-bg px-2 py-1 rounded mr-1 mb-1"
                >
                  <Typography variant="tiny-10" color="secondary">
                    {tag}
                  </Typography>
                </View>
              ))}
            </View>
          )}

          {entry.description && (
            <Typography variant="body-12" color="secondary" className="mt-1">
              {entry.description}
            </Typography>
          )}
        </View>

        {showActions && (
          <View className="flex-row ml-3">
            {onEdit && (
              <Pressable
                onPress={() => onEdit(entry)}
                className="p-2 active:opacity-60"
              >
                <Typography variant="body-12" color="primary">
                  Edit
                </Typography>
              </Pressable>
            )}
            {onDelete && (
              <Pressable
                onPress={() => onDelete(entry.id)}
                className="p-2 active:opacity-60"
              >
                <Typography variant="body-12" color="error">
                  Delete
                </Typography>
              </Pressable>
            )}
          </View>
        )}
      </View>
    </Card>
  );
};