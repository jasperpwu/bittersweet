import React, { useState } from 'react';
import {
  View,
  Pressable,
  Text,
  TextInput,
  Keyboard,
  KeyboardAvoidingView,
  Modal as RNModal,
  Platform,
  ScrollView,
  useColorScheme,
} from 'react-native';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { Typography } from '../ui/Typography';
import { Button } from '../ui/Button';
import { EmojiPickerOverlay } from '../ui/EmojiPicker/EmojiPicker';
import { DefaultAvatar } from '../grove/DefaultAvatar';
import { useAppStore } from '../../store';
import { colors } from '../../config/theme';
import type { FriendItem } from '../../services/grove/GroveFriendService';

// Create-gift form: pick a Grove friend, then name + fruit cost + optional
// emoji — same RN Modal + KeyboardAvoidingView structure as CreateRewardModal
// (the shared Modal doesn't handle the keyboard). The cost is what the
// RECIPIENT pays from their own fruits; the sender pays nothing.
export function GiftRewardModal({
  visible,
  onClose,
  onCreate,
}: {
  visible: boolean;
  onClose: () => void;
  onCreate: (recipientId: string, name: string, cost: number, emoji?: string) => void;
}) {
  const { t } = useTranslation();
  const colorScheme = useColorScheme();
  const friends = useAppStore((s) => s.grove.friends);

  const [recipientId, setRecipientId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [emoji, setEmoji] = useState('');
  const [costText, setCostText] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  const cost = parseInt(costText, 10);
  const canCreate = !!recipientId && !!name.trim() && Number.isFinite(cost) && cost >= 1;

  // Matches the modal background (bg-light-bg / bg-dark-bg) so the checkmark
  // badge reads as a cutout ring around the corner of the selected avatar.
  const avatarBadgeBorder = colorScheme === 'dark' ? colors.dark.screen : colors.light.screen;

  const reset = () => {
    setRecipientId(null);
    setName('');
    setEmoji('');
    setCostText('');
    setShowEmojiPicker(false);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleCreate = () => {
    if (!canCreate || !recipientId) return;
    onCreate(recipientId, name.trim(), cost, emoji || undefined);
    reset();
  };

  if (!visible) return null;

  return (
    <RNModal visible transparent animationType="fade" onRequestClose={handleClose}>
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <Pressable
          className="flex-1 items-center justify-center bg-black/50 px-4"
          onPress={handleClose}>
          <Pressable
            onPress={() => {}}
            className="w-full max-w-sm overflow-hidden rounded-3xl bg-light-bg dark:bg-dark-bg">
            {/* Header */}
            <View className="flex-row items-center justify-between border-b border-light-border p-6 dark:border-dark-border">
              <Typography variant="headline-20" color="primary">
                {t('store.giftModalTitle')}
              </Typography>
              <Pressable
                onPress={handleClose}
                className="h-8 w-8 items-center justify-center rounded-full bg-light-border/50 dark:bg-dark-card">
                <Ionicons
                  name="close"
                  size={20}
                  color={colorScheme === 'dark' ? colors.dark.textPrimary : colors.light.screenTextPrimary}
                />
              </Pressable>
            </View>

            <View className="p-6">
              {friends.length === 0 ? (
                <View className="items-center py-6">
                  <Typography variant="body-14" color="secondary" className="mb-4 text-center">
                    {t('store.giftNoFriends')}
                  </Typography>
                  <Pressable
                    onPress={() => {
                      handleClose();
                      router.push('/(modals)/add-friends');
                    }}
                    className="rounded-2xl bg-primary px-6 py-3 active:opacity-80">
                    <Typography variant="subtitle-14-semibold" color="white">
                      {t('store.giftAddFriends')}
                    </Typography>
                  </Pressable>
                </View>
              ) : (
                <>
                  {/* Recipient picker (single-select) */}
                  <Typography variant="body-14" color="primary" className="mb-2">
                    {t('store.giftPickFriend')}
                  </Typography>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    className="mb-4"
                    contentContainerStyle={{ gap: 12, paddingVertical: 4 }}>
                    {friends.map((friend: FriendItem) => {
                      const isSelected = recipientId === friend.profile.user_id;
                      // Once a friend is picked, fade the rest so the selection
                      // reads at a glance even when avatars share similar colors.
                      const hasSelection = !!recipientId;
                      return (
                        <Pressable
                          key={friend.profile.user_id}
                          onPress={() => setRecipientId(friend.profile.user_id)}
                          className="items-center active:opacity-70"
                          style={{ width: 64, opacity: hasSelection && !isSelected ? 0.4 : 1 }}>
                          <View
                            className={`rounded-full ${
                              isSelected
                                ? 'border-[3px] border-primary bg-primary/20'
                                : 'border-[3px] border-transparent'
                            }`}
                            style={{ padding: 2 }}>
                            {friend.profile.avatar_url ? (
                              <Image
                                source={{ uri: friend.profile.avatar_url }}
                                style={{ width: 48, height: 48, borderRadius: 24 }}
                              />
                            ) : (
                              <DefaultAvatar
                                displayName={friend.profile.display_name}
                                color={friend.profile.avatar_color}
                                size={48}
                              />
                            )}
                            {isSelected && (
                              <View
                                className="absolute items-center justify-center rounded-full bg-primary"
                                style={{
                                  bottom: -2,
                                  right: -2,
                                  width: 22,
                                  height: 22,
                                  borderWidth: 2,
                                  borderColor: avatarBadgeBorder,
                                }}>
                                <Ionicons name="checkmark" size={13} color={colors.white} />
                              </View>
                            )}
                          </View>
                          <Typography
                            variant="body-12"
                            color={isSelected ? 'primary' : 'secondary'}
                            numberOfLines={1}
                            className={`mt-1 ${isSelected ? 'font-semibold' : ''}`}>
                            {friend.profile.display_name}
                          </Typography>
                        </Pressable>
                      );
                    })}
                  </ScrollView>

                  {/* Emoji (optional) + name row — same layout as CreateRewardModal */}
                  <View className="mb-4 flex-row items-center" style={{ gap: 12 }}>
                    <Pressable
                      onPress={() => {
                        Keyboard.dismiss();
                        setShowEmojiPicker(true);
                      }}
                      className="h-12 w-12 items-center justify-center rounded-xl border border-light-border bg-light-border/30 active:opacity-80 dark:border-dark-border dark:bg-dark-card">
                      {emoji ? (
                        <Text className="text-2xl">{emoji}</Text>
                      ) : (
                        <Ionicons name="happy-outline" size={24} color={colors.primary} />
                      )}
                    </Pressable>
                    <TextInput
                      value={name}
                      onChangeText={setName}
                      placeholder={t('store.giftNamePlaceholder')}
                      placeholderTextColor={colorScheme === 'dark' ? colors.dark.textSecondary : colors.light.screenTextSecondary}
                      className="flex-1"
                      style={{
                        backgroundColor: colorScheme === 'dark' ? colors.dark.input : colors.light.input,
                        borderRadius: 12,
                        padding: 14,
                        fontSize: 16,
                        color: colorScheme === 'dark' ? colors.dark.textPrimary : colors.light.screenTextPrimary,
                        borderWidth: 1,
                        borderColor: colorScheme === 'dark' ? colors.dark.border : colors.light.screenBorder,
                      }}
                    />
                  </View>

                  {/* Cost in fruits — what the recipient pays */}
                  <Typography variant="body-14" color="primary" className="mb-2">
                    {t('store.giftCostLabel')}
                  </Typography>
                  <View className="flex-row items-center" style={{ gap: 12 }}>
                    <Text style={{ fontSize: 24 }}>🍎</Text>
                    <TextInput
                      value={costText}
                      onChangeText={(text) => setCostText(text.replace(/[^0-9]/g, ''))}
                      placeholder={t('store.customCostPlaceholder')}
                      placeholderTextColor={colorScheme === 'dark' ? colors.dark.textSecondary : colors.light.screenTextSecondary}
                      keyboardType="number-pad"
                      className="flex-1"
                      style={{
                        backgroundColor: colorScheme === 'dark' ? colors.dark.input : colors.light.input,
                        borderRadius: 12,
                        padding: 14,
                        fontSize: 16,
                        color: colorScheme === 'dark' ? colors.dark.textPrimary : colors.light.screenTextPrimary,
                        borderWidth: 1,
                        borderColor: colorScheme === 'dark' ? colors.dark.border : colors.light.screenBorder,
                      }}
                    />
                  </View>
                </>
              )}
            </View>

            {/* Actions */}
            {friends.length > 0 && (
              <View
                className="flex-row border-t border-light-border p-4 dark:border-dark-border"
                style={{ gap: 12 }}>
                <Button
                  variant="secondary"
                  size="large"
                  className="flex-1 rounded-2xl py-4"
                  onPress={handleClose}>
                  {t('common.cancel')}
                </Button>
                <Button
                  variant="primary"
                  size="large"
                  disabled={!canCreate}
                  className="flex-1 rounded-2xl py-4"
                  onPress={handleCreate}>
                  {t('store.giftCreateAction')}
                </Button>
              </View>
            )}
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>

      {/* Emoji Picker Overlay (optional emoji) */}
      {showEmojiPicker && (
        <EmojiPickerOverlay
          title={t('store.customEmojiTitle')}
          onClose={() => setShowEmojiPicker(false)}
          onEmojiSelect={(picked) => {
            setEmoji(picked);
            setShowEmojiPicker(false);
          }}
        />
      )}
    </RNModal>
  );
}
