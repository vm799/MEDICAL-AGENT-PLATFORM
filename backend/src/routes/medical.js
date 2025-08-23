// backend/src/routes/medical.js
const express = require('express');
const { AgentOrchestrator } = require('../agents/orchestrator');
const { validateQuery } = require('../utils/validators');

const router = express.Router();
const orchestrator = new AgentOrchestrator();

// Main query endpoint
router.post('/query', validateQuery, async (req, res) => {
  const startTime = Date.now();
  
  try {
    const { query } = req.body;
    const context = {
      startTime,
      userAgent: req.get('User-Agent'),
      clientIP: req.ip
    };

    const result = await orchestrator.processQuery(query, context);
    
    // Add request metadata
    result.metadata = {
      ...result.metadata,
      requestId: result.requestId,
      processingTimeMs: result.processingTimeMs,
      piiReport: req.piiReport || { detected: false }
    };
    
    res.json(result);
    
  } catch (error) {
    console.error('Query endpoint error:', error);
    res.status(500).json({ 
      error: 'Query processing failed',
      requestId: `error_${Date.now()}`,
      timestamp: new Date().toISOString()
    });
  }
});

// Batch query endpoint for high-volume processing
router.post('/batch', validateQuery, async (req, res) => {
  try {
    const { queries, options = {} } = req.body;
    
    if (!Array.isArray(queries) || queries.length === 0) {
      return res.status(400).json({ error: 'Queries array is required' });
    }
    
    if (queries.length > 100) {
      return res.status(400).json({ error: 'Maximum 100 queries per batch' });
    }

    const batchResult = await orchestrator.processBatch(queries, options);
    res.json(batchResult);
    
  } catch (error) {
    console.error('Batch endpoint error:', error);
    res.status(500).json({ error: 'Batch processing failed' });
  }
});

// Get available sources
router.get('/sources', async (req, res) => {
  try {
    const sources = [
      { 
        id: 'clinicaltrials', 
        name: 'ClinicalTrials.gov', 
        type: 'external',
        description: 'Clinical trial database with 400,000+ studies',
        rateLimit: '50 requests/minute',
        status: 'active'
      },
      { 
        id: 'pubmed', 
        name: 'PubMed', 
        type: 'external',
        description: 'Biomedical literature database with 35M+ articles',
        rateLimit: '3 requests/second',
        status: 'active'
      },
      { 
        id: 'openfda', 
        name: 'OpenFDA', 
        type: 'external',
        description: 'FDA drug labels and safety information',
        rateLimit: '240 requests/minute',
        status: 'active'
      }
    ];
    
    // Add real-time health status
    const healthCheck = await orchestrator.healthCheck();
    sources.forEach(source => {
      const health = healthCheck.services?.externalAPIs?.sources?.[source.id];
      if (health) {
        source.status = health.status;
        source.lastChecked = health.timestamp;
      }
    });
    
    res.json({
      sources,
      lastUpdated: new Date().toISOString(),
      totalSources: sources.length
    });
    
  } catch (error) {
    console.error('Sources endpoint error:', error);
    res.status(500).json({ error: 'Failed to retrieve sources' });
  }
});

// Agent decision explanation
router.post('/explain', validateQuery, async (req, res) => {
  try {
    const { query } = req.body;
    
    const decision = await orchestrator.decisionAgent.decide(query);
    const explanation = orchestrator.decisionAgent.explainDecision(decision, query);
    
    res.json(explanation);
    
  } catch (error) {
    console.error('Explain endpoint error:', error);
    res.status(500).json({ error: 'Decision explanation failed' });
  }
});

module.exports = { medicalRoutes: router };