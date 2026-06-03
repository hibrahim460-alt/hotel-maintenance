import { secureFetch, showToast } from '../app.js';
let formContainer, viewContainer;

export function init(formElement, viewElement) {
  formContainer = formElement;
  viewContainer = viewElement;
  renderWorkspaceLayout();
  refresh();
}

function renderWorkspaceLayout() {
  // Maintenance side typically doesn't need to dispatch tasks, but we preserve structural balance
  formContainer.innerHTML = `
    <div class="space-y-4 text-stone-900">
      <div>
        <h3 class="text-amber-600 text-xs font-black uppercase tracking-wider">🛠️ Engineering Maintenance Panel</h3>
        <p class="text-[10px] text-stone-400 mt-0.5 leading-tight">Real-time room maintenance and technical repair logs.</p>
      </div>
      <div class="bg-amber-50 border border-amber-200 p-3 rounded-xl text-[11px] text-amber-900 space-y-1">
        <span class="font-bold uppercase tracking-wider text-[9px] text-amber-800 block">Operational Protocol</span>
        <p class="leading-tight">Review room requests carefully, check notes for technical details, and execute repairs. Click <strong class="uppercase font-black text-amber-700">Clear Issue</strong> once fully resolved to update the front desk.</p>
      </div>
    </div>
  `;

  viewContainer.innerHTML = `
    <div class="space-y-4">
      <div class="border-b border-stone-200 pb-1 flex justify-between items-center">
        <h4 class="text-stone-500 text-xs font-black uppercase tracking-wider">🔧 Active Engineering & Repair Queue</h4>
        <button id="btn-maint-refresh" class="text-[9px] bg-stone-100 hover:bg-stone-200 text-stone-600 font-bold px-2 py-0.5 rounded border border-stone-200 transition-all">🔄 Sync Feed</button>
      </div>
      <div id="maintenance-tasks-target" class="grid grid-cols-1 md:grid-cols-2 gap-3"></div>
    </div>
  `;

  document.getElementById('btn-maint-refresh').onclick = refresh;
}

export async function refresh() {
  const container = document.getElementById('maintenance-tasks-target');
  if (!container) return;

  container.innerHTML = `
    <div class="col-span-full text-center py-4">
      <span class="text-[11px] italic text-stone-400 animate-pulse">Fetching latest pipeline allocations...</span>
    </div>
  `;

  try {
    // Fetches live requests (Server filtering securely hands only relevant tasks to maintenance role)
    const res = await secureFetch('/api/requests/today');
    const tasks = await res.json();

    // Secondary layer client side filter to safeguard absolute architectural encapsulation
    const engineeringTasks = tasks.filter(t => t.issue_category === 'Engineering & Maintenance');

    if (engineeringTasks.length === 0) {
      container.innerHTML = `
        <div class="col-span-full bg-stone-50 border border-stone-200 rounded-xl p-6 text-center">
          <span class="text-xs italic text-stone-400 block">All engineering systems clear. No outstanding tasks queued.</span>
        </div>
      `;
      return;
    }

    // MAP AND RENDER COMPREHENSIVE DATA CARD PROPERTIES
    container.innerHTML = engineeringTasks.map(task => {
      const isPending = task.status === 'pending';
      const taskDate = new Date(task.timestamp);
      
      // Format timestamps beautifully (e.g., 04:32 PM)
      const formattedTime = taskDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      // Format date for tracking historical age (e.g., Jun 3)
      const formattedDate = taskDate.toLocaleDateString([], { month: 'short', day: 'numeric' });

      return `
        <div class="bg-amber-50/40 border border-amber-200 rounded-xl p-3 flex flex-col justify-between space-y-3 transition-all hover:shadow-xs">
          <div class="space-y-1.5">
            <div class="flex justify-between items-start">
              <span class="px-2 py-0.5 bg-stone-900 text-white font-mono font-black text-[11px] rounded-lg tracking-wider">
                Room ${task.room_number}
              </span>
              <div class="text-right flex flex-col">
                <span class="text-[10px] font-mono font-bold text-stone-700">${formattedTime}</span>
                <span class="text-[8px] font-mono text-stone-400">${formattedDate}</span>
              </div>
            </div>

            <div>
              <span class="text-[8px] font-black uppercase tracking-wider text-amber-700 block">Reported Issue</span>
              <h5 class="text-stone-900 font-black text-sm tracking-tight mt-0.5">${task.specific_task}</h5>
            </div>

            <div>
              <span class="text-[8px] font-black uppercase tracking-wider text-stone-400 block">Technical Context / Notes</span>
              <p class="text-[11px] text-stone-600 italic bg-white p-2 rounded-lg border border-stone-200/60 mt-0.5 shadow-2xs leading-relaxed">
                ${task.notes ? task.notes : '<span class="text-stone-300">No additional contextual operational remarks provided.</span>'}
              </p>
            </div>
          </div>

          <div class="pt-1 border-t border-amber-200/60 flex justify-between items-center bg-transparent">
            <span class="text-[8px] font-mono text-stone-400 uppercase tracking-tight">
              Dispatched by: <strong class="text-stone-600 font-bold">${task.createdBy}</strong>
            </span>
            ${isPending ? `
              <button type="button" data-maint-clear-id="${task._id}" class="px-3 py-1 bg-stone-900 hover:bg-stone-800 text-amber-400 hover:text-amber-300 font-black text-[10px] uppercase tracking-wider rounded-lg shadow-xs transition-all transform active:scale-95">
                Clear Issue
              </button>
            ` : `
              <span class="px-2 py-0.5 bg-emerald-100 text-emerald-800 font-mono text-[9px] font-bold rounded-md">
                Fixed by ${task.completedBy || 'System'}
              </span>
            `}
          </div>
        </div>
      `;
    }).join('');

    // Safely attach event listener callbacks to the resolution buttons
    engineeringTasks.forEach(task => {
      if (task.status === 'pending') {
        const targetBtn = container.querySelector(`[data-maint-clear-id="${task._id}"]`);
        if (targetBtn) {
          targetBtn.onclick = () => resolveEngineeringTaskInstance(task._id);
        }
      }
    });

  } catch (err) {
    console.error("Maintenance synchronization engine failure:", err);
    container.innerHTML = `
      <div class="col-span-full bg-rose-50 border border-rose-200 rounded-xl p-4 text-center text-rose-800 text-xs font-bold">
        Error syncing active operational queues. Check network connectivity.
      </div>
    `;
  }
}

async function resolveEngineeringTaskInstance(taskId) {
  try {
    const res = await secureFetch(`/api/requests/${taskId}/complete`, { 
      method: 'PATCH' 
    });
    if (res.ok) {
      showToast("Engineering issue cleared successfully. Front desk notified.", "success");
      refresh();
    } else {
      showToast("Failed to finalize status signature.", "error");
    }
  } catch (err) {
    showToast("Server signature handshake failure.", "error");
  }
}
