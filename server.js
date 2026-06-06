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
  .then(() => console.log('🚀 MongoDB Cluster Active with Multi-Department Segregated Routing'))
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
  issue_category: { type: String, required: true }, 
  specific_task: { type: String, required: true },  
  notes: { type: String, default: "" },
  status: { type: String, default: 'pending' }, 
  timestamp: { type: Date, default: Date.now }, 
  completedAt: { type: Date },                  
  createdBy: { type: String, required: true },    
  completedBy: { type: String, default: "" }      
});
const Request = mongoose.model('Request', requestSchema);

const inventorySchema = new mongoose.Schema({ item_name: String, quantity_requested: Number, department: String, status: { type: String, default: 'requested' }, timestamp: { type: Date, default: Date.now }, createdBy: String, completedBy: String, completedAt: Date });
const InventoryOrder = mongoose.model('InventoryOrder', inventorySchema);
const disputeSchema = new mongoose.Schema({ room_number: String, disputed_amount: Number, reason: String, status: { type: String, default: 'pending_review' }, loggedBy: String, reviewedBy: String, timestamp: { type: Date, default: Date.now }, completedAt: Date });
const Dispute = mongoose.model('Dispute', disputeSchema);
const leadSchema = new mongoose.Schema({ company_name: String, contact_person: String, group_rooms_needed: Number, pipeline_stage: { type: String, default: 'Inquiry' }, revenue_estimation: Number, timestamp: { type: Date, default: Date.now }, createdBy: String, completedBy: String, completedAt: Date });
const Lead = mongoose.model('Lead', leadSchema);
const reservationSchema = new mongoose.Schema({ guest_name: String, room_number: String, arrival_date: String, vip_tier: { type: String, default: 'Standard' }, special_amenities: String, timestamp: { type: Date, default: Date.now }, createdBy: String });
const Reservation = mongoose.model('Reservation', reservationSchema);

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

// --- AUTHENTICATION ---
app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const user = await User.findOne({ username: username.toLowerCase() });
    if (!user || user.password !== password) return res.status(401).json({ error: 'Invalid parameters.' });
    const token = jwt.sign({ username: user.username, role: user.role }, JWT_SECRET, { expiresIn: '30d' });
    res.json({ token, role: user.role, username: user.username });
  } catch (err) { res.status(500).json({ error: 'System fault.' }); }
});

// --- DISPATCH WORK QUEUES ---
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

    const rollingCleanLimit = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000); 
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
    res.status(500).json({ error: 'Failed to crawl documents.' }); 
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

// --- Live Aggregation Pipeline Engine for BI Panel ---
app.get('/api/bi/analytics', authenticateToken, verifyHighTierClearance, async (req, res) => {
  try {
    const opsData = await Request.aggregate([
      {
        $facet: {
          metrics: [
            {
              $group: {
                _id: null,
                total: { $sum: 1 },
                pending: { $sum: { $cond: [{ $eq: ["$status", "pending"] }, 1, 0] } }
              }
            }
          ],
          breakdown: [
            { $group: { _id: "$issue_category", count: { $sum: 1 } } }
          ]
        }
      }
    ]);

    const financeData = await Dispute.aggregate([
      { $group: { _id: "$status", totalValue: { $sum: "$disputed_amount" } } }
    ]);

    const salesData = await Lead.aggregate([
      { $group: { _id: "$pipeline_stage", projectedRevenue: { $sum: "$revenue_estimation" } } }
    ]);

    const bookingsData = await Reservation.aggregate([
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          vipCount: {
            $sum: {
              $cond: [{ $in: ["$vip_tier", ["VIP", "Executive", "Premium"]] }, 1, 0]
            }
          }
        }
      }
    ]);

    res.json({
      operations: {
        total: opsData[0]?.metrics[0]?.total || 0,
        pending: opsData[0]?.metrics[0]?.pending || 0,
        breakdown: opsData[0]?.breakdown || []
      },
      finance: financeData || [],
      sales: salesData || [],
      bookings: {
        total: bookingsData[0]?.total || 0,
        vipCount: bookingsData[0]?.vipCount || 0
      }
    });
  } catch (e) { 
    res.status(500).json({ error: 'Aggregation failure.' }); 
  }
});

// --- Dynamic Cross-Department Compiled Reporting Engine ---
app.get('/api/reports/compiled', authenticateToken, verifyHighTierClearance, async (req, res) => {
  try {
    const { department } = req.query;
    let records = [];

    switch (department) {
      case 'reception':
        records = await Request.find({ issue_category: 'Front Office & Concierge' }).sort({ timestamp: -1 });
        break;
      case 'housekeeping':
        records = await Request.find({ issue_category: 'Housekeeping Operations' }).sort({ timestamp: -1 });
        break;
      case 'maintenance':
        records = await Request.find({ issue_category: 'Engineering & Maintenance' }).sort({ timestamp: -1 });
        break;
      case 'purchasing':
        records = await InventoryOrder.find().sort({ timestamp: -1 });
        break;
      case 'accounting':
        records = await Dispute.find().sort({ timestamp: -1 });
        break;
      case 'reservations':
        records = await Reservation.find().sort({ timestamp: -1 });
        break;
      case 'sales':
        records = await Lead.find().sort({ timestamp: -1 });
        break;
      default:
        return res.status(400).json({ error: "Invalid target entity sector parameter." });
    }
    res.json(records || []);
  } catch (err) {
    res.status(500).json({ error: "Database retrieval stream breakdown." });
  }
});

// --- ADMINISTRATIVE MANAGEMENT ROUTES ---
app.get('/api/admin/users', authenticateToken, async (req, res) => { 
  if (req.user.role === 'admin') res.json(await User.find({}, 'username role password')); 
  else res.status(403).json({ error: 'Denied' }); 
});

app.post('/api/admin/users', authenticateToken, async (req, res) => { 
  try { 
    const u = new User(req.body); 
    await u.save(); 
    res.status(201).json(u); 
  } catch (e) { res.status(400).json({ error: 'Failed to provision identity profile context.' }); } 
});

app.put('/api/admin/users/:id', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Access Denied.' });
    const { password, role } = req.body;
    const updatedUser = await User.findByIdAndUpdate(req.params.id, { password, role }, { new: true });
    res.json(updatedUser);
  } catch (err) {
    res.status(500).json({ error: 'Identity transformation route execution blocked.' });
  }
});

app.delete('/api/admin/users/:id', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Access Denied.' });
    await User.findByIdAndDelete(req.params.id);
    res.json({ message: 'Identity context safely dropped from tracking loops.' });
  } catch (err) {
    res.status(500).json({ error: 'Identity purging sequence generated a storage error.' });
  }
});

// Catch-all route mapping
app.get('*', (req, res) => { res.sendFile(path.join(__dirname, 'public', 'index.html')); });

server.listen(PORT, () => console.log(`🚀 Centralized Segregated Core Active on Port ${PORT}`));
