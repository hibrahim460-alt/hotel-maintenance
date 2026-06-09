require('dotenv').config();

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
const JWT_SECRET = process.env.JWT_SECRET || 'hotel_insecure_dev_fallback_change_me';

if (!process.env.JWT_SECRET) {
  console.warn('⚠️  JWT_SECRET is not set — using an insecure fallback. Set it before going live.');
}

const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
  console.error('CRITICAL ERROR: MONGODB_URI missing!');
  process.exit(1);
}

mongoose.connect(MONGODB_URI, {
  serverSelectionTimeoutMS: 10000,   // fail fast if Atlas is unreachable
  socketTimeoutMS: 45000,
  maxPoolSize: 10                    // reuse connections instead of opening new ones per request
})
  .then(() => console.log('🚀 MongoDB connected'))
  .catch(err => { console.error('❌ MongoDB Connection Failure:', err); process.exit(1); });

// Runtime resilience: log drops and recoveries instead of dying silently.
mongoose.connection.on('disconnected', () => console.warn('⚠️  MongoDB disconnected — driver will retry.'));
mongoose.connection.on('reconnected', () => console.log('✅ MongoDB reconnected.'));
mongoose.connection.on('error', (err) => console.error('MongoDB runtime error:', err.message));

// ----------------------------- DATA SCHEMAS -----------------------------
const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, required: true },
  role: {
    type: String,
    required: true,
    enum: ['admin', 'executive', 'operations', 'reception', 'maintenance', 'housekeeping', 'purchasing', 'reservations', 'accounting', 'sales']
  }
});
const User = mongoose.model('User', userSchema);

const requestSchema = new mongoose.Schema({
  guest_name: { type: String, required: true },
  room_number: { type: String, required: true },
  issue_category: { type: String, required: true },
  specific_task: { type: String, required: true },
  notes: { type: String, default: '' },
  status: { type: String, default: 'pending' },
  timestamp: { type: Date, default: Date.now },
  completedAt: { type: Date },
  createdBy: { type: String, required: true },
  completedBy: { type: String, default: '' }
});
const Request = mongoose.model('Request', requestSchema);

// Indexes: these are the fields every queue and report filters/sorts on.
// Without them, queries scan the whole collection and slow down as data grows.
requestSchema.index({ issue_category: 1, timestamp: -1 }); // department queues
requestSchema.index({ status: 1, timestamp: -1 });         // pending vs completed views
requestSchema.index({ timestamp: -1 });                    // date-range reports
requestSchema.index({ room_number: 1 });                   // per-room history

const InventoryOrder = mongoose.model('InventoryOrder', new mongoose.Schema({ item_name: String, quantity_requested: Number, department: String, status: { type: String, default: 'requested' }, timestamp: { type: Date, default: Date.now }, createdBy: String }));
const Dispute = mongoose.model('Dispute', new mongoose.Schema({ room_number: String, disputed_amount: Number, reason: String, status: { type: String, default: 'pending_review' }, loggedBy: String, timestamp: { type: Date, default: Date.now } }));
const Lead = mongoose.model('Lead', new mongoose.Schema({ company_name: String, contact_person: String, group_rooms_needed: Number, pipeline_stage: { type: String, default: 'Inquiry' }, revenue_estimation: Number, timestamp: { type: Date, default: Date.now }, createdBy: String }));
const Reservation = mongoose.model('Reservation', new mongoose.Schema({ guest_name: String, room_number: String, arrival_date: String, vip_tier: { type: String, default: 'Standard' }, special_amenities: String, timestamp: { type: Date, default: Date.now }, createdBy: String }));

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ----------------------------- AUTH / RBAC MIDDLEWARE -----------------------------
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

const ELEVATED_ROLES = ['admin', 'executive', 'operations'];

function verifyHighTierClearance(req, res, next) {
  if (!ELEVATED_ROLES.includes(req.user.role)) {
    return res.status(403).json({ error: 'Access Denied.' });
  }
  next();
}

// Allow the listed department roles PLUS the elevated roles, so the executive/ops/admin
// monitoring grid can read & seed every module's data.
function requireRole(...roles) {
  const allowed = new Set([...roles, ...ELEVATED_ROLES]);
  return (req, res, next) => {
    if (!allowed.has(req.user.role)) return res.status(403).json({ error: 'Access Denied.' });
    next();
  };
}

function requireAdmin(req, res, next) {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Access Denied.' });
  next();
}

// ----------------------------- AUTH -----------------------------
app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const user = await User.findOne({ username: username.toLowerCase() });
    if (!user || user.password !== password) return res.status(401).json({ error: 'Invalid parameters.' });
    const token = jwt.sign({ username: user.username, role: user.role }, JWT_SECRET, { expiresIn: '30d' });
    res.json({ token, role: user.role, username: user.username });
  } catch (err) { res.status(500).json({ error: 'System fault.' }); }
});

// ----------------------------- REQUESTS (service tasks) -----------------------------
app.get('/api/requests/today', authenticateToken, async (req, res) => {
  try {
    const { startDate, endDate, departmentFilter } = req.query;
    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      // 30-day archival cap. Lift this for manager/exec roles if you need deeper history.
      if (start < new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)) {
        return res.status(400).json({ error: 'Archival logs restricted to 1 month.' });
      }
      let query = { timestamp: { $gte: start, $lte: end } };
      if (departmentFilter) query.issue_category = departmentFilter;
      return res.json(await Request.find(query).sort({ timestamp: -1 }));
    }

    let pipelineFilter = {};
    if (req.user.role === 'maintenance') {
      pipelineFilter = { issue_category: 'Engineering & Maintenance' };
    } else if (req.user.role === 'housekeeping') {
      pipelineFilter = { issue_category: 'Housekeeping Operations' };
    }
    res.json(await Request.find(pipelineFilter).sort({ timestamp: -1 }));
  } catch (err) { res.status(500).json({ error: 'Failed to crawl documents.' }); }
});

app.post('/api/requests', authenticateToken, async (req, res) => {
  try {
    const { room_number, guest_name, issue_category, specific_task } = req.body;
    if (!room_number || !guest_name || !issue_category || !specific_task) {
      return res.status(400).json({ error: 'Missing required fields: room_number, guest_name, issue_category, specific_task.' });
    }
    const doc = new Request({ ...req.body, createdBy: req.user.username });
    await doc.save();
    io.emit('new_request', doc);
    res.status(201).json(doc);
  } catch (err) { res.status(400).json({ error: 'Parsing runtime defect.' }); }
});

app.patch('/api/requests/:id/complete', authenticateToken, async (req, res) => {
  try {
    const doc = await Request.findByIdAndUpdate(
      req.params.id,
      { status: 'completed', completedAt: new Date(), completedBy: req.user.username },
      { new: true }
    );
    io.emit('request_completed', doc);
    res.json(doc);
  } catch (err) { res.status(500).json({ error: 'Patch trace fault.' }); }
});

// ----------------------------- ACCOUNTING (disputes) -----------------------------
app.get('/api/accounting/disputes', authenticateToken, requireRole('accounting'), async (req, res) => {
  try { res.json(await Dispute.find({}).sort({ timestamp: -1 })); }
  catch (e) { res.status(500).json({ error: 'Failed to load disputes.' }); }
});

app.post('/api/accounting/disputes', authenticateToken, requireRole('accounting'), async (req, res) => {
  try {
    const doc = new Dispute({ ...req.body, loggedBy: req.user.username });
    await doc.save();
    res.status(201).json(doc);
  } catch (e) { res.status(400).json({ error: 'Failed to log dispute.' }); }
});

// ----------------------------- RESERVATIONS -----------------------------
app.get('/api/reservations', authenticateToken, requireRole('reservations'), async (req, res) => {
  try { res.json(await Reservation.find({}).sort({ timestamp: -1 })); }
  catch (e) { res.status(500).json({ error: 'Failed to load reservations.' }); }
});

app.post('/api/reservations', authenticateToken, requireRole('reservations'), async (req, res) => {
  try {
    const doc = new Reservation({ ...req.body, createdBy: req.user.username });
    await doc.save();
    res.status(201).json(doc);
  } catch (e) { res.status(400).json({ error: 'Failed to save reservation.' }); }
});

// ----------------------------- PURCHASING -----------------------------
app.get('/api/purchasing/orders', authenticateToken, requireRole('purchasing'), async (req, res) => {
  try { res.json(await InventoryOrder.find({}).sort({ timestamp: -1 })); }
  catch (e) { res.status(500).json({ error: 'Failed to load orders.' }); }
});

app.post('/api/purchasing/orders', authenticateToken, requireRole('purchasing'), async (req, res) => {
  try {
    const doc = new InventoryOrder({ ...req.body, createdBy: req.user.username });
    await doc.save();
    res.status(201).json(doc);
  } catch (e) { res.status(400).json({ error: 'Failed to file requisition.' }); }
});

// ----------------------------- SALES (leads) -----------------------------
app.get('/api/sales/leads', authenticateToken, requireRole('sales'), async (req, res) => {
  try { res.json(await Lead.find({}).sort({ timestamp: -1 })); }
  catch (e) { res.status(500).json({ error: 'Failed to load leads.' }); }
});

app.post('/api/sales/leads', authenticateToken, requireRole('sales'), async (req, res) => {
  try {
    const doc = new Lead({ ...req.body, createdBy: req.user.username });
    await doc.save();
    res.status(201).json(doc);
  } catch (e) { res.status(400).json({ error: 'Failed to register lead.' }); }
});

// ----------------------------- COMPILED REPORTS (manager audit deck) -----------------------------
app.get('/api/reports/compiled', authenticateToken, verifyHighTierClearance, async (req, res) => {
  try {
    const dept = req.query.department;
    let data;
    switch (dept) {
      case 'maintenance':
        data = await Request.find({ issue_category: 'Engineering & Maintenance' }).sort({ timestamp: -1 }); break;
      case 'housekeeping':
        data = await Request.find({ issue_category: 'Housekeeping Operations' }).sort({ timestamp: -1 }); break;
      case 'reception':
        data = await Request.find({ issue_category: 'Front Office & Concierge' }).sort({ timestamp: -1 }); break;
      case 'purchasing':
        data = await InventoryOrder.find({}).sort({ timestamp: -1 }); break;
      case 'accounting':
        data = await Dispute.find({}).sort({ timestamp: -1 }); break;
      case 'reservations':
        data = await Reservation.find({}).sort({ timestamp: -1 }); break;
      case 'sales':
        data = await Lead.find({}).sort({ timestamp: -1 }); break;
      default:
        return res.status(400).json({ error: 'Unknown department selector.' });
    }
    res.json(data);
  } catch (e) { res.status(500).json({ error: 'Report compilation failure.' }); }
});

// ----------------------------- BI ANALYTICS -----------------------------
app.get('/api/bi/analytics', authenticateToken, verifyHighTierClearance, async (req, res) => {
  try {
    const opsData = await Request.aggregate([
      { $facet: { metrics: [{ $group: { _id: null, total: { $sum: 1 }, pending: { $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] } } } }], breakdown: [{ $group: { _id: '$issue_category', count: { $sum: 1 } } }] } }
    ]);
    const financeData = await Dispute.aggregate([{ $group: { _id: '$status', totalValue: { $sum: '$disputed_amount' } } }]);
    const salesData = await Lead.aggregate([{ $group: { _id: '$pipeline_stage', projectedRevenue: { $sum: '$revenue_estimation' } } }]);
    const bookingsData = await Reservation.aggregate([{ $group: { _id: null, total: { $sum: 1 }, vipCount: { $sum: { $cond: [{ $in: ['$vip_tier', ['VIP', 'Executive', 'Premium']] }, 1, 0] } } } }]);

    res.json({
      operations: {
        total: opsData[0]?.metrics?.[0]?.total || 0,
        pending: opsData[0]?.metrics?.[0]?.pending || 0,
        breakdown: opsData[0]?.breakdown || []
      },
      finance: financeData || [],
      sales: salesData || [],
      bookings: { total: bookingsData[0]?.total || 0, vipCount: bookingsData[0]?.vipCount || 0 }
    });
  } catch (e) { res.status(500).json({ error: 'Aggregation failure.' }); }
});

// ----------------------------- ADMIN: USER MANAGEMENT -----------------------------
app.get('/api/admin/users', authenticateToken, requireAdmin, async (req, res) => {
  res.json(await User.find({}, 'username role password'));
});

app.post('/api/admin/users', authenticateToken, requireAdmin, async (req, res) => {
  try { const u = new User(req.body); await u.save(); res.status(201).json(u); }
  catch (e) { res.status(400).json({ error: 'Failed provisioning (duplicate handle or invalid role).' }); }
});

app.put('/api/admin/users/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { password, role } = req.body;
    const update = {};
    if (password) update.password = password;
    if (role) update.role = role;
    const u = await User.findByIdAndUpdate(req.params.id, update, { new: true, runValidators: true });
    if (!u) return res.status(404).json({ error: 'User not found.' });
    res.json(u);
  } catch (e) { res.status(400).json({ error: 'Profile adjustment declined.' }); }
});

app.delete('/api/admin/users/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    await User.findByIdAndDelete(req.params.id);
    res.json({ message: 'Purged' });
  } catch (err) { res.status(500).json({ error: 'Error.' }); }
});

// ----------------------------- ADMIN: PURGE COMPLETED TASK HISTORY -----------------------------
app.delete('/api/admin/requests/completed', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const result = await Request.deleteMany({ status: 'completed' });
    res.json({ message: 'Completed task history purged.', deletedCount: result.deletedCount });
  } catch (err) { res.status(500).json({ error: 'Purge failed.' }); }
});

// ----------------------------- HEALTH CHECK -----------------------------
// Lightweight endpoint for uptime monitors and Render. readyState 1 = connected.
app.get('/api/health', (req, res) => {
  const dbUp = mongoose.connection.readyState === 1;
  res.status(dbUp ? 200 : 503).json({ status: dbUp ? 'ok' : 'degraded', db: dbUp });
});

// Unknown API routes should return JSON, not the HTML shell.
app.use('/api', (req, res) => res.status(404).json({ error: 'Unknown API route.' }));

// ----------------------------- SPA FALLBACK -----------------------------
app.get('*', (req, res) => { res.sendFile(path.join(__dirname, 'public', 'index.html')); });

server.listen(PORT, () => console.log(`🚀 Hotel Core OS active on Port ${PORT}`));
