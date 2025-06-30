/**
 * Centralized Configuration Management Module
 * 
 * This module provides enterprise-grade configuration management through dotenv integration,
 * environment variable validation, secure defaults, and a consistent configuration API.
 * Supports environment-specific behavior for development, staging, and production deployments
 * while maintaining backward compatibility with localhost:3000 binding requirements.
 * 
 * @fileoverview Configuration Manager Component implementing Section 5.2.4 specifications
 * @version 1.0.0
 * @requires dotenv ^17.0.0
 */

const path = require('path');

// Load environment variables from .env file
// This must be executed before any environment variable access
require('dotenv').config({
  // Look for .env file in the project root directory
  path: path.resolve(process.cwd(), '.env'),
  // Don't override existing environment variables (system env takes precedence)
  override: false
});

/**
 * Configuration validation and type conversion utilities
 */
const configUtils = {
  /**
   * Parse string to integer with validation and default fallback
   * @param {string|undefined} value - Environment variable value
   * @param {number} defaultValue - Default value if parsing fails
   * @param {number} min - Minimum allowed value
   * @param {number} max - Maximum allowed value
   * @returns {number} Validated integer value
   */
  parseInt(value, defaultValue, min = 0, max = 65535) {
    if (!value) return defaultValue;
    
    const parsed = parseInt(value, 10);
    if (isNaN(parsed)) {
      console.warn(`Configuration warning: Invalid integer value "${value}", using default ${defaultValue}`);
      return defaultValue;
    }
    
    if (parsed < min || parsed > max) {
      console.warn(`Configuration warning: Value ${parsed} out of range [${min}, ${max}], using default ${defaultValue}`);
      return defaultValue;
    }
    
    return parsed;
  },

  /**
   * Validate and normalize string values with fallback
   * @param {string|undefined} value - Environment variable value
   * @param {string} defaultValue - Default value if validation fails
   * @param {string[]} allowedValues - Optional array of allowed values
   * @returns {string} Validated string value
   */
  parseString(value, defaultValue, allowedValues = null) {
    if (!value) return defaultValue;
    
    const trimmed = value.trim();
    if (!trimmed) return defaultValue;
    
    if (allowedValues && !allowedValues.includes(trimmed)) {
      console.warn(`Configuration warning: Invalid value "${trimmed}", allowed values: ${allowedValues.join(', ')}, using default ${defaultValue}`);
      return defaultValue;
    }
    
    return trimmed;
  },

  /**
   * Parse boolean values with proper string-to-boolean conversion
   * @param {string|undefined} value - Environment variable value
   * @param {boolean} defaultValue - Default value if parsing fails
   * @returns {boolean} Validated boolean value
   */
  parseBoolean(value, defaultValue) {
    if (!value) return defaultValue;
    
    const normalized = value.toLowerCase().trim();
    if (['true', '1', 'yes', 'on', 'enabled'].includes(normalized)) {
      return true;
    }
    if (['false', '0', 'no', 'off', 'disabled'].includes(normalized)) {
      return false;
    }
    
    console.warn(`Configuration warning: Invalid boolean value "${value}", using default ${defaultValue}`);
    return defaultValue;
  },

  /**
   * Validate host/hostname format
   * @param {string} host - Host value to validate
   * @returns {boolean} True if host format is valid
   */
  isValidHost(host) {
    if (!host) return false;
    
    // Allow localhost, 127.0.0.1, 0.0.0.0, or valid domain/IP patterns
    const localhostPattern = /^(localhost|127\.0\.0\.1|0\.0\.0\.0)$/;
    const ipPattern = /^(\d{1,3}\.){3}\d{1,3}$/;
    const domainPattern = /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
    
    return localhostPattern.test(host) || ipPattern.test(host) || domainPattern.test(host);
  }
};

/**
 * Server configuration settings
 * Maintains backward compatibility with localhost:3000 binding while enabling environment overrides
 */
const server = {
  // Host binding configuration with localhost compatibility enforcement
  host: (() => {
    const envHost = configUtils.parseString(process.env.HOST || process.env.HOSTNAME, '127.0.0.1');
    
    if (!configUtils.isValidHost(envHost)) {
      console.warn(`Configuration warning: Invalid host "${envHost}", using default 127.0.0.1`);
      return '127.0.0.1';
    }
    
    return envHost;
  })(),

  // Port configuration with validation and backward compatibility
  port: configUtils.parseInt(
    process.env.PORT,
    3000, // Default port for backward compatibility
    1024, // Minimum port (above reserved range)
    65535 // Maximum port
  ),

  // Request timeout in milliseconds
  timeout: configUtils.parseInt(
    process.env.SERVER_TIMEOUT,
    30000, // 30 seconds default
    1000,  // Minimum 1 second
    300000 // Maximum 5 minutes
  ),

  // Keep-alive timeout for persistent connections
  keepAliveTimeout: configUtils.parseInt(
    process.env.KEEP_ALIVE_TIMEOUT,
    5000, // 5 seconds default
    1000, // Minimum 1 second
    60000 // Maximum 1 minute
  ),

  // Maximum number of headers allowed
  maxHeadersCount: configUtils.parseInt(
    process.env.MAX_HEADERS_COUNT,
    2000, // Express.js default
    100,  // Minimum headers
    10000 // Maximum headers
  )
};

/**
 * Application-wide environment configuration
 * Controls application behavior based on deployment environment
 */
const app = {
  // Node.js environment mode
  env: configUtils.parseString(
    process.env.NODE_ENV,
    'development',
    ['development', 'staging', 'production', 'test']
  ),

  // Application name
  name: configUtils.parseString(
    process.env.APP_NAME,
    'hello_world'
  ),

  // Application version
  version: configUtils.parseString(
    process.env.APP_VERSION,
    '1.0.0'
  ),

  // Debug mode configuration
  debug: configUtils.parseBoolean(
    process.env.DEBUG,
    process.env.NODE_ENV !== 'production'
  ),

  // Trust proxy settings for production deployments
  trustProxy: configUtils.parseBoolean(
    process.env.TRUST_PROXY,
    false
  )
};

/**
 * Logging configuration settings
 * Controls Winston logger behavior and output destinations
 */
const logging = {
  // Log level configuration
  level: configUtils.parseString(
    process.env.LOG_LEVEL,
    app.env === 'production' ? 'info' : 'debug',
    ['error', 'warn', 'info', 'verbose', 'debug', 'silly']
  ),

  // Log format preference
  format: configUtils.parseString(
    process.env.LOG_FORMAT,
    'json',
    ['json', 'simple', 'combined']
  ),

  // Console logging enabled
  console: configUtils.parseBoolean(
    process.env.LOG_CONSOLE,
    true
  ),

  // File logging enabled
  file: configUtils.parseBoolean(
    process.env.LOG_FILE,
    app.env === 'production'
  ),

  // Log file directory
  directory: configUtils.parseString(
    process.env.LOG_DIRECTORY,
    './logs'
  ),

  // Maximum log file size before rotation
  maxSize: configUtils.parseString(
    process.env.LOG_MAX_SIZE,
    '20m'
  ),

  // Maximum number of log files to retain
  maxFiles: configUtils.parseInt(
    process.env.LOG_MAX_FILES,
    14, // 14 days retention
    1,
    365
  )
};

/**
 * Middleware configuration settings
 * Controls Express.js middleware behavior and security policies
 */
const middleware = {
  // Body parser settings
  bodyParser: {
    json: {
      limit: configUtils.parseString(process.env.JSON_LIMIT, '10mb'),
      strict: configUtils.parseBoolean(process.env.JSON_STRICT, true)
    },
    urlencoded: {
      limit: configUtils.parseString(process.env.URLENCODED_LIMIT, '10mb'),
      extended: configUtils.parseBoolean(process.env.URLENCODED_EXTENDED, true)
    }
  },

  // CORS configuration
  cors: {
    enabled: configUtils.parseBoolean(process.env.CORS_ENABLED, true),
    origin: configUtils.parseString(
      process.env.CORS_ORIGIN,
      app.env === 'development' ? '*' : 'http://127.0.0.1:3000'
    ),
    credentials: configUtils.parseBoolean(process.env.CORS_CREDENTIALS, false)
  },

  // Helmet security configuration
  helmet: {
    enabled: configUtils.parseBoolean(process.env.HELMET_ENABLED, true),
    contentSecurityPolicy: configUtils.parseBoolean(
      process.env.CSP_ENABLED,
      app.env === 'production'
    )
  },

  // Morgan HTTP request logging
  morgan: {
    enabled: configUtils.parseBoolean(process.env.MORGAN_ENABLED, true),
    format: configUtils.parseString(
      process.env.MORGAN_FORMAT,
      app.env === 'production' ? 'combined' : 'dev',
      ['dev', 'combined', 'common', 'short', 'tiny']
    )
  }
};

/**
 * Performance and monitoring configuration
 * Controls application performance characteristics and monitoring behavior
 */
const monitoring = {
  // Health check endpoint configuration
  healthCheck: {
    enabled: configUtils.parseBoolean(process.env.HEALTH_CHECK_ENABLED, true),
    path: configUtils.parseString(process.env.HEALTH_CHECK_PATH, '/health'),
    timeout: configUtils.parseInt(process.env.HEALTH_CHECK_TIMEOUT, 5000, 1000, 30000)
  },

  // Metrics collection
  metrics: {
    enabled: configUtils.parseBoolean(process.env.METRICS_ENABLED, app.env === 'production'),
    interval: configUtils.parseInt(process.env.METRICS_INTERVAL, 60000, 10000, 300000)
  },

  // Request tracking
  requestTracking: {
    enabled: configUtils.parseBoolean(process.env.REQUEST_TRACKING_ENABLED, true),
    includeBody: configUtils.parseBoolean(
      process.env.REQUEST_TRACKING_BODY,
      app.env === 'development'
    )
  }
};

/**
 * PM2 and clustering configuration
 * Controls production deployment and process management settings
 */
const cluster = {
  // PM2 cluster mode detection
  isPM2: Boolean(process.env.PM2_HOME || process.env.PM_ID),

  // Worker process configuration
  workers: configUtils.parseInt(
    process.env.WEB_CONCURRENCY || process.env.CLUSTER_WORKERS,
    require('os').cpus().length,
    1,
    require('os').cpus().length * 2
  ),

  // Graceful shutdown timeout
  shutdownTimeout: configUtils.parseInt(
    process.env.SHUTDOWN_TIMEOUT,
    10000, // 10 seconds
    5000,  // Minimum 5 seconds
    30000  // Maximum 30 seconds
  )
};

/**
 * Configuration validation and startup checks
 * Ensures all critical configuration values are valid and accessible
 */
function validateConfiguration() {
  const validationErrors = [];

  // Validate critical server settings
  if (!server.host || !configUtils.isValidHost(server.host)) {
    validationErrors.push(`Invalid server host: ${server.host}`);
  }

  if (server.port < 1024 || server.port > 65535) {
    validationErrors.push(`Invalid server port: ${server.port} (must be between 1024-65535)`);
  }

  // Validate environment settings
  if (!['development', 'staging', 'production', 'test'].includes(app.env)) {
    validationErrors.push(`Invalid NODE_ENV: ${app.env}`);
  }

  // Validate logging configuration
  if (logging.file && !logging.directory) {
    validationErrors.push('Log directory must be specified when file logging is enabled');
  }

  // Report validation results
  if (validationErrors.length > 0) {
    console.error('Configuration validation failed:');
    validationErrors.forEach(error => console.error(`  - ${error}`));
    throw new Error('Invalid configuration detected. Please check your environment variables.');
  }

  return true;
}

/**
 * Configuration summary for startup logging
 * Provides a secure summary of configuration state for debugging
 */
function getConfigurationSummary() {
  return {
    server: {
      host: server.host,
      port: server.port,
      timeout: server.timeout
    },
    app: {
      env: app.env,
      name: app.name,
      version: app.version,
      debug: app.debug
    },
    logging: {
      level: logging.level,
      format: logging.format,
      console: logging.console,
      file: logging.file
    },
    cluster: {
      isPM2: cluster.isPM2,
      workers: cluster.workers
    }
  };
}

// Perform configuration validation on module load
validateConfiguration();

/**
 * Centralized configuration object export
 * Provides immutable access to all configuration settings
 * 
 * @type {Object} Configuration object with all application settings
 */
module.exports = Object.freeze({
  // Core server configuration
  server: Object.freeze(server),
  
  // Application environment configuration
  app: Object.freeze(app),
  
  // Logging subsystem configuration
  logging: Object.freeze(logging),
  
  // Middleware configuration
  middleware: Object.freeze(middleware),
  
  // Monitoring and health check configuration
  monitoring: Object.freeze(monitoring),
  
  // Clustering and PM2 configuration
  cluster: Object.freeze(cluster),
  
  // Utility functions for configuration management
  utils: Object.freeze({
    validate: validateConfiguration,
    summary: getConfigurationSummary,
    
    // Environment helpers
    isDevelopment: () => app.env === 'development',
    isProduction: () => app.env === 'production',
    isTest: () => app.env === 'test',
    
    // Server URL helpers
    getServerUrl: () => `http://${server.host}:${server.port}`,
    getHealthCheckUrl: () => `http://${server.host}:${server.port}${monitoring.healthCheck.path}`
  })
});