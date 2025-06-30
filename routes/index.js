/**
 * Main Express.Router module implementing primary application routes
 * 
 * This module replaces the single catch-all handler from the original HTTP server
 * while maintaining backward compatibility with existing integration testing.
 * Provides modular route organization with Express.Router for scalable architecture.
 * 
 * @description Main routes module implementing the core application endpoints
 * @author Blitzy agent
 * @version 1.0.0
 */

const express = require('express');

// Create Express Router instance for modular route organization
const router = express.Router();

/**
 * GET / - Main application endpoint (backward compatibility)
 * 
 * Maintains exact compatibility with the original HTTP server response:
 * - Status: 200 OK
 * - Content-Type: text/plain
 * - Body: "Hello, World!\n"
 * 
 * This endpoint replaces the original catch-all handler while preserving
 * the exact response format required by existing backprop integration testing.
 * 
 * Performance: < 10ms response time requirement
 * Compatibility: Maintains localhost:3000 binding expectations
 * 
 * @route GET /
 * @returns {string} Plain text "Hello, World!\n" response
 * @status 200 - Success response
 */
router.get('/', (req, res) => {
    // Set exact same headers as original HTTP server for backward compatibility
    res.setHeader('Content-Type', 'text/plain');
    
    // Send exact same response body as original implementation
    // Maintains character-for-character compatibility including newline
    res.send('Hello, World!\n');
});

/**
 * GET /status - Application status endpoint
 * 
 * Provides basic application status information in JSON format.
 * This endpoint complements the main health check functionality
 * and offers a lightweight status verification option.
 * 
 * @route GET /status
 * @returns {object} JSON object with status information
 * @status 200 - Success response with status data
 */
router.get('/status', (req, res) => {
    // Generate status response with basic application information
    const statusResponse = {
        status: 'operational',
        message: 'Express.js server is running',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        environment: process.env.NODE_ENV || 'development'
    };
    
    // Return JSON response with application status
    res.json(statusResponse);
});

/**
 * GET /ping - Simple connectivity test endpoint
 * 
 * Provides minimal response for basic connectivity testing.
 * Useful for load balancer health checks and basic service verification.
 * 
 * @route GET /ping
 * @returns {object} Simple JSON response confirming service availability
 * @status 200 - Success response
 */
router.get('/ping', (req, res) => {
    res.json({ 
        message: 'pong',
        timestamp: new Date().toISOString()
    });
});

// Export the configured router for mounting in the Express application
// This router will be mounted at the root path (/) in app.js
module.exports = router;