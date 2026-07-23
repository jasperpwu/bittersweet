import React, { useEffect, useState } from 'react';
import { Image } from 'expo-image';
import { DefaultAvatar } from './DefaultAvatar';

interface ProfileAvatarProps {
  avatarUrl?: string | null;
  displayName: string;
  avatarColor?: string;
  size?: number;
}

/**
 * Renders a user's profile picture from a remote URL, falling back to the
 * initials-based DefaultAvatar when there's no URL or the image fails to load.
 *
 * Why this exists: the grove profile card and the settings hero both render the
 * same remote avatar_url via expo-image, and both tabs stay mounted at once
 * (freezeOnBlur: false). Two bare <Image> views on the identical remote URI
 * could intermittently leave one blank — no recyclingKey, no cache policy, and
 * no fallback meant a lost decode/attach race or a transient load failure just
 * painted nothing. Centralizing the render with a stable recyclingKey, explicit
 * cachePolicy, and an onError fallback makes it render reliably in both places.
 */
export const ProfileAvatar: React.FC<ProfileAvatarProps> = ({
  avatarUrl,
  displayName,
  avatarColor,
  size = 48,
}) => {
  const [failed, setFailed] = useState(false);

  // Clear the error state when the URL changes (e.g. after a new upload), so a
  // fresh photo gets a chance to load even if the previous one had failed.
  useEffect(() => setFailed(false), [avatarUrl]);

  if (!avatarUrl || failed) {
    return <DefaultAvatar displayName={displayName} color={avatarColor} size={size} />;
  }

  return (
    <Image
      source={{ uri: avatarUrl }}
      style={{ width: size, height: size, borderRadius: size / 2 }}
      cachePolicy="memory-disk"
      recyclingKey={avatarUrl}
      transition={150}
      onError={({ error }) => {
        console.warn('[ProfileAvatar] failed to load avatar', avatarUrl, error);
        setFailed(true);
      }}
    />
  );
};
