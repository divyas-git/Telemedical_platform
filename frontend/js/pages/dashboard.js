/**
 * pages/dashboard.js
 * -----------------------------------------------------------------------
 * Loads every number and chart on the dashboard from the backend. Nothing
 * here is hardcoded — if an endpoint is unavailable, the corresponding
 * card/chart shows a loading skeleton, then an empty or error state.
 */

const HMD = window.HMD || (window.HMD = {});
HMD.pages = HMD.pages || {};

(function () {
  let charts = {};

  const STAT_CARDS = [
    { key: 'totalPatients', label: 'Total Patients', icon: 'users', accent: '' },
    { key: 'totalDoctors', label: 'Total Doctors', icon: 'stethoscope', accent: 'accent-info' },
    { key: 'totalHospitals', label: 'Total Hospitals', icon: 'building-2', accent: 'accent-clay' },
    { key: 'totalConsultations', label: 'Total Consultations', icon: 'video', accent: '' },
    { key: 'totalPayments', label: 'Total Payments', icon: 'credit-card', accent: 'accent-warn' },
  ];

  function renderSkeletons() {
    const grid = document.getElementById('statGrid');
    grid.innerHTML = STAT_CARDS.map((c) => `
      <div class="stat-card ${c.accent}">
        <span class="stat-label">${c.label}</span>
        <div class="stat-skel"></div>
      </div>
    `).join('');
  }

  function renderStats(summary) {
    const grid = document.getElementById('statGrid');
    grid.innerHTML = STAT_CARDS.map((c) => {
      const raw = summary ? summary[c.key] : undefined;
      const value = (raw === undefined || raw === null) ? '—' : Number(raw).toLocaleString();
      return `
        <div class="stat-card ${c.accent}">
          <span class="stat-label">${c.label}</span>
          <span class="stat-value">${value}</span>
        </div>
      `;
    }).join('');
  }

  /** Normalizes a list of {label-ish, value-ish} objects from the backend
   *  into parallel arrays, regardless of the exact key names used. */
  function normalizePairs(list, labelKeys, valueKeys) {
    if (!Array.isArray(list)) return { labels: [], values: [] };
    const labels = [];
    const values = [];
    list.forEach((row) => {
      const labelKey = labelKeys.find((k) => row[k] !== undefined);
      const valueKey = valueKeys.find((k) => row[k] !== undefined);
      labels.push(labelKey ? String(row[labelKey]) : '—');
      values.push(valueKey ? Number(row[valueKey]) || 0 : 0);
    });
    return { labels, values };
  }

  const PALETTE = ['#16786F', '#D9714E', '#2563AA', '#B7791F', '#8B5CF6', '#1E8E5A', '#C0392B', '#0D3C39'];

  function renderChart(canvasId, emptyId, type, data, opts = {}) {
    const canvas = document.getElementById(canvasId);
    const emptyEl = document.getElementById(emptyId);
    if (charts[canvasId]) { charts[canvasId].destroy(); charts[canvasId] = null; }

    if (!data.labels.length || data.values.every((v) => !v)) {
      canvas.style.display = 'none';
      emptyEl.hidden = false;
      if (window.lucide) lucide.createIcons();
      return;
    }
    canvas.style.display = 'block';
    emptyEl.hidden = true;

    charts[canvasId] = new Chart(canvas.getContext('2d'), {
      type,
      data: {
        labels: data.labels,
        datasets: [{
          label: opts.label || '',
          data: data.values,
          backgroundColor: type === 'line' ? 'rgba(22,120,111,0.12)' : PALETTE,
          borderColor: type === 'line' ? '#16786F' : '#fff',
          borderWidth: type === 'bar' ? 0 : 2,
          borderRadius: type === 'bar' ? 6 : 0,
          tension: 0.35,
          fill: type === 'line',
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: type === 'doughnut' || type === 'pie', position: 'bottom', labels: { boxWidth: 10, font: { size: 11 } } },
        },
        scales: (type === 'bar' || type === 'line') ? {
          y: { beginAtZero: true, ticks: { precision: 0 } },
          x: { grid: { display: false } },
        } : undefined,
      },
    });
  }

  async function load() {
    renderSkeletons();

    HMD_API.get('/api/dashboard/summary')
      .then(renderStats)
      .catch(() => renderStats(null));

    HMD_API.get('/api/dashboard/consultations-by-status')
      .then((rows) => {
        const data = normalizePairs(rows, ['status', 'label', 'name'], ['count', 'total', 'value']);
        renderChart('chartConsultStatus', 'emptyConsultStatus', 'doughnut', data);
      })
      .catch(() => renderChart('chartConsultStatus', 'emptyConsultStatus', 'doughnut', { labels: [], values: [] }));

    HMD_API.get('/api/dashboard/patients-by-city')
      .then((rows) => {
        const data = normalizePairs(rows, ['city', 'label', 'name'], ['count', 'total', 'value']);
        renderChart('chartPatientsCity', 'emptyPatientsCity', 'bar', data, { label: 'Patients' });
      })
      .catch(() => renderChart('chartPatientsCity', 'emptyPatientsCity', 'bar', { labels: [], values: [] }));

    HMD_API.get('/api/dashboard/doctors-by-specialization')
      .then((rows) => {
        const data = normalizePairs(rows, ['specialization', 'label', 'name'], ['count', 'total', 'value']);
        renderChart('chartDoctorsSpec', 'emptyDoctorsSpec', 'pie', data);
      })
      .catch(() => renderChart('chartDoctorsSpec', 'emptyDoctorsSpec', 'pie', { labels: [], values: [] }));

    HMD_API.get('/api/dashboard/payment-summary')
      .then((rows) => {
        const data = normalizePairs(rows, ['method', 'label', 'name'], ['total', 'amount', 'count', 'value']);
        renderChart('chartPayments', 'emptyPayments', 'bar', data, { label: 'Amount' });
      })
      .catch(() => renderChart('chartPayments', 'emptyPayments', 'bar', { labels: [], values: [] }));
  }

  HMD.pages.dashboard = { load };
})();
