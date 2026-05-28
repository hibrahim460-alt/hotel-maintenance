/**
 * ═══════════════════════════════════════════════════════════════
 * WH HOTEL MAINTENANCE REQUEST SYSTEM — Backend Server
 * Stack: Node.js · Express · Socket.io · JSON File Store
 * ═══════════════════════════════════════════════════════════════
 */

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const fs = require('fs');

const app = express();
const httpServer = http.createServer(app);
const io = new Server(httpServer);

const PORT = process.env.PORT || 3000;
const DATA_DIR = path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'requests.json');

// Global request log cache pipeline array store
let requests = [];

const VALID_CATEGORIES = [
  'Toilet', 'AC', 'Carpet', 'Wood', 'Tiles',
  'Painting', 'Room Smell', 'Electricity'
];

// Ensure local persistence database directory layer exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

/* ── Storage IO Utility Handlers ── */
function flushToDisk() {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(requests, null, 2), 'utf8');
  } catch (err) {
    console.error('[DISK_ERROR] Failed writing JSON requests log array context metadata cache layer:', err);
  }
}

function loadFromDisk() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const payload = fs.readFileSync(DATA_FILE, 'utf8');
      requests = JSON.parse(payload || '[]');
      console.log(`[DISK_BOOT] Successfully mounted ${requests.length} core request entries parameters histories records.`);
    }
  } catch (err) {
    console.error('[DISK_ERROR] Failed parsing persistence logs database file storage structures:', err);
    requests = [];
  }
}

/* ── Middlewares configurations ── */
app.use(express.json());
// Serves static client files instantly out of public folder
app.use(express.static(path.join(__dirname, 'public')));

/* ── REST Endpoint Controller Actions Routing Matrix ── */

// heartbeats testing verification link diagnostics tracker
app.get('/api/health', (req, res) => res.json({ status: 'healthy', uptime: process.uptime() }));

// Fetch complete payload matching client tracking queries pipelines rules
app.get('/api/requests/today', (req, res) => {
  // Returns historical array data safely out of internal node context runtime profiles
  return res.json(requests);
});

// Structural Post execution form dispatches entries logs
app.post('/api/requests', (req, res) => {
  const { guest_name, room_number, issue_category, notes = '' } = req.body;
  const errors = [];

  if (!guest_name?.toString().trim())      errors.push('guest_name parameter is required.');
  if (!room_number?.toString().trim())     errors.push('room_number parameter identifier is required.');
  if (!issue_category?.toString().trim())  errors.push('issue_category parameters indicator is required.');
  
  if (issue_category && !VALID_CATEGORIES.includes(issue_category)) {
    errors.push(`Invalid classification choice indicator context constraint. Options: ${VALID_CATEGORIES.join(', ')}`);
  }

  if (errors.length > 0) {
    return res.status(400).json({ success: false, errors });
  }

  // Generate perfect unified instance object tracking logs blocks matrix definitions
  const newRequest = {
    id: Date.now().toString(36) + Math.random().toString(36).substring(2, 6),
    guest_name: guest_name.toString().trim(),
    room_number: room_number.toString().trim(),
    issue_category: issue_category.toString().trim(),
    notes: notes.toString().trim(),
    status: 'pending',
    timestamp: new Date().toISOString(),
    completedAt: null // Perfectly maps template indicators layout criteria requirements
  };

  requests.unshift(newRequest);
  flushToDisk();

  // Instant real-time push dispatches to all active clients connections sockets pipelines hub listeners
  io.emit('new_request', newRequest);

  return res.status(201).json({ success: true, request: newRequest });
});

// Room engineering actions patches switches status values overrides toggling actions methods 
app.patch('/api/requests/:id/complete', (req, res) => {
  const { id } = req.params;
  const request = requests.find(r => r.id === id);

  if (!request) {
    return res.status(404).json({ success: false, errors: ['Target operational sequence identifier index tracker missing.'] });
  }

  // Mutate data layer parameters configurations parameters safely
  request.status = 'completed';
  request.completedAt = new Date().toISOString(); // FIXED: Matches your frontend camelCase expectation!

  flushToDisk();

  // Broadcast out the completion history updates payload safely
  io.emit('request_completed', request);

  return res.json({ success: true, request });
});


/* ── Socket.io Core Engine Layer ── */
let connectedClients = 0;

io.on('connection', (socket) => {
  connectedClients++;
  io.emit('clients_count', connectedClients);

  socket.on('register_role', (role) => {
    const validRoles = ['reception', 'maintenance'];
    if (validRoles.includes(role)) {
      socket.data.role = role;
      socket.join(role);
    }
  });

  socket.on('disconnect', () => {
    connectedClients = Math.max(0, connectedClients - 1);
    io.emit('clients_count', connectedClients);
  });
});

/* ── Launch ── */
loadFromDisk();

httpServer.listen(PORT, () => {
  console.log(`\n====================================================`);
  console.log(`  WH HOTEL MAINTENANCE APPLICATION RUNNING LIVE`);
  console.log(`  Listening safely on host port cluster: ${PORT}`);
  console.log(`====================================================\n`);
});
