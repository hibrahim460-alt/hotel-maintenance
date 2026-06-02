import { secureFetch, showToast } from '../app.js';
let formContainer, viewContainer;

export function init(formElement, viewElement) { formContainer = formElement; viewContainer = viewElement; renderWorkspaceLayout(); refresh(); }

function renderWorkspaceLayout() {
  formContainer.innerHTML = `
    <form id="sales-work-form" class="space-y-2 text-stone-800">
      <input type="text" id="s_comp" required placeholder="Company brand title" class="w-full p-2 border text-xs rounded-lg focus:outline-none">
      <input type="text" id="s_cont" required placeholder="Key contact entity person" class="w-full p-2 border text-xs rounded-lg focus:outline-none">
      <input type="number" id="s_rooms" required placeholder="Group room block volume size" class="w-full p-2 border text-xs rounded-lg focus:outline-none">
      <input type="number" id="s_rev" required placeholder="Account value valuation ($)" class="w-full p-2 border text-xs rounded-lg focus:outline-none">
      <button type="submit" class="w-full py-2 bg-indigo-700 hover:bg-indigo-800 text-white font-bold text-[10px] uppercase tracking-wide rounded-lg">Register Lead Profile</button>
    </form>
  `;
  document.getElementById('sales-work-form').onsubmit = handleFormSubmission;
  viewContainer.innerHTML = `<div id="sales-live-list" class="space-y-1.5 text-xs"></div>`;
}

export async function refresh() {
  const container = document.getElementById('sales-live-list'); if (!container) return;
  try {
    const res = await secureFetch('/api/sales/leads'); const data = await res.json();
    container.innerHTML = data.length === 0 ? '<p class="italic text-stone-400 py-4 text-center">Sales pipeline empty.</p>' : '';
    data.forEach(item => {
      const div = document.createElement('div'); div.className = "p-2.5 border rounded-xl flex justify-between items-center bg-stone-50/40";
      div.innerHTML = `<div><span class="font-black text-stone-900">${item.company_name}</span><p class="text-stone-400 text-[10px] mt-0.5">Contact: ${item.contact_person} • Value Projection: <span class="text-indigo-600 font-bold">$${item.revenue_estimation}</span></p></div>
        <span class="px-1.5 py-0.5 bg-indigo-50 border border-indigo-100 text-indigo-800 font-bold text-[9px] uppercase tracking-wider rounded">${item.pipeline_stage}</span>`;
      container.appendChild(div);
    });
  } catch(e){}
}

async function handleFormSubmission(e) {
  e.preventDefault();
  const payload = { company_name: document.getElementById('s_comp').value.trim(), contact_person: document.getElementById('s_cont').value.trim(), group_rooms_needed: parseInt(document.getElementById('s_rooms').value), revenue_estimation: parseFloat(document.getElementById('s_rev').value) };
  const res = await secureFetch('/api/sales/leads', { method: 'POST', body: JSON.stringify(payload) });
  if (res.ok) { showToast("Corporate account B2B contract lead file initialized."); document.getElementById('sales-work-form').reset(); refresh(); }
}
