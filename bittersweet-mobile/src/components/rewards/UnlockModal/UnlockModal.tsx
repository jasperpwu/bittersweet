import React, { FC } from 'react';
import { View } from 'react-native';
import { Modal } from '../../ui/Modal';
import { Typography } from '../../ui/Typography';
import { Button } from '../../ui/Button';
import { SeedCounter } from '../SeedCounter';

interface UnlockModalProps {
  isVisible: boolean;
  onClose: () => void;
  appName: string;
  unlockCost: number;
  currentSeeds: number;
  onConfirmUnlock: () => void;
  onCancel: () => void;
}


export const UnlockModal: FC<UnlockModalProps> = ({
  isVisible,
  onClose,
  appName,
  unlockCost,
  currentSeeds,
  onConfirmUnlock,
  onCancel,
}) => {
  const canAfford = currentSeeds >= unlockCost;
  const remainingSeeds = currentSeeds - unlockCost;

  return (
    <Modal isVisible={isVisible} onClose={onClose} size="medium">
      <View className="items-center">
        <Typography variant="headline-20" color="primary" className="mb-4 text-center">
          Unlock {appName}?
        </Typography>
        
        <View className="bg-light-bg dark:bg-dark-bg rounded-xl p-4 mb-6 w-full">
          <View className="flex-row justify-between items-center mb-2">
            <Typography variant="body-14" color="secondary">
              Unlock Cost:
            </Typography>
            <SeedCounter seedCount={unlockCost} size="small" />
          </View>
          
          <View className="flex-row justify-between items-center mb-2">
            <Typography variant="body-14" color="secondary">
              Current Seeds:
            </Typography>
            <SeedCounter seedCount={currentSeeds} size="small" />
          </View>
          
          <View className="h-px bg-light-border dark:bg-dark-border my-2" />
          
          <View className="flex-row justify-between items-center">
            <Typography variant="subtitle-14-semibold" color="primary">
              Remaining:
            </Typography>
            <SeedCounter 
              seedCount={Math.max(0, remainingSeeds)} 
              size="small" 
            />
          </View>
        </View>

        {!canAfford && (
          <Typography variant="body-12" color="error" className="mb-4 text-center">
            Not enough seeds to unlock this app
          </Typography>
        )}

        <View className="flex-row space-x-3 w-full">
          <Button
            variant="secondary"
            size="medium"
            onPress={onCancel}
            className="flex-1"
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            size="medium"
            onPress={onConfirmUnlock}
            disabled={!canAfford}
            className="flex-1"
          >
            Unlock
          </Button>
        </View>
      </View>
    </Modal>
  );
};