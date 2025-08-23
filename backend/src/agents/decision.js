class DecisionAgent {
  constructor() {
    this.patterns = {
      specificIdentifiers: {
        nct: /\b(NCT\d{8})\b/i,
        pmid: /\b(PMID:?\s*\d+|PMC\d+)\b/i,
        doi: /\b(10\.\d{4,}\/[^\s]+)\b/i,
        fda: /\b(NDA\s*\d+|ANDA\s*\d+|BLA\s*\d+)\b/i
      },
      
      domains: {
        clinicalTrial: {
          patterns: [
            /\b(clinical trial|study protocol|NCT\d{8})\b/i,
            /\b(phase\s*[I|II|III|1|2|3]|recruitment|enrollment)\b/i,
            /\b(randomized|controlled|placebo|double.blind)\b/i
          ],
          sources: ['clinicaltrials', 'pubmed'],
          confidence: 0.85
        },
        
        drugSafety: {
          patterns: [
            /\b(side effect|adverse event|safety|toxicity)\b/i,
            /\b(FDA\s*(approval|warning|recall))\b/i,
            /\b(contraindication|black box|warning)\b/i
          ],
          sources: ['openfda', 'pubmed'],
          confidence: 0.9
        },
        
        drugInfo: {
          patterns: [
            /\b(drug|medication|pharmaceutical|therapeutic)\b/i,
            /\b(dosage|administration|indication|mechanism)\b/i,
            /\b(prescription|over.the.counter|OTC)\b/i
          ],
          sources: ['openfda', 'pubmed', 'clinicaltrials'],
          confidence: 0.8
        },
        
        literatureReview: {
          patterns: [
            /\b(meta.analysis|systematic review|literature)\b/i,
            /\b(research|study|investigation|analysis)\b/i,
            /\b(evidence|findings|results|outcomes)\b/i
          ],
          sources: ['pubmed'],
          confidence: 0.75
        }
      }
    };
  }

  async decide(query, context = {}) {
    const startTime = Date.now();
    
    const decision = {
      useDocuments: false,
      useExternal: true,
      documentQuery: '',
      externalSources: [],
      intent: 'general_medical',
      confidence: 0.5,
      reasoning: '',
      processingTimeMs: 0
    };

    // Check for specific identifiers
    const specificMatch = this.checkSpecificIdentifiers(query);
    if (specificMatch.found) {
      decision.useExternal = true;
      decision.externalSources = specificMatch.sources;
      decision.intent = specificMatch.type;
      decision.confidence = 0.95;
      decision.reasoning = `Specific identifier detected: ${specificMatch.identifier}`;
      decision.processingTimeMs = Date.now() - startTime;
      return decision;
    }

    // Domain classification
    const domainMatch = this.classifyDomain(query);
    if (domainMatch.domain) {
      decision.useExternal = true;
      decision.externalSources = domainMatch.sources;
      decision.intent = domainMatch.domain;
      decision.confidence = domainMatch.confidence;
      decision.reasoning = `Classified as ${domainMatch.domain} query`;
      decision.processingTimeMs = Date.now() - startTime;
      return decision;
    }

    // Fallback
    decision.useExternal = true;
    decision.externalSources = ['pubmed'];
    decision.confidence = 0.6;
    decision.reasoning = 'General medical query, defaulting to literature search';
    decision.processingTimeMs = Date.now() - startTime;
    
    return decision;
  }

  checkSpecificIdentifiers(query) {
    const result = { found: false, identifier: '', type: '', sources: [] };
    
    const nctMatch = query.match(this.patterns.specificIdentifiers.nct);
    if (nctMatch) {
      result.found = true;
      result.identifier = nctMatch[0];
      result.type = 'clinical_trial_lookup';
      result.sources = ['clinicaltrials', 'pubmed'];
      return result;
    }

    const pmidMatch = query.match(this.patterns.specificIdentifiers.pmid);
    if (pmidMatch) {
      result.found = true;
      result.identifier = pmidMatch[0];
      result.type = 'literature_lookup';
      result.sources = ['pubmed'];
      return result;
    }

    return result;
  }

  classifyDomain(query) {
    const result = { domain: null, sources: [], confidence: 0 };
    
    let bestMatch = null;
    let bestScore = 0;
    
    Object.entries(this.patterns.domains).forEach(([domain, config]) => {
      const matchScore = this.calculateDomainScore(query, config.patterns);
      
      if (matchScore > bestScore) {
        bestScore = matchScore;
        bestMatch = {
          domain,
          sources: config.sources,
          confidence: config.confidence * matchScore
        };
      }
    });

    if (bestMatch && bestScore > 0.3) {
      result.domain = bestMatch.domain;
      result.sources = bestMatch.sources;
      result.confidence = bestMatch.confidence;
    }

    return result;
  }

  calculateDomainScore(query, patterns) {
    let score = 0;
    const queryLower = query.toLowerCase();
    
    patterns.forEach(pattern => {
      if (pattern.test(queryLower)) {
        score += 0.4;
      }
    });
    
    return Math.min(score, 1.0);
  }
}

module.exports = { DecisionAgent };
