(() => {
  const N = window.NOKTA;
  const navButtons = document.querySelectorAll('.nav-btn');
  const panels = document.querySelectorAll('.panel');
  const btnExport = document.getElementById('btnExport');
  const btnInstall = document.getElementById('btnInstall');

  function switchTab(name){
    navButtons.forEach(b => b.classList.toggle('active', b.dataset.tab === name));
    panels.forEach(p => p.hidden = p.dataset.panel !== name);
  }
  N.switchTab = switchTab;

  navButtons.forEach(btn => btn.addEventListener('click', () => switchTab(btn.dataset.tab)));

  document.addEventListener('nokta:metadata', () => {
    btnExport.disabled = false;
  });

  // ---------- PWA install prompt ----------
  let deferredPrompt = null;
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    btnInstall.hidden = false;
  });
  btnInstall.addEventListener('click', async () => {
    if(!deferredPrompt) return;
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    deferredPrompt = null;
    btnInstall.hidden = true;
  });
  window.addEventListener('appinstalled', () => { btnInstall.hidden = true; });

  // ---------- Service worker ----------
  if('serviceWorker' in navigator){
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('sw.js').catch(err => console.warn('SW gagal daftar:', err));
    });
  }
})();
