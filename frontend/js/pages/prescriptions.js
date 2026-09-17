/**
 * pages/prescriptions.js
 * -----------------------------------------------------------------------
 * Prescriptions table + Add/Edit/Delete, backed by /api/prescriptions.
 * The Consultation dropdown is always populated live from
 * /api/consultations — consultation IDs are never hardcoded. Medicine
 * and Test dropdowns are likewise populated live from /api/medicines
 * and /api/tests.
 */

const HMD = window.HMD || (window.HMD = {});
HMD.pages = HMD.pages || {};

(function () {
  let allPrescriptions = [];
  let consultationsCache = [];
  let medicinesCache = [];
  let testsCache = [];
  let currentSearch = '';

  async function loadLookups() {
    const [consultations, medicines, tests] = await Promise.all([
      HMD_API.get('/api/consultations').catch(() => []),
      HMD_API.get('/api/medicines').catch(() => []),
      HMD_API.get('/api/tests').catch(() => []),
    ]);
    consultationsCache = Array.isArray(consultations) ? consultations : [];
    medicinesCache = Array.isArray(medicines) ? medicines : [];
    testsCache = Array.isArray(tests) ? tests : [];
  }

  function consultationLabel(c) {
    return c ? `Consultation #${c.id} — ${formatDate(c.date)}` : '—';
  }
  function medicineLabel(m) {
    return m ? (m.medicineName || m.name || `#${m.id}`) : '—';
  }
  function testLabel(t) {
    return t ? (t.testName || t.name || `#${t.id}`) : '—';
  }
  function findConsultation(id) { return consultationsCache.find((c) => String(c.id) === String(id)); }
  function findMedicine(id) { return medicinesCache.find((m) => String(m.id) === String(id)); }
  function findTest(id) { return testsCache.find((t) => String(t.id) === String(id)); }

  async function load() {
    setTableState('prescriptions', 'loading');
    try {
      const [data] = await Promise.all([HMD_API.get('/api/prescriptions'), loadLookups()]);
      allPrescriptions = Array.isArray(data) ? data : [];
      render();
    } catch (err) {
      setTableState('prescriptions', 'error');
      showToast(err.message, 'error');
    }
  }

  function render() {
    let rows = allPrescriptions;
    if (currentSearch) {
      rows = rows.filter((p) => {
        const c = findConsultation(p.consultationId ?? p.consultation?.id);
        const m = findMedicine(p.medicineId ?? p.medicine?.id);
        return consultationLabel(c).toLowerCase().includes(currentSearch) ||
          medicineLabel(m).toLowerCase().includes(currentSearch);
      });
    }

    const tbody = document.getElementById('prescriptionsTableBody');
    if (!rows.length) {
      tbody.innerHTML = '';
      setTableState('prescriptions', 'empty');
      return;
    }

    tbody.innerHTML = rows.map((p) => {
      const consultation = findConsultation(p.consultationId ?? p.consultation?.id);
      const medicine = findMedicine(p.medicineId ?? p.medicine?.id);
      const test = findTest(p.testId ?? p.test?.id);
      return `
        <tr>
          <td>#${escapeHtml(p.id)}</td>
          <td>${escapeHtml(consultationLabel(consultation))}</td>
          <td>${escapeHtml(medicineLabel(medicine))}</td>
          <td>${test ? escapeHtml(testLabel(test)) : '—'}</td>
          <td>${escapeHtml(p.notes || p.instructions || '—')}</td>
          <td class="col-actions">
            <div class="row-actions">
              <button data-edit="${p.id}" title="Edit"><i data-lucide="pencil"></i></button>
              <button data-delete="${p.id}" class="danger" title="Delete"><i data-lucide="trash-2"></i></button>
            </div>
          </td>
        </tr>
      `;
    }).join('');
    setTableState('prescriptions', 'ready');

    tbody.querySelectorAll('[data-edit]').forEach((btn) =>
      btn.addEventListener('click', () => openForm(allPrescriptions.find((p) => String(p.id) === btn.dataset.edit))));
    tbody.querySelectorAll('[data-delete]').forEach((btn) =>
      btn.addEventListener('click', () => remove(btn.dataset.delete)));
  }

  function search(term) {
    currentSearch = term;
    render();
  }

  function formFieldsHtml(p = {}) {
    const consultationId = p.consultationId ?? p.consultation?.id ?? '';
    const medicineId = p.medicineId ?? p.medicine?.id ?? '';
    const testId = p.testId ?? p.test?.id ?? '';
    return `
      <div class="form-grid">
        <div class="form-field full"><label>Consultation</label>
          <select class="select-field" id="f-consultationId" required>
            <option value="">Select consultation…</option>
            ${consultationsCache.map((c) => `<option value="${c.id}" ${String(c.id) === String(consultationId) ? 'selected' : ''}>${escapeHtml(consultationLabel(c))}</option>`).join('')}
          </select>
          <span class="field-error">Consultation is required.</span>
        </div>
        <div class="form-field"><label>Medicine</label>
          <select class="select-field" id="f-medicineId" required>
            <option value="">Select medicine…</option>
            ${medicinesCache.map((m) => `<option value="${m.id}" ${String(m.id) === String(medicineId) ? 'selected' : ''}>${escapeHtml(medicineLabel(m))}</option>`).join('')}
          </select>
          <span class="field-error">Medicine is required.</span>
        </div>
        <div class="form-field"><label>Test (optional)</label>
          <select class="select-field" id="f-testId">
            <option value="">None</option>
            ${testsCache.map((t) => `<option value="${t.id}" ${String(t.id) === String(testId) ? 'selected' : ''}>${escapeHtml(testLabel(t))}</option>`).join('')}
          </select>
        </div>
        <div class="form-field full"><label>Notes</label>
          <textarea class="input-field" id="f-notes" rows="3">${escapeHtml(p.notes || p.instructions || '')}</textarea>
        </div>
      </div>
    `;
  }

  function readForm() {
    return {
      consultationId: document.getElementById('f-consultationId').value,
      medicineId: document.getElementById('f-medicineId').value,
      testId: document.getElementById('f-testId').value || null,
      notes: document.getElementById('f-notes').value.trim(),
    };
  }

  function validate(body) {
    const errors = [];
    if (!body.consultationId) errors.push('f-consultationId');
    if (!body.medicineId) errors.push('f-medicineId');
    errors.forEach((id) => document.getElementById(id).closest('.form-field').classList.add('has-error'));
    return errors.length === 0;
  }

  function openForm(existing) {
    const isEdit = !!existing;
    HMD_MODAL.open({
      title: isEdit ? `Edit Prescription #${existing.id}` : 'Add Prescription',
      bodyHtml: formFieldsHtml(existing || {}),
      footHtml: `
        <button class="btn btn-ghost" id="cancelBtn">Cancel</button>
        <button class="btn btn-primary" id="saveBtn">${isEdit ? 'Save Changes' : 'Add Prescription'}</button>
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
              await HMD_API.put(`/api/prescriptions/${existing.id}`, body);
              showToast('Prescription updated.', 'success');
            } else {
              await HMD_API.post('/api/prescriptions', body);
              showToast('Prescription added.', 'success');
            }
            HMD_MODAL.close();
            load();
          } catch (err) {
            btn.disabled = false;
            btn.textContent = isEdit ? 'Save Changes' : 'Add Prescription';
            showToast(err.message, 'error');
          }
        });
      },
    });
  }

  function remove(id) {
    confirmDialog({
      title: 'Delete prescription?',
      message: `This will permanently remove prescription #${id}. This cannot be undone.`,
      onConfirm: async () => {
        await HMD_API.del(`/api/prescriptions/${id}`);
        showToast('Prescription deleted.', 'success');
        load();
      },
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('addPrescriptionBtn').addEventListener('click', async () => {
      if (!consultationsCache.length) await loadLookups();
      openForm(null);
    });
    document.querySelector('[data-retry="prescriptions"]').addEventListener('click', load);
  });

  HMD.pages.prescriptions = { load, search };
})();
