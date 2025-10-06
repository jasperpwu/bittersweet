/**
 * Simple logging utility for store operations
 * Requirements: 5.1, 5.2, 5.3, 5.4
 */

type LogLevel = 'info' | 'warn' | 'error' | 'debug';

class SimpleLogger {
    private isDevelopment = __DEV__;

    private formatMessage(level: LogLevel, message: string, data?: any): string {
        const timestamp = new Date().toISOString();
        const prefix = this.getPrefix(level);

        if (data) {
            return `${prefix} [${timestamp}] ${message} ${JSON.stringify(data, null, 2)}`;
        }

        return `${prefix} [${timestamp}] ${message}`;
    }

    private getPrefix(level: LogLevel): string {
        switch (level) {
            case 'info':
                return '✅';
            case 'warn':
                return '⚠️';
            case 'error':
                return '❌';
            case 'debug':
                return '🔍';
            default:
                return 'ℹ️';
        }
    }

    info(message: string, data?: any): void {
        if (this.isDevelopment) {
            console.log(this.formatMessage('info', message, data));
        }
    }

    warn(message: string, data?: any): void {
        console.warn(this.formatMessage('warn', message, data));
    }

    error(message: string, error?: Error | any): void {
        const errorData = error instanceof Error
            ? { message: error.message, stack: error.stack }
            : error;

        console.error(this.formatMessage('error', message, errorData));
    }

    debug(message: string, data?: any): void {
        if (this.isDevelopment) {
            console.debug(this.formatMessage('debug', message, data));
        }
    }

    // Store-specific logging methods
    storeAction(action: string, slice: string, data?: any): void {
        this.info(`Store Action: ${slice}.${action}`, data);
    }

    storeError(action: string, slice: string, error: Error): void {
        this.error(`Store Error: ${slice}.${action}`, error);
    }

    timerEvent(event: string, sessionId?: string): void {
        this.debug(`Timer Event: ${event}`, { sessionId });
    }

    persistenceEvent(event: string, data?: any): void {
        this.info(`Persistence: ${event}`, data);
    }

    // Performance logging methods
    performanceStart(operation: string): number {
        const startTime = performance.now();
        if (this.isDevelopment) {
            this.debug(`Performance Start: ${operation}`);
        }
        return startTime;
    }

    performanceEnd(operation: string, startTime: number, data?: any): void {
        const duration = performance.now() - startTime;

        // Track the performance metric globally if tracker is available
        if (typeof globalThis !== 'undefined' && (globalThis as any).performanceTracker) {
            (globalThis as any).performanceTracker.addMetric(operation, duration, data);
        }

        if (this.isDevelopment) {
            this.info(`Performance: ${operation} completed in ${duration.toFixed(2)}ms`, data);
        }

        // Log slow operations as warnings
        if (duration > 100) {
            this.warn(`Slow operation detected: ${operation} took ${duration.toFixed(2)}ms`, data);
        }
    }

    componentRender(componentName: string, props?: any): void {
        if (this.isDevelopment) {
            this.debug(`Component Render: ${componentName}`, props);
        }
    }

    selectorUsage(selectorName: string, result?: any): void {
        if (this.isDevelopment) {
            this.debug(`Selector Usage: ${selectorName}`, { resultType: typeof result });
        }
    }
}

// Export singleton instance
export const logger = new SimpleLogger();

// Convenience functions for common logging patterns
export const logStoreAction = (slice: string, action: string, data?: any) => {
    logger.storeAction(action, slice, data);
};

export const logStoreError = (slice: string, action: string, error: Error) => {
    logger.storeError(action, slice, error);
};

export const logTimerEvent = (event: string, sessionId?: string) => {
    logger.timerEvent(event, sessionId);
};

export const logPersistenceEvent = (event: string, data?: any) => {
    logger.persistenceEvent(event, data);
};