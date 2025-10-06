# Design System Components

This directory contains the core UI components that implement the bittersweet design system based on Figma specifications.

## Components

### StatusBar
- Handles iOS/Android status bar styling
- White content on dark background
- Proper safe area integration

### TabBar
- Custom tab bar matching Figma design
- Active state indicators with primary color
- Smooth animations between tabs
- Supports 5 tabs: Time, Tasks, Add (+), Statistics, Settings

### Header
- Consistent header across screens
- Back navigation support
- Action buttons (settings, notifications)
- Proper typography and spacing

### Avatar
- Multiple sizes (small, medium, large)
- Edit functionality with camera icon overlay
- Fallback to initials when no image
- Proper accessibility support

### Toggle
- Smooth sliding animations
- Matches Figma toggle design
- Proper touch feedback
- Accessibility compliant

### Slider
- Session configuration with real-time value updates
- Gesture-based interaction
- Proper thumb positioning and animations
- Value labels and range indicators

### Typography
- Exact Figma font specifications
- Poppins family with proper weights
- Consistent sizing and line heights
- Dark/light theme support

### Button
- Exact Figma styling
- Proper touch feedback with scale animations
- Multiple variants (primary, secondary)
- Multiple sizes (small, medium, large)
- Disabled states

### Card
- Proper border radius and shadows
- Dark theme support
- Multiple variants (default, outlined, elevated)
- Flexible padding options

## Design Tokens

All components use consistent design tokens defined in:
- `src/config/theme.ts` - Theme configuration
- `tailwind.config.js` - NativeWind configuration

### Colors
- Primary: #6592E9
- Success: #51BC6F
- Error: #EF786C
- Dark background: #1B1C30
- Light/dark text variants

### Typography Scale
- Headlines: 24px, 20px, 18px
- Subtitles: 16px, 14px
- Body: 14px, 12px, 10px
- All using Poppins font family

### Spacing
- Based on 4px grid system
- Consistent padding and margins
- Proper touch targets (minimum 44px)

## Usage

```tsx
import { Button, Typography, Card } from '../components/ui';

// Example usage
<Card variant="elevated" padding="medium">
  <Typography variant="headline-18" color="white">
    Title
  </Typography>
  <Button variant="primary" size="medium" onPress={handlePress}>
    Action
  </Button>
</Card>
```

## Accessibility

All components include:
- Proper accessibility labels and hints
- Minimum 44px touch targets
- Screen reader support
- Focus management
- WCAG AA color contrast compliance

## Animations

Components use React Native Reanimated for:
- Button press animations (95% scale)
- Toggle sliding animations
- Smooth transitions
- 60fps performance