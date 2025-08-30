# Requirements Document

## Introduction

The bittersweet mobile application currently stores all user data (focus sessions, categories, tags, settings, rewards) in memory using Zustand stores. This means that when users restart the app, all their progress, session history, and customizations are lost. This feature will implement persistent local storage using AsyncStorage to ensure data survives app restarts and provides a seamless user experience.

## Requirements

### Requirement 1

**User Story:** As a user, I want my focus session history to be preserved when I restart the app, so that I can track my progress over time without losing data.

#### Acceptance Criteria

1. WHEN the app is restarted THEN all completed focus sessions SHALL be restored from local storage
2. WHEN the app is restarted THEN all active/paused sessions SHALL be restored with accurate timing information
3. WHEN an active session is restored THEN the timer SHALL resume from the correct elapsed time based on the original start time
4. WHEN a paused session is restored THEN the timer SHALL show the correct remaining time accounting for pause duration
5. WHEN a focus session is completed THEN it SHALL be immediately persisted to local storage
6. WHEN a focus session is started, paused, or resumed THEN the session state and timing information SHALL be persisted to local storage
7. WHEN persisting session timing THEN both countdown and countup timer modes SHALL be supported
8. IF local storage contains corrupted session data THEN the app SHALL handle the error gracefully and initialize with empty state

### Requirement 2

**User Story:** As a user, I want my custom categories and tags to persist across app restarts, so that I don't have to recreate my organization system every time.

#### Acceptance Criteria

1. WHEN the app is restarted THEN all custom categories SHALL be restored from local storage
2. WHEN the app is restarted THEN all custom tags SHALL be restored from local storage
3. WHEN a category is created, updated, or deleted THEN the change SHALL be immediately persisted to local storage
4. WHEN a tag is created, updated, or deleted THEN the change SHALL be immediately persisted to local storage
5. WHEN the app starts for the first time THEN default categories SHALL be created and persisted to local storage

### Requirement 3

**User Story:** As a user, I want my app settings and preferences to be remembered, so that I don't have to reconfigure the app after every restart.

#### Acceptance Criteria

1. WHEN the app is restarted THEN all focus settings (duration, break settings, sound preferences) SHALL be restored
2. WHEN the app is restarted THEN all notification preferences SHALL be restored
3. WHEN the app is restarted THEN the selected theme (light/dark mode) SHALL be restored
4. WHEN a setting is changed THEN it SHALL be immediately persisted to local storage
5. IF settings data is corrupted THEN the app SHALL fall back to default settings

### Requirement 4

**User Story:** As a user, I want my earned seeds and reward progress to persist across app restarts, so that I don't lose my accumulated rewards.

#### Acceptance Criteria

1. WHEN the app is restarted THEN the current seed balance SHALL be restored from local storage
2. WHEN the app is restarted THEN all reward history SHALL be restored from local storage
3. WHEN seeds are earned or spent THEN the balance SHALL be immediately persisted to local storage
4. WHEN a reward is unlocked THEN the transaction SHALL be immediately persisted to local storage
5. IF reward data is corrupted THEN the app SHALL initialize with zero balance and log the error

### Requirement 5

**User Story:** As a user, I want the app to handle storage errors gracefully, so that I have a reliable experience even when storage issues occur.

#### Acceptance Criteria

1. WHEN AsyncStorage operations fail THEN the app SHALL continue to function with in-memory state
2. WHEN storage quota is exceeded THEN the app SHALL implement cleanup strategies for old data
3. WHEN corrupted data is detected THEN the app SHALL log the error and initialize with clean state
4. WHEN storage is unavailable THEN the app SHALL show appropriate user feedback
5. WHEN storage operations are slow THEN the app SHALL not block the UI thread

### Requirement 6

**User Story:** As a developer, I want a unified persistence layer that works consistently across all stores, so that data management is maintainable and reliable.

#### Acceptance Criteria

1. WHEN any store state changes THEN the persistence layer SHALL automatically save the relevant data
2. WHEN the app initializes THEN the persistence layer SHALL automatically restore all store states
3. WHEN implementing new stores THEN they SHALL easily integrate with the existing persistence system
4. WHEN debugging storage issues THEN there SHALL be comprehensive logging and error reporting
5. IF storage operations conflict THEN the system SHALL handle race conditions appropriately

### Requirement 7

**User Story:** As a user, I want accurate timer restoration when resuming an active session after app restart, so that my focus time tracking is precise regardless of app interruptions.

#### Acceptance Criteria

1. WHEN an active session is restored THEN the system SHALL calculate elapsed time from the original start timestamp
2. WHEN a paused session is restored THEN the system SHALL account for total pause duration in timing calculations
3. WHEN restoring timer state THEN both countdown (remaining time) and countup (elapsed time) modes SHALL be accurately restored
4. WHEN the session target duration has been exceeded during app closure THEN the session SHALL be automatically completed
5. WHEN timing calculations detect inconsistencies THEN the system SHALL log the error and handle gracefully

### Requirement 8

**User Story:** As a user, I want my data to be migrated safely when the app updates, so that I don't lose information during version upgrades.

#### Acceptance Criteria

1. WHEN the app version changes THEN the persistence layer SHALL detect schema changes
2. WHEN schema migration is needed THEN data SHALL be transformed to the new format safely
3. WHEN migration fails THEN the app SHALL preserve the original data and log the error
4. WHEN migration succeeds THEN the old schema version SHALL be cleaned up
5. IF migration is not possible THEN the user SHALL be informed and given options to export data