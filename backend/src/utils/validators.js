function validateQuery(req, res, next) {
  const { query } = req.body;
  
  if (!query) {
    return res.status(400).json({ error: 'Query is required' });
  }
  
  if (typeof query !== 'string') {
    return res.status(400).json({ error: 'Query must be a string' });
  }
  
  if (query.length < 3) {
    return res.status(400).json({ error: 'Query must be at least 3 characters' });
  }
  
  if (query.length > 1000) {
    return res.status(400).json({ error: 'Query too long (max 1000 characters)' });
  }
  
  // PII detection and reporting (not removal)
  req.piiReport = detectPII(query);
  
  next();
}

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
        examples: matches.slice(0, 2)
      });
      totalCount += matches.length;
    }
  }

  return {
    detected: detected.length > 0,
    types: detected.map(d => d.type),
    count: totalCount,
    details: detected
  };
}

module.exports = { validateQuery, detectPII };
