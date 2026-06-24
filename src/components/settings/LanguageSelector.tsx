import React, { FC, useState } from 'react';
import { View, Modal, Pressable, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';

import { Typography } from '../ui/Typography';
import { useUnifiedStore } from '../../store/unified-store';
import { useAppStore } from '../../store';
import { setLanguage } from '../../i18n';
import { SUPPORTED_LANGUAGES, getLanguageByCode, DEFAULT_LANGUAGE } from '../../i18n/languages';

/**
 * Apply a language choice everywhere: switch the live UI, persist it to the
 * synced preference, and (if signed in) push it to the cloud now. The explicit
 * `syncSettings()` mirrors the onboarding flow — the sync middleware's
 * first-change baseline skip can otherwise drop a settings change.
 */
async function changeAppLanguage(code: string): Promise<void> {
  setLanguage(code);
  await useUnifiedStore.getState().updatePreferences({ language: code });
  if (useAppStore.getState().auth.isAuthenticated) {
    await useAppStore.getState().sync.syncSettings();
  }
}

interface LanguageSelectorSheetProps {
  visible: boolean;
  onClose: () => void;
}

/** Bottom-anchored modal listing every shipped language. */
export const LanguageSelectorSheet: FC<LanguageSelectorSheetProps> = ({ visible, onClose }) => {
  const { t } = useTranslation();
  const current = useUnifiedStore((state) => state.preferences.language) ?? DEFAULT_LANGUAGE;

  const handleSelect = (code: string) => {
    changeAppLanguage(code);
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent>
      <Pressable className="flex-1 bg-black/60 justify-center items-center px-6" onPress={onClose}>
        <Pressable className="w-full max-w-sm" onPress={(e) => e.stopPropagation()}>
          <View className="bg-light-bg dark:bg-dark-bg rounded-3xl p-6 border border-light-border dark:border-dark-border">
            <Typography variant="headline-20" color="primary" className="mb-5 text-center font-semibold">
              {t('settings.language.title')}
            </Typography>

            <ScrollView className="max-h-96" showsVerticalScrollIndicator={false}>
              {SUPPORTED_LANGUAGES.map((lang) => {
                const selected = lang.code === current;
                return (
                  <Pressable
                    key={lang.code}
                    onPress={() => handleSelect(lang.code)}
                    className="flex-row items-center justify-between py-3.5 px-2 active:opacity-70"
                  >
                    <Typography variant="subtitle-16" color={selected ? 'primary' : 'secondary'}>
                      {lang.nativeName}
                    </Typography>
                    {selected && <Ionicons name="checkmark" size={22} color="#51BC6F" />}
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
};

/**
 * Compact globe + current-language trigger for the onboarding header. Opens the
 * selector sheet on its own; no parent state required.
 */
export const LanguageTrigger: FC<{ className?: string }> = ({ className }) => {
  const [open, setOpen] = useState(false);
  const current = useUnifiedStore((state) => state.preferences.language) ?? DEFAULT_LANGUAGE;
  const label = getLanguageByCode(current)?.nativeName ?? current;

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        className={`flex-row items-center py-2 px-3 active:opacity-70 ${className ?? ''}`}
      >
        <Ionicons name="globe-outline" size={18} color="#8B7FFF" />
        <Typography variant="body-14" className="ml-1.5 text-primary">
          {label}
        </Typography>
      </Pressable>
      <LanguageSelectorSheet visible={open} onClose={() => setOpen(false)} />
    </>
  );
};
