import React, { useRef, useState } from 'react';
import {
  View,
  SafeAreaView,
  Pressable,
  Alert,
  useColorScheme
} from 'react-native';
import { Typography } from '../../src/components/ui/Typography';
import { useBlocklist, useBlocklistActions } from '../../src/store';
import { useDeviceIntegration } from '../../src/hooks/useDeviceIntegration';
import { showToast } from '../../src/components/ui/Toast';
import { router } from 'expo-router';
import { DeviceActivitySelectionView, DeviceActivitySelectionViewPersisted, getFamilyActivitySelectionId, setFamilyActivitySelectionId } from 'react-native-device-activity';
import { Stack } from 'expo-router';

export default function AppSelectionScreen() {
  const colorScheme = useColorScheme();
  const { triggerHaptic } = useDeviceIntegration();
  const { updateBlockedApps } = useBlocklistActions();
  const { settings, currentSelectionId } = useBlocklist();

  // Capture whether this is initial setup at mount time
  const [isInitialSetup] = useState(() => currentSelectionId === null);

  // Initialize with current stored selection if any
  const [selectedApps, setSelectedApps] = useState<string | null>(null);
  const [hasSelection, setHasSelection] = useState(false);
  const [hasUserEdited, setHasUserEdited] = useState(false);
  const isFirstSelectionEvent = useRef(!isInitialSetup); // skip first event when editing existing blocklist
  const [selectionCounts, setSelectionCounts] = useState({
    applicationCount: 0,
    categoryCount: 0,
    webDomainCount: 0
  });

  // Generate unique selection ID
  const generateSelectionId = () => {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    return `bittersweet-selection-${timestamp}-${random}`;
  };

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

  const executeSave = async (chargeFruit: boolean = false) => {
    console.log('🔍 Save button pressed');
    console.log('🔍 Current state:');
    console.log('  - selectedApps:', selectedApps);
    console.log('  - selectionCounts:', selectionCounts);
    console.log('  - hasSelection:', hasSelection);

    // Allow saving with no selection to clear the blocklist
    const totalSelectionCount = selectionCounts.applicationCount + selectionCounts.categoryCount + selectionCounts.webDomainCount;

    let selectionId: string | null = null;

    if (totalSelectionCount > 0) {
      // Generate a new unique selectionId for this save
      selectionId = generateSelectionId();
      console.log('🔍 Generated new selectionId:', selectionId);

      // Copy the selection from the fixed ID to our new unique ID
      const currentSelection = getFamilyActivitySelectionId('bittersweet-blocklist');
      if (currentSelection) {
        console.log('🔍 Copying selection to new ID:', currentSelection);
        setFamilyActivitySelectionId({
          id: selectionId,
          familyActivitySelection: currentSelection
        });
      }
    } else {
      console.log('🔍 No apps selected, clearing blocklist');
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
      console.log('  - selectionId:', selectionId);
      console.log('  - metadata:', metadata);

      // Pass the selectionId (or empty string to clear) and metadata to updateBlockedApps
      await updateBlockedApps(selectionId || '', metadata, chargeFruit);
      console.log('✅ updateBlockedApps completed successfully');
      triggerHaptic('success');

      // Navigate back without showing alert
      router.back();
    } catch (error: any) {
      console.error('❌ Failed to save app selection:', error);
      const message = error?.message?.includes('Insufficient fruits')
        ? error.message
        : 'Failed to save app selection. Please try again.';
      Alert.alert('Error', message, [{ text: 'OK' }]);
      triggerHaptic('error');
    }
  };

  const handleSave = () => {
    if (!isInitialSetup && !hasUserEdited) {
      showToast('No updates made to block list', 'neutral');
      router.back();
      return;
    }
    // Charge fruit only if: not initial setup AND user actually changed the selection
    executeSave(!isInitialSetup && hasUserEdited);
  };

  const handleSelectionChange = (event: any) => {
    console.log('🔍 App selection changed (Persisted)');
    console.log('🔍 Event type:', typeof event);

    // Skip the initial event fired when the picker loads an existing selection
    if (isFirstSelectionEvent.current) {
      isFirstSelectionEvent.current = false;
    } else {
      setHasUserEdited(true);
    }

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

      // For DeviceActivitySelectionViewPersisted, we'll generate a new ID when saving
      const totalCount = applicationCount + categoryCount + webDomainCount;
      const hasValidSelection = totalCount > 0;

      console.log('🔍 Selection detected - hasValidSelection:', hasValidSelection);
      // We'll generate the actual selectionId when user saves, not here
      setSelectedApps(hasValidSelection ? 'pending-selection' : null);
      setSelectionCounts({
        applicationCount: applicationCount || 0,
        categoryCount: categoryCount || 0,
        webDomainCount: webDomainCount || 0
      });
      setHasSelection(hasValidSelection);

      console.log('🔍 State updated - hasSelection:', hasValidSelection);
      if (hasValidSelection) {
        const token = getFamilyActivitySelectionId('bittersweet-blocklist');
        console.log('🔍 Final selection token:', token);
      } else {
        console.log('🔍 Final selection token: null (no selection)');
      }
    } else {
      console.log('❌ No nativeEvent found in event');
    }
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView className="flex-1 bg-light-bg dark:bg-dark-bg">
      {/* Header */}
      <View className="h-[76px] px-5 flex-row items-center justify-between border-b border-light-border dark:border-dark-border">
        <Pressable onPress={handleClose} className="active:opacity-70">
          <Typography variant="body-14" className="text-primary">
            Cancel
          </Typography>
        </Pressable>
        <Typography variant="headline-18" color="primary">
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
          style={{
            flex: 1,
            backgroundColor: colorScheme === 'dark' ? '#1A1A1A' : '#F5E6D3'
          }}
          onSelectionChange={handleSelectionChange}
          familyActivitySelectionId="bittersweet-blocklist"
          headerText="Choose apps and categories to block"
          footerText="Selected apps will be blocked during focus sessions. You can unlock them temporarily using fruits."
          includeEntireCategory={true}
        />
      </View>
    </SafeAreaView>
    </>
  );
}