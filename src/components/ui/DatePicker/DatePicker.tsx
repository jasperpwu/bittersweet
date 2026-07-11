import React, { FC, useState } from 'react';
import { View, Pressable, Platform, Modal, useColorScheme } from 'react-native';
import { colors } from '../../../config/theme';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { Typography } from '../Typography';

interface DatePickerProps {
  value: Date;
  onChange: (date: Date) => void;
  label?: string;
  error?: string;
  disabled?: boolean;
  minimumDate?: Date;
  maximumDate?: Date;
}

export const DatePicker: FC<DatePickerProps> = ({
  value,
  onChange,
  label,
  error,
  disabled = false,
  minimumDate,
  maximumDate,
}) => {
  const { t, i18n } = useTranslation();
  const colorScheme = useColorScheme();
  const [showPicker, setShowPicker] = useState(false);
  const [tempValue, setTempValue] = useState(value);

  // Sync temp value when picker opens
  React.useEffect(() => {
    if (showPicker) setTempValue(value);
  }, [showPicker, value]);

  const formatDate = (date: Date) => {
    return date.toLocaleDateString(i18n.language, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const handleDateChange = (event: any, selectedDate?: Date) => {
    if (Platform.OS === 'android') {
      setShowPicker(false);
      if (selectedDate) {
        onChange(selectedDate);
      }
    } else {
      if (selectedDate) {
        setTempValue(selectedDate);
      }
    }
  };

  const handleConfirm = () => {
    setShowPicker(false);
    onChange(tempValue);
  };

  const handleCancel = () => {
    setShowPicker(false);
  };

  const handlePress = () => {
    if (!disabled) {
      setShowPicker(true);
    }
  };

  return (
    <View className="w-full">
      {label && (
        <Typography variant="subtitle-14-medium" color="primary" className="mb-2">
          {label}
        </Typography>
      )}

      <Pressable
        onPress={handlePress}
        disabled={disabled}
        className={`
          flex-row items-center justify-between
          bg-transparent border border-light-border dark:border-dark-border
          rounded-xl px-4 py-3 min-h-12
          ${disabled ? 'opacity-50' : 'active:opacity-80'}
          ${error ? 'border-error' : ''}
        `}
        accessibilityRole="button"
        accessibilityLabel={t('datePicker.a11yLabel', { date: formatDate(value) })}
        accessibilityHint={t('datePicker.a11yHint')}
      >
        <Typography variant="body-14" color="primary">
          {formatDate(value)}
        </Typography>

        <Ionicons
          name="calendar-outline"
          size={20}
          color={colors.primary}
        />
      </Pressable>

      {error && (
        <Typography variant="body-12" color="error" className="mt-1">
          {error}
        </Typography>
      )}

      {showPicker && (
        Platform.OS === 'ios' ? (
          <Modal transparent visible={showPicker} animationType="fade">
            <View className="flex-1 bg-black/60 justify-center items-center px-6">
              <View className="bg-light-bg dark:bg-dark-bg rounded-3xl p-6 w-full max-w-sm border border-light-border dark:border-dark-border">
                <Typography variant="headline-20" color="primary" className="mb-4 text-center">
                  {t('datePicker.selectDate')}
                </Typography>
                <DateTimePicker
                  value={tempValue}
                  mode="date"
                  display="spinner"
                  onChange={handleDateChange}
                  {...(minimumDate ? { minimumDate } : {})}
                  {...(maximumDate ? { maximumDate } : {})}
                  textColor={colorScheme === 'dark' ? colors.dark.textPrimary : colors.light.screenTextPrimary}
                  accentColor={colors.primary}
                />
                <View className="flex-row justify-end mt-6 gap-3">
                  <Pressable
                    onPress={handleCancel}
                    className="flex-1 bg-light-border/30 dark:bg-gray-700 rounded-xl py-3 items-center justify-center active:opacity-80"
                  >
                    <Typography variant="subtitle-14-semibold" color="primary">{t('common.cancel')}</Typography>
                  </Pressable>
                  <Pressable
                    onPress={handleConfirm}
                    className="flex-1 bg-primary rounded-xl py-3 items-center justify-center active:opacity-80"
                  >
                    <Typography variant="subtitle-14-semibold" color="white">{t('common.confirm')}</Typography>
                  </Pressable>
                </View>
              </View>
            </View>
          </Modal>
        ) : (
          <DateTimePicker
            value={value}
            mode="date"
            display="default"
            onChange={handleDateChange}
            {...(minimumDate ? { minimumDate } : {})}
            {...(maximumDate ? { maximumDate } : {})}
          />
        )
      )}
    </View>
  );
};
