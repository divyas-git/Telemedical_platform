/**
 * utils.js
 * -----------------------------------------------------------------------
 * Shared helpers used across every page module: toasts, the modal/drawer,
 * date/text formatting, debouncing search input, and the loading/empty/
 * error state toggler for tables.
 */

const HMD = window.HMD || {};

/* ---------------------------------------------------------------------
   Toasts
   ------------------------------------------------------------------- */
const ICONS = {
  success: 'check-circle-2',
  error: 'alert-circle',
  info: 'info',
};

function showToast(message, type = 'info', timeout = 3800) {
  const stack = document.getElementById('toastStack');
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.innerHTML = `<i data-lucide="${ICONS[type] || ICONS.info}"></i><span></span>`;
  el.querySelector('span').textContent = message;
  stack.appendChild(el);
  if (window.lucide) lucide.createIcons({ nameAttr: 'data-lucide', attrs: {} });
  setTimeout(() => {
    el.style.opacity = '0';
    el.style.transform = 'translateY(6px)';
    el.style.transition = 'opacity .15s ease, transform .15s ease';
    setTimeout(() => el.remove(), 180);
  }, timeout);
}

/* ---------------------------------------------------------------------
   Modal / drawer form
   ------------------------------------------------------------------- */
const HMD_MODAL = {
  backdrop: null,
  onCloseCb: null,

  init() {
    this.backdrop = document.getElementById('modalBackdrop');
    document.getElementById('modalClose').addEventListener('click', () => this.close());
    this.backdrop.addEventListener('click', (e) => {
      if (e.target === this.backdrop) this.close();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.backdrop.classList.contains('open')) this.close();
    });
  },

  open({ title, bodyHtml, footHtml, onMount, onClose }) {
    document.getElementById('modalTitle').textContent = title || '';
    document.getElementById('modalBody').innerHTML = bodyHtml || '';
    document.getElementById('modalFoot').innerHTML = footHtml || '';
    this.backdrop.classList.add('open');
    this.onCloseCb = onClose || null;
    if (window.lucide) lucide.createIcons();
    if (typeof onMount === 'function') onMount();
  },

  close() {
    this.backdrop.classList.remove('open');
    if (typeof this.onCloseCb === 'function') this.onCloseCb();
    this.onCloseCb = null;
  },
};

function confirmDialog({ title, message, confirmLabel = 'Delete', danger = true, onConfirm }) {
  HMD_MODAL.open({
    title,
    bodyHtml: `<p style="color:var(--ink-700);font-size:13.5px;">${message}</p>`,
    footHtml: `
      <button class="btn btn-ghost" id="confirmCancelBtn">Cancel</button>
      <button class="btn ${danger ? 'btn-danger' : 'btn-primary'}" id="confirmOkBtn">${confirmLabel}</button>
    `,
    onMount() {
      document.getElementById('confirmCancelBtn').addEventListener('click', () => HMD_MODAL.close());
      document.getElementById('confirmOkBtn').addEventListener('click', async () => {
        const btn = document.getElementById('confirmOkBtn');
        btn.disabled = true;
        btn.textContent = 'Please wait…';
        try {
          await onConfirm();
          HMD_MODAL.close();
        } catch (err) {
          btn.disabled = false;
          btn.textContent = confirmLabel;
          showToast(err.message || 'Something went wrong.', 'error');
        }
      });
    },
  });
}

/* ---------------------------------------------------------------------
   Formatting
   ------------------------------------------------------------------- */
function escapeHtml(value) {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatDate(value) {
  if (!value) return '—';
  const d = new Date(value);
  if (isNaN(d.getTime())) return escapeHtml(value);
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function formatTime(value) {
  if (!value) return '—';
  // Accept "HH:mm:ss" or full ISO datetime strings.
  if (/^\d{2}:\d{2}/.test(value)) return value.slice(0, 5);
  const d = new Date(value);
  if (isNaN(d.getTime())) return escapeHtml(value);
  return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

function formatCurrency(value) {
  const n = Number(value);
  if (isNaN(n)) return '—';
  return n.toLocaleString(undefined, { style: 'currency', currency: 'INR', maximumFractionDigits: 2 });
}

function fullName(obj, firstKey = 'firstName', lastKey = 'lastName') {
  if (!obj) return '—';
  const parts = [obj[firstKey], obj[lastKey]].filter(Boolean);
  return parts.length ? parts.join(' ') : (obj.name || `#${obj.id ?? ''}`);
}

function debounce(fn, delay = 250) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), delay);
  };
}

/* ---------------------------------------------------------------------
   Table loading / empty / error state toggler
   ------------------------------------------------------------------- */
function setTableState(prefix, state) {
  // state: 'loading' | 'ready' | 'empty' | 'error'
  const loadingEl = document.getElementById(`${prefix}Loading`);
  const emptyEl = document.getElementById(`${prefix}Empty`);
  const errorEl = document.getElementById(`${prefix}Error`);
  const tableEl = document.getElementById(`${prefix}Table`);

  if (loadingEl) loadingEl.hidden = state !== 'loading';
  if (emptyEl) emptyEl.hidden = state !== 'empty';
  if (errorEl) errorEl.hidden = state !== 'error';
  if (tableEl) tableEl.style.display = state === 'ready' ? 'table' : 'none';

  if (window.lucide) lucide.createIcons();
}

/* Badge helper for statuses shared across pages */
function statusBadge(status) {
  const s = (status || '').toString().toUpperCase();
  const map = {
    COMPLETED: 'badge-success',
    CONFIRMED: 'badge-success',
    ACTIVE: 'badge-success',
    PAID: 'badge-success',
    SCHEDULED: 'badge-info',
    PENDING: 'badge-warning',
    IN_PROGRESS: 'badge-info',
    CANCELLED: 'badge-danger',
    CANCELED: 'badge-danger',
    FAILED: 'badge-danger',
    NO_SHOW: 'badge-danger',
  };
  const cls = map[s] || 'badge-neutral';
  return `<span class="badge ${cls}">${escapeHtml(status || '—')}</span>`;
}

function modeBadge(mode) {
  const m = (mode || '').toString().toUpperCase();
  const icon = m === 'VIDEO' ? 'video' : m === 'AUDIO' ? 'phone' : 'message-square';
  return `<span class="badge badge-info"><i data-lucide="${icon}" style="width:12px;height:12px;"></i>${escapeHtml(mode || '—')}</span>`;
}
