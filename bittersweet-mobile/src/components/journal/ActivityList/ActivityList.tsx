import React, { FC } from 'react';
import { FlatList, View } from 'react-native';
import { Typography } from '../../ui/Typography';
import { TimeEntry } from '../TimeEntry';

interface TimeEntryData {
  id: string;
  startTime: Date;
  endTime: Date;
  duration: number;
  tags: string[];
  description?: string;
  isManualEntry: boolean;
}

interface ActivityListProps {
  entries: TimeEntryData[];
  onEditEntry?: (entry: TimeEntryData) => void;
  onDeleteEntry?: (entryId: string) => void;
  onRefresh?: () => void;
  isRefreshing?: boolean;
  emptyMessage?: string;
}


export const ActivityList: FC<ActivityListProps> = ({
  entries,
  onEditEntry,
  onDeleteEntry,
  onRefresh,
  isRefreshing = false,
  emptyMessage = "No activities recorded yet",
}) => {
  const renderEntry = ({ item }: { item: TimeEntryData }) => (
    <TimeEntry
      entry={item}
      onEdit={onEditEntry}
      onDelete={onDeleteEntry}
      showActions={!!(onEditEntry || onDeleteEntry)}
    />
  );

  const renderEmptyState = () => (
    <View className="flex-1 items-center justify-center py-12">
      <Typography variant="body-14" color="secondary" className="text-center">
        {emptyMessage}
      </Typography>
    </View>
  );

  const renderSeparator = () => <View className="h-2" />;

  return (
    <FlatList
      data={entries}
      renderItem={renderEntry}
      keyExtractor={(item) => item.id}
      ItemSeparatorComponent={renderSeparator}
      ListEmptyComponent={renderEmptyState}
      onRefresh={onRefresh}
      refreshing={isRefreshing}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{
        paddingVertical: 16,
        flexGrow: 1,
      }}
    />
  );
};