/**
 * Simple error handling utilities
 * Requirements: 5.1, 5.2, 5.3, 5.4
 */

import { logger } from './logger';

export type ErrorSeverity = 'low' | 'medium' | 'high' | 'critical';

export interface AppError {
    message: string;
    code?: string;
    severity: ErrorSeverity;
    context?: string;
    originalError?: Error;
}

/**
 * Creates a standardized app error
 */
export const createAppError = (
    message: string,
    severity: ErrorSeverity = 'medium',
    context?: string,
    originalError?: Error
): AppError => ({
    message,
    severity,
    context,
    originalError,
    code: generateErrorCode(context, severity),
});

/**
 * Generates a simple error code for tracking
 */
const generateErrorCode = (context?: string, severity?: ErrorSeverity): string => {
    const timestamp = Date.now().toString(36);
    const contextCode = context ? context.substring(0, 3).toUpperCase() : 'GEN';
    const severityCode = severity ? severity.charAt(0).toUpperCase() : 'M';

    return `${contextCode}-${severityCode}-${timestamp}`;
};

/**
 * Handles store action errors with consistent logging and recovery
 */
export const handleStoreError = (
    slice: string,
    action: string,
    error: Error,
    fallbackValue?: any
): any => {
    const appError = createAppError(
        `Store action failed: ${action}`,
        'medium',
        slice,
        error
    );

    logger.storeError(slice, action, error);

    // For development, throw the error to help with debugging
    if (__DEV__) {
        throw error;
    }

    // In production, return fallback value or undefined
    return fallbackValue;
};

/**
 * Handles persistence errors with graceful fallback
 */
export const handlePersistenceError = (
    operation: string,
    error: Error,
    fallbackValue?: any
): any => {
    const appError = createAppError(
        `Persistence operation failed: ${operation}`,
        'high',
        'persistence',
        error
    );

    logger.error(`Persistence Error: ${operation}`, error);

    // Always continue with fallback in persistence errors
    return fallbackValue;
};

/**
 * Handles timer errors with session recovery
 */
export const handleTimerError = (
    operation: string,
    sessionId: string,
    error: Error
): void => {
    const appError = createAppError(
        `Timer operation failed: ${operation}`,
        'high',
        'timer',
        error
    );

    logger.error(`Timer Error: ${operation} for session ${sessionId}`, error);

    // Timer errors are logged but don't stop the app
    // The timer will be restarted on next user interaction
};

/**
 * Handles validation errors with user-friendly messages
 */
export const handleValidationError = (
    field: string,
    value: any,
    rule: string
): AppError => {
    const message = getUserFriendlyValidationMessage(field, rule);

    return createAppError(
        message,
        'low',
        'validation',
        new Error(`Validation failed: ${field} ${rule}`)
    );
};

/**
 * Converts technical validation errors to user-friendly messages
 */
const getUserFriendlyValidationMessage = (field: string, rule: string): string => {
    const fieldName = field.replace(/([A-Z])/g, ' $1').toLowerCase();

    switch (rule) {
        case 'required':
            return `${fieldName} is required`;
        case 'min':
            return `${fieldName} is too short`;
        case 'max':
            return `${fieldName} is too long`;
        case 'email':
            return `Please enter a valid email address`;
        case 'positive':
            return `${fieldName} must be greater than 0`;
        case 'maxDuration':
            return `${fieldName} cannot exceed 180 minutes`;
        default:
            return `${fieldName} is invalid`;
    }
};

/**
 * Safe async operation wrapper with error handling
 */
export const safeAsync = async <T>(
    operation: () => Promise<T>,
    context: string,
    fallbackValue?: T
): Promise<T | undefined> => {
    try {
        return await operation();
    } catch (error) {
        const appError = createAppError(
            `Async operation failed`,
            'medium',
            context,
            error as Error
        );

        logger.error(`Async Error in ${context}`, error);

        return fallbackValue;
    }
};

/**
 * Safe sync operation wrapper with error handling
 */
export const safeSync = <T>(
    operation: () => T,
    context: string,
    fallbackValue?: T
): T | undefined => {
    try {
        return operation();
    } catch (error) {
        const appError = createAppError(
            `Sync operation failed`,
            'medium',
            context,
            error as Error
        );

        logger.error(`Sync Error in ${context}`, error);

        return fallbackValue;
    }
};

/**
 * Checks if an error is recoverable
 */
export const isRecoverableError = (error: Error): boolean => {
    // Network errors are usually recoverable
    if (error.message.includes('network') || error.message.includes('fetch')) {
        return true;
    }

    // Storage errors might be recoverable
    if (error.message.includes('storage') || error.message.includes('AsyncStorage')) {
        return true;
    }

    // Validation errors are recoverable
    if (error.message.includes('validation') || error.message.includes('invalid')) {
        return true;
    }

    // Most other errors are not recoverable
    return false;
};