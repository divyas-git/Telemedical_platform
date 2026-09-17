/**
 * pages/tests.js
 * -----------------------------------------------------------------------
 * Lab tests table + Add/Edit/Delete, backed by /api/tests.
 */

const HMD = window.HMD || (window.HMD = {});
HMD.pages = HMD.pages || {};

(function () {
  let allTests = [];
  let currentFilter = '';
  let currentSearch = '';
  const TYPE_OPTIONS = ['BLOOD_TEST', 'X_RAY', 'URINE_TEST', 'ECG'];
  const TYPE_LABEL = { BLOOD_TEST: 'Blood Test', X_RAY: 'X-Ray', URINE_TEST: 'Urine Test', ECG: 'ECG' };

  async function load() {
    setTableState('tests', 'loading');
    try {
      const data = await HMD_API.get('/api/tests');
      allTests = Array.isArray(data) ? data : [];
      render();
    } catch (err) {
      setTableState('tests', 'error');
      showToast(err.message, 'error');
    }
  }

  function render() {
    let rows = allTests;
    if (currentFilter) rows = rows.filter((t) => (t.testType || t.type) === currentFilter);
    if (currentSearch) rows = rows.filter((t) => (t.testName || t.name || '').toLowerCase().includes(currentSearch));

    const tbody = document.getElementById('testsTableBody');
    if (!rows.length) {
      tbody.innerHTML = '';
      setTableState('tests', 'empty');
      return;
    }

    tbody.innerHTML = rows.map((t) => `
      <tr>
        <td>#${escapeHtml(t.id)}</td>
        <td>${escapeHtml(t.testName || t.name || '—')}</td>
        <td><span class="badge badge-neutral">${escapeHtml(TYPE_LABEL[t.testType || t.type] || t.testType || t.type || '—')}</span></td>
        <td class="col-actions">
          <div class="row-actions">
            <button data-edit="${t.id}" title="Edit"><i data-lucide="pencil"></i></button>
            <button data-delete="${t.id}" class="danger" title="Delete"><i data-lucide="trash-2"></i></button>
          </div>
        </td>
      </tr>
    `).join('');
    setTableState('tests', 'ready');

    tbody.querySelectorAll('[data-edit]').forEach((btn) =>
      btn.addEventListener('click', () => openForm(allTests.find((t) => String(t.id) === btn.dataset.edit))));
    tbody.querySelectorAll('[data-delete]').forEach((btn) =>
      btn.addEventListener('click', () => remove(btn.dataset.delete)));
  }

  function search(term) {
    currentSearch = term;
    render();
  }

  function formFieldsHtml(t = {}) {
    const currentType = t.testType || t.type || '';
    return `
      <div class="form-grid">
        <div class="form-field full"><label>Test Name</label>
          <input class="input-field" id="f-testName" value="${escapeHtml(t.testName || t.name || '')}" required />
          <span class="field-error">Test name is required.</span>
        </div>
        <div class="form-field full"><label>Test Type</label>
          <select class="select-field" id="f-testType" required>
            <option value="">Select…</option>
            ${TYPE_OPTIONS.map((ty) => `<option value="${ty}" ${currentType === ty ? 'selected' : ''}>${TYPE_LABEL[ty]}</option>`).join('')}
          </select>
          <span class="field-error">Test type is required.</span>
        </div>
      </div>
    `;
  }

  function readForm() {
    return {
      testName: document.getElementById('f-testName').value.trim(),
      testType: document.getElementById('f-testType').value,
    };
  }

  function validate(body) {
    const errors = [];
    if (!body.testName) errors.push('f-testName');
    if (!body.testType) errors.push('f-testType');
    errors.forEach((id) => document.getElementById(id).closest('.form-field').classList.add('has-error'));
    return errors.length === 0;
  }

  function openForm(existing) {
    const isEdit = !!existing;
    HMD_MODAL.open({
      title: isEdit ? `Edit Test #${existing.id}` : 'Add Test',
      bodyHtml: formFieldsHtml(existing || {}),
      footHtml: `
        <button class="btn btn-ghost" id="cancelBtn">Cancel</button>
        <button class="btn btn-primary" id="saveBtn">${isEdit ? 'Save Changes' : 'Add Test'}</button>
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
              await HMD_API.put(`/api/tests/${existing.id}`, body);
              showToast('Test updated.', 'success');
            } else {
              await HMD_API.post('/api/tests', body);
              showToast('Test added.', 'success');
            }
            HMD_MODAL.close();
            load();
          } catch (err) {
            btn.disabled = false;
            btn.textContent = isEdit ? 'Save Changes' : 'Add Test';
            showToast(err.message, 'error');
          }
        });
      },
    });
  }

  function remove(id) {
    confirmDialog({
      title: 'Delete test?',
      message: `This will permanently remove test #${id}. This cannot be undone.`,
      onConfirm: async () => {
        await HMD_API.del(`/api/tests/${id}`);
        showToast('Test deleted.', 'success');
        load();
      },
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('addTestBtn').addEventListener('click', () => openForm(null));
    document.getElementById('testTypeFilter').addEventListener('change', (e) => {
      currentFilter = e.target.value;
      render();
    });
    document.querySelector('[data-retry="tests"]').addEventListener('click', load);
  });

  HMD.pages.tests = { load, search };
})();
