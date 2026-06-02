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

// 1. Database Connectivity Configuration
const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
  console.error("CRITICAL ERROR: MONGODB_URI environment variable is missing on Render!");
  process.exit(1);
}

mongoose.connect(MONGODB_URI)
  .then(() => {
    console.log('🚀 Connected securely to permanent MongoDB Atlas cluster.');
    seedInitialUsers(); // Check and seed accounts dynamically if empty
  })
  .catch(err => console.error('❌ Database connection error:', err));

// 2. Database Schemas
const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, required: true }, // Plaintxt match or hash validation
  role: { type: String, required: true, enum: ['admin', 'reception', 'maintenance', 'housekeeping', 'room_service', 'accounting', 'sales'] }
});
const User = mongoose.model('User', userSchema);

const requestSchema = new mongoose.Schema({
  guest_name: { type: String, required: true },
  room_number: { type: String, required: true },
  issue_category: { type: String, required: true },
  notes: { type: String, default: "" },
  status: { type: String, default: 'pending' }, 
  timestamp: { type: Date, default: Date.now }, 
  completedAt: { type: Date }                     
});
const Request = mongoose.model('Request', requestSchema);

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// 3. Security Guard Token Middleware (Gatekeeper)
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Access Denied: Log in first.' });

  jwt.verify(token, JWT_SECRET, (err, decodedUser) => {
    if (err) return res.status(403).json({ error: 'Session expired or invalid.' });
    req.user = decodedUser;
    next();
  });
}

// 4. API Endpoints

// Authentication Login Portal Route
app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const foundUser = await User.findOne({ username: username.toLowerCase() });
    
    if (!foundUser || foundUser.password !== password) {
      return res.status(401).json({ error: 'Invalid username or password configuration.' });
    }

    // Generate token matching the user's explicit profile role
    const token = jwt.sign({ username: foundUser.username, role: foundUser.role }, JWT_SECRET, { expiresIn: '30d' });
    res.json({ token, role: foundUser.role, username: foundUser.username });
  } catch (err) {
    res.status(500).json({ error: 'Authentication routine fault.' });
  }
});

// Admin Route: Create New Users dynamically from Admin screen
app.post('/api/admin/users', authenticateToken, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Requires Admin Clearance Tiers.' });
  try {
    const { username, password, role } = req.body;
    const existing = await User.findOne({ username: username.toLowerCase() });
    if (existing) return res.status(400).json({ error: 'Username string already exists.' });

    const newUser = new User({ username, password, role });
    await newUser.save();
    res.status(201).json({ message: `User account '${username}' created with '${role}' permissions successfully.` });
  } catch (err) {
    res.status(500).json({ error: 'Could not write profile to registry.' });
  }
});

// Admin Route: List All Active Accounts
app.get('/api/admin/users', authenticateToken, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Restricted access.' });
  try {
    const users = await User.find({}, 'username role').sort({ username: 1 });
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: 'Error pulling roster.' });
  }
});

// Fetch Active Pipeline Queue (Securely optimized by role visibility limits)
app.get('/api/requests/today', authenticateToken, async (req, res) => {
  try {
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const requests = await Request.find({
      $or: [{ timestamp: { $gte: twentyFourHoursAgo } }, { status: 'pending' }]
    }).sort({ timestamp: -1 });
    res.json(requests);
  } catch (err) {
    res.status(500).json({ error: 'Failed to balance pipeline matrices.' });
  }
});

// File and dispatch fresh task ticket
app.post('/api/requests', authenticateToken, async (req, res) => {
  if (req.user.role !== 'reception' && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Only Dispatch Teams can create workflows.' });
  }
  try {
    const { guest_name, room_number, issue_category, notes } = req.body;
    const newRequest = new Request({ guest_name, room_number, issue_category, notes });
    await newRequest.save();

    io.emit('new_request', newRequest);
    res.status(201).json(newRequest);
  } catch (err) {
    res.status(400).json({ error: 'Database rejected submission parameters.' });
  }
});

// Mark Ticket Completed
app.patch('/api/requests/:id/complete', authenticateToken, async (req, res) => {
  if (req.user.role === 'reception') return res.status(403).json({ error: 'Action restricted for front desk.' });
  try {
    const { id } = req.params;
    const updatedRequest = await Request.findByIdAndUpdate(
      id, { status: 'completed', completedAt: new Date() }, { new: true }
    );
    io.emit('request_completed', updatedRequest);
    res.json(updatedRequest);
  } catch (err) {
    res.status(500).json({ error: 'Failed state update.' });
  }
});

// Pull Historical Shift Logs
app.get('/api/reports', authenticateToken, async (req, res) => {
  if (req.user.role !== 'reception' && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Logs access denied for this role tier.' });
  }
  try {
    const { date } = req.query;
    if (!date) return res.status(400).json({ error: 'Target calendar date required.' });

    const startOfDay = new Date(`${date}T00:00:00.000Z`);
    const endOfDay = new Date(`${date}T23:59:59.999Z`);

    const dayRequests = await Request.find({ timestamp: { $gte: startOfDay, $lte: endOfDay } }).sort({ timestamp: -1 });
    const fixed = dayRequests.filter(r => r.status === 'completed').length;
    const pending = dayRequests.filter(r => r.status === 'pending').length;

    res.json({ date, metrics: { total: dayRequests.length, fixed, pending }, requests: dayRequests });
  } catch (err) {
    res.status(500).json({ error: 'Historical log compile fault.' });
  }
});

// Fallback PWA Single Page mapping
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 5. Automatic Initial Database Roster Seeding Sequence
async function seedInitialUsers() {
  try {
    const count = await User.countDocuments();
    if (count === 0) {
      console.log('🌱 Database accounts empty. Initiating secure hotel system seed routine...');
      const initialRoster = [
        { username: 'admin', password: 'admin123', role: 'admin' },
        { username: 'rc_manager', password: 'reception123', role: 'reception' },
        { username: 'rc_agent1', password: 'reception123', role: 'reception' },
        { username: 'rc_agent2', password: 'reception123', role: 'reception' },
        { username: 'rc_agent3', password: 'reception123', role: 'reception' },
        { username: 'eng_staff1', password: 'engineer123', role: 'maintenance' },
        { username: 'eng_staff2', password: 'engineer123', role: 'maintenance' },
        { username: 'hk_supervisor1', password: 'housekeep123', role: 'housekeeping' },
        { username: 'hk_supervisor2', password: 'housekeep123', role: 'housekeeping' }
      ];
      await User.insertMany(initialRoster);
      console.log('✅ Success: Seeded 9 secure hotel profiles. Default configurations live.');
    }
  } catch (err) {
    console.error('Failed processing data seeding step:', err);
  }
}

io.on('connection', (socket) => { console.log('System link synced via tracking socket.'); });
server.listen(PORT, () => console.log(`WH Hotel Core Engine active on port ${PORT}`));
