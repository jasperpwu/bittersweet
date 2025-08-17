import React, { FC, ReactNode } from 'react';
import { Modal as RNModal, View, Pressable, ModalProps as RNModalProps } from 'react-native';

interface ModalProps extends Omit<RNModalProps, 'children'> {
  isVisible: boolean;
  onClose: () => void;
  children: ReactNode;
  size?: 'small' | 'medium' | 'large' | 'fullscreen';
}


export const Modal: FC<ModalProps> = ({
  isVisible,
  onClose,
  children,
  size = 'medium',
  ...props
}) => {
  return (
    <RNModal
      visible={isVisible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      {...props}
    >
      <View className="flex-1 bg-black/50 justify-center items-center p-4">
        <Pressable 
          className="absolute inset-0" 
          onPress={onClose}
        />
        <View
          className={`
            bg-white dark:bg-dark-bg rounded-2xl p-6 shadow-xl
            ${size === 'small' ? 'w-80' : 
              size === 'large' ? 'w-full max-w-lg' : 
              size === 'fullscreen' ? 'w-full h-full rounded-none' : 'w-full max-w-md'
            }
          `}
        >
          {children}
        </View>
      </View>
    </RNModal>
  );
};