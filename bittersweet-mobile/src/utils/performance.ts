/**
 * Performance monitoring utilities for components
 * Requirements: 7.1, 7.2, 7.3, 7.4
 */

import { useEffect, useRef } from 'react';
import { logger } from './logger';

// Hook to monitor component render performance
export const useRenderPerformance = (componentName: string, props?: any) => {
    const renderCount = useRef(0);
    const lastRenderTime = useRef(0);

    useEffect(() => {
        renderCount.current += 1;
        const now = performance.now();

        if (lastRenderTime.current > 0) {
            const timeSinceLastRender = now - lastRenderTime.current;

            // Log frequent re-renders as potential performance issues
            if (timeSinceLastRender < 16) { // Less than one frame (60fps)
                logger.warn(`Frequent re-render detected in ${componentName}`, {
                    renderCount: renderCount.current,
                    timeSinceLastRender: timeSinceLastRender.toFixed(2),
                    props
                });
            }
        }

        lastRenderTime.current = now;

        // Log render info in development
        logger.componentRender(componentName, {
            renderCount: renderCount.current,
            propsKeys: props ? Object.keys(props) : []
        });
    });

    return renderCount.current;
};

// Hook to monitor expensive operations
export const useOperationPerformance = () => {
    return {
        measureOperation: <T>(operationName: string, operation: () => T): T => {
            const startTime = logger.performanceStart(operationName);
            try {
                const result = operation();
                logger.performanceEnd(operationName, startTime);
                return result;
            } catch (error) {
                logger.performanceEnd(operationName, startTime, { error: true });
                throw error;
            }
        },

        measureAsyncOperation: async <T>(operationName: string, operation: () => Promise<T>): Promise<T> => {
            const startTime = logger.performanceStart(operationName);
            try {
                const result = await operation();
                logger.performanceEnd(operationName, startTime);
                return result;
            } catch (error) {
                logger.performanceEnd(operationName, startTime, { error: true });
                throw error;
            }
        }
    };
};

// Memory usage monitoring (development only)
export const logMemoryUsage = (context: string) => {
    if (__DEV__ && (performance as any).memory) {
        const memory = (performance as any).memory;
        logger.debug(`Memory Usage - ${context}`, {
            usedJSHeapSize: `${(memory.usedJSHeapSize / 1024 / 1024).toFixed(2)} MB`,
            totalJSHeapSize: `${(memory.totalJSHeapSize / 1024 / 1024).toFixed(2)} MB`,
            jsHeapSizeLimit: `${(memory.jsHeapSizeLimit / 1024 / 1024).toFixed(2)} MB`
        });
    }
};

// Performance monitoring for store operations
export const withPerformanceMonitoring = <T extends (...args: any[]) => any>(
    fn: T,
    operationName: string
): T => {
    return ((...args: Parameters<T>) => {
        const startTime = logger.performanceStart(operationName);
        try {
            const result = fn(...args);
            logger.performanceEnd(operationName, startTime, { argsCount: args.length });
            return result;
        } catch (error) {
            logger.performanceEnd(operationName, startTime, { error: true });
            throw error;
        }
    }) as T;
};

// Debounce utility for performance optimization
export const debounce = <T extends (...args: any[]) => any>(
    func: T,
    delay: number
): ((...args: Parameters<T>) => void) => {
    let timeoutId: NodeJS.Timeout;

    return (...args: Parameters<T>) => {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => func(...args), delay);
    };
};

// Throttle utility for performance optimization
export const throttle = <T extends (...args: any[]) => any>(
    func: T,
    delay: number
): ((...args: Parameters<T>) => void) => {
    let lastCall = 0;

    return (...args: Parameters<T>) => {
        const now = Date.now();
        if (now - lastCall >= delay) {
            lastCall = now;
            func(...args);
        }
    };
};