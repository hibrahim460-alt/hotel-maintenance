import { secureFetch, showToast } from '../app.js';
let formContainer, viewContainer;
const housekeepingTasks = ["In-house Room Cleaning", "Room Check-out", "add-Extra Bed", "add Baby-Crib ", "Extra Bath Towel"];

export function init(formElement, viewElement) { formContainer = formElement; viewContainer = viewElement; renderWorkspaceLayout(); refresh(); }

function renderWorkspaceLayout() {
  formContainer.innerHTML = `<h3 class="text-[10px] font-black text-stone-400 uppercase tracking-wider">Engineering Work Orders</h3><p class="text-[11px] text-stone-500 leading-normal mt-1">Read-only queue. Clear building structural issues instantly.</p>`;
  viewContainer.innerHTML = `<div id="maint-live-grid" class="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs"></div>`;
}

export async function refresh() {
  const grid = document.getElementById('maint-live-grid'); if (!grid) return;
  try {
    const res = await secureFetch('/api/requests/today'); const data = await res.json();
    const filtered = data.filter(item => !housekeepingTasks.includes(item.issue_category));
    grid.innerHTML = filtered.length === 0 ? `<p class="italic text-stone-400 text-center py-6 sm:col-span-2">All hardware configurations online.</p>` : '';
    filtered.forEach(item => {
      const card = document.createElement('div'); card.className = `p-3 rounded-xl border flex justify-between items-center ${item.status==='completed'?'bg-stone-50/60 opacity-60':'bg-amber-50/20 border-amber-200/60'}`;
      card.innerHTML = `<div><span class="font-black block text-stone-900">Room ${item.room_number}</span><span class="text-amber-800 font-bold block text-[11px] mt-0.5">${item.issue_category}</span></div>`;
      if (item.status === 'pending') {
        const btn = document.createElement('button'); btn.className = "px-2 py-1 bg-stone-900 text-white font-bold text-[9px] rounded-md"; btn.innerText = "Clear Issue";
        btn.onclick = async () => { await secureFetch(`/api/requests/${item._id}/complete`, { method: 'PATCH' }); showToast(`Hardware signature for Room ${item.room_number} cleared.`); refresh(); };
        card.appendChild(btn);
      } else { card.innerHTML += `<span class="text-[9px] font-bold text-emerald-700 uppercase">✓ Operational</span>`; }
      grid.appendChild(card);
    });
  } catch(e){}
}
