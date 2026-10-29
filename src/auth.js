const PORTAL_BASE = process.env.PORTAL_BASE ?? 'https://urja-ops.flockenergy.tech';
const EMAIL       = process.env.PORTAL_EMAIL    ?? 'operator@urja.local';
const PASSWORD    = process.env.PORTAL_PASSWORD ?? 'urja-ops-2026';

let cachedToken  = null;
let cachedCookie = null;

export async function getAuth() {
  if (cachedToken && cachedCookie) return { token: cachedToken, cookie: cachedCookie };

  const res = await fetch(`${PORTAL_BASE}/api/auth/sign-in/email`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Origin':  PORTAL_BASE,
      'Referer': `${PORTAL_BASE}/`,
    },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });

  if (!res.ok) throw new Error(`Portal login failed: ${res.status}`);

  // Capture the session cookie — portal data endpoints check this
  const setCookie = res.headers.get('set-cookie') ?? '';
  const match = setCookie.match(/(__Secure-better-auth\.session_token=[^;]+)/);
  cachedCookie = match ? match[1] : '';

  const data = await res.json();
  if (!data.token) throw new Error('No token in login response');

  cachedToken = data.token;
  console.log('[auth] Logged in, token + cookie cached.');
  return { token: cachedToken, cookie: cachedCookie };
}

export function invalidate() {
  console.log('[auth] Credentials invalidated, will re-login.');
  cachedToken  = null;
  cachedCookie = null;
}

export { PORTAL_BASE };
