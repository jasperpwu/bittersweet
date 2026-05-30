import React from 'react';
import { View, TextInput, ActivityIndicator, useColorScheme } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Typography } from '../ui/Typography';
import { HandleStatus } from '../../hooks/useHandleValidation';

interface HandleInputProps {
  value: string;
  onChangeText: (text: string) => void;
  status: HandleStatus;
}

const statusConfig: Record<HandleStatus, {
  message: string;
  color: string;
  icon?: keyof typeof Ionicons.glyphMap;
}> = {
  idle: { message: '', color: '' },
  checking: { message: 'Checking availability...', color: '#8A8A8A' },
  available: { message: 'Available', color: '#51BC6F', icon: 'checkmark-circle' },
  taken: { message: 'Already taken', color: '#EF786C', icon: 'close-circle' },
  invalid: { message: '3-20 chars: lowercase letters, numbers, underscores', color: '#EF786C', icon: 'alert-circle' },
};

export const HandleInput: React.FC<HandleInputProps> = ({
  value,
  onChangeText,
  status,
}) => {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const config = statusConfig[status];

  return (
    <View>
      <View
        className="flex-row items-center rounded-xl px-4"
        style={{
          backgroundColor: isDark ? '#242540' : '#F0E0CC',
          borderWidth: 1,
          borderColor:
            status === 'available' ? '#51BC6F' :
            status === 'taken' || status === 'invalid' ? '#EF786C' :
            isDark ? '#575757' : '#D4C4A8',
          height: 48,
        }}
      >
        <Typography variant="body-14" color="secondary" className="mr-1">
          @
        </Typography>
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder="your_handle"
          placeholderTextColor={isDark ? '#575757' : '#B8A88A'}
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="off"
          maxLength={20}
          style={{
            flex: 1,
            fontSize: 14,
            color: isDark ? '#FFFFFF' : '#5D4E37',
            fontFamily: 'Poppins-Regular',
          }}
        />
        {status === 'checking' && (
          <ActivityIndicator size="small" color="#6592E9" />
        )}
        {config.icon && (
          <Ionicons name={config.icon} size={20} color={config.color} />
        )}
      </View>

      {config.message ? (
        <Typography
          variant="body-12"
          style={{ color: config.color, marginTop: 4, marginLeft: 4 }}
        >
          {config.message}
        </Typography>
      ) : null}
    </View>
  );
};
