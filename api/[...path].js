const RENDER_API_ORIGIN = 'https://nextwave-site-v2.onrender.com';

// Vercel serves this instead of the SPA, and it does not forward the request.
// Stripe must post the untouched signed body to the Render webhook URL.
export default function handler(req, res) {
  if (req && typeof req.resume === 'function') req.resume();
  const path = typeof req?.url === 'string' ? req.url.split('?')[0] : '';
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.status(404).json({
    error: path === '/api/webhook'
      ? `Stripe webhooks must be delivered directly to ${RENDER_API_ORIGIN}/api/webhook`
      : `Payment API requests must be sent to ${RENDER_API_ORIGIN}`,
  });
}
