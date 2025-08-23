const express = require('express');
const router = express.Router();

router.get('/status', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: '1.0.0',
    environment: process.env.NODE_ENV || 'development'
  });
});

router.get('/detailed', async (req, res) => {
  // Import orchestrator only when needed to avoid circular deps
  const { AgentOrchestrator } = require('../agents/orchestrator');
  const orchestrator = new AgentOrchestrator();
  
  try {
    const health = await orchestrator.healthCheck();
    res.json(health);
  } catch (error) {
    res.status(500).json({ status: 'error', error: error.message });
  }
});

module.exports = { healthRoutes: router };
