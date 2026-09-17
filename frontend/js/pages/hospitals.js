/**
 * pages/hospitals.js
 * -----------------------------------------------------------------------
 * Hospitals table + Add/Edit/Delete, backed by /api/hospitals.
 */

const HMD = window.HMD || (window.HMD = {});
HMD.pages = HMD.pages || {};

(function () {
  let allHospitals = [];
  let currentSearch = '';

  async function load() {
    setTableState('hospitals', 'loading');
    try {
      const data = await HMD_API.get('/api/hospitals');
      allHospitals = Array.isArray(data) ? data : [];
      render();
    } catch (err) {
      setTableState('hospitals', 'error');
      showToast(err.message, 'error');
    }
  }

  function render() {
    let rows = allHospitals;
    if (currentSearch) {
      rows = rows.filter((h) =>
        (h.name || '').toLowerCase().includes(currentSearch) ||
        (h.city || '').toLowerCase().includes(currentSearch));
    }

    const tbody = document.getElementById('hospitalsTableBody');
    if (!rows.length) {
      tbody.innerHTML = '';
      setTableState('hospitals', 'empty');
      return;
    }

    tbody.innerHTML = rows.map((h) => `
      <tr>
        <td>#${escapeHtml(h.id)}</td>
        <td>${escapeHtml(h.name || '—')}</td>
        <td>${escapeHtml(h.street || '—')}</td>
        <td>${escapeHtml(h.area || '—')}</td>
        <td>${escapeHtml(h.city || '—')}</td>
        <td>${escapeHtml(h.pincode || '—')}</td>
        <td class="col-actions">
          <div class="row-actions">
            <button data-edit="${h.id}" title="Edit"><i data-lucide="pencil"></i></button>
            <button data-delete="${h.id}" class="danger" title="Delete"><i data-lucide="trash-2"></i></button>
          </div>
        </td>
      </tr>
    `).join('');
    setTableState('hospitals', 'ready');

    tbody.querySelectorAll('[data-edit]').forEach((btn) =>
      btn.addEventListener('click', () => openForm(allHospitals.find((h) => String(h.id) === btn.dataset.edit))));
    tbody.querySelectorAll('[data-delete]').forEach((btn) =>
      btn.addEventListener('click', () => remove(btn.dataset.delete)));
  }

  function search(term) {
    currentSearch = term;
    render();
  }

  function formFieldsHtml(h = {}) {
    return `
      <div class="form-grid">
        <div class="form-field full"><label>Hospital Name</label>
          <input class="input-field" id="f-name" value="${escapeHtml(h.name || '')}" required />
          <span class="field-error">Name is required.</span>
        </div>
        <div class="form-field full"><label>Street</label>
          <input class="input-field" id="f-street" value="${escapeHtml(h.street || '')}" />
        </div>
        <div class="form-field"><label>Area</label>
          <input class="input-field" id="f-area" value="${escapeHtml(h.area || '')}" />
        </div>
        <div class="form-field"><label>City</label>
          <input class="input-field" id="f-city" value="${escapeHtml(h.city || '')}" />
        </div>
        <div class="form-field"><label>Pincode</label>
          <input class="input-field" id="f-pincode" value="${escapeHtml(h.pincode || '')}" />
        </div>
      </div>
    `;
  }

  function readForm() {
    return {
      name: document.getElementById('f-name').value.trim(),
      street: document.getElementById('f-street').value.trim(),
      area: document.getElementById('f-area').value.trim(),
      city: document.getElementById('f-city').value.trim(),
      pincode: document.getElementById('f-pincode').value.trim(),
    };
  }

  function validate(body) {
    const errors = [];
    if (!body.name) errors.push('f-name');
    errors.forEach((id) => document.getElementById(id).closest('.form-field').classList.add('has-error'));
    return errors.length === 0;
  }

  function openForm(existing) {
    const isEdit = !!existing;
    HMD_MODAL.open({
      title: isEdit ? `Edit Hospital #${existing.id}` : 'Add Hospital',
      bodyHtml: formFieldsHtml(existing || {}),
      footHtml: `
        <button class="btn btn-ghost" id="cancelBtn">Cancel</button>
        <button class="btn btn-primary" id="saveBtn">${isEdit ? 'Save Changes' : 'Add Hospital'}</button>
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
              await HMD_API.put(`/api/hospitals/${existing.id}`, body);
              showToast('Hospital updated.', 'success');
            } else {
              await HMD_API.post('/api/hospitals', body);
              showToast('Hospital added.', 'success');
            }
            HMD_MODAL.close();
            load();
          } catch (err) {
            btn.disabled = false;
            btn.textContent = isEdit ? 'Save Changes' : 'Add Hospital';
            showToast(err.message, 'error');
          }
        });
      },
    });
  }

  function remove(id) {
    confirmDialog({
      title: 'Delete hospital?',
      message: `This will permanently remove hospital #${id}. This cannot be undone.`,
      onConfirm: async () => {
        await HMD_API.del(`/api/hospitals/${id}`);
        showToast('Hospital deleted.', 'success');
        load();
      },
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('addHospitalBtn').addEventListener('click', () => openForm(null));
    document.querySelector('[data-retry="hospitals"]').addEventListener('click', load);
  });

  HMD.pages.hospitals = { load, search };
})();
