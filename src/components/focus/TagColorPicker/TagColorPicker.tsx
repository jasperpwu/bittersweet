import React from 'react';
import { View, Pressable } from 'react-native';
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
