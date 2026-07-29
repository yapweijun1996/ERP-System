(function setupPwa(){
  const canUseServiceWorker = 'serviceWorker' in navigator;
  let deferredInstallPrompt = null;
  let refreshing = false;
  let waitingWorker = null;
  let offeredUpdateKey = null;
  let applyingUpdate = false;
  const DISMISSED_UPDATE_KEY = 'erp-system-dismissed-pwa-update';
  const LEGACY_SOURCE_FINGERPRINT_KEY = 'erp-system-source-fingerprint';
  const copy = (key, fallback) => typeof window.t === 'function' ? window.t(key) : fallback;

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

  function readDismissedUpdate(){
    try {
      return sessionStorage.getItem(DISMISSED_UPDATE_KEY);
    } catch {
      return null;
    }
  }

  function dismissUpdate(updateKey){
    try {
      sessionStorage.setItem(DISMISSED_UPDATE_KEY, updateKey);
    } catch { /* session-only suppression is optional */ }
  }

  function clearDismissedUpdate(){
    try {
      sessionStorage.removeItem(DISMISSED_UPDATE_KEY);
    } catch { /* session-only suppression is optional */ }
  }

  function getWorkerVersion(worker){
    if (!worker || typeof MessageChannel === 'undefined') {
      return Promise.resolve(worker?.scriptURL || 'unknown');
    }
    return new Promise((resolve) => {
      const channel = new MessageChannel();
      let settled = false;
      const finish = (value) => {
        if (settled) return;
        settled = true;
        window.clearTimeout(timer);
        channel.port1.close();
        resolve(value || worker.scriptURL || 'unknown');
      };
      const timer = window.setTimeout(() => finish(null), 1500);
      channel.port1.onmessage = (event) => {
        if (event.data?.type === 'PWA_VERSION') finish(String(event.data.version || ''));
      };
      try {
        worker.postMessage({ type:'GET_VERSION' }, [channel.port2]);
      } catch {
        finish(null);
      }
    });
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

  function showToast({ title, body, primary, secondary, onPrimary, onSecondary }){
    const el = ensureToast();
    el.innerHTML = `
      <div class="pwa-copy"><b>${escapeHtml(title)}</b><span>${escapeHtml(body)}</span></div>
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

  async function showUpdatePrompt(worker){
    if (!worker || applyingUpdate || worker.state === 'redundant') return;
    const updateKey = await getWorkerVersion(worker);
    if (applyingUpdate || worker.state === 'redundant' || offeredUpdateKey === updateKey) return;
    offeredUpdateKey = updateKey;
    if (readDismissedUpdate() === updateKey) return;
    waitingWorker = worker;
    showToast({
      title:copy('pwa.updateReady','Update ready'),
      body:copy('pwa.updateBody','A new ERP System version is available.'),
      primary:copy('pwa.updateNow','Update now'),
      secondary:copy('pwa.later','Later'),
      onPrimary(){
        if (!waitingWorker || applyingUpdate) return;
        applyingUpdate = true;
        clearDismissedUpdate();
        const toast = document.getElementById('pwaToast');
        toast?.setAttribute('aria-busy', 'true');
        toast?.querySelectorAll('button').forEach((button) => { button.disabled = true; });
        waitingWorker.postMessage({ type:'SKIP_WAITING' });
      },
      onSecondary(){
        dismissUpdate(updateKey);
        waitingWorker = null;
        hideToast();
      },
    });
  }

  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    deferredInstallPrompt = event;
    if (waitingWorker || applyingUpdate) return;
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

  window.addEventListener('load', () => {
    cleanLegacySourceMarker();

    const swUrl = new URL('sw.js', window.location.href);
    navigator.serviceWorker.register(swUrl, { scope:'./', updateViaCache:'none' })
      .then((registration) => {
        if (registration.waiting && navigator.serviceWorker.controller) {
          void showUpdatePrompt(registration.waiting);
        }
        registration.addEventListener('updatefound', () => {
          const installing = registration.installing;
          if (!installing) return;
          installing.addEventListener('statechange', () => {
            if (installing.state === 'installed' && navigator.serviceWorker.controller) {
              void showUpdatePrompt(installing);
            }
          });
        });
        document.addEventListener('visibilitychange', () => {
          if (document.visibilityState === 'visible') registration.update();
        });
      })
      .catch((error) => {
        console.warn('PWA service worker registration failed:', error);
      });
  });

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!applyingUpdate || refreshing) return;
    refreshing = true;
    clearDismissedUpdate();
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
