import { secureFetch, showToast } from '../app.js';
let formContainer, viewContainer;

export function init(formElement, viewElement) { formContainer = formElement; viewContainer = viewElement; renderWorkspaceLayout(); refresh(); }

function renderWorkspaceLayout() {
  formContainer.innerHTML = `
    <form id="pur-work-form" class="space-y-2 text-stone-800">
      <input type="text" id="pur_item" required placeholder="Item asset SKU" class="w-full p-2 border text-xs rounded-lg focus:outline-none">
      <input type="number" id="pur_qty" required placeholder="Units count quantity" class="w-full p-2 border text-xs rounded-lg focus:outline-none">
      <select id="pur_dept" class="w-full p-2 border text-xs rounded-lg focus:outline-none"><option value="housekeeping">🧹 Housekeeping</option><option value="maintenance">🛠️ Engineering</option></select>
      <button type="submit" class="w-full py-2 bg-blue-700 text-white font-bold text-[10px] uppercase tracking-wide rounded-lg">File Requisition</button>
    </form>
  `;
  document.getElementById('pur-work-form').onsubmit = handleFormSubmission;
  viewContainer.innerHTML = `<div id="pur-live-list" class="space-y-1.5 text-xs"></div>`;
}

export async function refresh() {
  const container = document.getElementById('pur-live-list'); if (!container) return;
  try {
    const res = await secureFetch('/api/purchasing/orders'); const data = await res.json();
    container.innerHTML = data.length === 0 ? '<p class="italic text-stone-400 py-4 text-center">No current item line orders tracked.</p>' : '';
    data.forEach(item => {
      const div = document.createElement('div'); div.className = "p-2.5 border rounded-xl flex justify-between items-center bg-stone-50/60";
      div.innerHTML = `<div><span class="font-black text-stone-900">${item.item_name} (x${item.quantity_requested})</span><span class="block text-[9px] text-stone-400 mt-0.5 uppercase tracking-wider">Dept: ${item.department}</span></div>
        <span class="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${item.status==='received'?'bg-emerald-50 text-emerald-700':item.status==='ordered'?'bg-blue-50 text-blue-700':'bg-amber-50 text-amber-700'}">${item.status}</span>`;
      container.appendChild(div);
    });
  } catch(e){}
}

async function handleFormSubmission(e) {
  e.preventDefault();
  const payload = { item_name: document.getElementById('pur_item').value.trim(), quantity_requested: parseInt(document.getElementById('pur_qty').value), department: document.getElementById('pur_dept').value };
  const res = await secureFetch('/api/purchasing/orders', { method: 'POST', body: JSON.stringify(payload) });
  if (res.ok) { showToast("Supply order logged successfully."); document.getElementById('pur-work-form').reset(); refresh(); }
}
