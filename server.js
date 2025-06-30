const http = require('http');
const app = require('./app');
const config = require('./config');

// Create HTTP server with Express application
const server = http.createServer(app);

// Server configuration
const port = config.server.port || 3000;
const hostname = config.server.host || '127.0.0.1';

// Track active connections for graceful shutdown
let connections = new Set();

// Track connection events for graceful shutdown
server.on('connection', (connection) => {
  connections.add(connection);
  connection.on('close', () => {
    connections.delete(connection);
  });
});

// Graceful shutdown implementation
const gracefulShutdown = (signal) => {
  console.log(`\n${signal} received. Starting graceful shutdown...`);
  
  // Stop accepting new connections
  server.close((err) => {
    if (err) {
      console.error('Error during server close:', err);
      process.exit(1);
    }
    console.log('HTTP server closed');
    
    // Force close remaining connections after timeout
    const shutdownTimeout = setTimeout(() => {
      console.log('Force closing remaining connections...');
      connections.forEach(connection => {
        connection.destroy();
      });
      process.exit(0);
    }, 10000); // 10 second timeout
    
    // Clear timeout if all connections close naturally
    if (connections.size === 0) {
      clearTimeout(shutdownTimeout);
      process.exit(0);
    } else {
      console.log(`Waiting for ${connections.size} connections to close...`);
      
      // Monitor connection closure
      const checkConnections = setInterval(() => {
        if (connections.size === 0) {
          clearInterval(checkConnections);
          clearTimeout(shutdownTimeout);
          console.log('All connections closed. Shutting down gracefully.');
          process.exit(0);
        }
      }, 100);
    }
  });
};

// Register signal handlers for graceful shutdown
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
  gracefulShutdown('UNCAUGHT_EXCEPTION');
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  gracefulShutdown('UNHANDLED_REJECTION');
});

// Start server
server.listen(port, hostname, () => {
  console.log(`Server running at http://${hostname}:${port}/`);
  console.log(`Process ID: ${process.pid}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  
  // Log PM2 cluster information if available
  if (process.env.PM2_HOME) {
    console.log(`PM2 Instance ID: ${process.env.pm_id || 'N/A'}`);
    console.log(`PM2 Instance Name: ${process.env.name || 'N/A'}`);
  }
});

// Handle server errors
server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`Port ${port} is already in use`);
    process.exit(1);
  } else if (err.code === 'EACCES') {
    console.error(`Permission denied to bind to port ${port}`);
    process.exit(1);
  } else {
    console.error('Server error:', err);
    process.exit(1);
  }
});

// Export server for testing purposes
module.exports = server;