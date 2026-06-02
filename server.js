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

// --- DATABASE CONNECTION ---
const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
  console.error("CRITICAL ERROR: MONGODB_URI environmental key missing!");
  process.exit(1);
}

mongoose.connect(MONGODB_URI)
  .then(() => console.log('🚀 Secured high-performance database cluster connection active.'))
  .catch(err => console.error('❌ Data connector link issue:', err));

// --- DATA SECURITY & ACCUMULATION LAYER SCHEMAS ---

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
  createdBy
