## Project Overview
Bittersweet — an iOS mobile app built with Expo 53 (React Native), TypeScript, Expo Router, and NativeWind (Tailwind CSS).

## Tech Stack
- **Framework:** Expo 53, React Native
- **Language:** TypeScript
- **Routing:** Expo Router (file-based, `app/` directory)
- **Styling:** NativeWind / Tailwind CSS
- **State:** Zustand (with persist via AsyncStorage)
- **Native extensions:** Custom Expo plugins (`plugins/`), patches (`patches/` via patch-package)

## Directory Map
- `app/` — Expo Router screens and layouts
- `src/components/` — Reusable UI components
- `src/modules/` — Feature-specific logic and components
- `src/services/` — External service integrations
- `src/store/` — Zustand stores
- `src/hooks/` — Custom React hooks
- `src/utils/` — Utility functions
- `plugins/` — Custom Expo config plugins (native-level changes)
- `patches/` — patch-package patches applied via `postinstall`

## Build / Dev Commands
- `npm run ios` — Run on iOS
- `npm run start` — Start Expo dev server
- `npm run prebuild` — Regenerate native projects
- `npm run lint` — ESLint + Prettier check
- `npm run format` — Auto-fix lint + formatting

## Bug Fixing Approach
When fixing bugs, follow this structured approach:
1. **Identify the root cause** — Read the relevant code and trace the data flow to understand *why* the bug happens, not just *what* happens.
2. **Map the reproduction flow** — Write out the exact sequence of steps/states that trigger the bug, identifying where the logic breaks.
3. **Propose a minimal fix** — Target the root cause directly. Avoid workarounds that mask the issue.

## Conventions
- Always reference actual Expo and iOS docs; do not guess APIs or expect user to trial-and-error.
- `ios/` and `node_modules/` are not tracked. Never modify them directly — sync native changes through Expo plugins or patches.
- Do not blindly execute what the user asks. Validate and research first; let the user know if the ask is unreasonable.
- Do not execute alternative solutions without asking the user.
- Must let user know when it no longer safe to run `npx expo prebuild --clean`.