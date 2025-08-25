const express = require('express');
const cors = require('cors');
const helmet = require('helmet');

console.log('🔄 Starting Medical Agent Platform...');

const app = express();
const port = process.env.PORT || 8080;

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '1mb' }));

// Basic health check
app.get('/api/health/status', (req, res) => {
  console.log('Health check requested');
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: '1.0.0',
    message: 'Medical Agent Platform is running'
  });
});

// Basic root route
app.get('/', (req, res) => {
  res.json({
    message: 'Medical Agent Platform API',
    version: '1.0.0',
    endpoints: ['/api/health/status', '/api/medical/query']
  });
});

// Placeholder medical query endpoint
app.post('/api/medical/query', (req, res) => {
  const { query } = req.body;
  
  if (!query) {
    return res.status(400).json({ error: 'Query is required' });
  }

  console.log(`Received query: ${query}`);

  // Mock response for now
  res.json({
    query,
    decision: {
      intent: 'medical_research',
      confidence: 0.8,
      reasoning: 'Mock response - server is working'
    },
    results: {
      pubmed: {
        source: 'PubMed',
        count: 3,
        data: [{
          title: `Mock result for: ${query}`,
          authors: 'Test Author',
          journal: 'Test Journal'
        }]
      }
    },
    synthesis: `This is a test response for your query: "${query}". The server is working correctly!`,
    timestamp: new Date().toISOString()
  });
});

// Error handling
app.use((err, req, res, next) => {
  console.error('❌ Server Error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
const server = app.listen(port, '0.0.0.0', () => {
  console.log('');
  console.log('🏥 ================================');
  console.log('   Medical Agent Platform Started');
  console.log('🏥 ================================');
  console.log(`📍 Server: http://localhost:${port}`);
  console.log(`🔍 Health: http://localhost:${port}/api/health/status`);
  console.log(`💊 Query:  POST http://localhost:${port}/api/medical/query`);
  console.log('');
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('🛑 SIGTERM received, shutting down gracefully');
  server.close(() => {
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('🛑 SIGINT received, shutting down gracefully');  
  server.close(() => {
    process.exit(0);
  });
});

module.exports = app;
