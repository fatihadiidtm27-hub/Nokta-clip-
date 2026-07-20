(() => {
  const N = window.NOKTA;
  const btnAutoTiming = document.getElementById('btnAutoTiming');
  const btnVoiceRec = document.getElementById('btnVoiceRec');
  const voiceStatus = document.getElementById('voiceStatus');
  const subtitleList = document.getElementById('subtitleList');
  const overlayLayer = document.getElementById('overlayLayer');

  N.subtitleSegments = [];
  let idSeq = 1;
  let activeSegmentId = null;

  // preview DOM element for burned-in-looking subtitle while scrubbing/playing
  const previewEl = document.createElement('div');
  previewEl.className = 'subtitle-overlay';
  previewEl.style.display = 'none';
  overlayLayer.appendChild(previewEl);

  function detectSpeechSegments(audioBuffer){
    const raw = audioBuffer.getChannelData(0);
    const sr = audioBuffer.sampleRate;
    const winSize = Math.floor(sr*0.05);
    const numWin = Math.floor(raw.length/winSize);
    const energies = [];
    for(let i=0;i<numWin;i++){
      let sum=0, n=0;
      for(let j=0;j<winSize;j+=4){ const v=raw[i*winSize+j]; sum+=v*v; n++; }
      energies.push(n ? Math.sqrt(sum/n) : 0);
    }
    const maxE = Math.max(...energies, 0.0001);
    const threshold = maxE * 0.08;
    const isSpeech = energies.map(e => e > threshold);

    const raw_segs = [];
    let start = null;
    for(let i=0;i<isSpeech.length;i++){
      if(isSpeech[i] && start===null) start = i;
      if(!isSpeech[i] && start!==null){ raw_segs.push([start, i-1]); start = null; }
    }
    if(start!==null) raw_segs.push([start, isSpeech.length-1]);

    let secSegs = raw_segs.map(([s,e]) => ({start: s*0.05, end: (e+1)*0.05}));
    const merged = [];
    secSegs.forEach(seg => {
      if(merged.length && seg.start - merged[merged.length-1].end < 0.35){
        merged[merged.length-1].end = seg.end;
      } else merged.push({...seg});
    });
    return merged.filter(s => s.end - s.start >= 0.3);
  }

  btnAutoTiming.addEventListener('click', () => {
    if(!N.audioBuffer){
      alert('Audio belum siap dianalisis. Pastikan video memiliki audio dan tunggu sebentar setelah impor.');
      return;
    }
    const segs = detectSpeechSegments(N.audioBuffer);
    N.subtitleSegments = segs.map(s => ({ id: idSeq++, start: s.start, end: s.end, text: '' }));
    renderList();
  });

  function renderList(){
    subtitleList.innerHTML = '';
    if(N.subtitleSegments.length===0){
      subtitleList.innerHTML = '<div class="empty-note">Belum ada segmen. Jalankan auto-timing dulu.</div>';
      return;
    }
    N.subtitleSegments.forEach(seg => {
      const row = document.createElement('div');
      row.className = 'list-item';
      row.innerHTML = `
        <div class="li-main">
          <div class="li-sub">${N.fmtShort(seg.start)}–${N.fmtShort(seg.end)}</div>
          <input type="text" placeholder="Isi teks subtitle…" value="${(seg.text||'').replace(/"/g,'&quot;')}" />
        </div>
        <div class="li-actions">
          <button data-act="jump" title="Loncat ke sini">⏵</button>
          <button data-act="del" class="danger" title="Hapus">✕</button>
        </div>
      `;
      const input = row.querySelector('input');
      input.addEventListener('input', e => { seg.text = e.target.value; });
      input.addEventListener('focus', () => { activeSegmentId = seg.id; });
      row.querySelector('[data-act="jump"]').addEventListener('click', () => { N.getVideoEl().currentTime = seg.start; });
      row.querySelector('[data-act="del"]').addEventListener('click', () => {
        N.subtitleSegments = N.subtitleSegments.filter(s => s.id !== seg.id);
        renderList();
      });
      subtitleList.appendChild(row);
    });
  }

  // ---------- Preview sync ----------
  N.timeUpdateHooks.push((t) => {
    const seg = N.subtitleSegments.find(s => t>=s.start && t<=s.end && s.text);
    if(seg){ previewEl.textContent = seg.text; previewEl.style.display = 'block'; }
    else { previewEl.style.display = 'none'; }
  });

  // ---------- Burn-in for export ----------
  N.subtitleRenderers.push((ctx, w, h, t) => {
    const seg = N.subtitleSegments.find(s => t>=s.start && t<=s.end && s.text);
    if(!seg) return;
    const fontSize = Math.round(h*0.045);
    ctx.save();
    ctx.font = `800 ${fontSize}px 'Poppins', sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const x = w/2, y = h*0.9;
    const paddingX = fontSize*0.7, paddingY = fontSize*0.45;
    const textWidth = ctx.measureText(seg.text).width;
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.fillRect(x-textWidth/2-paddingX, y-fontSize/2-paddingY, textWidth+paddingX*2, fontSize+paddingY*2);
    ctx.lineWidth = fontSize*0.1;
    ctx.strokeStyle = 'rgba(0,0,0,0.7)';
    ctx.fillStyle = '#ffffff';
    ctx.strokeText(seg.text, x, y);
    ctx.fillText(seg.text, x, y);
    ctx.restore();
  });

  // ---------- Experimental mic voice recognition ----------
  let recognition = null;
  let listening = false;

  btnVoiceRec.addEventListener('click', () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if(!SR){
      voiceStatus.style.display = 'block';
      voiceStatus.textContent = 'Browser ini tidak mendukung pengenalan suara (coba Chrome Android).';
      return;
    }
    if(listening){
      recognition.stop();
      return;
    }
    recognition = new SR();
    recognition.lang = 'id-ID';
    recognition.continuous = true;
    recognition.interimResults = true;

    voiceStatus.style.display = 'block';
    voiceStatus.textContent = '🎙 Mendengarkan… putar audio lewat speaker dekat mic. Fokus ke salah satu kolom teks segmen agar hasil masuk ke sana.';

    recognition.onresult = (e) => {
      let finalText = '';
      for(let i=e.resultIndex; i<e.results.length; i++){
        if(e.results[i].isFinal) finalText += e.results[i][0].transcript;
      }
      if(finalText && activeSegmentId){
        const seg = N.subtitleSegments.find(s => s.id === activeSegmentId);
        if(seg){
          seg.text = (seg.text ? seg.text + ' ' : '') + finalText.trim();
          renderList();
        }
      }
    };
    recognition.onerror = (e) => {
      voiceStatus.textContent = 'Pengenalan suara berhenti: ' + e.error;
      listening = false; btnVoiceRec.textContent = '🎙 COBA PENGENALAN SUARA (EKSPERIMENTAL)';
    };
    recognition.onend = () => {
      listening = false;
      btnVoiceRec.textContent = '🎙 COBA PENGENALAN SUARA (EKSPERIMENTAL)';
      voiceStatus.textContent += ' (berhenti)';
    };
    recognition.start();
    listening = true;
    btnVoiceRec.textContent = '⏹ HENTIKAN PENGENALAN SUARA';
  });

  document.addEventListener('nokta:fileloaded', () => {
    N.subtitleSegments = [];
    renderList();
    voiceStatus.style.display = 'none';
  });
})();
