import { secureFetch, showToast } from '../app.js';
let formContainer, viewContainer;

export function init(formElement, viewElement) {
  formContainer = formElement;
  viewContainer = viewElement;
  renderWorkspaceLayout();
  refresh();
}

function renderWorkspaceLayout() {
  formContainer.innerHTML = `
    <div class="space-y-5 text-stone-900">
      <div>
        <h3 class="text-indigo-600 text-xs font-black uppercase tracking-wider">🛎️ Front Desk Control Station</h3>
        <p class="text-[10px] text-stone-400 mt-0.5 leading-tight">Route and dispatch incoming guest services requests to explicit workflows.</p>
      </div>
      
      <form id="fo-task-form" class="space-y-2 bg-stone-50 p-3 rounded-xl border border-stone-200">
        <span class="text-[9px] uppercase font-black tracking-wider text-stone-400 block mb-1">New Order Dispatch Pipeline</span>
        <div>
          <input type="text" id="fo_room" required placeholder="Room Number (e.g. 102)" class="w-full p-2 bg-white border border-stone-200 text-stone-900 text-xs rounded-lg focus:outline-none focus:border-indigo-500">
        </div>
        <div>
          <input type="text" id="fo_guest" required placeholder="Guest Surname" class="w-full p-2 bg-white border border-stone-200 text-stone-900 text-xs rounded-lg focus:outline-none focus:border-indigo-500">
        </div>
        <div>
          <label class="block text-[8px] uppercase tracking-wider font-bold text-stone-400 mb-1">Target Redirection Department</label>
          <select id="fo_dept_category" class="w-full p-2 bg-white border border-stone-200 text-stone-900 text-xs rounded-lg focus:outline-none">
            <option value="Engineering & Maintenance">🛠️ Engineering & Maintenance</option>
            <option value="Housekeeping Operations">🧹 Housekeeping Operations</option>
            <option value="Front Office & Concierge">🛎️ Front Office & Concierge</option>
            <option value="Food & Beverage Room Service">🍽️ Food & Beverage Room Service</option>
          </select>
        </div>
        <div>
          <input type="text" id="fo_task_action" required placeholder="Explicit Request (e.g. Broken AC, Towels, Wakeup Call)" class="w-full p-2 bg-white border border-stone-200 text-stone-900 text-xs rounded-lg focus:outline-none focus:border-indigo-500">
        </div>
        <div>
          <textarea id="fo_notes" rows="2" placeholder="Additional details/notes..." class="w-full p-2 bg-white border border-stone-200 text-stone-900 text-xs rounded-lg focus:outline-none focus:border-indigo-500"></textarea>
        </div>
        <button type="submit" class="w-full py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-[10px] uppercase tracking-wider rounded-lg transition-all">
          Dispatch Secure Order
        </button>
      </form>

      <div class="bg-stone-900 text-white p-3 rounded-xl space-y-2 border border-stone-800">
        <span class="text-[9px] uppercase font-black tracking-wider text-indigo-400 block">📊 Target Department Audit Vault</span>
        <div class="grid grid-cols-2 gap-2">
          <div>
            <label class="block text-[8px] uppercase font-bold text-stone-400 mb-0.5">Start Date</label>
            <input type="date" id="fo_report_start" class="w-full p-1.5 bg-stone-800 border border-stone-700 text-white font-mono text-[10px] rounded focus:outline-none">
          </div>
          <div>
            <label class="block text-[8px] uppercase font-bold text-stone-400 mb-0.5">End Date</label>
            <input type="date" id="fo_report_end" class="w-full p-1.5 bg-stone-800 border border-stone-700 text-white font-mono text-[10px] rounded focus:outline-none">
          </div>
        </div>
        <div>
          <label class="block text-[8px] uppercase font-bold text-stone-400 mb-0.5">Filter Report By Department</label>
          <select id="fo_report_dept_filter" class="w-full p-1.5 bg-stone-800 border border-stone-700 text-white text-[10px] rounded focus:outline-none">
            <option value="">All Segments</option>
            <option value="Engineering & Maintenance">Engineering</option>
            <option value="Housekeeping Operations">Housekeeping</option>
            <option value="Front Office & Concierge">Front Office</option>
            <option value="Food & Beverage Room Service">Food & Beverage</option>
          </select>
        </div>
        <div class="grid grid-cols-2 gap-1.5 pt-1">
          <button type="button" id="btn-fo-run-report" class="py-1.5 bg-indigo-500 hover:bg-indigo-600 text-stone-950 font-black text-[9px] uppercase tracking-wider rounded">Compile Report</button>
          <button type="button" id="btn-fo-clear-report" class="py-1.5 bg-stone-800 hover:bg-stone-700 text-stone-300 font-bold text-[9px] uppercase tracking-wider rounded">Clear Results</button>
        </div>
      </div>
    </div>
  `;

  viewContainer.innerHTML = `
    <div class="space-y-6">
      <div class="space-y-4">
        <div class="border-b border-stone-200 pb-1">
          <h4 class="text-stone-500 text-xs font-black uppercase tracking-wider">🏢 Live Operational Hub Feed</h4>
        </div>
        
        <div class="space-y-4">
          <div>
            <span class="text-[10px] font-black tracking-wider text-amber-600 block mb-1">🛠️ MAINTENANCE & ENGINEERING ACTIONS</span>
            <div id="target-queue-maintenance" class="space-y-1.5 pl-2 border-l-2 border-amber-300"></div>
          </div>
          <div>
            <span class="text-[10px] font-black tracking-wider text-purple-600 block mb-1">🧹 HOUSEKEEPING DISPATCH OVERVIEW</span>
            <div id="target-queue-housekeeping" class="space-y-1.5 pl-2 border-l-2 border-purple-300"></div>
          </div>
          <div>
            <span class="text-[10px] font-black tracking-wider text-indigo-600 block mb-1">🛎️ FRONT OFFICE & CONCIERGE QUEUE</span>
            <div id="target-queue-reception" class="space-y-1.5 pl-2 border-l-2 border-indigo-300"></div>
          </div>
          <div>
            <span class="text-[10px] font-black tracking-wider text-rose-600 block mb-1">🍽️ FOOD & BEVERAGE IN-ROOM DINING</span>
            <div id="target-queue-fnb" class="space-y-1.5 pl-2 border-l-2 border-rose-300"></div>
          </div>
        </div>
      </div>

      <div id="fo-report-vault-container" class="space-y-2 border-t border-stone-200 pt-4 hidden">
        <h4 id="fo-report-vault-title" class="text-indigo-600 text-xs font-black uppercase tracking-wider border-b pb-1">🧾 Compiled Archive Ledger</h4>
        <div id="fo-compiled-report-target" class="space-y-2 max-h-[350px] overflow-y-auto pr-1"></div>
      </div>
    </div>
  `;

  document.getElementById('fo-task-form').onsubmit = handleTaskSubmit;
  document.getElementById('btn-fo-run-report').onclick = compileDateRangeReport;
  document.getElementById('btn-fo-clear-report').onclick = clearReportVaultView;
}

export async function refresh() {
  await fetchAndRenderLiveLayouts();
}

async function fetchAndRenderLiveLayouts() {
  const mTarget = document.getElementById('target-queue-maintenance');
  const hTarget = document.getElementById('target-queue-housekeeping');
  const rTarget = document.getElementById('target-queue-reception');
  const fTarget = document.getElementById('target-queue-fnb');

  if (!mTarget) return;

  // Clear targets to prevent overlapping traces
  mTarget.innerHTML = hTarget.innerHTML = rTarget.innerHTML = fTarget.innerHTML = 
    `<span class="text-[10px] italic text-stone-400">No active workflows queued.</span>`;

  try {
    const res = await secureFetch('/api/requests/today');
    const tasks = await res.json();

    const lists = {
      'Engineering & Maintenance': [],
      'Housekeeping Operations': [],
      'Front Office & Concierge': [],
      'Food & Beverage Room Service': []
    };

    tasks.forEach(task => { 
      if (lists[task.issue_category]) {
        lists[task.issue_category].push(task); 
      }
    });

    renderSubset(mTarget, lists['Engineering & Maintenance']);
    renderSubset(hTarget, lists['Housekeeping Operations']);
    renderSubset(rTarget, lists['Front Office & Concierge']);
    renderSubset(fTarget, lists['Food & Beverage Room Service']);

  } catch (err) { 
    console.error("Pipeline feed sync defect:", err); 
  }
}

function renderSubset(targetElement, dataset) {
  if (dataset.length === 0) return;
  
  targetElement.innerHTML = dataset.map(task => {
    const isPending = task.status === 'pending';
    return `
      <div class="p-2 bg-white border border-stone-200 rounded-lg shadow-xs text-[11px] flex justify-between items-center">
        <div>
          <span class="font-mono bg-stone-900 text-white px-1 text-[9px] rounded">Rm ${task.room_number}</span>
          <span class="font-bold text-stone-800 ml-1">${task.specific_task}</span>
          <span class="text-stone-400 text-[10px] block">Guest: ${task.guest_name} ${task.notes ? `| Obs: ${task.notes}` : ''}</span>
          <span class="text-[8px] font-mono text-stone-400 block">By: ${task.createdBy} @ ${new Date(task.timestamp).toLocaleTimeString()}</span>
        </div>
        <div>
          ${isPending ? `
            <button type="button" data-hub-done-id="${task._id}" class="px-1.5 py-0.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[9px] uppercase rounded transition">Resolve</button>
          ` : `<span class="text-[9px] text-stone-400 bg-stone-100 px-1 rounded font-mono">Closed by ${task.completedBy}</span>`}
        </div>
      </div>
    `;
  }).join('');

  dataset.forEach(task => {
    if (task.status === 'pending') {
      const btn = targetElement.querySelector(`[data-hub-done-id="${task._id}"]`);
      if (btn) btn.onclick = () => closeTaskInstance(task._id);
    }
  });
}

async function handleTaskSubmit(e) {
  e.preventDefault();
  
  const room_number = document.getElementById('fo_room').value.trim();
  const guest_name = document.getElementById('fo_guest').value.trim();
  const issue_category = document.getElementById('fo_dept_category').value;
  const specific_task = document.getElementById('fo_task_action').value.trim();
  const notes = document.getElementById('fo_notes').value.trim();

  if (!room_number || !guest_name || !issue_category || !specific_task) {
    showToast("All essential order dispatch pipeline targets must be filled.", "error");
    return;
  }

  try {
    const res = await secureFetch('/api/requests', {
      method: 'POST',
      body: JSON.stringify({ 
        room_number, 
        guest_name, 
        issue_category, 
        specific_task, 
        notes 
      })
    });

    if (res.ok) {
      showToast("Order dispatched to secure department pipeline.", "success");
      document.getElementById('fo-task-form').reset();
      refresh(); 
    } else {
      const serverError = await res.json();
      showToast(`Rejected: ${serverError.error || "Fields rejected by validation models."}`, "error");
    }
  } catch (err) { 
    showToast("Handshake processing network delivery failure.", "error"); 
  }
}

async function closeTaskInstance(taskId) {
  try {
    const res = await secureFetch(`/api/requests/${taskId}/complete`, { method: 'PATCH' });
    if (res.ok) { 
      showToast("Task signature closed.", "success"); 
      refresh(); 
    }
  } catch (e) { 
    showToast("Error signing off.", "error"); 
  }
}

async function compileDateRangeReport() {
  const start = document.getElementById('fo_report_start').value;
  const end = document.getElementById('fo_report_end').value;
  const filterDept = document.getElementById('fo_report_dept_filter').value;

  if (!start || !end) { 
    showToast("Enter complete parameters.", "error"); 
    return; 
  }

  try {
    let url = `/api/requests/today?startDate=${start}&endDate=${end}`;
    if (filterDept) url += `&departmentFilter=${encodeURIComponent(filterDept)}`;

    const res = await secureFetch(url);
    const reports = await res.json();

    const vaultContainer = document.getElementById('fo-report-vault-container');
    const reportTarget = document.getElementById('fo-compiled-report-target');
    
    vaultContainer.classList.remove('hidden');

    if (reports.length === 0) {
      reportTarget.innerHTML = `<div class="p-3 text-stone-400 italic text-xs">No matching archival files located.</div>`;
      return;
    }

    reportTarget.innerHTML = reports.map(task => `
      <div class="p-2 bg-stone-50 border rounded text-[11px] space-y-0.5">
        <div class="flex justify-between font-bold text-stone-700">
          <span>Rm ${task.room_number} [${task.issue_category}]</span>
          <span class="text-[9px] uppercase">${task.status}</span>
        </div>
        <div class="text-indigo-600 font-bold">${task.specific_task}</div>
        <div class="text-stone-500 italic">${task.notes || 'No extra descriptions.'}</div>
        <div class="text-[8px] font-mono text-stone-400 pt-1">Created by: ${task.createdBy} | Handled by: ${task.completedBy || 'N/A'}</div>
      </div>
    `).join('');
  } catch (err) { 
    showToast("Failed to compile archives.", "error"); 
  }
}

function clearReportVaultView() {
  document.getElementById('fo-report-vault-container').classList.add('hidden');
}
