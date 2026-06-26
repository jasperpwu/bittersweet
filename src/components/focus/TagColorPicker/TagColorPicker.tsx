import React, { FC } from 'react';
import { View, Pressable, ScrollView, useColorScheme } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Typography } from '../../ui';
import { TAG_COLOR_FAMILIES, isLightColor } from '../../../config/tagColors';

interface TagColorPickerProps {
  /** Currently selected hex color. */
  selectedColor: string;
  /** Called with the tapped hex color. */
  onSelectColor: (color: string) => void;
  /** Swatch diameter in px (default 36). */
  swatchSize?: number;
}

/**
 * Tag color picker grouped into labeled family sections (Classic, Pastel,
 * Earth, Neutral, Neon). The selected swatch shows a checkmark in a contrasting
 * color so the selection is visible over both dark and pale swatches.
 *
 * This is the single source of the color UI — used by onboarding and the
 * create/edit tag modals. Render it inside a bounded ScrollView at the call
 * site; it lays out at its natural (tall) height.
 */
export function TagColorPicker({ selectedColor, onSelectColor, swatchSize = 36 }: TagColorPickerProps) {
  return (
    <View style={{ gap: 14 }}>
      {TAG_COLOR_FAMILIES.map((family) => (
        <View key={family.name}>
          <Typography variant="body-12" color="secondary" className="mb-2">
            {family.name}
          </Typography>
          <View className="flex-row flex-wrap" style={{ gap: 12 }}>
            {family.colors.map((color) => {
              const selected = selectedColor.toUpperCase() === color.toUpperCase();
              const indicatorColor = isLightColor(color) ? '#1A1A1A' : '#FFFFFF';
              return (
                <Pressable
                  key={color}
                  onPress={() => onSelectColor(color)}
                  hitSlop={4}
                  style={{
                    width: swatchSize,
                    height: swatchSize,
                    borderRadius: swatchSize / 2,
                    backgroundColor: color,
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderWidth: selected ? 3 : 0,
                    borderColor: indicatorColor,
                  }}
                >
                  {selected && <Ionicons name="checkmark" size={Math.round(swatchSize * 0.5)} color={indicatorColor} />}
                </Pressable>
              );
            })}
          </View>
        </View>
      ))}
    </View>
  );
}

interface ColorPickerOverlayProps {
  /** Currently selected hex color. */
  selectedColor: string;
  /** Called with the tapped hex color; the overlay closes itself after. */
  onSelectColor: (color: string) => void;
  /** Dismiss the overlay without changing the color. */
  onClose: () => void;
  title?: string;
}

/**
 * Overlay variant of the color picker — an absolute-positioned `View` (not a
 * native `<Modal>`) so it can render on top of content already inside a
 * presented Modal (the New Tag / Edit Tag overlays inside the tag picker Modal)
 * without stacking two native modals, which is unreliable on iOS. Mirrors
 * `EmojiPickerOverlay`. The caller gates rendering (`{visible && <ColorPickerOverlay .../>}`).
 */
export const ColorPickerOverlay: FC<ColorPickerOverlayProps> = ({
  selectedColor,
  onSelectColor,
  onClose,
  title = 'Choose Color',
}) => {
  const colorScheme = useColorScheme();
  const closeIconColor = colorScheme === 'dark' ? '#FFFFFF' : '#5D4E37';

  return (
    <View className="absolute inset-0 bg-black/50 justify-center items-center">
      {/* Backdrop tap closes */}
      <Pressable
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
        onPress={onClose}
      />
      <View className="bg-light-bg dark:bg-dark-bg rounded-3xl w-11/12" style={{ maxHeight: '60%' }}>
        {/* Header */}
        <View className="flex-row items-center justify-between p-6 border-b border-light-border dark:border-dark-border">
          <Typography variant="headline-20" color="primary">
            {title}
          </Typography>
          <Pressable
            onPress={onClose}
            className="w-8 h-8 rounded-full bg-light-border/30 dark:bg-gray-700 items-center justify-center"
          >
            <Ionicons name="close" size={20} color={closeIconColor} />
          </Pressable>
        </View>

        {/* Color Grid */}
        <ScrollView className="p-6" showsVerticalScrollIndicator={false}>
          <TagColorPicker
            selectedColor={selectedColor}
            onSelectColor={(color) => {
              onSelectColor(color);
              onClose();
            }}
          />
        </ScrollView>
      </View>
    </View>
  );
};
