/**
 * Proxy Server for Strangler Fig Pattern
 *
 * This proxy server routes requests between the legacy Symfony application
 * and the new NestJS application based on the migration status of each endpoint.
 *
 * As endpoints are migrated from Symfony to NestJS, update the NESTJS_ROUTES
 * array to include them.
 */

const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');

const app = express();

// Configuration
const PROXY_PORT = process.env.PROXY_PORT || 3000;
const SYMFONY_URL = process.env.SYMFONY_URL || 'http://localhost:8080';
const NESTJS_URL = process.env.NESTJS_URL || 'http://localhost:3001';

// Define which routes should be handled by NestJS (migrated endpoints)
// Add routes here as they are migrated from Symfony to NestJS
const NESTJS_ROUTES = [
  '/healthcheck',
  '/api/healthcheck',
  // Project endpoints - MIGRATED ✅
  '/api/project',
  // Views - MIGRATED ✅
  '/',
  '/login',
  '/workarea',
  // Auth endpoints - MIGRATED ✅
  '/login_check',
  '/login/guest',
  '/logout',
  '/api/auth/login',
  '/api/auth/logout',
  '/api/auth/check',
  '/api/session/check',
  '/api/parameter-management',
  '/api/translations',
  '/api/idevice',
  '/api/theme',
  '/api/user',
  '/api/config',
  // Static assets - served by NestJS ✅
  '/libs',
  '/app',
  '/style',
  '/images',
  '/fonts',
  '/favicon.ico',
  '/CHANGELOG.md',
];

// Middleware to log requests (helpful for debugging)
app.use((req, res, next) => {
  const target = NESTJS_ROUTES.some(route => req.path.startsWith(route)) ? 'NestJS' : 'Symfony';
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path} -> ${target}`);
  next();
});

// Create proxy middlewares
const symfonyProxy = createProxyMiddleware({
  target: SYMFONY_URL,
  changeOrigin: true,
  ws: false, // WebSocket will be handled separately
  logLevel: 'debug',
  onError: (err, req, res) => {
    console.error('Symfony proxy error:', err);
    res.status(502).json({ error: 'Bad Gateway', service: 'symfony' });
  },
});

const nestjsProxy = createProxyMiddleware({
  target: NESTJS_URL,
  changeOrigin: true,
  ws: true, // NestJS will handle WebSockets
  logLevel: 'debug',
  onError: (err, req, res) => {
    console.error('NestJS proxy error:', err);
    res.status(502).json({ error: 'Bad Gateway', service: 'nestjs' });
  },
});

// Route requests based on path
app.use((req, res, next) => {
  // Check if the route should be handled by NestJS
  const shouldUseNestJS = NESTJS_ROUTES.some(route => {
    if (route.endsWith('*')) {
      // Wildcard route
      return req.path.startsWith(route.slice(0, -1));
    }
    return req.path === route || req.path.startsWith(route + '/');
  });

  if (shouldUseNestJS) {
    // Route to NestJS
    nestjsProxy(req, res, next);
  } else {
    // Route to Symfony (default/fallback)
    symfonyProxy(req, res, next);
  }
});

// Start the proxy server
app.listen(PROXY_PORT, () => {
  console.log('========================================');
  console.log('Strangler Fig Proxy Server Started');
  console.log('========================================');
  console.log(`Proxy listening on: http://localhost:${PROXY_PORT}`);
  console.log(`Symfony backend: ${SYMFONY_URL}`);
  console.log(`NestJS backend: ${NESTJS_URL}`);
  console.log('');
  console.log('Routes handled by NestJS:');
  NESTJS_ROUTES.forEach(route => {
    console.log(`  - ${route}`);
  });
  console.log('');
  console.log('All other routes: Symfony (fallback)');
  console.log('========================================');
});

// Handle graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT signal received: closing HTTP server');
  process.exit(0);
});