import React, { FC } from 'react';
import { View, Text, Pressable, ActivityIndicator, useWindowDimensions } from 'react-native';
import * as AppleAuthentication from 'expo-apple-authentication';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';

import { Typography } from '../ui/Typography';
import { BottomSheet } from '../ui/BottomSheet';
import { useAppStore } from '../../store';
import { colors } from '../../config/theme';

const BRAND_BUTTON_HEIGHT = 48;
// The native Apple button draws its own label: system font (SF), medium weight,
// pure black on the white button style. The Google label copies those values so
// the two brand buttons read identically — deliberately outside Poppins/theme
// tokens (brand styling, fixed in both light and dark, like the white background
// above). 19pt was matched by eye against the native control at this height
// (Apple's 43%-of-height web ratio renders larger than the iOS control does).
const BRAND_BUTTON_LABEL_COLOR = '#000000';
const BRAND_BUTTON_FONT_SIZE = 19;
const BRAND_BUTTON_ICON_SIZE = 17;

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
        height: BRAND_BUTTON_HEIGHT,
        backgroundColor: colors.white,
        borderWidth: 1,
        borderColor: colors.light.border,
      }}>
      <Ionicons name="logo-google" size={BRAND_BUTTON_ICON_SIZE} color={BRAND_BUTTON_LABEL_COLOR} />
      <Text
        className="ml-2"
        style={{
          color: BRAND_BUTTON_LABEL_COLOR,
          fontSize: BRAND_BUTTON_FONT_SIZE,
          fontWeight: '500',
        }}>
        {t('common.continueWithGoogle')}
      </Text>
    </Pressable>
  );
};

interface SignInSheetProps {
  visible: boolean;
  onClose: () => void;
  /** Called after a successful sign-in (the sheet closes itself first). */
  onSignedIn?: () => void;
  /** Fired once the sheet is fully dismissed — lets callers sequence a follow-on
   *  sheet (e.g. the subscription sheet) without overlapping modal presents. */
  onClosed?: () => void;
  /** Override the default subtitle to explain why sign-in is being asked for. */
  subtitle?: string;
}

/** Slide-up sheet offering both sign-in providers (Apple + Google). */
export const SignInSheet: FC<SignInSheetProps> = ({
  visible,
  onClose,
  onSignedIn,
  onClosed,
  subtitle,
}) => {
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
    <BottomSheet
      isVisible={visible}
      onClose={onClose}
      onClosed={onClosed}
      height={Math.min(screenHeight * 0.4, 320)}>
      <Typography variant="headline-20" color="primary" className="mb-2 text-center font-semibold">
        {t('common.signIn')}
      </Typography>
      <Typography variant="body-14" color="secondary" className="mb-6 text-center">
        {subtitle ?? t('account.signInPrompt')}
      </Typography>

      {isLoading ? (
        <View className="items-center py-6">
          <ActivityIndicator size="small" color={colors.primary} />
        </View>
      ) : (
        <View style={{ gap: 12 }}>
          <AppleAuthentication.AppleAuthenticationButton
            buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
            buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.WHITE}
            cornerRadius={12}
            style={{ width: '100%', height: BRAND_BUTTON_HEIGHT }}
            onPress={() => handleSignIn(signInWithApple)}
          />
          <GoogleSignInButton onPress={() => handleSignIn(signInWithGoogle)} />
        </View>
      )}

      {error && (
        <Typography variant="body-12" className="mt-3 text-center text-error">
          {error}
        </Typography>
      )}
    </BottomSheet>
  );
};
