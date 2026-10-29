/**
 * routes/transformers.js
 *
 * GET /api/transformers        — paginated list of distribution transformers
 * GET /api/transformers/:id    — single transformer detail
 */

import { Router } from 'express';
import { portalGet } from '../client.js';
import { decode } from '../decode.js';

const router = Router();

/**
 * GET /api/transformers
 * Query params:
 *   page (number) page number (default: 1)
 *
 * Proxies /portal/dts?page=
 */
router.get('/', async (req, res, next) => {
  try {
    const page = req.query.page ?? '1';
    const raw  = await portalGet(`/portal/dts?page=${page}`);

    res.json({
      total:      raw.total      ?? raw.dts?.length ?? 0,
      page:       Number(raw.page ?? page),
      totalPages: raw.totalPages ?? 1,
      transformers: (raw.dts ?? raw.transformers ?? []).map(normaliseDT),
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/transformers/:id
 * Returns detail for a single distribution transformer.
 * Uses the SvelteKit __data.json endpoint.
 */
router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const raw     = await portalGet(`/transformers/${encodeURIComponent(id)}/__data.json`);
    const decoded = decode(raw);

    if (!decoded) {
      return res.status(404).json({ error: 'Transformer not found', id });
    }

    res.json(normaliseTransformerDetail(decoded));
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// Normalisers
// ---------------------------------------------------------------------------

function normaliseDT(dt) {
  return {
    id:           dt.code        ?? dt.dtCode ?? dt.id,
    name:         dt.name,
    feeder:       dt.feederCode  ?? dt.feeder,
    capacityKva:  dt.capacityKva ?? dt.capacity_kva ?? dt.capacity,
  };
}

function normaliseTransformerDetail(d) {
  return {
    id:          d.code ?? d.dtCode ?? d.id,
    name:        d.name,
    feeder:      d.feeder,
    capacityKva: d.capacityKva ?? d.capacity,
    meters:      Array.isArray(d.meters) ? d.meters : [],
  };
}

export default router;
