import { StatusBar } from 'expo-status-bar';
import { Platform } from 'react-native';

import { ScreenContent } from '../src/components/ui/ScreenContent';
import { Typography } from '../src/components/ui/Typography';

export default function Modal() {
  return (
    <>
      <ScreenContent>
        <Typography variant="headline-24" color="primary">
          Modal
        </Typography>
      </ScreenContent>
      <StatusBar style={Platform.OS === 'ios' ? 'light' : 'auto'} />
    </>
  );
}
