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
//   npm install express pg cors dotenv   (only needed once)
//   Docker container running:  docker start purplehat-db
// ─────────────────────────────────────────────────────────────────────────────


// ── IMPORTS ───────────────────────────────────────────────────────────────────
//
// ES Module syntax — the modern standard for JavaScript (browser and Node.js).
// 'import' replaces the older Node-only 'require()' syntax.
// Node knows to use ESM because package.json has "type": "module".

// 'dotenv/config' is dotenv's ESM entry point.
// Importing it as a side-effect (no name binding needed) runs its setup code,
// which reads .env and populates process.env — same as require('dotenv').config().
// Must be first so all process.env values are ready before anything else runs.
import 'dotenv/config';

import express from 'express';                // default export — the whole framework
import cors    from 'cors';                   // default export — the middleware function
import pg      from 'pg';                     // default export — the whole pg library object
import { setTimeout } from 'timers/promises'; // named export — one specific async timer

// pg's default export is the whole library object.
// We destructure Pool from it to get just the connection pool class.
const { Pool } = pg;


// ── DATABASE CONNECTION POOL ──────────────────────────────────────────────────
//
// WHAT IS A POOL?
//   Opening a database connection has overhead — it involves a handshake,
//   authentication, and allocating resources on both sides.
//   A Pool keeps a small number of connections open and reuses them across
//   many requests, which is much faster than open→query→close on every request.
//
// The values come from process.env, which dotenv populated from your .env file.
// This means your password is never written directly in source code.
const pool = new Pool({
  user:     process.env.DB_USER,      // 'postgres'
  password: process.env.DB_PASSWORD,  // your Docker container password
  host:     process.env.DB_HOST,      // 'localhost' — the container is mapped to your machine
  port:     process.env.DB_PORT,      // 5432 — the standard PostgreSQL port
  database: process.env.DB_NAME,      // 'purplehat' — the database we created
});


// ── EXPRESS APP SETUP ─────────────────────────────────────────────────────────
//
// createApp() returns an Express application object. Think of it as the
// object you attach routes and middleware to.
const app = express();

// MIDDLEWARE — functions that run on *every* incoming request, in order,
// before your route handlers get called.

// cors() adds HTTP headers that tell the browser it's safe to make requests
// from a different origin (e.g. localhost:5000 → localhost:3000).
// Without this, Chrome blocks the fetch() call in users.html with:
//   "Access to fetch ... blocked by CORS policy"
// IMPORTANT: app.use(cors()) must come BEFORE your route definitions.
app.use(cors());

// express.json() reads the request body and parses it as JSON,
// making it available as req.body in your route handlers.
// Without this, req.body would be undefined for POST requests.
app.use(express.json());


// ── ROUTES ────────────────────────────────────────────────────────────────────
//
// A route maps an HTTP verb + URL path to a handler function.
// REST convention:
//   GET    /api/users     → read all users
//   POST   /api/users     → create a new user
//   GET    /api/users/5   → read user with id 5  (add later)
//   PUT    /api/users/5   → update user 5         (add later)
//   DELETE /api/users/5   → delete user 5         (add later)


// ── GET /api/users ────────────────────────────────────────────────────────────
// Returns all users from the database as a JSON array.
//
// 'async' marks this function as asynchronous — it can use 'await' inside.
// 'await' pauses execution at that line until the Promise resolves, then
// continues with the result. This is cleaner than nested .then() callbacks.
//
// req  = the incoming HTTP request (headers, body, query params, etc.)
// res  = the outgoing HTTP response — you call methods on this to send a reply
app.get('/api/users', async (req, res) => {
  try {
    // pool.query() sends SQL to PostgreSQL and returns a Promise.
    // We await it — execution pauses here until Postgres replies.
    // The result object has a 'rows' property: an array of plain JS objects,
    // one per row, with keys matching the column names.
    //
    // SQL breakdown:
    //   SELECT id, name, email, active  — pick only these columns (not *)
    //   FROM users                      — from the users table
    //   ORDER BY id                     — sorted ascending by id (1, 2, 3...)
    const result = await pool.query(
      'SELECT name, email, active FROM users ORDER BY id'
    );

    //await setTimeout(5000); // simulate latency — timers/promises version returns a real Promise

    // res.json() serialises result.rows to JSON and sends it with
    // Content-Type: application/json and status 200 OK.
    res.json(result.rows);

  } catch (err) {
    // If the database is unreachable or the SQL fails, err is thrown.
    // Log it server-side so you can debug, but don't expose internals to the client.
    console.error('GET /api/users error:', err.message);
    res.status(500).json({ error: 'Database error' });
    // 500 = Internal Server Error — something went wrong on the server side
  }
});


// ── POST /api/users ───────────────────────────────────────────────────────────
// Creates a new user. The browser sends a JSON body: { "name": "...", "email": "..." }
// Returns the newly created row (including the auto-generated id).
app.post('/api/users', async (req, res) => {
  // req.body is the parsed JSON body from the browser.
  // Destructuring pulls out just the fields we expect.
  const { name, email } = req.body;

  // Input validation — always validate at the API boundary.
  // Return 400 Bad Request if required fields are missing.
  if (!name || !email) {
    return res.status(400).json({ error: 'name and email are required' });
    // 400 = Bad Request — the client sent something invalid
  }

  try {
    // PARAMETERISED QUERY — the correct way to insert user-supplied values.
    //
    // NEVER do this:  'INSERT INTO users VALUES (' + name + ')'
    // That is SQL injection: a malicious user could send:
    //   name = "x'); DROP TABLE users; --"
    // and destroy your database.
    //
    // With $1 and $2, the pg library sends the SQL template and the values
    // separately. PostgreSQL treats the values as data, never as SQL code.
    //
    // RETURNING * tells PostgreSQL to send back the full inserted row,
    // including the auto-generated id (because of SERIAL in the schema).
    const result = await pool.query(
      'INSERT INTO users (name, email) VALUES ($1, $2) RETURNING *',
      [name, email]  // $1 = name, $2 = email
    );

    // result.rows[0] is the newly created user object, e.g.:
    // { id: 4, name: 'Alice', email: 'alice@example.com', active: true }
    res.status(201).json(result.rows[0]);
    // 201 = Created — standard response for a successful POST that creates a resource

  } catch (err) {
    // PostgreSQL error codes are strings. '23505' = unique_violation.
    // This happens when the email already exists (because of UNIQUE constraint).
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Email already registered' });
      // 409 = Conflict — the resource already exists
    }
    console.error('POST /api/users error:', err.message);
    res.status(500).json({ error: 'Database error' });
  }
});


// ── START THE SERVER ──────────────────────────────────────────────────────────
//
// app.listen() starts the HTTP server on the given port.
// The callback runs once the server is ready to accept connections.
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
  console.log(`Test it: http://localhost:${PORT}/api/users`);
});
