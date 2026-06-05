// server.js
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'wh_hotel_ultra_secret_key_2026';

// --- DATA ACCESS LAYER VALIDATION ---
const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
  console.error("CRITICAL ERROR: MONGODB_URI missing!");
  process.exit(1);
}

mongoose.connect(MONGODB_URI)
  .then(async () => {
    console.log('🚀 MongoDB Cluster Active with Multi-Department Segregated Routing');
    // Run the automatic user account setup script once connected
    await initializeMasterAccounts();
  })
  .catch(err => console.error('❌ MongoDB Connection Failure:', err));

// --- DATA SCHEMAS ---
const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, required: true }, 
  role: { type: String, required: true, enum: ['admin', 'executive', 'operations', 'reception', 'maintenance', 'housekeeping', 'purchasing', 'reservations', 'accounting', 'sales'] }
});
const User = mongoose.model('User', userSchema);

const requestSchema = new mongoose.Schema({
  guest_name: { type: String, required: true },
  room_number: { type: String, required: true },
  issue_category: { type: String, required: true }, // e.g., 'Engineering & Maintenance', 'Housekeeping Operations', 'Front Office & Concierge', 'Food & Beverage Room Service'
  specific_task: { type: String, required: true },  // e.g., 'AC Repair', 'Fresh Linen'
  notes: { type: String, default: "" },
  status: { type: String, default: 'pending' }, 
  timestamp: { type: Date, default: Date.now }, 
  completedAt: { type: Date },                     
  createdBy: { type: String, required: true },    
  completedBy: { type: String, default: "" }      
});
const Request = mongoose.model('Request', requestSchema);

// Other models kept intact for absolute architectural integrity
const inventorySchema = new mongoose.Schema({ item_name: String, quantity_requested: Number, department: String, status: { type: String, default: 'requested' }, timestamp: { type: Date, default: Date.now }, createdBy: String, completedBy: String, completedAt: Date });
const InventoryOrder = mongoose.model('InventoryOrder', inventorySchema);
const disputeSchema = new mongoose.Schema({ room_number: String, disputed_amount: Number, reason: String, status: { type: String, default: 'pending_review' }, loggedBy: String, reviewedBy: String, timestamp: { type: Date, default: Date.now }, completedAt: Date });
const Dispute = mongoose.model('Dispute', disputeSchema);
const leadSchema = new mongoose.Schema({ company_name: String, contact_person: String, group_rooms_needed: Number, pipeline_stage: { type: String, default: 'Inquiry' }, revenue_estimation: Number, timestamp: { type: Date, default: Date.now }, createdBy: String, completedBy: String, completedAt: Date });
const Lead = mongoose.model('Lead', leadSchema);
const reservationSchema = new mongoose.Schema({ guest_name: String, room_number: String, arrival_date: String, vip_tier: { type: String, default: 'Standard' }, special_amenities: String, timestamp: { type: Date, default: Date.now }, createdBy: String });
const Reservation = mongoose.model('Reservation', reservationSchema);

// --- 🔐 AUTOMATIC USER ACCOUNT SEEDING LOGIC ---
async function initializeMasterAccounts() {
  try {
    // Array of default operator accounts to create if database collections are clean
    const masterSeedUsers = [
      { username: 'admin', password: 'adminpassword123', role: 'admin' },
      { username: 'reception', password: 'receptionpass2026', role: 'reception' },
      { username: 'housekeeping', password: 'hkpass2026', role: 'housekeeping' },
      { username: 'maintenance', password: 'maintenancemod2026', role: 'maintenance' },
      { username: 'operations', password: 'opscorekey2026', role: 'operations' }
    ];

    for (const masterAccount of masterSeedUsers) {
      const accountExists = await User.findOne({ username: masterAccount.username });
      if (!accountExists) {
        const newStaffUser = new User(masterAccount);
        await newStaffUser.save();
        console.log(`✨ AUTO-CREATED ACCOUNT -> User: [${masterAccount.username.toUpperCase()}] | Role: [${masterAccount.role.toUpperCase()}]`);
      }
    }
    console.log('🟢 System Access Profiles are fully initialized and synced.');
  } catch (err) {
    console.error('❌ Failed to verify or inject default master accounts:', err);
  }
}

// --- MIDDLEWARES ---
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Access Denied' });
  jwt.verify(token, JWT_SECRET, (err, decodedUser) => {
    if (err) return res.status(403).json({ error: 'Session Outdated.' });
    req.user = decodedUser; 
    next();
  });
}

function verifyHighTierClearance(req, res, next) {
  if (!['admin', 'executive', 'operations'].includes(req.user.role)) {
    return res.status(403).json({ error: 'Access Denied.' });
  }
  next();
}

// --- HTTP AUTHENTICATION ---
app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Missing input handle credentials.' });

    const user = await User.findOne({ username: username.toLowerCase() });
    if (!user || user.password !== password) return res.status(401).json({ error: 'Invalid security key credentials.' });

    const token = jwt.sign({ username: user.username, role: user.role }, JWT_SECRET, { expiresIn: '30d' });
    res.json({ token, role: user.role, username: user.username });
  } catch (err) { res.status(500).json({ error: 'System processing fault.' }); }
});

// --- 🛎️ DISPATCH WORK QUEUES (EXPLICIT SEGREGATION & FILTER MATRIX) ---
app.get('/api/requests/today', authenticateToken, async (req, res) => {
  try {
    const { startDate, endDate, departmentFilter } = req.query;

    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);

      const oneMonthAgo = new Date();
      oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
      if (start < oneMonthAgo) {
        return res.status(400).json({ error: "Archival logs restricted to 1 month." });
      }

      let query = { timestamp: { $gte: start, $lte: end } };
      if (departmentFilter) query.issue_category = departmentFilter;

      return res.json(await Request.find(query).sort({ timestamp: -1 }));
    }

    const rollingCleanLimit = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000); // 48 Hours
    let pipelineFilter = {};

    if (req.user.role === 'maintenance') {
      pipelineFilter = { 
        issue_category: 'Engineering & Maintenance',
        $or: [{ status: 'pending' }, { status: 'completed' }]
      };
    } else if (req.user.role === 'housekeeping') {
      pipelineFilter = {
        issue_category: 'Housekeeping Operations',
        $or: [{ status: 'pending' }, { status: 'completed' }]
      };
    } else {
      pipelineFilter = {
        $or: [
          { status: 'pending' },
          { issue_category: { $in: ['Engineering & Maintenance', 'Housekeeping Operations', 'Food & Beverage Room Service'] }, status: 'completed' },
          { issue_category: 'Front Office & Concierge', status: 'completed', completedAt: { $gte: rollingCleanLimit } }
        ]
      };
    }

    res.json(await Request.find(pipelineFilter).sort({ timestamp: -1 }));
  } catch (err) { 
    res.status(500).json({ error: 'Failed to crawl documents or compute smart FIFO routing.' }); 
  }
});

app.post('/api/requests', authenticateToken, async (req, res) => {
  try {
    const doc = new Request({ ...req.body, createdBy: req.user.username });
    await doc.save(); 
    io.emit('new_request', doc); 
    res.status(201).json(doc);
  } catch (err) { res.status(400).json({ error: 'Parsing runtime defect.' }); }
});

app.patch('/api/requests/:id/complete', authenticateToken, async (req, res) => {
  try {
    const doc = await Request.findByIdAndUpdate(req.params.id, { status: 'completed', completedAt: new Date(), completedBy: req.user.username }, { new: true });
    io.emit('request_completed', doc); 
    res.json(doc);
  } catch (err) { res.status(500).json({ error: 'Patch trace fault.' }); }
});

// --- BI, ADMINISTRATION & OTHER ENDPOINTS ---
app.get('/api/bi/analytics', authenticateToken, verifyHighTierClearance, async (req, res) => {
  try {
    const ops = await Request.aggregate([{ $facet: { total: [{ $count: "count" }], pending: [{ $match: { status: "pending" } }, { $count: "count" }] } }]);
    res.json({ operations: { total: ops[0].total[0]?.count || 0, pending: ops[0].pending[0]?.count || 0 }, finance: [], sales: [], bookings: { total: 0, vipCount: 0 } });
  } catch (e) { res.status(500).json(e); }
});
app.get('/api/admin/users', authenticateToken, async (req, res) => { if (req.user.role === 'admin') res.json(await User.find({}, 'username role password')); else res.status(403).json({ error: 'Denied' }); });
app.post('/api/admin/users', authenticateToken, async (req, res) => { try { const u = new User(req.body); await u.save(); res.status(201).json(u); } catch (e) { res.status(400).json(e); } });
app.get('/api/purchasing/orders', authenticateToken, async (req, res) => { res.json(await InventoryOrder.find()); });
app.post('/api/purchasing/orders', authenticateToken, async (req, res) => { const doc = new InventoryOrder({ ...req.body, createdBy: req.user.username }); await doc.save(); res.status(201).json(doc); });
app.get('/api/accounting/disputes', authenticateToken, async (req, res) => { res.json(await Dispute.find()); });
app.post('/api/accounting/disputes', authenticateToken, async (req, res) => { const doc = new Dispute({ ...req.body, loggedBy: req.user.username }); await doc.save(); res.status(201).json(doc); });
app.get('/api/reservations', authenticateToken, async (req, res) => { res.json(await Reservation.find()); });
app.post('/api/reservations', authenticateToken, async (req, res) => { const doc = new Reservation({ ...req.body, createdBy: req.user.username }); await doc.save(); res.status(201).json(doc); });
app.get('/api/sales/leads', authenticateToken, async (req, res) => { res.json(await Lead.find()); });
app.post('/api/sales/leads', authenticateToken, async (req, res) => { const doc = new Lead({ ...req.body, createdBy: req.user.username }); await doc.save(); res.status(201).json(doc); });

// --- ⚡ WEBSOCKET INTERACTION MATRIX HUB (BRIDGED LOGIN FIX) ⚡ ---
io.on('connection', (socket) => {
  console.log('📡 Gateway Link Connected via WebSockets.');

  socket.on('system:initialize-session', async (data) => {
    try {
      const targetUser = data.handle ? data.handle.toLowerCase() : '';
      const dbRecord = await User.findOne({ username: targetUser });
      
      if (dbRecord) {
        socket.assignedUser = dbRecord.username;
        socket.assignedRole = dbRecord.role;
        console.log(`🔐 Socket Session Authorized for Account: [${dbRecord.username.toUpperCase()}] Role: [${dbRecord.role}]`);
      } else {
        socket.assignedUser = targetUser || 'front_office_agent';
        socket.assignedRole = 'reception';
        console.log(`⚠️ Unknown User Handle "${targetUser}". Initialized with default RECEPTION parameters.`);
      }

      socket.emit('feed:render-input-controls', { role: socket.assignedRole });
    } catch (err) {
      console.error('Socket authentication processing failure:', err);
    }
  });

  socket.on('request:fetch-live-feed', async () => {
    try {
      const userRole = socket.assignedRole || 'reception';
      let pipelineFilter = {};

      if (userRole === 'maintenance') {
        pipelineFilter = { issue_category: 'Engineering & Maintenance' };
      } else if (userRole === 'housekeeping') {
        pipelineFilter = { issue_category: 'Housekeeping Operations' };
      } else {
        pipelineFilter = {};
      }

      const matchingTasks = await Request.find(pipelineFilter).sort({ timestamp: -1 }).limit(50);
      
      socket.emit('feed:update-display-dashboard', { 
        items: matchingTasks.map(task => ({
          id: task._id,
          location: task.room_number || 'Lobby',
          notes: `${task.specific_task} - ${task.notes || ''}`,
          timestamp: new Date(task.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }))
      });
    } catch (err) {
      console.error('Socket data stream crawling failure:', err);
    }
  });

  socket.on('action:create-dispatch', async (data) => {
    try {
      const newTicket = new Request({
        guest_name: 'Walk-In / Guest',
        room_number: data.location || 'Generic Area',
        issue_category: socket.assignedRole === 'maintenance' ? 'Engineering & Maintenance' : (socket.assignedRole === 'housekeeping' ? 'Housekeeping Operations' : 'Front Office & Concierge'),
        specific_task: 'Operational Task Order',
        notes: data.notes,
        createdBy: socket.assignedUser || 'Operator'
      });
      await newTicket.save();
      
      io.emit('new_request', newTicket);
      io.emit('request:fetch-live-feed');
    } catch (err) {
      console.error('Failed to create socket request:', err);
    }
  });

  socket.on('disconnect', () => {
    console.log('❌ Gateway Link Dropped.');
  });
});

app.get('*', (req, res) => { res.sendFile(path.join(__dirname, 'public', 'index.html')); });

server.listen(PORT, () => console.log(`🚀 Segregated Core Active on Port ${PORT}`));
