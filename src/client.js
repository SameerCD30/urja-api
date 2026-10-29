import { getAuth, invalidate, PORTAL_BASE } from './auth.js';

export async function portalGet(path) {
  const { token, cookie } = await getAuth();

  const res = await fetch(`${PORTAL_BASE}${path}`, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Cookie': cookie,
      'Accept': 'application/json',
    },
  });

  if (res.status === 401) {
    invalidate();
    const fresh = await getAuth();
    const retry = await fetch(`${PORTAL_BASE}${path}`, {
      headers: {
        'Authorization': `Bearer ${fresh.token}`,
        'Cookie': fresh.cookie,
        'Accept': 'application/json',
      },
    });
    if (!retry.ok) throw new Error(`Portal error on retry: ${retry.status}`);
    return retry.json();
  }

  if (!res.ok) throw new Error(`Portal responded ${res.status} for ${path}`);
  return res.json();
}
