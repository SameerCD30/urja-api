# PROTOCOL.md — How the Urja Meter Ops Portal Works

A write-up of the portal's internals as discovered by inspection.

---

## Tech Stack

The portal is a **SvelteKit** application. This was identifiable from:
- Fetch requests to `__data.json?x-sveltekit-invalidated=001` in DevTools
- The `__sveltekit_uzbk0k` global variable in page scripts
- The `/mnt/app/immutable/` asset paths

Authentication is handled by the **`better-auth`** npm library, identifiable from the session cookie name:
```
__Secure-better-auth.session_token=...
```

---

## Authentication

### Login
```
POST /api/auth/sign-in/email
Content-Type: application/json

{ "email": "operator@urja.local", "password": "urja-ops-2026" }
```

Response:
```json
{
  "redirect": false,
  "token": "<bearer-token>",
  "user": {
    "name": "Ops Desk",
    "email": "operator@urja.local",
    "id": "QQzA9lR6zhhqtbJrU2iC0Cp3rCIEYefi"
  }
}
```

The returned `token` must be sent as `Authorization: Bearer <token>` on all subsequent requests.

---

## Data Endpoints

All data endpoints live under the `/portal/` prefix (distinct from the SvelteKit UI routes at `/meters`, `/transformers`).

### Meter Search / List
```
GET /portal/meters/search?q=<query>&page=<n>
Authorization: Bearer <token>
```
- `q` — partial match on meter ID or serial number. Empty string returns all.
- `page` — 1-based pagination.

### Meter Bulk Export
```
GET /portal/meters/export
Authorization: Bearer <token>
```
Returns a flat JSON array of all 403 meters. Each record includes:
- `meterId`, `serialNo`, `make`, `phaseType`, `installStatus`, `installType`, `build`
- `dtCode` — the distribution transformer this meter is attached to
- `hierarchy` — full network path (zone → circle → division → subdivision → substation → feeder → dt), each node with `code` and `name`
- `geo` — `{ lat, lng }` GPS coordinates

This is the richest endpoint and the most efficient way to get all meter data.

### Distribution Transformers
```
GET /portal/dts?page=<n>
Authorization: Bearer <token>
```
Returns paginated list of distribution transformers with code, name, feeder, and capacity (KVA).

### Single Meter Detail (SvelteKit route)
```
GET /meters/<meterId>/__data.json
Authorization: Bearer <token>
```
Returns SvelteKit's compact deduplicated JSON (see below). Contains meter parameters and hierarchy.

### Single Transformer Detail (SvelteKit route)
```
GET /transformers/<dtCode>/__data.json
Authorization: Bearer <token>
```
Same format as meter detail.

---

## SvelteKit `__data.json` Format

SvelteKit serialises page data in a compact format to avoid repeating strings. Values are stored in a flat `data` array and referenced by integer index:

```json
{
  "type": "data",
  "nodes": [
    { "type": "skip" },
    { "type": "skip" },
    {
      "type": "data",
      "data": [
        { "meterId": 1, "detail": 2 },
        "J100001",
        { ... }
      ]
    }
  ]
}
```

Here `data[0].meterId = 1` means the value is `data[1]` = `"J100001"`. The decoder in `src/decode.js` resolves these references recursively.

---

## Security Finding — `/portal/keys`

```
GET /portal/keys
Authorization: Bearer <token>
```

Response:
```json
{ "data": { "signingSecret": "I3dZPPf5CgTp7JyGNMI8i6z8LFR7TmSR" } }
```

This endpoint returns the `better-auth` JWT signing secret to any authenticated user. With this secret, a logged-in user could forge arbitrary session tokens for any account — a significant privilege escalation risk.

**This was not exploited.** Standard credential-based login was used throughout. This finding is flagged here for the portal operators' attention.

---

## Network Hierarchy

The full hierarchy depth is deeper than the portal's UI suggests:

```
Zone (Z-xx)
  └── Circle (C-xx)
        └── Division (D-xx)
              └── Subdivision (SD-xx)
                    └── Substation (SS-xx)
                          └── Feeder (F-xxx)
                                └── Distribution Transformer / DT (DT-xxx)
                                      └── Meter (Jxxxxxx)
```

---

## Quirks & Notes

- **`/meters/export`** (without `/portal/` prefix) 404s — SvelteKit treats it as a meter detail route with id = "export".
- The meters list page is **client-side rendered** — the HTML shell contains no meter data; it is loaded after page load via the search endpoint.
- The `/portal/` prefix is not documented anywhere in the UI and was discovered via DevTools Network inspection.
- The export endpoint returns all meters in one shot with no pagination — very convenient for bulk operations.
