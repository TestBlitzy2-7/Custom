/**
 * Express.js Application Factory
 * 
 * Creates and configures the Express application instance with comprehensive 
 * middleware pipeline, modular routing, and production-ready features.
 * 
 * This factory pattern implementation separates application configuration
 * from server binding for enhanced testability and modular architecture.
 * 
 * Architecture Features:
 * - Comprehensive middleware pipeline with security, parsing, logging
 * - Modular routing structure (index, api, health endpoints)
 * - Environment-based configuration management
 * - Structured Winston/Morgan logging integration
 * - Centralized error handling with proper HTTP status codes
 * - Graceful shutdown handlers for PM2 cluster support
 * 
 * @requires express Express.js web framework (4.19.2)
 * @requires cors Cross-Origin Resource Sharing middleware
 * @requires helmet Security headers middleware
 * @requires morgan HTTP request logging middleware
 * @requires body-parser Request body parsing middleware
 */

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const bodyParser = require('body-parser');

// Import configuration and logging
const config = require('./config');
const logger = require('./config/logger');

// Import custom middleware
const loggerMiddleware = require('./middleware/logger');
const errorHandler = require('./middleware/errorHandler');

// Import route modules
const indexRoutes = require('./routes/index');
const apiRoutes = require('./routes/api');
const healthRoutes = require('./routes/health');

/**
 * Application Factory Function
 * 
 * Creates and configures a complete Express application instance with
 * production-ready middleware pipeline and modular routing architecture.
 * 
 * Middleware Execution Order (per Section 3.2.2):
 * 1. Morgan request logging
 * 2. Body parser middleware (JSON, URL-encoded)
 * 3. CORS handler
 * 4. Helmet security headers
 * 5. Custom logger middleware
 * 6. Express router (main routes, API routes, health routes)
 * 7. Error handler middleware (centralized error processing)
 * 
 * @returns {express.Application} Configured Express application instance
 */
function createApp() {
    // Initialize Express application
    const app = express();

    // Trust proxy for accurate client IP in load-balanced environments
    // Required for proper Morgan logging and security headers
    app.set('trust proxy', 1);

    // Configure Express application settings
    app.set('env', config.NODE_ENV);
    app.set('port', config.PORT);

    // ============================================================================
    // MIDDLEWARE PIPELINE CONFIGURATION
    // ============================================================================

    // 1. Morgan HTTP Request Logging Middleware
    // Provides structured HTTP request/response logging with configurable formats
    // Position: First in pipeline to capture all incoming requests
    const morganFormat = config.NODE_ENV === 'production' 
        ? 'combined'  // Common Log Format for production
        : 'dev';      // Colored, concise format for development

    app.use(morgan(morganFormat, {
        stream: {
            write: (message) => {
                // Integrate Morgan with Winston structured logging
                logger.info(message.trim(), { 
                    component: 'http',
                    source: 'morgan'
                });
            }
        },
        // Skip logging for health check endpoints to reduce noise
        skip: (req, res) => req.url === '/health' && config.NODE_ENV === 'production'
    }));

    // 2. Body Parser Middleware
    // Parse incoming request bodies in JSON and URL-encoded formats
    // Configure limits to prevent payload-based attacks
    app.use(bodyParser.json({
        limit: '10mb',  // Reasonable limit for API payloads
        strict: true,   // Only parse arrays and objects
        type: 'application/json'
    }));

    app.use(bodyParser.urlencoded({
        extended: true,     // Support nested objects
        limit: '10mb',      // Match JSON limit
        type: 'application/x-www-form-urlencoded'
    }));

    // Support parsing of raw text payloads for flexibility
    app.use(bodyParser.text({
        limit: '1mb',
        type: 'text/plain'
    }));

    // 3. CORS (Cross-Origin Resource Sharing) Middleware
    // Configure controlled cross-origin access for testing scenarios
    const corsOptions = {
        origin: config.NODE_ENV === 'production' 
            ? ['http://127.0.0.1:3000', 'http://localhost:3000']  // Restrict origins in production
            : true,  // Allow all origins in development
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'HEAD', 'PATCH'],
        allowedHeaders: [
            'Origin',
            'X-Requested-With', 
            'Content-Type', 
            'Accept',
            'Authorization',
            'X-Forwarded-For',
            'X-Real-IP'
        ],
        credentials: false,  // No credentials for localhost testing
        maxAge: 86400       // Cache preflight responses for 24 hours
    };

    app.use(cors(corsOptions));

    // 4. Helmet Security Headers Middleware
    // Automatically configure security headers for protection against common vulnerabilities
    // Implementation follows OWASP security recommendations
    app.use(helmet({
        contentSecurityPolicy: {
            directives: {
                defaultSrc: ["'self'"],
                styleSrc: ["'self'", "'unsafe-inline'"],
                scriptSrc: ["'self'"],
                imgSrc: ["'self'", "data:", "https:"],
                connectSrc: ["'self'"],
                fontSrc: ["'self'"],
                objectSrc: ["'none'"],
                mediaSrc: ["'self'"],
                frameSrc: ["'none'"]
            }
        },
        crossOriginEmbedderPolicy: false,  // Disable for API compatibility
        hsts: config.NODE_ENV === 'production' ? {
            maxAge: 31536000,    // 1 year
            includeSubDomains: true,
            preload: true
        } : false,  // Disable HSTS for local development
        referrerPolicy: { policy: 'same-origin' }
    }));

    // 5. Custom Logger Middleware
    // Integrate structured logging with correlation ID generation
    // Position after basic middleware but before route handlers
    app.use(loggerMiddleware);

    // ============================================================================
    // ROUTING CONFIGURATION
    // ============================================================================

    // Mount main application routes at root path
    // Handles backward-compatible endpoints and core functionality
    app.use('/', indexRoutes);

    // Mount API routes with versioning support
    // Provides structured REST API endpoints
    app.use('/api', apiRoutes);

    // Mount health check routes for monitoring integration
    // Supports automated monitoring and service discovery
    app.use('/health', healthRoutes);

    // Additional health check endpoint at root level for backward compatibility
    // Some monitoring systems expect health checks at standard paths
    app.get('/ping', (req, res) => {
        res.status(200).json({
            status: 'healthy',
            timestamp: new Date().toISOString(),
            service: 'hao-backprop-test',
            version: process.env.npm_package_version || '1.0.0',
            uptime: Math.floor(process.uptime())
        });
    });

    // 404 Handler for undefined routes
    // Must be positioned after all valid routes but before error handler
    app.use('*', (req, res, next) => {
        const error = new Error(`Route ${req.method} ${req.originalUrl} not found`);
        error.status = 404;
        error.statusCode = 404;
        next(error);
    });

    // ============================================================================
    // ERROR HANDLING CONFIGURATION
    // ============================================================================

    // Centralized Error Handler Middleware
    // Must be the last middleware in the stack to catch all errors
    // Handles both synchronous errors and async errors passed via next()
    app.use(errorHandler);

    // ============================================================================
    // GRACEFUL SHUTDOWN HANDLERS
    // ============================================================================

    // Configure graceful shutdown for PM2 cluster support
    // Handles SIGTERM and SIGINT signals properly
    const gracefulShutdown = (signal) => {
        logger.info(`Received ${signal}. Starting graceful shutdown...`, {
            component: 'app',
            process: 'shutdown',
            signal: signal
        });

        // Perform cleanup operations
        setTimeout(() => {
            logger.info('Graceful shutdown completed', {
                component: 'app',
                process: 'shutdown'
            });
            process.exit(0);
        }, 5000); // Allow 5 seconds for cleanup
    };

    // Register shutdown handlers only in non-test environments
    if (process.env.NODE_ENV !== 'test') {
        process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
        process.on('SIGINT', () => gracefulShutdown('SIGINT'));
        
        // Handle uncaught exceptions and unhandled promise rejections
        process.on('uncaughtException', (error) => {
            logger.error('Uncaught Exception', {
                component: 'app',
                error: error.message,
                stack: error.stack,
                process: 'error_handling'
            });
            process.exit(1);
        });

        process.on('unhandledRejection', (reason, promise) => {
            logger.error('Unhandled Promise Rejection', {
                component: 'app',
                reason: reason,
                promise: promise,
                process: 'error_handling'
            });
            process.exit(1);
        });
    }

    // Log successful application initialization
    logger.info('Express application factory initialized successfully', {
        component: 'app',
        environment: config.NODE_ENV,
        port: config.PORT,
        middleware_count: app._router?.stack?.length || 0,
        process: 'initialization'
    });

    return app;
}

// ============================================================================
// FACTORY EXPORT AND METADATA
// ============================================================================

/**
 * Export the application factory function
 * 
 * This factory pattern allows for:
 * - Easy testing by creating isolated app instances
 * - Configuration flexibility across environments
 * - Better separation of concerns between app creation and server binding
 * - Support for multiple app instances in cluster mode
 */
module.exports = createApp;

/**
 * Export application metadata for introspection
 * Useful for testing and monitoring purposes
 */
module.exports.metadata = {
    name: 'hao-backprop-test-app',
    version: '1.0.0',
    description: 'Express.js application factory for backprop integration testing',
    architecture: 'Express.js Monolithic Web Application',
    middleware: [
        'morgan',       // HTTP request logging
        'body-parser',  // Request body parsing
        'cors',         // Cross-origin resource sharing
        'helmet',       // Security headers
        'custom-logger', // Structured logging
        'error-handler' // Centralized error handling
    ],
    routes: [
        'index',    // Main application routes
        'api',      // REST API endpoints
        'health'    // Health check endpoints
    ],
    features: [
        'Factory Pattern',
        'Middleware Pipeline',
        'Modular Routing',
        'Structured Logging',
        'Error Handling',
        'Graceful Shutdown',
        'Security Headers',
        'Environment Configuration'
    ]
};