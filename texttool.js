(() => {
  const N = window.NOKTA;
  const overlayLayer = document.getElementById('overlayLayer');
  const hookTemplatesEl = document.getElementById('hookTemplates');
  const fontPickerEl = document.getElementById('fontPicker');
  const colorSwatchesEl = document.getElementById('colorSwatches');
  const overlayListEl = document.getElementById('overlayList');
  const btnAddText = document.getElementById('btnAddText');

  const HOOK_TEMPLATES = [
    'TUNGGU SAMPAI AKHIR!','KAMU GAK BAKAL NYANGKA...','INI BARU KEBONGKAR!',
    'STOP SCROLL DULU!','RAHASIA YANG JARANG DIKETAHUI','GILA, BARU TAU!',
    'JANGAN SKIP, PENTING!','TERNYATA SELAMA INI SALAH','PART 1 — SIMPEN DULU!',
    'INI KENAPA VIRAL BANGET'
  ];

  const FONTS = [
    {key:'anton', label:'Anton', family:"'Anton', sans-serif", weight:'400'},
    {key:'bebas', label:'Bebas Neue', family:"'Bebas Neue', sans-serif", weight:'400'},
    {key:'poppins', label:'Poppins Black', family:"'Poppins', sans-serif", weight:'900'},
    {key:'marker', label:'Permanent Marker', family:"'Permanent Marker', cursive", weight:'400'},
    {key:'lilita', label:'Lilita One', family:"'Lilita One', sans-serif", weight:'400'},
    {key:'archivo', label:'Archivo Black', family:"'Archivo Black', sans-serif", weight:'400'},
  ];
  const COLORS = ['#ffffff','#00f6ff','#7c5cff','#ff3fa4','#ffe14d','#28ff9a'];

  let overlays = [];       // {id, text, xPct, yPct, fontKey, color, sizeRatio, start, end, isHook}
  let idSeq = 1;
  let selectedFontKey = 'anton';
  let selectedColor = '#ffffff';
  let dragId = null;

  function fontByKey(key){ return FONTS.find(f => f.key===key) || FONTS[0]; }

  // ---------- Build pickers ----------
  FONTS.forEach(f => {
    const chip = document.createElement('button');
    chip.className = 'chip font-chip' + (f.key===selectedFontKey ? ' active':'');
    chip.style.fontFamily = f.family;
    chip.style.fontWeight = f.weight;
    chip.textContent = f.label;
    chip.addEventListener('click', () => {
      selectedFontKey = f.key;
      [...fontPickerEl.children].forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      if(selectedOverlayId){ updateOverlay(selectedOverlayId, {fontKey:f.key}); }
    });
    fontPickerEl.appendChild(chip);
  });

  COLORS.forEach(c => {
    const sw = document.createElement('button');
    sw.className = 'swatch' + (c===selectedColor ? ' active':'');
    sw.style.background = c;
    sw.addEventListener('click', () => {
      selectedColor = c;
      [...colorSwatchesEl.children].forEach(s => s.classList.remove('active'));
      sw.classList.add('active');
      if(selectedOverlayId){ updateOverlay(selectedOverlayId, {color:c}); }
    });
    colorSwatchesEl.appendChild(sw);
  });

  HOOK_TEMPLATES.forEach(txt => {
    const chip = document.createElement('button');
    chip.className = 'chip';
    chip.textContent = txt;
    chip.addEventListener('click', () => addHook(txt));
    hookTemplatesEl.appendChild(chip);
  });

  let selectedOverlayId = null;

  // ---------- CRUD ----------
  function addHook(text){
    const ov = {
      id: idSeq++, text, xPct:50, yPct:22,
      fontKey: selectedFontKey, color: selectedColor, sizeRatio:0.09,
      start:0, end:2.5, isHook:true
    };
    overlays.push(ov);
    renderOverlayDom(ov, true);
    renderList();
  }

  btnAddText.addEventListener('click', () => {
    const video = N.getVideoEl();
    const t = video.currentTime || 0;
    const ov = {
      id: idSeq++, text:'Teks Baru', xPct:50, yPct:50,
      fontKey: selectedFontKey, color: selectedColor, sizeRatio:0.07,
      start:t, end: Math.min(t+3, N.duration||t+3), isHook:false
    };
    overlays.push(ov);
    renderOverlayDom(ov, false);
    renderList();
  });

  function updateOverlay(id, patch){
    const ov = overlays.find(o=>o.id===id);
    if(!ov) return;
    Object.assign(ov, patch);
    const el = overlayLayer.querySelector(`[data-id="${id}"]`);
    if(el) styleOverlayEl(el, ov);
    renderList();
  }

  function deleteOverlay(id){
    overlays = overlays.filter(o=>o.id!==id);
    const el = overlayLayer.querySelector(`[data-id="${id}"]`);
    if(el) el.remove();
    renderList();
  }

  function styleOverlayEl(el, ov){
    const f = fontByKey(ov.fontKey);
    el.style.left = ov.xPct + '%';
    el.style.top = ov.yPct + '%';
    el.style.fontFamily = f.family;
    el.style.fontWeight = f.weight;
    el.style.color = ov.color;
    el.style.fontSize = (ov.sizeRatio*100) + 'cqh'; // fallback handled below
    el.style.fontSize = Math.round(ov.sizeRatio * overlayLayer.clientHeight) + 'px';
    el.textContent = ov.text;
  }

  function renderOverlayDom(ov, pop){
    const el = document.createElement('div');
    el.className = 'text-overlay' + (pop ? ' hook-pop':'');
    el.dataset.id = ov.id;
    styleOverlayEl(el, ov);
    el.addEventListener('pointerdown', e => {
      e.stopPropagation(); dragId = ov.id; selectedOverlayId = ov.id;
      overlayLayer.querySelectorAll('.text-overlay').forEach(x=>x.classList.remove('selected'));
      el.classList.add('selected');
    });
    el.addEventListener('dblclick', () => {
      const nv = prompt('Edit teks:', ov.text);
      if(nv !== null && nv.trim()!==''){ updateOverlay(ov.id, {text:nv}); }
    });
    overlayLayer.appendChild(el);
  }

  window.addEventListener('pointermove', e => {
    if(!dragId) return;
    const rect = overlayLayer.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    const xPct = Math.min(100, Math.max(0, ((clientX-rect.left)/rect.width)*100));
    const yPct = Math.min(100, Math.max(0, ((clientY-rect.top)/rect.height)*100));
    updateOverlay(dragId, {xPct, yPct});
  });
  window.addEventListener('pointerup', () => dragId = null);

  // ---------- List panel ----------
  function renderList(){
    overlayListEl.innerHTML = '';
    if(overlays.length===0){
      overlayListEl.innerHTML = '<div class="empty-note">Belum ada teks ditambahkan.</div>';
      return;
    }
    overlays.forEach(ov => {
      const row = document.createElement('div');
      row.className = 'list-item';
      row.innerHTML = `
        <div class="li-main">
          <input type="text" value="${ov.text.replace(/"/g,'&quot;')}" />
          <div class="li-sub">${ov.isHook ? 'HOOK' : 'TEKS'} · ${N.fmtShort(ov.start)}–${N.fmtShort(ov.end)}</div>
        </div>
        <div class="li-actions">
          <button data-act="now-start" title="Set mulai = sekarang">⏵</button>
          <button data-act="now-end" title="Set akhir = sekarang">⏸</button>
          <button data-act="del" class="danger" title="Hapus">✕</button>
        </div>
      `;
      row.querySelector('input').addEventListener('input', e => updateOverlay(ov.id, {text:e.target.value}));
      row.querySelector('[data-act="now-start"]').addEventListener('click', () => updateOverlay(ov.id, {start:N.getVideoEl().currentTime}));
      row.querySelector('[data-act="now-end"]').addEventListener('click', () => updateOverlay(ov.id, {end:N.getVideoEl().currentTime}));
      row.querySelector('[data-act="del"]').addEventListener('click', () => deleteOverlay(ov.id));
      overlayListEl.appendChild(row);
    });
  }

  // ---------- Visibility sync during playback ----------
  N.timeUpdateHooks.push((t) => {
    overlayLayer.querySelectorAll('.text-overlay').forEach(el => {
      const ov = overlays.find(o=>o.id==el.dataset.id);
      if(!ov) return;
      el.style.display = (t>=ov.start && t<=ov.end) ? 'block' : 'none';
    });
  });

  // ---------- Burn-in renderer for export ----------
  N.overlayRenderers.push((ctx, w, h, t) => {
    overlays.forEach(ov => {
      if(t < ov.start || t > ov.end) return;
      const f = fontByKey(ov.fontKey);
      let size = ov.sizeRatio * h;
      if(ov.isHook){
        const elapsed = t - ov.start;
        if(elapsed < 0.4){ size *= 1 + (0.35 * (1 - elapsed/0.4)); }
      }
      ctx.save();
      ctx.font = `${f.weight} ${size}px ${f.family}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.lineWidth = size * 0.12;
      ctx.strokeStyle = 'rgba(0,0,0,0.75)';
      ctx.fillStyle = ov.color;
      const x = (ov.xPct/100)*w, y = (ov.yPct/100)*h;
      ctx.strokeText(ov.text, x, y);
      ctx.fillText(ov.text, x, y);
      ctx.restore();
    });
  });

  document.addEventListener('nokta:fileloaded', () => {
    overlays = [];
    overlayLayer.innerHTML = '';
    renderList();
  });

  // ---------- Public API for other modules (e.g. viral.js "add hook here") ----------
  N.insertHookAt = (time, text) => {
    const ov = {
      id: idSeq++, text: text || 'MOMEN INI VIRAL!', xPct:50, yPct:22,
      fontKey: selectedFontKey, color: selectedColor, sizeRatio:0.09,
      start: time, end: Math.min(time + 2.5, N.duration || time + 2.5), isHook:true
    };
    overlays.push(ov);
    renderOverlayDom(ov, true);
    renderList();
  };
})();
