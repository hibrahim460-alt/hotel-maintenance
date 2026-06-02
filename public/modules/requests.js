import { secureFetch, showToast, AppState } from '../app.js';
let formContainer, viewContainer;

export function init(formElement, viewElement) {
  formContainer = formElement;
  viewContainer = viewElement;
  renderWorkspaceLayout();
  refresh();
}

function renderWorkspaceLayout() {
  // Only render the creation form if the logged-in user has execution rights (Not an Executive)
  if (AppState.role !== 'executive') {
    formContainer.innerHTML = `
      <div class="space-y-4 text-stone-900">
        <div>
          <h3 class="text-indigo-600 text-xs font-black uppercase tracking-wider">🛎️ Service Dispatch</h3>
          <p class="text-[10px] text-stone-400 mt-0.5 leading-tight">Log live guest requests, maintenance disruptions, or housekeeping dispatches instantly.</p>
        </div>
        
        <form id="ops-task-form" class="space-y-2.5">
          <div>
            <label class="block text-[9px] uppercase tracking-wider font-bold text-stone-500 mb-1">Room / Suite</label>
            <input type="text" id="task_room" required placeholder="e.g. 404" class="w-full p-2 bg-stone-50 border border-stone-200 text-stone-900 text-xs rounded-lg focus:outline-none focus:border-indigo-500">
          </div>
          
          <div>
            <label class="block text-[9px] uppercase tracking-wider font-bold text-stone-500 mb-1">Guest Reference Name</label>
            <input type="text" id="task_guest" required placeholder="e.g. Montgomery" class="w-full p-2 bg-stone-50 border border-stone-200 text-stone-900 text-xs rounded-lg focus:outline-none focus:border-indigo-500">
          </div>
          
          <div>
            <label class="block text-[9px] uppercase tracking-wider font-bold text-stone-500 mb-1">Operational Category</label>
            <select id="task_category" class="w-full p-2 bg-stone-50 border border-stone-200 text-stone-900 text-xs rounded-lg focus:outline-none">
              <option value="Front Desk">🛎️ Front Desk / Concierge</option>
              <option value="Housekeeping">🧹 Housekeeping Clean</option>
              <option value="Maintenance">🛠️ Engineering Repair</option>
              <option value="Room Service">🍽️ Room Service Delivery</option>
            </select>
          </div>
          
          <div>
            <label class="block text-[9px] uppercase tracking-wider font-bold text-stone-500 mb-1">Task Dispatch Notes</label>
            <textarea id="task_notes" rows="2" placeholder="Describe the explicit operational request details..." class="w-full p-2 bg-stone-50 border border-stone-200 text-stone-900 text-xs rounded-lg focus:outline-none focus:border-indigo-500"></textarea>
          </div>
          
          <button type="submit" class="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-[11px] uppercase tracking-wider rounded-lg transition-all shadow-xs">
            Dispatch Live Task
          </button>
        </form>
      </div>
    `;
    document.getElementById('ops-task-form').onsubmit = handleFormSubmit;
  } else {
    formContainer.innerHTML = `
      <div class="p-3 bg-stone-50 border border-stone-200 rounded-xl">
        <span class="text-[10px] font-bold text-stone-400 uppercase tracking-wider block">Profile Restriction</span>
        <p class="text-xs text-stone-600 mt-1 leading-normal">Your Executive oversight account holds read-only status over active queue dispatches.</p>
      </div>
    `;
  }

  viewContainer.innerHTML = `
    <div class="space-y-3">
      <div class="flex justify-between items-center border-b border-stone-200 pb-2">
        <h4 class="text-stone-500 text-xs font-black uppercase tracking-wider">Active Department Work Queues</h4>
        <button id="btn-refresh-tasks" class="text-[10px] font-bold uppercase tracking-wider text-indigo-600 hover:text-indigo-800 transition">Sync Records</button>
      </div>
      <div id="ops-tasks-target" class="space-y-2"></div>
    </div>
  `;
  document.getElementById('btn-refresh-tasks').onclick = refresh;
}

export async function refresh() {
  const container = document.getElementById('ops-tasks-target');
  if (!container) return;

  try {
    const res = await secureFetch('/api/requests/today');
    const tasks = await res.json();

    if (tasks.length === 0) {
      container.innerHTML = `<div class="p-4 text-center italic text-stone-400 text-xs">No active task dispatches logged within the current rotation frame.</div>`;
      return;
    }

    container.innerHTML = tasks.map(task => {
      const isPending = task.status === 'pending';
      const createdDate = new Date(task.timestamp).toLocaleString();
      const confirmedDate = task.completedAt ? new Date(task.completedAt).toLocaleString() : '';

      return `
        <div class="p-3 ${isPending ? 'bg-amber-50/40 border-amber-200' : 'bg-stone-50 border-stone-200'} border rounded-xl space-y-2.5 transition-all">
          
          <!-- TOP CAPTION HEADER -->
          <div class="flex justify-between items-start gap-2">
            <div>
              <span class="px-2 py-0.5 bg-stone-900 text-white font-mono font-bold text-[9px] uppercase tracking-wider rounded-md">Rm ${task.room_number}</span>
              <span class="ml-1.5 text-xs font-black text-stone-900">${task.guest_name}</span>
              <span class="block text-[10px] text-indigo-600 font-bold uppercase tracking-wider mt-0.5">${task.issue_category}</span>
            </div>
            
            <div>
              ${isPending ? `
                <button type="button" 
                        data-complete-task-id="${task._id}"
                        class="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white text-[9px] font-black uppercase tracking-wider rounded-lg transition shadow-xs">
                  Confirm Execution
                </button>
              ` : `
                <span class="px-2 py-0.5 bg-stone-200 text-stone-700 border text-[9px] font-mono font-bold uppercase rounded-md tracking-wider">Resolved</span>
              `}
            </div>
          </div>

          <!-- TASK DESCRIPTION DETAIL BODY -->
          ${task.notes ? `<p class="text-[11px] text-stone-600 bg-white/60 p-1.5 rounded border border-stone-100 italic leading-snug">${task.notes}</p>` : ''}

          <!-- DUAL-SIDED AUDIT TRAILS BLOCK (USER & TIMESTAMP VISIBILITY) -->
          <div class="grid grid-cols-2 gap-2 border-t border-stone-100 pt-2 text-[10px] font-mono">
            
            <!-- CREATION EVENT FOOTLOG -->
            <div class="space-y-0.5 text-stone-500">
              <span class="text-[8px] font-sans font-black uppercase tracking-wider text-stone-400 block">Logged By:</span>
              <div class="flex items-center gap-1 text-stone-700">
                <span class="font-bold">👤 ${task.createdBy}</span>
              </div>
              <div class="text-stone-400 text-[9px]">📅 ${createdDate}</div>
            </div>

            <!-- CONFIRMATION ACTION RESOLUTION FOOTLOG -->
            <div class="space-y-0.5 border-l border-stone-200/80 pl-2">
              <span class="text-[8px] font-sans font-black uppercase tracking-wider text-stone-400 block">Confirmed By:</span>
              ${!isPending ? `
                <div class="flex items-center gap-1 text-emerald-700">
                  <span class="font-bold">👤 ${task.completedBy}</span>
                </div>
                <div class="text-stone-400 text-[9px]">📅 ${confirmedDate}</div>
              ` : `
                <span class="text-amber-600 italic text-[10px] block pt-0.5 animate-pulse">Awaiting operational sign-off...</span>
              `}
            </div>

          </div>

        </div>
      `;
    }).join('');

    // Attach resolution click functions live into runtime memory
    tasks.forEach(task => {
      if (task.status === 'pending') {
        const btn = document.querySelector(`[data-complete-task-id="${task._id}"]`);
        if (btn) {
          btn.onclick = () => confirmTaskResolution(task._id);
        }
      }
    });

  } catch (err) {
    console.error("Queue trace crash:", err);
  }
}

async function handleFormSubmit(e) {
  e.preventDefault();
  const room_number = document.getElementById('task_room').value.trim();
  const guest_name = document.getElementById('task_guest').value.trim();
  const issue_category = document.getElementById('task_category').value;
  const notes = document.getElementById('task_notes').value.trim();

  try {
    const res = await secureFetch('/api/requests', {
      method: 'POST',
      body: JSON.stringify({ room_number, guest_name, issue_category, notes })
    });

    if (res.ok) {
      showToast("Operational dispatch logged securely across global arrays.", "success");
      document.getElementById('ops-task-form').reset();
      refresh();
    } else {
      showToast("Failed to initialize task matrix parameter validations.", "error");
    }
  } catch (err) {
    showToast("Network dispatch breakdown error.", "error");
  }
}

async function confirmTaskResolution(taskId) {
  try {
    const res = await secureFetch(`/api/requests/${taskId}/complete`, { method: 'PATCH' });
    if (res.ok) {
      showToast("Task resolution confirmed. Sign-off credentials stamped onto record.", "success");
      refresh();
    } else {
      showToast("Authorization signature update request rejected.", "error");
    }
  } catch (err) {
    showToast("Server tracing handshake failed.", "error");
  }
}
