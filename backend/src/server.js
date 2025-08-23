const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { medicalRoutes } = require('./routes/medical');
const { healthRoutes } = require('./routes/health');
const { detectPII } = require('./utils/validators');

const app = express();
const port = process.env.PORT || 8080;

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"]
    }
  }
}));

app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? ['https://your-domain.com'] 
    : ['http://localhost:3000', 'http://127.0.0.1:3000'],
  credentials: true
}));

app.use(express.json({ limit: '1mb' }));

// Request logging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
  next();
});

// PII detection middleware (reports but preserves)
app.use((req, res, next) => {
  if (req.body && req.body.query) {
    const piiReport = detectPII(req.body.query);
    if (piiReport.detected) {
      console.warn('⚠️  PII DETECTED:', {
        timestamp: new Date().toISOString(),
        endpoint: req.path,
        piiTypes: piiReport.types,
        piiCount: piiReport.count,
        clientIP: req.ip
      });
      req.piiReport = piiReport;
    }
  }
  next();
});

// Routes
app.use('/api/health', healthRoutes);
app.use('/api/medical', medicalRoutes);

// Serve frontend in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static('../frontend/public'));
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/public/index.html'));
  });
}

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ 
    error: 'Endpoint not found',
    availableEndpoints: [
      'GET /api/health/status',
      'POST /api/medical/query',
      'GET /api/medical/sources'
    ]
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Global error:', err);
  res.status(500).json({ 
    error: 'Internal server error',
    requestId: `error_${Date.now()}`,
    timestamp: new Date().toISOString()
  });
});

const server = app.listen(port, '0.0.0.0', () => {
  console.log(`🏥 Medical Agent Platform running on port ${port}`);
  console.log(`📍 Health: http://localhost:${port}/api/health/status`);
  console.log(`🔍 Query: POST http://localhost:${port}/api/medical/query`);
  console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('Process terminated');
    process.exit(0);
  });
});
