// ─────────────────────────────────────────────────────────────────────────────
// server/index.js  —  Purplehat Publishing  —  Express + PostgreSQL API
//
// WHAT THIS FILE IS:
//   A tiny web server that listens for HTTP requests from the browser and talks
//   to the PostgreSQL database on the browser's behalf.
//
//   Browsers cannot connect directly to a database because:
//     1. It would expose your database credentials in public client-side code.
//     2. Databases use persistent TCP connections that browsers don't support.
//     3. Anyone could run arbitrary SQL against your data.
//   This server is the controlled "middleman" that decides exactly what is allowed.
//
// HOW TO RUN:
//   cd server
//   node index.js
//
// PREREQUISITES:
//   npm install   (only needed once — installs all packages from package.json)
//   Docker container running:  docker start purplehat-db
// ─────────────────────────────────────────────────────────────────────────────


// ── IMPORTS ───────────────────────────────────────────────────────────────────
//
// ES Module syntax — the modern standard for JavaScript (browser and Node.js).
// Node knows to use ESM because package.json has "type": "module".

// 'dotenv/config' reads .env and populates process.env — must be first.
import 'dotenv/config';

import express from 'express';                // the web framework
import cors    from 'cors';                   // adds CORS headers so browser allows cross-origin fetch
import pg      from 'pg';                     // PostgreSQL client library
import bcrypt  from 'bcryptjs';               // password hashing — pure JS, no native compilation needed
import jwt     from 'jsonwebtoken';           // create and verify JSON Web Tokens

// pg's default export is the whole library. We destructure Pool from it.
const { Pool } = pg;


// ── DATABASE CONNECTION POOL ──────────────────────────────────────────────────
//
// A Pool keeps a small number of connections open and reuses them across
// many requests — much faster than open→query→close on every request.
const pool = new Pool({
  user:     process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  host:     process.env.DB_HOST,
  port:     process.env.DB_PORT,
  database: process.env.DB_NAME,
});


// ── EXPRESS APP SETUP ─────────────────────────────────────────────────────────
const app = express();

// cors() adds headers that tell the browser it's safe to fetch from a different
// port (e.g. localhost:5000 → localhost:3000). Must come BEFORE route definitions.
app.use(cors());

// express.json() parses incoming JSON bodies into req.body.
// Without this, req.body would be undefined for POST/PATCH requests.
app.use(express.json());


// ── AUTH MIDDLEWARE ───────────────────────────────────────────────────────────
//
// requireAuth() is a "middleware factory" — a function that returns a middleware.
// Calling requireAuth('admin') returns a function Express can run before a route handler.
//
// Middleware signature: (req, res, next) =>
//   req  = incoming request
//   res  = outgoing response
//   next = call this to pass control to the next middleware or route handler
//
// HOW JWT WORKS:
//   1. On sign-in, the server creates a token: jwt.sign(payload, secret)
//      The payload is plain data ({id, name, email, role}), the secret is a
//      private string only the server knows. The result is a signed string.
//   2. The browser stores this token and sends it with every protected request
//      in the Authorization header: "Bearer <token>"
//   3. The server calls jwt.verify(token, secret) — this checks the signature.
//      If the token was tampered with, or wasn't signed with our secret, it throws.
//      If valid, it returns the original payload.
//   This means the server never needs to look up a session in the database —
//   the token itself is the proof of identity.
//
function requireAuth(...allowedRoles) {
  return (req, res, next) => {
    const header = req.headers.authorization; // "Bearer eyJhbGci..."
    if (!header?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'not_authenticated' });
      // 401 = Unauthorized — no valid credentials were provided
    }
    try {
      // slice(7) strips the "Bearer " prefix, leaving just the token string
      const payload = jwt.verify(header.slice(7), process.env.JWT_SECRET);
      req.user = payload; // { id, name, email, role, iat, exp }

      // If roles were specified, check the user has one of them
      if (allowedRoles.length && !allowedRoles.includes(payload.role)) {
        return res.status(403).json({ error: 'forbidden' });
        // 403 = Forbidden — authenticated but not authorised for this resource
      }
      next(); // all good — pass control to the route handler
    } catch {
      // jwt.verify throws if the token is expired, malformed, or has wrong signature
      res.status(401).json({ error: 'invalid_token' });
    }
  };
}


// ── AUTH ROUTES ───────────────────────────────────────────────────────────────


// ── POST /api/auth/signup ─────────────────────────────────────────────────────
// Creates a new account. Returns a JWT token on success.
// Special case: if the email already exists but has no password (pre-seeded row),
// this "claims" the account by setting the password rather than rejecting.
app.post('/api/auth/signup', async (req, res) => {
  const { name, email, password } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ error: 'name, email and password are required' });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: 'password must be at least 8 characters' });
  }

  try {
    // Check if this email already exists in the database
    const existing = await pool.query(
      'SELECT id, password_hash, role FROM users WHERE email = $1',
      [email]
    );

    // BCRYPT HASHING:
    // bcrypt.hash(plaintext, saltRounds) — the number 12 is the "cost factor".
    // Higher = slower to compute = harder to brute-force. 12 is a good default.
    // The result is a string like "$2a$12$..." which includes the salt embedded in it.
    // You NEVER store the plain-text password — only this hash.
    const hash = await bcrypt.hash(password, 12);

    let user;

    if (existing.rows.length > 0) {
      const row = existing.rows[0];
      if (row.password_hash !== null) {
        // Account exists and already has a password — cannot claim it
        return res.status(409).json({ error: 'email_taken' });
        // 409 = Conflict — resource already exists
      }
      // Account exists but was pre-seeded without a password — claim it
      const result = await pool.query(
        'UPDATE users SET name=$1, password_hash=$2 WHERE email=$3 RETURNING id, name, email, role',
        [name, hash, email]
      );
      user = result.rows[0];
    } else {
      // Brand new account
      const result = await pool.query(
        'INSERT INTO users (name, email, password_hash) VALUES ($1, $2, $3) RETURNING id, name, email, role',
        [name, email, hash]
      );
      user = result.rows[0];
    }

    // JWT SIGNING:
    // jwt.sign(payload, secret, options)
    // The payload is embedded in the token — it's base64 encoded, NOT encrypted.
    // Anyone can decode it, but they cannot change it without invalidating the signature.
    // Only include data you're comfortable being readable. Never put passwords in a JWT.
    const token = jwt.sign(
      { id: user.id, name: user.name, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '7d' } // token expires after 7 days
    );

    res.status(201).json({ token, user });
    // 201 = Created

  } catch (err) {
    console.error('POST /api/auth/signup error:', err.message);
    res.status(500).json({ error: 'Database error' });
  }
});


// ── POST /api/auth/signin ─────────────────────────────────────────────────────
// Verifies credentials and returns a JWT token.
app.post('/api/auth/signin', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'email and password are required' });
  }

  try {
    const result = await pool.query(
      'SELECT id, name, email, role, password_hash FROM users WHERE email=$1 AND active=true',
      [email]
    );

    const user = result.rows[0];

    // We return the same error for "no account" and "wrong password" intentionally.
    // Separate errors ("email not found" vs "wrong password") let attackers enumerate
    // which emails are registered — a security risk called "user enumeration".
    if (!user) {
      return res.status(401).json({ error: 'invalid_credentials' });
    }

    if (user.password_hash === null) {
      // Pre-seeded account with no password set yet
      return res.status(401).json({ error: 'no_password_set' });
    }

    // bcrypt.compare(plaintext, hash) — returns true if the plaintext matches the hash.
    // This is safe because bcrypt is intentionally slow (the cost factor from signup).
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'invalid_credentials' });
      // 401 = Unauthorized
    }

    const token = jwt.sign(
      { id: user.id, name: user.name, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    // Don't send password_hash back to the client
    res.json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role } });

  } catch (err) {
    console.error('POST /api/auth/signin error:', err.message);
    res.status(500).json({ error: 'Database error' });
  }
});


// ── GET /api/auth/me ──────────────────────────────────────────────────────────
// Returns the current user's data from the database (re-validates the token
// and refreshes any data that may have changed since the token was issued,
// e.g. if an admin changed this user's role).
app.get('/api/auth/me', requireAuth(), async (req, res) => {
  // requireAuth() with no arguments = any authenticated user
  // req.user was set by the middleware: { id, name, email, role, iat, exp }
  try {
    const result = await pool.query(
      'SELECT id, name, email, role, active FROM users WHERE id=$1',
      [req.user.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'user_not_found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('GET /api/auth/me error:', err.message);
    res.status(500).json({ error: 'Database error' });
  }
});


// ── USER ROUTES ───────────────────────────────────────────────────────────────


// ── GET /api/users ────────────────────────────────────────────────────────────
// Returns all users. Protected: admin role required.
// requireAuth('admin') runs first — if the token is missing, invalid, or not admin,
// the request is rejected before this handler even runs.
app.get('/api/users', requireAuth('admin'), async (_req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, name, email, active, role FROM users ORDER BY id'
    );
    res.json(result.rows);
  } catch (err) {
    console.error('GET /api/users error:', err.message);
    res.status(500).json({ error: 'Database error' });
  }
});


// ── POST /api/users ───────────────────────────────────────────────────────────
// Creates a new user (no password). Kept for direct API use / testing.
// In normal flow, users are created via /api/auth/signup.
app.post('/api/users', async (req, res) => {
  const { name, email } = req.body;
  if (!name || !email) {
    return res.status(400).json({ error: 'name and email are required' });
  }
  try {
    const result = await pool.query(
      'INSERT INTO users (name, email) VALUES ($1, $2) RETURNING *',
      [name, email]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Email already registered' });
    }
    console.error('POST /api/users error:', err.message);
    res.status(500).json({ error: 'Database error' });
  }
});


// ── PATCH /api/users/:id/role ─────────────────────────────────────────────────
// Updates a user's role. Admin only.
// :id is a URL parameter — Express puts it in req.params.id.
app.patch('/api/users/:id/role', requireAuth('admin'), async (req, res) => {
  const { role } = req.body;
  const targetId = parseInt(req.params.id, 10);

  // Validate the role value
  if (!['admin', 'reader'].includes(role)) {
    return res.status(400).json({ error: 'role must be admin or reader' });
  }

  // Prevent an admin from demoting themselves — would lock them out
  if (targetId === req.user.id && role !== 'admin') {
    return res.status(400).json({ error: 'cannot_demote_self' });
  }

  try {
    const result = await pool.query(
      'UPDATE users SET role=$1 WHERE id=$2 RETURNING id, name, role',
      [role, targetId]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'user_not_found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('PATCH /api/users/:id/role error:', err.message);
    res.status(500).json({ error: 'Database error' });
  }
});


// ── START THE SERVER ──────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
  console.log(`Auth endpoints:`);
  console.log(`  POST http://localhost:${PORT}/api/auth/signup`);
  console.log(`  POST http://localhost:${PORT}/api/auth/signin`);
  console.log(`  GET  http://localhost:${PORT}/api/auth/me`);
});
