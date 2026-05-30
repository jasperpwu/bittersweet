import React from 'react';
import { View, Pressable, Image, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { Typography } from '../ui/Typography';
import { DefaultAvatar } from './DefaultAvatar';

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
      onImageSelected(result.assets[0].uri);
    }
  };

  return (
    <View className="items-center">
      {/* Avatar preview */}
      <View className="mb-6">
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
            <ActivityIndicator size="large" color="#FFFFFF" />
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
      </View>

      {/* Action buttons */}
      <View className="flex-row gap-x-3">
        <Pressable
          onPress={() => pickImage('library')}
          disabled={isUploading}
          className="flex-row items-center bg-primary/20 rounded-xl px-4 py-3 active:opacity-70"
        >
          <Ionicons name="images-outline" size={18} color="#6592E9" />
          <Typography variant="subtitle-14-medium" className="text-primary ml-2">
            Library
          </Typography>
        </Pressable>

        <Pressable
          onPress={() => pickImage('camera')}
          disabled={isUploading}
          className="flex-row items-center bg-primary/20 rounded-xl px-4 py-3 active:opacity-70"
        >
          <Ionicons name="camera-outline" size={18} color="#6592E9" />
          <Typography variant="subtitle-14-medium" className="text-primary ml-2">
            Camera
          </Typography>
        </Pressable>
      </View>
    </View>
  );
};
