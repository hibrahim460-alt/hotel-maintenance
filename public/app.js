// public/app.js
// Central Real-Time Operating Engine Matrix Control Hub

// Initialize dynamic communication link to the backend server
const socket = io();

// Core Architecture State Registry
let currentUserSessionToken = null;

// DOM Element Selectors
const authGatePanel = document.getElementById('auth-gate');
const systemWorkspaceShell = document.getElementById('workspace-shell');
const coreLoginForm = document.getElementById('login-form');
const platformUserBadge = document.getElementById('user-badge');
const logoutActionBtn = document.getElementById('logout-btn');

// -------------------------------------------------------------------------
// 🔐 SESSION GATE & USER AUTHENTICATION
// -------------------------------------------------------------------------
if (coreLoginForm) {
  coreLoginForm.addEventListener('submit', (event) => {
    event.preventDefault();
    
    const inputUserHandle = document.getElementById('login-user');
    const inputSecurityKey = document.getElementById('login-pass');
    
    if (!inputUserHandle || !inputSecurityKey) return;
    
    const userHandleValue = inputUserHandle.value.trim();
    const securityKeyValue = inputSecurityKey.value;
    
    if (userHandleValue !== "" && securityKeyValue !== "") {
      currentUserSessionToken = userHandleValue;
      
      // Update User Identity Badge display text
      if (platformUserBadge) {
        platformUserBadge.innerText = `SYSTEM PROFILE: ${userHandleValue.toUpperCase()}`;
      }
      
      // Toggle view screens smoothly
      if (authGatePanel) authGatePanel.classList.add('hidden');
      if (systemWorkspaceShell) systemWorkspaceShell.classList.remove('hidden');
      
      // Notify the server engine of the new session connection
      socket.emit('system:initialize-session', { 
        handle: currentUserSessionToken,
        timestamp: Date.now() 
      });
      
      // Instantly request the core dashboard live feed data dump
      socket.emit('request:fetch-live-feed');
    }
  });
}

if (logoutActionBtn) {
  logoutActionBtn.addEventListener('click', () => {
    currentUserSessionToken = null;
    
    // Clean out the form string parameters
    document.getElementById('login-user').value = '';
    document.getElementById('login-pass').value = '';
    
    if (systemWorkspaceShell) systemWorkspaceShell.classList.add('hidden');
    if (authGatePanel) authGatePanel.classList.remove('hidden');
  });
}

// -------------------------------------------------------------------------
// 🌐 NATIVE RECEPTION PANEL DATA CONTROLLERS & ACTIONS
// -------------------------------------------------------------------------

// Submit a freshly built front office dispatch down the socket pipe
window.transmitNativeDispatch = function() {
  const areaTargetLocation = document.getElementById('native-dispatch-location');
  const serviceTargetNotes = document.getElementById('native-dispatch-notes');
  
  if (!areaTargetLocation || !serviceTargetNotes) return;
  if (areaTargetLocation.value.trim() === "" || serviceTargetNotes.value.trim() === "") return;
  
  const formattedPacket = {
    location: areaTargetLocation.value.trim(),
    notes: serviceTargetNotes.value.trim(),
    operator: currentUserSessionToken || 'Front Office Operator',
    unixTimestamp: Date.now()
  };
  
  // Send data to the background database stream
  socket.emit('action:create-dispatch', formattedPacket);
  
  // Wipe text inputs clean instantly
  areaTargetLocation.value = '';
  serviceTargetNotes.value = '';
};

// Resolve an active dispatch request
window.resolveNativeDispatch = function(ticketUniqueRecordId) {
  if (!ticketUniqueRecordId) return;
  socket.emit('action:resolve-dispatch', { id: ticketUniqueRecordId });
};

// -------------------------------------------------------------------------
// ⚡ CENTRAL STREAMING WEBSOCKET RESPONSIVE LISTENERS
// -------------------------------------------------------------------------
socket.on('connect', () => {
  console.log('⚡ Central System Connection Link Secured.');
});

// Build the Front Desk input forms dynamically inside Zone A
socket.on('feed:render-input-controls', (payloadData) => {
  const coreInputTargetContainer = document.getElementById('module-input-target');
  if (!coreInputTargetContainer) return;
  
  coreInputTargetContainer.innerHTML = `
    <div class="bg-white p-5 rounded-2xl border border-stone-200 shadow-sm space-y-4">
      <h3 class="text-xs font-black uppercase tracking-wider text-stone-900">Front Desk Dispatch Center</h3>
      <div class="space-y-3">
        <div>
          <label class="text-[10px] uppercase font-bold text-stone-400 block mb-1">Target Location / Room</label>
          <input type="text" id="native-dispatch-location" placeholder="e.g. Room 304 or Lobby" class="w-full p-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-stone-900">
        </div>
        <div>
          <label class="text-[10px] uppercase font-bold text-stone-400 block mb-1">Operational Instructions</label>
          <textarea id="native-dispatch-notes" placeholder="Enter service details specifications..." class="w-full p-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs h-16 focus:outline-none focus:ring-1 focus:ring-stone-900"></textarea>
        </div>
        <button onclick="transmitNativeDispatch()" class="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-mono font-black text-xs uppercase tracking-wider rounded-xl transition shadow-md active:scale-[0.99]">Broadcast Live Order</button>
      </div>
    </div>
  `;
});

// Render the incoming data records dynamically inside Zone B
socket.on('feed:update-display-dashboard', (receivedStreamPayload) => {
  const coreDisplayTargetContainer = document.getElementById('module-display-target');
  if (!coreDisplayTargetContainer) return;
  
  const activeTaskLogsArray = receivedStreamPayload.items || [];
  
  if (activeTaskLogsArray.length === 0) {
    coreDisplayTargetContainer.innerHTML = `
      <div class="h-full border-2 border-dashed border-stone-200 rounded-2xl flex flex-col items-center justify-center p-8 text-center bg-white">
        <span class="text-xl mb-1">📥</span>
        <h3 class="text-xs font-black text-stone-400 uppercase tracking-wider">No Active Dispatches</h3>
        <p class="text-[11px] text-stone-400 max-w-xs mt-0.5">Live streaming requests from your hotel database will appear here automatically.</p>
      </div>
    `;
    return;
  }
  
  let consolidatedLogRecordsHTML = activeTaskLogsArray.map(logRecord => `
    <div class="bg-white border border-stone-200 rounded-xl p-4 shadow-xs flex justify-between items-center transition-all hover:border-stone-300">
      <div class="space-y-1">
        <div class="flex items-center gap-2">
          <span class="bg-stone-950 text-white font-mono font-black text-[9px] px-1.5 py-0.5 rounded uppercase">Loc: ${logRecord.location}</span>
          <span class="text-[10px] text-stone-400 font-medium">${logRecord.timestamp || 'Just Now'}</span>
        </div>
        <p class="text-xs font-bold text-stone-800">${logRecord.notes}</p>
      </div>
      <button onclick="resolveNativeDispatch('${logRecord.id}')" class="px-3 py-1.5 bg-stone-50 hover:bg-stone-100 border border-stone-200 text-stone-700 text-[10px] font-black uppercase rounded-lg transition-all active:scale-[0.97]">Resolve</button>
    </div>
  `).join('');
  
  coreDisplayTargetContainer.innerHTML = `
    <div class="space-y-4">
      <div class="flex justify-between items-center">
        <h2 class="text-xs font-black uppercase tracking-widest text-stone-400">Live Streaming Operational Logs</h2>
        <span class="bg-indigo-50 text-indigo-700 font-mono text-[10px] font-bold px-2 py-0.5 rounded border border-indigo-100 animate-pulse">● Live Pipeline Connected</span>
      </div>
      <div class="space-y-2">${consolidatedLogRecordsHTML}</div>
    </div>
  `;
});
