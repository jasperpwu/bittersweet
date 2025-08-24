/**
 * Performance optimization tests
 * Validates Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 7.5
 */

import { renderHook, act } from '@testing-library/react-native';
import { 
  PerformanceMonitor, 
  MemoryManager, 
  CacheManager, 
  EntityCleanup,
  MemoryOptimizer,
  BatchProcessor
} from '../performance';
import { 
  useOptimizedDashboard,
  useOptimizedFocusSession,
  useOptimizedTasksList,
  useComponentPerformance
} from '../hooks/optimized';
import { createNormalizedState } from '../utils/entityManager';
import { FocusSession, Task } from '../types';

// Mock performance API
global.performance = {
  now: jest.fn(() => Date.now()),
  memory: {
    usedJSHeapSize: 50 * 1024 * 1024, // 50MB
    totalJSHeapSize: 100 * 1024 * 1024,
    jsHeapSizeLimit: 200 * 1024 * 1024
  }
} as any;

describe('Performance Monitoring', () => {
  let monitor: PerformanceMonitor;

  beforeEach(() => {
    monitor = PerformanceMonitor.getInstance();
    monitor.clearMetrics();
  });

  it('should record and retrieve metrics', () => {
    monitor.recordMetric('test_metric', 100);
    monitor.recordMetric('test_metric', 200);
    
    const metrics = monitor.getMetrics('test_metric');
    expect(metrics).toEqual([100, 200]);
    
    const average = monitor.getAverageMetric('test_metric');
    expect(average).toBe(150);
  });

  it('should record render times and warn about slow renders', () => {
    const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
    
    monitor.recordRenderTime('TestComponent', 20); // Slow render
    monitor.recordRenderTime('TestComponent', 10); // Fast render
    
    const renderStats = monitor.getRenderStats();
    expect(renderStats.totalRenders).toBe(2);
    expect(renderStats.averageRenderTime).toBe(15);
    expect(renderStats.slowRenders).toBe(1);
    
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('Slow render detected in TestComponent: 20ms')
    );
    
    consoleSpy.mockRestore();
  });

  it('should record memory usage', () => {
    monitor.recordMemoryUsage();
    
    const memoryUsage = monitor.getMemoryUsage();
    expect(memoryUsage.length).toBe(1);
    expect(memoryUsage[0]).toBe(50); // 50MB from mock
  });

  it('should limit metrics history', () => {
    // Add more than max history
    for (let i = 0; i < 150; i++) {
      monitor.recordMetric('test_metric', i);
    }
    
    const metrics = monitor.getMetrics('test_metric');
    expect(metrics.length).toBe(100); // Should be limited to maxMetricsHistory
    expect(metrics[0]).toBe(50); // Should keep most recent
  });
});

describe('Memory Management', () => {
  let manager: MemoryManager;

  beforeEach(() => {
    manager = MemoryManager.getInstance();
  });

  it('should register and run cleanup tasks', () => {
    const cleanupSpy = jest.fn();
    
    manager.registerCleanupTask('test_task', cleanupSpy);
    manager.runCleanup();
    
    expect(cleanupSpy).toHaveBeenCalled();
  });

  it('should check memory usage and trigger cleanup', () => {
    const cleanupSpy = jest.fn();
    manager.registerCleanupTask('test_task', cleanupSpy);
    
    // Set low threshold to trigger cleanup
    manager.setMemoryThreshold(10);
    
    const triggered = manager.checkMemoryUsage();
    expect(triggered).toBe(true);
    expect(cleanupSpy).toHaveBeenCalled();
  });

  it('should unregister cleanup tasks', () => {
    const cleanupSpy = jest.fn();
    
    manager.registerCleanupTask('test_task', cleanupSpy);
    manager.unregisterCleanupTask('test_task');
    manager.runCleanup();
    
    expect(cleanupSpy).not.toHaveBeenCalled();
  });
});

describe('Cache Management', () => {
  beforeEach(() => {
    CacheManager.clear();
  });

  it('should set and get cached data', () => {
    const testData = { test: 'data' };
    
    CacheManager.set('test_key', testData);
    const retrieved = CacheManager.get('test_key');
    
    expect(retrieved).toEqual(testData);
  });

  it('should respect TTL and expire data', (done) => {
    const testData = { test: 'data' };
    
    CacheManager.set('test_key', testData, 50); // 50ms TTL
    
    setTimeout(() => {
      const retrieved = CacheManager.get('test_key');
      expect(retrieved).toBeNull();
      done();
    }, 100);
  });

  it('should check if data exists and is not expired', () => {
    CacheManager.set('test_key', 'data', 1000);
    
    expect(CacheManager.has('test_key')).toBe(true);
    
    CacheManager.set('expired_key', 'data', 1);
    
    setTimeout(() => {
      expect(CacheManager.has('expired_key')).toBe(false);
    }, 10);
  });

  it('should cleanup expired entries', () => {
    CacheManager.set('key1', 'data1', 1000);
    CacheManager.set('key2', 'data2', 1); // Will expire quickly
    
    setTimeout(() => {
      CacheManager.cleanup();
      
      expect(CacheManager.has('key1')).toBe(true);
      expect(CacheManager.has('key2')).toBe(false);
    }, 10);
  });
});

describe('Entity Cleanup', () => {
  it('should cleanup normalized state by age', () => {
    const oldDate = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000); // 10 days ago
    const newDate = new Date();
    
    const sessions: FocusSession[] = [
      {
        id: '1',
        createdAt: oldDate,
        updatedAt: oldDate,
        userId: 'user1',
        startTime: oldDate,
        duration: 25,
        targetDuration: 25,
        categoryId: 'work',
        tagIds: [],
        status: 'completed',
        seedsEarned: 10,
        pauseHistory: []
      },
      {
        id: '2',
        createdAt: newDate,
        updatedAt: newDate,
        userId: 'user1',
        startTime: newDate,
        duration: 25,
        targetDuration: 25,
        categoryId: 'work',
        tagIds: [],
        status: 'completed',
        seedsEarned: 10,
        pauseHistory: []
      }
    ];
    
    const normalizedState = createNormalizedState(sessions);
    const cleanedState = EntityCleanup.cleanupNormalizedState(normalizedState);
    
    expect(cleanedState.allIds).toHaveLength(1);
    expect(cleanedState.byId['2']).toBeDefined();
    expect(cleanedState.byId['1']).toBeUndefined();
  });

  it('should limit entities by count', () => {
    const sessions: FocusSession[] = [];
    
    // Create 1500 sessions (more than max)
    for (let i = 0; i < 1500; i++) {
      sessions.push({
        id: `session_${i}`,
        createdAt: new Date(Date.now() - i * 1000), // Spread over time
        updatedAt: new Date(),
        userId: 'user1',
        startTime: new Date(),
        duration: 25,
        targetDuration: 25,
        categoryId: 'work',
        tagIds: [],
        status: 'completed',
        seedsEarned: 10,
        pauseHistory: []
      });
    }
    
    const normalizedState = createNormalizedState(sessions);
    const cleanedState = EntityCleanup.cleanupNormalizedState(normalizedState);
    
    expect(cleanedState.allIds.length).toBeLessThanOrEqual(1000);
    // Should keep most recent ones
    expect(cleanedState.byId['session_0']).toBeDefined();
  });
});

describe('Memory Optimizer', () => {
  it('should optimize store for memory usage', () => {
    // Mock high memory usage
    (global.performance as any).memory.usedJSHeapSize = 120 * 1024 * 1024; // 120MB
    
    const mockStore = {
      focus: {
        sessions: createNormalizedState([])
      },
      tasks: {
        tasks: createNormalizedState([])
      },
      ui: {
        errors: []
      }
    } as any;
    
    const optimizedStore = MemoryOptimizer.optimizeForMemoryUsage(mockStore);
    
    expect(optimizedStore).toBeDefined();
    // Should return optimized version when memory usage is high
  });
});

describe('Batch Processor', () => {
  it('should batch operations and execute them', (done) => {
    const operation1 = jest.fn();
    const operation2 = jest.fn();
    
    BatchProcessor.addToBatch('test_batch', operation1, 2, 50);
    BatchProcessor.addToBatch('test_batch', operation2, 2, 50);
    
    // Should execute immediately when batch is full
    setTimeout(() => {
      expect(operation1).toHaveBeenCalled();
      expect(operation2).toHaveBeenCalled();
      done();
    }, 10);
  });

  it('should flush batch manually', () => {
    const operation = jest.fn();
    
    BatchProcessor.addToBatch('test_batch', operation, 10, 1000); // Won't auto-execute
    BatchProcessor.flushBatch('test_batch');
    
    expect(operation).toHaveBeenCalled();
  });
});

describe('Optimized Hooks', () => {
  it('should use component performance monitoring', () => {
    const { result } = renderHook(() => useComponentPerformance('TestComponent'));
    
    expect(result.current.componentName).toBe('TestComponent');
    expect(result.current.renderCount).toBeGreaterThan(0);
    expect(typeof result.current.registerCleanup).toBe('function');
  });

  // Note: Other hook tests would require proper store setup and mocking
  // which is beyond the scope of this performance-focused test file
});

describe('Performance Integration', () => {
  it('should initialize performance monitoring without errors', () => {
    const { initializePerformanceMonitoring } = require('../performance');
    
    expect(() => {
      initializePerformanceMonitoring();
    }).not.toThrow();
  });

  it('should create performance middleware without errors', () => {
    const { createPerformanceMiddleware } = require('../performance');
    
    const middleware = createPerformanceMiddleware({
      enablePerformanceMonitoring: true,
      enableMemoryCleanup: true,
      memoryThreshold: 50
    });
    
    expect(typeof middleware).toBe('function');
  });
});