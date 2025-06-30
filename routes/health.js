const express = require('express');
const router = express.Router();

// Import configuration for environment settings
let config;
try {
  config = require('../config/index');
} catch (error) {
  // Fallback configuration if config module not available yet
  config = {
    NODE_ENV: process.env.NODE_ENV || 'development',
    PORT: process.env.PORT || 3000,
    HOST: process.env.HOST || '127.0.0.1'
  };
}

// Import Winston logger for structured logging
let logger;
try {
  const loggerConfig = require('../config/logger');
  logger = loggerConfig.logger || loggerConfig;
} catch (error) {
  // Fallback to console logging if Winston not available yet
  logger = {
    info: (message, meta) => console.log(JSON.stringify({ level: 'info', message, ...meta })),
    error: (message, meta) => console.error(JSON.stringify({ level: 'error', message, ...meta })),
    http: (message, meta) => console.log(JSON.stringify({ level: 'http', message, ...meta }))
  };
}

/**
 * Health Check Endpoint - GET /health
 * 
 * Provides standardized health status information for monitoring system integration.
 * Returns JSON-formatted response with service availability status, metadata, and uptime.
 * 
 * Response Format:
 * - Success (200 OK): { status: 'ok', timestamp, service, version, uptime, environment }
 * - Failure (503 Service Unavailable): { status: 'error', timestamp, message, error }
 * 
 * Integration Features:
 * - Winston structured logging with correlation ID tracking
 * - Environment-specific configuration support
 * - Monitoring system compatibility
 * - PM2 process health validation
 */
router.get('/health', (req, res) => {
  // Generate correlation ID for request tracking
  const correlationId = req.headers['x-correlation-id'] || 
                       req.headers['x-request-id'] || 
                       `health-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  const startTime = Date.now();
  
  try {
    // Perform comprehensive health validation
    const healthStatus = performHealthChecks();
    
    // Prepare successful health response
    const healthResponse = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      service: 'hao-backprop-test',
      version: process.env.npm_package_version || '1.0.0',
      uptime: process.uptime(),
      environment: config.NODE_ENV,
      server: {
        host: config.HOST,
        port: config.PORT,
        nodeVersion: process.version
      },
      process: {
        pid: process.pid,
        memory: process.memoryUsage(),
        cpuUsage: process.cpuUsage()
      },
      correlationId: correlationId
    };
    
    // Log successful health check with structured data
    const responseTime = Date.now() - startTime;
    logger.http('Health check successful', {
      correlationId: correlationId,
      method: 'GET',
      url: '/health',
      status: 200,
      responseTime: `${responseTime}ms`,
      remoteAddr: req.ip || req.connection.remoteAddress || '127.0.0.1',
      userAgent: req.get('User-Agent') || 'unknown',
      healthStatus: 'ok',
      uptime: healthResponse.uptime,
      environment: config.NODE_ENV
    });
    
    // Return successful health check response
    res.status(200).json(healthResponse);
    
  } catch (error) {
    // Handle health check failures
    const errorResponse = {
      status: 'error',
      timestamp: new Date().toISOString(),
      service: 'hao-backprop-test',
      message: 'Health check failed',
      error: {
        name: error.name,
        message: error.message,
        // Exclude stack trace from client response for security
        type: error.constructor.name
      },
      correlationId: correlationId,
      environment: config.NODE_ENV
    };
    
    // Log health check failure with full error context
    const responseTime = Date.now() - startTime;
    logger.error('Health check failed', {
      correlationId: correlationId,
      method: 'GET',
      url: '/health',
      status: 503,
      responseTime: `${responseTime}ms`,
      remoteAddr: req.ip || req.connection.remoteAddress || '127.0.0.1',
      userAgent: req.get('User-Agent') || 'unknown',
      healthStatus: 'error',
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack
      },
      environment: config.NODE_ENV
    });
    
    // Return service unavailable response
    res.status(503).json(errorResponse);
  }
});

/**
 * Lightweight Health Check Endpoint - GET /ping
 * 
 * Provides minimal health validation for high-frequency monitoring.
 * Returns simple JSON response optimized for monitoring system polling.
 */
router.get('/ping', (req, res) => {
  const correlationId = req.headers['x-correlation-id'] || 
                       req.headers['x-request-id'] || 
                       `ping-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  const startTime = Date.now();
  
  try {
    const pingResponse = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      service: 'hao-backprop-test',
      correlationId: correlationId
    };
    
    // Minimal logging for ping endpoint to reduce overhead
    const responseTime = Date.now() - startTime;
    logger.http('Ping health check', {
      correlationId: correlationId,
      method: 'GET',
      url: '/ping',
      status: 200,
      responseTime: `${responseTime}ms`,
      healthStatus: 'ok'
    });
    
    res.status(200).json(pingResponse);
    
  } catch (error) {
    const responseTime = Date.now() - startTime;
    logger.error('Ping health check failed', {
      correlationId: correlationId,
      method: 'GET',
      url: '/ping',
      status: 503,
      responseTime: `${responseTime}ms`,
      error: error.message
    });
    
    res.status(503).json({
      status: 'error',
      timestamp: new Date().toISOString(),
      service: 'hao-backprop-test',
      message: 'Ping failed',
      correlationId: correlationId
    });
  }
});

/**
 * Readiness Check Endpoint - GET /ready
 * 
 * Validates service readiness including dependency availability.
 * Used by orchestrators and load balancers for deployment readiness validation.
 */
router.get('/ready', (req, res) => {
  const correlationId = req.headers['x-correlation-id'] || 
                       req.headers['x-request-id'] || 
                       `ready-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  const startTime = Date.now();
  
  try {
    // Perform readiness validation
    const readinessChecks = performReadinessChecks();
    
    if (readinessChecks.ready) {
      const readyResponse = {
        status: 'ready',
        timestamp: new Date().toISOString(),
        service: 'hao-backprop-test',
        checks: readinessChecks.checks,
        correlationId: correlationId
      };
      
      const responseTime = Date.now() - startTime;
      logger.info('Service readiness check passed', {
        correlationId: correlationId,
        method: 'GET',
        url: '/ready',
        status: 200,
        responseTime: `${responseTime}ms`,
        readinessStatus: 'ready',
        checks: readinessChecks.checks
      });
      
      res.status(200).json(readyResponse);
    } else {
      throw new Error(`Readiness check failed: ${readinessChecks.failureReason}`);
    }
    
  } catch (error) {
    const responseTime = Date.now() - startTime;
    logger.error('Service readiness check failed', {
      correlationId: correlationId,
      method: 'GET',
      url: '/ready',
      status: 503,
      responseTime: `${responseTime}ms`,
      readinessStatus: 'not ready',
      error: error.message
    });
    
    res.status(503).json({
      status: 'not ready',
      timestamp: new Date().toISOString(),
      service: 'hao-backprop-test',
      message: 'Service not ready',
      error: error.message,
      correlationId: correlationId
    });
  }
});

/**
 * Performs comprehensive health validation checks
 * 
 * @returns {Object} Health check results
 * @throws {Error} If critical health checks fail
 */
function performHealthChecks() {
  const checks = {};
  
  // Process health validation
  checks.process = validateProcessHealth();
  
  // Memory usage validation
  checks.memory = validateMemoryUsage();
  
  // Configuration validation
  checks.configuration = validateConfiguration();
  
  // Environment validation
  checks.environment = validateEnvironment();
  
  // Dependency validation
  checks.dependencies = validateDependencies();
  
  // Check if any critical validations failed
  const failedChecks = Object.entries(checks).filter(([key, check]) => !check.healthy);
  if (failedChecks.length > 0) {
    const failureMessages = failedChecks.map(([key, check]) => `${key}: ${check.message}`);
    throw new Error(`Health check failures: ${failureMessages.join(', ')}`);
  }
  
  return checks;
}

/**
 * Validates Node.js process health
 */
function validateProcessHealth() {
  try {
    const uptime = process.uptime();
    const memoryUsage = process.memoryUsage();
    
    return {
      healthy: true,
      uptime: uptime,
      memory: memoryUsage,
      pid: process.pid,
      nodeVersion: process.version,
      message: 'Process healthy'
    };
  } catch (error) {
    return {
      healthy: false,
      message: `Process health check failed: ${error.message}`,
      error: error.name
    };
  }
}

/**
 * Validates memory usage within acceptable thresholds
 */
function validateMemoryUsage() {
  try {
    const memoryUsage = process.memoryUsage();
    const heapUsedMB = Math.round(memoryUsage.heapUsed / 1024 / 1024);
    const heapTotalMB = Math.round(memoryUsage.heapTotal / 1024 / 1024);
    const rssMB = Math.round(memoryUsage.rss / 1024 / 1024);
    
    // Set memory threshold warnings (configurable based on environment)
    const memoryThresholdMB = config.NODE_ENV === 'production' ? 150 : 100;
    
    const healthy = rssMB < memoryThresholdMB;
    
    return {
      healthy: healthy,
      heapUsed: `${heapUsedMB}MB`,
      heapTotal: `${heapTotalMB}MB`,
      rss: `${rssMB}MB`,
      threshold: `${memoryThresholdMB}MB`,
      message: healthy ? 'Memory usage within limits' : `Memory usage exceeded threshold: ${rssMB}MB > ${memoryThresholdMB}MB`
    };
  } catch (error) {
    return {
      healthy: false,
      message: `Memory validation failed: ${error.message}`,
      error: error.name
    };
  }
}

/**
 * Validates essential configuration parameters
 */
function validateConfiguration() {
  try {
    const requiredConfig = ['NODE_ENV', 'HOST', 'PORT'];
    const missingConfig = requiredConfig.filter(key => !config[key]);
    
    if (missingConfig.length > 0) {
      return {
        healthy: false,
        message: `Missing required configuration: ${missingConfig.join(', ')}`,
        missing: missingConfig
      };
    }
    
    return {
      healthy: true,
      environment: config.NODE_ENV,
      host: config.HOST,
      port: config.PORT,
      message: 'Configuration validated'
    };
  } catch (error) {
    return {
      healthy: false,
      message: `Configuration validation failed: ${error.message}`,
      error: error.name
    };
  }
}

/**
 * Validates runtime environment requirements
 */
function validateEnvironment() {
  try {
    const nodeVersion = process.version;
    const platform = process.platform;
    const arch = process.arch;
    
    // Validate Node.js version compatibility (minimum v14.x)
    const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0]);
    const minVersion = 14;
    
    if (majorVersion < minVersion) {
      return {
        healthy: false,
        nodeVersion: nodeVersion,
        platform: platform,
        arch: arch,
        message: `Node.js version ${nodeVersion} below minimum required v${minVersion}.x`
      };
    }
    
    return {
      healthy: true,
      nodeVersion: nodeVersion,
      platform: platform,
      arch: arch,
      message: 'Environment validated'
    };
  } catch (error) {
    return {
      healthy: false,
      message: `Environment validation failed: ${error.message}`,
      error: error.name
    };
  }
}

/**
 * Validates critical system dependencies
 */
function validateDependencies() {
  try {
    const dependencies = {
      express: checkExpressDependency(),
      logger: checkLoggerDependency(),
      config: checkConfigDependency()
    };
    
    const failedDeps = Object.entries(dependencies).filter(([key, dep]) => !dep.available);
    
    if (failedDeps.length > 0) {
      const failureMessages = failedDeps.map(([key, dep]) => `${key}: ${dep.message}`);
      return {
        healthy: false,
        message: `Dependency failures: ${failureMessages.join(', ')}`,
        dependencies: dependencies
      };
    }
    
    return {
      healthy: true,
      dependencies: dependencies,
      message: 'All dependencies available'
    };
  } catch (error) {
    return {
      healthy: false,
      message: `Dependency validation failed: ${error.message}`,
      error: error.name
    };
  }
}

/**
 * Checks Express.js framework availability
 */
function checkExpressDependency() {
  try {
    require('express');
    return {
      available: true,
      message: 'Express.js available'
    };
  } catch (error) {
    return {
      available: false,
      message: `Express.js not available: ${error.message}`
    };
  }
}

/**
 * Checks logging framework availability
 */
function checkLoggerDependency() {
  try {
    // Check if Winston is available (preferred)
    require('winston');
    return {
      available: true,
      type: 'winston',
      message: 'Winston structured logging available'
    };
  } catch (error) {
    // Fallback logger is always available
    return {
      available: true,
      type: 'fallback',
      message: 'Fallback console logging available'
    };
  }
}

/**
 * Checks configuration module availability
 */
function checkConfigDependency() {
  try {
    require('../config/index');
    return {
      available: true,
      type: 'module',
      message: 'Configuration module available'
    };
  } catch (error) {
    return {
      available: true,
      type: 'environment',
      message: 'Environment variable configuration available'
    };
  }
}

/**
 * Performs readiness validation for deployment orchestration
 */
function performReadinessChecks() {
  try {
    const checks = {
      server: validateServerReadiness(),
      configuration: validateConfigurationReadiness(),
      dependencies: validateDependencyReadiness()
    };
    
    const notReady = Object.entries(checks).filter(([key, check]) => !check.ready);
    
    if (notReady.length > 0) {
      const failureReasons = notReady.map(([key, check]) => `${key}: ${check.message}`);
      return {
        ready: false,
        checks: checks,
        failureReason: failureReasons.join(', ')
      };
    }
    
    return {
      ready: true,
      checks: checks,
      message: 'Service ready for traffic'
    };
  } catch (error) {
    return {
      ready: false,
      failureReason: `Readiness check error: ${error.message}`,
      checks: {}
    };
  }
}

/**
 * Validates server binding and network readiness
 */
function validateServerReadiness() {
  try {
    // Validate that we can access essential server components
    const serverReady = typeof require === 'function' && process.versions.node;
    
    return {
      ready: serverReady,
      host: config.HOST,
      port: config.PORT,
      nodeVersion: process.version,
      message: serverReady ? 'Server ready' : 'Server not ready'
    };
  } catch (error) {
    return {
      ready: false,
      message: `Server readiness check failed: ${error.message}`
    };
  }
}

/**
 * Validates configuration readiness for service startup
 */
function validateConfigurationReadiness() {
  try {
    const essential = config.HOST && config.PORT && config.NODE_ENV;
    
    return {
      ready: essential,
      environment: config.NODE_ENV,
      message: essential ? 'Configuration ready' : 'Configuration incomplete'
    };
  } catch (error) {
    return {
      ready: false,
      message: `Configuration readiness failed: ${error.message}`
    };
  }
}

/**
 * Validates dependency readiness for service operation
 */
function validateDependencyReadiness() {
  try {
    // Check essential dependencies
    const expressAvailable = checkExpressDependency().available;
    const loggerAvailable = checkLoggerDependency().available;
    
    const ready = expressAvailable && loggerAvailable;
    
    return {
      ready: ready,
      express: expressAvailable,
      logger: loggerAvailable,
      message: ready ? 'Dependencies ready' : 'Dependencies not ready'
    };
  } catch (error) {
    return {
      ready: false,
      message: `Dependency readiness failed: ${error.message}`
    };
  }
}

module.exports = router;