import React, { useEffect, useState } from 'react';
import { View, Pressable, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Typography } from '../ui/Typography';
import { useInviteLink } from '../../hooks/useInviteLink';
import { showToast } from '../ui/Toast';

export const InviteLinkCard: React.FC = () => {
  const { inviteLink, isGenerating, generate, copyToClipboard, shareLink } = useInviteLink();
  const [hasCopied, setHasCopied] = useState(false);

  // Auto-generate the link on mount
  useEffect(() => {
    if (!inviteLink) {
      generate();
    }
  }, []);

  const handleCopy = async () => {
    await copyToClipboard();
    setHasCopied(true);
    showToast('Link copied!', 'success');
    setTimeout(() => setHasCopied(false), 2000);
  };

  // Extract just the code portion for display
  const displayCode = inviteLink?.split('/').pop() || '';

  return (
    <View className="bg-light-border/30 dark:bg-[#242540] rounded-2xl p-5">
      <Typography variant="subtitle-16" color="primary" className="mb-2">
        Your Invite Link
      </Typography>
      <Typography variant="body-12" color="secondary" className="mb-4">
        Share this link with friends to add them to your Grove. They'll need Bittersweet installed.
      </Typography>

      {/* Link display */}
      <View className="bg-light-bg dark:bg-dark-bg rounded-xl px-4 py-3 mb-4">
        {isGenerating ? (
          <ActivityIndicator size="small" color="#6592E9" />
        ) : (
          <Typography variant="body-14" color="primary" className="text-center" selectable>
            bittersweet-mobile://invite/{displayCode}
          </Typography>
        )}
      </View>

      {/* Action buttons */}
      <View className="flex-row gap-3">
        <Pressable
          onPress={handleCopy}
          disabled={isGenerating}
          className="flex-1 bg-primary/10 rounded-xl py-3 flex-row items-center justify-center active:opacity-70"
        >
          <Ionicons
            name={hasCopied ? 'checkmark' : 'copy-outline'}
            size={18}
            color="#6592E9"
          />
          <Typography variant="subtitle-14-medium" className="ml-2" style={{ color: '#6592E9' }}>
            {hasCopied ? 'Copied' : 'Copy'}
          </Typography>
        </Pressable>

        <Pressable
          onPress={shareLink}
          disabled={isGenerating}
          className="flex-1 bg-primary rounded-xl py-3 flex-row items-center justify-center active:opacity-80"
        >
          <Ionicons name="share-outline" size={18} color="#FFFFFF" />
          <Typography variant="subtitle-14-medium" className="ml-2" style={{ color: '#FFFFFF' }}>
            Share
          </Typography>
        </Pressable>
      </View>
    </View>
  );
};
