import React, { FC } from 'react';
import { View, Pressable, ActivityIndicator, useWindowDimensions } from 'react-native';
import * as AppleAuthentication from 'expo-apple-authentication';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';

import { Typography } from '../ui/Typography';
import { BottomSheet } from '../ui/BottomSheet';
import { useAppStore } from '../../store';
import { colors } from '../../config/theme';

/**
 * White Google sign-in button styled to sit next to the (fixed-white) Apple
 * button — both are brand buttons with the same appearance in light and dark.
 */
export const GoogleSignInButton: FC<{ onPress: () => void; disabled?: boolean }> = ({
  onPress,
  disabled,
}) => {
  const { t } = useTranslation();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      className="w-full flex-row items-center justify-center rounded-xl active:opacity-70"
      style={{
        height: 48,
        backgroundColor: colors.white,
        borderWidth: 1,
        borderColor: colors.light.border,
      }}
    >
      <Ionicons name="logo-google" size={18} color={colors.light.textPrimary} />
      <Typography
        variant="subtitle-14-medium"
        className="ml-2"
        style={{ color: colors.light.textPrimary }}
      >
        {t('common.continueWithGoogle')}
      </Typography>
    </Pressable>
  );
};

interface SignInSheetProps {
  visible: boolean;
  onClose: () => void;
  /** Called after a successful sign-in (the sheet closes itself first). */
  onSignedIn?: () => void;
}

/** Slide-up sheet offering both sign-in providers (Apple + Google). */
export const SignInSheet: FC<SignInSheetProps> = ({ visible, onClose, onSignedIn }) => {
  const { t } = useTranslation();
  const { height: screenHeight } = useWindowDimensions();
  const { isLoading, error } = useAppStore((state) => state.auth);
  const signInWithApple = useAppStore((state) => state.auth.signInWithApple);
  const signInWithGoogle = useAppStore((state) => state.auth.signInWithGoogle);

  const handleSignIn = async (signIn: () => Promise<void>) => {
    await signIn();
    // Cancel and failure leave the sheet open (error shows inline).
    if (useAppStore.getState().auth.isAuthenticated) {
      onClose();
      onSignedIn?.();
    }
  };

  return (
    <BottomSheet isVisible={visible} onClose={onClose} height={Math.min(screenHeight * 0.4, 320)}>
      <Typography variant="headline-20" color="primary" className="mb-2 text-center font-semibold">
        {t('common.signIn')}
      </Typography>
      <Typography variant="body-14" color="secondary" className="mb-6 text-center">
        {t('account.signInPrompt')}
      </Typography>

      {isLoading ? (
        <View className="items-center py-6">
          <ActivityIndicator size="small" color={colors.primary} />
        </View>
      ) : (
        <View style={{ gap: 12 }}>
          <AppleAuthentication.AppleAuthenticationButton
            buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
            buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.WHITE}
            cornerRadius={12}
            style={{ width: '100%', height: 48 }}
            onPress={() => handleSignIn(signInWithApple)}
          />
          <GoogleSignInButton onPress={() => handleSignIn(signInWithGoogle)} />
        </View>
      )}

      {error && (
        <Typography variant="body-12" className="text-error mt-3 text-center">
          {error}
        </Typography>
      )}
    </BottomSheet>
  );
};
