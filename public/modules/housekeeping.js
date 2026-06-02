
import { secureFetch, showToast } from '../app.js';

let formContainer, viewContainer;
const housekeepingTasks = ["In-house Room Cleaning", "Room Check-out", "add-Extra Bed", "add Baby-Crib ", "Extra Bath Towel"];

export function init(formElement, viewElement) {
  formContainer = formElement;
  viewContainer = viewElement;
  
  renderWorkspaceLayout();
  refresh();
}

function renderWorkspaceLayout() {
  // Mount Form Console Structure
  formContainer.innerHTML = `
    <h3 class="text-xs font-black text-stone-400 uppercase tracking-wider mb-3">Housekeeping Pipeline Input</h3>
    <form id="hk-work-form" class="space-y-3">
      <div>
        <label class="block text-[10px] uppercase tracking-wider font-bold text-stone-500 mb-1">Asset Room ID</label>
        <input type="text" id="hk_room" required placeholder="Room Number" class="w-full p-2 border text-xs rounded-lg">
      </div>
      <div>
        <label class="block text-[10px] uppercase tracking-wider font-bold text-stone-500 mb-1">Select Defect Profile Spied</label>
        <select id="hk_task" class="w-full p-2 border text-xs rounded-lg">
          <option value="AC-Checkup">🛠️ Engineering: AC-Checkup</option>
          <option value="Kettle is not working">🛠️ Engineering: Broken Kettle</option>
          <option value="water leakage ">🛠️ Engineering: Water Leakage</option>
          <option value="fridge ">🛠️ Engineering: Fridge Malfunction</option>
        </select>
      </div>
      <div>
        <label class="block text-[10px] uppercase tracking-wider font-bold text-stone-500 mb-1">Operational Audit Details</label>
        <textarea id="hk_notes" placeholder="Describe issue parameters..." class="w-full p-2 border text-xs rounded-lg"></textarea>
      </div>
      <button type="submit" class="w-full py-2.5 bg-purple-700 text-white font-bold text-xs uppercase tracking-wide rounded-lg shadow-xs hover:bg-purple-800 transition">File Engineering Ticket</button>
    </form>
  `;

  document.getElementById('hk-work-form').on3ubmit = handleFormSubmission;

  // Mount Render Target View Layout
  viewContainer.innerHTML = `
    <div class="bg-white p-6 rounded-2xl border border-stone-200 shadow-xs">
      <h3 class="text-lg font-black tracking-tight text-stone-900 mb-4">🧹 Housekeeping Live Cleaning Workspace</h3>
      <div id="hk-live-grid" class="grid grid-cols-1 sm:grid-cols-2 gap-3"></div>
    </div>
  `;
}

export async function refresh() {
  const grid = document.getElementById('hk-live-grid');
  if(!grid) return;

  try {
    const res = await secureFetch('/api/requests/today');
    const data = await res.json();
    
    // Filter out maintenance items so Housekeeping only focuses on task profiles matching their sector assignment
    const filtered = data.filter(item => housekeepingTasks.includes(item.issue_category));
    
    grid.innerHTML = '';
    if(filtered.length === 0) {
      grid.innerHTML = `<p class="text-xs text-stone-400 italic py-6 sm:col-span-2 text-center">No open cleaning requests filed on current ledger index shift.</p>`;
      return;
    }

    filtered.forEach(item => {
      const card = document.createElement('div');
      card.className = `p-4 rounded-xl border flex justify-between items-center transition-all ${item.status === 'completed' ? 'bg-stone-50/50 border-stone-200/60 opacity-60' : 'bg-purple-50/30 border-purple-100'}`;
      
      const timeStr = new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      
      card.innerHTML = `
        <div>
          <span class="text-xs font-black text-purple-950 block">Room ${item.room_number}</span>
          <span class="text-xs text-purple-800 font-medium block mt-0.5">${item.issue_category}</span>
          <span class="text-[10px] text-stone-400 block mt-1 font-mono">Inquiry: ${timeStr} | Stamped: ${item.createdBy}</span>
        </div>
      `;

      if(item.status === 'pending') {
        const btn = document.createElement('button');
        btn.className = "px-3 py-1.5 bg-purple-700 text-white font-bold text-[10px] rounded-lg shadow-xs hover:bg-purple-800";
        btn.innerText = "Mark Clean";
        btn.onclick = async () => {
          await secureFetch(`/api/requests/${item._id}/complete`, { method: 'PATCH' });
          showToast(`Room ${item.room_number} confirmed clean.`);
          refresh();
        };
        card.appendChild(btn);
      } else {
        card.innerHTML += `<span class="text-[10px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded-md uppercase tracking-wider">Done By: ${item.completedBy}</span>`;
      }

      grid.appendChild(card);
    });
  } catch(e) {}
}

async function handleFormSubmission(e) {
  e.preventDefault();
  const payload = {
    room_number: document.getElementById('hk_room').value,
    guest_name: "Room Inspection Alert",
    issue_category: document.getElementById('hk_task').value,
    notes: document.getElementById('hk_notes').value
  };

  const res = await secureFetch('/api/requests', { method: 'POST', body: JSON.stringify(payload) });
  if(res.ok) {
    showToast("Engineering alert dispatched instantly.");
    document.getElementById('hk-work-form').reset();
  }
}
