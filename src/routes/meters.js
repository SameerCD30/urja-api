/**
 * routes/meters.js
 *
 * GET /api/meters          — paginated list with optional search
 * GET /api/meters/all      — full dataset (all 403 meters) in one shot
 * GET /api/meters/:id      — single meter detail with full hierarchy
 */

import { Router } from 'express';
import { portalGet } from '../client.js';
import { decode } from '../decode.js';

const router = Router();

/**
 * GET /api/meters
 * Query params:
 *   q    (string)  search by meter number or serial (default: '')
 *   page (number)  page number (default: 1)
 *
 * Proxies /portal/meters/search?q=&page= and normalises the response.
 */
router.get('/', async (req, res, next) => {
  try {
    const q    = req.query.q    ?? '';
    const page = req.query.page ?? '1';

    const raw = await portalGet(
      `/portal/meters/search?q=${encodeURIComponent(q)}&page=${page}`
    );

    // Portal returns { meters: [...], total: n, page: n, totalPages: n }
    res.json({
      total:      raw.total      ?? raw.meters?.length ?? 0,
      page:       Number(raw.page ?? page),
      totalPages: raw.totalPages ?? 1,
      meters:     (raw.meters ?? []).map(normaliseMeter),
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/meters/all
 * Returns every meter in one response using the bulk export endpoint.
 * Includes geo coordinates and full hierarchy — great for maps and queries.
 */
router.get('/all', async (req, res, next) => {
  try {
    const raw = await portalGet('/portal/meters/export');
    // Export returns a flat JSON array
    const meters = Array.isArray(raw) ? raw.map(normaliseExportMeter) : [];
    res.json({ total: meters.length, meters });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/meters/:id
 * Returns full detail for a single meter including hierarchy.
 * Uses the SvelteKit __data.json endpoint which includes more fields
 * than the search list.
 */
router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const raw = await portalGet(`/meters/${encodeURIComponent(id)}/__data.json`);
    const decoded = decode(raw);

    if (!decoded || !decoded.meterId) {
      return res.status(404).json({ error: 'Meter not found', meterId: id });
    }

    res.json(normaliseMeterDetail(decoded));
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// Normalisers — convert portal field names to consistent camelCase output
// ---------------------------------------------------------------------------

/** Normalises a meter from the search/list endpoint */
function normaliseMeter(m) {
  return {
    id:     m.meterId   ?? m.meter_id   ?? m.id,
    serial: m.serialNo  ?? m.serial_no  ?? m.serial,
    make:   m.make,
    phase:  m.phaseType ?? m.phase_type ?? m.phase,
    status: m.installStatus ?? m.status,
    dt:     m.dtCode    ?? m.dt_code    ?? m.dt,
  };
}

/** Normalises a meter from the bulk export endpoint (richer shape) */
function normaliseExportMeter(m) {
  return {
    id:              m.meterId,
    serial:          m.serialNo,
    make:            m.make,
    phase:           m.phaseType,
    status:          m.installStatus,
    installType:     m.installType,
    build:           m.build,
    dt:              m.dtCode,
    hierarchy: m.hierarchy ?? null,
    geo:       m.geo       ?? null,
  };
}

/** Normalises the richer single-meter response from __data.json */
function normaliseMeterDetail(d) {
  // The decoded shape has a nested `detail` array of { parameterName, parameterValue }
  // and a `hierarchy` object. We flatten both.
  const detail = {};
  if (Array.isArray(d.detail)) {
    for (const param of d.detail) {
      if (param?.parameterName && param?.parameterValue !== undefined) {
        detail[param.parameterName] = param.parameterValue;
      }
    }
  }

  return {
    id:        d.meterId,
    serial:    detail['Serial No']          ?? null,
    make:      detail['Make']               ?? null,
    phase:     detail['Phase Type']         ?? null,
    status:    detail['Installation Status']?? null,
    installType: detail['Installation Type']?? null,
    hierarchy: d.hierarchy ?? null,
    raw_detail: detail,
  };
}

export default router;
