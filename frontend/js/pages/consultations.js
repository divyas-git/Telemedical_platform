/**
 * pages/consultations.js
 * -----------------------------------------------------------------------
 * Consultations table + Add/Edit/Delete, backed by /api/consultations.
 * Patient and Doctor dropdowns are always populated live from
 * /api/patients and /api/doctors — never hardcoded.
 *
 * IMPORTANT — Oracle column mapping:
 * The Oracle CONSULTATION table column is `consultation_mode`, not `mode`.
 * This frontend always reads/writes the JSON field `consultationMode`
 * (never `mode`); the Spring Boot backend is responsible for mapping
 * consultationMode -> consultation_mode -> the CONSULTATION table.
 */

const HMD = window.HMD || (window.HMD = {});
HMD.pages = HMD.pages || {};

(function () {
  let allConsultations = [];
  let patientsCache = [];
  let doctorsCache = [];
  let statusOptions = [];
  let currentStatusFilter = '';
  let currentModeFilter = '';
  let currentSearch = '';

  const MODE_OPTIONS = ['VIDEO', 'AUDIO', 'CHAT'];

  async function loadLookups() {
    const [patients, doctors] = await Promise.all([
      HMD_API.get('/api/patients').catch(() => []),
      HMD_API.get('/api/doctors').catch(() => []),
    ]);
    patientsCache = Array.isArray(patients) ? patients : [];
    doctorsCache = Array.isArray(doctors) ? doctors : [];
  }

  function populateStatusFilter() {
    statusOptions = [...new Set(allConsultations.map((c) => c.status).filter(Boolean))];
    const select = document.getElementById('consultStatusFilter');
    const prev = select.value;
    select.innerHTML = '<option value="">All statuses</option>' +
      statusOptions.map((s) => `<option value="${escapeHtml(s)}">${escapeHtml(s)}</option>`).join('');
    select.value = statusOptions.includes(prev) ? prev : '';
  }

  async function load() {
    setTableState('consultations', 'loading');
    try {
      const [data] = await Promise.all([HMD_API.get('/api/consultations'), loadLookups()]);
      allConsultations = Array.isArray(data) ? data : [];
      populateStatusFilter();
      render();
    } catch (err) {
      setTableState('consultations', 'error');
      showToast(err.message, 'error');
    }
  }

  function patientLabel(p) {
    return p ? `${fullName(p)} (#${p.id})` : '—';
  }
  function doctorLabel(d) {
    return d ? `${fullName(d)} (#${d.id})` : '—';
  }
  function findPatient(id) { return patientsCache.find((p) => String(p.id) === String(id)); }
  function findDoctor(id) { return doctorsCache.find((d) => String(d.id) === String(id)); }

  function render() {
    let rows = allConsultations;
    if (currentStatusFilter) rows = rows.filter((c) => c.status === currentStatusFilter);
    if (currentModeFilter) rows = rows.filter((c) => c.consultationMode === currentModeFilter);
    if (currentSearch) {
      rows = rows.filter((c) => {
        const p = findPatient(c.patientId ?? c.patient?.id);
        const d = findDoctor(c.doctorId ?? c.doctor?.id);
        return patientLabel(p).toLowerCase().includes(currentSearch) || doctorLabel(d).toLowerCase().includes(currentSearch);
      });
    }

    const tbody = document.getElementById('consultationsTableBody');
    if (!rows.length) {
      tbody.innerHTML = '';
      setTableState('consultations', 'empty');
      return;
    }

    tbody.innerHTML = rows.map((c) => {
      const patient = findPatient(c.patientId ?? c.patient?.id);
      const doctor = findDoctor(c.doctorId ?? c.doctor?.id);
      return `
        <tr>
          <td>#${escapeHtml(c.id)}</td>
          <td>${escapeHtml(patientLabel(patient))}</td>
          <td>${escapeHtml(doctorLabel(doctor))}</td>
          <td>${formatDate(c.bookingDate)}</td>
          <td>${formatDate(c.date)}</td>
          <td>${formatTime(c.startTime)}&ndash;${formatTime(c.endTime)}</td>
          <td>${modeBadge(c.consultationMode)}</td>
          <td>${statusBadge(c.status)}</td>
          <td class="col-actions">
            <div class="row-actions">
              <button data-edit="${c.id}" title="Edit"><i data-lucide="pencil"></i></button>
              <button data-delete="${c.id}" class="danger" title="Delete"><i data-lucide="trash-2"></i></button>
            </div>
          </td>
        </tr>
      `;
    }).join('');
    setTableState('consultations', 'ready');
    if (window.lucide) lucide.createIcons();

    tbody.querySelectorAll('[data-edit]').forEach((btn) =>
      btn.addEventListener('click', () => openForm(allConsultations.find((c) => String(c.id) === btn.dataset.edit))));
    tbody.querySelectorAll('[data-delete]').forEach((btn) =>
      btn.addEventListener('click', () => remove(btn.dataset.delete)));
  }

  function search(term) {
    currentSearch = term;
    render();
  }

  function modeSpecificFieldsHtml(mode) {
    const m = mode || '';
    return `
      <div class="form-field full" data-mode-field="VIDEO" style="display:${m === 'VIDEO' ? 'flex' : 'none'}">
        <label>Video Link</label>
        <input class="input-field" id="f-videoLink" placeholder="https://…" />
      </div>
      <div class="form-field full" data-mode-field="AUDIO" style="display:${m === 'AUDIO' ? 'flex' : 'none'}">
        <label>Call Number</label>
        <input class="input-field" id="f-callNumber" placeholder="+91…" />
      </div>
      <div class="form-field full" data-mode-field="CHAT" style="display:${m === 'CHAT' ? 'flex' : 'none'}">
        <label>Chat Transcript ID</label>
        <input class="input-field" id="f-chatTranscriptId" />
      </div>
    `;
  }

  function formFieldsHtml(c = {}) {
    const patientId = c.patientId ?? c.patient?.id ?? '';
    const doctorId = c.doctorId ?? c.doctor?.id ?? '';
    return `
      <div class="form-grid">
        <div class="form-field"><label>Patient</label>
          <select class="select-field" id="f-patientId" required>
            <option value="">Select patient…</option>
            ${patientsCache.map((p) => `<option value="${p.id}" ${String(p.id) === String(patientId) ? 'selected' : ''}>${escapeHtml(patientLabel(p))}</option>`).join('')}
          </select>
          <span class="field-error">Patient is required.</span>
        </div>
        <div class="form-field"><label>Doctor</label>
          <select class="select-field" id="f-doctorId" required>
            <option value="">Select doctor…</option>
            ${doctorsCache.map((d) => `<option value="${d.id}" ${String(d.id) === String(doctorId) ? 'selected' : ''}>${escapeHtml(doctorLabel(d))}</option>`).join('')}
          </select>
          <span class="field-error">Doctor is required.</span>
        </div>
        <div class="form-field"><label>Booking Date</label>
          <input type="date" class="input-field" id="f-bookingDate" value="${c.bookingDate ? String(c.bookingDate).slice(0, 10) : ''}" />
        </div>
        <div class="form-field"><label>Consultation Date</label>
          <input type="date" class="input-field" id="f-date" value="${c.date ? String(c.date).slice(0, 10) : ''}" required />
          <span class="field-error">Date is required.</span>
        </div>
        <div class="form-field"><label>Start Time</label>
          <input type="time" class="input-field" id="f-startTime" value="${c.startTime ? String(c.startTime).slice(0, 5) : ''}" />
        </div>
        <div class="form-field"><label>End Time</label>
          <input type="time" class="input-field" id="f-endTime" value="${c.endTime ? String(c.endTime).slice(0, 5) : ''}" />
        </div>
        <div class="form-field"><label>Status</label>
          <input class="input-field" id="f-status" value="${escapeHtml(c.status || '')}" placeholder="e.g. SCHEDULED" />
        </div>
        <div class="form-field"><label>Consultation Mode</label>
          <select class="select-field" id="f-consultationMode" required>
            <option value="">Select…</option>
            ${MODE_OPTIONS.map((m) => `<option value="${m}" ${c.consultationMode === m ? 'selected' : ''}>${m}</option>`).join('')}
          </select>
          <span class="field-error">Consultation mode is required.</span>
        </div>
        ${modeSpecificFieldsHtml(c.consultationMode)}
      </div>
    `;
  }

  function wireModeToggle() {
    const modeSelect = document.getElementById('f-consultationMode');
    modeSelect.addEventListener('change', () => {
      document.querySelectorAll('[data-mode-field]').forEach((el) => {
        el.style.display = el.dataset.modeField === modeSelect.value ? 'flex' : 'none';
      });
    });
  }

  function readForm(existing) {
    const mode = document.getElementById('f-consultationMode').value;
    const body = {
      patientId: document.getElementById('f-patientId').value,
      doctorId: document.getElementById('f-doctorId').value,
      bookingDate: document.getElementById('f-bookingDate').value,
      date: document.getElementById('f-date').value,
      startTime: document.getElementById('f-startTime').value,
      endTime: document.getElementById('f-endTime').value,
      status: document.getElementById('f-status').value.trim(),
      // Frontend field name is consultationMode; the backend maps this to
      // the Oracle consultation_mode column. Never send `mode`.
      consultationMode: mode,
      videoLink: null,
      callNumber: null,
      chatTranscriptId: null,
    };
    if (mode === 'VIDEO') body.videoLink = document.getElementById('f-videoLink').value.trim();
    if (mode === 'AUDIO') body.callNumber = document.getElementById('f-callNumber').value.trim();
    if (mode === 'CHAT') body.chatTranscriptId = document.getElementById('f-chatTranscriptId').value.trim();
    return body;
  }

  function validate(body) {
    const errors = [];
    if (!body.patientId) errors.push('f-patientId');
    if (!body.doctorId) errors.push('f-doctorId');
    if (!body.date) errors.push('f-date');
    if (!body.consultationMode) errors.push('f-consultationMode');
    errors.forEach((id) => document.getElementById(id).closest('.form-field').classList.add('has-error'));
    return errors.length === 0;
  }

  function openForm(existing) {
    const isEdit = !!existing;
    HMD_MODAL.open({
      title: isEdit ? `Edit Consultation #${existing.id}` : 'New Consultation',
      bodyHtml: formFieldsHtml(existing || {}),
      footHtml: `
        <button class="btn btn-ghost" id="cancelBtn">Cancel</button>
        <button class="btn btn-primary" id="saveBtn">${isEdit ? 'Save Changes' : 'Create Consultation'}</button>
      `,
      onMount() {
        wireModeToggle();
        document.getElementById('cancelBtn').addEventListener('click', () => HMD_MODAL.close());
        document.getElementById('saveBtn').addEventListener('click', async () => {
          document.querySelectorAll('.form-field').forEach((f) => f.classList.remove('has-error'));
          const body = readForm(existing);
          if (!validate(body)) return;
          const btn = document.getElementById('saveBtn');
          btn.disabled = true;
          btn.textContent = 'Saving…';
          try {
            if (isEdit) {
              await HMD_API.put(`/api/consultations/${existing.id}`, body);
              showToast('Consultation updated.', 'success');
            } else {
              await HMD_API.post('/api/consultations', body);
              showToast('Consultation created.', 'success');
            }
            HMD_MODAL.close();
            load();
          } catch (err) {
            btn.disabled = false;
            btn.textContent = isEdit ? 'Save Changes' : 'Create Consultation';
            showToast(err.message, 'error');
          }
        });
      },
    });
  }

  function remove(id) {
    confirmDialog({
      title: 'Delete consultation?',
      message: `This will permanently remove consultation #${id}. This cannot be undone.`,
      onConfirm: async () => {
        await HMD_API.del(`/api/consultations/${id}`);
        showToast('Consultation deleted.', 'success');
        load();
      },
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('addConsultationBtn').addEventListener('click', async () => {
      if (!patientsCache.length || !doctorsCache.length) await loadLookups();
      openForm(null);
    });
    document.getElementById('consultStatusFilter').addEventListener('change', (e) => {
      currentStatusFilter = e.target.value;
      render();
    });
    document.getElementById('consultModeFilter').addEventListener('change', (e) => {
      currentModeFilter = e.target.value;
      render();
    });
    document.querySelector('[data-retry="consultations"]').addEventListener('click', load);
  });

  HMD.pages.consultations = { load, search };
})();
