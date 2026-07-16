import React from 'react';
import { View, Pressable, Image, ActivityIndicator, Alert } from 'react-native';
import { colors } from '../../config/theme';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { Typography } from '../ui/Typography';
import { Button } from '../ui/Button';
import { DefaultAvatar } from './DefaultAvatar';
import { isDeviceOffline } from '../../utils/network';
import { useTranslation } from 'react-i18next';

interface AvatarPickerProps {
  avatarUri: string | null;
  displayName: string;
  avatarColor: string;
  isUploading?: boolean;
  onImageSelected: (uri: string) => void;
}

export const AvatarPicker: React.FC<AvatarPickerProps> = ({
  avatarUri,
  displayName,
  avatarColor,
  isUploading = false,
  onImageSelected,
}) => {
  const { t } = useTranslation();

  const pickImage = async (source: 'library' | 'camera') => {
    const options: ImagePicker.ImagePickerOptions = {
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    };

    const result = source === 'camera'
      ? await ImagePicker.launchCameraAsync(options)
      : await ImagePicker.launchImageLibraryAsync(options);

    if (!result.canceled && result.assets[0]) {
      // Avatars upload straight to the cloud (no offline queue) — warn now, but
      // keep the photo so it uploads once the profile save succeeds online.
      if (await isDeviceOffline()) {
        Alert.alert(t('common.offlineTitle'), t('common.offlineTryFocus'));
      }
      onImageSelected(result.assets[0].uri);
    }
  };

  return (
    <View className="items-center">
      {/* Avatar preview — tappable, opens the photo library */}
      <Pressable
        onPress={() => pickImage('library')}
        disabled={isUploading}
        className="mb-6 active:opacity-80"
      >
        {isUploading ? (
          <View
            style={{
              width: 120,
              height: 120,
              borderRadius: 60,
              backgroundColor: avatarColor,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <ActivityIndicator size="large" color={colors.white} />
          </View>
        ) : avatarUri ? (
          <Image
            source={{ uri: avatarUri }}
            style={{ width: 120, height: 120, borderRadius: 60 }}
          />
        ) : (
          <DefaultAvatar
            displayName={displayName}
            color={avatarColor}
            size={120}
          />
        )}

        {/* Camera badge */}
        <View className="absolute bottom-0 right-0 w-9 h-9 rounded-full bg-primary items-center justify-center border-[3px] border-light-bg dark:border-dark-bg">
          <Ionicons name="camera" size={16} color={colors.white} />
        </View>
      </Pressable>

      {/* Action buttons */}
      <View className="flex-row gap-x-3">
        <Button
          variant="soft"
          size="small"
          disabled={isUploading}
          onPress={() => pickImage('library')}
        >
          <View className="flex-row items-center">
            <Ionicons name="images-outline" size={18} color={colors.primary} />
            <Typography variant="subtitle-14-medium" className="text-primary ml-2">
              {t('journal.library')}
            </Typography>
          </View>
        </Button>

        <Button
          variant="soft"
          size="small"
          disabled={isUploading}
          onPress={() => pickImage('camera')}
        >
          <View className="flex-row items-center">
            <Ionicons name="camera-outline" size={18} color={colors.primary} />
            <Typography variant="subtitle-14-medium" className="text-primary ml-2">
              {t('journal.camera')}
            </Typography>
          </View>
        </Button>
      </View>
    </View>
  );
};
