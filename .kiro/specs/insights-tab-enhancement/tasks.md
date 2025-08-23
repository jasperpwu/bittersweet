# Implementation Plan

## Overview
Transform the insights tab to match Figma designs with Statistics and History views, leveraging existing Card, Typography, Button components and extending the current useFocusStore.

## Tasks

- [x] 1. Extend Focus Store with Insights Data Processing
  - **File**: `src/store/slices/focusSlice.ts`
  - **Context**: Extend existing `useFocusStore` with new actions: `getChartData(period)`, `getSessionsByDate()`, `deleteSession(id)` that processes existing `sessions` array
  - **Reuse**: Leverage existing `FocusSession` interface, `sessions` state, `removeSession` action, and Zustand persistence
  - **Implementation**: Add helper functions for date grouping, period filtering, and chart data transformation while maintaining existing store structure
  - _Requirements: 7.1-7.3_

- [x] 2. Create Reusable Session Components Using Design System
  - **Files**: `src/components/analytics/SessionItem/`, `src/components/analytics/SwipeableSessionItem/`
  - **Context**: Build `SessionItem` using existing `Card` (variant="outlined"), `Typography` (subtitle-16, body-14), with category color mapping. Create `SwipeableSessionItem` wrapper with PanGestureHandler for delete functionality
  - **Reuse**: Existing `Card`, `Typography`, `Button` components, theme colors (`colors.dark.*`), spacing tokens
  - **Implementation**: Category icons with gradients (Education/green, Music/blue, Work/purple, Meditation/yellow, Code/red), swipe-to-delete with red background (#EF786C), smooth animations
  - _Requirements: 2.3-2.7, 3.1-3.5, 5.1-5.7_

- [x] 3. Build Complete Insights Tab with Statistics and History Views
  - **File**: `app/(tabs)/insights.tsx`
  - **Context**: Transform existing insights tab into dual-view system: Statistics (default) with SVG area chart and recent sessions, History with date-grouped swipeable sessions
  - **Reuse**: Existing `Typography` for headers, `Button` for period selector, dark theme colors, navigation patterns
  - **Implementation**: Statistics view with focus sessions chart (blue gradient #6592E9, grid lines #575757), "View all" navigation to History view, proper headers with back arrows, date section grouping ("Today", "Yesterday")
  - _Requirements: 1.1-1.9, 2.1-2.2, 4.1-4.6, 6.1-6.5_

## Key Integration Points

**Existing Components to Reuse:**
- `Card` component with `variant="outlined"` and `padding="medium"`
- `Typography` with variants: `headline-18`, `subtitle-16`, `body-14`, `body-12`
- `Button` component for period selectors and actions
- Existing theme colors from `src/config/theme.ts`

**Store Integration:**
- Extend existing `useFocusStore` in `src/store/slices/focusSlice.ts`
- Reuse existing `FocusSession` interface and `sessions` array
- Leverage existing `removeSession` and `updateStats` actions

**Design System Compliance:**
- Use existing color tokens: `colors.dark.background`, `colors.dark.textPrimary`, `colors.dark.border`
- Follow existing spacing system: `spacing.lg` (16px), `spacing.xl` (20px)
- Maintain existing typography hierarchy and font weights

**File Structure:**
```
bittersweet-mobile/src/components/analytics/
├── SessionItem/
│   ├── SessionItem.tsx (new)
│   └── index.ts (new)
├── SwipeableSessionItem/
│   ├── SwipeableSessionItem.tsx (new)
│   └── index.ts (new)
├── FocusSessionsChart/
│   ├── FocusSessionsChart.tsx (new)
│   └── index.ts (new)
├── StatisticsView/
│   ├── StatisticsView.tsx (new)
│   └── index.ts (new)
├── HistoryView/
│   ├── HistoryView.tsx (new)
│   └── index.ts (new)
└── index.ts (update existing)

bittersweet-mobile/app/(tabs)/insights.tsx (update existing)
bittersweet-mobile/src/store/slices/focusSlice.ts (extend existing)
```

**Dependencies to Install:**
- `react-native-svg` (for chart rendering)
- `react-native-gesture-handler` (for swipe actions)
- `react-native-reanimated` (already installed, for animations)