import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { supabase } from '../../config/supabase';

export const PushNotificationService = {
  /**
   * Register for push notifications and store the token in Supabase.
   * Should be called after sign-in when the user is authenticated.
   */
  async registerPushToken(): Promise<string | null> {
    try {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== 'granted') {
        console.log('Push notification permission not granted');
        return null;
      }

      const projectId =
        Constants?.expoConfig?.extra?.eas?.projectId ??
        Constants?.easConfig?.projectId;

      if (!projectId) {
        console.error('Missing projectId for push token registration');
        return null;
      }

      const tokenData = await Notifications.getExpoPushTokenAsync({ projectId });
      const token = tokenData.data;

      // Store in Supabase
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.log('No authenticated user, skipping token storage');
        return token;
      }

      const { error } = await supabase
        .from('push_tokens')
        .upsert(
          { user_id: user.id, expo_push_token: token },
          { onConflict: 'user_id,expo_push_token' }
        );

      if (error) {
        console.error('Failed to store push token:', error);
      }

      return token;
    } catch (error) {
      console.error('Push token registration error:', error);
      return null;
    }
  },

  /**
   * Remove the current device's push token from Supabase (on sign-out).
   */
  async unregisterPushToken(): Promise<void> {
    try {
      const projectId =
        Constants?.expoConfig?.extra?.eas?.projectId ??
        Constants?.easConfig?.projectId;

      if (!projectId) return;

      const tokenData = await Notifications.getExpoPushTokenAsync({ projectId });
      const token = tokenData.data;

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      await supabase
        .from('push_tokens')
        .delete()
        .eq('user_id', user.id)
        .eq('expo_push_token', token);
    } catch (error) {
      console.error('Push token unregister error:', error);
    }
  },
};
