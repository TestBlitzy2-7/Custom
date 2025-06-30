/**
 * PM2 Ecosystem Configuration for hao-backprop-test Express.js Application
 * 
 * This configuration file defines PM2 process management settings for production deployment
 * including cluster mode, automatic restart policies, memory threshold management, and
 * zero-downtime deployment capabilities.
 * 
 * Features:
 * - CPU-based cluster mode with automatic worker scaling
 * - Memory threshold management with automatic restart (< 150MB per worker)
 * - Zero-downtime deployments with graceful reload capabilities
 * - Comprehensive process monitoring and health checks
 * - Environment-specific configuration management
 * - Log aggregation and rotation integration
 * - Graceful shutdown with connection draining
 * 
 * Usage:
 *   Development: pm2 start ecosystem.config.js --env development
 *   Production:  pm2 start ecosystem.config.js --env production
 *   Reload:      pm2 reload ecosystem.config.js --env production
 *   Monitor:     pm2 monit
 *   Status:      pm2 status
 */

module.exports = {
  apps: [
    {
      // Application Configuration
      name: 'hao-backprop-test',
      script: './server.js',
      
      // Cluster Mode Configuration - CPU-based scaling per Section 0.2.1
      instances: 'max', // Automatically scale to number of CPU cores
      exec_mode: 'cluster', // Enable cluster mode for horizontal scaling
      
      // Memory Management - Threshold management per Section 0.2.2  
      max_memory_restart: '150M', // Restart if memory exceeds 150MB per worker
      memory_limit: '200M', // Hard memory limit before forced restart
      
      // Restart Policy Configuration
      restart_delay: 5000, // 5 second delay between restart attempts
      max_restarts: 10, // Maximum restart attempts before marking as errored
      min_uptime: '10s', // Minimum uptime before restart is considered successful
      autorestart: true, // Enable automatic restart on failure
      
      // Zero-Downtime Deployment Configuration per Section 0.3.1
      kill_timeout: 10000, // 10 second graceful shutdown timeout
      wait_ready: true, // Wait for application ready signal
      listen_timeout: 5000, // Maximum time to wait for listen event
      reload_delay: 1000, // Delay between worker reloads during graceful reload
      
      // Environment Configuration
      env: {
        NODE_ENV: 'development',
        PORT: 3000,
        HOST: '127.0.0.1',
        LOG_LEVEL: 'debug',
        PM2_SERVE_PATH: '.',
        PM2_SERVE_PORT: 3000,
        PM2_SERVE_SPA: false,
        PM2_SERVE_HOMEPAGE: '/health'
      },
      
      env_production: {
        NODE_ENV: 'production',
        PORT: 3000,
        HOST: '127.0.0.1',
        LOG_LEVEL: 'info',
        LOG_FILE: './logs/app.log',
        ERROR_FILE: './logs/error.log',
        PM2_SERVE_PATH: '.',
        PM2_SERVE_PORT: 3000,
        PM2_SERVE_SPA: false,
        PM2_SERVE_HOMEPAGE: '/health'
      },
      
      env_staging: {
        NODE_ENV: 'staging', 
        PORT: 3000,
        HOST: '127.0.0.1',
        LOG_LEVEL: 'verbose',
        LOG_FILE: './logs/staging.log',
        ERROR_FILE: './logs/staging-error.log'
      },
      
      // Log Management Configuration per technical specification
      log_type: 'json', // Structured JSON logging for PM2 logs
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      log_file: './logs/pm2-combined.log',
      out_file: './logs/pm2-out.log', 
      error_file: './logs/pm2-error.log',
      merge_logs: true, // Merge cluster logs into single files
      log_size: '10M', // Log rotation at 10MB
      log_rotate: 5, // Keep 5 rotated log files
      
      // Process Monitoring Configuration
      monitoring: true, // Enable PM2 monitoring features
      pmx: true, // Enable PM2+ monitoring integration
      automation: false, // Disable PM2+ automation (keep manual control)
      
      // Health Check Integration
      health_check_url: 'http://127.0.0.1:3000/health',
      health_check_grace_period: 3000, // 3 second grace period for health checks
      
      // Performance Optimization
      node_args: [
        '--max_old_space_size=256', // Limit Node.js heap to 256MB
        '--optimization-type=speed', // Optimize for speed over memory
      ],
      
      // Process Management
      watch: false, // Disable file watching in production (use pm2 reload instead)
      ignore_watch: [
        'node_modules',
        'logs',
        '.git',
        '.env*',
        'ecosystem.config.js'
      ],
      
      // Graceful Shutdown Configuration per Section 0.3.1
      shutdown_with_message: true, // Enable graceful shutdown with SIGTERM
      force: false, // Prevent forced termination
      
      // Cluster-Specific Configuration  
      instance_var: 'INSTANCE_ID', // Environment variable for instance identification
      combine_logs: true, // Combine logs from all cluster workers
      
      // Development-Specific Settings (overridden by environment)
      source_map_support: true, // Enable source map support for debugging
      disable_source_map_support: false,
      
      // Error Handling Configuration
      crash_recovery: true, // Enable automatic crash recovery
      exponential_backoff_restart_delay: 100, // Exponential backoff for restart delays
      
      // Resource Monitoring Thresholds
      max_cpu_percent: 80, // Alert if CPU usage exceeds 80%
      
      // Time Configuration
      time: true, // Enable timestamps in PM2 logs
      
      // Advanced Cluster Settings
      kill_retry_time: 100, // Retry interval for kill signals
      windowsHide: true, // Hide PM2 processes on Windows
      
      // Process Title
      name_prefix: 'hao-', // Prefix for process names in cluster mode
      
      // Custom Environment Variables for PM2 Integration
      PM2_HOME: process.env.PM2_HOME || require('os').homedir() + '/.pm2'
    }
  ],
  
  // PM2 Deploy Configuration (for future CI/CD integration)
  deploy: {
    production: {
      user: 'deploy',
      host: ['127.0.0.1'],
      ref: 'origin/main',
      repo: 'git@github.com:user/hao-backprop-test.git',
      path: '/var/www/production',
      'pre-deploy-local': '',
      'post-deploy': 'npm install && pm2 reload ecosystem.config.js --env production',
      'pre-setup': '',
      'ssh_options': 'ForwardAgent=yes'
    }
  },
  
  // PM2 Module Configuration
  module_conf: {
    // PM2 Log Rotate Module Configuration
    'pm2-logrotate': {
      max_size: '10M',        // Rotate logs when they reach 10MB
      retain: 7,              // Keep 7 rotated files
      compress: true,         // Compress rotated logs with gzip
      dateFormat: 'YYYY-MM-DD_HH-mm-ss',
      workerInterval: 30,     // Check for rotation every 30 seconds
      rotateInterval: '0 0 * * *', // Rotate daily at midnight
      rotateModule: true      // Rotate PM2 module logs too
    },
    
    // PM2 Server Monitor Module Configuration (optional)
    'pm2-server-monit': {
      port: 8080,            // Monitor server port
      refresh: 1000,         // Refresh interval in ms
      remote_monitoring: false, // Disable remote monitoring for security
      monitor_path: '/status'   // Health monitoring path
    }
  }
};

/**
 * PM2 Ecosystem Configuration Notes:
 * 
 * CLUSTER MODE SCALING:
 * - Uses 'max' instances to automatically scale to available CPU cores per Section 0.2.1
 * - Each worker process handles requests independently with load balancing
 * - Cluster mode enables horizontal scaling while maintaining localhost:3000 binding
 * 
 * MEMORY MANAGEMENT:
 * - max_memory_restart: 150M aligns with < 150MB per worker requirement per Section 0.2.2
 * - memory_limit: 200M provides hard limit with buffer for emergency situations
 * - Node.js heap limited to 256MB to prevent memory leaks
 * 
 * ZERO-DOWNTIME DEPLOYMENTS:
 * - Graceful reload with connection draining per Section 0.3.1
 * - kill_timeout: 10000ms allows for proper connection cleanup
 * - reload_delay: 1000ms ensures smooth worker replacement
 * 
 * AUTOMATIC RESTART POLICIES:
 * - max_restarts: 10 with exponential backoff prevents infinite restart loops
 * - min_uptime: 10s ensures process stability before considering restart successful
 * - restart_delay: 5000ms prevents rapid restart cycling
 * 
 * LOG MANAGEMENT:
 * - JSON-formatted logs for structured logging integration with Winston
 * - Log rotation at 10MB with 5 retained files prevents disk space issues
 * - Separate error logs for enhanced debugging capabilities
 * 
 * ENVIRONMENT VARIABLES:
 * - Production environment optimized for performance and monitoring
 * - Development environment includes debug logging and enhanced error reporting
 * - Staging environment provides intermediate testing configuration
 * 
 * HEALTH MONITORING:
 * - Integrated health check endpoint at /health for availability monitoring
 * - 3-second grace period allows for proper health check response
 * - Process metrics monitoring through PM2 Dashboard and pm2 monit
 * 
 * GRACEFUL SHUTDOWN:
 * - Coordinates with server.js graceful shutdown implementation
 * - SIGTERM signal handling with 10-second timeout for connection draining
 * - Proper cleanup of resources and active connections
 * 
 * PERFORMANCE OPTIMIZATION:
 * - Node.js optimization flags for production performance
 * - Cluster mode load balancing for enhanced throughput
 * - Resource monitoring with configurable thresholds
 * 
 * PRODUCTION DEPLOYMENT COMMANDS:
 * - Start: pm2 start ecosystem.config.js --env production
 * - Reload: pm2 reload ecosystem.config.js --env production (zero-downtime)
 * - Monitor: pm2 monit (real-time monitoring dashboard)
 * - Status: pm2 status (cluster health overview)
 * - Logs: pm2 logs (aggregated log streaming)
 * - Stop: pm2 stop ecosystem.config.js
 * - Delete: pm2 delete ecosystem.config.js
 */