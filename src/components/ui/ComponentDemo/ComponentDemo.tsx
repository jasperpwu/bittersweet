import React, { useState } from 'react';
import { View, ScrollView } from 'react-native';
import { StatusBar } from '../StatusBar';
import { Header } from '../Header';
import { Typography } from '../Typography';
import { Button } from '../Button';
import { Card } from '../Card';
import { Avatar } from '../Avatar';
import { Toggle } from '../Toggle';
import { Slider } from '../Slider';

export const ComponentDemo: React.FC = () => {
  const [toggleValue, setToggleValue] = useState(false);
  const [sliderValue, setSliderValue] = useState(5);

  return (
    <View className="flex-1 bg-dark-bg">
      <StatusBar variant="dark" />
      <Header
        title="Design System Demo"
        leftAction={{
          icon: '←',
          onPress: () => console.log('Back pressed'),
          accessibilityLabel: 'Go back',
        }}
        rightAction={{
          icon: '⚙️',
          onPress: () => console.log('Settings pressed'),
          accessibilityLabel: 'Settings',
        }}
      />

      <ScrollView className="flex-1 p-4" showsVerticalScrollIndicator={false}>
        {/* Typography Section */}
        <Card variant="elevated" padding="medium" className="mb-4">
          <Typography variant="headline-18" color="white" className="mb-4">
            Typography
          </Typography>
          <Typography variant="headline-24" color="white" className="mb-2">
            Headline 24
          </Typography>
          <Typography variant="headline-20" color="white" className="mb-2">
            Headline 20
          </Typography>
          <Typography variant="subtitle-16" color="white" className="mb-2">
            Subtitle 16
          </Typography>
          <Typography variant="body-14" color="secondary" className="mb-2">
            Body text 14px
          </Typography>
          <Typography variant="body-12" color="secondary">
            Small text 12px
          </Typography>
        </Card>

        {/* Buttons Section */}
        <Card variant="elevated" padding="medium" className="mb-4">
          <Typography variant="headline-18" color="white" className="mb-4">
            Buttons
          </Typography>
          <View className="space-y-3">
            <Button variant="primary" size="medium">
              Primary Button
            </Button>
            <Button variant="secondary" size="medium">
              Secondary Button
            </Button>
            <Button variant="primary" size="small">
              Small Button
            </Button>
            <Button variant="primary" size="large">
              Large Button
            </Button>
            <Button variant="primary" size="medium" disabled>
              Disabled Button
            </Button>
          </View>
        </Card>

        {/* Avatar Section */}
        <Card variant="elevated" padding="medium" className="mb-4">
          <Typography variant="headline-18" color="white" className="mb-4">
            Avatars
          </Typography>
          <View className="flex-row items-center space-x-4">
            <Avatar size="small" name="John Doe" />
            <Avatar size="medium" name="Jane Smith" showEditButton onEditPress={() => console.log('Edit avatar')} />
            <Avatar size="large" name="Bob Johnson" />
          </View>
        </Card>

        {/* Toggle Section */}
        <Card variant="elevated" padding="medium" className="mb-4">
          <Typography variant="headline-18" color="white" className="mb-4">
            Toggle Switch
          </Typography>
          <View className="flex-row items-center justify-between">
            <Typography variant="body-14" color="white">
              Enable notifications
            </Typography>
            <Toggle
              value={toggleValue}
              onValueChange={setToggleValue}
              accessibilityLabel="Toggle notifications"
            />
          </View>
        </Card>

        {/* Slider Section */}
        <Card variant="elevated" padding="medium" className="mb-4">
          <Typography variant="headline-18" color="white" className="mb-4">
            Slider
          </Typography>
          <Slider
            value={sliderValue}
            minimumValue={1}
            maximumValue={10}
            step={1}
            onValueChange={setSliderValue}
            label="Working Sessions"
            unit=" sessions"
          />
        </Card>

        {/* Card Variants */}
        <Typography variant="headline-18" color="white" className="mb-4">
          Card Variants
        </Typography>
        
        <Card variant="default" padding="medium" className="mb-4">
          <Typography variant="body-14" color="primary">
            Default Card
          </Typography>
        </Card>

        <Card variant="outlined" padding="medium" className="mb-4">
          <Typography variant="body-14" color="white">
            Outlined Card
          </Typography>
        </Card>

        <Card variant="elevated" padding="medium" className="mb-4">
          <Typography variant="body-14" color="white">
            Elevated Card
          </Typography>
        </Card>
      </ScrollView>
    </View>
  );
};