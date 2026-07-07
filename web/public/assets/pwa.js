(function setupPwa(){
  const canUseServiceWorker = 'serviceWorker' in navigator;
  let deferredInstallPrompt = null;
  let refreshing = false;
  let waitingWorker = null;
  let sourceUpdatePromptOpen = false;
  const SOURCE_FINGERPRINT_KEY = 'erp-system-source-fingerprint';
  const SOURCE_PROBE_BASE_FILES = ['./index.html', './sw.js'];

  function sourceProbeFiles(){
    const files = new Set(SOURCE_PROBE_BASE_FILES);
    document.querySelectorAll('script[src],link[rel="stylesheet"][href]').forEach((el) => {
      const raw = el.getAttribute('src') || el.getAttribute('href');
      if (raw) files.add(new URL(raw, window.location.href).href);
    });
    return [...files];
  }

  async function hashText(value){
    if (window.crypto && window.crypto.subtle && window.TextEncoder) {
      const data = new TextEncoder().encode(value);
      const digest = await crypto.subtle.digest('SHA-256', data);
      return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
    }
    let hash = 0;
    for (let i = 0; i < value.length; i += 1) hash = ((hash << 5) - hash + value.charCodeAt(i)) | 0;
    return String(hash >>> 0);
  }

  async function sourceFingerprint(){
    const stamp = Date.now().toString(36);
    const parts = await Promise.all(sourceProbeFiles().map(async (file) => {
      const url = new URL(file, window.location.href);
      url.searchParams.set('__source_probe', stamp);
      const response = await fetch(url, {
        cache:'no-store',
        headers:{ 'Cache-Control':'no-cache' },
      });
      if (!response.ok) throw new Error(`Source probe failed: ${file}`);
      return `${file}:${await response.text()}`;
    }));
    return hashText(parts.join('\n---erp-source---\n'));
  }

  async function clearAppCaches(){
    if ('caches' in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((key) => caches.delete(key)));
    }
  }

  function reloadWithFreshUrl(fingerprint){
    const url = new URL(window.location.href);
    url.searchParams.set('source', fingerprint.slice(0, 12));
    window.location.replace(url.toString());
  }

  async function applySourceUpdate(fingerprint){
    sourceUpdatePromptOpen = false;
    hideToast();
    localStorage.setItem(SOURCE_FINGERPRINT_KEY, fingerprint);
    await clearAppCaches();
    reloadWithFreshUrl(fingerprint);
  }

  function showSourceUpdatePrompt(fingerprint){
    sourceUpdatePromptOpen = true;
    showToast({
      title:'Update ready',
      body:'New source code is available. Update now to load the latest ERP demo files.',
      primary:'Update now',
      secondary:'Later',
      onPrimary(){
        applySourceUpdate(fingerprint);
      },
      onSecondary(){
        sourceUpdatePromptOpen = false;
        hideToast();
      },
    });
  }

  async function showUpdateIfSourceChanged(){
    try {
      const latest = await sourceFingerprint();
      const previous = localStorage.getItem(SOURCE_FINGERPRINT_KEY);

      if (!previous) {
        localStorage.setItem(SOURCE_FINGERPRINT_KEY, latest);
        return;
      }

      if (previous === latest) {
        return;
      }

      showSourceUpdatePrompt(latest);
    } catch (error) {
      console.warn('Source freshness check failed:', error);
    }
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

  function showUpdatePrompt(worker){
    if (sourceUpdatePromptOpen) return;
    waitingWorker = worker;
    showToast({
      title:'Update ready',
      body:'A new ERP System version is available.',
      primary:'Update now',
      secondary:'Later',
      onPrimary(){
        if (!waitingWorker) return;
        waitingWorker.postMessage({ type:'SKIP_WAITING' });
      },
      onSecondary:hideToast,
    });
  }

  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    deferredInstallPrompt = event;
    showToast({
      title:'Install ERP System',
      body:'Add the demo to your home screen for app-style access.',
      primary:'Install',
      secondary:'Later',
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
    showUpdateIfSourceChanged();

    const swUrl = new URL('sw.js', window.location.href);
    navigator.serviceWorker.register(swUrl, { scope:'./' })
      .then((registration) => {
        if (registration.waiting && navigator.serviceWorker.controller) {
          showUpdatePrompt(registration.waiting);
        }
        registration.addEventListener('updatefound', () => {
          const installing = registration.installing;
          if (!installing) return;
          installing.addEventListener('statechange', () => {
            if (installing.state === 'installed' && navigator.serviceWorker.controller) {
              showUpdatePrompt(installing);
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
    if (refreshing) return;
    refreshing = true;
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
