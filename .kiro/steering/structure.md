# Project Structure - bittersweet

## Repository Structure
```
bittersweet/
├── mobile/                     # React Native app
│   ├── src/
│   │   ├── components/         # Reusable UI components
│   │   │   ├── common/        # Generic components (Button, Input, etc.)
│   │   │   ├── focus/         # Focus session components
│   │   │   ├── journal/       # Time journal components
│   │   │   └── squads/        # Squad-related components
│   │   ├── screens/           # Screen components
│   │   │   ├── FocusScreen.tsx
│   │   │   ├── JournalScreen.tsx
│   │   │   ├── SquadsScreen.tsx
│   │   │   └── SettingsScreen.tsx
│   │   ├── navigation/        # Navigation configuration
│   │   ├── services/          # API calls and external services
│   │   │   ├── api.ts
│   │   │   ├── screenTime.ts
│   │   │   └── notifications.ts
│   │   ├── store/             # State management
│   │   ├── utils/             # Helper functions
│   │   ├── hooks/             # Custom React hooks
│   │   ├── types/             # TypeScript type definitions
│   │   └── constants/         # App constants (colors, fonts, etc.)
│   ├── assets/                # Images, fonts, etc.
│   ├── ios/                   # iOS-specific code
│   ├── android/              # Android-specific code
│   └── package.json
├── backend/                   # Go backend
│   ├── cmd/
│   │   └── server/
│   │       └── main.go
│   ├── internal/
│   │   ├── handlers/          # HTTP handlers
│   │   ├── models/           # Data models
│   │   ├── services/         # Business logic
│   │   ├── database/         # Database operations
│   │   └── auth/             # Authentication logic
│   ├── migrations/           # Database migrations
│   ├── Dockerfile
│   └── go.mod
└── docs/                     # Documentation
```

## Naming Conventions

### Files & Directories
- **Screens**: PascalCase with "Screen" suffix (e.g., `FocusScreen.tsx`)
- **Components**: PascalCase (e.g., `FocusTimer.tsx`, `JournalEntry.tsx`)
- **Utilities**: camelCase (e.g., `timeUtils.ts`, `apiHelpers.ts`)
- **Constants**: camelCase files, UPPER_CASE exports (e.g., `colors.ts` → `PRIMARY_COLOR`)
- **Types**: PascalCase with descriptive names (e.g., `FocusSession`, `JournalEntry`)

### React Native Components
```typescript
// Component file structure
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS, FONTS } from '../constants';

interface ComponentNameProps {
  // Props interface
}

export const ComponentName: React.FC<ComponentNameProps> = ({ ...props }) => {
  return (
    <View style={styles.container}>
      {/* Component JSX */}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    // Styles
  },
});
```

### Go Backend Structure
```go
// Handler structure
package handlers

import (
    "net/http"
    "github.com/gin-gonic/gin"
)

func HandleFocusSession(c *gin.Context) {
    // Handler logic
}
```

## Import Patterns

### React Native
```typescript
// External libraries first
import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';

// Internal imports (absolute paths preferred)
import { Button } from '@/components/common';
import { COLORS, FONTS } from '@/constants';
import { useAuth } from '@/hooks';
import { FocusSession } from '@/types';
```

### Path Aliases (React Native)
```json
// Metro config or similar
{
  "@/": "./src/",
  "@/components": "./src/components",
  "@/screens": "./src/screens",
  "@/services": "./src/services",
  "@/utils": "./src/utils"
}
```

## Code Organization Principles

### Component Structure
- One component per file
- Export as named export, not default
- Props interface defined above component
- Styles at bottom of file using StyleSheet
- Custom hooks for complex logic

### State Management
- Global state for user auth, app settings, focus sessions
- Local state for UI interactions and temporary data
- Consistent action naming: `setFocusSession`, `updateJournalEntry`

### API Integration
- Centralized API service with typed responses
- Error handling at service level
- Loading states managed in components or global state

### Testing Structure
```
__tests__/
├── components/
├── screens/
├── services/
└── utils/
```

## Development Workflow
1. Create feature branch from `main`
2. Implement feature following established patterns
3. Add tests for new functionality
4. Update documentation if needed
5. Create pull request with descriptive title and body
6. Code review and merge to `main`

## Build & Deployment
- **Development**: `npm run start` for Metro bundler
- **iOS Build**: `npm run ios` or Xcode
- **Android Build**: `npm run android` or Android Studio
- **Backend**: `docker build` and `docker run` for containerized deployment