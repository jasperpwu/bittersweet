# `shared/`

Code compiled by **both** the Expo app (Metro) and the desktop client (Vite).

## The one rule

**Zero dependencies. No `react-native`, no `expo-*`, no `vite`, no `react` — ever.**

Not "avoid" — *cannot*. There is deliberately no `package.json` here, so anything
this folder imports must be either another file in `shared/` or a TypeScript
built-in. Both bundlers compile these `.ts` files directly from source; neither
runs a build step, and neither will resolve a dependency this folder does not
have.

Why no `package.json`: making the repo root an npm workspace would hoist
`node_modules`, and this repo cannot absorb that — `postinstall` runs
patch-package against exact paths, and `metro.config.js` hand-resolves
`@posthog/core` subpaths off `require.resolve`. A dependency-free folder inside
the Expo project root is already in Metro's watch tree, so it needs no
`watchFolders` and no Metro config at all. Vite reaches it with `resolve.alias`
plus `server.fs.allow: ['..']`.

## What belongs here

The **wire format**: the shape of a Supabase row and the mapping to and from it.
That is the only thing the two clients genuinely have to agree on.

- `types.ts` — `FocusSessionRow` / `SessionTagRow` (the wire shape),
  `FocusSessionCore` / `SessionTagCore` (what a row round-trips into), and the
  small enums they reference.
- `sessionRow.ts` — `sessionToRow` / `rowToSession`
- `tagRow.ts` — `tagToRow` / `rowToTag`
- `activityType.ts` — `normalizeActivityType` and friends (needed by `tagRow`)
- `sessionNotes.ts` — `clampSessionNotes` and the note length caps (needed by
  `sessionRow`)

`src/types/models.ts` extends the `*Core` types with the iOS-only fields
(`liveActivityId`, `baseFruits`, `usageCount`, …), so the local model is
provably a superset of the wire model rather than a second copy of it.

## What does not belong here

Anything only one client needs. Fruits, badges, streaks, ratings, the reward
curve, blocklist logic, grove — all iOS-only. The desktop client writes a
*minimal* session row (tag, start, end, duration) and iOS recomputes the rest.
Desktop-created rows are inputs to that logic, not results of it.

## The drift guard

CLAUDE.md's rule — **`rowToX()` must restore every field `xToRow()` writes** —
is what keeps the two clients honest, and it is enforced here by both functions
naming the same explicit `*Row` interface. Add a field to `sessionToRow` without
the inverse in `rowToSession` and *both* typecheckers fail on the same file:

```
npx tsc --noEmit                    # Expo app
cd desktop && npx tsc --noEmit      # desktop client
```

Run both. The root `tsconfig.json` excludes `desktop/`, so it will not catch
desktop-side breakage on its own.
