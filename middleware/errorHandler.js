/**
 * Centralized Express.js Error Handling Middleware
 * 
 * This middleware captures all application errors through Express.js error propagation mechanisms,
 * classifies errors by type and severity, logs comprehensive error details through Winston 
 * structured logging, and generates standardized JSON error responses while maintaining 
 * security by excluding sensitive information from client-facing messages.
 * 
 * Position: Must be placed at the end of the Express middleware stack to capture all 
 * unhandled errors and route resolution failures.
 * 
 * Features:
 * - Automatic error classification (client vs server errors)
 * - Structured Winston logging with correlation ID tracking
 * - Standardized JSON error response format
 * - Security-focused error message sanitization
 * - Complete stack trace capture for debugging
 * - Request context preservation for comprehensive error analysis
 * 
 * @module middleware/errorHandler
 */

const logger = require('../config/logger');

/**
 * Error classification mapping for different error types
 * Maps error conditions to appropriate HTTP status codes and categories
 */
const ERROR_CLASSIFICATIONS = {
  // Client errors (4xx)
  'ValidationError': { status: 400, category: 'client' },
  'CastError': { status: 400, category: 'client' },
  'SyntaxError': { status: 400, category: 'client' },
  'URIError': { status: 400, category: 'client' },
  'MulterError': { status: 400, category: 'client' },
  
  // Authentication and authorization errors
  'UnauthorizedError': { status: 401, category: 'client' },
  'JsonWebTokenError': { status: 401, category: 'client' },
  'TokenExpiredError': { status: 401, category: 'client' },
  'ForbiddenError': { status: 403, category: 'client' },
  
  // Not found errors
  'NotFoundError': { status: 404, category: 'client' },
  'CastError': { status: 404, category: 'client' },
  
  // Method and content errors
  'MethodNotAllowedError': { status: 405, category: 'client' },
  'NotAcceptableError': { status: 406, category: 'client' },
  'UnsupportedMediaTypeError': { status: 415, category: 'client' },
  'PayloadTooLargeError': { status: 413, category: 'client' },
  
  // Rate limiting and conflict errors
  'TooManyRequestsError': { status: 429, category: 'client' },
  'ConflictError': { status: 409, category: 'client' },
  
  // Server errors (5xx) - default to 500 for unknown types
  'InternalServerError': { status: 500, category: 'server' },
  'NotImplementedError': { status: 501, category: 'server' },
  'BadGatewayError': { status: 502, category: 'server' },
  'ServiceUnavailableError': { status: 503, category: 'server' },
  'GatewayTimeoutError': { status: 504, category: 'server' }
};

/**
 * Standard client-safe error messages to prevent information disclosure
 * These messages provide meaningful feedback without exposing internal details
 */
const SAFE_ERROR_MESSAGES = {
  400: 'Bad Request - Invalid request format or parameters',
  401: 'Unauthorized - Authentication required',
  403: 'Forbidden - Access denied',
  404: 'Not Found - The requested resource was not found',
  405: 'Method Not Allowed - HTTP method not supported for this endpoint',
  406: 'Not Acceptable - Requested format not available',
  409: 'Conflict - Resource conflict detected',
  413: 'Payload Too Large - Request payload exceeds size limit',
  415: 'Unsupported Media Type - Content type not supported',
  429: 'Too Many Requests - Rate limit exceeded',
  500: 'Internal Server Error - An unexpected error occurred',
  501: 'Not Implemented - Feature not implemented',
  502: 'Bad Gateway - External service error',
  503: 'Service Unavailable - Service temporarily unavailable',
  504: 'Gateway Timeout - External service timeout'
};

/**
 * Classifies error by type and determines appropriate HTTP status code
 * 
 * @param {Error} error - The error object to classify
 * @returns {Object} Classification object with status code and category
 */
function classifyError(error) {
  // Check for explicit status code on error object (common in Express middleware)
  if (error.status || error.statusCode) {
    const status = error.status || error.statusCode;
    return {
      status: status,
      category: status >= 400 && status < 500 ? 'client' : 'server'
    };
  }

  // Check error name against classification mapping
  if (error.name && ERROR_CLASSIFICATIONS[error.name]) {
    return ERROR_CLASSIFICATIONS[error.name];
  }

  // Check error constructor name
  if (error.constructor && error.constructor.name && ERROR_CLASSIFICATIONS[error.constructor.name]) {
    return ERROR_CLASSIFICATIONS[error.constructor.name];
  }

  // Check for specific error patterns
  if (error.code) {
    switch (error.code) {
      case 'EADDRINUSE':
      case 'ECONNREFUSED':
      case 'ENOTFOUND':
      case 'ETIMEDOUT':
        return { status: 503, category: 'server' };
      case 'EACCES':
        return { status: 403, category: 'client' };
      default:
        return { status: 500, category: 'server' };
    }
  }

  // Check for specific error message patterns
  if (error.message) {
    const message = error.message.toLowerCase();
    
    if (message.includes('validation') || message.includes('invalid')) {
      return { status: 400, category: 'client' };
    }
    
    if (message.includes('unauthorized') || message.includes('authentication')) {
      return { status: 401, category: 'client' };
    }
    
    if (message.includes('forbidden') || message.includes('permission')) {
      return { status: 403, category: 'client' };
    }
    
    if (message.includes('not found')) {
      return { status: 404, category: 'client' };
    }
  }

  // Default to server error for unknown error types
  return { status: 500, category: 'server' };
}

/**
 * Generates a safe, client-facing error message that excludes sensitive details
 * 
 * @param {number} statusCode - HTTP status code
 * @param {Error} error - Original error object
 * @returns {string} Safe error message for client response
 */
function generateSafeErrorMessage(statusCode, error) {
  // Use predefined safe messages for known status codes
  if (SAFE_ERROR_MESSAGES[statusCode]) {
    return SAFE_ERROR_MESSAGES[statusCode];
  }

  // For client errors (4xx), provide some context if the error message is safe
  if (statusCode >= 400 && statusCode < 500 && error.message) {
    const message = error.message;
    
    // Only include error message if it doesn't contain sensitive information
    const sensitivePatterns = [
      /password/i,
      /token/i,
      /secret/i,
      /key/i,
      /database/i,
      /connection/i,
      /internal/i,
      /stack/i,
      /file.*path/i,
      /directory/i,
      /config/i,
      /env/i
    ];
    
    const containsSensitiveInfo = sensitivePatterns.some(pattern => pattern.test(message));
    
    if (!containsSensitiveInfo && message.length < 200) {
      return `Bad Request - ${message}`;
    }
  }

  // Default safe messages by category
  if (statusCode >= 400 && statusCode < 500) {
    return 'Bad Request - Invalid request format or parameters';
  } else {
    return 'Internal Server Error - An unexpected error occurred';
  }
}

/**
 * Extracts request context for error logging
 * 
 * @param {Object} req - Express request object
 * @returns {Object} Request context for logging
 */
function extractRequestContext(req) {
  return {
    method: req.method,
    url: req.originalUrl || req.url,
    userAgent: req.get('User-Agent'),
    ip: req.ip || req.connection.remoteAddress,
    correlationId: req.correlationId || req.headers['x-correlation-id'] || 'unknown',
    requestId: req.id || req.headers['x-request-id'],
    timestamp: new Date().toISOString(),
    headers: {
      'content-type': req.get('Content-Type'),
      'accept': req.get('Accept'),
      'origin': req.get('Origin'),
      'referer': req.get('Referer')
    },
    query: req.query,
    params: req.params,
    // Only include body for non-sensitive requests and if it's small
    body: req.method !== 'GET' && req.body && JSON.stringify(req.body).length < 1000 ? req.body : undefined
  };
}

/**
 * Creates structured error log entry with comprehensive context
 * 
 * @param {Error} error - The error object
 * @param {Object} req - Express request object
 * @param {Object} classification - Error classification result
 * @returns {Object} Structured log entry
 */
function createErrorLogEntry(error, req, classification) {
  const requestContext = extractRequestContext(req);
  
  return {
    level: 'error',
    message: `${classification.category.toUpperCase()} ERROR: ${error.message}`,
    error: {
      name: error.name,
      message: error.message,
      stack: error.stack,
      code: error.code,
      status: classification.status,
      category: classification.category
    },
    request: requestContext,
    timestamp: new Date().toISOString(),
    correlationId: requestContext.correlationId,
    errorId: `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  };
}

/**
 * Creates standardized JSON error response
 * 
 * @param {number} statusCode - HTTP status code
 * @param {string} message - Client-safe error message
 * @param {string} correlationId - Request correlation ID
 * @param {string} errorId - Unique error identifier
 * @returns {Object} Standardized error response object
 */
function createErrorResponse(statusCode, message, correlationId, errorId) {
  const response = {
    error: true,
    status: statusCode,
    message: message,
    timestamp: new Date().toISOString(),
    correlationId: correlationId || 'unknown'
  };

  // Include error ID for server errors to help with debugging
  if (statusCode >= 500) {
    response.errorId = errorId;
  }

  // Add additional context for specific error types
  if (statusCode === 429) {
    response.retryAfter = '60s';
  }

  if (statusCode === 413) {
    response.maxSize = '10MB';
  }

  return response;
}

/**
 * Centralized Express.js Error Handling Middleware
 * 
 * This middleware function implements comprehensive error handling for all Express.js
 * application errors. It must be positioned at the end of the middleware stack to
 * capture all unhandled errors and route resolution failures.
 * 
 * Error Processing Flow:
 * 1. Error classification by type and severity
 * 2. Request context extraction and preservation
 * 3. Structured logging with Winston at ERROR level
 * 4. Safe error message generation excluding sensitive details
 * 5. Standardized JSON error response delivery
 * 
 * @param {Error} err - Error object propagated through Express middleware chain
 * @param {Object} req - Express request object with context and metadata
 * @param {Object} res - Express response object for client communication
 * @param {Function} next - Express next function (not used in error handlers)
 */
function centralizedErrorHandler(err, req, res, next) {
  // Prevent further error propagation by not calling next()
  // Error handlers are terminal middleware in Express.js
  
  try {
    // Step 1: Classify error by type and determine appropriate response
    const classification = classifyError(err);
    
    // Step 2: Extract comprehensive request context for logging
    const requestContext = extractRequestContext(req);
    
    // Step 3: Create structured error log entry with complete context
    const logEntry = createErrorLogEntry(err, req, classification);
    
    // Step 4: Log error with Winston at ERROR level for comprehensive tracking
    logger.error(logEntry.message, {
      error: logEntry.error,
      request: logEntry.request,
      timestamp: logEntry.timestamp,
      correlationId: logEntry.correlationId,
      errorId: logEntry.errorId,
      // Include full stack trace for server errors
      stackTrace: classification.category === 'server' ? err.stack : undefined
    });
    
    // Step 5: Generate client-safe error message excluding sensitive details
    const safeMessage = generateSafeErrorMessage(classification.status, err);
    
    // Step 6: Create standardized JSON error response
    const errorResponse = createErrorResponse(
      classification.status,
      safeMessage,
      requestContext.correlationId,
      logEntry.errorId
    );
    
    // Step 7: Set appropriate HTTP status code and security headers
    res.status(classification.status);
    
    // Security headers for error responses
    res.set({
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'X-XSS-Protection': '1; mode=block',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    });
    
    // Step 8: Deliver standardized JSON error response to client
    res.json(errorResponse);
    
    // Log successful error handling for monitoring
    logger.info('Error handled successfully', {
      errorId: logEntry.errorId,
      status: classification.status,
      category: classification.category,
      correlationId: requestContext.correlationId,
      responseTime: Date.now() - (req.startTime || Date.now())
    });
    
  } catch (handlerError) {
    // Critical error in error handler itself - fail safely
    logger.error('Critical error in error handler middleware', {
      originalError: {
        name: err.name,
        message: err.message,
        stack: err.stack
      },
      handlerError: {
        name: handlerError.name,
        message: handlerError.message,
        stack: handlerError.stack
      },
      timestamp: new Date().toISOString(),
      criticalFailure: true
    });
    
    // Send minimal safe response if error handler fails
    if (!res.headersSent) {
      res.status(500).json({
        error: true,
        status: 500,
        message: 'Internal Server Error - An unexpected error occurred',
        timestamp: new Date().toISOString()
      });
    }
  }
}

/**
 * 404 Not Found Handler
 * 
 * Handles requests that don't match any defined routes by creating a structured
 * 404 error and passing it to the centralized error handler for consistent processing.
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function for error propagation
 */
function notFoundHandler(req, res, next) {
  const notFoundError = new Error(`Route not found: ${req.method} ${req.originalUrl || req.url}`);
  notFoundError.name = 'NotFoundError';
  notFoundError.status = 404;
  
  // Pass to centralized error handler for consistent processing
  next(notFoundError);
}

/**
 * Async Error Wrapper
 * 
 * Utility function to wrap async route handlers and automatically catch
 * any rejected promises, passing them to the error handling middleware.
 * 
 * @param {Function} asyncFn - Async function to wrap
 * @returns {Function} Wrapped function with error handling
 */
function asyncErrorHandler(asyncFn) {
  return function(req, res, next) {
    Promise.resolve(asyncFn(req, res, next)).catch(next);
  };
}

/**
 * Error Factory Functions
 * 
 * Utility functions to create standardized error objects for common scenarios
 */
const ErrorFactory = {
  /**
   * Creates a validation error
   * @param {string} message - Validation error message
   * @param {Object} details - Additional validation details
   * @returns {Error} Validation error object
   */
  validation: (message, details = {}) => {
    const error = new Error(message);
    error.name = 'ValidationError';
    error.status = 400;
    error.details = details;
    return error;
  },

  /**
   * Creates an unauthorized error
   * @param {string} message - Authorization error message
   * @returns {Error} Unauthorized error object
   */
  unauthorized: (message = 'Authentication required') => {
    const error = new Error(message);
    error.name = 'UnauthorizedError';
    error.status = 401;
    return error;
  },

  /**
   * Creates a forbidden error
   * @param {string} message - Forbidden error message
   * @returns {Error} Forbidden error object
   */
  forbidden: (message = 'Access denied') => {
    const error = new Error(message);
    error.name = 'ForbiddenError';
    error.status = 403;
    return error;
  },

  /**
   * Creates a not found error
   * @param {string} resource - Resource that was not found
   * @returns {Error} Not found error object
   */
  notFound: (resource = 'Resource') => {
    const error = new Error(`${resource} not found`);
    error.name = 'NotFoundError';
    error.status = 404;
    return error;
  },

  /**
   * Creates a conflict error
   * @param {string} message - Conflict error message
   * @returns {Error} Conflict error object
   */
  conflict: (message = 'Resource conflict detected') => {
    const error = new Error(message);
    error.name = 'ConflictError';
    error.status = 409;
    return error;
  },

  /**
   * Creates an internal server error
   * @param {string} message - Internal error message
   * @returns {Error} Internal server error object
   */
  internal: (message = 'An internal error occurred') => {
    const error = new Error(message);
    error.name = 'InternalServerError';
    error.status = 500;
    return error;
  }
};

module.exports = {
  centralizedErrorHandler,
  notFoundHandler,
  asyncErrorHandler,
  ErrorFactory,
  // Export utility functions for testing and advanced usage
  classifyError,
  generateSafeErrorMessage,
  extractRequestContext,
  createErrorLogEntry,
  createErrorResponse
};