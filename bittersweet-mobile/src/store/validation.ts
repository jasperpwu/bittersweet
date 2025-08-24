/**
 * Store validation utilities for migration and integrity checks
 * Addresses Requirements: 8.1, 8.4, 8.5, 10.4, 10.5
 */

import { RootStore } from './types';

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  suggestions: string[];
}

export interface MigrationStatus {
  isComplete: boolean;
  version: number;
  migratedSlices: string[];
  pendingMigrations: string[];
  dataIntegrity: ValidationResult;
}

/**
 * Validate the complete store structure and data integrity
 */
export function validateStoreIntegrity(useAppStore?: any): ValidationResult {
  if (!useAppStore) {
    // Import here to avoid circular dependency
    const { useAppStore: store } = require('./index');
    useAppStore = store;
  }
  const state = useAppStore.getState();
  const errors: string[] = [];
  const warnings: string[] = [];
  const suggestions: string[] = [];

  try {
    // Validate required slices exist
    const requiredSlices = ['auth', 'focus', 'tasks', 'rewards', 'social', 'settings', 'ui'];
    requiredSlices.forEach(sliceName => {
      if (!state[sliceName as keyof RootStore]) {
        errors.push(`Missing required slice: ${sliceName}`);
      }
    });

    // Validate auth slice
    if (state.auth) {
      if (state.auth.isAuthenticated && !state.auth.user) {
        warnings.push('User is authenticated but user data is missing');
      }
      if (state.auth.user && !state.auth.user.id) {
        errors.push('User exists but missing required ID');
      }
    }

    // Validate normalized structures
    const normalizedSlices = [
      { slice: 'focus', entities: ['sessions', 'categories', 'tags'] },
      { slice: 'tasks', entities: ['tasks'] },
      { slice: 'rewards', entities: ['transactions', 'unlockableApps'] },
      { slice: 'social', entities: ['squads', 'challenges', 'friends'] },
    ];

    normalizedSlices.forEach(({ slice, entities }) => {
      const sliceData = state[slice as keyof RootStore] as any;
      if (sliceData) {
        entities.forEach(entityName => {
          const entity = sliceData[entityName];
          if (entity && typeof entity === 'object') {
            if (!entity.byId || typeof entity.byId !== 'object') {
              errors.push(`Invalid normalized structure in ${slice}.${entityName}: missing or invalid byId`);
            }
            if (!entity.allIds || !Array.isArray(entity.allIds)) {
              errors.push(`Invalid normalized structure in ${slice}.${entityName}: missing or invalid allIds`);
            }
            if (entity.byId && entity.allIds) {
              // Check consistency between byId and allIds
              const byIdKeys = Object.keys(entity.byId);
              const missingInAllIds = byIdKeys.filter(id => !entity.allIds.includes(id));
              const missingInById = entity.allIds.filter((id: string) => !entity.byId[id]);
              
              if (missingInAllIds.length > 0) {
                warnings.push(`${slice}.${entityName}: IDs in byId but not in allIds: ${missingInAllIds.join(', ')}`);
              }
              if (missingInById.length > 0) {
                warnings.push(`${slice}.${entityName}: IDs in allIds but not in byId: ${missingInById.join(', ')}`);
              }
            }
          }
        });
      }
    });

    // Validate focus session data integrity
    if (state.focus?.sessions) {
      const sessions = state.focus.sessions.allIds.map(id => state.focus.sessions.byId[id]);
      sessions.forEach(session => {
        if (session) {
          if (!session.id || !session.startTime) {
            errors.push(`Invalid session data: missing required fields (id: ${session.id})`);
          }
          if (session.status === 'completed' && !session.endTime) {
            warnings.push(`Completed session missing endTime: ${session.id}`);
          }
          if (session.duration < 0) {
            errors.push(`Invalid session duration: ${session.duration} for session ${session.id}`);
          }
        }
      });
    }

    // Validate task data integrity
    if (state.tasks?.tasks) {
      const tasks = state.tasks.tasks.allIds.map(id => state.tasks.tasks.byId[id]);
      tasks.forEach(task => {
        if (task) {
          if (!task.id || !task.title) {
            errors.push(`Invalid task data: missing required fields (id: ${task.id})`);
          }
          if (task.duration <= 0) {
            warnings.push(`Task has invalid duration: ${task.duration} for task ${task.id}`);
          }
        }
      });
    }

    // Validate rewards data integrity
    if (state.rewards) {
      if (state.rewards.balance < 0) {
        errors.push('Rewards balance cannot be negative');
      }
      if (state.rewards.totalEarned < state.rewards.totalSpent) {
        warnings.push('Total spent exceeds total earned - possible data inconsistency');
      }
    }

    // Performance suggestions
    if (state.focus?.sessions.allIds.length > 1000) {
      suggestions.push('Consider archiving old focus sessions to improve performance');
    }
    if (state.ui?.errors.length > 25) {
      suggestions.push('Consider clearing old error logs to reduce memory usage');
    }
    if (state.rewards?.transactions.allIds.length > 500) {
      suggestions.push('Consider archiving old transactions to improve performance');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      suggestions,
    };
  } catch (error) {
    return {
      isValid: false,
      errors: [`Validation failed with error: ${error instanceof Error ? error.message : 'Unknown error'}`],
      warnings,
      suggestions,
    };
  }
}

/**
 * Check migration status and completeness
 */
export function checkMigrationStatus(useAppStore?: any): MigrationStatus {
  if (!useAppStore) {
    // Import here to avoid circular dependency
    const { useAppStore: store } = require('./index');
    useAppStore = store;
  }
  const state = useAppStore.getState();
  const migratedSlices: string[] = [];
  const pendingMigrations: string[] = [];

  // Check if all expected slices are present and properly structured
  const expectedSlices = ['auth', 'focus', 'tasks', 'rewards', 'social', 'settings', 'ui'];
  
  expectedSlices.forEach(sliceName => {
    const slice = state[sliceName as keyof RootStore];
    if (slice && typeof slice === 'object') {
      migratedSlices.push(sliceName);
    } else {
      pendingMigrations.push(sliceName);
    }
  });

  // Check for legacy data patterns
  const legacyPatterns = [
    'homeSlice', // Should be migrated to auth/tasks
    'bearState', // Legacy example store
  ];

  legacyPatterns.forEach(pattern => {
    if ((state as any)[pattern]) {
      pendingMigrations.push(`Legacy ${pattern} needs migration`);
    }
  });

  const dataIntegrity = validateStoreIntegrity();

  return {
    isComplete: pendingMigrations.length === 0 && dataIntegrity.isValid,
    version: 2, // Current storage version
    migratedSlices,
    pendingMigrations,
    dataIntegrity,
  };
}

/**
 * Generate a comprehensive migration report
 */
export function generateMigrationReport(): string {
  const status = checkMigrationStatus();
  const timestamp = new Date().toISOString();

  let report = `# Store Migration Report\n`;
  report += `Generated: ${timestamp}\n\n`;

  report += `## Migration Status\n`;
  report += `- **Complete**: ${status.isComplete ? '✅ Yes' : '❌ No'}\n`;
  report += `- **Version**: ${status.version}\n`;
  report += `- **Migrated Slices**: ${status.migratedSlices.length}\n`;
  report += `- **Pending Migrations**: ${status.pendingMigrations.length}\n\n`;

  if (status.migratedSlices.length > 0) {
    report += `### Successfully Migrated Slices\n`;
    status.migratedSlices.forEach(slice => {
      report += `- ✅ ${slice}\n`;
    });
    report += `\n`;
  }

  if (status.pendingMigrations.length > 0) {
    report += `### Pending Migrations\n`;
    status.pendingMigrations.forEach(migration => {
      report += `- ⏳ ${migration}\n`;
    });
    report += `\n`;
  }

  report += `## Data Integrity\n`;
  report += `- **Valid**: ${status.dataIntegrity.isValid ? '✅ Yes' : '❌ No'}\n`;
  report += `- **Errors**: ${status.dataIntegrity.errors.length}\n`;
  report += `- **Warnings**: ${status.dataIntegrity.warnings.length}\n`;
  report += `- **Suggestions**: ${status.dataIntegrity.suggestions.length}\n\n`;

  if (status.dataIntegrity.errors.length > 0) {
    report += `### Errors\n`;
    status.dataIntegrity.errors.forEach(error => {
      report += `- ❌ ${error}\n`;
    });
    report += `\n`;
  }

  if (status.dataIntegrity.warnings.length > 0) {
    report += `### Warnings\n`;
    status.dataIntegrity.warnings.forEach(warning => {
      report += `- ⚠️ ${warning}\n`;
    });
    report += `\n`;
  }

  if (status.dataIntegrity.suggestions.length > 0) {
    report += `### Suggestions\n`;
    status.dataIntegrity.suggestions.forEach(suggestion => {
      report += `- 💡 ${suggestion}\n`;
    });
    report += `\n`;
  }

  return report;
}

/**
 * Validate component integration with the unified store
 */
export function validateComponentIntegration(useAppStore?: any): ValidationResult {
  if (!useAppStore) {
    // Import here to avoid circular dependency
    const { useAppStore: store } = require('./index');
    useAppStore = store;
  }
  const errors: string[] = [];
  const warnings: string[] = [];
  const suggestions: string[] = [];

  try {
    // Test that all store hooks are accessible
    const state = useAppStore.getState();
    
    // Test auth hooks
    if (!state.auth.login || typeof state.auth.login !== 'function') {
      errors.push('Auth login action not accessible');
    }
    
    // Test focus hooks
    if (!state.focus.startSession || typeof state.focus.startSession !== 'function') {
      errors.push('Focus startSession action not accessible');
    }
    
    // Test tasks hooks
    if (!state.tasks.createTask || typeof state.tasks.createTask !== 'function') {
      errors.push('Tasks createTask action not accessible');
    }
    
    // Test rewards hooks
    if (!state.rewards.earnSeeds || typeof state.rewards.earnSeeds !== 'function') {
      errors.push('Rewards earnSeeds action not accessible');
    }

    // Test selectors
    if (!state.focus.getActiveSession || typeof state.focus.getActiveSession !== 'function') {
      warnings.push('Focus getActiveSession selector not accessible');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      suggestions,
    };
  } catch (error) {
    return {
      isValid: false,
      errors: [`Component integration validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`],
      warnings,
      suggestions,
    };
  }
}

/**
 * Development utility to log validation results
 */
export function logValidationResults(): void {
  if (__DEV__) {
    console.group('🔍 Store Validation Results');
    
    const migrationStatus = checkMigrationStatus();
    console.log('Migration Status:', migrationStatus);
    
    const integrity = validateStoreIntegrity();
    console.log('Data Integrity:', integrity);
    
    const componentIntegration = validateComponentIntegration();
    console.log('Component Integration:', componentIntegration);
    
    if (!migrationStatus.isComplete || !integrity.isValid || !componentIntegration.isValid) {
      console.warn('⚠️ Store validation found issues. Check the results above.');
    } else {
      console.log('✅ All validations passed!');
    }
    
    console.groupEnd();
  }
}

// Auto-run validation in development
if (__DEV__) {
  // Run validation after a short delay to allow store initialization
  setTimeout(logValidationResults, 1000);
}