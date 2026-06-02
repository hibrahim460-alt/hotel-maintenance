import { secureFetch, showToast } from '../app.js';
let formContainer, viewContainer;
const hkCats = ["In-house Room Cleaning", "Room Check-out", "add-Extra Bed", "add Baby-Crib ", "Extra Bath Towel"];
const maintCats = ["AC-Checkup", "Kettle is not working", "sink", "water leakage ", "Lighting", "fridge "];

export function init(formElement, viewElement) { formContainer = formElement; viewContainer = viewElement; renderWorkspaceLayout(); refresh(); }

function renderWorkspaceLayout() {
  formContainer.innerHTML = `
    <form id="rc-dispatch-form" class="space-y-2 text-stone-800">
      <input type="text" id="rc_room" required placeholder="Room Nu." class="w-full p-2 border text-xs rounded-lg focus:outline-none">
      <input type="text" id="rc_guest" required placeholder="Guest Profile Name" class="w-full p-2 border text-xs rounded-lg focus:outline-none">
      <select id="rc_cat" class="w-full p-2 border text-xs rounded-lg focus:outline-none"></select>
      <textarea id="rc_notes" placeholder="Context notes flags..." class="w-full p-2 border text-xs rounded-lg h-11 focus:outline-none"></textarea>
      <button type="submit" class="w-full py-2 bg-stone-900 hover:bg-stone-800 text-white font-bold text-[10px] uppercase tracking-wide rounded-lg shadow-sm">Dispatch Task</button>
    </form>
  `;
  const select = document.getElementById('rc_cat'); hkCats.concat(maintCats).forEach(c => select.appendChild(new Option(c, c)));
  document.getElementById('rc-dispatch-form').onsubmit = handleFormSubmission;
  viewContainer.innerHTML = `<div id="rc-live-list" class="space-y-1.5 text-xs text-stone-800"></div>`;
}

export async function refresh() {
  const container = document.getElementById('rc-live-list'); if (!container) return;
  try {
    const res = await secureFetch('/api/requests/today'); const data = await res.json();
    container.innerHTML = data.length === 0 ? `<p class="italic text-stone-400 py-4 text-center">Queue empty.</p>` : '';
    data.forEach(item => {
      const isHK = hkCats.includes(item.issue_category);
      const div = document.createElement('div'); div.className = "p-2.5 border rounded-xl flex justify-between items-center bg-stone-50 border-stone-200/60";
      div.innerHTML = `<div><span class="font-black text-stone-900">Room ${item.room_number}</span> <span class="px-1 text-[8px] font-bold rounded uppercase ${isHK?'bg-purple-100 text-purple-800':'bg-amber-100 text-amber-800'}">${isHK?'HK':'ENG'}</span><p class="text-stone-600 font-medium mt-0.5">${item.issue_category} <span class="text-stone-400 font-normal">(${item.guest_name})</span></p></div>
        <span class="px-1.5 py-0.5 text-[9px] font-black uppercase rounded ${item.status==='completed'?'bg-emerald-100 text-emerald-800':'bg-rose-100 text-rose-800 animate-pulse'}">${item.status==='completed'?'Done':'Pending'}</span>`;
      container.appendChild(div);
    });
  } catch(e){}
}

async function handleFormSubmission(e) {
  e.preventDefault();
  const payload = { room_number: document.getElementById('rc_room').value.trim(), guest_name: document.getElementById('rc_guest').value.trim(), issue_category: document.getElementById('rc_cat').value, notes: document.getElementById('rc_notes').value.trim() };
  const res = await secureFetch('/api/requests', { method: 'POST', body: JSON.stringify(payload) });
  if (res.ok) { showToast("Task broadcast to department queues."); document.getElementById('rc-dispatch-form').reset(); refresh(); }
}
