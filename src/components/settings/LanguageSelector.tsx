import React, { FC, useState } from 'react';
import { Alert, Pressable, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';

import { Typography } from '../ui/Typography';
import { Button } from '../ui/Button';
import { BottomSheet } from '../ui/BottomSheet';
import { colors } from '../../config/theme';
import { useUnifiedStore } from '../../store/unified-store';
import { useAppStore } from '../../store';
import i18n, { setLanguage } from '../../i18n';
import { SUPPORTED_LANGUAGES, getLanguageByCode, DEFAULT_LANGUAGE } from '../../i18n/languages';
import { applyLayoutDirection, layoutDirectionMatches } from '../../i18n/rtl';

/**
 * Apply a language choice everywhere: switch the live UI, persist it to the
 * synced preference, and (if signed in) push it to the cloud now. The explicit
 * `syncSettings()` mirrors the onboarding flow — the sync middleware's
 * first-change baseline skip can otherwise drop a settings change.
 *
 * The layout-direction step is last on purpose: it restarts the app when the
 * user crosses between an LTR and an RTL language, so the preference must
 * already be persisted and pushed by the time it runs.
 */
async function changeAppLanguage(code: string): Promise<void> {
  setLanguage(code);
  await useUnifiedStore.getState().updatePreferences({ language: code });
  if (useAppStore.getState().auth.isAuthenticated) {
    await useAppStore.getState().sync.syncSettings();
  }
  await applyLayoutDirection(code);
}

/**
 * Switch language, asking first if it means restarting.
 *
 * Only Arabic and Urdu can trigger the prompt, and only when coming from an LTR
 * language (or leaving for one) — every other switch applies silently. The copy
 * is read from the *incoming* language via `getFixedT`, because by the time the
 * user reads it that's the language they asked for.
 */
async function selectLanguage(code: string): Promise<void> {
  if (layoutDirectionMatches(code)) {
    await changeAppLanguage(code);
    return;
  }

  const tNext = i18n.getFixedT(code);
  Alert.alert(tNext('settings.language.restartTitle'), tNext('settings.language.restartMessage'), [
    { text: tNext('common.cancel'), style: 'cancel' },
    {
      text: tNext('settings.language.restartConfirm'),
      onPress: () => void changeAppLanguage(code),
    },
  ]);
}

interface LanguageSelectorSheetProps {
  visible: boolean;
  onClose: () => void;
}

/** Slide-up bottom sheet (grab handle, drag-to-dismiss) listing every shipped language. */
export const LanguageSelectorSheet: FC<LanguageSelectorSheetProps> = ({ visible, onClose }) => {
  const { t } = useTranslation();
  const { height: screenHeight } = useWindowDimensions();
  const current = useUnifiedStore((state) => state.preferences.language) ?? DEFAULT_LANGUAGE;

  const handleSelect = (code: string) => {
    onClose();
    void selectLanguage(code);
  };

  return (
    <BottomSheet isVisible={visible} onClose={onClose} height={screenHeight * 0.6} scrollable>
      <Typography variant="headline-20" color="primary" className="mb-5 text-center font-semibold">
        {t('settings.language.title')}
      </Typography>

      {SUPPORTED_LANGUAGES.map((lang) => {
        const selected = lang.code === current;
        return (
          <Pressable
            key={lang.code}
            onPress={() => handleSelect(lang.code)}
            className="flex-row items-center justify-between px-2 py-3.5 active:opacity-70">
            <Typography variant="subtitle-16" color={selected ? 'primary' : 'secondary'}>
              {lang.nativeName}
            </Typography>
            {selected && <Ionicons name="checkmark" size={22} color={colors.success} />}
          </Pressable>
        );
      })}
    </BottomSheet>
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
      <Button
        variant="ghost"
        size="small"
        className={`flex-row px-3 py-2 ${className ?? ''}`}
        onPress={() => setOpen(true)}>
        <Ionicons name="globe-outline" size={18} color={colors.primary} />
        <Typography variant="body-14" className="ml-1.5 text-primary">
          {label}
        </Typography>
      </Button>
      <LanguageSelectorSheet visible={open} onClose={() => setOpen(false)} />
    </>
  );
};
