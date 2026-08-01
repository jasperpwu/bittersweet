import React, { FC, useCallback, useEffect, useState } from 'react';
import { View, Text, Pressable, ActivityIndicator, useWindowDimensions } from 'react-native';
import * as AppleAuthentication from 'expo-apple-authentication';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';

import { Typography } from '../ui/Typography';
import { BottomSheet } from '../ui/BottomSheet';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { useAppStore } from '../../store';
import { MIN_PASSWORD_LENGTH } from '../../store/slices/authSlice';
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

/**
 * `providers` is the default face of the sheet — Apple/Google stay the primary
 * path. The email modes are opened deliberately and each own the whole sheet, so
 * a form is never competing with the brand buttons for attention.
 */
type SheetMode = 'providers' | 'signIn' | 'signUp' | 'forgotPassword' | 'checkEmail';

// The sheet is fixed-height, so each mode declares what its content needs.
const MODE_HEIGHT: Record<SheetMode, number> = {
  providers: 400,
  signIn: 470,
  signUp: 470,
  forgotPassword: 360,
  checkEmail: 340,
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
  /** Which face the sheet opens on. Callers that already show Apple/Google
   *  themselves (the Settings tab) open straight on 'signIn' so the sheet isn't
   *  a second copy of the buttons the user just scrolled past. */
  initialMode?: Extract<SheetMode, 'providers' | 'signIn'>;
}

/** Slide-up sheet offering all sign-in methods (Apple, Google, email). */
export const SignInSheet: FC<SignInSheetProps> = ({
  visible,
  onClose,
  onSignedIn,
  onClosed,
  subtitle,
  initialMode = 'providers',
}) => {
  const { t } = useTranslation();
  const { height: screenHeight } = useWindowDimensions();
  const { isLoading, error, isAuthenticated } = useAppStore((state) => state.auth);
  const signInWithApple = useAppStore((state) => state.auth.signInWithApple);
  const signInWithGoogle = useAppStore((state) => state.auth.signInWithGoogle);
  const signInWithEmail = useAppStore((state) => state.auth.signInWithEmail);
  const signUpWithEmail = useAppStore((state) => state.auth.signUpWithEmail);
  const sendPasswordReset = useAppStore((state) => state.auth.sendPasswordReset);
  const clearAuthError = useAppStore((state) => state.auth.clearAuthError);

  const [mode, setMode] = useState<SheetMode>(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);

  // Reset whenever the sheet is dismissed, so reopening it never lands mid-flow
  // on a stale form.
  useEffect(() => {
    if (!visible) {
      setMode(initialMode);
      setEmail('');
      setPassword('');
      setLocalError(null);
    }
  }, [visible, initialMode]);

  // The confirmation flow finishes OUT OF BAND: the user leaves for their inbox,
  // taps the link, and the deep-link handler signs them in. No handler here ever
  // returns, so without this the sheet would still be sitting on "check your
  // email" over an app they're now signed into. Scoped to checkEmail — every
  // other path closes itself and would double-fire onSignedIn.
  useEffect(() => {
    if (visible && isAuthenticated && mode === 'checkEmail') {
      onClose();
      onSignedIn?.();
    }
  }, [visible, isAuthenticated, mode, onClose, onSignedIn]);

  const goToMode = useCallback(
    (next: SheetMode) => {
      setLocalError(null);
      clearAuthError();
      setMode(next);
    },
    [clearAuthError]
  );

  const handleProviderSignIn = async (signIn: () => Promise<void>) => {
    await signIn();
    // Cancel and failure leave the sheet open (error shows inline).
    if (useAppStore.getState().auth.isAuthenticated) {
      onClose();
      onSignedIn?.();
    }
  };

  const validateCredentials = () => {
    if (!email.trim() || !email.includes('@')) {
      setLocalError(t('auth.invalidEmail'));
      return false;
    }
    if (password.length < MIN_PASSWORD_LENGTH) {
      setLocalError(t('auth.passwordTooShort', { min: MIN_PASSWORD_LENGTH }));
      return false;
    }
    return true;
  };

  const handleEmailSignIn = async () => {
    setLocalError(null);
    if (!validateCredentials()) return;

    if (await signInWithEmail(email, password)) {
      onClose();
      onSignedIn?.();
    }
  };

  const handleEmailSignUp = async () => {
    setLocalError(null);
    if (!validateCredentials()) return;

    const outcome = await signUpWithEmail(email, password);
    if (outcome === 'signedIn') {
      onClose();
      onSignedIn?.();
    } else if (outcome === 'confirmationSent') {
      goToMode('checkEmail');
    }
  };

  const handleSendReset = async () => {
    setLocalError(null);
    if (!email.trim() || !email.includes('@')) {
      setLocalError(t('auth.invalidEmail'));
      return;
    }
    if (await sendPasswordReset(email)) goToMode('checkEmail');
  };

  // Supabase deliberately obfuscates "this email already has an account" rather
  // than erroring; the slice flags it with a sentinel so we can say something
  // useful without turning the sheet into an account-existence oracle.
  const storeError =
    error === 'EMAIL_ALREADY_REGISTERED' ? t('auth.emailAlreadyRegistered') : error;
  const shownError = localError ?? storeError;

  const renderError = () =>
    shownError ? (
      <Typography variant="body-12" color="error" className="mt-3 text-center">
        {shownError}
      </Typography>
    ) : null;

  const renderProviders = () => (
    <>
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
            onPress={() => handleProviderSignIn(signInWithApple)}
          />
          <GoogleSignInButton onPress={() => handleProviderSignIn(signInWithGoogle)} />

          <View className="my-1 flex-row items-center">
            <View className="h-px flex-1 bg-light-border dark:bg-dark-border" />
            <Typography variant="body-12" color="secondary" className="mx-3">
              {t('common.or')}
            </Typography>
            <View className="h-px flex-1 bg-light-border dark:bg-dark-border" />
          </View>

          <Button variant="outline" size="medium" fullWidth onPress={() => goToMode('signIn')}>
            <View className="flex-row items-center">
              <Ionicons name="mail-outline" size={18} color={colors.primary} />
              <Typography variant="subtitle-14-semibold" color="primary" className="ml-2">
                {t('auth.continueWithEmail')}
              </Typography>
            </View>
          </Button>
        </View>
      )}

      {renderError()}
    </>
  );

  const renderCredentialsForm = (isSignUp: boolean) => (
    <>
      <Typography variant="headline-20" color="primary" className="mb-2 text-center font-semibold">
        {isSignUp ? t('auth.createAccount') : t('auth.signInWithEmail')}
      </Typography>

      <View style={{ gap: 12 }}>
        <Input
          variant="outlined"
          placeholder={t('auth.emailPlaceholder')}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          textContentType="emailAddress"
          autoComplete="email"
          editable={!isLoading}
        />
        <Input
          variant="outlined"
          placeholder={t('auth.passwordPlaceholder')}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoCapitalize="none"
          autoComplete={isSignUp ? 'new-password' : 'current-password'}
          textContentType={isSignUp ? 'newPassword' : 'password'}
          editable={!isLoading}
          returnKeyType="go"
          onSubmitEditing={isSignUp ? handleEmailSignUp : handleEmailSignIn}
        />

        <Button
          variant="primary"
          size="medium"
          fullWidth
          loading={isLoading}
          onPress={isSignUp ? handleEmailSignUp : handleEmailSignIn}>
          {isSignUp ? t('auth.createAccount') : t('common.signIn')}
        </Button>
      </View>

      {renderError()}

      <View className="mt-4 items-center" style={{ gap: 10 }}>
        {!isSignUp && (
          <Pressable onPress={() => goToMode('forgotPassword')} hitSlop={8}>
            <Typography variant="body-12" className="text-primary">
              {t('auth.forgotPassword')}
            </Typography>
          </Pressable>
        )}
        <Pressable onPress={() => goToMode(isSignUp ? 'signIn' : 'signUp')} hitSlop={8}>
          <Typography variant="body-12" color="secondary">
            {isSignUp ? t('auth.haveAccountSignIn') : t('auth.noAccountSignUp')}
          </Typography>
        </Pressable>
        {/* Only an escape hatch when the sheet OWNS the provider buttons. Opened
            from Settings they're already on the screen behind it. */}
        {initialMode === 'providers' && (
          <Pressable onPress={() => goToMode('providers')} hitSlop={8}>
            <Typography variant="body-12" color="secondary">
              {t('auth.backToOptions')}
            </Typography>
          </Pressable>
        )}
      </View>
    </>
  );

  const renderForgotPassword = () => (
    <>
      <Typography variant="headline-20" color="primary" className="mb-2 text-center font-semibold">
        {t('auth.resetPassword')}
      </Typography>
      <Typography variant="body-14" color="secondary" className="mb-6 text-center">
        {t('auth.resetPasswordSubtitle')}
      </Typography>

      <View style={{ gap: 12 }}>
        <Input
          variant="outlined"
          placeholder={t('auth.emailPlaceholder')}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          textContentType="emailAddress"
          autoComplete="email"
          editable={!isLoading}
          returnKeyType="go"
          onSubmitEditing={handleSendReset}
        />
        <Button
          variant="primary"
          size="medium"
          fullWidth
          loading={isLoading}
          onPress={handleSendReset}>
          {t('auth.sendResetLink')}
        </Button>
      </View>

      {renderError()}

      <View className="mt-4 items-center">
        <Pressable onPress={() => goToMode('signIn')} hitSlop={8}>
          <Typography variant="body-12" color="secondary">
            {t('auth.backToSignIn')}
          </Typography>
        </Pressable>
      </View>
    </>
  );

  const renderCheckEmail = () => (
    <View className="items-center">
      <Ionicons name="mail-outline" size={40} color={colors.primary} />
      <Typography variant="headline-20" color="primary" className="mb-2 mt-4 text-center">
        {t('auth.checkYourEmail')}
      </Typography>
      <Typography variant="body-14" color="secondary" className="mb-6 text-center">
        {t('auth.checkYourEmailBody', { email: email.trim() })}
      </Typography>
      <Button variant="outline" size="medium" fullWidth onPress={() => goToMode('signIn')}>
        {t('auth.backToSignIn')}
      </Button>
    </View>
  );

  const renderContent = () => {
    switch (mode) {
      case 'signIn':
        return renderCredentialsForm(false);
      case 'signUp':
        return renderCredentialsForm(true);
      case 'forgotPassword':
        return renderForgotPassword();
      case 'checkEmail':
        return renderCheckEmail();
      default:
        return renderProviders();
    }
  };

  const isEmailMode = mode !== 'providers';

  return (
    <BottomSheet
      isVisible={visible}
      onClose={onClose}
      onClosed={onClosed}
      // Scrollable in the email modes so the keyboard can't bury the inputs
      // (the sheet's ScrollView owns automaticallyAdjustKeyboardInsets).
      scrollable={isEmailMode}
      height={Math.min(screenHeight * 0.85, MODE_HEIGHT[mode])}>
      {renderContent()}
    </BottomSheet>
  );
};
