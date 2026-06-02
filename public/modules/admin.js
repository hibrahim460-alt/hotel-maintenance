import { secureFetch, showToast } from '../app.js';
let formContainer, viewContainer;

export function init(formElement, viewElement) { formContainer = formElement; viewContainer = viewElement; renderWorkspaceLayout(); refresh(); }

function renderWorkspaceLayout() {
  formContainer.innerHTML = `
    <div class="space-y-4 text-stone-900">
      <div><h3 class="text-amber-400 text-xs font-black uppercase tracking-wider">👑 System Security Panel</h3><p class="text-[10px] text-stone-400 mt-0.5 leading-tight">Provision system identifiers, configure roles, and monitor user databases.</p></div>
      <form id="adm-user-form" class="space-y-2">
        <input type="text" id="adm_user" required placeholder="User Handle ID" class="w-full p-2 bg-stone-800 border border-stone-700 text-white font-mono text-xs rounded-lg focus:outline-none focus:border-amber-400">
        <input type="text" id="adm_pass" required placeholder="Security Password string" class="w-full p-2 bg-stone-800 border border-stone-700 text-white font-mono text-xs rounded-lg focus:outline-none focus:border-amber-400">
        <select id="adm_role" class="w-full p-2 bg-stone-800 border border-stone-700 text-white text-xs rounded-lg focus:outline-none">
          <option value="reception">🛎️ Reception</option><option value="housekeeping">🧹 Housekeeping</option><option value="maintenance">🛠️ Maintenance</option><option value="purchasing">📦 Purchasing</option><option value="reservations">📅 Reservations</option><option value="accounting">🧾 Accounting</option><option value="sales">📈 Sales</option><option value="admin">👑 System Admin</option>
        </select>
        <button type="submit" class="w-full py-2 bg-amber-500 hover:bg-amber-600 text-stone-950 font-black text-[11px] uppercase tracking-wider rounded-lg transition-all">Provision User Access</button>
      </form>
    </div>
  `;
  document.getElementById('adm-user-form').onsubmit = handleUserCreation;
  viewContainer.innerHTML = `<div class="space-y-3">
    <div class="flex justify-between items-center border-b border-stone-800 pb-1.5"><h4 class="text-amber-400 text-xs font-black uppercase tracking-wider">System Enrolled Profiles Roster Index</h4><span id="roster-count-badge" class="px-2 py-0.5 bg-stone-800 rounded text-[10px] font-bold text-white">0 Accounts</span></div>
    <div id="adm-roster-list" class="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] font-mono"></div>
  </div>`;
}

export async function refresh() {
  const list = document.getElementById('adm-roster-list'); if (!list) return;
  try {
    const res = await secureFetch('/api/admin/users'); const data = await res.json();
    document.getElementById('roster-count-badge').innerText = `${data.length} Profiles Active`;
    list.innerHTML = data.map(u => `
      <div class="p-2.5 bg-stone-900 border border-stone-800 rounded-xl flex justify-between items-center">
        <div><span class="text-white font-bold block">${u.username}</span><span class="text-stone-500 text-[10px] uppercase block mt-0.5 font-sans font-bold ${u.role==='admin'?'text-amber-400':''}">clearance: ${u.role}</span></div>
        <span class="text-emerald-400 bg-emerald-950/20 border border-emerald-900/30 px-2 py-0.5 rounded text-[10px] font-bold">${u.password}</span>
      </div>`).join('');
  } catch(e){}
}

async function handleUserCreation(e) {
  e.preventDefault();
  const payload = { username: document.getElementById('adm_user').value.trim(), password: document.getElementById('adm_pass').value.trim(), role: document.getElementById('adm_role').value };
  const res = await secureFetch('/api/admin/users', { method: 'POST', body: JSON.stringify(payload) });
  if (res.ok) { showToast("Identity provision matrix active.", "success"); document.getElementById('adm-user-form').reset(); refresh(); }
}
