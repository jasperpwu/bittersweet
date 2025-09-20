import React, { useState } from 'react';
import {
  View,
  SafeAreaView,
  Pressable,
  Alert
} from 'react-native';
import { Typography } from '../../src/components/ui/Typography';
import { useBlocklist, useBlocklistActions } from '../../src/store';
import { useDeviceIntegration } from '../../src/hooks/useDeviceIntegration';
import { router } from 'expo-router';
import { DeviceActivitySelectionView, DeviceActivitySelectionViewPersisted } from 'react-native-device-activity';

export default function AppSelectionScreen() {
  const { triggerHaptic } = useDeviceIntegration();
  const { updateBlockedApps } = useBlocklistActions();
  const { settings } = useBlocklist();

  // Initialize with current stored selection if any
  const [selectedApps, setSelectedApps] = useState<string | null>(null);
  const [hasSelection, setHasSelection] = useState(false);
  const [selectionCounts, setSelectionCounts] = useState({
    applicationCount: 0,
    categoryCount: 0,
    webDomainCount: 0
  });

  // Initialize counts from current stored data
  React.useEffect(() => {
    console.log('🔍 Initializing with current blocklist settings:', settings.blockedApps);
    const { applicationTokens, categoryTokens, webDomainTokens } = settings.blockedApps;

    // Try to get the stored token from the first app (if any)
    const storedToken = applicationTokens.length > 0 ? applicationTokens[0].id :
                       categoryTokens.length > 0 ? categoryTokens[0].id :
                       webDomainTokens.length > 0 ? webDomainTokens[0].id : null;

    console.log('🔍 Found stored token:', storedToken);

    if (storedToken && storedToken !== 'selected.apps' && storedToken !== 'selected.categories' && storedToken !== 'selected.domains') {
      setSelectedApps(storedToken);
      setSelectionCounts({
        applicationCount: applicationTokens.length,
        categoryCount: categoryTokens.length,
        webDomainCount: webDomainTokens.length
      });
      setHasSelection(true);
      console.log('🔍 Initialized with existing selection');
    }
  }, [settings.blockedApps]);

  const handleClose = () => {
    triggerHaptic('light');
    router.back();
  };

  const handleSave = async () => {
    console.log('🔍 Save button pressed');
    console.log('🔍 Current state:');
    console.log('  - selectedApps:', selectedApps);
    console.log('  - selectionCounts:', selectionCounts);
    console.log('  - hasSelection:', hasSelection);

    if (!selectedApps) {
      console.log('❌ No selectedApps, showing alert');
      Alert.alert(
        'No Selection',
        'Please select apps to block before saving.',
        [{ text: 'OK' }]
      );
      return;
    }

    try {
      triggerHaptic('light');

      // Get the latest selection counts from the last event
      const metadata = {
        applicationCount: selectionCounts.applicationCount,
        categoryCount: selectionCounts.categoryCount,
        webDomainCount: selectionCounts.webDomainCount
      };

      console.log('🔍 Calling updateBlockedApps with:');
      console.log('  - selection token:', selectedApps);
      console.log('  - metadata:', metadata);

      // Pass the token string and metadata to updateBlockedApps
      await updateBlockedApps(selectedApps, metadata);
      console.log('✅ updateBlockedApps completed successfully');
      triggerHaptic('success');

      Alert.alert(
        'Success',
        'Selected apps have been added to the block list.',
        [{ text: 'OK', onPress: () => router.back() }]
      );
    } catch (error) {
      console.error('❌ Failed to save app selection:', error);
      Alert.alert(
        'Error',
        'Failed to save app selection. Please try again.',
        [{ text: 'OK' }]
      );
      triggerHaptic('error');
    }
  };

  const handleSelectionChange = (event: any) => {
    console.log('🔍 App selection changed (Persisted)');
    console.log('🔍 Event type:', typeof event);

    // DeviceActivitySelectionViewPersisted uses a different event structure
    if (event && event.nativeEvent) {
      console.log('🔍 nativeEvent exists');
      const nativeEvent = event.nativeEvent;

      // Log individual properties for DeviceActivitySelectionViewPersisted
      console.log('🔍 applicationCount:', nativeEvent.applicationCount);
      console.log('🔍 categoryCount:', nativeEvent.categoryCount);
      console.log('🔍 webDomainCount:', nativeEvent.webDomainCount);
      console.log('🔍 includeEntireCategory:', nativeEvent.includeEntireCategory);

      const { applicationCount, categoryCount, webDomainCount, includeEntireCategory } = nativeEvent;

      console.log('🔍 Parsed values:');
      console.log('  - applicationCount:', applicationCount);
      console.log('  - categoryCount:', categoryCount);
      console.log('  - webDomainCount:', webDomainCount);
      console.log('  - includeEntireCategory:', includeEntireCategory);

      // For DeviceActivitySelectionViewPersisted, we use the familyActivitySelectionId
      setSelectedApps('bittersweet-blocklist');
      setSelectionCounts({
        applicationCount: applicationCount || 0,
        categoryCount: categoryCount || 0,
        webDomainCount: webDomainCount || 0
      });
      setHasSelection((applicationCount + categoryCount + webDomainCount) > 0);

      console.log('🔍 State updated - hasSelection:', (applicationCount + categoryCount + webDomainCount) > 0);
      console.log('🔍 Using persisted selection ID: bittersweet-blocklist');
    } else {
      console.log('❌ No nativeEvent found in event');
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-dark-bg">
      {/* Header */}
      <View className="h-[76px] px-5 flex-row items-center justify-between border-b border-dark-border">
        <Pressable onPress={handleClose} className="active:opacity-70">
          <Typography variant="body-14" className="text-primary">
            Cancel
          </Typography>
        </Pressable>
        <Typography variant="headline-18" color="white">
          Select Apps
        </Typography>
        <Pressable
          onPress={handleSave}
          className={`active:opacity-70 ${!hasSelection ? 'opacity-50' : ''}`}
        >
          <Typography variant="body-14" className="text-primary">
            Save
          </Typography>
        </Pressable>
      </View>

      {/* Instructions */}
      <View className="px-5 py-4 bg-blue-500/10 border-b border-blue-500/20">
        <Typography variant="body-12" color="secondary" className="text-center">
          Select the apps and categories you want to block during focus sessions.
        </Typography>
      </View>

      {/* Device Activity Selection View */}
      <View className="flex-1">
        <DeviceActivitySelectionViewPersisted
          style={{ flex: 1 }}
          onSelectionChange={handleSelectionChange}
          familyActivitySelectionId="bittersweet-blocklist"
          headerText="Choose apps and categories to block"
          footerText="Selected apps will be blocked during focus sessions. You can unlock them temporarily using fruits."
          includeEntireCategory={true}
        />
      </View>
    </SafeAreaView>
  );
}