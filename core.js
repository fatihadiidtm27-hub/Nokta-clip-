// ============ Shared namespace ============
window.NOKTA = {
  video: null,
  duration: 0,
  inPoint: 0,
  outPoint: 0,
  currentFile: null,
  audioBuffer: null,       // decoded once, reused by waveform + viral analysis
  timeUpdateHooks: [],     // fn(currentTime) — called on every timeupdate, for overlay/subtitle preview sync
  overlayRenderers: [],    // fn(ctx, w, h, t) — called during export to burn in text/hook
  subtitleRenderers: [],   // fn(ctx, w, h, t) — called during export to burn in subtitle
  fmt(t){
    if(!isFinite(t) || t < 0) t = 0;
    const m = Math.floor(t/60), s = Math.floor(t%60), cs = Math.floor((t-Math.floor(t))*100);
    return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}.${String(cs).padStart(2,'0')}`;
  },
  fmtShort(t){
    if(!isFinite(t) || t < 0) t = 0;
    const m = Math.floor(t/60), s = Math.floor(t%60);
    return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
  }
};

(() => {
  const N = window.NOKTA;
  const video = document.getElementById('video');
  N.video = video;

  const viewer = document.getElementById('viewer');
  const viewerFrame = document.getElementById('viewerFrame');
  const emptyState = document.getElementById('emptyState');
  const fileInput = document.getElementById('fileInput');
  const btnImport = document.getElementById('btnImport');
  const btnImport2 = document.getElementById('btnImport2');
  const btnPlay = document.getElementById('btnPlay');
  const iconPlay = document.getElementById('iconPlay');
  const iconPause = document.getElementById('iconPause');
  const btnSetIn = document.getElementById('btnSetIn');
  const btnSetOut = document.getElementById('btnSetOut');
  const trackWrap = document.getElementById('trackWrap');
  const regionSelect = document.getElementById('regionSelect');
  const dimLeft = document.getElementById('dimLeft');
  const dimRight = document.getElementById('dimRight');
  const handleIn = document.getElementById('handleIn');
  const handleOut = document.getElementById('handleOut');
  const playhead = document.getElementById('playhead');
  const waveCanvas = document.getElementById('waveCanvas');
  const tcDisplay = document.getElementById('tcDisplay');
  const tfIn = document.getElementById('tfIn');
  const tfOut = document.getElementById('tfOut');
  const tfDur = document.getElementById('tfDur');
  const statLine = document.getElementById('statLine');

  let dragTarget = null;
  let isPlaying = false;
  let loopEnabled = true;

  // ---------- Import ----------
  function triggerImport(){ fileInput.click(); }
  btnImport.addEventListener('click', triggerImport);
  btnImport2.addEventListener('click', triggerImport);
  fileInput.addEventListener('change', e => { if(e.target.files[0]) loadFile(e.target.files[0]); });

  viewer.addEventListener('dragover', e => { e.preventDefault(); viewer.classList.add('dragover'); });
  viewer.addEventListener('dragleave', () => viewer.classList.remove('dragover'));
  viewer.addEventListener('drop', e => {
    e.preventDefault(); viewer.classList.remove('dragover');
    const f = e.dataTransfer.files[0];
    if(f && f.type.startsWith('video/')) loadFile(f);
  });

  function loadFile(file){
    N.currentFile = file;
    N.audioBuffer = null;
    video.src = URL.createObjectURL(file);
    viewerFrame.hidden = false;
    emptyState.style.display = 'none';
    statLine.textContent = file.name.toUpperCase();
    [btnSetIn, btnSetOut, btnPlay].forEach(b => b.disabled = false);
    document.dispatchEvent(new CustomEvent('nokta:fileloaded', {detail:{file}}));
    decodeAudio(file);
    drawWaveformPlaceholder();
  }

  video.addEventListener('loadedmetadata', () => {
    N.duration = video.duration;
    N.inPoint = 0;
    N.outPoint = N.duration;
    tfIn.textContent = N.fmt(0);
    tfOut.textContent = N.fmt(N.duration);
    tfDur.textContent = N.fmt(N.duration);
    updateRegionUI();
    document.dispatchEvent(new CustomEvent('nokta:metadata', {detail:{duration:N.duration, width:video.videoWidth, height:video.videoHeight}}));
  });

  // ---------- Playback ----------
  function setPlaying(p){
    isPlaying = p;
    iconPlay.style.display = p ? 'none' : 'block';
    iconPause.style.display = p ? 'block' : 'none';
  }
  btnPlay.addEventListener('click', () => {
    if(video.paused){
      if(video.currentTime >= N.outPoint - 0.02 || video.currentTime < N.inPoint) video.currentTime = N.inPoint;
      video.play(); setPlaying(true);
    } else { video.pause(); setPlaying(false); }
  });
  video.addEventListener('pause', () => setPlaying(false));
  video.addEventListener('play', () => setPlaying(true));

  video.addEventListener('timeupdate', () => {
    if(loopEnabled && video.currentTime >= N.outPoint){
      video.currentTime = N.inPoint;
      if(isPlaying) video.play();
    }
    updatePlayheadUI();
    updateTimecode();
    N.timeUpdateHooks.forEach(fn => { try{ fn(video.currentTime); }catch(e){} });
  });

  document.addEventListener('keydown', e => {
    if(!video.src || e.target.tagName === 'INPUT') return;
    if(e.code === 'Space'){ e.preventDefault(); btnPlay.click(); }
  });

  function setIn(){ N.inPoint = Math.min(video.currentTime, N.outPoint - 0.1); N.inPoint = Math.max(0, N.inPoint); afterTrimChange(); }
  function setOut(){ N.outPoint = Math.max(video.currentTime, N.inPoint + 0.1); N.outPoint = Math.min(N.duration, N.outPoint); afterTrimChange(); }
  btnSetIn.addEventListener('click', setIn);
  btnSetOut.addEventListener('click', setOut);

  function afterTrimChange(){ updateRegionUI(); tfIn.textContent = N.fmt(N.inPoint); tfOut.textContent = N.fmt(N.outPoint); tfDur.textContent = N.fmt(N.outPoint-N.inPoint); }

  // ---------- Timeline drag ----------
  function pctFromEvent(e){
    const rect = trackWrap.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const x = Math.min(Math.max(clientX - rect.left, 0), rect.width);
    return x / rect.width;
  }
  handleIn.addEventListener('pointerdown', e => { e.stopPropagation(); dragTarget='in'; });
  handleOut.addEventListener('pointerdown', e => { e.stopPropagation(); dragTarget='out'; });
  window.addEventListener('pointermove', e => {
    if(!dragTarget || !N.duration) return;
    const t = pctFromEvent(e) * N.duration;
    if(dragTarget === 'in'){ N.inPoint = Math.min(Math.max(0,t), N.outPoint-0.1); video.currentTime = N.inPoint; }
    else { N.outPoint = Math.max(Math.min(N.duration,t), N.inPoint+0.1); video.currentTime = N.outPoint; }
    afterTrimChange();
  });
  window.addEventListener('pointerup', () => dragTarget = null);
  trackWrap.addEventListener('pointerdown', e => {
    if(e.target === handleIn || e.target === handleOut) return;
    if(!N.duration) return;
    video.currentTime = pctFromEvent(e) * N.duration;
  });

  function updateRegionUI(){
    if(!N.duration) return;
    const l = (N.inPoint/N.duration)*100, r = (N.outPoint/N.duration)*100;
    regionSelect.style.left = l+'%'; regionSelect.style.width = (r-l)+'%';
    handleIn.style.left = `calc(${l}% - 10px)`; handleOut.style.left = `calc(${r}% - 10px)`;
    dimLeft.style.width = l+'%'; dimRight.style.width = (100-r)+'%';
  }
  function updatePlayheadUI(){ if(!N.duration) return; playhead.style.left = (video.currentTime/N.duration*100)+'%'; }
  function updateTimecode(){
    const t = video.currentTime; const m = Math.floor(t/60), s=Math.floor(t%60), cs=Math.floor((t-Math.floor(t))*100);
    tcDisplay.innerHTML = `${String(m).padStart(2,'0')}<span class="sep">:</span>${String(s).padStart(2,'0')}<span class="frac">.${String(cs).padStart(2,'0')}</span>`;
  }

  // ---------- Audio decode (shared) ----------
  async function decodeAudio(file){
    try{
      const buf = await file.arrayBuffer();
      const AC = window.AudioContext || window.webkitAudioContext;
      const actx = new AC();
      N.audioBuffer = await actx.decodeAudioData(buf.slice(0));
      actx.close();
      drawWaveformFromBuffer();
      document.dispatchEvent(new CustomEvent('nokta:audioready'));
    }catch(err){
      console.warn('Audio decode gagal (mungkin video tanpa audio track):', err);
    }
  }

  // ---------- Waveform ----------
  function resizeCanvas(){
    const dpr = window.devicePixelRatio || 1;
    waveCanvas.width = trackWrap.clientWidth * dpr;
    waveCanvas.height = trackWrap.clientHeight * dpr;
    return dpr;
  }
  function drawWaveformPlaceholder(){
    const ctx = waveCanvas.getContext('2d');
    const dpr = resizeCanvas();
    const w = waveCanvas.width, h = waveCanvas.height, mid = h/2;
    ctx.clearRect(0,0,w,h);
    ctx.fillStyle = 'rgba(0,246,255,0.15)';
    const bars = 100, barW = w/bars;
    for(let i=0;i<bars;i++){
      const barH = (0.15 + Math.abs(Math.sin(i*0.4))*0.35)*h;
      ctx.fillRect(i*barW, mid-barH/2, Math.max(1,barW-1*dpr), barH);
    }
  }
  function drawWaveformFromBuffer(){
    if(!N.audioBuffer) return;
    const ctx = waveCanvas.getContext('2d');
    const dpr = resizeCanvas();
    const w = waveCanvas.width, h = waveCanvas.height, mid = h/2;
    const raw = N.audioBuffer.getChannelData(0);
    const width = trackWrap.clientWidth;
    const spp = Math.max(1, Math.floor(raw.length/width));
    const peaks = [];
    for(let i=0;i<width;i++){
      let max=0; const start=i*spp;
      for(let j=0;j<spp;j+=4){ const v=Math.abs(raw[start+j]||0); if(v>max)max=v; }
      peaks.push(max);
    }
    ctx.clearRect(0,0,w,h);
    const grad = ctx.createLinearGradient(0,0,0,h);
    grad.addColorStop(0,'rgba(0,246,255,0.9)'); grad.addColorStop(1,'rgba(124,92,255,0.6)');
    ctx.fillStyle = grad;
    const barW = w/peaks.length;
    peaks.forEach((p,i) => { const barH=Math.max(2*dpr,p*h*0.9); ctx.fillRect(i*barW, mid-barH/2, Math.max(1,barW-1*dpr), barH); });
  }
  window.addEventListener('resize', () => { N.audioBuffer ? drawWaveformFromBuffer() : (N.currentFile && drawWaveformPlaceholder()); });

  // ---------- Export (canvas compositor: burns in overlays + subtitles) ----------
  const btnExport = document.getElementById('btnExport');
  const exportProgress = document.getElementById('exportProgress');
  const exportFill = document.getElementById('exportFill');
  const exportPct = document.getElementById('exportPct');
  const clipList = document.getElementById('clipList');
  const chkBurnText = document.getElementById('chkBurnText');
  const chkBurnSub = document.getElementById('chkBurnSub');

  document.addEventListener('nokta:canexport', () => { btnExport.disabled = false; });

  let clipCount = 0;
  btnExport.addEventListener('click', async () => {
    if(!video.src || N.outPoint - N.inPoint <= 0) return;
    btnExport.disabled = true;
    exportProgress.classList.add('active');
    exportFill.style.width='0%'; exportPct.textContent='0%';

    const wasPlaying = !video.paused;
    video.pause();
    loopEnabled = false;
    video.currentTime = N.inPoint;
    await new Promise(res => { video.onseeked = res; });

    const w = video.videoWidth, h = video.videoHeight;
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext('2d');

    let canvasStream;
    try{ canvasStream = canvas.captureStream(30); }
    catch(err){ alert('Browser tidak mendukung ekspor. Gunakan Chrome/Edge terbaru.'); resetExportUI(); return; }

    let audioTracks = [];
    try{
      const vidStream = video.captureStream ? video.captureStream() : video.mozCaptureStream();
      audioTracks = vidStream.getAudioTracks();
    }catch(err){ /* no audio available */ }

    const finalStream = new MediaStream([...canvasStream.getVideoTracks(), ...audioTracks]);

    let mimeType = 'video/webm;codecs=vp9,opus';
    if(!MediaRecorder.isTypeSupported(mimeType)) mimeType = 'video/webm;codecs=vp8,opus';
    if(!MediaRecorder.isTypeSupported(mimeType)) mimeType = 'video/webm';

    const recorder = new MediaRecorder(finalStream, {mimeType, videoBitsPerSecond:6_000_000});
    const chunks = [];
    recorder.ondataavailable = e => { if(e.data.size>0) chunks.push(e.data); };

    const clipDuration = N.outPoint - N.inPoint;
    let rafId;

    function drawFrame(){
      ctx.drawImage(video, 0, 0, w, h);
      const t = video.currentTime;
      if(chkBurnText.checked) N.overlayRenderers.forEach(fn => { try{ fn(ctx, w, h, t); }catch(e){} });
      if(chkBurnSub.checked) N.subtitleRenderers.forEach(fn => { try{ fn(ctx, w, h, t); }catch(e){} });
      const elapsed = t - N.inPoint;
      const pct = Math.min(100, Math.round((elapsed/clipDuration)*100));
      exportFill.style.width = pct+'%'; exportPct.textContent = pct+'%';
      if(t < N.outPoint - 0.03){ rafId = requestAnimationFrame(drawFrame); }
      else { recorder.stop(); video.pause(); }
    }

    recorder.onstop = () => {
      cancelAnimationFrame(rafId);
      exportFill.style.width='100%'; exportPct.textContent='100%';
      const blob = new Blob(chunks, {type:'video/webm'});
      const url = URL.createObjectURL(blob);
      addClipEntry(url, clipDuration);
      setTimeout(resetExportUI, 400);
      loopEnabled = true;
      if(wasPlaying) video.play();
    };

    recorder.start();
    video.play();
    rafId = requestAnimationFrame(drawFrame);
  });

  function resetExportUI(){ btnExport.disabled = false; exportProgress.classList.remove('active'); }

  function addClipEntry(url, len){
    clipCount++;
    const emptyMsg = clipList.querySelector('.empty-note');
    if(emptyMsg) emptyMsg.remove();
    const item = document.createElement('div');
    item.className = 'list-item';
    const base = (N.currentFile ? N.currentFile.name.replace(/\.[^/.]+$/,'') : 'klip').replace(/[^a-z0-9]+/gi,'_');
    item.innerHTML = `
      <div class="li-main">
        <div class="li-title">${base}_CLIP${clipCount}.webm</div>
        <div class="li-sub">${N.fmt(len)}</div>
      </div>
      <div class="li-actions"><a href="${url}" download="${base}_CLIP${clipCount}.webm" style="color:var(--cyan); text-decoration:none; font-size:11px; padding:4px;">↓</a></div>
    `;
    clipList.prepend(item);
  }

  // expose a few helpers other modules need
  N.getVideoEl = () => video;
})();
