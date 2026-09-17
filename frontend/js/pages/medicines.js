/**
 * pages/medicines.js
 * -----------------------------------------------------------------------
 * Medicines table + Add/Edit/Delete, backed by /api/medicines.
 */

const HMD = window.HMD || (window.HMD = {});
HMD.pages = HMD.pages || {};

(function () {
  let allMedicines = [];
  let currentFilter = '';
  let currentSearch = '';
  const TYPE_OPTIONS = ['DRUG', 'INJECTION', 'TABLET', 'SYRUP'];

  async function load() {
    setTableState('medicines', 'loading');
    try {
      const data = await HMD_API.get('/api/medicines');
      allMedicines = Array.isArray(data) ? data : [];
      render();
    } catch (err) {
      setTableState('medicines', 'error');
      showToast(err.message, 'error');
    }
  }

  function render() {
    let rows = allMedicines;
    if (currentFilter) rows = rows.filter((m) => m.medicineType === currentFilter || m.type === currentFilter);
    if (currentSearch) rows = rows.filter((m) => (m.medicineName || m.name || '').toLowerCase().includes(currentSearch));

    const tbody = document.getElementById('medicinesTableBody');
    if (!rows.length) {
      tbody.innerHTML = '';
      setTableState('medicines', 'empty');
      return;
    }

    tbody.innerHTML = rows.map((m) => `
      <tr>
        <td>#${escapeHtml(m.id)}</td>
        <td>${escapeHtml(m.medicineName || m.name || '—')}</td>
        <td><span class="badge badge-neutral">${escapeHtml(m.medicineType || m.type || '—')}</span></td>
        <td class="col-actions">
          <div class="row-actions">
            <button data-edit="${m.id}" title="Edit"><i data-lucide="pencil"></i></button>
            <button data-delete="${m.id}" class="danger" title="Delete"><i data-lucide="trash-2"></i></button>
          </div>
        </td>
      </tr>
    `).join('');
    setTableState('medicines', 'ready');

    tbody.querySelectorAll('[data-edit]').forEach((btn) =>
      btn.addEventListener('click', () => openForm(allMedicines.find((m) => String(m.id) === btn.dataset.edit))));
    tbody.querySelectorAll('[data-delete]').forEach((btn) =>
      btn.addEventListener('click', () => remove(btn.dataset.delete)));
  }

  function search(term) {
    currentSearch = term;
    render();
  }

  function formFieldsHtml(m = {}) {
    const currentType = m.medicineType || m.type || '';
    return `
      <div class="form-grid">
        <div class="form-field full"><label>Medicine Name</label>
          <input class="input-field" id="f-medicineName" value="${escapeHtml(m.medicineName || m.name || '')}" required />
          <span class="field-error">Medicine name is required.</span>
        </div>
        <div class="form-field full"><label>Medicine Type</label>
          <select class="select-field" id="f-medicineType" required>
            <option value="">Select…</option>
            ${TYPE_OPTIONS.map((t) => `<option value="${t}" ${currentType === t ? 'selected' : ''}>${t}</option>`).join('')}
          </select>
          <span class="field-error">Medicine type is required.</span>
        </div>
      </div>
    `;
  }

  function readForm() {
    return {
      medicineName: document.getElementById('f-medicineName').value.trim(),
      medicineType: document.getElementById('f-medicineType').value,
    };
  }

  function validate(body) {
    const errors = [];
    if (!body.medicineName) errors.push('f-medicineName');
    if (!body.medicineType) errors.push('f-medicineType');
    errors.forEach((id) => document.getElementById(id).closest('.form-field').classList.add('has-error'));
    return errors.length === 0;
  }

  function openForm(existing) {
    const isEdit = !!existing;
    HMD_MODAL.open({
      title: isEdit ? `Edit Medicine #${existing.id}` : 'Add Medicine',
      bodyHtml: formFieldsHtml(existing || {}),
      footHtml: `
        <button class="btn btn-ghost" id="cancelBtn">Cancel</button>
        <button class="btn btn-primary" id="saveBtn">${isEdit ? 'Save Changes' : 'Add Medicine'}</button>
      `,
      onMount() {
        document.getElementById('cancelBtn').addEventListener('click', () => HMD_MODAL.close());
        document.getElementById('saveBtn').addEventListener('click', async () => {
          document.querySelectorAll('.form-field').forEach((f) => f.classList.remove('has-error'));
          const body = readForm();
          if (!validate(body)) return;
          const btn = document.getElementById('saveBtn');
          btn.disabled = true;
          btn.textContent = 'Saving…';
          try {
            if (isEdit) {
              await HMD_API.put(`/api/medicines/${existing.id}`, body);
              showToast('Medicine updated.', 'success');
            } else {
              await HMD_API.post('/api/medicines', body);
              showToast('Medicine added.', 'success');
            }
            HMD_MODAL.close();
            load();
          } catch (err) {
            btn.disabled = false;
            btn.textContent = isEdit ? 'Save Changes' : 'Add Medicine';
            showToast(err.message, 'error');
          }
        });
      },
    });
  }

  function remove(id) {
    confirmDialog({
      title: 'Delete medicine?',
      message: `This will permanently remove medicine #${id}. This cannot be undone.`,
      onConfirm: async () => {
        await HMD_API.del(`/api/medicines/${id}`);
        showToast('Medicine deleted.', 'success');
        load();
      },
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('addMedicineBtn').addEventListener('click', () => openForm(null));
    document.getElementById('medicineTypeFilter').addEventListener('change', (e) => {
      currentFilter = e.target.value;
      render();
    });
    document.querySelector('[data-retry="medicines"]').addEventListener('click', load);
  });

  HMD.pages.medicines = { load, search };
})();
