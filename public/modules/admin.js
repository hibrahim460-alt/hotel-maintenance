import { secureFetch, showToast } from '../app.js';
let formContainer, viewContainer;

const SYSTEM_ROLES_ARRAY = [
  { id: 'admin', label: '👑 Admin' },
  { id: 'executive', label: '📊 Exec' },
  { id: 'operations', label: '⚙️ Ops' },
  { id: 'reception', label: '🛎️ Front' },
  { id: 'housekeeping', label: '🧹 HK' },
  { id: 'maintenance', label: '🛠️ Eng' },
  { id: 'purchasing', label: '📦 Supply' },
  { id: 'accounting', label: '🧾 Audit' },
  { id: 'sales', label: '📈 Sales' },
  { id: 'reservations', label: '📅 Book' }
];

let currentlyEditingUserId = null;
let cachedUsersList = []; // Local memory cache for instant search filtering

export function init(formElement, viewElement) { 
  formContainer = formElement; 
  viewContainer = viewElement; 
  currentlyEditingUserId = null;
  cachedUsersList = [];
  renderWorkspaceLayout(); 
  refresh(); 
}

function renderWorkspaceLayout() {
  formContainer.innerHTML = `
    <div class="space-y-4 text-stone-900">
      <div>
        <h3 class="text-amber-400 text-xs font-black uppercase tracking-wider">👑 System Security Panel</h3>
        <p class="text-[10px] text-stone-400 mt-0.5 leading-tight">Provision system identifiers, configure granular roles, and monitor user databases.</p>
      </div>
      
      <div id="adm-form-card" class="bg-stone-850 p-4 rounded-xl border border-stone-800 space-y-3">
        <h4 id="form-context-title" class="text-[11px] font-black text-white uppercase tracking-wider">Provision New Account Identity</h4>
        
        <form id="adm-user-form" class="space-y-2.5">
          <div>
            <label class="block text-[9px] uppercase tracking-wider font-bold text-stone-400 mb-1">Account Handle ID</label>
            <input type="text" id="adm_user" required placeholder="e.g. j.smith" class="w-full p-2 bg-stone-800 border border-stone-700 text-white font-mono text-xs rounded-lg focus:outline-none focus:border-amber-400">
          </div>
          
          <div>
            <label class="block text-[9px] uppercase tracking-wider font-bold text-stone-400 mb-1">Security Passkey String</label>
            <input type="text" id="adm_pass" required placeholder="Access password code" class="w-full p-2 bg-stone-800 border border-stone-700 text-white font-mono text-xs rounded-lg focus:outline-none focus:border-amber-400">
          </div>
          
          <div>
            <label class="block text-[9px] uppercase tracking-wider font-bold text-stone-400 mb-1">Clearance Allocation Strategy</label>
            <select id="adm_role" class="w-full p-2 bg-stone-800 border border-stone-700 text-white text-xs rounded-lg focus:outline-none">
              <option value="reception">🛎️ Reception</option>
              <option value="housekeeping">🧹 Housekeeping</option>
              <option value="maintenance">🛠️ Maintenance</option>
              <option value="purchasing">📦 Purchasing</option>
              <option value="reservations">📅 Reservations</option>
              <option value="accounting">🧾 Accounting</option>
              <option value="sales">📈 Sales</option>
              <option value="operations">⚙️ Operations Manager</option>
              <option value="executive">📊 Corporate Senior Executive</option>
              <option value="admin">👑 System Admin</option>
            </select>
          </div>
          
          <div id="form-action-button-group" class="pt-1">
            <button type="submit" class="w-full py-2 bg-amber-500 hover:bg-amber-600 text-stone-950 font-black text-[11px] uppercase tracking-wider rounded-lg transition-all active:scale-[0.99]">
              Provision User Access
            </button>
          </div>
        </form>
      </div>
    </div>
  `;
  
  document.getElementById('adm-user-form').onsubmit = handleFormExecution;
  
  // FIX 3: Real-time font-mono search bar injected above the roster list
  viewContainer.innerHTML = `
    <div class="space-y-4">
      <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b border-stone-200 pb-3">
        <div>
          <h4 class="text-stone-500 text-xs font-black uppercase tracking-wider">System Enrolled Profiles Roster Index</h4>
          <span id="roster-count-badge" class="inline-block mt-0.5 px-2 py-0.5 bg-stone-100 rounded text-[10px] font-bold text-stone-600 border">0 Accounts</span>
        </div>
        <div class="w-full sm:w-64">
          <input type="text" id="adm-roster-search" placeholder="🔍 Search handle or role..." class="w-full p-2 bg-stone-50 border border-stone-200 rounded-xl text-xs font-mono focus:outline-none focus:ring-1 focus:ring-stone-900">
        </div>
      </div>
      <div id="adm-roster-list" class="space-y-2 text-[11px]"></div>
    </div>
  `;

  document.getElementById('adm-roster-search').oninput = handleLocalSearchFilter;
}

export async function refresh() {
  try {
    const res = await secureFetch('/api/admin/users'); 
    cachedUsersList = await res.json() || [];
    renderRosterElementList(cachedUsersList);
  } catch(err) {
    console.error("Roster extraction error context tracing execution stream:", err);
  }
}

function renderRosterElementList(usersArray) {
  const list = document.getElementById('adm-roster-list'); 
  if (!list) return;
  
  document.getElementById('roster-count-badge').innerText = `${usersArray.length} Profiles Visible`;
  
  if (usersArray.length === 0) {
    list.innerHTML = `<div class="p-4 text-center text-xs text-stone-400 italic bg-stone-50 border border-dashed rounded-xl">No matching user accounts identified.</div>`;
    return;
  }

  list.innerHTML = usersArray.map(user => {
    const isEditingThisUser = currentlyEditingUserId === user._id;
    
    return `
      <div class="p-3 bg-white border ${isEditingThisUser ? 'border-indigo-500 shadow-md ring-1 ring-indigo-500/20' : 'border-stone-200'} rounded-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-3 transition-all">
        <div class="space-y-1 w-full">
          <div class="flex items-center gap-2">
            <span class="text-stone-900 font-bold text-xs">${user.username}</span>
            <!-- UNTOUCHED: Plain text badge display preserved exactly from image_f0eca3.png -->
            <span class="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-stone-200 text-stone-700 border border-stone-300/40">${user.password}</span>
          </div>
          
          <div class="pt-1.5 w-full" id="matrix-container-${user._id}">
            ${isEditingThisUser ? `
              <!-- FIX 2: Interactive drop-down selection module dynamically replaces checkboxes during active edits -->
              <div class="flex items-center gap-2 max-w-xs">
                <span class="text-[10px] font-bold uppercase tracking-wider text-indigo-600">Active Authority:</span>
                <select id="inline-edit-role-${user._id}" class="p-1 bg-stone-50 border border-indigo-300 text-stone-900 text-[11px] rounded-md focus:outline-none font-bold">
                  <option value="reception" ${user.role === 'reception' ? 'selected' : ''}>🛎️ Reception</option>
                  <option value="housekeeping" ${user.role === 'housekeeping' ? 'selected' : ''}>🧹 Housekeeping</option>
                  <option value="maintenance" ${user.role === 'maintenance' ? 'selected' : ''}>🛠️ Maintenance</option>
                  <option value="purchasing" ${user.role === 'purchasing' ? 'selected' : ''}>📦 Purchasing</option>
                  <option value="reservations" ${user.role === 'reservations' ? 'selected' : ''}>📅 Reservations</option>
                  <option value="accounting" ${user.role === 'accounting' ? 'selected' : ''}>🧾 Accounting</option>
                  <option value="sales" ${user.role === 'sales' ? 'selected' : ''}>📈 Sales</option>
                  <option value="operations" ${user.role === 'operations' ? 'selected' : ''}>⚙️ Operations</option>
                  <option value="executive" ${user.role === 'executive' ? 'selected' : ''}>📊 Executive</option>
                  <option value="admin" ${user.role === 'admin' ? 'selected' : ''}>👑 Admin</option>
                </select>
              </div>
            ` : `
              <!-- UNTOUCHED: Standard read-only matrix representation mapping active user array roles -->
              <div class="grid grid-cols-5 gap-1.5" id="matrix-grid-${user._id}">
                ${SYSTEM_ROLES_ARRAY.map(roleOption => {
                  const isChecked = user.role === roleOption.id;
                  return `
                    <label class="flex items-center gap-1 text-[9px] font-medium text-stone-500 select-none">
                      <input type="checkbox" 
                             ${isChecked ? 'checked' : ''} 
                             disabled
                             class="rounded border-stone-300 text-indigo-600 focus:ring-0 w-3 h-3 pointer-events-none">
                      <span>${roleOption.label}</span>
                    </label>
                  `;
                }).join('')}
              </div>
            `}
          </div>
        </div>
        
        <div class="flex items-center gap-1.5 shrink-0 w-full md:w-auto justify-end border-t md:border-none pt-2 md:pt-0 border-stone-100">
          ${isEditingThisUser ? `
            <button type="button" 
                    id="btn-save-inline-${user._id}"
                    class="px-2.5 py-1 bg-indigo-600 text-white rounded-lg text-[10px] font-black uppercase tracking-wider shadow-xs hover:bg-indigo-700 transition-all">
              Save
            </button>
            <button type="button" 
                    id="btn-cancel-inline-${user._id}"
                    class="px-2.5 py-1 bg-stone-100 hover:bg-stone-200 text-stone-600 border rounded-lg text-[10px] font-black uppercase tracking-wider transition-all">
              Cancel
            </button>
          ` : `
            <button type="button" 
                    data-edit-btn-id="${user._id}"
                    class="px-2.5 py-1 bg-white hover:bg-stone-50 text-stone-700 border border-stone-200 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all">
              Edit
            </button>
            <button type="button" 
                    data-delete-btn-id="${user._id}"
                    class="px-2.5 py-1 bg-white hover:bg-rose-50 text-rose-600 border border-stone-200 hover:border-rose-200 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all">
              Delete
            </button>
          `}
        </div>
      </div>
    `;
  }).join('');

  // Event handlers attached directly to specific node identifiers
  usersArray.forEach(user => {
    const isEditingThisUser = currentlyEditingUserId === user._id;
    if (isEditingThisUser) {
      document.getElementById(`btn-save-inline-${user._id}`).onclick = () => saveInlineUserChanges(user);
      document.getElementById(`btn-cancel-inline-${user._id}`).onclick = resetFormToDefaultState;
    } else {
      document.querySelector(`[data-edit-btn-id="${user._id}"]`).onclick = () => activateInlineEditState(user);
      document.querySelector(`[data-delete-btn-id="${user._id}"]`).onclick = () => triggerIdentityPurge(user._id);
    }
  });
}

function handleLocalSearchFilter(e) {
  const keyword = e.target.value.toLowerCase().trim();
  if (!keyword) {
    renderRosterElementList(cachedUsersList);
    return;
  }
  const filtered = cachedUsersList.filter(u => 
    u.username.toLowerCase().includes(keyword) || 
    u.role.toLowerCase().includes(keyword)
  );
  renderRosterElementList(filtered);
}

function activateInlineEditState(user) {
  currentlyEditingUserId = user._id;
  
  document.getElementById('form-context-title').innerText = `Retooling Profile: ${user.username}`;
  document.getElementById('adm_user').value = user.username;
  document.getElementById('adm_user').disabled = true; 
  document.getElementById('adm_pass').value = user.password;
  document.getElementById('adm_role').value = user.role;
  
  document.getElementById('form-action-button-group').innerHTML = `
    <div class="grid grid-cols-2 gap-2">
      <button type="submit" class="py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-[10px] uppercase tracking-wider rounded-lg transition-all">
        Save Rights
      </button>
      <button type="button" id="btn-cancel-edit" class="py-2 bg-stone-700 hover:bg-stone-600 text-white font-black text-[10px] uppercase tracking-wider rounded-lg transition-all">
        Cancel
      </button>
    </div>
  `;
  
  document.getElementById('btn-cancel-edit').onclick = resetFormToDefaultState;
  renderRosterElementList(cachedUsersList);
}

function resetFormToDefaultState() {
  currentlyEditingUserId = null;
  const form = document.getElementById('adm-user-form');
  if (form) form.reset();
  
  const userInp = document.getElementById('adm_user');
  if (userInp) userInp.disabled = false;
  
  const title = document.getElementById('form-context-title');
  if (title) title.innerText = "Provision New Account Identity";
  
  const btnGroup = document.getElementById('form-action-button-group');
  if (btnGroup) {
    btnGroup.innerHTML = `
      <button type="submit" class="w-full py-2 bg-amber-500 hover:bg-amber-600 text-stone-950 font-black text-[11px] uppercase tracking-wider rounded-lg transition-all">
        Provision User Access
      </button>
    `;
  }
  
  const searchInput = document.getElementById('adm-roster-search');
  if (searchInput) searchInput.value = '';
  
  refresh();
}

async function saveInlineUserChanges(user) {
  const updatedPassword = document.getElementById('adm_pass').value.trim();
  const updatedRole = document.getElementById(`inline-edit-role-${user._id}`).value;

  const res = await secureFetch(`/api/admin/users/${user._id}`, {
    method: 'PUT',
    body: JSON.stringify({ password: updatedPassword, role: updatedRole })
  });
  const data = await res.json();
  
  if (res.ok) {
    showToast("Identity permission matrix modified successfully.", "success");
    resetFormToDefaultState();
  } else {
    showToast(data.error || "Profile adjustment transaction declined.", "error");
  }
}

async function handleFormExecution(e) {
  e.preventDefault();
  
  const username = document.getElementById('adm_user').value.trim();
  const password = document.getElementById('adm_pass').value.trim();
  const role = document.getElementById('adm_role').value;
  
  if (currentlyEditingUserId) {
    const res = await secureFetch(`/api/admin/users/${currentlyEditingUserId}`, {
      method: 'PUT',
      body: JSON.stringify({ password, role })
    });
    const data = await res.json();
    
    if (res.ok) {
      showToast("Identity permission matrix modified successfully.", "success");
      resetFormToDefaultState();
    } else {
      showToast(data.error || "Profile adjustment transaction declined.", "error");
    }
  } else {
    const res = await secureFetch('/api/admin/users', {
      method: 'POST',
      body: JSON.stringify({ username, password, role })
    });
    const data = await res.json();
    
    if (res.ok) {
      showToast("Identity access privileges provisioned securely.", "success");
      document.getElementById('adm-user-form').reset();
      refresh();
    } else {
      showToast(data.error || "Failed to initialize identity allocation credentials.", "error");
    }
  }
}

async function triggerIdentityPurge(userId) {
  if (!confirm("Confirm Account Purge: Irreversible operational action.")) return;
  
  try {
    const res = await secureFetch(`/api/admin/users/${userId}`, { method: 'DELETE' });
    const data = await res.json();
    
    if (res.ok) {
      showToast("Account dropped from security credential registers successfully.", "success");
      if (currentlyEditingUserId === userId) resetFormToDefaultState();
      refresh();
    } else {
      showToast(data.error || "Purge request denied by security cluster verification checks.", "error");
    }
  } catch(err) {
    showToast("Network fault during execution route removal.", "error");
  }
}
