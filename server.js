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

// --- MONGOOSE PERSISTENCE CONNECTIONS ---
const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
  console.error("CRITICAL ERROR: MONGODB_URI environmental variable missing!");
  process.exit(1);
}

mongoose.connect(MONGODB_URI)
  .then(() => console.log('🚀 Secured high-performance database cluster connection active.'))
  .catch(err => console.error('❌ Data connector link issue:', err));

// --- GLOBAL MONGOOSE SCHEMAS & LOG DATA COLLECTION MODELS ---

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

// --- REST MIDDLEWARES ---
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Token Cryptographic Interceptor & Verification Guard
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Access Denied: Missing Cryptographic Security Payload.' });

  jwt.verify(token, JWT_SECRET, (err, decodedUser) => {
    if (err) return res.status(403).json({ error: 'Access Expired: Please log in again.' });
    req.user = decodedUser; 
    next();
  });
}

// --- 🔐 CENTRALIZED ENTRANCE ROUTE ---
app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const foundUser = await User.findOne({ username: username.toLowerCase() });
    if (!foundUser || foundUser.password !== password) {
      return res.status(401).json({ error: 'Invalid user handle or token string match.' });
    }
    const token = jwt.sign({ username: foundUser.username, role: foundUser.role }, JWT_SECRET, { expiresIn: '30d' });
    res.json({ token, role: foundUser.role, username: foundUser.username });
  } catch (err) { res.status(500).json({ error: 'Internal core state generation failure.' }); }
});

// --- 🛎️ RECEPTION, HOUSEKEEPING & MAINTENANCE PIPELINES ---
app.get('/api/requests/today', authenticateToken, async (req, res) => {
  try {
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    res.json(await Request.find({ $or: [{ timestamp: { $gte: twentyFourHoursAgo } }, { status: 'pending' }] }).sort({ timestamp: -1 }));
  } catch (err) { res.status(500).json({ error: 'Grid query matrix pull failed.' }); }
});

app.post('/api/requests', authenticateToken, async (req, res) => {
  try {
    const newRequest = new Request({ ...req.body, createdBy: req.user.username });
    await newRequest.save(); 
    io.emit('new_request', newRequest); 
    res.status(201).json(newRequest);
  } catch (err) { res.status(400).json({ error: 'Validation parsing structural defect.' }); }
});

app.patch('/api/requests/:id/complete', authenticateToken, async (req, res) => {
  try {
    const data = await Request.findByIdAndUpdate(req.params.id, { status: 'completed', completedAt: new Date(), completedBy: req.user.username }, { new: true });
    io.emit('request_completed', data); 
    res.json(data);
  } catch (err) { res.status(500).json({ error: 'Record patch operational state execution failed.' }); }
});

// --- 📦 PURCHASING PIPELINES ---
app.get('/api/purchasing/orders', authenticateToken, async (req, res) => {
  try { res.json(await InventoryOrder.find().sort({ timestamp: -1 })); } catch (e) { res.status(500).json(e); }
});

app.post('/api/purchasing/orders', authenticateToken, async (req, res) => {
  try {
    const order = new InventoryOrder({ ...req.body, createdBy: req.user.username });
    await order.save(); 
    io.emit('new_request', order); 
    res.status(201).json(order);
  } catch (e) { res.status(400).json(e); }
});

app.patch('/api/purchasing/orders/:id', authenticateToken, async (req, res) => {
  try {
    const order = await InventoryOrder.findByIdAndUpdate(req.params.id, { status: req.body.status, completedBy: req.user.username, completedAt: new Date() }, { new: true });
    io.emit('request_completed', order); 
    res.json(order);
  } catch (e) { res.status(500).json(e); }
});

// --- 🧾 ACCOUNTING AUDITS ---
app.get('/api/accounting/disputes', authenticateToken, async (req, res) => {
  try { res.json(await Dispute.find().sort({ timestamp: -1 })); } catch (e) { res.status(500).json(e); }
});

app.post('/api/accounting/disputes', authenticateToken, async (req, res) => {
  try {
    const dispute = new Dispute({ ...req.body, loggedBy: req.user.username });
    await dispute.save(); 
    io.emit('new_request', dispute); 
    res.status(201).json(dispute);
  } catch (e) { res.status(400).json(e); }
});

app.patch('/api/accounting/disputes/:id', authenticateToken, async (req, res) => {
  try {
    const dispute = await Dispute.findByIdAndUpdate(req.params.id, { status: req.body.status, reviewedBy: req.user.username, completedAt: new Date() }, { new: true });
    io.emit('request_completed', dispute); 
    res.json(dispute);
  } catch (e) { res.status(500).json(e); }
});

// --- 📅 RESERVATION LEDGERS ---
app.get('/api/reservations', authenticateToken, async (req, res) => {
  try { res.json(await Reservation.find().sort({ timestamp: -1 })); } catch (e) { res.status(500).json(e); }
});

app.post('/api/reservations', authenticateToken, async (req, res) => {
  try {
    const r = new Reservation({ ...req.body, createdBy: req.user.username }); 
    await r.save();
    
    if (req.body.special_amenities) {
      const t = new Request({ 
        guest_name: req.body.guest_name, 
        room_number: req.body.room_number, 
        issue_category: req.body.special_amenities, 
        notes: "Automated Setup Request.", 
        createdBy: `System Core (${req.user.username})` 
      });
      await t.save(); 
      io.emit('new_request', t);
    }
    res.json(r);
  } catch (e) { res.status(400).json(e); }
});

// --- 📈 SALES LEAD CHANNELS ---
app.get('/api/sales/leads', authenticateToken, async (req, res) => {
  try { res.json(await Lead.find().sort({ timestamp: -1 })); } catch (e) { res.status(500).json(e); }
});

app.post('/api/sales/leads', authenticateToken, async (req, res) => {
  try {
    const l = new Lead({ ...req.body, createdBy: req.user.username }); 
    await l.save(); 
    io.emit('new_request', l); 
    res.status(201).json(l);
  } catch (e) { res.status(400).json(e); }
});

app.patch('/api/sales/leads/:id', authenticateToken, async (req, res) => {
  try {
    const l = await Lead.findByIdAndUpdate(req.params.id, { pipeline_stage: req.body.pipeline_stage, completedBy: req.user.username, completedAt: new Date() }, { new: true });
    io.emit('request_completed', l); 
    res.json(l);
  } catch (e) { res.status(500).json(e); }
});

// --- 👑 SYSTEM ADMINISTRATION (ADMIN ENFORCED) ---
app.get('/api/admin/users', authenticateToken, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Access Denied: Insufficient Role Security Level Token.' });
  try { 
    res.json(await User.find({}, 'username role password').sort({ username: 1 })); 
  } catch (e) { res.status(500).json(e); }
});

app.post('/api/admin/users', authenticateToken, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Access Denied: Identity generation isolated to system roots.' });
  try {
    const target = new User({ username: req.body.username, password: req.body.password, role: req.body.role });
    await target.save(); 
    res.status(201).json({ message: 'Saved successfully.' });
  } catch (e) { res.status(400).json({ error: 'Handle identifier exists or data structural mutation error.' }); }
});

// --- SPA ROOT CATCH-ALL ROUTER WILDCARD ---
app.get('*', (req, res) => { res.sendFile(path.join(__dirname, 'public', 'index.html')); });

server.listen(PORT, () => console.log(`🚀 Dedicated Server Core Operational Engine loaded on port ${PORT}`));
