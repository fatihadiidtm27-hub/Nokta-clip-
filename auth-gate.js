// ============================================================
// NOKTA CLIP — AUTH GATE (verifikasi lisensi via Gumroad API)
// ------------------------------------------------------------
// WAJIB DIISI: ganti nilai di bawah dengan "Product Permalink"
// produkmu di Gumroad (Settings produk → Permalink).
// Contoh: kalau link produkmu https://gum.co/nokta-clip
// maka permalinknya adalah: 'nokta-clip'
// ============================================================
const GUMROAD_PRODUCT_PERMALINK = 'GANTI_DENGAN_PERMALINK_PRODUK';

(() => {
  const STORAGE_KEY = 'nokta_license_key';

  const gate = document.createElement('div');
  gate.id = 'authGate';
  gate.innerHTML = `
    <div class="gate-box">
      <div class="gate-mark"></div>
      <h1>NOKTA // CLIP</h1>
      <p>Masukkan kode lisensi yang kamu terima setelah pembelian untuk membuka akses.</p>
      <input type="text" id="gateInput" placeholder="XXXXXXXX-XXXXXXXX-XXXXXXXX-XXXXXXXX" autocomplete="off" autocapitalize="off" spellcheck="false">
      <button id="gateSubmit">BUKA AKSES</button>
      <div id="gateStatus"></div>
      <a href="https://gumroad.com" target="_blank" rel="noopener" id="gateBuyLink">Belum punya kode? Beli di sini</a>
    </div>
  `;
  document.body.appendChild(gate);

  const style = document.createElement('style');
  style.textContent = `
    #authGate{position:fixed;inset:0;z-index:99999;background:#03040a;display:flex;align-items:center;justify-content:center;padding:24px;font-family:'Rajdhani',sans-serif;}
    #authGate .gate-box{max-width:340px;width:100%;text-align:center;}
    #authGate .gate-mark{width:44px;height:44px;margin:0 auto 16px;background:linear-gradient(135deg,#00f6ff,#7c5cff);clip-path:polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%);box-shadow:0 0 22px rgba(0,246,255,.4);}
    #authGate h1{font-family:'Orbitron',sans-serif;color:#fff;font-size:18px;letter-spacing:.1em;margin-bottom:10px;}
    #authGate p{color:#8291b3;font-size:13px;margin-bottom:18px;line-height:1.5;}
    #authGate input{width:100%;background:#0a0e1c;border:1px solid rgba(0,246,255,.25);color:#dfe9ff;padding:12px;font-family:'JetBrains Mono',monospace;font-size:12px;text-align:center;margin-bottom:12px;box-sizing:border-box;}
    #authGate button{width:100%;padding:13px;border:none;background:linear-gradient(135deg,#00f6ff,#7c5cff);color:#020409;font-weight:700;font-size:13px;letter-spacing:.03em;cursor:pointer;}
    #authGate button:disabled{opacity:.5;}
    #authGate #gateStatus{margin-top:12px;font-size:11.5px;color:#ff3fa4;min-height:16px;}
    #authGate #gateBuyLink{display:inline-block;margin-top:14px;font-size:11px;color:#66759c;text-decoration:underline;}
  `;
  document.head.appendChild(style);

  const input = gate.querySelector('#gateInput');
  const btn = gate.querySelector('#gateSubmit');
  const statusEl = gate.querySelector('#gateStatus');

  function unlock(){
    gate.remove();
  }

  function saveKey(key){
    try{ localStorage.setItem(STORAGE_KEY, key); }catch(e){ /* browser tidak mendukung penyimpanan lokal */ }
  }
  function loadSavedKey(){
    try{ return localStorage.getItem(STORAGE_KEY); }catch(e){ return null; }
  }

  async function verify(key, silent){
    if(!silent){ btn.disabled = true; statusEl.style.color = '#8291b3'; statusEl.textContent = 'Memeriksa kode…'; }
    try{
      const res = await fetch('https://api.gumroad.com/v2/licenses/verify', {
        method: 'POST',
        headers: {'Content-Type':'application/x-www-form-urlencoded'},
        body: new URLSearchParams({
          product_permalink: GUMROAD_PRODUCT_PERMALINK,
          license_key: key,
          increment_uses_count: silent ? 'false' : 'true'
        })
      });
      const data = await res.json();
      if(data.success){
        saveKey(key);
        unlock();
      } else if(!silent){
        statusEl.style.color = '#ff3fa4';
        statusEl.textContent = 'Kode tidak valid. Cek kembali kode lisensimu.';
        btn.disabled = false;
      }
    }catch(err){
      if(!silent){
        statusEl.style.color = '#ff3fa4';
        statusEl.textContent = 'Gagal memeriksa kode. Cek koneksi internet.';
        btn.disabled = false;
      }
    }
  }

  btn.addEventListener('click', () => {
    const key = input.value.trim();
    if(!key){ statusEl.style.color = '#ff3fa4'; statusEl.textContent = 'Masukkan kode lisensi dulu.'; return; }
    verify(key, false);
  });
  input.addEventListener('keydown', e => { if(e.key === 'Enter') btn.click(); });

  // Kalau kode sudah pernah diverifikasi di perangkat ini, langsung buka tanpa nge-hit uses count lagi
  const saved = loadSavedKey();
  if(saved){ verify(saved, true); }
})();
