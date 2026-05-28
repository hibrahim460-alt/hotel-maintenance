/**
 * ═══════════════════════════════════════════════════════════════
 *  HOTEL MAINTENANCE REQUEST SYSTEM — Backend Server
 *  Stack: Node.js · Express · Socket.io · JSON File Store
 *
 *  WHY JSON STORE (not better-sqlite3):
 *    better-sqlite3 is a native C++ addon that must be compiled
 *    from source during `npm install`. This fails on many cloud
 *    hosts (Render, Railway, Heroku) due to missing build tools.
 *    This pure-JS implementation has ZERO native dependencies
 *    and works on every host without any build step.
 *
 *  Storage strategy:
 *    - In-memory array (requests[]) for fast reads/writes
 *    - Flushed to data/requests.json after every mutation
 *    - Loaded from file on server startup (survives restarts)
 *    - Render free tier has an ephemeral FS — data resets on
 *      redeploy, which is fine for a hotel's daily operation
 *      cycle. For persistence across deploys, swap the file
 *      store for a free Supabase/PlanetScale DB.
 *
 *  Socket Events (broadcast to ALL clients):
 *    'new_request'       → Reception submits → Maintenance notified
 *    'request_completed' → Maintenance done  → Reception notified
 *    'clients_count'     → On connect/disconnect
 *
 *  REST Endpoints:
 *    GET  /api/health               → Server heartbeat
 *    GET  /api/requests/today       → All today's requests
 *    POST /api/requests             → Create new request
 *    PATCH /api/requests/:id/complete → Mark as done
 * ═══════════════════════════════════════════════════════════════
 */

'use strict';

const express          = require('express');
const { createServer } = require('http');
const { Server }       = require('socket.io');
const path             = require('path');
const fs               = require('fs');

// ─────────────────────────────────────────────────────────────
//  Bootstrap
// ─────────────────────────────────────────────────────────────
const app        = express();
const httpServer = createServer(app);
const io         = new Server(httpServer, {
  cors: { origin: '*', methods: ['GET', 'POST', 'PATCH'] }
});

const PORT = process.env.PORT || 3000;

// ─────────────────────────────────────────────────────────────
//  Pure-JS JSON Data Store
//  Replaces better-sqlite3 with a zero-dependency solution
//  that builds successfully on every cloud platform.
// ─────────────────────────────────────────────────────────────

/** Path to the persistence file (inside /data so it's easy to .gitignore) */
const DATA_DIR  = path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'requests.json');

/**
 * In-memory store — the single source of truth at runtime.
 * @type {Array<RequestRecord>}
 *
 * @typedef {Object} RequestRecord
 * @property {number}       id              — Auto-incrementing integer
 * @property {string}       guest_name
 * @property {string}       room_number
 * @property {string}       issue_category
 * @property {string}       notes
 * @property {string}       submitted_at    — ISO 8601 UTC
 * @property {'open'|'completed'} status
 * @property {string|null}  completed_at    — ISO 8601 UTC or null
 */
let requests = [];

/** Auto-increment counter, derived from max id on load */
let nextId = 1;

/**
 * Load persisted data from disk into the in-memory array.
 * Called once at startup. Errors are non-fatal (fresh start).
 */
function loadFromDisk() {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    if (!fs.existsSync(DATA_FILE)) return; // first run — no file yet

    const raw = fs.readFileSync(DATA_FILE, 'utf8');
    if (!raw.trim()) return;

    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      requests = parsed;
      const maxId = requests.reduce((m, r) => Math.max(m, r.id ?? 0), 0);
      nextId = maxId + 1;
      console.log(`[DB] Loaded ${requests.length} records from disk (nextId=${nextId})`);
    }
  } catch (err) {
    console.warn('[DB] Could not load data file — starting fresh:', err.message);
    requests = [];
    nextId   = 1;
  }
}

/**
 * Persist the current in-memory array to disk.
 * Uses write-then-rename (atomic on POSIX) to avoid corruption.
 * Errors are logged but never thrown — a failed flush doesn't
 * crash the server or fail the API response.
 */
function flushToDisk() {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    const tmp = DATA_FILE + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(requests, null, 2), 'utf8');
    fs.renameSync(tmp, DATA_FILE);
  } catch (err) {
    console.error('[DB] Flush to disk failed:', err.message);
  }
}

/**
 * Return all requests whose submitted_at date matches today
 * in the server's local timezone, newest first.
 * @returns {RequestRecord[]}
 */
function getTodayRequests() {
  const today = new Date().toLocaleDateString('en-CA'); // 'YYYY-MM-DD'
  return requests
    .filter(r => r.submitted_at.slice(0, 10) === today)
    .sort((a, b) => b.submitted_at.localeCompare(a.submitted_at));
}

/**
 * Find a single request by id.
 * @param {number} id
 * @returns {RequestRecord|undefined}
 */
function findById(id) {
  return requests.find(r => r.id === id);
}

/**
 * Insert a new request into the store and persist.
 * @param {object} fields
 * @returns {RequestRecord}
 */
function insertRequest(fields) {
  const record = {
    id:             nextId++,
    guest_name:     fields.guest_name,
    room_number:    fields.room_number,
    issue_category: fields.issue_category,
    notes:          fields.notes ?? '',
    submitted_at:   fields.submitted_at,
    status:         'open',
    completed_at:   null,
  };
  requests.unshift(record); // newest first for getTodayRequests
  flushToDisk();
  return record;
}

/**
 * Mark a request as completed and persist.
 * Returns the updated record, or null if not found / already done.
 * @param {number} id
 * @returns {RequestRecord|null}
 */
function completeRequest(id) {
  const record = findById(id);
  if (!record || record.status === 'completed') return null;

  record.status       = 'completed';
  record.completed_at = new Date().toISOString();
  flushToDisk();
  return record;
}

// ─────────────────────────────────────────────────────────────
//  Middleware
// ─────────────────────────────────────────────────────────────
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Request logger (API calls only)
app.use((req, _res, next) => {
  if (req.path.startsWith('/api')) {
    console.log(`[${new Date().toLocaleTimeString()}] ${req.method} ${req.path}`);
  }
  next();
});

// ─────────────────────────────────────────────────────────────
//  API Routes
// ─────────────────────────────────────────────────────────────

/**
 * GET /api/health
 * Used by the frontend to confirm the server is up.
 * Also useful for Render's health-check URL setting.
 */
app.get('/api/health', (_req, res) => {
  res.json({
    status:          'ok',
    timestamp:       new Date().toISOString(),
    uptime_seconds:  Math.round(process.uptime()),
    total_records:   requests.length,
    today_records:   getTodayRequests().length,
  });
});

/**
 * GET /api/requests/today
 * Returns every request (open + completed) for today, newest-first.
 * Both panels call this on load to hydrate their state.
 */
app.get('/api/requests/today', (_req, res) => {
  res.json(getTodayRequests());
});

/**
 * POST /api/requests
 * Body: { guest_name, room_number, issue_category, notes? }
 * → 201 + saved record
 * → broadcasts 'new_request' to all Socket.io clients
 */
app.post('/api/requests', (req, res) => {
  // Safely destructure — req.body may be undefined if Content-Type header
  // is missing (common mistake from some HTTP clients)
  const body = req.body ?? {};
  const { guest_name, room_number, issue_category, notes = '' } = body;

  // ── Input Validation ─────────────────────────────────────
  const errors = [];
  if (!guest_name?.toString().trim())      errors.push('guest_name is required');
  if (!room_number?.toString().trim())     errors.push('room_number is required');
  if (!issue_category?.toString().trim())  errors.push('issue_category is required');

  const VALID_CATEGORIES = [
    'Toilet', 'AC', 'Carpet', 'Wood', 'Tiles',
    'Painting', 'Room Smell', 'Electricity'
  ];
  if (issue_category && !VALID_CATEGORIES.includes(issue_category)) {
    errors.push(`issue_category must be one of: ${VALID_CATEGORIES.join(', ')}`);
  }

  if (errors.length > 0) {
    return res.status(400).json({ errors });
  }

  // ── Persist + Broadcast ───────────────────────────────────
  const newRequest = insertRequest({
    guest_name:     guest_name.toString().trim(),
    room_number:    room_number.toString().trim(),
    issue_category: issue_category.toString().trim(),
    notes:          notes.toString().trim(),
    submitted_at:   new Date().toISOString(),
  });

  // Maintenance panels receive this event immediately
  io.emit('new_request', newRequest);

  console.log(
    `[NEW REQUEST] #${newRequest.id} | ` +
    `Room ${newRequest.room_number} | ` +
    `${newRequest.issue_category} | ` +
    `Guest: ${newRequest.guest_name}`
  );

  res.status(201).json(newRequest);
});

/**
 * PATCH /api/requests/:id/complete
 * Stamps the exact completion time and archives the request.
 * → 200 + updated record
 * → broadcasts 'request_completed' to all Socket.io clients
 */
app.patch('/api/requests/:id/complete', (req, res) => {
  const id = parseInt(req.params.id, 10);

  if (isNaN(id) || id < 1) {
    return res.status(400).json({ error: 'Invalid request ID' });
  }

  const existing = findById(id);

  if (!existing) {
    return res.status(404).json({ error: `Request #${id} not found` });
  }
  if (existing.status === 'completed') {
    return res.status(409).json({ error: `Request #${id} is already completed` });
  }

  const updated = completeRequest(id);

  // Reception panels receive this event immediately
  io.emit('request_completed', updated);

  console.log(
    `[COMPLETED] #${updated.id} | ` +
    `Room ${updated.room_number} | ` +
    `${updated.issue_category} | ` +
    `Completed at ${updated.completed_at}`
  );

  res.json(updated);
});

// ─────────────────────────────────────────────────────────────
//  Socket.io — Connection Lifecycle
// ─────────────────────────────────────────────────────────────
let connectedClients = 0;

io.on('connection', (socket) => {
  connectedClients++;
  console.log(`[WS] Connected: ${socket.id} (total: ${connectedClients})`);
  io.emit('clients_count', connectedClients);

  /**
   * Client registers its role right after connecting.
   * Joins a named room ('reception' or 'maintenance') for
   * potential future targeted broadcasts.
   */
  socket.on('register_role', (role) => {
    const validRoles = ['reception', 'maintenance'];
    if (validRoles.includes(role)) {
      socket.data.role = role;
      socket.join(role);
      console.log(`[WS] ${socket.id} → role: ${role}`);
    }
  });

  socket.on('disconnect', (reason) => {
    connectedClients = Math.max(0, connectedClients - 1);
    console.log(`[WS] Disconnected: ${socket.id} (${reason}) | remaining: ${connectedClients}`);
    io.emit('clients_count', connectedClients);
  });
});

// ─────────────────────────────────────────────────────────────
//  Startup
// ─────────────────────────────────────────────────────────────
loadFromDisk();

httpServer.listen(PORT, () => {
  const line = '═'.repeat(52);
  console.log(`\n${line}`);
  console.log('  HOTEL MAINTENANCE REQUEST SYSTEM');
  console.log(line);
  console.log(`  App URL     →  http://localhost:${PORT}`);
  console.log(`  Reception   →  http://localhost:${PORT}?role=reception`);
  console.log(`  Maintenance →  http://localhost:${PORT}?role=maintenance`);
  console.log(`  Data file   →  ${DATA_FILE}`);
  console.log(`  Storage     →  Pure JS (no native deps)`);
  console.log(`${line}\n`);
});

// ─────────────────────────────────────────────────────────────
//  Graceful Shutdown — flush before exit
// ─────────────────────────────────────────────────────────────
function shutdown(signal) {
  console.log(`\n[SHUTDOWN] ${signal} received — flushing data...`);
  flushToDisk();
  process.exit(0);
}

process.on('SIGINT',  () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
