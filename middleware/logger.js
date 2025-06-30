/**
 * Express.js Logging Middleware
 * 
 * Custom Express middleware that integrates Winston structured logging with Morgan HTTP request logging
 * to provide comprehensive request/response tracking, correlation ID generation, and JSON-formatted
 * log output positioned strategically in the middleware pipeline for complete HTTP transaction visibility.
 * 
 * Features:
 * - Morgan HTTP request/response logging with correlation ID integration
 * - Winston structured logging for application events and errors
 * - Unique correlation ID generation for end-to-end request tracing
 * - Environment-specific log levels and transport configuration
 * - JSON-formatted structured logs for automated log processing
 * - Minimal performance overhead with asynchronous logging operations
 * 
 * @module middleware/logger
 */

const morgan = require('morgan');
const { v4: uuidv4 } = require('uuid');
const logger = require('../config/logger');

/**
 * Generate unique correlation ID for request tracking
 * Creates a UUID v4 string that serves as a unique identifier for each HTTP request,
 * enabling end-to-end request tracing across all middleware components and system logs.
 * 
 * @returns {string} UUID v4 string for request correlation
 */
function generateCorrelationId() {
    return uuidv4();
}

/**
 * Correlation ID middleware
 * Attaches a unique correlation ID to each incoming request and makes it available
 * throughout the request lifecycle for structured logging and request tracing.
 * 
 * This middleware must be positioned early in the Express middleware pipeline
 * to ensure correlation IDs are available to all subsequent middleware and route handlers.
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object  
 * @param {Function} next - Express next middleware function
 */
function correlationIdMiddleware(req, res, next) {
    try {
        // Generate unique correlation ID for this request
        const correlationId = generateCorrelationId();
        
        // Attach correlation ID to request object for downstream middleware access
        req.correlationId = correlationId;
        
        // Set correlation ID in response headers for client request tracing
        res.setHeader('X-Correlation-ID', correlationId);
        
        // Log request initiation with correlation ID for request lifecycle tracking
        logger.info('Request initiated', {
            correlationId,
            method: req.method,
            url: req.url,
            userAgent: req.get('User-Agent'),
            remoteAddr: req.ip || req.connection.remoteAddress,
            timestamp: new Date().toISOString()
        });
        
        next();
    } catch (error) {
        // Log error in correlation ID generation and continue processing
        logger.error('Correlation ID middleware error', {
            error: error.message,
            stack: error.stack,
            method: req.method,
            url: req.url,
            timestamp: new Date().toISOString()
        });
        
        // Continue processing even if correlation ID generation fails
        next();
    }
}

/**
 * Custom Morgan token for correlation ID
 * Registers a custom Morgan token that extracts the correlation ID from the request object,
 * enabling inclusion of correlation IDs in Morgan HTTP log entries for complete request tracing.
 * 
 * @param {Object} req - Express request object containing correlation ID
 * @returns {string} Correlation ID or 'no-correlation-id' if not available
 */
morgan.token('correlationId', function(req) {
    return req.correlationId || 'no-correlation-id';
});

/**
 * Custom Morgan token for response time in milliseconds
 * Provides precise response time measurement for performance analysis and SLA monitoring.
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {string} Response time in milliseconds with 'ms' suffix
 */
morgan.token('responseTimeMs', function(req, res) {
    const responseTime = morgan['response-time'](req, res);
    return responseTime ? `${responseTime}ms` : '0ms';
});

/**
 * Custom Morgan format for structured JSON logging
 * Defines a comprehensive log format that captures all essential HTTP transaction details
 * in a structured format suitable for automated log processing and analysis.
 * 
 * Includes: timestamp, correlation ID, HTTP method, URL, status code, response time,
 * client IP, user agent, and request/response size information.
 */
const morganFormat = JSON.stringify({
    timestamp: ':date[iso]',
    level: 'http',
    correlationId: ':correlationId',
    method: ':method',
    url: ':url',
    status: ':status',
    responseTime: ':responseTimeMs',
    contentLength: ':res[content-length]',
    remoteAddr: ':remote-addr',
    userAgent: ':user-agent',
    referrer: ':referrer'
});

/**
 * Morgan HTTP logging middleware with Winston integration
 * Configures Morgan to use Winston as the logging stream, ensuring all HTTP logs
 * are processed through the centralized Winston logging system with consistent
 * formatting and transport configuration.
 * 
 * The Morgan middleware captures detailed HTTP request/response information and
 * integrates it with the Winston structured logging framework for unified log management.
 */
const morganMiddleware = morgan(morganFormat, {
    stream: {
        write: function(message) {
            try {
                // Parse Morgan JSON log message for structured Winston logging
                const logData = JSON.parse(message.trim());
                
                // Log HTTP transaction details through Winston with appropriate level
                logger.http('HTTP Request', {
                    timestamp: logData.timestamp,
                    correlationId: logData.correlationId,
                    method: logData.method,
                    url: logData.url,
                    status: parseInt(logData.status),
                    responseTime: logData.responseTime,
                    contentLength: logData.contentLength || '0',
                    remoteAddr: logData.remoteAddr,
                    userAgent: logData.userAgent,
                    referrer: logData.referrer || '-'
                });
            } catch (parseError) {
                // Fallback to raw message logging if JSON parsing fails
                logger.error('Morgan log parsing failed', {
                    error: parseError.message,
                    rawMessage: message.trim(),
                    timestamp: new Date().toISOString()
                });
            }
        }
    },
    // Skip logging for health check endpoints to reduce log noise in production
    skip: function(req, res) {
        // Skip health check endpoints unless in development mode
        if (req.url === '/health' && process.env.NODE_ENV === 'production') {
            return true;
        }
        return false;
    }
});

/**
 * Request completion logging middleware
 * Captures request completion events with final status and performance metrics
 * for comprehensive request lifecycle tracking and performance analysis.
 * 
 * This middleware should be positioned after route handlers but before error handlers
 * to capture successful request completions.
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
function requestCompletionMiddleware(req, res, next) {
    // Store original res.end function to intercept response completion
    const originalEnd = res.end;
    const startTime = Date.now();
    
    // Override res.end to capture response completion
    res.end = function(chunk, encoding) {
        // Calculate total request processing time
        const processingTime = Date.now() - startTime;
        
        try {
            // Log request completion with performance metrics
            logger.info('Request completed', {
                correlationId: req.correlationId || 'no-correlation-id',
                method: req.method,
                url: req.url,
                statusCode: res.statusCode,
                processingTime: `${processingTime}ms`,
                contentLength: res.get('Content-Length') || '0',
                timestamp: new Date().toISOString()
            });
        } catch (error) {
            // Log error in completion logging but don't interrupt response
            logger.error('Request completion logging failed', {
                error: error.message,
                correlationId: req.correlationId || 'no-correlation-id',
                method: req.method,
                url: req.url,
                timestamp: new Date().toISOString()
            });
        }
        
        // Call original res.end function to complete response
        originalEnd.call(this, chunk, encoding);
    };
    
    next();
}

/**
 * Error logging middleware
 * Captures and logs errors that occur during request processing, providing
 * comprehensive error context including correlation IDs, stack traces, and
 * request metadata for effective debugging and monitoring.
 * 
 * This middleware should be positioned in the Express error handling chain
 * to capture all application errors before they reach the centralized error handler.
 * 
 * @param {Error} err - Error object from Express error handling
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
function errorLoggingMiddleware(err, req, res, next) {
    try {
        // Log error with comprehensive context for debugging
        logger.error('Request error occurred', {
            correlationId: req.correlationId || 'no-correlation-id',
            error: {
                message: err.message,
                stack: err.stack,
                name: err.name,
                code: err.code || 'UNKNOWN_ERROR'
            },
            request: {
                method: req.method,
                url: req.url,
                headers: req.headers,
                params: req.params,
                query: req.query,
                body: req.body ? JSON.stringify(req.body).substring(0, 1000) : undefined
            },
            timestamp: new Date().toISOString()
        });
    } catch (loggingError) {
        // Fallback error logging if structured logging fails
        logger.error('Error logging failed', {
            originalError: err.message,
            loggingError: loggingError.message,
            correlationId: req.correlationId || 'no-correlation-id',
            timestamp: new Date().toISOString()
        });
    }
    
    // Continue error handling chain - do not send response here
    next(err);
}

/**
 * Application startup logging
 * Logs application initialization events including middleware configuration,
 * environment settings, and system readiness status for operational monitoring.
 * 
 * @param {Object} config - Application configuration object
 */
function logApplicationStartup(config = {}) {
    try {
        logger.info('Logging middleware initialized', {
            environment: process.env.NODE_ENV || 'development',
            logLevel: process.env.LOG_LEVEL || 'info',
            morganEnabled: true,
            winstonEnabled: true,
            correlationIdEnabled: true,
            features: [
                'correlation-id-generation',
                'morgan-winston-integration', 
                'structured-json-logging',
                'request-completion-tracking',
                'error-context-capture'
            ],
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        // Fallback to console logging if Winston fails during startup
        console.error('Startup logging failed:', error.message);
    }
}

/**
 * Module exports
 * Provides the complete logging middleware stack for Express.js integration
 * positioned strategically in the middleware pipeline for comprehensive HTTP transaction visibility.
 * 
 * Middleware execution order:
 * 1. correlationIdMiddleware - Generates correlation IDs early in request pipeline
 * 2. morganMiddleware - Captures HTTP request/response details with Winston integration
 * 3. requestCompletionMiddleware - Tracks request completion and performance metrics
 * 4. errorLoggingMiddleware - Captures error context for debugging and monitoring
 */
module.exports = {
    // Primary middleware functions for Express.js integration
    correlationIdMiddleware,
    morganMiddleware,
    requestCompletionMiddleware,
    errorLoggingMiddleware,
    
    // Utility functions for application integration
    logApplicationStartup,
    generateCorrelationId,
    
    // Convenience middleware stack for complete logging integration
    all: [
        correlationIdMiddleware,
        morganMiddleware,
        requestCompletionMiddleware
    ],
    
    // Error handling middleware (should be used separately in error handling chain)
    errorHandler: errorLoggingMiddleware
};