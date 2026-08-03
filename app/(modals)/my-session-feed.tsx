import React, { useMemo } from 'react';
import { View, SafeAreaView, Pressable, ScrollView, Image } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { Typography } from '../../src/components/ui/Typography';
import { SessionNotes } from '../../src/components/ui/SessionNotes';
import { colors } from '../../src/config/theme';
import { useFocus } from '../../src/store';
import i18n from '../../src/i18n';
import { directionalIcon } from '../../src/utils/directionalIcon';

function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h > 0 && m > 0) return `${h}h ${m}m`;
  if (h > 0) return `${h}h`;
  return `${m}m`;
}

function formatDate(date: Date): string {
  const d = new Date(date);
  return d.toLocaleDateString(i18n.language, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

function formatTime(date: Date): string {
  const d = new Date(date);
  return d.toLocaleTimeString(i18n.language, {
    hour: 'numeric',
    minute: '2-digit',
  });
}

export default function MySessionFeedModal() {
  const { t } = useTranslation();
  const { sessions, tags } = useFocus();

  const sortedSessions = useMemo(() => {
    return sessions.allIds
      .map((id) => sessions.byId[id])
      .filter(Boolean)
      .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());
  }, [sessions]);

  return (
    <SafeAreaView className="flex-1 bg-light-bg dark:bg-dark-bg">
      {/* Header */}
      <View className="h-[56px] px-5 flex-row items-center">
        <Pressable
          onPress={() => router.back()}
          className="w-10 h-10 items-center justify-center -ml-2 active:opacity-60"
          hitSlop={8}
        >
          <Ionicons name={directionalIcon('arrow-back')} size={24} color={colors.primary} />
        </Pressable>
        <Typography variant="headline-18" color="primary" className="ml-2">
          {t('gm.feedMySessions')}
        </Typography>
      </View>

      <ScrollView className="flex-1 px-5" showsVerticalScrollIndicator={false}>
        {sortedSessions.length === 0 ? (
          <View className="py-12 items-center">
            <Typography variant="body-14" color="secondary" className="text-center">
              {t('gm.feedEmptyOwn')}
            </Typography>
          </View>
        ) : (
          <View className="pb-8">
            {sortedSessions.map((session) => {
              const tag = session.tagId ? tags.byId[session.tagId] : null;

              return (
                <View
                  key={session.id}
                  className="bg-light-border/30 dark:bg-dark-card rounded-2xl p-4 mb-3"
                >
                  {/* Tag + duration */}
                  <View className="flex-row items-center mb-2">
                    {tag && (
                      <Typography variant="body-14" color="primary" className="mr-1.5">
                        {tag.icon}
                      </Typography>
                    )}
                    <Typography
                      variant="subtitle-14-medium"
                      color="primary"
                      className="flex-1"
                      numberOfLines={1}
                    >
                      {tag?.name ?? t('gm.feedUntagged')}
                    </Typography>
                    <Typography variant="subtitle-14-medium" color="primary">
                      {formatDuration(session.duration)}
                    </Typography>
                  </View>

                  {/* Date + time range */}
                  <View className="mb-1">
                    <Typography variant="body-12" color="secondary">
                      {formatDate(session.startTime)} · {formatTime(session.startTime)} –{' '}
                      {formatTime(session.endTime)}
                    </Typography>
                  </View>

                  {/* Notes */}
                  {session.notes ? (
                    <View className="mt-2">
                      <SessionNotes notes={session.notes} />
                    </View>
                  ) : null}

                  {/* Photo thumbnail */}
                  {session.photoUrl ? (
                    <Image
                      source={{ uri: session.photoUrl }}
                      style={{ width: '100%', height: 160, borderRadius: 12, marginTop: 10 }}
                      resizeMode="cover"
                    />
                  ) : null}
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
