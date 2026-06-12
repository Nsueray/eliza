// ELIZA API auth middleware (Faz 2a).
// HS256 only (locked Karar 5 — RS256/JWKS forbidden). JWT_SECRET is REQUIRED;
// there is NO fallback secret (a missing secret must fail at boot, not silently
// accept a public default). Mounted globally in server.js via app.use('/api', authRequired)
// with a small public exception list.

const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET;

// Paths (relative to the /api mount) that do NOT require a token.
// Only the login endpoint is public; everything else needs a valid JWT.
const PUBLIC = new Set([
  'POST /auth/login',
]);

function authRequired(req, res, next) {
  // CORS preflight must pass through without auth.
  if (req.method === 'OPTIONS') return next();

  // req.path here is relative to the '/api' mount (e.g. '/auth/login').
  if (PUBLIC.has(`${req.method} ${req.path}`)) return next();

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token' });
  }

  const token = authHeader.slice('Bearer '.length).trim();
  let payload;
  try {
    payload = jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] });
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }

  // Normalize the user id across token shapes (login signs { userId }, older
  // tokens may carry user_id / id).
  payload.userId = payload.userId || payload.user_id || payload.id;
  req.user = payload;
  next();
}

module.exports = { authRequired, JWT_SECRET };
