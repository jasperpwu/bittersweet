import React, { FC, ReactNode } from 'react';
import { Modal as RNModal, View, Pressable, ModalProps as RNModalProps } from 'react-native';

interface ModalProps extends Omit<RNModalProps, 'children'> {
  isVisible: boolean;
  onClose: () => void;
  children: ReactNode;
  size?: 'small' | 'medium' | 'large' | 'fullscreen';
  /**
   * Full-screen content rendered inside this Modal, above the card — for nested
   * sheets/pickers (e.g. the tag creator) that must present on top of this open
   * modal. iOS cannot present a sibling modal over an already-presented one, so
   * such content must live in this Modal's own tree. Matches BottomSheet.
   */
  overlay?: ReactNode;
}

export const Modal: FC<ModalProps> = ({
  isVisible,
  onClose,
  children,
  size = 'medium',
  overlay,
  ...props
}) => {
  return (
    <RNModal
      visible={isVisible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      {...props}>
      <View className="flex-1 items-center justify-center bg-black/50 p-4">
        <Pressable className="absolute inset-0" onPress={onClose} />
        <View
          className={`
            rounded-2xl border border-light-border bg-light-bg p-6 shadow-xl dark:border-dark-border dark:bg-dark-bg
            ${
              size === 'small'
                ? 'w-80'
                : size === 'large'
                  ? 'w-full max-w-lg'
                  : size === 'fullscreen'
                    ? 'h-full w-full rounded-none'
                    : 'w-full max-w-md'
            }
          `}>
          {children}
        </View>
        {overlay}
      </View>
    </RNModal>
  );
};
