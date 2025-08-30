# Implementation Plan

- [x] 1. Add current session persistence to existing middleware
  - Update persistence middleware to include currentSession state in partialize function
  - Add currentSession restoration logic in onRehydrateStorage callback
  - Ensure currentSession timing data is properly serialized and deserialized
  - _Requirements: 1.2, 1.3, 1.6, 1.7_

- [x] 2. Implement session timing manager for active session restoration
  - Create SessionTimingManager utility to handle active session timing calculations
  - Add functions to calculate elapsed time from original start timestamp
  - Add functions to calculate remaining time accounting for pause history
  - Add session validation logic to detect if session should auto-complete
  - Add support for both countdown and countup timer modes
  - _Requirements: 1.2, 1.3, 1.4, 1.6, 1.7, 7.1, 7.2, 7.3, 7.4, 7.5_

- [x] 3. Connect Focus screen to Zustand Focus store
  - Replace local component state in focus screen with Zustand store
  - Connect tag management (create, edit, select) to focus store actions
  - Connect session management (start, pause, resume, complete) to focus store
  - Connect settings and preferences to focus store
  - Ensure all focus screen state is managed by the store for persistence
  - _Requirements: 1.1, 2.1, 2.2, 2.3, 2.4, 2.5_

- [x] 4. Update Focus store to use session timing manager
  - Integrate SessionTimingManager into focus store for session restoration
  - Add logic to restore active/paused sessions with accurate timing on app startup
  - Update session start/pause/resume actions to persist timing data immediately
  - Add auto-completion logic for sessions that exceeded target duration during app closure
  - Test session timing accuracy across app restarts with various scenarios
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8_

- [x] 5. Fix existing persistence middleware issues
  - Fix TypeScript errors in persistence middleware (missing stats property, type issues)
  - Update partialize function to handle all required store slices properly
  - Fix Date object serialization/deserialization for all entities
  - Ensure migration functions handle all edge cases properly
  - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_

- [x] 6. Test and validate existing persistence for all stores
  - Test Focus store persistence (sessions, categories, tags, settings)
  - Test Tasks store persistence (tasks, UI state)
  - Test Rewards store persistence (balance, transactions)
  - Test Settings store persistence (app settings, preferences)
  - Verify all stores restore correctly after app restart
  - _Requirements: 1.1, 2.1, 2.2, 2.3, 2.4, 2.5, 3.1, 3.2, 3.3, 3.4, 3.5, 4.1, 4.2, 4.3, 4.4, 4.5_

- [x] 7. Enhance error handling and recovery mechanisms
  - Add better error handling for storage quota exceeded scenarios
  - Implement corruption detection and recovery for critical data
  - Add user feedback mechanisms for storage-related issues
  - Implement graceful degradation when storage operations fail
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

- [x] 8. Create comprehensive tests for persistence functionality
  - Write unit tests for SessionTimingManager timing calculations
  - Write integration tests for active session restoration scenarios
  - Write tests for error scenarios and recovery mechanisms
  - Add manual testing scenarios for app restart with active sessions
  - _Requirements: All requirements validation_

- [x] 9. Update existing migration system for new session timing data
  - Add migration logic for new currentSession persistence structure
  - Ensure backward compatibility with existing persisted data
  - Add validation for migrated session timing data
  - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5_