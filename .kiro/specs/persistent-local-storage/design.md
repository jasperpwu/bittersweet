# Design Document

## Overview

This design implements a simple and reliable persistent local storage solution for the bittersweet mobile application using AsyncStorage. The solution provides automatic state persistence and restoration for all Zustand stores while maintaining data integrity and handling errors gracefully.

The design prioritizes correctness over performance, focusing on ensuring data is safely persisted and accurately restored across app restarts. 

**Current Implementation Status:**
- **Focus Store**: Fully implemented with sessions, categories, tags - this is the primary store that needs persistence
  - Focus Sessions = timed work periods (25 min Pomodoro sessions)
  - Categories = Work, Study, Personal, etc.
  - Tags = additional labels for sessions
- **Tasks Store**: Implemented but not yet connected to UI - different from focus sessions
  - Tasks = todo items/projects ("Write report", "Study for exam")
  - Tasks can be linked to multiple focus sessions to track time spent
- **Rewards Store**: Implemented but not yet connected to UI - can be persisted for future use  
- **Settings Store**: Implemented but not yet connected to UI - can be persisted for future use

**Priority for Persistence:**
1. **Focus Store** - Currently losing session data, categories, and tags on app restart
2. **Settings Store** - User preferences should persist
3. **Other stores** - Can be included for future-proofing

The design follows a simple layered architecture with a unified persistence service that integrates seamlessly with the existing Zustand store structure.

## Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    React Native App                         │
├─────────────────────────────────────────────────────────────┤
│                  Zustand Stores                             │
│   ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐│
│   │Focus    │ │ Tasks   │ │Rewards  │ │Settings ││
│   │Store    │ │ Store   │ │  Store  │ │  Store  ││
│   └─────────┘ └─────────┘ └─────────┘ └─────────┘│
├─────────────────────────────────────────────────────────────┤
│                Persistence Middleware                       │
│  ┌─────────────────────────────────────────────────────────┐│
│  │              PersistenceService                         ││
│  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐      ││
│  │  │   Storage   │ │ Serializer  │ │  Migration  │      ││
│  │  │   Manager   │ │   Service   │ │   Manager   │      ││
│  │  └─────────────┘ └─────────────┘ └─────────────┘      ││
│  └─────────────────────────────────────────────────────────┘│
├─────────────────────────────────────────────────────────────┤
│                    AsyncStorage                             │
│  ┌─────────────────────────────────────────────────────────┐│
│  │  Key-Value Storage with JSON Serialization             ││
│  └─────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
```

### Storage Key Structure

```
bittersweet:focus:sessions         // All focus sessions (normalized)
bittersweet:focus:categories       // Categories (normalized)
bittersweet:focus:tags            // Tags (normalized)
bittersweet:focus:currentSession  // Active/paused session state
bittersweet:focus:settings        // Focus-specific settings
bittersweet:tasks:tasks           // All tasks (normalized)
bittersweet:tasks:ui              // Task UI state
bittersweet:rewards:balance       // Current seed balance
bittersweet:rewards:transactions  // Transaction history
bittersweet:rewards:apps          // Unlockable apps
bittersweet:settings:app          // App-wide settings
bittersweet:meta:version          // Schema version for migrations
bittersweet:meta:lastSync         // Last sync timestamp
```

## Components and Interfaces

### 1. PersistenceService

The core service that manages all storage operations with automatic serialization, error handling, and migration support.

```typescript
interface PersistenceService {
  // Core Operations
  save<T>(key: string, data: T): Promise<void>;
  load<T>(key: string): Promise<T | null>;
  remove(key: string): Promise<void>;
  clear(): Promise<void>;
  
  // Batch Operations
  saveBatch(items: Array<{ key: string; data: any }>): Promise<void>;
  loadBatch(keys: string[]): Promise<Record<string, any>>;
  
  // Store Integration
  persistStore(storeName: string, state: any): Promise<void>;
  restoreStore(storeName: string): Promise<any>;
  
  // Utilities
  exists(key: string): Promise<boolean>;
  getStorageInfo(): Promise<StorageInfo>;
  cleanup(): Promise<void>;
}

interface StorageInfo {
  totalKeys: number;
  estimatedSize: number;
  availableSpace?: number;
  lastCleanup: Date;
}
```

### 2. SerializationService

Handles safe JSON serialization with Date object support and error recovery.

```typescript
interface SerializationService {
  serialize(data: any): string;
  deserialize<T>(json: string): T | null;
  isValidJson(json: string): boolean;
  
  // Custom serializers for complex types
  registerSerializer<T>(type: string, serializer: TypeSerializer<T>): void;
}

interface TypeSerializer<T> {
  serialize(data: T): any;
  deserialize(data: any): T;
  validate(data: any): boolean;
}
```

### 3. MigrationManager

Manages schema versions and data migrations between app updates.

```typescript
interface MigrationManager {
  getCurrentVersion(): Promise<number>;
  setVersion(version: number): Promise<void>;
  
  migrate(fromVersion: number, toVersion: number): Promise<void>;
  registerMigration(version: number, migration: Migration): void;
  
  needsMigration(): Promise<boolean>;
  backupBeforeMigration(): Promise<string>;
}

interface Migration {
  version: number;
  description: string;
  up: (data: any) => Promise<any>;
  down?: (data: any) => Promise<any>;
}
```

### 4. Store Persistence Middleware

Zustand middleware that automatically persists store changes and restores state on initialization.

```typescript
interface PersistConfig<T> {
  name: string;
  partialize?: (state: T) => Partial<T>;
  merge?: (persistedState: any, currentState: T) => T;
  onRehydrateStorage?: () => (state?: T) => void;
  version?: number;
  migrate?: (persistedState: any, version: number) => any;
  skipHydration?: boolean;
}

interface PersistMiddleware {
  <T>(
    config: PersistConfig<T>,
    impl: StateCreator<T>
  ): StateCreator<T>;
}
```

### 5. Session Timing Manager

Specialized component for handling active session timing across app restarts.

```typescript
interface SessionTimingManager {
  // Session State Persistence
  persistCurrentSession(session: CurrentSessionState): Promise<void>;
  restoreCurrentSession(): Promise<CurrentSessionState | null>;
  
  // Timing Calculations
  calculateElapsedTime(startTime: Date, pauseHistory: PauseRecord[]): number;
  calculateRemainingTime(startTime: Date, targetDuration: number, pauseHistory: PauseRecord[]): number;
  
  // Session Validation
  validateSessionState(session: CurrentSessionState): SessionValidationResult;
  shouldAutoComplete(session: CurrentSessionState): boolean;
}

interface CurrentSessionState {
  session: FocusSession | null;
  isRunning: boolean;
  remainingTime: number;
  startedAt: Date | null;
  timerMode: 'countdown' | 'countup';
  lastUpdateTime: Date;
}

interface SessionValidationResult {
  isValid: boolean;
  shouldAutoComplete: boolean;
  correctedState?: Partial<CurrentSessionState>;
  errors: string[];
}
```

## Data Models

### Persistence Metadata

```typescript
interface PersistenceMetadata {
  version: number;
  lastSaved: Date;
  checksum?: string;
  compressed?: boolean;
}

interface StoredData<T> {
  data: T;
  metadata: PersistenceMetadata;
}
```

### Session Timing Data

```typescript
interface PersistedSessionTiming {
  sessionId: string;
  originalStartTime: Date;
  lastActiveTime: Date;
  totalPauseDuration: number;
  timerMode: 'countdown' | 'countup';
  targetDuration: number;
  isRunning: boolean;
  pauseHistory: PauseRecord[];
}
```

### Migration Schema

```typescript
interface SchemaVersion {
  version: number;
  description: string;
  changes: SchemaChange[];
  migrationRequired: boolean;
}

interface SchemaChange {
  type: 'add' | 'remove' | 'modify' | 'rename';
  path: string;
  description: string;
  transform?: (oldValue: any) => any;
}
```

## Error Handling

### Error Types and Recovery Strategies

```typescript
enum PersistenceErrorType {
  STORAGE_UNAVAILABLE = 'STORAGE_UNAVAILABLE',
  QUOTA_EXCEEDED = 'QUOTA_EXCEEDED',
  SERIALIZATION_ERROR = 'SERIALIZATION_ERROR',
  CORRUPTION_DETECTED = 'CORRUPTION_DETECTED',
  MIGRATION_FAILED = 'MIGRATION_FAILED',
  NETWORK_ERROR = 'NETWORK_ERROR'
}

interface PersistenceError extends Error {
  type: PersistenceErrorType;
  recoverable: boolean;
  context?: any;
  timestamp: Date;
}

interface ErrorRecoveryStrategy {
  canRecover(error: PersistenceError): boolean;
  recover(error: PersistenceError): Promise<boolean>;
  fallback(error: PersistenceError): Promise<void>;
}
```

### Recovery Strategies

1. **Storage Unavailable**: Continue with in-memory state, retry periodically
2. **Quota Exceeded**: Implement cleanup strategy, remove old data
3. **Serialization Error**: Log error, use default state for corrupted data
4. **Corruption Detected**: Attempt repair, fallback to backup or clean state
5. **Migration Failed**: Preserve original data, use default state

## Testing Strategy

### Unit Testing

```typescript
// Test Categories
describe('PersistenceService', () => {
  describe('Core Operations', () => {
    // Test save, load, remove, clear operations
  });
  
  describe('Serialization', () => {
    // Test Date objects, complex nested objects, edge cases
  });
  
  describe('Error Handling', () => {
    // Test storage failures, quota exceeded, corruption
  });
});

describe('SessionTimingManager', () => {
  describe('Timing Calculations', () => {
    // Test elapsed time with pauses, remaining time calculations
  });
  
  describe('Session Restoration', () => {
    // Test active session restoration, auto-completion logic
  });
});

describe('MigrationManager', () => {
  describe('Version Management', () => {
    // Test version detection, migration execution
  });
  
  describe('Data Transformation', () => {
    // Test schema migrations, data integrity
  });
});
```

### Integration Testing

```typescript
describe('Store Persistence Integration', () => {
  describe('Focus Store', () => {
    // Test session persistence, category/tag persistence
  });
  
  describe('Cross-Store Events', () => {
    // Test event-driven persistence updates
  });
  
  describe('App Lifecycle', () => {
    // Test app restart scenarios, background/foreground transitions
  });
});
```

### Manual Testing

- **App Restart Scenarios**: Test data restoration after force-closing the app
- **Storage Failure Scenarios**: Test behavior when storage is unavailable
- **Data Corruption Scenarios**: Test recovery from corrupted data
- **Migration Scenarios**: Test schema migrations between versions

## Implementation Phases

### Phase 1: Core Persistence Infrastructure
- Implement PersistenceService with basic save/load operations
- Create SerializationService with Date support
- Add error handling and logging
- Implement basic Zustand middleware integration

### Phase 2: Store Integration
- Integrate persistence with Focus store (sessions, categories, tags)
- Add Settings store persistence
- Implement Rewards store persistence
- Add comprehensive error recovery

### Phase 3: Advanced Features
- Implement SessionTimingManager for active session restoration
- Add MigrationManager for schema versioning
- Implement data cleanup and optimization
- Add performance monitoring

### Phase 4: Testing and Optimization
- Comprehensive unit and integration testing
- Performance optimization and memory management
- Error scenario testing and recovery validation
- Documentation and developer tools

## Security Considerations

### Data Protection
- **Data Validation**: Validate all restored data before use
- **Encryption**: Consider encrypting sensitive user data
- **Access Control**: Implement proper key namespacing

### Privacy Compliance
- **Data Minimization**: Only persist necessary data
- **User Control**: Provide options to clear stored data
- **Audit Trail**: Log persistence operations for debugging
- **Consent Management**: Respect user privacy preferences

## Performance Optimizations

### Data Integrity
- **Atomic Operations**: Ensure save operations complete fully or not at all
- **Data Validation**: Validate restored data before using it
- **Error Logging**: Log all persistence errors for debugging
- **Graceful Degradation**: Continue with in-memory state if persistence fails

## Monitoring and Debugging

### Error Tracking
- Log all persistence operation failures
- Track data corruption incidents
- Monitor storage quota issues
- Record migration failures

### Development Tools
- Console logging for persistence operations in development
- Data inspection utilities for debugging
- Clear storage utility for testing

This design provides a robust, scalable foundation for persistent local storage that maintains data integrity while providing excellent user experience and developer productivity.