# Urja Meter Ops — API Service

A clean, documented REST API over the [Urja Meter Ops](https://urja-ops.flockenergy.tech) legacy portal.

The portal has no public API. This service reverse-engineers its internals and exposes the data through a well-structured REST interface that any engineer or program can consume without ever touching the original portal.

---

## What's Built

| Endpoint | Description |
|---|---|
| `GET /api/meters` | Paginated meter list with optional search |
| `GET /api/meters/all` | All 403 meters in one shot (with geo + full hierarchy) |
| `GET /api/meters/:id` | Single meter detail |
| `GET /api/transformers` | Paginated distribution transformer list |
| `GET /api/transformers/:id` | Single transformer detail |
| `GET /api/hierarchy` | Full network tree (Zone → Circle → ... → DT → Meters) |
| `GET /health` | Service health check |
| `GET /docs` | Swagger UI (interactive API explorer) |

---

## How It Works

```
Your Client → This API (Express) → Urja Portal (SvelteKit)
```

1. On startup, the service logs into the portal using `better-auth` and caches a bearer token.
2. Incoming API requests are translated into the appropriate portal endpoint calls.
3. Responses are decoded (SvelteKit uses a compact index-reference format) and normalised into clean JSON.
4. On token expiry (401), the service re-authenticates automatically and retries.

---

## Project Structure

```
urja-api/
├── src/
│   ├── index.js          ← Express server entry point
│   ├── auth.js           ← Login + bearer token management
│   ├── client.js         ← Authenticated fetch wrapper with auto-retry
│   ├── decode.js         ← SvelteKit __data.json decoder
│   └── routes/
│       ├── meters.js     ← /api/meters endpoints
│       ├── transformers.js ← /api/transformers endpoints
│       └── hierarchy.js  ← /api/hierarchy endpoint
├── openapi.json          ← OpenAPI 3.1 spec
├── PROTOCOL.md           ← How the portal works (reverse-engineering notes)
└── README.md             ← This file
```

---

## Install & Run

**Requirements:** Node.js 18+ (uses native `fetch`)

```bash
# 1. Clone and install
git clone <your-repo-url>
cd urja-api
npm install

# 2. Run (credentials are hardcoded as defaults — no config needed)
npm start

# Or with auto-reload during development
npm run dev
```

The server starts on **http://localhost:3000**.

### Optional — Environment Variables

```bash
PORT=3000                                          # default: 3000
PORTAL_BASE=https://urja-ops.flockenergy.tech     # default: as shown
PORTAL_EMAIL=operator@urja.local                  # default: as shown
PORTAL_PASSWORD=urja-ops-2026                     # default: as shown
```

---

## Sample Requests

### List meters (with search)
```bash
curl http://localhost:3000/api/meters?q=J1000&page=1
```
```json
{
  "total": 403,
  "page": 1,
  "totalPages": 3,
  "meters": [
    {
      "id": "J100001",
      "serial": "GE84132",
      "make": "L&T",
      "phase": "single",
      "status": "Installed",
      "dt": "DT-002"
    }
  ]
}
```

### Get a single meter
```bash
curl http://localhost:3000/api/meters/J100001
```
```json
{
  "id": "J100001",
  "serial": "GE84132",
  "make": "L&T",
  "phase": "single",
  "status": "Installed",
  "installType": "CT Operated",
  "hierarchy": {
    "zone":        { "code": "Z-02", "name": "Jaipur Zone 2" },
    "circle":      { "code": "C-02", "name": "Circle 2" },
    "division":    { "code": "D-02", "name": "Division 2" },
    "subdivision": { "code": "SD-02", "name": "Subdivision 2" },
    "substation":  { "code": "SS-02", "name": "Substation 2" },
    "feeder":      { "code": "F-002", "name": "Feeder 2" },
    "dt":          { "code": "DT-002", "name": "Mansarovar DT 2" }
  }
}
```

### All meters (bulk, with geo)
```bash
curl http://localhost:3000/api/meters/all
```

### Full hierarchy tree
```bash
curl http://localhost:3000/api/hierarchy
```

---

## API Docs

Swagger UI is served at **http://localhost:3000/docs** when the server is running.

The raw OpenAPI 3.1 spec is in [`openapi.json`](./openapi.json).

See [`PROTOCOL.md`](./PROTOCOL.md) for how the portal itself works.

---

## Assumptions

- The portal credentials are stable for the duration of evaluation. In production, these would come from environment variables or a secrets manager.
- Token expiry behaviour is assumed to mirror typical `better-auth` defaults. The retry-on-401 logic handles this.
- The bulk export endpoint (`/portal/meters/export`) returns all meters without pagination — this assumption holds for 403 meters but is noted as a scaling concern.
- The `__data.json` decoder handles the observed format; unusual portal responses may need additional handling.

---

## Design Decisions & Trade-offs

**Bearer token over cookie management**
The portal's `POST /api/auth/sign-in/email` returns a bearer token directly. This is simpler and more robust than managing session cookies.

**`/portal/meters/export` for the `/all` endpoint**
Rather than paginating through `/portal/meters/search`, the export endpoint returns all 403 meters in one request with richer data (geo, full hierarchy). It's used as the data source for both `/api/meters/all` and `/api/hierarchy`.

**No caching**
Every request proxies to the portal in real time. For a production service, the bulk export (which changes rarely) would be cached with a TTL of several minutes. The hierarchy endpoint in particular re-fetches all 403 meters on each call — fine for this scale, but noted.

**SvelteKit decoder**
The `__data.json` endpoints use SvelteKit's compact deduplication format. A generic recursive resolver handles this. It's tested against the observed meter and transformer shapes.

---

## What Was Intentionally Left Out

- **Consumption / readings data** — No readings endpoint was found in the portal during investigation. The portal UI shows meter parameters but no historical consumption charts. Included in "what I'd do next."
- **Caching layer** — Would meaningfully improve performance and reduce portal load.
- **Authentication on this API** — The API itself has no auth. In production it would require an API key or OAuth.
- **Input validation** — Basic error handling exists; `express-validator` or Zod would harden this.
- **Tests** — Skipped to stay within the time budget. See below.

---

## What I'd Improve With More Time

1. **Caching** — Cache the bulk export for 5–10 minutes. The hierarchy endpoint especially benefits from this.
2. **Consumption data** — Investigate whether readings are available via a portal endpoint not yet found (e.g. websocket or a separate `/portal/readings/:id` path).
3. **Tests** — Unit tests for the decoder, integration tests against a recorded fixture of portal responses.
4. **Auth on this API** — API key middleware so the service isn't open to anyone.
5. **Web client** — The geo data makes a Leaflet.js map of all 403 meters trivial to build.
6. **Streaming** — For `/api/meters/all`, stream the portal response rather than buffering 360 KB in memory.

---

## Reflection

### What assumptions did you make?
That the bearer token approach would work for all portal endpoints — it did. That `/portal/meters/export` returns all meters without pagination — confirmed (403 meters, one response). That the SvelteKit `__data.json` format is consistent across meter and transformer detail pages.

### Which part was the most difficult, and how did you get unstuck?
Finding the actual meters list endpoint. The `__data.json` endpoint for `/meters` only returned user info (server-side rendering puts layout data there, not page data). The breakthrough was spotting `search?q=&page=1` in the Network tab on page load — that was the real data endpoint, under the `/portal/` prefix I hadn't yet mapped.

### If you had another day, what would you improve?
A caching layer for the bulk export, tests, and a small web client with a Leaflet map — the geo coordinates make this compelling. I'd also investigate whether consumption/reading history is available somewhere in the portal.

### What mistake did you make?
I initially tried fetching `/meters/export` (without the `/portal/` prefix) and got a 404 that SvelteKit was interpreting "export" as a meter ID. It took a moment to realise all data endpoints live under `/portal/`, not the UI route namespace.

### If you were reviewing your own submission, what would you criticise?
The hierarchy endpoint re-fetches all 403 meters on every call. That's the most obvious performance gap. I'd also want tests — the decoder especially deserves unit tests given its importance. And the transformer detail normaliser is somewhat speculative since I couldn't fully verify the `__data.json` shape for transformers in the time available.
