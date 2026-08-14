import { useState, useCallback } from 'react';
import { Share } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { useAppStore } from '../store';
import { buildShareLink } from '../utils/shareLinks';

export function useReferralLink() {
  const referralCode = useAppStore((s) => s.referral.referralCode);
  const generateReferralCode = useAppStore((s) => s.referral.generateReferralCode);
  const [isGenerating, setIsGenerating] = useState(false);

  const generate = useCallback(async () => {
    if (referralCode) return referralCode;
    setIsGenerating(true);
    try {
      const code = await generateReferralCode();
      return code;
    } finally {
      setIsGenerating(false);
    }
  }, [referralCode, generateReferralCode]);

  const getLink = useCallback((code: string) => {
    return buildShareLink('refer', code);
  }, []);

  const copyToClipboard = useCallback(async () => {
    const code = referralCode || (await generate());
    if (code) {
      await Clipboard.setStringAsync(getLink(code));
    }
    return code;
  }, [referralCode, generate, getLink]);

  const shareLink = useCallback(async () => {
    const code = referralCode || (await generate());
    if (code) {
      await Share.share({
        message: `Join me on Bittersweet! ${getLink(code)}`,
      });
    }
  }, [referralCode, generate, getLink]);

  return {
    referralCode,
    referralLink: referralCode ? getLink(referralCode) : null,
    isGenerating,
    generate,
    copyToClipboard,
    shareLink,
  };
}
