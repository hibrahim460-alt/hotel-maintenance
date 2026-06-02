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
    <h3 class="text-xs font-black text-stone-400 uppercase tracking-wider mb-3">Requisition Portal</h3>
    <form id="pur-work-form" class="space-y-3">
      <div>
        <label class="block text-[10px] uppercase tracking-wider font-bold text-stone-500 mb-1">Item SKU Name</label>
        <input type="text" id="pur_item" required placeholder="Asset description" class="w-full p-2 border text-xs rounded-lg focus:outline-none">
      </div>
      <div>
        <label class="block text-[10px] uppercase tracking-wider font-bold text-stone-500 mb-1">Units Ordered</label>
        <input type="number" id="pur_qty" required placeholder="Quantity" class="w-full p-2 border text-xs rounded-lg focus:outline-none">
      </div>
      <div>
        <label class="block text-[10px] uppercase tracking-wider font-bold text-stone-500 mb-1">Target Department</label>
        <select id="pur_dept" class="w-full p-2 border text-xs rounded-lg focus:outline-none">
          <option value="housekeeping">🧹 Housekeeping Supplies</option>
          <option value="maintenance">🛠️ Engineering Components</option>
        </select>
      </div>
      <button type="submit" class="w-full py-2.5 bg-blue-700 text-white font-bold text-xs uppercase tracking-wide rounded-lg shadow-sm hover:bg-blue-800 transition">File Requisition</button>
    </form>
  `;

  document.getElementById('pur-work-form').onsubmit = handleFormSubmission;

  viewContainer.innerHTML = `
    <div class="bg-white p-6 rounded-2xl border border-stone-200 shadow-xs">
      <h3 class="text-lg font-black tracking-tight text-stone-900 mb-4">📦 Inventory Procurement Tracking Ledger</h3>
      <div id="pur-live-list" class="space-y-2"></div>
    </div>
  `;
}

export async function refresh() {
  const container = document.getElementById('pur-live-list');
  if (!container) return;

  try {
    const res = await secureFetch('/api/purchasing/orders');
    const data = await res.json();
    
    container.innerHTML = '';
    if (data.length === 0) {
      container.innerHTML = `<p class="text-xs text-stone-400 italic py-6 text-center">No active inventory line requests tracking.</p>`;
      return;
    }

    data.forEach(item => {
      const div = document.createElement('div');
      div.className = "p-3.5 border rounded-xl flex justify-between items-center text-xs bg-stone-50/60 border-stone-200";
      
      div.innerHTML = `
        <div>
          <span class="font-black text-stone-900 block">${item.item_name} <span class="text-stone-400 font-normal">(x${item.quantity_requested})</span></span>
          <span class="text-[10px] text-stone-500 uppercase tracking-wider block mt-0.5">Allocation: ${item.department}</span>
          <span class="text-[10px] text-stone-400 block font-mono mt-0.5">By: ${item.createdBy}</span>
        </div>
        <div class="shrink-0">
          <span class="px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider ${
            item.status === 'received' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' :
            item.status === 'ordered' ? 'bg-blue-50 text-blue-700 border border-blue-100' : 'bg-amber-50 text-amber-700 border border-amber-100'
          }">${item.status}</span>
        </div>
      `;
      container.appendChild(div);
    });
  } catch (e) {
    showToast("Inventory grid pull fault.", "error");
  }
}

async function handleFormSubmission(e) {
  e.preventDefault();
  const payload = {
    item_name: document.getElementById('pur_item').value.trim(),
    quantity_requested: parseInt(document.getElementById('pur_qty').value),
    department: document.getElementById('pur_dept').value
  };

  const res = await secureFetch('/api/purchasing/orders', { method: 'POST', body: JSON.stringify(payload) });
  if (res.ok) {
    showToast("Requisition routed directly to Management Approval inbox.");
    document.getElementById('pur-work-form').reset();
    refresh();
  }
}
