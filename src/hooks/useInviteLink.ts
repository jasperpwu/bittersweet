import { useState, useCallback } from 'react';
import { Share } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { useAppStore } from '../store';

export function useInviteLink() {
  const inviteLink = useAppStore((s) => s.grove.inviteLink);
  const generateInviteLink = useAppStore((s) => s.grove.generateInviteLink);
  const [isGenerating, setIsGenerating] = useState(false);

  const generate = useCallback(async () => {
    if (inviteLink) return inviteLink;
    setIsGenerating(true);
    try {
      const link = await generateInviteLink();
      return link;
    } finally {
      setIsGenerating(false);
    }
  }, [inviteLink, generateInviteLink]);

  const copyToClipboard = useCallback(async () => {
    const link = inviteLink || (await generate());
    if (link) {
      await Clipboard.setStringAsync(link);
    }
    return link;
  }, [inviteLink, generate]);

  const shareLink = useCallback(async () => {
    const link = inviteLink || (await generate());
    if (link) {
      await Share.share({
        message: `Add me on Bittersweet! ${link}`,
      });
    }
  }, [inviteLink, generate]);

  return {
    inviteLink,
    isGenerating,
    generate,
    copyToClipboard,
    shareLink,
  };
}
