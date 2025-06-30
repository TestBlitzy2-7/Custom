/**
 * Winston Logger Factory Configuration Module
 * 
 * Provides enterprise-grade structured logging through Winston framework with
 * JSON formatting, multiple transports, environment-based configuration,
 * log rotation capabilities, and correlation ID support for comprehensive
 * application observability and debugging.
 * 
 * Features:
 * - Winston 3.17.0 framework with structured JSON formatting
 * - Multiple transport configurations (console, file) 
 * - Environment-specific log level management
 * - Log rotation and retention policies for production
 * - Correlation ID integration for request tracking
 * - Performance-optimized async logging
 */

const winston = require('winston');
const DailyRotateFile = require('winston-daily-rotate-file');
const path = require('path');
const config = require('./index');

/**
 * Custom log format for development environment
 * Provides human-readable, colorized console output with enhanced readability
 */
const developmentFormat = winston.format.combine(
  winston.format.timestamp({
    format: 'YYYY-MM-DD HH:mm:ss.SSS'
  }),
  winston.format.errors({ stack: true }),
  winston.format.colorize({
    all: true,
    colors: {
      error: 'red',
      warn: 'yellow',
      info: 'green',
      http: 'magenta',
      debug: 'cyan'
    }
  }),
  winston.format.printf(({ timestamp, level, message, correlationId, ...meta }) => {
    const correlation = correlationId ? `[${correlationId}] ` : '';
    const metaStr = Object.keys(meta).length > 0 ? ` ${JSON.stringify(meta)}` : '';
    return `${timestamp} ${level}: ${correlation}${message}${metaStr}`;
  })
);

/**
 * Structured JSON format for production environment
 * Enables automated log processing and analysis with consistent schema
 */
const productionFormat = winston.format.combine(
  winston.format.timestamp({
    format: 'YYYY-MM-DDTHH:mm:ss.SSSZ'
  }),
  winston.format.errors({ stack: true }),
  winston.format.json(),
  winston.format.printf((info) => {
    // Ensure consistent JSON structure with correlation ID support
    const logEntry = {
      timestamp: info.timestamp,
      level: info.level,
      message: info.message,
      service: 'hao-backprop-test',
      version: process.env.npm_package_version || '1.0.0',
      nodeEnv: config.nodeEnv,
      pid: process.pid
    };

    // Add correlation ID if present
    if (info.correlationId) {
      logEntry.correlationId = info.correlationId;
    }

    // Include stack trace for errors
    if (info.stack) {
      logEntry.stack = info.stack;
    }

    // Add any additional metadata
    Object.keys(info).forEach(key => {
      if (!['timestamp', 'level', 'message', 'stack', 'correlationId'].includes(key)) {
        logEntry[key] = info[key];
      }
    });

    return JSON.stringify(logEntry);
  })
);

/**
 * Create console transport for development environment
 * Provides pretty-printed, colorized output for enhanced development experience
 */
const createConsoleTransport = () => {
  return new winston.transports.Console({
    level: config.nodeEnv === 'production' ? 'info' : 'debug',
    format: config.nodeEnv === 'production' ? productionFormat : developmentFormat,
    handleExceptions: true,
    handleRejections: true
  });
};

/**
 * Create daily rotating file transport for production environment
 * Implements log rotation, compression, and retention policies
 */
const createFileTransport = () => {
  // Ensure logs directory exists
  const logsDir = path.join(process.cwd(), 'logs');
  
  return new DailyRotateFile({
    filename: path.join(logsDir, 'application-%DATE%.log'),
    datePattern: 'YYYY-MM-DD',
    format: productionFormat,
    level: config.nodeEnv === 'development' ? 'debug' : 'info',
    handleExceptions: true,
    handleRejections: true,
    maxSize: '20m',           // Maximum file size before rotation
    maxFiles: '14d',          // Retain logs for 14 days
    compress: true,           // Compress rotated logs with gzip
    createSymlink: true,      // Create symlink to current log file
    symlinkName: 'current.log'
  });
};

/**
 * Create error-specific file transport for production error tracking
 * Dedicated error log file for critical error analysis
 */
const createErrorFileTransport = () => {
  const logsDir = path.join(process.cwd(), 'logs');
  
  return new DailyRotateFile({
    filename: path.join(logsDir, 'error-%DATE%.log'),
    datePattern: 'YYYY-MM-DD',
    format: productionFormat,
    level: 'error',
    handleExceptions: true,
    handleRejections: true,
    maxSize: '10m',
    maxFiles: '30d',          // Retain error logs longer for analysis
    compress: true,
    createSymlink: true,
    symlinkName: 'current-error.log'
  });
};

/**
 * Configure transports based on environment
 * Development: Console output with debug logging
 * Production: File output with rotation and console for immediate visibility
 */
const createTransports = () => {
  const transports = [];

  // Always include console transport
  transports.push(createConsoleTransport());

  // Add file transports for production and staging environments
  if (config.nodeEnv === 'production' || config.nodeEnv === 'staging') {
    transports.push(createFileTransport());
    transports.push(createErrorFileTransport());
  }

  // Add file transport for development if explicitly enabled
  if (config.logger && config.logger.enableFileLogging) {
    transports.push(createFileTransport());
  }

  return transports;
};

/**
 * Winston logger factory function
 * Creates and configures Winston logger instance with environment-specific settings
 */
const createLogger = () => {
  const logger = winston.createLogger({
    level: config.nodeEnv === 'production' ? 'info' : 'debug',
    format: winston.format.errors({ stack: true }),
    defaultMeta: {
      service: 'hao-backprop-test',
      version: process.env.npm_package_version || '1.0.0'
    },
    transports: createTransports(),
    exitOnError: false,
    silent: config.nodeEnv === 'test',
    
    // Performance optimizations
    handleExceptions: true,
    handleRejections: true,
    rejectionHandlers: [
      new winston.transports.Console({
        format: winston.format.simple()
      })
    ],
    exceptionHandlers: [
      new winston.transports.Console({
        format: winston.format.simple()
      })
    ]
  });

  // Add request correlation middleware support
  logger.addCorrelationId = (correlationId) => {
    return logger.child({ correlationId });
  };

  // Add HTTP-specific logging methods for Morgan integration
  logger.http = (message, meta = {}) => {
    logger.log('http', message, meta);
  };

  // Add performance timing support
  logger.startTimer = (label) => {
    const start = Date.now();
    return {
      done: (meta = {}) => {
        const duration = Date.now() - start;
        logger.info(`${label} completed`, { 
          duration: `${duration}ms`,
          ...meta 
        });
      }
    };
  };

  // Development helper for request lifecycle tracking
  if (config.nodeEnv !== 'production') {
    logger.debugRequest = (req, message) => {
      logger.debug(message, {
        method: req.method,
        url: req.url,
        userAgent: req.get('User-Agent'),
        correlationId: req.correlationId,
        ip: req.ip || req.connection.remoteAddress
      });
    };
  }

  return logger;
};

/**
 * Stream interface for Morgan HTTP request logging integration
 * Provides Winston-compatible write method for Morgan middleware
 */
const createMorganStream = (logger) => {
  return {
    write: (message) => {
      // Remove trailing newline from Morgan and log at HTTP level
      logger.http(message.trim());
    }
  };
};

/**
 * Configure log level at runtime based on environment variables
 * Allows dynamic log level adjustment without restart
 */
const configureLogLevel = (logger) => {
  const logLevel = process.env.LOG_LEVEL || (config.nodeEnv === 'production' ? 'info' : 'debug');
  
  if (winston.config.npm.levels[logLevel] !== undefined) {
    logger.level = logLevel;
    logger.info(`Log level set to: ${logLevel}`);
  } else {
    logger.warn(`Invalid log level "${logLevel}", using default`);
  }
};

/**
 * Create and export the configured logger instance
 */
const logger = createLogger();
configureLogLevel(logger);

/**
 * Export logger instance and utilities
 */
module.exports = {
  logger,
  createMorganStream: () => createMorganStream(logger),
  createChildLogger: (meta) => logger.child(meta),
  addCorrelationId: (correlationId) => logger.addCorrelationId(correlationId),
  
  // Log level management
  setLogLevel: (level) => {
    if (winston.config.npm.levels[level] !== undefined) {
      logger.level = level;
      logger.info(`Log level changed to: ${level}`);
      return true;
    }
    logger.warn(`Invalid log level: ${level}`);
    return false;
  },
  
  // Transport management for testing
  addFileLogging: () => {
    if (config.nodeEnv === 'development') {
      logger.add(createFileTransport());
      logger.info('File logging enabled for development');
    }
  },
  
  // Graceful shutdown support
  close: () => {
    return new Promise((resolve) => {
      logger.on('finish', resolve);
      logger.end();
    });
  },
  
  // Export log levels for reference
  levels: winston.config.npm.levels
};

// Log successful logger initialization
logger.info('Winston logger initialized', {
  environment: config.nodeEnv,
  logLevel: logger.level,
  transports: logger.transports.length,
  version: winston.version
});