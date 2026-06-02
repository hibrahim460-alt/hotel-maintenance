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
  .then(() => console.log('🚀 MongoDB Cluster Connection Active'))
  .catch(err => console.error('❌ MongoDB Connection Failure:', err));

// --- DATA SCHEMAS & LOG REPOSITORIES ---

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, required: true }, 
  role: { type: String, required: true, enum: ['admin', 'reception', 'maintenance', 'housekeeping', 'purchasing', 'reservations', 'accounting', 'sales'] }
});
const User = mongoose.model('User', userSchema);

const requestSchema = new mongoose.Schema({
  guest_name: { type: String, required: true },
  room_number: { type: String, required: true },
  issue_category: { type: String, required: true },
  notes: { type: String, default: "" },
  status: { type: String, default: 'pending' }, 
  timestamp: { type: Date, default: Date.now }, 
  completedAt: { type: Date },
  createdBy: { type: String, required: true },    
  completedBy: { type: String, default: "" }      
});
const Request = mongoose.model('Request', requestSchema);

const inventorySchema = new mongoose.Schema({
  item_name: { type: String, required: true },
  quantity_requested: { type: Number, required: true },
  department: { type: String, required: true },
  status: { type: String, default: 'requested', enum: ['requested', 'ordered', 'received'] },
  timestamp: { type: Date, default: Date.now },
  createdBy: { type: String, required: true },
  completedBy: { type: String, default: "" },
  completedAt: { type: Date }
});
const InventoryOrder = mongoose.model('InventoryOrder', inventorySchema);

const disputeSchema = new mongoose.Schema({
  room_number: { type: String, required: true },
  disputed_amount: { type: Number, required: true },
  reason: { type: String, required: true },
  status: { type: String, default: 'pending_review', enum: ['pending_review', 'approved', 'denied'] },
  loggedBy: { type: String, required: true },
  reviewedBy: { type: String, default: "" },
  timestamp: { type: Date, default: Date.now },
  completedAt: { type: Date }
});
const Dispute = mongoose.model('Dispute', disputeSchema);

const leadSchema = new mongoose.Schema({
  company_name: { type: String, required: true },
  contact_person: { type: String, required: true },
  group_rooms_needed: { type: Number, default: 0 },
  pipeline_stage: { type: String, default: 'Inquiry', enum: ['Inquiry', 'Proposal Sent', 'Contract Signed', 'Closed Lost'] },
  revenue_estimation: { type: Number, required: true },
  timestamp: { type: Date, default: Date.now },
  createdBy: { type: String, required: true },
  completedBy: { type: String, default: "" },
  completedAt: { type: Date }
});
const Lead = mongoose.model('Lead', leadSchema);

const reservationSchema = new mongoose.Schema({
  guest_name: { type: String, required: true }, 
  room_number: { type: String, required: true },
  arrival_date: { type: String, required: true }, 
  vip_tier: { type: String, default: 'Standard' },
  special_amenities: { type: String, default: "" }, 
  timestamp: { type: Date, default: Date.now }, 
  createdBy: { type: String, required: true }
});
const Reservation = mongoose.model('Reservation', reservationSchema);

// --- APP CONFIGURE MIDDLEWARES ---
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Security Interceptor Middleware
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Access Denied: Missing Bearer Token Token Payload.' });

  jwt.verify(token, JWT_SECRET, (err, decodedUser) => {
    if (err) return res.status(403).json({ error: 'Session Outdated: Please refresh credentials.' });
    req.user = decodedUser; 
    next();
  });
}

// --- 🔐 AUTHENTICATION ROUTE ---
app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const user = await User.findOne({ username: username.toLowerCase() });
    if (!user || user.password !== password) {
      return res.status(401).json({ error: 'Invalid user or token pair data.' });
    }
    const token = jwt.sign({ username: user.username, role: user.role }, JWT_SECRET, { expiresIn: '30d' });
    res.json({ token, role: user.role, username: user.username });
  } catch (err) { res.status(500).json({ error: 'Internal system fault parameter error.' }); }
});

// --- 📊 EXECUTIVE BI ANALYTICS RECALCULATION DATA ENGINE ---
app.get('/api/bi/analytics', authenticateToken, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Access Blocked: Leadership clearance verification needed.' });
  try {
    const opsMetrics = await Request.aggregate([{ $facet: { total: [{ $count: "count" }], pending: [{ $match: { status: "pending" } }, { $count: "count" }], breakdown: [{ $group: { _id: "$issue_category", count: { $sum: 1 } } }] } }]);
    const accountingMetrics = await Dispute.aggregate([{ $group: { _id: "$status", totalValue: { $sum: "$disputed_amount" }, count: { $sum: 1 } } }]);
    const salesMetrics = await Lead.aggregate([{ $group: { _id: "$pipeline_stage", projectedRevenue: { $sum: "$revenue_estimation" }, leadCount: { $sum: 1 } } }]);
    const totalReservations = await Reservation.countDocuments();
    const vipCount = await Reservation.countDocuments({ vip_tier: { $ne: "Standard" } });

    res.json({
      operations: { total: opsMetrics[0].total[0]?.count || 0, pending: opsMetrics[0].pending[0]?.count || 0, breakdown: opsMetrics[0].breakdown },
      finance: accountingMetrics,
      sales: salesMetrics,
      bookings: { total: totalReservations, vipCount }
    });
  } catch (err) { res.status(500).json({ error: 'BI matrix execution fault.' }); }
});

// --- 🛎️ RECEPTION, HOUSEKEEPING & MAINTENANCE QUEUES ---
app.get('/api/requests/today', authenticateToken, async (req, res) => {
  try {
    const limit = new Date(Date.now() - 24 * 60 * 60 * 1000);
    res.json(await Request.find({ $or: [{ timestamp: { $gte: limit } }, { status: 'pending' }] }).sort({ timestamp: -1 }));
  } catch (err) { res.status(500).json({ error: 'Failed to crawl documents.' }); }
});

app.post('/api/requests', authenticateToken, async (req, res) => {
  try {
    const doc = new Request({ ...req.body, createdBy: req.user.username });
    await doc.save(); io.emit('new_request', doc); res.status(201).json(doc);
  } catch (err) { res.status(400).json({ error: 'Parsing runtime defect.' }); }
});

app.patch('/api/requests/:id/complete', authenticateToken, async (req, res) => {
  try {
    const doc = await Request.findByIdAndUpdate(req.params.id, { status: 'completed', completedAt: new Date(), completedBy: req.user.username }, { new: true });
    io.emit('request_completed', doc); res.json(doc);
  } catch (err) { res.status(500).json({ error: 'Patch trace fault.' }); }
});

// --- 📦 PURCHASING CONTROLLERS ---
app.get('/api/purchasing/orders', authenticateToken, async (req, res) => {
  try { res.json(await InventoryOrder.find().sort({ timestamp: -1 })); } catch (e) { res.status(500).json(e); }
});
app.post('/api/purchasing/orders', authenticateToken, async (req, res) => {
  try { const doc = new InventoryOrder({ ...req.body, createdBy: req.user.username }); await doc.save(); io.emit('new_request', doc); res.status(201).json(doc); } catch (e) { res.status(400).json(e); }
});

// --- 🧾 ACCOUNTING CONTROLLERS ---
app.get('/api/accounting/disputes', authenticateToken, async (req, res) => {
  try { res.json(await Dispute.find().sort({ timestamp: -1 })); } catch (e) { res.status(500).json(e); }
});
app.post('/api/accounting/disputes', authenticateToken, async (req, res) => {
  try { const doc = new Dispute({ ...req.body, loggedBy: req.user.username }); await doc.save(); io.emit('new_request', doc); res.status(201).json(doc); } catch (e) { res.status(400).json(e); }
});

// --- 📅 RESERVATION CONTROLLERS ---
app.get('/api/reservations', authenticateToken, async (req, res) => {
  try { res.json(await Reservation.find().sort({ timestamp: -1 })); } catch (e) { res.status(500).json(e); }
});
app.post('/api/reservations', authenticateToken, async (req, res) => {
  try {
    const doc = new Reservation({ ...req.body, createdBy: req.user.username }); await doc.save();
    if (req.body.special_amenities) {
      const task = new Request({ guest_name: req.body.guest_name, room_number: req.body.room_number, issue_category: req.body.special_amenities, notes: "Automated Pre-Arrival Protocol Trigger.", createdBy: `System Core (${req.user.username})` });
      await task.save(); io.emit('new_request', task);
    }
    res.status(201).json(doc);
  } catch (e) { res.status(400).json(e); }
});

// --- 📈 SALES CONTROLLERS ---
app.get('/api/sales/leads', authenticateToken, async (req, res) => {
  try { res.json(await Lead.find().sort({ timestamp: -1 })); } catch (e) { res.status(500).json(e); }
});
app.post('/api/sales/leads', authenticateToken, async (req, res) => {
  try { const doc = new Lead({ ...req.body, createdBy: req.user.username }); await doc.save(); io.emit('new_request', doc); res.status(201).json(doc); } catch (e) { res.status(400).json(e); }
});

// --- 👑 ADMINISTRATIVE ACCOUNT MANAGEMENT ENFORCEMENTS ---
app.get('/api/admin/users', authenticateToken, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Clearance denied.' });
  try { res.json(await User.find({}, 'username role password').sort({ username: 1 })); } catch (e) { res.status(500).json(e); }
});

app.post('/api/admin/users', authenticateToken, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Root assignment only.' });
  try {
    const profile = new User({ username: req.body.username, password: req.body.password, role: req.body.role });
    await profile.save(); res.status(201).json({ message: 'Identity initialized.' });
  } catch (e) { res.status(400).json({ error: 'Account handle exists on database register indices.' }); }
});

// Wildcard Routing Fallback
app.get('*', (req, res) => { res.sendFile(path.join(__dirname, 'public', 'index.html')); });

server.listen(PORT, () => console.log(`🚀 System Core Live on Port ${PORT}`));
