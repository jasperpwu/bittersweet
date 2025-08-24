/**
 * Performance optimization exports
 * Addresses Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 7.5
 */

// Selectors
export * from '../selectors';

// Hooks
export * from '../hooks';

// Performance utilities
export {
  PerformanceMonitor,
  MemoryManager,
  LazyLoader,
  StateCleanup,
  usePerformanceMonitor,
  useMemoryManagement,
  useLazyLoad,
  useOptimizedCallback,
  useOptimizedMemo,
  performanceMiddleware,
  memoryCleanupMiddleware
} from '../utils/performance';

// Cleanup utilities
export {
  EntityCleanup,
  MemoryOptimizer,
  CacheManager,
  BatchProcessor,
  initializeCleanupSystems,
  handleAppStateChange,
  DEFAULT_CLEANUP_CONFIG
} from '../utils/cleanup';

// Performance monitoring setup
import { PerformanceMonitor, MemoryManager } from '../utils/performance';
import { initializeCleanupSystems } from '../utils/cleanup';

export const initializePerformanceMonitoring = (): void => {
  // Initialize performance monitoring
  const monitor = PerformanceMonitor.getInstance();
  const memoryManager = MemoryManager.getInstance();
  
  // Set memory threshold (50MB)
  memoryManager.setMemoryThreshold(50);
  
  // Initialize cleanup systems
  initializeCleanupSystems();
  
  // Setup periodic memory monitoring
  setInterval(() => {
    monitor.recordMemoryUsage();
    memoryManager.checkMemoryUsage();
  }, 30000); // Every 30 seconds
  
  if (__DEV__) {
    console.log('🚀 Performance monitoring initialized');
    
    // Log performance stats every minute in development
    setInterval(() => {
      const renderStats = monitor.getRenderStats();
      const memoryUsage = monitor.getCurrentMemoryUsage();
      
      console.log('📊 Performance Stats:', {
        averageRenderTime: renderStats.averageRenderTime.toFixed(2) + 'ms',
        slowRenders: renderStats.slowRenders,
        totalRenders: renderStats.totalRenders,
        memoryUsage: memoryUsage.toFixed(2) + 'MB'
      });
    }, 60000);
  }
};

// Performance optimization middleware factory
export const createPerformanceMiddleware = (options: {
  enablePerformanceMonitoring?: boolean;
  enableMemoryCleanup?: boolean;
  memoryThreshold?: number;
} = {}) => {
  const {
    enablePerformanceMonitoring = true,
    enableMemoryCleanup = true,
    memoryThreshold = 50
  } = options;
  
  return (config: any) => (set: any, get: any, api: any) => {
    let middleware = config;
    
    if (enablePerformanceMonitoring) {
      const { performanceMiddleware } = require('../utils/performance');
      middleware = performanceMiddleware(middleware);
    }
    
    if (enableMemoryCleanup) {
      const { memoryCleanupMiddleware } = require('../utils/performance');
      middleware = memoryCleanupMiddleware(middleware);
      
      // Set memory threshold
      const memoryManager = MemoryManager.getInstance();
      memoryManager.setMemoryThreshold(memoryThreshold);
    }
    
    return middleware(set, get, api);
  };
};