/**
 * pages/doctors.js
 * -----------------------------------------------------------------------
 * Doctors table + Add/Edit/Delete, backed by /api/doctors. Specialization
 * options are loaded dynamically — first from a dedicated
 * /api/specializations endpoint if the backend exposes one, otherwise
 * derived from the specializations already present on loaded doctors.
 * Nothing here is a hardcoded list of specializations.
 */

const HMD = window.HMD || (window.HMD = {});
HMD.pages = HMD.pages || {};

(function () {
  let allDoctors = [];
  let specializations = [];
  let currentFilter = '';
  let currentSearch = '';

  async function loadSpecializations() {
    try {
      const data = await HMD_API.get('/api/specializations');
      if (Array.isArray(data) && data.length) {
        specializations = data.map((s) => (typeof s === 'string' ? s : (s.name || s.specialization || String(s.id))));
        return;
      }
    } catch (_) {
      // Endpoint may not exist — fall back to deriving from doctor records below.
    }
    specializations = [...new Set(allDoctors.map((d) => d.specialization).filter(Boolean))];
  }

  function populateSpecializationOptions() {
    const filterSelect = document.getElementById('doctorSpecFilter');
    const prev = filterSelect.value;
    filterSelect.innerHTML = '<option value="">All specializations</option>' +
      specializations.map((s) => `<option value="${escapeHtml(s)}">${escapeHtml(s)}</option>`).join('');
    filterSelect.value = specializations.includes(prev) ? prev : '';
  }

  async function load() {
    setTableState('doctors', 'loading');
    try {
      const data = await HMD_API.get('/api/doctors');
      allDoctors = Array.isArray(data) ? data : [];
      await loadSpecializations();
      populateSpecializationOptions();
      render();
    } catch (err) {
      setTableState('doctors', 'error');
      showToast(err.message, 'error');
    }
  }

  function render() {
    let rows = allDoctors;
    if (currentFilter) rows = rows.filter((d) => d.specialization === currentFilter);
    if (currentSearch) rows = rows.filter((d) => fullName(d).toLowerCase().includes(currentSearch));

    const tbody = document.getElementById('doctorsTableBody');
    if (!rows.length) {
      tbody.innerHTML = '';
      setTableState('doctors', 'empty');
      return;
    }

    tbody.innerHTML = rows.map((d) => `
      <tr>
        <td>#${escapeHtml(d.id)}</td>
        <td>${escapeHtml(fullName(d))}</td>
        <td>${escapeHtml(d.gender || '—')}</td>
        <td>${formatDate(d.dob)}</td>
        <td>${formatDate(d.dateJoined || d.joinDate)}</td>
        <td>${escapeHtml(d.licenseNo || d.licenseNumber || '—')}</td>
        <td>${d.experience !== undefined && d.experience !== null ? escapeHtml(d.experience) + ' yrs' : '—'}</td>
        <td>${escapeHtml(d.specialization || '—')}</td>
        <td class="col-actions">
          <div class="row-actions">
            <button data-edit="${d.id}" title="Edit"><i data-lucide="pencil"></i></button>
            <button data-delete="${d.id}" class="danger" title="Delete"><i data-lucide="trash-2"></i></button>
          </div>
        </td>
      </tr>
    `).join('');
    setTableState('doctors', 'ready');

    tbody.querySelectorAll('[data-edit]').forEach((btn) =>
      btn.addEventListener('click', () => openForm(allDoctors.find((d) => String(d.id) === btn.dataset.edit))));
    tbody.querySelectorAll('[data-delete]').forEach((btn) =>
      btn.addEventListener('click', () => remove(btn.dataset.delete)));
  }

  function search(term) {
    currentSearch = term;
    render();
  }

  function specializationFieldHtml(d) {
    if (specializations.length) {
      return `
        <select class="select-field" id="f-specialization">
          <option value="">Select…</option>
          ${specializations.map((s) => `<option value="${escapeHtml(s)}" ${d.specialization === s ? 'selected' : ''}>${escapeHtml(s)}</option>`).join('')}
        </select>
      `;
    }
    return `<input class="input-field" id="f-specialization" value="${escapeHtml(d.specialization || '')}" placeholder="e.g. Cardiology" />`;
  }

  function formFieldsHtml(d = {}) {
    return `
      <div class="form-grid">
        <div class="form-field"><label>First Name</label>
          <input class="input-field" id="f-firstName" value="${escapeHtml(d.firstName || '')}" required />
          <span class="field-error">First name is required.</span>
        </div>
        <div class="form-field"><label>Last Name</label>
          <input class="input-field" id="f-lastName" value="${escapeHtml(d.lastName || '')}" required />
          <span class="field-error">Last name is required.</span>
        </div>
        <div class="form-field"><label>Date of Birth</label>
          <input type="date" class="input-field" id="f-dob" value="${d.dob ? String(d.dob).slice(0, 10) : ''}" />
        </div>
        <div class="form-field"><label>Gender</label>
          <select class="select-field" id="f-gender">
            <option value="">Select…</option>
            <option value="M" ${d.gender === 'M' ? 'selected' : ''}>Male</option>
            <option value="F" ${d.gender === 'F' ? 'selected' : ''}>Female</option>
            <option value="O" ${d.gender === 'O' ? 'selected' : ''}>Other</option>
          </select>
        </div>
        <div class="form-field"><label>Date Joined</label>
          <input type="date" class="input-field" id="f-dateJoined" value="${d.dateJoined ? String(d.dateJoined).slice(0, 10) : ''}" />
        </div>
        <div class="form-field"><label>License No</label>
          <input class="input-field" id="f-licenseNo" value="${escapeHtml(d.licenseNo || d.licenseNumber || '')}" />
        </div>
        <div class="form-field"><label>Experience (years)</label>
          <input type="number" min="0" class="input-field" id="f-experience" value="${d.experience ?? ''}" />
        </div>
        <div class="form-field"><label>Specialization</label>
          ${specializationFieldHtml(d)}
          <span class="field-error">Specialization is required.</span>
        </div>
      </div>
    `;
  }

  function readForm() {
    return {
      firstName: document.getElementById('f-firstName').value.trim(),
      lastName: document.getElementById('f-lastName').value.trim(),
      dob: document.getElementById('f-dob').value,
      gender: document.getElementById('f-gender').value,
      dateJoined: document.getElementById('f-dateJoined').value,
      licenseNo: document.getElementById('f-licenseNo').value.trim(),
      experience: document.getElementById('f-experience').value ? Number(document.getElementById('f-experience').value) : null,
      specialization: document.getElementById('f-specialization').value.trim(),
    };
  }

  function validate(body) {
    const errors = [];
    if (!body.firstName) errors.push('f-firstName');
    if (!body.lastName) errors.push('f-lastName');
    if (!body.specialization) errors.push('f-specialization');
    errors.forEach((id) => document.getElementById(id).closest('.form-field').classList.add('has-error'));
    return errors.length === 0;
  }

  function openForm(existing) {
    const isEdit = !!existing;
    HMD_MODAL.open({
      title: isEdit ? `Edit Doctor #${existing.id}` : 'Add Doctor',
      bodyHtml: formFieldsHtml(existing || {}),
      footHtml: `
        <button class="btn btn-ghost" id="cancelBtn">Cancel</button>
        <button class="btn btn-primary" id="saveBtn">${isEdit ? 'Save Changes' : 'Add Doctor'}</button>
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
              await HMD_API.put(`/api/doctors/${existing.id}`, body);
              showToast('Doctor updated.', 'success');
            } else {
              await HMD_API.post('/api/doctors', body);
              showToast('Doctor added.', 'success');
            }
            HMD_MODAL.close();
            load();
          } catch (err) {
            btn.disabled = false;
            btn.textContent = isEdit ? 'Save Changes' : 'Add Doctor';
            showToast(err.message, 'error');
          }
        });
      },
    });
  }

  function remove(id) {
    confirmDialog({
      title: 'Delete doctor?',
      message: `This will permanently remove doctor #${id}. This cannot be undone.`,
      onConfirm: async () => {
        await HMD_API.del(`/api/doctors/${id}`);
        showToast('Doctor deleted.', 'success');
        load();
      },
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('addDoctorBtn').addEventListener('click', () => openForm(null));
    document.getElementById('doctorSpecFilter').addEventListener('change', (e) => {
      currentFilter = e.target.value;
      render();
    });
    document.querySelector('[data-retry="doctors"]').addEventListener('click', load);
  });

  HMD.pages.doctors = { load, search };
})();
