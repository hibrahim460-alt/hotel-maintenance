// public/app.js
// Central Front-End Dynamic Link System

const socket = io();

let authToken = null;
let userProfile = null;

// DOM Anchors
const authGatePanel = document.getElementById('auth-gate');
const systemWorkspaceShell = document.getElementById('workspace-shell');
const coreLoginForm = document.getElementById('login-form');
const platformUserBadge = document.getElementById('user-badge');
const logoutActionBtn = document.getElementById('logout-btn');
const loginErrorDisplay = document.getElementById('login-error-msg');

// -------------------------------------------------------------------------
// 🔐 AUTH LINK TO API/AUTH/LOGIN ENDPOINT
// -------------------------------------------------------------------------
if (coreLoginForm) {
  coreLoginForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (loginErrorDisplay) loginErrorDisplay.classList.add('hidden');

    const inputUserHandle = document.getElementById('login-user').value.trim();
    const inputSecurityKey = document.getElementById('login-pass').value;

    try {
      // Direct integration to your exact server.js HTTP Authentication logic
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/express+json', 'Accept': 'application/json', 'content-type': 'application/json' },
        body: JSON.stringify({ username: inputUserHandle, password: inputSecurityKey })
      });

      const dataPacket = await response.json();

      if (!response.ok) {
        throw new Error(dataPacket.error || 'Authentication parameters rejected.');
      }

      // Store credentials inside local session variables safely
      authToken = dataPacket.token;
      userProfile = { username: dataPacket.username, role: dataPacket.role };

      // Update visibility badge text element parameters
      if (platformUserBadge) {
        platformUserBadge.innerText = `SYSTEM PROFILE: ${userProfile.username.toUpperCase()} (${userProfile.role.toUpperCase()})`;
      }

      // Transition layouts smoothly
      if (authGatePanel) authGatePanel.classList.add('hidden');
      if (systemWorkspaceShell) systemWorkspaceShell.classList.remove('hidden');

      // Bridge connection right inside the real-time websocket cluster channels
      socket.emit('system:initialize-session', { handle: userProfile.username });
      socket.emit('request:fetch-live-feed');

    } catch (err) {
      console.error('Core link error:', err.message);
      if (loginErrorDisplay) {
        loginErrorDisplay.innerText = `❌ REJECTED: ${err.message}`;
        loginErrorDisplay.classList.remove('hidden');
      }
    }
  });
}

if (logoutActionBtn) {
  logoutActionBtn.addEventListener('click', () => {
    authToken = null;
    userProfile = null;
    document.getElementById('login-user').value = '';
    document.getElementById('login-pass').value = '';
    
    if (systemWorkspaceShell) systemWorkspaceShell.classList.add('hidden');
    if (authGatePanel) authGatePanel.classList.remove('hidden');
    switchAppTab('reception');
  });
}

// -------------------------------------------------------------------------
// 🎛️ TAB SWITCHING MECHANISM
// -------------------------------------------------------------------------
window.switchAppTab = function(targetTabName) {
  document.querySelectorAll('.tab-panel').forEach(panel => panel.classList.add('hidden'));
  
  const navigationButtons = ['reception', 'housekeeping', 'logbook', 'maintenance'];
  navigationButtons.forEach(btnName => {
    const btnElement = document.getElementById(`tab-btn-${btnName}`);
    if (btnElement) {
      btnElement.classList.remove('bg-white', 'text-stone-900', 'shadow-xs', 'font-black');
      btnElement.classList.add('text-stone-500', 'font-bold');
    }
  });
  
  const targetedPanel = document.getElementById(`view-panel-${targetTabName}`);
  if (targetedPanel) targetedPanel.classList.remove('hidden');
  
  const targetedBtn = document.getElementById(`tab-btn-${targetTabName}`);
  if (targetedBtn) {
    targetedBtn.classList.remove('text-stone-500', 'font-bold');
    targetedBtn.classList.add('bg-white', 'text-stone-900', 'shadow-xs', 'font-black');
  }

  if (targetTabName === 'reception') {
    socket.emit('request:fetch-live-feed');
  }
};

// -------------------------------------------------------------------------
// 🌐 OPERATIONS TRANSMISSIONS VIA WEBSOCKET CHANNELS
// -------------------------------------------------------------------------
window.transmitNativeDispatch = function() {
  const areaTargetLocation = document.getElementById('native-dispatch-location');
  const serviceTargetNotes = document.getElementById('native-dispatch-notes');
  
  if (!areaTargetLocation || !serviceTargetNotes) return;
  if (areaTargetLocation.value.trim() === "" || serviceTargetNotes.value.trim() === "") return;
  
  socket.emit('action:create-dispatch', {
    location: areaTargetLocation.value.trim(),
    notes: serviceTargetNotes.value.trim()
  });
  
  areaTargetLocation.value = '';
  serviceTargetNotes.value = '';
};

window.resolveNativeDispatch = function(ticketUniqueRecordId) {
  if (!ticketUniqueRecordId) return;
  socket.emit('action:resolve-dispatch', { id: ticketUniqueRecordId });
};

// -------------------------------------------------------------------------
// ⚡ CORE SOCKET RESPONSIVE HOOKS
// -------------------------------------------------------------------------
socket.on('feed:render-input-controls', () => {
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
