import React, { useState } from 'react';
import { View, Pressable, ScrollView, useColorScheme } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Typography } from '../ui/Typography';
import { colors } from '../../config/theme';
import { BottomSheet } from '../ui/BottomSheet';
import { INTERESTS } from '../../constants/interests';
import { useTranslation } from 'react-i18next';

const MAX_INTERESTS = 5;

interface InterestPickerProps {
  value: string[];
  onChange: (interests: string[]) => void;
}

export const InterestPicker: React.FC<InterestPickerProps> = ({ value, onChange }) => {
  const { t } = useTranslation();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const [isVisible, setIsVisible] = useState(false);
  const [draft, setDraft] = useState<string[]>([]);

  const handleOpen = () => {
    setDraft([...value]);
    setIsVisible(true);
  };

  const handleToggle = (interest: string) => {
    setDraft((prev) => {
      if (prev.includes(interest)) {
        return prev.filter((i) => i !== interest);
      }
      if (prev.length >= MAX_INTERESTS) return prev;
      return [...prev, interest];
    });
  };

  const handleDone = () => {
    onChange(draft);
    setIsVisible(false);
  };

  const displayText = value.length > 0 ? value.join(', ') : null;

  return (
    <>
      {/* Trigger */}
      <Pressable
        onPress={handleOpen}
        style={{
          backgroundColor: isDark ? colors.dark.card : colors.light.input,
          borderRadius: 12,
          paddingHorizontal: 16,
          height: 48,
          borderWidth: 1,
          borderColor: isDark ? colors.dark.border : colors.light.screenBorder,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <Typography
          variant="body-14"
          style={{
            color: displayText
              ? (isDark ? colors.dark.textPrimary : colors.light.screenTextPrimary)
              : (isDark ? colors.dark.textSecondary : colors.light.screenTextSecondary),
            flex: 1,
          }}
          numberOfLines={1}
        >
          {displayText || t('interests.placeholder')}
        </Typography>
        <Ionicons
          name="chevron-down"
          size={18}
          color={isDark ? colors.dark.textSecondary : colors.light.screenTextSecondary}
        />
      </Pressable>

      {/* Bottom Sheet */}
      <BottomSheet isVisible={isVisible} onClose={() => setIsVisible(false)} height={500}>
        <View className="flex-1">
          <Typography variant="headline-18" color="primary" className="mb-4">
            {t('interests.selectTitle', { current: draft.length, max: MAX_INTERESTS })}
          </Typography>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 80 }}
          >
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
              {INTERESTS.map((interest) => {
                const isSelected = draft.includes(interest);
                return (
                  <Pressable
                    key={interest}
                    onPress={() => handleToggle(interest)}
                    style={{
                      paddingHorizontal: 14,
                      paddingVertical: 8,
                      borderRadius: 20,
                      borderWidth: 1,
                      backgroundColor: isSelected
                        ? (isDark ? colors.dark.card : colors.light.input)
                        : 'transparent',
                      borderColor: isSelected
                        ? (colors.primary)
                        : (isDark ? colors.dark.border : colors.light.screenBorder),
                    }}
                    className="active:opacity-70"
                  >
                    <Typography
                      variant="body-14"
                      style={{
                        color: isSelected
                          ? (isDark ? colors.dark.textPrimary : colors.light.screenTextPrimary)
                          : (isDark ? colors.dark.textSecondary : colors.light.screenTextSecondary),
                      }}
                    >
                      {interest}
                    </Typography>
                  </Pressable>
                );
              })}
            </View>
          </ScrollView>

          {/* Done button */}
          <View
            style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              paddingVertical: 12,
              backgroundColor: isDark ? colors.dark.background : colors.light.screen,
            }}
          >
            <Pressable
              onPress={handleDone}
              className="bg-primary rounded-xl py-3 items-center active:opacity-80"
            >
              <Typography variant="subtitle-14-medium" color="white">
                {t('common.done')}
              </Typography>
            </Pressable>
          </View>
        </View>
      </BottomSheet>
    </>
  );
};
