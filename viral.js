(() => {
  const N = window.NOKTA;
  const btnAnalyze = document.getElementById('btnAnalyze');
  const viralProgress = document.getElementById('viralProgress');
  const viralFill = document.getElementById('viralFill');
  const viralPct = document.getElementById('viralPct');
  const viralStage = document.getElementById('viralStage');
  const viralList = document.getElementById('viralList');
  const viralMarkers = document.getElementById('viralMarkers');

  const KEYWORDS = [
    'ternyata','gila','rahasia','jangan','viral','gokil','parah','nyesel','wajib',
    'bongkar','terbongkar','gratis','kenapa','kok bisa','gaskan','auto','banget',
    'segini','cuma','hati-hati','waspada','bahaya','trik','tips','gampang','mudah',
    'murah','modal','untung','nangis','ketawa','shock','kaget'
  ];

  function keywordScore(text){
    if(!text) return 0;
    const lower = text.toLowerCase();
    let score = 0;
    KEYWORDS.forEach(k => { if(lower.includes(k)) score++; });
    if(/[!?]/.test(text)) score += 1;
    if(/\d/.test(text)) score += 0.5;
    return score;
  }

  function normalize(arr){
    const max = Math.max(...arr, 0.0001);
    return arr.map(v => v/max);
  }

  async function seekTo(video, t){
    return new Promise(res => {
      const onSeeked = () => { video.removeEventListener('seeked', onSeeked); res(); };
      video.addEventListener('seeked', onSeeked);
      video.currentTime = t;
    });
  }

  function frameDiff(a, b){
    let sum = 0;
    for(let i=0;i<a.length;i+=4){
      sum += Math.abs(a[i]-b[i]) + Math.abs(a[i+1]-b[i+1]) + Math.abs(a[i+2]-b[i+2]);
    }
    return sum;
  }

  async function analyze(){
    const video = N.getVideoEl();
    if(!video.src || !N.duration){ return; }
    btnAnalyze.disabled = true;
    viralProgress.classList.add('active');
    const wasPlaying = !video.paused;
    video.pause();

    const duration = N.duration;
    const nSamples = Math.min(50, Math.max(10, Math.floor(duration)));
    const times = [];
    for(let i=0;i<nSamples;i++) times.push((duration/nSamples) * i + (duration/nSamples)/2);

    // --- Audio energy ---
    viralStage.textContent = 'Menghitung energi audio…';
    const audioScores = times.map(() => 0);
    if(N.audioBuffer){
      const raw = N.audioBuffer.getChannelData(0);
      const sr = N.audioBuffer.sampleRate;
      times.forEach((t, i) => {
        const startIdx = Math.max(0, Math.floor((t-0.4)*sr));
        const endIdx = Math.min(raw.length, Math.floor((t+0.4)*sr));
        let sumSq = 0, count = 0;
        for(let j=startIdx; j<endIdx; j+=8){ sumSq += raw[j]*raw[j]; count++; }
        audioScores[i] = count ? Math.sqrt(sumSq/count) : 0;
      });
    }
    viralFill.style.width='25%'; viralPct.textContent='25%';

    // --- Visual motion ---
    viralStage.textContent = 'Menganalisis gerakan visual…';
    const sw = 32, sh = 18;
    const tmpCanvas = document.createElement('canvas');
    tmpCanvas.width = sw; tmpCanvas.height = sh;
    const tctx = tmpCanvas.getContext('2d', {willReadFrequently:true});
    const motionScores = times.map(()=>0);
    let prevFrame = null;
    for(let i=0;i<times.length;i++){
      await seekTo(video, times[i]);
      tctx.drawImage(video, 0, 0, sw, sh);
      const frame = tctx.getImageData(0,0,sw,sh).data;
      if(prevFrame) motionScores[i] = frameDiff(frame, prevFrame);
      prevFrame = frame;
      const pct = 25 + Math.round(((i+1)/times.length)*50);
      viralFill.style.width = pct+'%'; viralPct.textContent = pct+'%';
    }

    // --- Keyword score (from subtitle segments, if any) ---
    viralStage.textContent = 'Mencocokkan kata kunci…';
    const hasSubtitles = N.subtitleSegments && N.subtitleSegments.length > 0;
    const kwScores = times.map(t => {
      if(!hasSubtitles) return 0;
      const seg = N.subtitleSegments.find(s => t>=s.start && t<=s.end);
      return seg ? keywordScore(seg.text) : 0;
    });
    viralFill.style.width='85%'; viralPct.textContent='85%';

    // --- Combine ---
    const aNorm = normalize(audioScores);
    const mNorm = normalize(motionScores);
    const kNorm = normalize(kwScores);
    const wA = hasSubtitles ? 0.4 : 0.55;
    const wM = hasSubtitles ? 0.3 : 0.45;
    const wK = hasSubtitles ? 0.3 : 0;
    const totals = times.map((t,i) => ({
      time: t, score: aNorm[i]*wA + mNorm[i]*wM + kNorm[i]*wK
    }));

    // --- Pick top peaks with min spacing ---
    const sorted = [...totals].sort((a,b)=>b.score-a.score);
    const picked = [];
    const minSpacing = Math.max(2, duration*0.05);
    for(const cand of sorted){
      if(picked.length >= 6) break;
      if(picked.every(p => Math.abs(p.time-cand.time) >= minSpacing)) picked.push(cand);
    }
    picked.sort((a,b)=>a.time-b.time);

    viralFill.style.width='100%'; viralPct.textContent='100%';
    setTimeout(() => { viralProgress.classList.remove('active'); btnAnalyze.disabled=false; }, 400);

    renderMarkers(picked, duration);
    renderList(picked, hasSubtitles);

    video.currentTime = 0;
    if(wasPlaying) video.play();
  }

  function renderMarkers(picked, duration){
    viralMarkers.innerHTML = '';
    picked.forEach(p => {
      const tick = document.createElement('div');
      tick.className = 'viral-tick';
      tick.style.left = (p.time/duration*100) + '%';
      viralMarkers.appendChild(tick);
    });
  }

  function renderList(picked, hasSubtitles){
    viralList.innerHTML = '';
    if(picked.length===0){
      viralList.innerHTML = '<div class="empty-note">Tidak ada momen menonjol terdeteksi.</div>';
      return;
    }
    const note = document.createElement('div');
    note.className = 'hint';
    note.style.marginBottom = '6px';
    note.textContent = hasSubtitles
      ? 'Skor mencakup audio + gerakan + kata kunci subtitle.'
      : 'Skor berbasis audio + gerakan saja. Isi subtitle dulu untuk skor yang mempertimbangkan konten ucapan.';
    viralList.appendChild(note);

    picked.forEach((p, idx) => {
      const row = document.createElement('div');
      row.className = 'list-item';
      const pctScore = Math.round(p.score*100);
      row.innerHTML = `
        <div class="li-main">
          <div class="li-title">Momen #${idx+1} — ${N.fmtShort(p.time)}</div>
          <div class="li-sub">Skor relatif: ${pctScore}%</div>
          <div class="score-bar"><div class="score-bar-fill" style="width:${pctScore}%"></div></div>
        </div>
        <div class="li-actions">
          <button data-act="jump" title="Loncat ke momen">⏵</button>
          <button data-act="hook" title="Tambah hook di sini">⚡</button>
        </div>
      `;
      row.querySelector('[data-act="jump"]').addEventListener('click', () => {
        N.getVideoEl().currentTime = p.time;
      });
      row.querySelector('[data-act="hook"]').addEventListener('click', () => {
        N.insertHookAt(p.time);
        if(N.switchTab) N.switchTab('text');
      });
      viralList.appendChild(row);
    });
  }

  btnAnalyze.addEventListener('click', analyze);

  document.addEventListener('nokta:fileloaded', () => {
    viralMarkers.innerHTML = '';
    viralList.innerHTML = '<div class="empty-note">Jalankan analisis untuk melihat momen menarik.</div>';
  });
})();
