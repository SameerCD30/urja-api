/**
 * routes/hierarchy.js
 *
 * GET /api/hierarchy
 * Reconstructs the full network tree from the bulk meter export.
 *
 * Tree shape:
 *   Zone → Circle → Division → Subdivision → Substation → Feeder → DT → Meters
 *
 * This endpoint answers in one shot the question the portal itself cannot:
 * "Give me the entire network structure."
 *
 * Trade-off: this calls /portal/meters/export on every request (403 meters,
 * ~360 KB). With more time, this would be cached with a TTL.
 */

import { Router } from 'express';
import { portalGet } from '../client.js';

const router = Router();

router.get('/', async (req, res, next) => {
  try {
    const raw = await portalGet('/portal/meters/export');
    if (!Array.isArray(raw)) {
      return res.status(502).json({ error: 'Unexpected response from portal export' });
    }

    res.json(buildTree(raw));
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// Tree builder
// ---------------------------------------------------------------------------

/**
 * Builds a nested hierarchy from the flat meter export array.
 * Each level is keyed by code and contains a `children` or `meters` array.
 */
function buildTree(meters) {
  // Use Maps for O(1) lookup while building
  const zones = new Map();

  for (const meter of meters) {
    const h  = meter.hierarchy;
    if (!h) continue;

    const zoneKey = h.zone?.code;
    if (!zones.has(zoneKey)) {
      zones.set(zoneKey, { code: h.zone.code, name: h.zone.name, circles: new Map() });
    }
    const zone = zones.get(zoneKey);

    const circleKey = h.circle?.code;
    if (!zone.circles.has(circleKey)) {
      zone.circles.set(circleKey, { code: h.circle.code, name: h.circle.name, divisions: new Map() });
    }
    const circle = zone.circles.get(circleKey);

    const divKey = h.division?.code;
    if (!circle.divisions.has(divKey)) {
      circle.divisions.set(divKey, { code: h.division.code, name: h.division.name, subdivisions: new Map() });
    }
    const division = circle.divisions.get(divKey);

    const subDivKey = h.subdivision?.code;
    if (!division.subdivisions.has(subDivKey)) {
      division.subdivisions.set(subDivKey, { code: h.subdivision.code, name: h.subdivision.name, substations: new Map() });
    }
    const subdivision = division.subdivisions.get(subDivKey);

    const ssKey = h.substation?.code;
    if (!subdivision.substations.has(ssKey)) {
      subdivision.substations.set(ssKey, { code: h.substation.code, name: h.substation.name, feeders: new Map() });
    }
    const substation = subdivision.substations.get(ssKey);

    const feederKey = h.feeder?.code;
    if (!substation.feeders.has(feederKey)) {
      substation.feeders.set(feederKey, { code: h.feeder.code, name: h.feeder.name, transformers: new Map() });
    }
    const feeder = substation.feeders.get(feederKey);

    const dtKey = h.dt?.code;
    if (!feeder.transformers.has(dtKey)) {
      feeder.transformers.set(dtKey, { code: h.dt.code, name: h.dt.name, meters: [] });
    }
    const dt = feeder.transformers.get(dtKey);

    dt.meters.push({
      id:     meter.meterId,
      serial: meter.serialNo,
      make:   meter.make,
      phase:  meter.phaseType,
      status: meter.installStatus,
      geo:    meter.geo ?? null,
    });
  }

  // Serialise Maps to plain arrays for JSON output
  return {
    zones: [...zones.values()].map(z => ({
      ...z,
      circles: [...z.circles.values()].map(c => ({
        ...c,
        divisions: [...c.divisions.values()].map(d => ({
          ...d,
          subdivisions: [...d.subdivisions.values()].map(sd => ({
            ...sd,
            substations: [...sd.substations.values()].map(ss => ({
              ...ss,
              feeders: [...ss.feeders.values()].map(f => ({
                ...f,
                transformers: [...f.transformers.values()],
              })),
            })),
          })),
        })),
      })),
    })),
  };
}

export default router;
