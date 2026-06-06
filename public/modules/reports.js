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
    <div class="space-y-4 text-stone-100">
      <div>
        <h3 class="text-indigo-400 text-xs font-black uppercase tracking-wider">🧾 Cross-Department Reporting Deck</h3>
        <p class="text-[10px] text-stone-400 mt-0.5 leading-normal">Select an isolated node segment target below to parse comprehensive system transaction logs.</p>
      </div>
      
      <div class="space-y-2">
        <label class="block text-[9px] uppercase tracking-wider font-bold text-stone-400">Target Operational Node Selector</label>
        <select id="rpt-dept-selector" class="w-full p-2.5 bg-stone-800 border border-stone-700 text-white text-xs rounded-xl focus:outline-none focus:border-indigo-500">
          <option value="reception">🛎️ Reception & Front Desk Ops</option>
          <option value="housekeeping">🧹 Housekeeping Clean Dispatches</option>
          <option value="maintenance">🛠️ Engineering Maintenance Logs</option>
          <option value="purchasing">📦 Purchasing & Supply Pipelines</option>
          <option value="accounting">🧾 Accounting Financial Disputes</option>
          <option value="reservations">📅 Reservations Booking Manifest</option>
          <option value="sales">📈 Corporate Sales CRM Funnels</option>
        </select>
      </div>
      
      <button id="btn-pull-report" class="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 font-black text-xs uppercase tracking-wider rounded-xl transition shadow-md">
        Compile Audit History Ledger
      </button>
    </div>
  `;

  document.getElementById('btn-pull-report').onclick = refresh;

  viewContainer.innerHTML = `
    <div class="space-y-3">
      <div class="flex justify-between items-center border-b border-stone-200 pb-2">
        <h4 id="rpt-title" class="text-xs font-black uppercase tracking-wider text-stone-500">System Transaction Log Ledger</h4>
        <span class="px-2 py-0.5 bg-stone-100 border rounded text-[10px] font-mono font-bold text-stone-600 uppercase tracking-wider">Dual-Sided Signing Records</span>
      </div>
      <div class="overflow-x-auto">
        <table class="w-full text-left text-xs">
          <thead>
            <tr class="bg-stone-50 text-stone-400 uppercase font-bold text-[9px] border-b border-stone-200">
              <th class="p-2">Transaction Parameters</th>
              <th class="p-2">Creation Event Stamp</th>
              <th class="p-2">Action Resolution Stamp</th>
            </tr>
          </thead>
          <tbody id="rpt-log-target" class="divide-y divide-stone-100 text-stone-700"></tbody>
        </table>
      </div>
    </div>
  `;
}

export async function refresh() {
  const select = document.getElementById('rpt-dept-selector');
  if (!select) return;

  const targetDept = select.value;
  const tbody = document.getElementById('rpt-log-target');
  document.getElementById('rpt-title').innerText = `${targetDept.toUpperCase()} TRANSACTION AUDIT RECORDS`;

  try {
    const res = await secureFetch(`/api/reports/compiled?department=${targetDept}`);
    const transactions = await res.json();

    if (!transactions || transactions.length === 0) {
      tbody.innerHTML = `<tr><td colspan="3" class="p-4 text-center italic text-stone-400">No archival transaction signatures found for this workspace entity sector.</td></tr>`;
      return;
    }

    tbody.innerHTML = transactions.map(t => {
      const details = t.issue_category ? `${t.issue_category} (Rm ${t.room_number})` :
                      t.item_name ? `${t.item_name} x${t.quantity_requested}` :
                      t.disputed_amount ? `Dispute Rm ${t.room_number} ($${t.disputed_amount})` :
                      t.company_name ? `${t.company_name} (CRM)` : `Guest: ${t.guest_name} (Rm ${t.room_number})`;

      const creationUser = t.createdBy || t.loggedBy || "System Core Engine";
      const creationTime = t.timestamp ? new Date(t.timestamp).toLocaleString() : "Unknown Setup";

      const completionUser = t.completedBy || t.reviewedBy;
      const completionTime = t.completedAt ? new Date(t.completedAt).toLocaleString() : null;

      return `
        <tr class="hover:bg-stone-50/80 transition-all font-sans">
          <td class="p-2.5">
            <span class="font-black text-stone-900 block">${details}</span>
            <span class="text-[10px] text-stone-400 block font-mono">ID: ${t._id}</span>
          </td>
          <td class="p-2.5 font-mono text-[11px] text-stone-600 bg-stone-50/40">
            <span class="font-bold text-stone-800 block">👤 ${creationUser}</span>
            <span class="text-[10px] block text-stone-400 mt-0.5">📅 ${creationTime}</span>
          </td>
          <td class="p-2.5 font-mono text-[11px]">
            ${completionTime ? `
              <span class="font-bold text-emerald-700 block">👤 ${completionUser}</span>
              <span class="text-[10px] block text-stone-400 mt-0.5">📅 ${completionTime}</span>
            ` : `
              <span class="px-2 py-0.5 bg-amber-50 text-amber-700 border border-amber-200 text-[9px] font-sans font-bold uppercase rounded tracking-wider inline-block">Awaiting Action</span>
            `}
          </td>
        </tr>
      `;
    }).join('');

  } catch (err) {
    showToast("Archival extraction script encountered an operational block.", "error");
  }
}
