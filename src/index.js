/**
 * index.js
 * Entry point — wires up Express, routes, error handling, and Swagger UI.
 */

import express  from 'express';
import cors     from 'cors';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join }  from 'path';
import swaggerUi from 'swagger-ui-express';

import metersRouter       from './routes/meters.js';
import transformersRouter from './routes/transformers.js';
import hierarchyRouter    from './routes/hierarchy.js';
import { getAuth }       from './auth.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT ?? 3000;

const app = express();

// ---------------------------------------------------------------------------
// Middleware
// ---------------------------------------------------------------------------
app.use(cors());
app.use(express.json());

// Request logger
app.use((req, _res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// ---------------------------------------------------------------------------
// API routes
// ---------------------------------------------------------------------------
app.use('/api/meters',       metersRouter);
app.use('/api/transformers', transformersRouter);
app.use('/api/hierarchy',    hierarchyRouter);

// Health check
app.get('/health', (_req, res) => res.json({ status: 'ok' }));

// ---------------------------------------------------------------------------
// Swagger UI — served at /docs
// ---------------------------------------------------------------------------
try {
  const spec = JSON.parse(
    readFileSync(join(__dirname, '..', 'openapi.json'), 'utf8')
  );
  app.use('/docs', swaggerUi.serve, swaggerUi.setup(spec));
  console.log(`[docs] Swagger UI available at http://localhost:${PORT}/docs`);
} catch {
  console.warn('[docs] openapi.json not found — /docs will not be available');
}

// ---------------------------------------------------------------------------
// Error handler
// ---------------------------------------------------------------------------
app.use((err, _req, res, _next) => {
  console.error('[error]', err.message);
  res.status(502).json({ error: err.message });
});

// ---------------------------------------------------------------------------
// Start — pre-warm auth token so first request is fast
// ---------------------------------------------------------------------------
app.listen(PORT, async () => {
  console.log(`[server] Urja API listening on http://localhost:${PORT}`);
  try {
    await getAuth();
  } catch (err) {
    console.warn('[auth] Pre-warm login failed:', err.message);
  }
});
