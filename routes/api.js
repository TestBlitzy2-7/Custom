/**
 * API Routes Module
 * 
 * Express.Router module dedicated to API endpoints implementing RESTful patterns
 * and JSON response formatting. Provides extensible architecture for future API
 * functionality while integrating with the comprehensive middleware pipeline for
 * security, logging, and error handling.
 * 
 * This module demonstrates enterprise-grade API design patterns including:
 * - RESTful endpoint conventions
 * - Structured JSON responses
 * - Proper HTTP status codes
 * - Error handling integration
 * - Extensible architecture for future development
 */

const express = require('express');
const router = express.Router();

/**
 * API Base Information Endpoint
 * GET /api
 * 
 * Provides basic API information and version details
 * Useful for API discovery and health monitoring
 */
router.get('/', (req, res, next) => {
  try {
    const apiInfo = {
      name: 'Express.js HTTP Server API',
      version: '1.0.0',
      description: 'RESTful API endpoints for backprop integration testing',
      endpoints: {
        base: '/api',
        users: '/api/users',
        data: '/api/data',
        status: '/api/status'
      },
      timestamp: new Date().toISOString(),
      uptime: process.uptime()
    };

    res.status(200).json({
      success: true,
      data: apiInfo
    });
  } catch (error) {
    next(error);
  }
});

/**
 * API Status Endpoint  
 * GET /api/status
 * 
 * Returns current API operational status with system metrics
 * Supports monitoring and health checking systems
 */
router.get('/status', (req, res, next) => {
  try {
    const status = {
      status: 'operational',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: {
        used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
        unit: 'MB'
      },
      environment: process.env.NODE_ENV || 'development',
      nodejs: process.version
    };

    res.status(200).json({
      success: true,
      data: status
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Users Resource Endpoints
 * 
 * Demonstrates RESTful patterns for a users resource
 * These endpoints provide a foundation for future user management functionality
 */

/**
 * GET /api/users
 * 
 * Retrieves a list of users (mock implementation)
 * Supports query parameters for pagination and filtering
 */
router.get('/users', (req, res, next) => {
  try {
    // Extract query parameters for pagination and filtering
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const filter = req.query.filter || '';

    // Mock user data for demonstration
    const mockUsers = [
      { id: 1, name: 'John Doe', email: 'john@example.com', role: 'admin' },
      { id: 2, name: 'Jane Smith', email: 'jane@example.com', role: 'user' },
      { id: 3, name: 'Bob Johnson', email: 'bob@example.com', role: 'user' },
      { id: 4, name: 'Alice Brown', email: 'alice@example.com', role: 'moderator' },
      { id: 5, name: 'Charlie Wilson', email: 'charlie@example.com', role: 'user' }
    ];

    // Apply filtering if specified
    const filteredUsers = filter 
      ? mockUsers.filter(user => 
          user.name.toLowerCase().includes(filter.toLowerCase()) ||
          user.email.toLowerCase().includes(filter.toLowerCase())
        )
      : mockUsers;

    // Apply pagination
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedUsers = filteredUsers.slice(startIndex, endIndex);

    const response = {
      success: true,
      data: paginatedUsers,
      pagination: {
        page,
        limit,
        total: filteredUsers.length,
        pages: Math.ceil(filteredUsers.length / limit)
      },
      filter: filter || null
    };

    res.status(200).json(response);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/users/:id
 * 
 * Retrieves a specific user by ID
 * Demonstrates parameterized route handling
 */
router.get('/users/:id', (req, res, next) => {
  try {
    const userId = parseInt(req.params.id);

    // Validate user ID parameter
    if (!userId || userId < 1) {
      return res.status(400).json({
        success: false,
        error: {
          message: 'Invalid user ID provided',
          code: 'INVALID_PARAMETER',
          details: 'User ID must be a positive integer'
        }
      });
    }

    // Mock user lookup
    const mockUser = {
      id: userId,
      name: `User ${userId}`,
      email: `user${userId}@example.com`,
      role: 'user',
      createdAt: new Date().toISOString(),
      lastLogin: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString()
    };

    // Simulate user not found for certain IDs
    if (userId > 100) {
      return res.status(404).json({
        success: false,
        error: {
          message: 'User not found',
          code: 'USER_NOT_FOUND',
          details: `No user exists with ID: ${userId}`
        }
      });
    }

    res.status(200).json({
      success: true,
      data: mockUser
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/users
 * 
 * Creates a new user
 * Demonstrates request body processing and validation
 */
router.post('/users', (req, res, next) => {
  try {
    const { name, email, role } = req.body;

    // Validate required fields
    if (!name || !email) {
      return res.status(400).json({
        success: false,
        error: {
          message: 'Missing required fields',
          code: 'VALIDATION_ERROR',
          details: 'Name and email are required fields'
        }
      });
    }

    // Validate email format (basic validation)
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        error: {
          message: 'Invalid email format',
          code: 'VALIDATION_ERROR',
          details: 'Please provide a valid email address'
        }
      });
    }

    // Mock user creation
    const newUser = {
      id: Math.floor(Math.random() * 1000) + 1,
      name,
      email,
      role: role || 'user',
      createdAt: new Date().toISOString(),
      lastLogin: null
    };

    res.status(201).json({
      success: true,
      message: 'User created successfully',
      data: newUser
    });
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /api/users/:id
 * 
 * Updates an existing user
 * Demonstrates full resource replacement pattern
 */
router.put('/users/:id', (req, res, next) => {
  try {
    const userId = parseInt(req.params.id);
    const { name, email, role } = req.body;

    // Validate user ID parameter
    if (!userId || userId < 1) {
      return res.status(400).json({
        success: false,
        error: {
          message: 'Invalid user ID provided',
          code: 'INVALID_PARAMETER',
          details: 'User ID must be a positive integer'
        }
      });
    }

    // Validate required fields
    if (!name || !email) {
      return res.status(400).json({
        success: false,
        error: {
          message: 'Missing required fields',
          code: 'VALIDATION_ERROR',
          details: 'Name and email are required for user update'
        }
      });
    }

    // Simulate user not found for certain IDs
    if (userId > 100) {
      return res.status(404).json({
        success: false,
        error: {
          message: 'User not found',
          code: 'USER_NOT_FOUND',
          details: `No user exists with ID: ${userId}`
        }
      });
    }

    // Mock user update
    const updatedUser = {
      id: userId,
      name,
      email,
      role: role || 'user',
      createdAt: new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000).toISOString(),
      updatedAt: new Date().toISOString(),
      lastLogin: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString()
    };

    res.status(200).json({
      success: true,
      message: 'User updated successfully',
      data: updatedUser
    });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/users/:id
 * 
 * Deletes a user by ID
 * Demonstrates resource deletion pattern
 */
router.delete('/users/:id', (req, res, next) => {
  try {
    const userId = parseInt(req.params.id);

    // Validate user ID parameter
    if (!userId || userId < 1) {
      return res.status(400).json({
        success: false,
        error: {
          message: 'Invalid user ID provided',
          code: 'INVALID_PARAMETER',
          details: 'User ID must be a positive integer'
        }
      });
    }

    // Simulate user not found for certain IDs
    if (userId > 100) {
      return res.status(404).json({
        success: false,
        error: {
          message: 'User not found',
          code: 'USER_NOT_FOUND',
          details: `No user exists with ID: ${userId}`
        }
      });
    }

    // Simulate protection for admin users
    if (userId === 1) {
      return res.status(403).json({
        success: false,
        error: {
          message: 'Cannot delete admin user',
          code: 'FORBIDDEN_OPERATION',
          details: 'Admin users cannot be deleted'
        }
      });
    }

    res.status(200).json({
      success: true,
      message: 'User deleted successfully',
      data: {
        id: userId,
        deletedAt: new Date().toISOString()
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Data Resource Endpoints
 * 
 * Demonstrates additional API patterns for data manipulation
 */

/**
 * GET /api/data
 * 
 * Retrieves data with various query options
 * Supports multiple output formats and filtering
 */
router.get('/data', (req, res, next) => {
  try {
    const format = req.query.format || 'json';
    const limit = parseInt(req.query.limit) || 50;
    const type = req.query.type || 'all';

    // Mock data generation
    const mockData = {
      metrics: {
        totalRequests: Math.floor(Math.random() * 10000),
        activeUsers: Math.floor(Math.random() * 1000),
        errorRate: (Math.random() * 5).toFixed(2) + '%',
        responseTime: Math.floor(Math.random() * 200) + 'ms'
      },
      events: Array.from({ length: Math.min(limit, 20) }, (_, i) => ({
        id: i + 1,
        type: ['login', 'logout', 'error', 'warning'][Math.floor(Math.random() * 4)],
        timestamp: new Date(Date.now() - Math.random() * 24 * 60 * 60 * 1000).toISOString(),
        message: `Event ${i + 1} occurred`
      })),
      system: {
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        pid: process.pid,
        platform: process.platform
      }
    };

    // Filter data by type if specified
    const responseData = type === 'all' ? mockData : 
      type in mockData ? { [type]: mockData[type] } : {};

    // Handle different response formats
    if (format === 'xml') {
      // For XML format, return a simple XML structure
      res.set('Content-Type', 'application/xml');
      return res.status(200).send(`<?xml version="1.0" encoding="UTF-8"?>
<response>
  <success>true</success>
  <message>XML format not fully implemented. Use format=json for complete data.</message>
</response>`);
    }

    res.status(200).json({
      success: true,
      data: responseData,
      meta: {
        format,
        type,
        limit,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/data
 * 
 * Accepts and processes data submissions
 * Demonstrates data validation and processing
 */
router.post('/data', (req, res, next) => {
  try {
    const { data, type, metadata } = req.body;

    // Validate request payload
    if (!data) {
      return res.status(400).json({
        success: false,
        error: {
          message: 'Missing data payload',
          code: 'VALIDATION_ERROR',
          details: 'Request must include a data field'
        }
      });
    }

    // Process the submitted data
    const processedData = {
      id: `data_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      originalData: data,
      type: type || 'unknown',
      metadata: metadata || {},
      processedAt: new Date().toISOString(),
      size: JSON.stringify(data).length,
      checksum: Buffer.from(JSON.stringify(data)).toString('base64').slice(0, 16)
    };

    res.status(201).json({
      success: true,
      message: 'Data processed successfully',
      data: processedData
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Error Simulation Endpoint
 * GET /api/error
 * 
 * Deliberately triggers different types of errors for testing
 * error handling middleware integration
 */
router.get('/error', (req, res, next) => {
  const errorType = req.query.type || 'generic';

  try {
    switch (errorType) {
      case 'validation':
        return res.status(400).json({
          success: false,
          error: {
            message: 'Validation error simulation',
            code: 'VALIDATION_ERROR',
            details: 'This is a simulated validation error'
          }
        });

      case 'notfound':
        return res.status(404).json({
          success: false,
          error: {
            message: 'Resource not found simulation',
            code: 'NOT_FOUND',
            details: 'This is a simulated not found error'
          }
        });

      case 'server':
        throw new Error('Simulated server error for testing error handling middleware');

      case 'async':
        // Simulate an async error
        setTimeout(() => {
          throw new Error('Simulated async error');
        }, 100);
        return res.status(500).json({
          success: false,
          error: {
            message: 'Async error initiated',
            code: 'ASYNC_ERROR',
            details: 'An async error has been triggered'
          }
        });

      default:
        return res.status(400).json({
          success: false,
          error: {
            message: 'Unknown error type',
            code: 'INVALID_PARAMETER',
            details: 'Supported error types: validation, notfound, server, async'
          }
        });
    }
  } catch (error) {
    next(error);
  }
});

/**
 * Catch-all handler for undefined API routes
 * Provides consistent 404 responses for API endpoints
 */
router.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: {
      message: 'API endpoint not found',
      code: 'ENDPOINT_NOT_FOUND',
      details: `The requested API endpoint '${req.originalUrl}' does not exist`,
      availableEndpoints: [
        'GET /api',
        'GET /api/status',
        'GET /api/users',
        'GET /api/users/:id',
        'POST /api/users',
        'PUT /api/users/:id',
        'DELETE /api/users/:id',
        'GET /api/data',
        'POST /api/data',
        'GET /api/error'
      ]
    }
  });
});

module.exports = router;