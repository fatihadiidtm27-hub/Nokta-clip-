// ============================================================
// NOKTA CLIP — AUTH GATE (verifikasi kode via GitHub Gist)
// ------------------------------------------------------------
// CARA KERJA:
// Kode akses yang valid disimpan di file "codes.json" pada
// GitHub Gist kamu. Aplikasi ini mengambil daftar itu tiap kali
// dibuka, lalu mengecek apakah kode yang diketik pembeli ada
// di dalamnya.
//
// CARA MENAMBAH / MENCABUT KODE:
// 1. Buka gist.github.com, masuk ke gist "codes.json" kamu
// 2. Ketuk pensil/Edit
// 3. Tambah kode baru di dalam array, contoh:
//    {"codes": ["CONTOH-KODE1", "BUDI-JULI25", "SITI-AGT02"]}
// 4. Simpan ("Update public gist")
// 5. Untuk mencabut akses satu pembeli, hapus kodenya dari daftar
//    lalu simpan lagi — kode itu langsung tidak berfungsi lagi
//
// PENTING (jujur soal batasan): karena ini murni cek daftar teks
// tanpa server sungguhan, siapa pun yang membongkar kode aplikasi
// bisa melihat CARA pengecekannya (walau tidak otomatis melihat
// ISI daftar kode rahasia, karena itu diambil live dari gist).
// Untuk keamanan lebih baik ke depannya, pertimbangkan sistem
// server (Cloudflare Worker) atau kembali ke Gumroad kalau nanti
// sudah punya rekening bank/PayPal.
// ============================================================
const CODES_GIST_URL = 'https://gist.githubusercontent.com/fatihadiidtm27-hub/2308f5edfaa344139c5e528534e703ee/raw/codes.json';

(() => {
  const STORAGE_KEY = 'nokta_license_key';

  const gate = document.createElement('div');
  gate.id = 'authGate';
  gate.innerHTML = `
    <div class="gate-box">
      <div class="gate-mark"></div>
      <h1>NOKTA // CLIP</h1>
      <p>Masukkan kode akses yang kamu terima setelah pembayaran untuk membuka aplikasi.</p>
      <input type="text" id="gateInput" placeholder="Masukkan kode akses" autocomplete="off" autocapitalize="off" spellcheck="false">
      <button id="gateSubmit">BUKA AKSES</button>
      <div id="gateStatus"></div>
      <p class="gate-note">Belum punya kode? Hubungi penjual untuk mendapatkan akses.</p>
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
    #authGate input{width:100%;background:#0a0e1c;border:1px solid rgba(0,246,255,.25);color:#dfe9ff;padding:12px;font-family:'JetBrains Mono',monospace;font-size:13px;text-align:center;margin-bottom:12px;box-sizing:border-box;}
    #authGate button{width:100%;padding:13px;border:none;background:linear-gradient(135deg,#00f6ff,#7c5cff);color:#020409;font-weight:700;font-size:13px;letter-spacing:.03em;cursor:pointer;}
    #authGate button:disabled{opacity:.5;}
    #authGate #gateStatus{margin-top:12px;font-size:11.5px;color:#ff3fa4;min-height:16px;}
    #authGate .gate-note{margin-top:14px;font-size:11px;color:#66759c;}
  `;
  document.head.appendChild(style);

  const input = gate.querySelector('#gateInput');
  const btn = gate.querySelector('#gateSubmit');
  const statusEl = gate.querySelector('#gateStatus');

  function unlock(){ gate.remove(); }

  function saveKey(key){
    try{ localStorage.setItem(STORAGE_KEY, key); }catch(e){}
  }
  function loadSavedKey(){
    try{ return localStorage.getItem(STORAGE_KEY); }catch(e){ return null; }
  }

  async function fetchValidCodes(){
    // cache-busting supaya selalu ambil daftar terbaru, bukan versi lama yang ke-cache
    const res = await fetch(CODES_GIST_URL + '?t=' + Date.now());
    if(!res.ok) throw new Error('Gagal mengambil daftar kode');
    const data = await res.json();
    if(!Array.isArray(data.codes)) throw new Error('Format daftar kode tidak sesuai');
    return data.codes.map(c => String(c).trim().toUpperCase());
  }

  async function verify(key, silent){
    if(!silent){ btn.disabled = true; statusEl.style.color = '#8291b3'; statusEl.textContent = 'Memeriksa kode…'; }
    try{
      const validCodes = await fetchValidCodes();
      const normalized = key.trim().toUpperCase();
      if(validCodes.includes(normalized)){
        saveKey(key.trim());
        unlock();
      } else if(!silent){
        statusEl.style.color = '#ff3fa4';
        statusEl.textContent = 'Kode tidak valid. Cek kembali kode aksesmu.';
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
    if(!key){ statusEl.style.color = '#ff3fa4'; statusEl.textContent = 'Masukkan kode akses dulu.'; return; }
    verify(key, false);
  });
  input.addEventListener('keydown', e => { if(e.key === 'Enter') btn.click(); });

  // Kalau kode sudah pernah diverifikasi di perangkat ini, langsung buka
  const saved = loadSavedKey();
  if(saved){ verify(saved, true); }
})();
