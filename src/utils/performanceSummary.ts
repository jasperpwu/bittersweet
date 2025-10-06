/**
 * Performance summary and reporting utilities
 * Requirements: 7.1, 7.2, 7.3, 7.4
 */

import { logger } from './logger';

interface PerformanceMetric {
    operation: string;
    duration: number;
    timestamp: number;
    data?: any;
}

class PerformanceTracker {
    private metrics: PerformanceMetric[] = [];
    private maxMetrics = 100; // Keep last 100 metrics

    addMetric(operation: string, duration: number, data?: any) {
        this.metrics.push({
            operation,
            duration,
            timestamp: Date.now(),
            data
        });

        // Keep only recent metrics
        if (this.metrics.length > this.maxMetrics) {
            this.metrics = this.metrics.slice(-this.maxMetrics);
        }
    }

    getMetrics(operation?: string): PerformanceMetric[] {
        if (operation) {
            return this.metrics.filter(m => m.operation === operation);
        }
        return [...this.metrics];
    }

    getAverageTime(operation: string): number {
        const operationMetrics = this.getMetrics(operation);
        if (operationMetrics.length === 0) return 0;

        const total = operationMetrics.reduce((sum, metric) => sum + metric.duration, 0);
        return total / operationMetrics.length;
    }

    getSlowOperations(threshold: number = 100): PerformanceMetric[] {
        return this.metrics.filter(m => m.duration > threshold);
    }

    generateReport(): string {
        const report = [];
        report.push('📊 Performance Report');
        report.push('==================');
        report.push(`Total operations tracked: ${this.metrics.length}`);
        report.push('');

        // Group by operation type
        const operationGroups: Record<string, PerformanceMetric[]> = {};
        this.metrics.forEach(metric => {
            if (!operationGroups[metric.operation]) {
                operationGroups[metric.operation] = [];
            }
            operationGroups[metric.operation].push(metric);
        });

        // Report by operation
        Object.entries(operationGroups).forEach(([operation, metrics]) => {
            const avgTime = this.getAverageTime(operation);
            const maxTime = Math.max(...metrics.map(m => m.duration));
            const minTime = Math.min(...metrics.map(m => m.duration));

            report.push(`${operation}:`);
            report.push(`  Count: ${metrics.length}`);
            report.push(`  Average: ${avgTime.toFixed(2)}ms`);
            report.push(`  Min: ${minTime.toFixed(2)}ms`);
            report.push(`  Max: ${maxTime.toFixed(2)}ms`);
            report.push('');
        });

        // Slow operations
        const slowOps = this.getSlowOperations();
        if (slowOps.length > 0) {
            report.push('⚠️  Slow Operations (>100ms):');
            slowOps.forEach(op => {
                report.push(`  ${op.operation}: ${op.duration.toFixed(2)}ms`);
            });
            report.push('');
        }

        return report.join('\n');
    }

    clear() {
        this.metrics = [];
    }
}

// Global performance tracker
export const performanceTracker = new PerformanceTracker();

// Enhanced logger that also tracks metrics
export const trackPerformance = (operation: string, duration: number, data?: any) => {
    performanceTracker.addMetric(operation, duration, data);

    if (__DEV__) {
        logger.info(`Performance: ${operation} - ${duration.toFixed(2)}ms`, data);
    }
};

// Utility to log performance summary
export const logPerformanceSummary = () => {
    if (__DEV__) {
        const report = performanceTracker.generateReport();
        console.log(report);
    }
};

// Hook to monitor app performance
export const usePerformanceMonitoring = () => {
    return {
        getMetrics: performanceTracker.getMetrics.bind(performanceTracker),
        getAverageTime: performanceTracker.getAverageTime.bind(performanceTracker),
        getSlowOperations: performanceTracker.getSlowOperations.bind(performanceTracker),
        generateReport: performanceTracker.generateReport.bind(performanceTracker),
        clear: performanceTracker.clear.bind(performanceTracker)
    };
};

// Auto-report performance every 5 minutes in development
if (__DEV__) {
    setInterval(() => {
        const slowOps = performanceTracker.getSlowOperations();
        if (slowOps.length > 0) {
            logger.warn(`Found ${slowOps.length} slow operations in the last period`);
            slowOps.forEach(op => {
                logger.warn(`Slow operation: ${op.operation} took ${op.duration.toFixed(2)}ms`);
            });
        }
    }, 5 * 60 * 1000); // 5 minutes
}