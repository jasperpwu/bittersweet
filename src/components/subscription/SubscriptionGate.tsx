import React, { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Typography } from '../ui/Typography';
import { Button } from '../ui/Button';
import { UpgradeSheet } from './UpgradeSheet';
import { useAppStore } from '../../store';
import { colors } from '../../config/theme';

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
      <Button
        variant="ghost"
        fullWidth
        onPress={() => setShowUpgrade(true)}
        className="rounded-2xl bg-light-border/20 p-4 dark:bg-white/[0.03]">
        <Ionicons name="lock-closed" size={20} color={colors.primary} />
        <Typography variant="subtitle-14-medium" color="primary" className="mt-2">
          Premium Feature
        </Typography>
        <Typography variant="body-12" color="secondary" className="mt-1 text-center">
          Upgrade to unlock this feature
        </Typography>
      </Button>

      <UpgradeSheet
        isVisible={showUpgrade}
        onClose={() => setShowUpgrade(false)}
      />
    </>
  );
};
