import { secureFetch, showToast } from '../app.js';

let formContainer, viewContainer;

export function init(formElement, viewElement) {
  formContainer = formElement;
  viewContainer = viewElement;
  renderWorkspaceLayout();
  refresh();
}

// REST OF FILE SAME PATTERN
function renderWorkspaceLayout() {
  formContainer.innerHTML = `
    <h3 class="text-xs font-black text-stone-400 uppercase tracking-wider mb-3">Booking Portal</h3>
    <form id="res-work-form" class="space-y-3">
      <input type="text" id="res_guest" required placeholder="Guest Full Name" class="w-full p-2 border text-xs rounded-lg focus:outline-none">
      <input type="text" id="res_room" required placeholder="Assigned Room" class="w-full p-2 border text-xs rounded-lg focus:outline-none">
      <input type="date" id="res_date" required class="w-full p-2 border text-xs rounded-lg focus:outline-none">
      <select id="res_vip" class="w-full p-2 border text-xs rounded-lg focus:outline-none">
        <option value="Standard">Standard Registration</option>
        <option value="VIP">⭐ VIP Executive Tier</option>
        <option value="VVVIP">👑 Crown Tier Protocol</option>
      </select>
      <select id="res_setup" class="w-full p-2 border text-xs rounded-lg focus:outline-none">
        <option value="">No pre-arrival setup triggers</option>
        <option value="add Baby-Crib ">Deploy Baby-Crib</option>
        <option value="add-Extra Bed">Deploy Rollaway Bed</option>
      </select>
      <button type="submit" class="w-full py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs uppercase tracking-wide rounded-lg shadow-sm transition">Lock Booking</button>
    </form>
  `;

  document.getElementById('res-work-form').onsubmit = handleFormSubmission;

  viewContainer.innerHTML = `
    <div class="bg-white p-6 rounded-2xl border border-stone-200 shadow-xs">
      <h3 class="text-lg font-black tracking-tight text-stone-900 mb-4">📅 Registered Upcoming Arrival Ledger</h3>
      <div id="res-live-list" class="grid grid-cols-1 sm:grid-cols-2 gap-3"></div>
    </div>
  `;
}

export async function refresh() {
  const container = document.getElementById('res-live-list');
  if (!container) return;

  try {
    const res = await secureFetch('/api/reservations');
    const data = await res.json();
    
    container.innerHTML = '';
    if (data.length === 0) {
      container.innerHTML = `<p class="text-xs text-stone-400 italic py-6 sm:col-span-2 text-center">No reservations logged on file indices.</p>`;
      return;
    }

    data.forEach(item => {
      const div = document.createElement('div');
      div.className = `p-4 rounded-xl border ${item.vip_tier !== 'Standard' ? 'bg-amber-50/30 border-amber-200/80' : 'bg-stone-50/40 border-stone-200'}`;
      
      div.innerHTML = `
        <div class="flex justify-between items-start text-xs">
          <div>
            <span class="font-black text-stone-900 block text-sm">${item.guest_name}</span>
            <span class="text-stone-600 block font-medium mt-0.5">Room ${item.room_number} • Target: ${item.arrival_date}</span>
            ${item.special_amenities ? `<span class="inline-block mt-2 px-2 py-0.5 text-[9px] font-black bg-stone-900 text-white rounded uppercase tracking-wider">Auto-Task: ${item.special_amenities}</span>` : ''}
          </div>
          <span class="px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider bg-white border border-stone-200">${item.vip_tier}</span>
        </div>
      `;
      container.appendChild(div);
    });
  } catch (e) {
    showToast("Booking file generation fault.", "error");
  }
}

async function handleFormSubmission(e) {
  e.preventDefault();
  const payload = {
    guest_name: document.getElementById('res_guest').value.trim(),
    room_number: document.getElementById('res_room').value.trim(),
    arrival_date: document.getElementById('res_date').value,
    vip_tier: document.getElementById('res_vip').value,
    special_amenities: document.getElementById('res_setup').value
  };

  const res = await secureFetch('/api/reservations', { method: 'POST', body: JSON.stringify(payload) });
  if (res.ok) {
    showToast("Reservation verified. Pre-arrival tasks cross-routed to housekeeping pipelines.");
    document.getElementById('res-work-form').reset();
    refresh();
  }
}
