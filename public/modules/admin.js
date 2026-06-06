// =========================================================================
// ADMINISTRATIVE PRIVILEGES MATRIX & IDENTITY ACCESS INTERACTION KERNEL
// =========================================================================

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

// The simulated logged-in operator clearance vector (For UI access control rules evaluation)
const CURRENT_LOGGED_IN_OPERATOR_ROLE = "admin"; 

export function init(formElement, viewElement) { 
  formContainer = formElement; 
  viewContainer = viewElement; 
  currentlyEditingUserId = null;
  renderWorkspaceLayout(); 
  refresh(); 
}

function renderWorkspaceLayout() {
  formContainer.innerHTML = `
    <div class="space-y-4 text-stone-900">
      <div>
        <h3 class="text-stone-800 text-xs font-black uppercase tracking-wider">👑 System Security Panel</h3>
        <p class="text-[10px] text-stone-500 mt-0.5 leading-tight">Provision system identifiers, configure granular roles, and monitor user databases.</p>
      </div>
      
      <div id="adm-form-card" class="bg-white p-4 rounded-xl border border-stone-200 space-y-3 shadow-sm">
        <h4 id="form-context-title" class="text-[11px] font-black text-stone-700 uppercase tracking-wider">Provision New Account Identity</h4>
        
        <form id="adm-user-form" class="space-y-2.5">
          <div>
            <label class="block text-[9px] uppercase tracking-wider font-bold text-stone-500 mb-1">Account Handle ID</label>
            <input type="text" id="adm_user" required placeholder="e.g. j.smith" class="w-full p-2 bg-stone-50 border border-stone-200 text-stone-900 font-mono text-xs rounded-lg focus:outline-none focus:border-indigo-500">
          </div>
          
          <div>
            <label class="block text-[9px] uppercase tracking-wider font-bold text-stone-500 mb-1">Security Passkey String</label>
            <input type="text" id="adm_pass" required placeholder="Access password code" class="w-full p-2 bg-stone-50 border border-stone-200 text-stone-900 font-mono text-xs rounded-lg focus:outline-none focus:border-indigo-500">
          </div>
          
          <div>
            <label class="block text-[9px] uppercase tracking-wider font-bold text-stone-500 mb-1">Clearance Allocation Strategy</label>
            <select id="adm_role" class="w-full p-2 bg-stone-50 border border-stone-200 text-stone-900 text-xs rounded-lg focus:outline-none focus:border-indigo-500">
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
            <button type="submit" class="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-[11px] uppercase tracking-wider rounded-lg transition-all active:scale-[0.99]">
              Provision User Access
            </button>
          </div>
        </form>
      </div>
    </div>
  `;
  
  document.getElementById('adm-user-form').onsubmit = handleFormExecution;
  
  viewContainer.innerHTML = `
    <div class="space-y-4">
      <div class="border-b border-stone-200 pb-3 flex justify-between items-center">
        <h4 class="text-stone-500 text-xs font-black uppercase tracking-wider">System Enrolled Profiles Roster Index</h4>
        
        <!-- Global purging execution node hidden context strategy -->
        <button id="global-purge-btn" class="hidden text-[9px] bg-rose-600 hover:bg-rose-700 text-white font-black uppercase tracking-wider px-2 py-1 rounded-md transition-all">
          ⚠️ Purge App Database
        </button>
      </div>
      <div id="adm-roster-list" class="space-y-2 text-[11px]"></div>
    </div>
  `;

  evaluateGlobalPurgeAuthorization();
}

/**
 * Strict role-based validation cleanup restriction filter
 * Permits access to: 'admin' (Admin), 'executive' (CEO), and 'operations' (COO)
 */
function evaluateGlobalPurgeAuthorization() {
  const purgeBtn = document.getElementById('global-purge-btn');
  if (!purgeBtn) return;

  const permittedPurgeRoles = ['admin', 'executive', 'operations'];
  
  if (permittedPurgeRoles.includes(CURRENT_LOGGED_IN_OPERATOR_ROLE)) {
    purgeBtn.classList.remove('hidden');
    purgeBtn.onclick = async () => {
      if (confirm("CRITICAL INTERVENTION: Purge all system identity data storage parameters across all nodes?")) {
        try {
          const res = await secureFetch('/api/admin/purge-all', { method: 'POST' });
          if (res.ok) {
            showToast("System database wiped successfully.", "success");
            refresh();
          } else {
            showToast("Purge execution rejected by server boundary.", "error");
          }
        } catch (err) {
          showToast("Network connection timeout during deep purge execution.", "error");
        }
      }
    };
  }
}

// Data Fetch & Synchronization Interface Row
export async function refresh() {
  try {
    const res = await secureFetch('/api/admin/users'); 
    const users = await res.json() || [];
    renderRosterElementList(users);
  } catch(err) {
    console.error("Roster retrieval fault error context trace:", err);
  }
}

function renderRosterElementList(usersArray) {
  const list = document.getElementById('adm-roster-list'); 
  if (!list) return;
  
  if (usersArray.length === 0) {
    list.innerHTML = `<div class="p-4 text-center text-xs text-stone-400 italic bg-white border border-dashed border-stone-200 rounded-xl">No active user accounts found.</div>`;
    return;
  }

  list.innerHTML = usersArray.map(user => {
    return `
      <div class="p-3 bg-white border border-stone-200 rounded-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-3 transition-all">
        <div class="space-y-1 w-full">
          <div class="flex items-center gap-2">
            <span class="text-stone-900 font-bold text-xs">${user.username}</span>
            <span class="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-stone-100 text-stone-600 border border-stone-200">${user.password}</span>
          </div>
          
          <div class="pt-1.5 w-full">
            <div class="grid grid-cols-5 gap-1.5" id="matrix-grid-${user._id}">
              ${SYSTEM_ROLES_ARRAY.map(roleOption => {
                const isChecked = user.role === roleOption.id;
                return `
                  <label class="flex items-center gap-1 text-[9px] font-medium text-stone-400 select-none">
                    <input type="checkbox" 
                           ${isChecked ? 'checked' : ''} 
                           disabled
                           class="rounded border-stone-300 text-indigo-600 focus:ring-0 w-3 h-3 pointer-events-none">
                    <span class="${isChecked ? 'text-indigo-600 font-bold' : ''}">${roleOption.label}</span>
                  </label>
                `;
              }).join('')}
            </div>
          </div>
        </div>
        
        <div class="flex items-center gap-1.5 shrink-0 w-full md:w-auto justify-end border-t md:border-none pt-2 md:pt-0 border-stone-100">
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
        </div>
      </div>
    `;
  }).join('');

  // Event handlers registration loop
  usersArray.forEach(user => {
    const editBtn = document.querySelector(`[data-edit-btn-id="${user._id}"]`);
    const delBtn = document.querySelector(`[data-delete-btn-id="${user._id}"]`);
    if (editBtn) editBtn.onclick = () => activateEditState(user);
    if (delBtn) delBtn.onclick = () => triggerIdentityPurge(user._id);
  });
}

function activateEditState(user) {
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
      <button type="button" id="btn-cancel-edit" class="py-2 bg-stone-200 hover:bg-stone-300 text-stone-700 font-black text-[10px] uppercase tracking-wider rounded-lg transition-all">
        Cancel
      </button>
    </div>
  `;
  
  document.getElementById('btn-cancel-edit').onclick = resetFormToDefaultState;
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
      <button type="submit" class="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-[11px] uppercase tracking-wider rounded-lg transition-all">
        Provision User Access
      </button>
    `;
  }
  
  refresh();
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
      showToast("Identity permissions modified successfully.", "success");
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
      showToast(data.error || "Failed to initialize identity credentials.", "error");
    }
  }
}

async function triggerIdentityPurge(userId) {
  if (!confirm("Confirm Account Purge?")) return;
  
  try {
    const res = await secureFetch(`/api/admin/users/${userId}`, { method: 'DELETE' });
    if (res.ok) {
      showToast("Account removed from registers successfully.", "success");
      if (currentlyEditingUserId === userId) resetFormToDefaultState();
      refresh();
    } else {
      showToast("Purge request denied.", "error");
    }
  } catch(err) {
    showToast("Network fault during profile deletion.", "error");
  }
}
