import React, { useState } from 'react';
import {
  View,
  SafeAreaView,
  KeyboardAvoidingView,
  ScrollView,
  Platform,
  Alert,
} from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { Typography } from '../../src/components/ui/Typography';
import { Button } from '../../src/components/ui/Button';
import { Input } from '../../src/components/ui/Input';
import { showToast } from '../../src/components/ui/Toast';
import { useAppStore } from '../../src/store';
import { MIN_PASSWORD_LENGTH } from '../../src/store/slices/authSlice';
import { supabase } from '../../src/config/supabase';

/**
 * Final step of the password-reset flow. Reached only from the `auth/reset` deep
 * link, after `exchangeCodeForSession` has established a recovery session — that
 * session is what authorises `updateUser({ password })` here.
 */
export default function ResetPasswordModal() {
  const { t } = useTranslation();

  const isLoading = useAppStore((s) => s.auth.isLoading);
  const updatePassword = useAppStore((s) => s.auth.updatePassword);

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    setError(null);

    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(t('auth.passwordTooShort', { min: MIN_PASSWORD_LENGTH }));
      return;
    }
    if (password !== confirmPassword) {
      setError(t('auth.passwordsDoNotMatch'));
      return;
    }

    const ok = await updatePassword(password);

    if (!ok) {
      setError(useAppStore.getState().auth.error ?? t('auth.passwordUpdateFailed'));
      return;
    }

    showToast(t('auth.passwordUpdated'), 'success', undefined, undefined, 'bottom');
    router.replace('/(tabs)');
  };

  // Abandoning the reset leaves the account on its old password. The recovery
  // session is already live, so we sign it out rather than leave the device
  // holding a session the user didn't finish claiming.
  const handleCancel = () => {
    Alert.alert(t('auth.cancelResetTitle'), t('auth.cancelResetBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.ok'),
        style: 'destructive',
        onPress: async () => {
          await supabase.auth.signOut();
          router.replace('/(tabs)');
        },
      },
    ]);
  };

  return (
    <SafeAreaView className="flex-1 bg-light-bg dark:bg-dark-bg">
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerClassName="flex-grow px-6 pt-8"
          keyboardShouldPersistTaps="handled">
          <Typography variant="headline-24" color="primary" className="mb-2">
            {t('auth.setNewPassword')}
          </Typography>
          <Typography variant="body-14" color="secondary" className="mb-8">
            {t('auth.setNewPasswordSubtitle')}
          </Typography>

          <View className="mb-4">
            <Input
              variant="outlined"
              label={t('auth.newPassword')}
              placeholder={t('auth.passwordPlaceholder')}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoCapitalize="none"
              autoComplete="new-password"
              textContentType="newPassword"
              editable={!isLoading}
            />
          </View>

          <Input
            variant="outlined"
            label={t('auth.confirmPassword')}
            placeholder={t('auth.passwordPlaceholder')}
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            secureTextEntry
            autoCapitalize="none"
            autoComplete="new-password"
            textContentType="newPassword"
            editable={!isLoading}
            onSubmitEditing={handleSubmit}
            returnKeyType="done"
            error={error ?? undefined}
          />

          <Button
            variant="primary"
            size="large"
            fullWidth
            loading={isLoading}
            onPress={handleSubmit}
            className="mt-8">
            {t('auth.updatePassword')}
          </Button>

          <Button variant="ghost" size="medium" fullWidth onPress={handleCancel} className="mt-2">
            {t('common.cancel')}
          </Button>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
