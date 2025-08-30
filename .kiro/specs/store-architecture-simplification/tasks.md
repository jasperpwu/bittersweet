# Implementation Plan

- [x] 1. Create simplified type definitions
  - Create new simplified interfaces in `src/types/store.ts`
  - Remove complex BaseEntity and NormalizedState types
  - Define simple, direct interfaces for FocusSession, Category, Task, etc.
  - _Requirements: 1.1, 1.2, 1.3_

- [x] 2. Implement simplified focus slice
  - Simplify existing `src/store/slices/focusSlice.ts` with basic timer logic
  - Remove EntityManager and SessionTimingManager dependencies
  - Replace normalized structures with simple arrays
  - Add basic timer calculations without over-engineering
  - _Requirements: 1.1, 1.4, 2.1, 3.1, 3.2, 3.3_

- [x] 3. Implement simplified tasks slice
  - Simplify existing `src/store/slices/tasksSlice.ts` with basic task management
  - Replace normalized structures with simple arrays
  - Implement CRUD operations for tasks without complex entity management
  - _Requirements: 1.4, 4.1, 4.2_

- [x] 4. Implement simplified rewards slice
  - Simplify existing `src/store/slices/rewardsSlice.ts` for seed tracking
  - Implement basic seed earning and spending logic
  - Replace normalized structures with simple arrays
  - _Requirements: 1.4, 4.1_

- [x] 5. Implement simplified settings and UI slices
  - Simplify existing `src/store/slices/settingsSlice.ts` for user preferences
  - Simplify existing `src/store/slices/uiSlice.ts` for app state
  - Keep interfaces minimal and focused
  - _Requirements: 1.4, 4.1_

- [x] 6. Simplify main store
  - Simplify existing `src/store/unified-store.ts` combining all simplified slices
  - Use standard Zustand patterns without complex middleware
  - Implement basic persistence with standard Zustand persist middleware
  - _Requirements: 1.1, 1.2, 2.1, 2.2, 7.1_

- [x] 7. Simplify persistence configuration
  - Simplify existing `src/store/persistence.ts` with basic Zustand persistence
  - Remove complex partialize functions and migration systems
  - Use simple storage key and basic error handling
  - _Requirements: 2.1, 2.2, 2.3, 2.4_

- [x] 8. Update migration utility
  - Update existing migration logic to handle simplified store structure
  - Handle conversion from normalized structures to simple arrays
  - Preserve user data during migration
  - _Requirements: 2.1, 2.2_

- [x] 9. Update store provider component
  - Modify `src/components/store/StoreProvider.tsx` to use simplified store
  - Remove complex initialization logic
  - Add simple error boundary for store errors
  - _Requirements: 1.1, 5.1, 7.1_

- [x] 10. Update focus components to use simplified store
  - Update focus-related components in `src/components/focus/` to use simplified store hooks
  - Replace complex selectors with simple state access
  - Update timer components to use simplified timer state
  - _Requirements: 1.1, 3.1, 3.2, 3.3, 6.1, 6.2_

- [x] 11. Update tasks components to use simplified store
  - Update task-related components in `src/components/tasks/` to use simplified store
  - Replace normalized state access with simple array operations
  - Update date selection and task management UI
  - _Requirements: 1.1, 4.1, 4.2, 6.1, 6.2_

- [x] 12. Update home and insights components
  - Update home screen components to use simplified store
  - Update insights/analytics components to work with simple data structures
  - Remove complex selectors and use direct state access
  - _Requirements: 1.1, 6.1, 6.2_

- [x] 13. Update app entry points
  - Update `app/(tabs)/index.tsx` and other tab screens to use simplified store
  - Remove references to complex store initialization
  - Update imports to use simplified store
  - _Requirements: 1.1, 6.1, 7.1_

- [x] 14. Remove old store infrastructure
  - Delete old complex store files: `unified-store.ts`, `entityManager.ts`, `sessionTimingManager.ts`
  - Remove complex middleware files
  - Delete unused utility classes and performance monitoring
  - Clean up old type definitions
  - _Requirements: 1.1, 1.4_

- [x] 15. Update tests to use simplified store
  - Remove complex test files that test non-existent infrastructure
  - Update existing tests for simplified store slices
  - Test basic store operations and state changes
  - _Requirements: 1.1, 6.1_

- [x] 16. Add simple error handling and logging
  - Implement basic error boundaries in key components
  - Add simple console logging for store operations in development
  - Remove complex error handling systems
  - _Requirements: 5.1, 5.2, 5.3, 5.4_

- [x] 17. Performance optimization and cleanup
  - Add simple performance logging for store operations
  - Remove unused imports and dead code
  - Optimize component re-renders with proper Zustand selectors
  - _Requirements: 7.1, 7.2, 7.3, 7.4_

- [ ] 18. Final integration and testing
  - Test complete app functionality with new simplified store
  - Verify session persistence works correctly
  - Test timer accuracy and session management
  - Ensure all components work with new store structure
  - _Requirements: 1.1, 2.1, 3.1, 4.1, 5.1, 6.1, 7.1_