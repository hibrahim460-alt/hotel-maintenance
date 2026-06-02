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
    <h3 class="text-xs font-black text-stone-400 uppercase tracking-wider mb-3">Audit Intake Console</h3>
    <form id="acc-work-form" class="space-y-3">
      <div>
        <label class="block text-[10px] uppercase tracking-wider font-bold text-stone-500 mb-1">Room Index Number</label>
        <input type="text" id="acc_room" required placeholder="e.g. 402" class="w-full p-2 border text-xs rounded-lg focus:ring-1 focus:ring-stone-900 focus:outline-none">
      </div>
      <div>
        <label class="block text-[10px] uppercase tracking-wider font-bold text-stone-500 mb-1">Disputed Value ($)</label>
        <input type="number" id="acc_amt" required placeholder="0.00" class="w-full p-2 border text-xs rounded-lg focus:ring-1 focus:ring-stone-900 focus:outline-none">
      </div>
      <div>
        <label class="block text-[10px] uppercase tracking-wider font-bold text-stone-500 mb-1">Reason for Adjustment</label>
        <textarea id="acc_reason" required placeholder="Describe discrepancy..." class="w-full p-2 border text-xs rounded-lg focus:ring-1 focus:ring-stone-900 focus:outline-none h-20"></textarea>
      </div>
      <button type="submit" class="w-full py-2.5 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs uppercase tracking-wide rounded-lg shadow-xs transition">Log Dispute Event</button>
    </form>
  `;

  document.getElementById('acc-work-form').onsubmit = handleFormSubmission;

  viewContainer.innerHTML = `
    <div class="bg-white p-6 rounded-2xl border border-stone-200 shadow-xs">
      <h3 class="text-lg font-black tracking-tight text-stone-900 mb-4">🧾 Active Accounts Receivable Dispute Ledger</h3>
      <div class="overflow-x-auto border border-stone-100 rounded-xl">
        <table class="w-full text-left text-xs border-collapse">
          <thead class="bg-stone-50 text-stone-500 border-b border-stone-100 font-bold uppercase text-[10px] tracking-wider">
            <tr>
              <th class="p-3">Logged</th>
              <th class="p-3">Room</th>
              <th class="p-3">Value</th>
              <th class="p-3">Reason Parameter</th>
              <th class="p-3">Filer Signature</th>
              <th class="p-3 text-right">Clearance Status</th>
            </tr>
          </thead>
          <tbody id="acc-table-rows" class="divide-y divide-stone-100 text-stone-700"></tbody>
        </table>
      </div>
    </div>
  `;
}

export async function refresh() {
  const tbody = document.getElementById('acc-table-rows');
  if (!tbody) return;

  try {
    const res = await secureFetch('/api/accounting/disputes');
    const data = await res.json();
    
    tbody.innerHTML = '';
    if (data.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" class="p-4 text-center text-stone-400 italic">No balance file disputes active.</td></tr>`;
      return;
    }

    data.forEach(item => {
      const tr = document.createElement('tr');
      tr.className = "hover:bg-stone-50/50 transition-colors";
      
      const timeStr = new Date(item.timestamp).toLocaleDateString([], { month: 'short', day: 'numeric' });
      
      tr.innerHTML = `
        <td class="p-3 font-mono text-stone-400">${timeStr}</td>
        <td class="p-3 font-bold">Room ${item.room_number}</td>
        <td class="p-3 font-semibold text-rose-600">$${item.disputed_amount}</td>
        <td class="p-3 text-stone-500 max-w-xs truncate" title="${item.reason}">"${item.reason}"</td>
        <td class="p-3 font-mono text-stone-400">${item.loggedBy}</td>
        <td class="p-3 text-right">
          <span class="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
            item.status === 'approved' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-amber-50 text-amber-700 border border-amber-100'
          }">${item.status === 'approved' ? 'Cleared' : 'Pending Review'}</span>
        </td>
      `;
      tbody.appendChild(tr);
    });
  } catch (e) {
    showToast("Dispute matrix pull failed.", "error");
  }
}

async function handleFormSubmission(e) {
  e.preventDefault();
  const payload = {
    room_number: document.getElementById('acc_room').value.trim(),
    disputed_amount: parseFloat(document.getElementById('acc_amt').value),
    reason: document.getElementById('acc_reason').value.trim()
  };

  const res = await secureFetch('/api/accounting/disputes', { method: 'POST', body: JSON.stringify(payload) });
  if (res.ok) {
    showToast("Dispute logged and routed to management console.");
    document.getElementById('acc-work-form').reset();
    refresh();
  }
}
