(function setupPwa(){
  const canUseServiceWorker = 'serviceWorker' in navigator;
  let deferredInstallPrompt = null;
  let refreshing = false;
  let hadController = false;
  const activatedWorkers = new WeakSet();
  const UPDATE_CHECK_INTERVAL_MS = 60 * 1000;
  const SERVICE_WORKER_VERSION = 'erp-system-pwa-v286';
  const LEGACY_SOURCE_FINGERPRINT_KEY = 'erp-system-source-fingerprint';
  const copy = (key, fallback) => typeof window.t === 'function' ? window.t(key) : fallback;

  /* Safari exposes pinch gestures separately from CSS touch-action. The
     viewport meta tag is the primary lock; these handlers close the iOS
     gesture path so the PWA remains at scale 1.0 during two-finger gestures. */
  ['gesturestart','gesturechange','gestureend'].forEach((eventName) => {
    document.addEventListener(eventName, (event) => event.preventDefault(), { passive:false });
  });

  function cleanLegacySourceMarker(){
    try {
      localStorage.removeItem(LEGACY_SOURCE_FINGERPRINT_KEY);
    } catch { /* storage may be unavailable in a locked-down browser */ }
    try {
      const url = new URL(window.location.href);
      if (!url.searchParams.has('source')) return;
      url.searchParams.delete('source');
      window.history.replaceState(window.history.state, '', url.toString());
    } catch { /* keep the current URL if History API access is unavailable */ }
  }

  function ensureToast(){
    let el = document.getElementById('pwaToast');
    if (el) return el;
    el = document.createElement('div');
    el.id = 'pwaToast';
    el.className = 'pwa-toast';
    el.setAttribute('role', 'status');
    el.setAttribute('aria-live', 'polite');
    document.body.appendChild(el);
    return el;
  }

  function hideToast(){
    const el = document.getElementById('pwaToast');
    if (el) el.classList.remove('show');
  }

  function showToast({ title, body, version, versionLabel, currentVersion, latestVersion, currentVersionLabel, latestVersionLabel, primary, secondary, onPrimary, onSecondary }){
    const el = ensureToast();
    const versionMarkup = latestVersion
      ? `<small class="pwa-version"><span>${escapeHtml(currentVersionLabel || 'Current')}</span> <code data-pwa-current-version>${escapeHtml(currentVersion || '—')}</code><span aria-hidden="true"> → </span><span>${escapeHtml(latestVersionLabel || 'Latest')}</span> <code data-pwa-latest-version>${escapeHtml(latestVersion)}</code></small>`
      : (version
        ? `<small class="pwa-version">${escapeHtml(versionLabel || 'Version')}: <code data-pwa-version>${escapeHtml(version)}</code></small>`
        : '');
    el.innerHTML = `
      <div class="pwa-copy"><b>${escapeHtml(title)}</b><span>${escapeHtml(body)}</span>${versionMarkup}</div>
      <div class="pwa-actions">
        ${secondary ? `<button class="pwa-secondary" type="button" data-pwa-secondary>${escapeHtml(secondary)}</button>` : ''}
        ${primary ? `<button class="pwa-primary" type="button" data-pwa-primary>${escapeHtml(primary)}</button>` : ''}
      </div>`;
    const primaryBtn = el.querySelector('[data-pwa-primary]');
    const secondaryBtn = el.querySelector('[data-pwa-secondary]');
    if (primaryBtn) primaryBtn.addEventListener('click', () => { if (onPrimary) onPrimary(); });
    if (secondaryBtn) secondaryBtn.addEventListener('click', () => { if (onSecondary) onSecondary(); else hideToast(); });
    requestAnimationFrame(() => el.classList.add('show'));
  }

  function activateWaitingWorker(worker){
    if (!worker || worker.state === 'redundant' || activatedWorkers.has(worker)) return;
    activatedWorkers.add(worker);
    try {
      worker.postMessage({ type:'SKIP_WAITING' });
    } catch {
      activatedWorkers.delete(worker);
    }
  }

  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    deferredInstallPrompt = event;
    showToast({
      title:copy('pwa.installTitle','Install ERP System'),
      body:copy('pwa.installBody','Add the demo to your home screen for app-style access.'),
      primary:copy('pwa.install','Install'),
      secondary:copy('pwa.later','Later'),
      async onPrimary(){
        hideToast();
        if (!deferredInstallPrompt) return;
        deferredInstallPrompt.prompt();
        await deferredInstallPrompt.userChoice.catch(() => null);
        deferredInstallPrompt = null;
      },
      onSecondary:hideToast,
    });
  });

  window.addEventListener('appinstalled', () => {
    deferredInstallPrompt = null;
    hideToast();
  });

  if (!canUseServiceWorker) return;

  hadController = Boolean(navigator.serviceWorker.controller);

  window.addEventListener('load', () => {
    cleanLegacySourceMarker();

    const swUrl = new URL('sw.js', window.location.href);
    swUrl.searchParams.set('v', SERVICE_WORKER_VERSION);
    navigator.serviceWorker.register(swUrl, { scope:'./', updateViaCache:'none' })
      .then((registration) => {
        const checkForUpdate = () => {
          if (document.visibilityState !== 'visible') return;
          registration.update().catch(() => { /* offline: keep the current worker */ });
        };
        if (registration.waiting && navigator.serviceWorker.controller) {
          activateWaitingWorker(registration.waiting);
        }
        registration.addEventListener('updatefound', () => {
          const installing = registration.installing;
          if (!installing) return;
          installing.addEventListener('statechange', () => {
            if (installing.state === 'installed' && navigator.serviceWorker.controller) {
              activateWaitingWorker(installing);
            }
          });
        });
        document.addEventListener('visibilitychange', () => {
          checkForUpdate();
        });
        checkForUpdate();
        window.setInterval(checkForUpdate, UPDATE_CHECK_INTERVAL_MS);
      })
      .catch((error) => {
        console.warn('PWA service worker registration failed:', error);
      });
  });

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController || refreshing) {
      hadController = true;
      return;
    }
    refreshing = true;
    hideToast();
    window.location.reload();
  });

  function escapeHtml(value){
    return String(value).replace(/[&<>"']/g, (ch) => ({
      '&':'&amp;',
      '<':'&lt;',
      '>':'&gt;',
      '"':'&quot;',
      "'":'&#39;',
    }[ch]));
  }
})();
