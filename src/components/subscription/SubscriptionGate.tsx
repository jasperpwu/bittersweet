import React, { useState } from 'react';
import { View, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Typography } from '../ui/Typography';
import { UpgradeSheet } from './UpgradeSheet';
import { useAppStore } from '../../store';

interface SubscriptionGateProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

/**
 * Renders children if user has premium subscription.
 * Otherwise shows a compact upgrade prompt or optional fallback.
 */
export const SubscriptionGate: React.FC<SubscriptionGateProps> = ({
  children,
  fallback,
}) => {
  const tier = useAppStore((state) => state.subscription.tier);
  const [showUpgrade, setShowUpgrade] = useState(false);

  if (tier === 'premium') {
    return <>{children}</>;
  }

  if (fallback) {
    return <>{fallback}</>;
  }

  return (
    <>
      <Pressable
        onPress={() => setShowUpgrade(true)}
        className="bg-[#242540] rounded-2xl p-4 items-center active:opacity-80"
      >
        <Ionicons name="lock-closed" size={20} color="#8B7FFF" />
        <Typography variant="subtitle-14-medium" color="primary" className="mt-2">
          Premium Feature
        </Typography>
        <Typography variant="body-12" color="secondary" className="mt-1 text-center">
          Upgrade to unlock this feature
        </Typography>
      </Pressable>

      <UpgradeSheet
        isVisible={showUpgrade}
        onClose={() => setShowUpgrade(false)}
      />
    </>
  );
};
