/**
 * Performance monitoring, lazy loading, and memory management utilities
 * Addresses Requirements: 6.3, 6.4, 6.5, 7.5
 */

import { useRef, useEffect, useCallback, useMemo, useState } from 'react';
import { RootStore } from '../types';

// Performance monitoring
export class PerformanceMonitor {
  private static instance: PerformanceMonitor;
  private metrics: Map<string, number[]> = new Map();
  private memoryUsage: number[] = [];
  private renderTimes: number[] = [];
  private maxMetricsHistory = 100;

  static getInstance(): PerformanceMonitor {
    if (!PerformanceMonitor.instance) {
      PerformanceMonitor.instance = new PerformanceMonitor();
    }
    return PerformanceMonitor.instance;
  }

  recordMetric(name: string, value: number): void {
    if (!this.metrics.has(name)) {
      this.metrics.set(name, []);
    }
    
    const values = this.metrics.get(name)!;
    values.push(value);
    
    // Keep only recent metrics
    if (values.length > this.maxMetricsHistory) {
      values.shift();
    }
  }

  recordRenderTime(componentName: string, renderTime: number): void {
    this.recordMetric(`render_${componentName}`, renderTime);
    this.renderTimes.push(renderTime);
    
    if (this.renderTimes.length > this.maxMetricsHistory) {
      this.renderTimes.shift();
    }
    
    // Warn about slow renders in development
    if (__DEV__ && renderTime > 16) {
      console.warn(`Slow render detected in ${componentName}: ${renderTime}ms`);
    }
  }

  recordMemoryUsage(): void {
    if (typeof performance !== 'undefined' && (performance as any).memory) {
      const memory = (performance as any).memory;
      const usage = memory.usedJSHeapSize / 1024 / 1024; // MB
      
      this.memoryUsage.push(usage);
      
      if (this.memoryUsage.length > this.maxMetricsHistory) {
        this.memoryUsage.shift();
      }
      
      // Warn about high memory usage
      if (__DEV__ && usage > 100) {
        console.warn(`High memory usage detected: ${usage.toFixed(2)}MB`);
      }
    }
  }

  getMetrics(name: string): number[] {
    return this.metrics.get(name) || [];
  }

  getAverageMetric(name: string): number {
    const values = this.getMetrics(name);
    return values.length > 0 ? values.reduce((sum, val) => sum + val, 0) / values.length : 0;
  }

  getMemoryUsage(): number[] {
    return [...this.memoryUsage];
  }

  getCurrentMemoryUsage(): number {
    if (typeof performance !== 'undefined' && (performance as any).memory) {
      const memory = (performance as any).memory;
      return memory.usedJSHeapSize / 1024 / 1024; // MB
    }
    return 0;
  }

  getRenderStats(): {
    averageRenderTime: number;
    slowRenders: number;
    totalRenders: number;
  } {
    const totalRenders = this.renderTimes.length;
    const averageRenderTime = totalRenders > 0 
      ? this.renderTimes.reduce((sum, time) => sum + time, 0) / totalRenders 
      : 0;
    const slowRenders = this.renderTimes.filter(time => time > 16).length;
    
    return {
      averageRenderTime,
      slowRenders,
      totalRenders
    };
  }

  clearMetrics(): void {
    this.metrics.clear();
    this.memoryUsage = [];
    this.renderTimes = [];
  }
}

// Performance monitoring hook
export const usePerformanceMonitor = (componentName: string) => {
  const monitor = PerformanceMonitor.getInstance();
  const renderStartTime = useRef<number>();
  const renderCount = useRef(0);

  useEffect(() => {
    renderStartTime.current = performance.now();
    renderCount.current += 1;
  });

  useEffect(() => {
    if (renderStartTime.current) {
      const renderTime = performance.now() - renderStartTime.current;
      monitor.recordRenderTime(componentName, renderTime);
    }
  });

  return {
    renderCount: renderCount.current,
    recordMetric: (name: string, value: number) => monitor.recordMetric(name, value),
    getMetrics: (name: string) => monitor.getMetrics(name),
    getAverageMetric: (name: string) => monitor.getAverageMetric(name)
  };
};

// Memory management utilities
export class MemoryManager {
  private static instance: MemoryManager;
  private cleanupTasks: Map<string, () => void> = new Map();
  private memoryThreshold = 50; // MB

  static getInstance(): MemoryManager {
    if (!MemoryManager.instance) {
      MemoryManager.instance = new MemoryManager();
    }
    return MemoryManager.instance;
  }

  registerCleanupTask(id: string, cleanup: () => void): void {
    this.cleanupTasks.set(id, cleanup);
  }

  unregisterCleanupTask(id: string): void {
    this.cleanupTasks.delete(id);
  }

  runCleanup(): void {
    this.cleanupTasks.forEach((cleanup, id) => {
      try {
        cleanup();
      } catch (error) {
        console.error(`Error running cleanup task ${id}:`, error);
      }
    });
  }

  checkMemoryUsage(): boolean {
    const monitor = PerformanceMonitor.getInstance();
    const currentUsage = monitor.getCurrentMemoryUsage();
    
    if (currentUsage > this.memoryThreshold) {
      if (__DEV__) {
        console.warn(`Memory usage above threshold: ${currentUsage.toFixed(2)}MB`);
      }
      this.runCleanup();
      return true;
    }
    
    return false;
  }

  setMemoryThreshold(threshold: number): void {
    this.memoryThreshold = threshold;
  }
}

// Memory management hook
export const useMemoryManagement = (componentId: string) => {
  const manager = MemoryManager.getInstance();
  const cleanupTasks = useRef<(() => void)[]>([]);

  const registerCleanup = useCallback((cleanup: () => void) => {
    cleanupTasks.current.push(cleanup);
    manager.registerCleanupTask(`${componentId}_${cleanupTasks.current.length}`, cleanup);
  }, [componentId, manager]);

  useEffect(() => {
    return () => {
      // Run all cleanup tasks when component unmounts
      cleanupTasks.current.forEach(cleanup => {
        try {
          cleanup();
        } catch (error) {
          console.error('Error in cleanup task:', error);
        }
      });
      
      // Unregister from global manager
      cleanupTasks.current.forEach((_, index) => {
        manager.unregisterCleanupTask(`${componentId}_${index + 1}`);
      });
    };
  }, [componentId, manager]);

  return {
    registerCleanup,
    checkMemoryUsage: () => manager.checkMemoryUsage()
  };
};

// Lazy loading utilities
export class LazyLoader {
  private static loadedModules: Set<string> = new Set();
  private static loadingPromises: Map<string, Promise<any>> = new Map();

  static async loadModule<T>(
    moduleId: string,
    loader: () => Promise<T>
  ): Promise<T> {
    if (this.loadedModules.has(moduleId)) {
      return loader(); // Return cached result
    }

    if (this.loadingPromises.has(moduleId)) {
      return this.loadingPromises.get(moduleId)!;
    }

    const loadingPromise = loader().then(module => {
      this.loadedModules.add(moduleId);
      this.loadingPromises.delete(moduleId);
      return module;
    }).catch(error => {
      this.loadingPromises.delete(moduleId);
      throw error;
    });

    this.loadingPromises.set(moduleId, loadingPromise);
    return loadingPromise;
  }

  static isLoaded(moduleId: string): boolean {
    return this.loadedModules.has(moduleId);
  }

  static isLoading(moduleId: string): boolean {
    return this.loadingPromises.has(moduleId);
  }

  static clearCache(): void {
    this.loadedModules.clear();
    this.loadingPromises.clear();
  }
}

// Lazy loading hook
export const useLazyLoad = <T>(
  moduleId: string,
  loader: () => Promise<T>,
  shouldLoad: boolean = true
) => {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!shouldLoad) return;

    if (LazyLoader.isLoaded(moduleId)) {
      // Module already loaded, get it immediately
      loader().then(setData).catch(setError);
      return;
    }

    if (LazyLoader.isLoading(moduleId)) {
      setLoading(true);
    }

    LazyLoader.loadModule(moduleId, loader)
      .then(module => {
        setData(module);
        setLoading(false);
        setError(null);
      })
      .catch(err => {
        setError(err);
        setLoading(false);
      });
  }, [moduleId, loader, shouldLoad]);

  return {
    data,
    loading,
    error,
    isLoaded: LazyLoader.isLoaded(moduleId)
  };
};

// State cleanup utilities
export class StateCleanup {
  private static cleanupRules: Map<string, (state: any) => any> = new Map();

  static registerCleanupRule(
    stateKey: string,
    cleanup: (state: any) => any
  ): void {
    this.cleanupRules.set(stateKey, cleanup);
  }

  static cleanupState(state: RootStore): Partial<RootStore> {
    const cleanedState: Partial<RootStore> = {};

    Object.keys(state).forEach(key => {
      const stateKey = key as keyof RootStore;
      const cleanupRule = this.cleanupRules.get(stateKey);
      
      if (cleanupRule) {
        cleanedState[stateKey] = cleanupRule(state[stateKey]) as any;
      } else {
        cleanedState[stateKey] = state[stateKey];
      }
    });

    return cleanedState;
  }

  static clearOldData(state: RootStore, maxAge: number = 7 * 24 * 60 * 60 * 1000): Partial<RootStore> {
    const cutoffDate = new Date(Date.now() - maxAge);
    
    return {
      ...state,
      focus: {
        ...state.focus,
        sessions: {
          ...state.focus.sessions,
          byId: Object.fromEntries(
            Object.entries(state.focus.sessions.byId).filter(
              ([, session]) => new Date(session.createdAt) > cutoffDate
            )
          ),
          allIds: state.focus.sessions.allIds.filter(
            id => state.focus.sessions.byId[id] && 
                  new Date(state.focus.sessions.byId[id].createdAt) > cutoffDate
          )
        }
      },
      rewards: {
        ...state.rewards,
        transactions: {
          ...state.rewards.transactions,
          byId: Object.fromEntries(
            Object.entries(state.rewards.transactions.byId).filter(
              ([, transaction]) => new Date(transaction.createdAt) > cutoffDate
            )
          ),
          allIds: state.rewards.transactions.allIds.filter(
            id => state.rewards.transactions.byId[id] && 
                  new Date(state.rewards.transactions.byId[id].createdAt) > cutoffDate
          )
        }
      },
      ui: {
        ...state.ui,
        errors: state.ui.errors.filter(
          error => new Date(error.timestamp) > cutoffDate
        )
      }
    };
  }
}

// Optimization patterns
export const useOptimizedCallback = <T extends (...args: any[]) => any>(
  callback: T,
  deps: any[],
  delay: number = 0
): T => {
  const timeoutRef = useRef<NodeJS.Timeout>();
  
  return useCallback((...args: Parameters<T>) => {
    if (delay > 0) {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      
      timeoutRef.current = setTimeout(() => {
        callback(...args);
      }, delay);
    } else {
      callback(...args);
    }
  }, deps) as T;
};

export const useOptimizedMemo = <T>(
  factory: () => T,
  deps: any[],
  maxCacheSize: number = 10
): T => {
  const cache = useRef<Map<string, T>>(new Map());
  
  return useMemo(() => {
    const key = JSON.stringify(deps);
    
    if (cache.current.has(key)) {
      return cache.current.get(key)!;
    }
    
    const result = factory();
    
    // Manage cache size
    if (cache.current.size >= maxCacheSize) {
      const firstKey = cache.current.keys().next().value;
      cache.current.delete(firstKey);
    }
    
    cache.current.set(key, result);
    return result;
  }, deps);
};

// Performance monitoring middleware
export const performanceMiddleware = (config: any) => (set: any, get: any, api: any) => {
  const monitor = PerformanceMonitor.getInstance();
  
  return config(
    (...args: any[]) => {
      const start = performance.now();
      const result = set(...args);
      const end = performance.now();
      
      monitor.recordMetric('state_update', end - start);
      
      if (__DEV__ && end - start > 16) {
        console.warn(`Slow state update: ${end - start}ms`);
      }
      
      return result;
    },
    get,
    api
  );
};

// Memory cleanup middleware
export const memoryCleanupMiddleware = (config: any) => (set: any, get: any, api: any) => {
  const manager = MemoryManager.getInstance();
  let updateCount = 0;
  
  return config(
    (...args: any[]) => {
      const result = set(...args);
      updateCount++;
      
      // Check memory usage every 100 updates
      if (updateCount % 100 === 0) {
        manager.checkMemoryUsage();
        
        // Record memory usage
        PerformanceMonitor.getInstance().recordMemoryUsage();
      }
      
      return result;
    },
    get,
    api
  );
};