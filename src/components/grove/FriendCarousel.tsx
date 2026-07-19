import React, { useRef, useState, useCallback } from 'react';
import { FlatList, View, ViewToken } from 'react-native';
import { FriendActivityCard } from './FriendActivityCard';
import { AddFriendCard } from './AddFriendCard';
import { PageIndicator } from './PageIndicator';
import type { FeedItem } from '../../services/grove/GroveFeedService';

interface FriendCarouselProps {
  feed: FeedItem[];
  lastGroveVisit: string | null;
  onReactionToggle: (sessionId: string) => void;
  onAddFriend: () => void;
  showAddFriend?: boolean;
  // Discovery (stranger) card invites
  onInvite?: (userId: string) => void;
  invitedUserIds?: Set<string>;
  // Tapping a card opens that user's full session history feed.
  onCardPress?: (userId: string) => void;
}

const CARD_WIDTH = 280;
const CARD_GAP = 12;
const SNAP_INTERVAL = CARD_WIDTH + CARD_GAP;

export const FriendCarousel: React.FC<FriendCarouselProps> = ({
  feed,
  lastGroveVisit,
  onReactionToggle,
  onAddFriend,
  showAddFriend = true,
  onInvite,
  invitedUserIds,
  onCardPress,
}) => {
  const [activeIndex, setActiveIndex] = useState(0);
  const flatListRef = useRef<FlatList>(null);

  const totalItems = feed.length + (showAddFriend ? 1 : 0);

  const onViewableItemsChanged = useCallback(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      if (viewableItems.length > 0 && viewableItems[0].index !== null) {
        setActiveIndex(viewableItems[0].index);
      }
    },
    []
  );

  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 50,
  }).current;

  const renderItem = useCallback(
    ({ item, index }: { item: FeedItem | null; index: number }) => {
      // Last item is the add friend card (only when showAddFriend is true)
      if (showAddFriend && index === feed.length) {
        return (
          <View style={{ width: CARD_WIDTH, marginRight: CARD_GAP }}>
            <AddFriendCard onPress={onAddFriend} />
          </View>
        );
      }

      if (!item?.session) return null;

      const isNew = lastGroveVisit
        ? new Date(item.session.start_time) > new Date(lastGroveVisit)
        : false;

      return (
        <View style={{ width: CARD_WIDTH, marginRight: CARD_GAP }}>
          <FriendActivityCard
            item={item}
            onReactionToggle={onReactionToggle}
            isNew={isNew}
            onInvite={onInvite}
            invited={invitedUserIds?.has(item.profile.user_id)}
            onPress={onCardPress}
          />
        </View>
      );
    },
    [feed.length, lastGroveVisit, onReactionToggle, onAddFriend, showAddFriend, onInvite, invitedUserIds, onCardPress]
  );

  // Data array: feed items + optional null sentinel for add card
  const data = showAddFriend
    ? ([...feed, null] as (FeedItem | null)[])
    : feed;

  return (
    <View>
      <FlatList
        ref={flatListRef}
        data={data}
        renderItem={renderItem}
        keyExtractor={(item, index) =>
          item?.session?.id ?? `feed-${index}`
        }
        horizontal
        showsHorizontalScrollIndicator={false}
        snapToInterval={SNAP_INTERVAL}
        decelerationRate="fast"
        contentContainerStyle={{ paddingHorizontal: 20, paddingVertical: 4 }}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
      />
      <PageIndicator count={totalItems} activeIndex={activeIndex} />
    </View>
  );
};
