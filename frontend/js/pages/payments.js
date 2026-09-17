/**
 * pages/payments.js
 * -----------------------------------------------------------------------
 * Payments table + Add/Edit/Delete, backed by /api/payments. The
 * Consultation dropdown is populated live from /api/consultations.
 */

const HMD = window.HMD || (window.HMD = {});
HMD.pages = HMD.pages || {};

(function () {
  let allPayments = [];
  let consultationsCache = [];
  let currentFilter = '';
  let currentSearch = '';
  const METHOD_OPTIONS = ['COD', 'UPI', 'CARD', 'NETBANKING'];

  async function loadLookups() {
    try {
      const consultations = await HMD_API.get('/api/consultations');
      consultationsCache = Array.isArray(consultations) ? consultations : [];
    } catch (_) {
      consultationsCache = [];
    }
  }

  function consultationLabel(c) {
    return c ? `Consultation #${c.id} — ${formatDate(c.date)}` : '—';
  }
  function findConsultation(id) { return consultationsCache.find((c) => String(c.id) === String(id)); }

  async function load() {
    setTableState('payments', 'loading');
    try {
      const [data] = await Promise.all([HMD_API.get('/api/payments'), loadLookups()]);
      allPayments = Array.isArray(data) ? data : [];
      render();
    } catch (err) {
      setTableState('payments', 'error');
      showToast(err.message, 'error');
    }
  }

  function render() {
    let rows = allPayments;
    if (currentFilter) rows = rows.filter((p) => (p.paymentMethod || p.method) === currentFilter);
    if (currentSearch) {
      rows = rows.filter((p) => (p.paidBy || '').toLowerCase().includes(currentSearch) ||
        consultationLabel(findConsultation(p.consultationId ?? p.consultation?.id)).toLowerCase().includes(currentSearch));
    }

    const tbody = document.getElementById('paymentsTableBody');
    if (!rows.length) {
      tbody.innerHTML = '';
      setTableState('payments', 'empty');
      return;
    }

    tbody.innerHTML = rows.map((p) => {
      const consultation = findConsultation(p.consultationId ?? p.consultation?.id);
      return `
        <tr>
          <td>#${escapeHtml(p.id)}</td>
          <td>${escapeHtml(consultationLabel(consultation))}</td>
          <td>${formatCurrency(p.paymentAmount ?? p.amount)}</td>
          <td>${escapeHtml(p.paidBy || '—')}</td>
          <td><span class="badge badge-info">${escapeHtml(p.paymentMethod || p.method || '—')}</span></td>
          <td class="col-actions">
            <div class="row-actions">
              <button data-edit="${p.id}" title="Edit"><i data-lucide="pencil"></i></button>
              <button data-delete="${p.id}" class="danger" title="Delete"><i data-lucide="trash-2"></i></button>
            </div>
          </td>
        </tr>
      `;
    }).join('');
    setTableState('payments', 'ready');

    tbody.querySelectorAll('[data-edit]').forEach((btn) =>
      btn.addEventListener('click', () => openForm(allPayments.find((p) => String(p.id) === btn.dataset.edit))));
    tbody.querySelectorAll('[data-delete]').forEach((btn) =>
      btn.addEventListener('click', () => remove(btn.dataset.delete)));
  }

  function search(term) {
    currentSearch = term;
    render();
  }

  function formFieldsHtml(p = {}) {
    const consultationId = p.consultationId ?? p.consultation?.id ?? '';
    const method = p.paymentMethod || p.method || '';
    return `
      <div class="form-grid">
        <div class="form-field full"><label>Consultation</label>
          <select class="select-field" id="f-consultationId" required>
            <option value="">Select consultation…</option>
            ${consultationsCache.map((c) => `<option value="${c.id}" ${String(c.id) === String(consultationId) ? 'selected' : ''}>${escapeHtml(consultationLabel(c))}</option>`).join('')}
          </select>
          <span class="field-error">Consultation is required.</span>
        </div>
        <div class="form-field"><label>Payment Amount</label>
          <input type="number" min="0" step="0.01" class="input-field" id="f-paymentAmount" value="${p.paymentAmount ?? p.amount ?? ''}" required />
          <span class="field-error">Amount is required.</span>
        </div>
        <div class="form-field"><label>Paid By</label>
          <input class="input-field" id="f-paidBy" value="${escapeHtml(p.paidBy || '')}" />
        </div>
        <div class="form-field full"><label>Payment Method</label>
          <select class="select-field" id="f-paymentMethod" required>
            <option value="">Select…</option>
            ${METHOD_OPTIONS.map((m) => `<option value="${m}" ${method === m ? 'selected' : ''}>${m}</option>`).join('')}
          </select>
          <span class="field-error">Payment method is required.</span>
        </div>
      </div>
    `;
  }

  function readForm() {
    return {
      consultationId: document.getElementById('f-consultationId').value,
      paymentAmount: Number(document.getElementById('f-paymentAmount').value),
      paidBy: document.getElementById('f-paidBy').value.trim(),
      paymentMethod: document.getElementById('f-paymentMethod').value,
    };
  }

  function validate(body) {
    const errors = [];
    if (!body.consultationId) errors.push('f-consultationId');
    if (!body.paymentAmount && body.paymentAmount !== 0) errors.push('f-paymentAmount');
    if (!body.paymentMethod) errors.push('f-paymentMethod');
    errors.forEach((id) => document.getElementById(id).closest('.form-field').classList.add('has-error'));
    return errors.length === 0;
  }

  function openForm(existing) {
    const isEdit = !!existing;
    HMD_MODAL.open({
      title: isEdit ? `Edit Payment #${existing.id}` : 'Add Payment',
      bodyHtml: formFieldsHtml(existing || {}),
      footHtml: `
        <button class="btn btn-ghost" id="cancelBtn">Cancel</button>
        <button class="btn btn-primary" id="saveBtn">${isEdit ? 'Save Changes' : 'Add Payment'}</button>
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
              await HMD_API.put(`/api/payments/${existing.id}`, body);
              showToast('Payment updated.', 'success');
            } else {
              await HMD_API.post('/api/payments', body);
              showToast('Payment recorded.', 'success');
            }
            HMD_MODAL.close();
            load();
          } catch (err) {
            btn.disabled = false;
            btn.textContent = isEdit ? 'Save Changes' : 'Add Payment';
            showToast(err.message, 'error');
          }
        });
      },
    });
  }

  function remove(id) {
    confirmDialog({
      title: 'Delete payment?',
      message: `This will permanently remove payment #${id}. This cannot be undone.`,
      onConfirm: async () => {
        await HMD_API.del(`/api/payments/${id}`);
        showToast('Payment deleted.', 'success');
        load();
      },
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('addPaymentBtn').addEventListener('click', async () => {
      if (!consultationsCache.length) await loadLookups();
      openForm(null);
    });
    document.getElementById('paymentMethodFilter').addEventListener('change', (e) => {
      currentFilter = e.target.value;
      render();
    });
    document.querySelector('[data-retry="payments"]').addEventListener('click', load);
  });

  HMD.pages.payments = { load, search };
})();
