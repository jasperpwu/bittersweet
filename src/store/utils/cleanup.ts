/**
 * State cleanup mechanisms and optimization patterns
 * Addresses Requirements: 6.4, 6.5, 7.5
 */

import { RootStore, NormalizedState, BaseEntity } from '../types';
import { MemoryManager, StateCleanup } from './performance';

// Cleanup configuration
export interface CleanupConfig {
  maxAge: number; // milliseconds
  maxEntities: number;
  cleanupInterval: number; // milliseconds
  enableAutoCleanup: boolean;
}

export const DEFAULT_CLEANUP_CONFIG: CleanupConfig = {
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  maxEntities: 1000,
  cleanupInterval: 60 * 60 * 1000, // 1 hour
  enableAutoCleanup: true
};

// Entity cleanup utilities
export class EntityCleanup {
  private static config: CleanupConfig = DEFAULT_CLEANUP_CONFIG;
  private static cleanupTimer: NodeJS.Timeout | null = null;

  static setConfig(config: Partial<CleanupConfig>): void {
    this.config = { ...this.config, ...config };
    
    if (this.config.enableAutoCleanup) {
      this.startAutoCleanup();
    } else {
      this.stopAutoCleanup();
    }
  }

  static startAutoCleanup(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }
    
    this.cleanupTimer = setInterval(() => {
      this.performCleanup();
    }, this.config.cleanupInterval);
  }

  static stopAutoCleanup(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
  }

  static performCleanup(): void {
    const memoryManager = MemoryManager.getInstance();
    memoryManager.runCleanup();
    
    if (__DEV__) {
      console.log('🧹 Performed automatic cleanup');
    }
  }

  static cleanupNormalizedState<T extends BaseEntity>(
    state: NormalizedState<T>
  ): NormalizedState<T> {
    const cutoffDate = new Date(Date.now() - this.config.maxAge);
    const maxEntities = this.config.maxEntities;
    
    // Filter by age
    const validEntities = state.allIds
      .map(id => state.byId[id])
      .filter(entity => entity && new Date(entity.createdAt) > cutoffDate)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    
    // Limit by count (keep most recent)
    const limitedEntities = validEntities.slice(0, maxEntities);
    
    const newById: Record<string, T> = {};
    const newAllIds: string[] = [];
    
    limitedEntities.forEach(entity => {
      newById[entity.id] = entity;
      newAllIds.push(entity.id);
    });
    
    return {
      ...state,
      byId: newById,
      allIds: newAllIds,
      lastUpdated: new Date()
    };
  }

  static cleanupStore(store: RootStore): Partial<RootStore> {
    const cleanedStore: Partial<RootStore> = {};
    
    // Clean focus sessions
    if (store.focus) {
      cleanedStore.focus = {
        ...store.focus,
        sessions: this.cleanupNormalizedState(store.focus.sessions)
      };
    }
    
    // Focus sessions are the primary entity for time tracking
    
    // Clean reward transactions
    if (store.rewards) {
      cleanedStore.rewards = {
        ...store.rewards,
        transactions: this.cleanupNormalizedState(store.rewards.transactions)
      };
    }
    
    // Clean UI errors
    if (store.ui) {
      const cutoffDate = new Date(Date.now() - this.config.maxAge);
      cleanedStore.ui = {
        ...store.ui,
        errors: store.ui.errors
          .filter(error => new Date(error.timestamp) > cutoffDate)
          .slice(-50) // Keep only last 50 errors
      };
    }
    
    return cleanedStore;
  }
}

// Memory optimization utilities
export class MemoryOptimizer {
  private static readonly MEMORY_THRESHOLDS = {
    LOW: 25, // MB
    MEDIUM: 50, // MB
    HIGH: 100 // MB
  };

  static optimizeForMemoryUsage(store: RootStore): Partial<RootStore> {
    const memoryManager = MemoryManager.getInstance();
    const currentUsage = memoryManager.getCurrentMemoryUsage();
    
    if (currentUsage < this.MEMORY_THRESHOLDS.LOW) {
      return store; // No optimization needed
    }
    
    let optimizedStore = { ...store };
    
    if (currentUsage > this.MEMORY_THRESHOLDS.MEDIUM) {
      // Medium optimization: cleanup old data
      optimizedStore = {
        ...optimizedStore,
        ...EntityCleanup.cleanupStore(store)
      };
    }
    
    if (currentUsage > this.MEMORY_THRESHOLDS.HIGH) {
      // Aggressive optimization: reduce data further
      optimizedStore = this.aggressiveOptimization(optimizedStore);
    }
    
    return optimizedStore;
  }

  private static aggressiveOptimization(store: Partial<RootStore>): Partial<RootStore> {
    const optimized = { ...store };
    
    // Focus sessions optimization removed - sessions are now the primary entity
    
    // Clear UI errors
    if (optimized.ui) {
      optimized.ui = {
        ...optimized.ui,
        errors: []
      };
    }
    
    return optimized;
  }
}

// Cache management
export class CacheManager {
  private static cache: Map<string, { data: any; timestamp: number; ttl: number }> = new Map();
  private static readonly DEFAULT_TTL = 5 * 60 * 1000; // 5 minutes

  static set(key: string, data: any, ttl: number = this.DEFAULT_TTL): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl
    });
  }

  static get<T>(key: string): T | null {
    const cached = this.cache.get(key);
    
    if (!cached) {
      return null;
    }
    
    const isExpired = Date.now() - cached.timestamp > cached.ttl;
    
    if (isExpired) {
      this.cache.delete(key);
      return null;
    }
    
    return cached.data;
  }

  static has(key: string): boolean {
    const cached = this.cache.get(key);
    
    if (!cached) {
      return false;
    }
    
    const isExpired = Date.now() - cached.timestamp > cached.ttl;
    
    if (isExpired) {
      this.cache.delete(key);
      return false;
    }
    
    return true;
  }

  static delete(key: string): void {
    this.cache.delete(key);
  }

  static clear(): void {
    this.cache.clear();
  }

  static cleanup(): void {
    const now = Date.now();
    
    for (const [key, cached] of this.cache.entries()) {
      if (now - cached.timestamp > cached.ttl) {
        this.cache.delete(key);
      }
    }
  }

  static getStats(): {
    size: number;
    hitRate: number;
    memoryUsage: number;
  } {
    const size = this.cache.size;
    const memoryUsage = JSON.stringify([...this.cache.values()]).length / 1024; // KB
    
    return {
      size,
      hitRate: 0, // Would need to track hits/misses
      memoryUsage
    };
  }
}

// Batch operations for performance
export class BatchProcessor {
  private static batches: Map<string, { operations: (() => void)[]; timeout: NodeJS.Timeout }> = new Map();
  private static readonly DEFAULT_BATCH_SIZE = 10;
  private static readonly DEFAULT_BATCH_DELAY = 100; // ms

  static addToBatch(
    batchId: string,
    operation: () => void,
    batchSize: number = this.DEFAULT_BATCH_SIZE,
    delay: number = this.DEFAULT_BATCH_DELAY
  ): void {
    if (!this.batches.has(batchId)) {
      this.batches.set(batchId, {
        operations: [],
        timeout: setTimeout(() => this.processBatch(batchId), delay)
      });
    }
    
    const batch = this.batches.get(batchId)!;
    batch.operations.push(operation);
    
    // Process immediately if batch is full
    if (batch.operations.length >= batchSize) {
      clearTimeout(batch.timeout);
      this.processBatch(batchId);
    }
  }

  private static processBatch(batchId: string): void {
    const batch = this.batches.get(batchId);
    
    if (!batch) {
      return;
    }
    
    // Execute all operations in the batch
    batch.operations.forEach(operation => {
      try {
        operation();
      } catch (error) {
        console.error('Error in batch operation:', error);
      }
    });
    
    // Clean up
    this.batches.delete(batchId);
  }

  static flushBatch(batchId: string): void {
    const batch = this.batches.get(batchId);
    
    if (batch) {
      clearTimeout(batch.timeout);
      this.processBatch(batchId);
    }
  }

  static flushAllBatches(): void {
    for (const batchId of this.batches.keys()) {
      this.flushBatch(batchId);
    }
  }
}

// Initialize cleanup systems
export const initializeCleanupSystems = (): void => {
  // Register cleanup rules
  StateCleanup.registerCleanupRule('focus', (focusState) => {
    return EntityCleanup.cleanupNormalizedState(focusState.sessions);
  });
  
  // Focus sessions cleanup rule removed - sessions are now the primary entity
  
  StateCleanup.registerCleanupRule('rewards', (rewardsState) => {
    return EntityCleanup.cleanupNormalizedState(rewardsState.transactions);
  });
  
  // Start auto cleanup
  EntityCleanup.startAutoCleanup();
  
  // Setup cache cleanup interval
  setInterval(() => {
    CacheManager.cleanup();
  }, 10 * 60 * 1000); // Every 10 minutes
  
  if (__DEV__) {
    console.log('🧹 Cleanup systems initialized');
  }
};

// Cleanup on app background/foreground
export const handleAppStateChange = (nextAppState: string): void => {
  if (nextAppState === 'background') {
    // Aggressive cleanup when app goes to background
    EntityCleanup.performCleanup();
    CacheManager.cleanup();
    BatchProcessor.flushAllBatches();
  }
};

// Classes are already exported individually above