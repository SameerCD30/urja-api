/**
 * Decodes SvelteKit's __data.json format.
 * Uses the LAST data node — node[1] is layout/user info,
 * node[2] is the actual page data (meter/transformer detail).
 */
export function decode(raw) {
  const nodes = raw?.nodes;
  if (!Array.isArray(nodes)) return null;

  // Find the LAST node with type=data and a data array (page data, not layout)
  const node = [...nodes].reverse().find(
    (n) => n?.type === 'data' && Array.isArray(n?.data)
  );
  if (!node) return null;

  const pool = node.data;

  function resolve(val) {
    if (typeof val === 'number' && Number.isInteger(val)) return resolve(pool[val]);
    if (Array.isArray(val)) return val.map(resolve);
    if (val !== null && typeof val === 'object')
      return Object.fromEntries(Object.entries(val).map(([k, v]) => [k, resolve(v)]));
    return val;
  }

  return resolve(pool[0]);
}
