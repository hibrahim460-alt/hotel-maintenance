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
    console.error('[DISK_ERROR] Failed writing JSON requests log array:', err);
  }
}

function loadFromDisk() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const payload = fs.readFileSync(DATA_FILE, 'utf8');
      const rawRequests = JSON.parse(payload || '[]');
      
      // Keep a moving retention window of exactly 7 days
      const oneWeekAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);

      requests = rawRequests.filter(item => {
        const itemTime = new Date(item.timestamp).getTime();
        return !isNaN(itemTime) && itemTime >= oneWeekAgo;
      });

      if (requests.length !== rawRequests.length) {
        flushToDisk();
        console.log(`[CLEANUP] Automated maintenance routine purged ${rawRequests.length - requests.length} expired logs older than 7 days.`);
      }

      console.log(`[DISK_BOOT] Mounted ${requests.length} core historical entries within retention window.`);
    }
  } catch (err) {
    console.error('[DISK_ERROR] Failed parsing persistence database file:', err);
    requests = [];
  }
}

/* ── Middlewares ── */
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

/* ── REST Endpoints Controller Actions ── */

// Heartbeats diagnostic tracker
app.get('/api/health', (req, res) => res.json({ status: 'healthy', uptime: process.uptime() }));

// Fetch complete live payload 
app.get('/api/requests/today', (req, res) => {
  return res.json(requests);
});

// Dynamic date-based report filter endpoint
app.get('/api/reports', (req, res) => {
  const { date } = req.query; // Expects format: YYYY-MM-DD
  
  if (!date) {
    return res.status(400).json({ errors: ['A valid date parameter (YYYY-MM-DD) is required.'] });
  }

  const filteredRequests = requests.filter(item => {
    return item.timestamp && item.timestamp.startsWith(date);
  });

  const total = filteredRequests.length;
  const fixed = filteredRequests.filter(r => r.status === 'completed').length;
  const pending = filteredRequests.filter(r => r.status === 'pending').length;

  return res.json({
    date,
    metrics: { total, fixed, pending },
    requests: filteredRequests
  });
});

// Ticket creation endpoint
app.post('/api/requests', (req, res) => {
  const { guest_name, room_number, issue_category, notes = '' } = req.body;
  const errors = [];

  if (!guest_name?.toString().trim())      errors.push('guest_name is required.');
  if (!room_number?.toString().trim())     errors.push('room_number is required.');
  if (!issue_category?.toString().trim())  errors.push('issue_category is required.');
  
  if (issue_category && !VALID_CATEGORIES.includes(issue_category)) {
    errors.push(`Invalid classification choice. Options: ${VALID_CATEGORIES.join(', ')}`);
  }

  if (errors.length > 0) {
    return res.status(400).json({ success: false, errors });
  }

  const newRequest = {
    id: Date.now().toString(36) + Math.random().toString(36).substring(2, 6),
    guest_name: guest_name.toString().trim(),
    room_number: room_number.toString().trim(),
    issue_category: issue_category.toString().trim(),
    notes: notes.toString().trim(),
    status: 'pending',
    timestamp: new Date().toISOString(),
    completedAt: null 
  };

  requests.unshift(newRequest);
  flushToDisk();

  io.emit('new_request', newRequest);

  return res.status(201).json({ success: true, request: newRequest });
});

// Job resolution toggle action
app.patch('/api/requests/:id/complete', (req, res) => {
  const { id } = req.params;
  const request = requests.find(r => r.id === id);

  if (!request) {
    return res.status(404).json({ success: false, errors: ['Target operational index identifier missing.'] });
  }

  request.status = 'completed';
  request.completedAt = new Date().toISOString();

  flushToDisk();

  io.emit('request_completed', request);

  return res.json({ success: true, request });
});

/* ── Socket.io Connection Core ── */
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

loadFromDisk();

httpServer.listen(PORT, () => {
  console.log(`\n====================================================`);
  console.log(`  WH HOTEL MAINTENANCE APPLICATION RUNNING LIVE`);
  console.log(`  Listening safely on host port cluster: ${PORT}`);
  console.log(`====================================================\n`);
});