import React, { FC } from 'react';
import { FlatList, View, Pressable } from 'react-native';
import { Typography } from '../../ui/Typography';
import { Card } from '../../ui/Card';

interface SquadMember {
  id: string;
  name: string;
  avatar?: string;
  focusMinutesToday: number;
  streak: number;
  isOnline: boolean;
}

interface Squad {
  id: string;
  name: string;
  description?: string;
  members: SquadMember[];
  totalFocusTime: number;
  createdAt: Date;
  isJoined: boolean;
}

interface SquadListProps {
  squads: Squad[];
  onSquadPress: (squad: Squad) => void;
  onJoinSquad?: (squadId: string) => void;
  onLeaveSquad?: (squadId: string) => void;
  isLoading?: boolean;
}


export const SquadList: FC<SquadListProps> = ({
  squads,
  onSquadPress,
  onJoinSquad,
  onLeaveSquad,
  isLoading = false,
}) => {
  const formatFocusTime = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0) {
      return `${hours}h ${mins}m`;
    }
    return `${mins}m`;
  };

  const renderSquad = ({ item: squad }: { item: Squad }) => (
    <Pressable onPress={() => onSquadPress(squad)} className="active:opacity-80">
      <Card variant="default" padding="medium" className="mx-4 mb-3">
        <View className="flex-row justify-between items-start mb-3">
          <View className="flex-1">
            <Typography variant="subtitle-16" color="primary" className="mb-1">
              {squad.name}
            </Typography>
            {squad.description && (
              <Typography variant="body-12" color="secondary" className="mb-2">
                {squad.description}
              </Typography>
            )}
          </View>
          
          {!squad.isJoined && onJoinSquad && (
            <Pressable
              onPress={() => onJoinSquad(squad.id)}
              className="bg-primary px-3 py-1 rounded-full active:opacity-80"
            >
              <Typography variant="body-12" color="white">
                Join
              </Typography>
            </Pressable>
          )}
          
          {squad.isJoined && onLeaveSquad && (
            <Pressable
              onPress={() => onLeaveSquad(squad.id)}
              className="bg-error px-3 py-1 rounded-full active:opacity-80"
            >
              <Typography variant="body-12" color="white">
                Leave
              </Typography>
            </Pressable>
          )}
        </View>

        {/* Squad Stats */}
        <View className="flex-row justify-between items-center mb-3">
          <View className="flex-row items-center">
            <Typography variant="body-12" color="secondary">
              {squad.members.length} members
            </Typography>
            <View className="mx-2 w-1 h-1 bg-light-text-secondary rounded-full" />
            <Typography variant="body-12" color="primary">
              {formatFocusTime(squad.totalFocusTime)} total
            </Typography>
          </View>
        </View>

        {/* Member Avatars */}
        <View className="flex-row items-center">
          <View className="flex-row -space-x-2 mr-3">
            {squad.members.slice(0, 4).map((member, index) => (
              <View
                key={member.id}
                className={`
                  w-8 h-8 rounded-full border-2 border-white dark:border-dark-bg
                  ${member.isOnline ? 'bg-success' : 'bg-light-border dark:bg-dark-border'}
                  items-center justify-center
                `}
                style={{ zIndex: 4 - index }}
              >
                <Typography variant="tiny-10" color="white">
                  {member.name.charAt(0).toUpperCase()}
                </Typography>
              </View>
            ))}
            {squad.members.length > 4 && (
              <View className="w-8 h-8 rounded-full bg-light-border dark:bg-dark-border border-2 border-white dark:border-dark-bg items-center justify-center">
                <Typography variant="tiny-10" color="primary">
                  +{squad.members.length - 4}
                </Typography>
              </View>
            )}
          </View>
          
          {squad.isJoined && (
            <Typography variant="body-12" color="success">
              Joined
            </Typography>
          )}
        </View>
      </Card>
    </Pressable>
  );

  const renderEmptyState = () => (
    <View className="flex-1 items-center justify-center py-12">
      <Typography variant="body-14" color="secondary" className="text-center">
        No squads available
      </Typography>
    </View>
  );

  return (
    <FlatList
      data={squads}
      renderItem={renderSquad}
      keyExtractor={(item) => item.id}
      ListEmptyComponent={renderEmptyState}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{
        paddingVertical: 16,
        flexGrow: 1,
      }}
    />
  );
};