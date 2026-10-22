export const RENDER_API_ORIGIN = 'https://nextwave-site-v2.onrender.com';

const DEV_API_ORIGINS = new Set(['', 'http://127.0.0.1:8788', 'http://localhost:8788']);

export function resolveApiBase({ dev = false, configured = '' } = {}) {
  const value = typeof configured === 'string' ? configured.trim().replace(/\/$/, '') : '';
  if (dev) return DEV_API_ORIGINS.has(value) ? value : '';
  return RENDER_API_ORIGIN;
}

export function apiUrl(path, env) {
  if (typeof path !== 'string' || !path.startsWith('/api/') || path.includes('://')) throw Error('Invalid API path');
  return `${resolveApiBase(env)}${path}`;
}

// Production checkout stays off unless the build explicitly asks for test mode.
// `live` is refused here so a frontend flag cannot present or start real charges.
export function checkoutAvailability({ dev = false, configured } = {}) {
  if (configured === 'live') return 'live-blocked';
  if (configured === 'disabled') return 'disabled';
  if (configured === 'test') return 'test';
  if (dev && (configured === undefined || configured === '')) return 'test';
  return 'disabled';
}

export function checkoutIsShown(mode) {
  return mode === 'test' || mode === 'disabled';
}

export const PURCHASABLE_PACKAGE_IDS = Object.freeze(['booking-only', 'website-crm']);

export function checkoutPath(packageId) {
  if (!PURCHASABLE_PACKAGE_IDS.includes(packageId)) throw Error('Invalid package');
  return `/checkout?package=${encodeURIComponent(packageId)}`;
}

export function checkoutPhase(pathname) {
  const path = typeof pathname === 'string' ? pathname.replace(/\/+$/, '') : '';
  if (path.endsWith('/success')) return 'success';
  if (path.endsWith('/cancel')) return 'cancel';
  if (path.endsWith('/pending')) return 'pending';
  return 'review';
}
