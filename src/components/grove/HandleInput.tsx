import React from 'react';
import { View, TextInput, ActivityIndicator, useColorScheme } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Typography } from '../ui/Typography';
import { colors } from '../../config/theme';
import { HandleStatus } from '../../hooks/useHandleValidation';
import { useTranslation } from 'react-i18next';

interface HandleInputProps {
  value: string;
  onChangeText: (text: string) => void;
  status: HandleStatus;
}

const statusConfig: Record<HandleStatus, {
  messageKey?: string;
  color: string;
  icon?: keyof typeof Ionicons.glyphMap;
}> = {
  idle: { color: '' },
  checking: { messageKey: 'handle.checking', color: colors.light.textSecondary },
  available: { messageKey: 'handle.available', color: colors.success, icon: 'checkmark-circle' },
  taken: { messageKey: 'handle.taken', color: colors.error, icon: 'close-circle' },
  invalid: { messageKey: 'handle.invalid', color: colors.error, icon: 'alert-circle' },
  offline: { messageKey: 'common.offlineTryFocus', color: colors.error, icon: 'cloud-offline-outline' },
};

export const HandleInput: React.FC<HandleInputProps> = ({
  value,
  onChangeText,
  status,
}) => {
  const { t } = useTranslation();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const config = statusConfig[status];
  const message = config.messageKey ? t(config.messageKey) : '';

  return (
    <View>
      <View
        className="flex-row items-center rounded-xl px-4"
        style={{
          backgroundColor: isDark ? colors.dark.card : colors.light.input,
          borderWidth: 1,
          borderColor:
            status === 'available' ? colors.success :
            status === 'taken' || status === 'invalid' || status === 'offline' ? colors.error :
            isDark ? colors.dark.border : colors.light.screenBorder,
          height: 48,
        }}
      >
        <Typography variant="body-14" color="secondary" className="mr-1">
          @
        </Typography>
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={t('handle.placeholder')}
          placeholderTextColor={isDark ? colors.dark.textSecondary : colors.light.screenTextSecondary}
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="off"
          maxLength={20}
          style={{
            flex: 1,
            fontSize: 14,
            color: isDark ? colors.dark.textPrimary : colors.light.screenTextPrimary,
            fontFamily: 'Poppins-Regular',
          }}
        />
        {status === 'checking' && (
          <ActivityIndicator size="small" color={colors.primary} />
        )}
        {config.icon && (
          <Ionicons name={config.icon} size={20} color={config.color} />
        )}
      </View>

      {message ? (
        <Typography
          variant="body-12"
          style={{ color: config.color, marginTop: 4, marginLeft: 4 }}
        >
          {message}
        </Typography>
      ) : null}
    </View>
  );
};
