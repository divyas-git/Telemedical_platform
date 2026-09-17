/**
 * app.js
 * -----------------------------------------------------------------------
 * Application bootstrap. Wires up chrome that isn't specific to any one
 * page: the icon set, the mobile sidebar toggle, the API reachability
 * indicator, the global search box, and the refresh button — then hands
 * off to the router.
 */

document.addEventListener('DOMContentLoaded', () => {
  if (window.lucide) lucide.createIcons();

  HMD_MODAL.init();

  // Mobile sidebar toggle
  const sidebar = document.getElementById('sidebar');
  const scrim = document.getElementById('scrim');
  document.getElementById('menuToggle').addEventListener('click', () => {
    sidebar.classList.toggle('open');
    scrim.classList.toggle('show');
  });
  scrim.addEventListener('click', () => {
    sidebar.classList.remove('open');
    scrim.classList.remove('show');
  });

  // Global search (per-page client-side filter over already-loaded rows)
  const searchInput = document.getElementById('globalSearch');
  searchInput.addEventListener('input', debounce((e) => {
    HMD_ROUTER.search(e.target.value.trim().toLowerCase());
  }, 200));

  // Refresh current page
  const refreshBtn = document.getElementById('refreshBtn');
  refreshBtn.addEventListener('click', () => {
    refreshBtn.classList.add('spinning');
    HMD_ROUTER.reload();
    checkApiStatus();
    setTimeout(() => refreshBtn.classList.remove('spinning'), 500);
  });

  checkApiStatus();
  setInterval(checkApiStatus, 30000);

  HMD_ROUTER.init();
});

async function checkApiStatus() {
  const dot = document.getElementById('apiStatusDot');
  const text = document.getElementById('apiStatusText');
  const online = await HMD_API.ping();
  dot.classList.toggle('online', online);
  dot.classList.toggle('offline', !online);
  text.textContent = online ? 'Backend connected' : 'Backend unreachable';
}
