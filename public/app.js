const socket = io();

export const AppState = {
  token: localStorage.getItem('token') || '',
  role: localStorage.getItem('role') || '',
  username: localStorage.getItem('username') || '',
  modules: {}
};

document.addEventListener('DOMContentLoaded', () => {
  if (AppState.token) { initializeWorkspace(); } 
  else { document.getElementById('login-form').addEventListener('submit', handleLoginRequest); }
  document.getElementById('logout-btn').addEventListener('click', terminateSession);
});

async function handleLoginRequest(e) {
  e.preventDefault();
  const username = document.getElementById('login-user').value.trim();
  const password = document.getElementById('login-pass').value;

  try {
    const response = await fetch('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, password }) });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Authorization Denied.');

    localStorage.setItem('token', data.token);
    localStorage.setItem('role', data.role);
    localStorage.setItem('username', data.username);

    AppState.token = data.token; AppState.role = data.role; AppState.username = data.username;
    showToast(`Access Verified. Initializing environment Matrix.`, 'success');
    initializeWorkspace();
  } catch (err) { showToast(err.message, 'error'); }
}

function terminateSession() { localStorage.clear(); location.reload(); }

async function initializeWorkspace() {
  document.getElementById('auth-gate').classList.add('hidden');
  const shell = document.getElementById('workspace-shell'); shell.classList.remove('hidden');

  const badge = document.getElementById('user-badge');
  badge.innerHTML = `<span class="w-2 h-2 rounded-full bg-indigo-500 inline-block animate-pulse"></span> SYSTEM PROFILE: ${AppState.username.toUpperCase()} (${AppState.role.toUpperCase()})`;

  const inputTarget = document.getElementById('module-input-target');
  const displayTarget = document.getElementById('module-display-target');
  
  if (['admin', 'executive', 'operations'].includes(AppState.role)) {
    const shellWrapper = document.querySelector('#workspace-shell > .max-w-7xl');
    shellWrapper.className = "max-w-7xl w-full mx-auto p-4 sm:p-6 space-y-8";
    
    shellWrapper.innerHTML = `
      <div id="management-deck-row" class="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <section class="lg:col-span-4 space-y-4">
          <div id="mgmt-ctrl-slot" class="bg-stone-900 text-white p-6 rounded-2xl border border-stone-800 shadow-xl h-fit"></div>
          <div>
            <button id="btn-global-purge" class="w-full py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-black text-[11px] uppercase tracking-wider rounded-xl transition shadow-md">
              🧼 Clean Resolved History
            </button>
          </div>
        </section>
        <section id="mgmt-view-slot" class="lg:col-span-8 bg-white text-stone-900 p-6 rounded-2xl border border-stone-200 shadow-sm max-h-[460px] overflow-y-auto"></section>
      </div>
      
      <div class="border-t border-stone-200 pt-6">
        <h2 class="text-xs font-black uppercase tracking-widest text-stone-400 mb-6 flex items-center gap-2">
          <span class="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-ping"></span> Live Global Sub-System Instances
        </h2>
        <div id="master-admin-grid" class="grid grid-cols-1 xl:grid-cols-2 gap-8"></div>
      </div>
    `;

    document.getElementById('btn-global-purge').onclick = triggerHistoryCleanup;

    if (AppState.role === 'admin') {
      const adminModule = await import('./modules/admin.js');
      adminModule.init(document.getElementById('mgmt-ctrl-slot'), document.getElementById('mgmt-view-slot'));
      AppState.modules['admin'] = adminModule;
    } else {
      const reportsModule = await import('./modules/reports.js');
      reportsModule.init(document.getElementById('mgmt-ctrl-slot'), document.getElementById('mgmt-view-slot'));
      AppState.modules['reports'] = reportsModule;
    }

    const monitoringApps = ['bi', 'reception', 'housekeeping', 'maintenance', 'purchasing', 'accounting', 'sales', 'reservations'];
    const gridElement = document.getElementById('master-admin-grid');

    for (const app of monitoringApps) {
      const widget = document.createElement('div');
      widget.className = "bg-white p-6 rounded-2xl border border-stone-200/90 shadow-xs space-y-4";
      widget.innerHTML = `
        <div class="flex justify-between items-center border-b border-stone-100 pb-2">
          <h4 class="text-xs font-black uppercase tracking-wider text-stone-400">Application Node Module: ${app}</h4>
          <span class="w-1.5 h-1.5 rounded-full bg-indigo-500 shadow-xs"></span>
        </div>
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div id="${app}-input-slot" class="md:col-span-1"></div>
          <div id="${app}-display-slot" class="md:col-span-2 max-h-[350px] overflow-y-auto pr-1"></div>
        </div>
      `;
      gridElement.appendChild(widget);

      try {
        const component = await import(`./modules/${app}.js`);
        component.init(document.getElementById(`${app}-input-slot`), document.getElementById(`${app}-display-slot`));
        AppState.modules[app] = component;
      } catch (err) { console.error(`Component mapping execution breakdown on frame: ${app}`, err); }
    }

  } else {
    // Standard Department User View layout integration
    inputTarget.innerHTML = `
      <div class="space-y-4">
        <div id="standard-input-anchor"></div>
        <button id="btn-dept-purge" class="w-full py-2 bg-rose-600 hover:bg-rose-700 text-white font-black text-[11px] uppercase tracking-wider rounded-xl transition shadow-md">
          🧼 Clean My Department History
        </button>
      </div>
    `;
    document.getElementById('btn-dept-purge').onclick = triggerHistoryCleanup;

    try {
      const standardModule = await import(`./modules/${AppState.role}.js`);
      AppState.modules[AppState.role] = standardModule; 
      standardModule.init(document.getElementById('standard-input-anchor'), displayTarget);
    } catch (e) { showToast("Initialization runtime failure.", "error"); }
  }
}

export async function triggerHistoryCleanup() {
  if (!confirm("Confirm Purge: This will safely delete ALL COMPLETED requests inside your access level. All pending requests will stay active. Proceed?")) return;
  try {
    const res = await secureFetch('/api/requests/clean', { method: 'DELETE' });
    const data = await res.json();
    if (res.ok) {
      showToast(data.message, 'success');
    } else {
      showToast(data.error || 'Purge action declined.', 'error');
    }
  } catch (err) {
    showToast('Network error while running history wipe.', 'error');
  }
}

export async function secureFetch(url, options = {}) {
  options.headers = { ...options.headers, 'Authorization': `Bearer ${AppState.token}`, 'Content-Type': 'application/json' };
  const res = await fetch(url, options); if (res.status === 403 || res.status === 401) terminateSession(); return res;
}

export function showToast(msg, type = 'info') {
  const t = document.getElementById('global-toast'); t.innerText = msg;
  t.className = `fixed bottom-5 right-5 z-50 transition-all duration-300 px-4 py-3 rounded-xl shadow-xl font-bold text-white text-xs uppercase tracking-wide ${type === 'success' ? 'bg-emerald-600' : type === 'error' ? 'bg-rose-600' : 'bg-stone-900'}`;
  t.classList.remove('translate-y-20', 'opacity-0'); setTimeout(() => t.classList.add('translate-y-20', 'opacity-0'), 3500);
}

socket.on('new_request', () => { Object.values(AppState.modules).forEach(m => { if (m.refresh) m.refresh(); }); });
socket.on('request_completed', () => { Object.values(AppState.modules).forEach(m => { if (m.refresh) m.refresh(); }); });
