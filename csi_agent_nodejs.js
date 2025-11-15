# Project: AI Customer Sentiment Investigator (CSI) - Node.js

This repository contains a minimal, modular Node.js implementation of the multi-agent CSI system described in the capstone pitch. The code is intentionally structured to be easy to run locally and to extend for deployment.

---

## File layout (each file follows below)

- package.json
- README.md
- index.js                 # Entrypoint / Orchestrator
- /agents/sentimentAgent.js
- /agents/rootCauseAgent.js
- /agents/actionPlannerAgent.js
- /agents/emailResponderAgent.js
- /agents/escalationAgent.js
- /services/memoryBank.js
- /services/sessionService.js
- /tools/collector.js
- /tools/googleSearchTool.js        # stubbed tool (illustrative)
- /observability/logger.js
- /observability/metrics.js
- /evaluation/evaluate.js

---

### package.json
```json
{
  "name": "csi-agent-nodejs",
  "version": "0.1.0",
  "description": "Customer Sentiment Investigator - Node.js multi-agent example",
  "main": "index.js",
  "scripts": {
    "start": "node index.js",
    "eval": "node evaluation/evaluate.js"
  },
  "dependencies": {
    "express": "^4.18.2",
    "body-parser": "^1.20.2",
    "uuid": "^9.0.0",
    "node-fetch": "^3.4.1",
    "winston": "^3.8.2"
  },
  "engines": {
    "node": ">=18"
  }
}
```

---

### README.md
```markdown
# CSI Agent - Node.js

Minimal multi-agent example for the Kaggle/Google AI Agents Capstone.

## Run
1. Install: `npm install`
2. Start: `npm start`
3. POST feedback to `http://localhost:3000/ingest` with JSON: `{ "customer_id": "c123", "text": "My package arrived late and damaged" }`

## Files
See project layout. This is a scaffold — replace LLM calls with your preferred provider.
```

---

### index.js
```javascript
// Entry point: Orchestrator + simple HTTP ingestion
import express from 'express';
import bodyParser from 'body-parser';
import { v4 as uuidv4 } from 'uuid';
import { Collector } from './tools/collector.js';
import { Orchestrator } from './index.orchestrator.js';
import { Logger } from './observability/logger.js';

const app = express();
app.use(bodyParser.json());

const PORT = process.env.PORT || 3000;
const collector = new Collector();
const orchestrator = new Orchestrator();
const logger = new Logger();

app.post('/ingest', async (req, res) => {
  try {
    const payload = req.body;
    const item = await collector.collect(payload);
    // Orchestrator handles the multi-agent flow
    const result = await orchestrator.handleFeedback(item);
    res.json({ id: item.id, result });
  } catch (err) {
    logger.error('Ingest error', err);
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  logger.info(`CSI Agent running on http://localhost:${PORT}`);
});
```

---

### index.orchestrator.js
```javascript
// Orchestrator coordinates agents in sequence and in parallel
import { SentimentAgent } from './agents/sentimentAgent.js';
import { RootCauseAgent } from './agents/rootCauseAgent.js';
import { ActionPlannerAgent } from './agents/actionPlannerAgent.js';
import { EmailResponderAgent } from './agents/emailResponderAgent.js';
import { EscalationAgent } from './agents/escalationAgent.js';
import { MemoryBank } from './services/memoryBank.js';
import { SessionService } from './services/sessionService.js';
import { Logger } from './observability/logger.js';

export class Orchestrator {
  constructor() {
    this.sentiment = new SentimentAgent();
    this.rootCause = new RootCauseAgent();
    this.actionPlanner = new ActionPlannerAgent();
    this.emailResponder = new EmailResponderAgent();
    this.escalation = new EscalationAgent();
    this.memory = new MemoryBank();
    this.sessions = new SessionService();
    this.logger = new Logger();
  }

  async handleFeedback(item) {
    const session = this.sessions.getOrCreateSession(item.customer_id);
    this.logger.info('Orchestrator: starting handling', { id: item.id });

    // Step 1: Sentiment (LLM-powered)
    const sentimentResult = await this.sentiment.analyze(item.text, session);

    // Step 2: Root cause (parallel with other lightweight tasks)
    const rootCausePromise = this.rootCause.identify(item.text, session);

    // Step 3: Memory update
    await this.memory.addRecord(item.customer_id, { text: item.text, sentiment: sentimentResult });

    const rootCauseResult = await rootCausePromise;

    // Step 4: Decision making
    const actionPlan = await this.actionPlanner.plan({ sentiment: sentimentResult, rootCause: rootCauseResult, session });

    // Step 5: Escalation check (could run in parallel)
    const escalate = await this.escalation.check({ sentiment: sentimentResult, rootCause: rootCauseResult });

    // Step 6: Draft response
    const responseDraft = await this.emailResponder.draftReply({ text: item.text, sentiment: sentimentResult, actionPlan, session });

    // Step 7: persist session & return
    this.sessions.updateSession(session.id, { lastProcessed: new Date().toISOString() });

    const result = { sentiment: sentimentResult, rootCause: rootCauseResult, actionPlan, escalate, responseDraft };
    this.logger.info('Orchestrator: finished', { id: item.id, resultSummary: { sentiment: sentimentResult.label, escalate } });
    return result;
  }
}
```

---

### /tools/collector.js
```javascript
// Collector accepts incoming payloads and normalizes them
import { v4 as uuidv4 } from 'uuid';

export class Collector {
  async collect(payload) {
    // Basic validation
    if (!payload || !payload.text) throw new Error('Missing feedback text');
    return {
      id: payload.id || uuidv4(),
      customer_id: payload.customer_id || 'anonymous',
      text: payload.text,
      source: payload.source || 'api',
      received_at: new Date().toISOString()
    };
  }
}
```

---

### /agents/sentimentAgent.js
```javascript
// Sentiment agent - stubbed LLM integration
import { Logger } from '../observability/logger.js';

export class SentimentAgent {
  constructor() {
    this.logger = new Logger();
  }

  async analyze(text, session) {
    this.logger.info('SentimentAgent: analyzing text');
    // TODO: replace with real LLM call (e.g. OpenAI, Google Gemma) or local model
    // Simple heuristic stub for demo
    const lower = text.toLowerCase();
    let score = 0;
    if (lower.includes('not') || lower.includes('never') || lower.includes('bad') || lower.includes('late') || lower.includes('damag')) score -= 1;
    if (lower.includes('love') || lower.includes('great') || lower.includes('good') || lower.includes('thanks')) score += 1;

    const label = score < 0 ? 'negative' : (score > 0 ? 'positive' : 'neutral');
    const detail = { score, label };
    return detail;
  }
}
```

---

### /agents/rootCauseAgent.js
```javascript
import { Logger } from '../observability/logger.js';

export class RootCauseAgent {
  constructor() { this.logger = new Logger(); }

  async identify(text, session) {
    this.logger.info('RootCauseAgent: identifying root cause');
    // Heuristic rules - replace with LLM-based extraction for production
    const t = text.toLowerCase();
    if (t.includes('late') || t.includes('delivery') || t.includes('shipping')) return { cause: 'delivery', confidence: 0.85 };
    if (t.includes('damag') || t.includes('broken') || t.includes('scratch')) return { cause: 'product_quality', confidence: 0.9 };
    if (t.includes('refund') || t.includes('charge') || t.includes('billing')) return { cause: 'billing', confidence: 0.8 };
    return { cause: 'general_support', confidence: 0.6 };
  }
}
```

---

### /agents/actionPlannerAgent.js
```javascript
import { Logger } from '../observability/logger.js';

export class ActionPlannerAgent {
  constructor() { this.logger = new Logger(); }

  async plan({ sentiment, rootCause, session }) {
    this.logger.info('ActionPlanner: creating action plan');
    const actions = [];
    if (rootCause.cause === 'delivery') actions.push('offer_refund_or_redelivery');
    if (rootCause.cause === 'product_quality') actions.push('initiate_replacement');
    if (sentiment.label === 'negative') actions.push('priority_support_routing');
    if (session && session.pastEscalations && session.pastEscalations > 0) actions.push('apply_loyalty_compensation');

    return { actions, rationale: `Actions based on cause=${rootCause.cause} and sentiment=${sentiment.label}` };
  }
}
```

---

### /agents/emailResponderAgent.js
```javascript
import { Logger } from '../observability/logger.js';

export class EmailResponderAgent {
  constructor() { this.logger = new Logger(); }

  async draftReply({ text, sentiment, actionPlan, session }) {
    this.logger.info('EmailResponder: drafting reply');
    // For production, call LLM to craft personalized reply. This is a template.
    const opening = session && session.customer_name ? `Hi ${session.customer_name},` : 'Hello,';
    let body = '';
    if (sentiment.label === 'negative') {
      body += "We're sorry to hear about your experience. ";
    } else {
      body += "Thanks for the feedback! ";
    }

    body += `We detected the issue as: ${actionPlan.rationale}. Our recommended actions: ${actionPlan.actions.join(', ')}.`;
    body += ' We will follow up within 48 hours.';

    return { subject: 'Response from Acme Support', body, tone: sentiment.label };
  }
}
```

---

### /agents/escalationAgent.js
```javascript
import { Logger } from '../observability/logger.js';

export class EscalationAgent {
  constructor() { this.logger = new Logger(); }

  async check({ sentiment, rootCause }) {
    this.logger.info('EscalationAgent: checking rules');
    // Example rules
    if (sentiment.label === 'negative' && rootCause.confidence > 0.8) return { escalate: true, reason: 'high_confidence_negative' };
    if (rootCause.cause === 'billing' && sentiment.label === 'negative') return { escalate: true, reason: 'billing_issue' };
    return { escalate: false };
  }
}
```

---

### /services/memoryBank.js
```javascript
// Very small in-memory memory bank for demo. Replace with DB in prod.
export class MemoryBank {
  constructor() {
    this.store = new Map();
  }

  async addRecord(customerId, record) {
    if (!this.store.has(customerId)) this.store.set(customerId, []);
    this.store.get(customerId).push({ ...record, ts: new Date().toISOString() });
  }

  async getRecords(customerId) {
    return this.store.get(customerId) || [];
  }
}
```

---

### /services/sessionService.js
```javascript
import { v4 as uuidv4 } from 'uuid';

export class SessionService {
  constructor() {
    this.sessions = new Map();
  }

  getOrCreateSession(customerId) {
    if (this.sessions.has(customerId)) return this.sessions.get(customerId);
    const s = { id: customerId, createdAt: new Date().toISOString(), pastEscalations: 0, customer_name: null };
    this.sessions.set(customerId, s);
    return s;
  }

  updateSession(id, patch) {
    const s = this.sessions.get(id) || { id };
    Object.assign(s, patch);
    this.sessions.set(id, s);
    return s;
  }
}
```

---

### /tools/googleSearchTool.js
```javascript
// Simple illustrative search tool stub. Replace with Google Search integration if allowed.
import fetch from 'node-fetch';

export class GoogleSearchTool {
  constructor(apiKey) { this.apiKey = apiKey; }

  async search(query) {
    // For privacy and simplicity, this is a stub. Implement your search provider here.
    return { query, results: [] };
  }
}
```

---

### /observability/logger.js
```javascript
import winston from 'winston';

export class Logger {
  constructor() {
    if (!Logger.instance) {
      this.logger = winston.createLogger({
        level: 'info',
        transports: [new winston.transports.Console({ format: winston.format.simple() })]
      });
      Logger.instance = this;
    }
    return Logger.instance;
  }

  info(msg, meta) { this.logger.info(msg, meta || {}); }
  error(msg, meta) { this.logger.error(msg, meta || {}); }
}
```

---

### /observability/metrics.js
```javascript
// Small metrics collector
export class Metrics {
  constructor() { this.data = { processed: 0, escalations: 0 }; }
  incr(key) { if (!this.data[key]) this.data[key] = 0; this.data[key]++; }
  get() { return this.data; }
}
```

---

### /evaluation/evaluate.js
```javascript
// Simple evaluation harness: feed labeled examples and compute basic accuracy for sentiment
import fs from 'fs';
import path from 'path';
import { SentimentAgent } from '../agents/sentimentAgent.js';

const examples = [
  { text: 'I love this product, it works great', label: 'positive' },
  { text: 'Package was late and damaged', label: 'negative' },
  { text: 'okay, nothing special', label: 'neutral' }
];

(async () => {
  const sa = new SentimentAgent();
  let correct = 0;
  for (const e of examples) {
    const r = await sa.analyze(e.text, {});
    if (r.label === e.label) correct++;
    console.log(e.text, '=>', r);
  }
  console.log(`Accuracy: ${correct}/${examples.length}`);
})();
```

---

## Notes & Next steps
- Replace heuristic agents with LLM calls (e.g. call an LLM from sentimentAgent.js and rootCauseAgent.js). Keep prompts focused and add evaluation harness.
- Add persistent storage (e.g. PostgreSQL) and a proper memory bank for long-term memory.
- Hook in observability exporters (Prometheus, Stackdriver) for production.



