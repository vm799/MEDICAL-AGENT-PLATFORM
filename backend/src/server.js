const express = require('express');
const cors = require('cors');
const helmet = require('helmet');

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
app.use(cors());
app.use(express.json({ limit: '1mb' }));

// PII detection middleware (reports but doesn't remove)
app.use((req, res, next) => {
  if (req.body && req.body.query) {
    const piiReport = detectPII(req.body.query);
    if (piiReport.found) {
      // Log PII detection for compliance monitoring
      console.warn('⚠️  PII DETECTED:', {
        timestamp: new Date().toISOString(),
        endpoint: req.path,
        piiTypes: piiReport.types,
        piiCount: piiReport.count,
        clientIP: req.ip,
        userAgent: req.get('User-Agent')
      });
      
      // Add PII report to request for downstream processing
      req.piiReport = piiReport;
    }
  }
  next();
});

// Health check routes
app.get('/api/health/status', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: '1.0.0'
  });
});

// Basic test route
app.get('/', (req, res) => {
  res.json({ 
    message: 'Medical Agent Platform API',
    version: '1.0.0',
    endpoints: ['/api/health/status', '/api/medical/query'],
    piiPolicy: 'PII detected and reported but preserved for processing'
  });
});

// Temporary medical query endpoint (will be replaced with full agent)
app.post('/api/medical/query', async (req, res) => {
  try {
    const { query } = req.body;
    
    if (!query || typeof query !== 'string' || query.length < 3) {
      return res.status(400).json({ error: 'Query must be at least 3 characters' });
    }

    // Simple test response for now
    const response = {
      query,
      decision: {
        useExternal: true,
        externalSources: ['pubmed'],
        reasoning: 'Test mode - basic response',
        confidence: 0.5
      },
      results: {
        pubmed: {
          source: 'PubMed',
          count: 1,
          data: [{
            pmid: 'test123',
            title: `Test result for: ${query}`,
            authors: 'Test Author',
            journal: 'Test Journal',
            url: 'https://pubmed.ncbi.nlm.nih.gov/test123/'
          }]
        }
      },
      synthesis: `This is a test response for your query: "${query}". The system is working correctly.`,
      timestamp: new Date().toISOString()
    };

    // Include PII report in response if PII was detected
    if (req.piiReport && req.piiReport.found) {
      response.piiReport = {
        detected: true,
        types: req.piiReport.types,
        count: req.piiReport.count,
        message: 'PII detected in query - logged for compliance review',
        recommendation: 'Consider using anonymized data for better privacy protection'
      };
    } else {
      response.piiReport = {
        detected: false,
        message: 'No PII detected in query'
      };
    }

    res.json(response);

  } catch (error) {
    console.error('Query processing error:', error);
    res.status(500).json({ error: 'Query processing failed' });
  }
});

// PII audit report endpoint
app.get('/api/compliance/pii-report', (req, res) => {
  // In production, this would query actual audit logs
  res.json({
    message: 'PII Detection Report',
    period: 'Last 24 hours',
    totalQueries: 0, // Would be actual count
    queriesWithPII: 0, // Would be actual count
    piiTypes: {
      email: 0,
      ssn: 0,
      phone: 0,
      creditCard: 0
    },
    lastUpdated: new Date().toISOString(),
    note: 'This is a mock endpoint - implement with actual audit log storage'
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({ 
    error: 'Internal server error', 
    id: generateErrorId() 
  });
});

// PII detection function (detects but doesn't remove)
function detectPII(text) {
  const piiPatterns = {
    email: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
    ssn: /\b\d{3}-?\d{2}-?\d{4}\b/g,
    phone: /\b\d{3}-?\d{3}-?\d{4}\b/g,
    creditCard: /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g
  };

  const detected = [];
  let totalCount = 0;

  for (const [type, pattern] of Object.entries(piiPatterns)) {
    const matches = text.match(pattern);
    if (matches) {
      detected.push({
        type,
        count: matches.length,
        examples: matches.slice(0, 2) // First 2 examples for logging
      });
      totalCount += matches.length;
    }
  }

  return {
    found: detected.length > 0,
    types: detected.map(d => d.type),
    count: totalCount,
    details: detected
  };
}

function generateErrorId() {
  return Math.random().toString(36).substr(2, 9);
}

app.listen(port, () => {
  console.log(`🏥 Medical Agent Platform running on port ${port}`);
  console.log(`📍 Health check: http://localhost:${port}/api/health/status`);
  console.log(`🔍 Test query: curl -X POST http://localhost:${port}/api/medical/query -H "Content-Type: application/json" -d '{"query":"test"}'`);
  console.log(`📊 PII Report: http://localhost:${port}/api/compliance/pii-report`);
});
