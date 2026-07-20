(() => {
  const N = window.NOKTA;
  const btnGrabFrames = document.getElementById('btnGrabFrames');
  const frameGrid = document.getElementById('frameGrid');
  const thumbEditor = document.getElementById('thumbEditor');
  const thumbCanvas = document.getElementById('thumbCanvas');
  const thumbRatios = document.getElementById('thumbRatios');
  const btnThumbAddText = document.getElementById('btnThumbAddText');
  const btnThumbExport = document.getElementById('btnThumbExport');
  const briSlider = document.getElementById('briSlider');
  const conSlider = document.getElementById('conSlider');
  const briVal = document.getElementById('briVal');
  const conVal = document.getElementById('conVal');

  const ctx = thumbCanvas.getContext('2d');
  let baseImage = null, baseW = 0, baseH = 0;
  let currentRatio = 'orig';
  let bri = 100, con = 100;
  let thumbTexts = []; // {text, xPct, yPct}
  let dragIdx = null;

  async function seekTo(video, t){
    return new Promise(res => {
      const onSeeked = () => { video.removeEventListener('seeked', onSeeked); res(); };
      video.addEventListener('seeked', onSeeked);
      video.currentTime = t;
    });
  }

  btnGrabFrames.addEventListener('click', async () => {
    const video = N.getVideoEl();
    if(!video.src || !N.duration) return;
    frameGrid.innerHTML = '';
    thumbEditor.hidden = true;
    const wasPlaying = !video.paused; video.pause();
    const start = N.inPoint, end = N.outPoint > N.inPoint ? N.outPoint : N.duration;
    const n = 8;
    const gridCanvas = document.createElement('canvas');
    gridCanvas.width = 160; gridCanvas.height = 90;
    const gctx = gridCanvas.getContext('2d');
    for(let i=0;i<n;i++){
      const t = start + (end-start) * ((i+0.5)/n);
      await seekTo(video, t);
      gctx.drawImage(video, 0, 0, 160, 90);
      const url = gridCanvas.toDataURL('image/jpeg', 0.72);
      const img = document.createElement('img');
      img.src = url;
      img.addEventListener('click', () => selectFrame(t, img));
      frameGrid.appendChild(img);
    }
    if(wasPlaying) video.play();
  });

  async function selectFrame(t, imgEl){
    frameGrid.querySelectorAll('img').forEach(i => i.classList.remove('selected'));
    imgEl.classList.add('selected');
    const video = N.getVideoEl();
    await seekTo(video, t);
    baseW = video.videoWidth; baseH = video.videoHeight;
    const cap = document.createElement('canvas');
    cap.width = baseW; cap.height = baseH;
    cap.getContext('2d').drawImage(video, 0, 0);
    baseImage = new Image();
    baseImage.onload = () => { thumbTexts = []; redraw(); };
    baseImage.src = cap.toDataURL('image/png');
    thumbEditor.hidden = false;
  }

  function ratioValue(key){
    if(key==='orig') return baseW/baseH;
    const [w,h] = key.split(':').map(Number);
    return w/h;
  }

  function redraw(){
    if(!baseImage) return;
    const rv = ratioValue(currentRatio);
    const srcRatio = baseW/baseH;
    let cropW, cropH, cropX, cropY;
    if(rv < srcRatio){ cropH = baseH; cropW = baseH*rv; cropX = (baseW-cropW)/2; cropY = 0; }
    else { cropW = baseW; cropH = baseW/rv; cropX = 0; cropY = (baseH-cropH)/2; }
    const outW = Math.min(1080, cropW);
    const outH = outW/rv;
    thumbCanvas.width = outW; thumbCanvas.height = outH;

    ctx.filter = `brightness(${bri}%) contrast(${con}%)`;
    ctx.drawImage(baseImage, cropX, cropY, cropW, cropH, 0, 0, outW, outH);
    ctx.filter = 'none';

    thumbTexts.forEach(tx => {
      const size = outH*0.09;
      ctx.font = `400 ${size}px 'Anton', sans-serif`;
      ctx.textAlign = 'center'; ctx.textBaseline='middle';
      ctx.lineWidth = size*0.14; ctx.strokeStyle='rgba(0,0,0,0.8)';
      ctx.fillStyle = '#ffffff';
      const x = (tx.xPct/100)*outW, y = (tx.yPct/100)*outH;
      ctx.strokeText(tx.text, x, y);
      ctx.fillText(tx.text, x, y);
    });
  }

  thumbRatios.querySelectorAll('.chip').forEach(chip => {
    chip.addEventListener('click', () => {
      thumbRatios.querySelectorAll('.chip').forEach(c=>c.classList.remove('active'));
      chip.classList.add('active');
      currentRatio = chip.dataset.ratio;
      redraw();
    });
  });

  btnThumbAddText.addEventListener('click', () => {
    const txt = prompt('Teks thumbnail:', 'JUDUL DI SINI');
    if(txt && txt.trim()){
      thumbTexts.push({text: txt.trim(), xPct:50, yPct:50});
      redraw();
    }
  });

  function canvasPointFromEvent(e){
    const rect = thumbCanvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    const xPct = ((clientX-rect.left)/rect.width)*100;
    const yPct = ((clientY-rect.top)/rect.height)*100;
    return {xPct, yPct};
  }
  thumbCanvas.addEventListener('pointerdown', e => {
    const p = canvasPointFromEvent(e);
    let closest = -1, closestDist = 15;
    thumbTexts.forEach((tx,i) => {
      const d = Math.hypot(tx.xPct-p.xPct, tx.yPct-p.yPct);
      if(d < closestDist){ closestDist = d; closest = i; }
    });
    dragIdx = closest;
  });
  window.addEventListener('pointermove', e => {
    if(dragIdx===null || dragIdx<0) return;
    const p = canvasPointFromEvent(e);
    thumbTexts[dragIdx].xPct = Math.min(100,Math.max(0,p.xPct));
    thumbTexts[dragIdx].yPct = Math.min(100,Math.max(0,p.yPct));
    redraw();
  });
  window.addEventListener('pointerup', () => dragIdx = null);

  briSlider.addEventListener('input', e => { bri = e.target.value; briVal.textContent = bri+'%'; redraw(); });
  conSlider.addEventListener('input', e => { con = e.target.value; conVal.textContent = con+'%'; redraw(); });

  btnThumbExport.addEventListener('click', () => {
    thumbCanvas.toBlob(blob => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const base = (N.currentFile ? N.currentFile.name.replace(/\.[^/.]+$/,'') : 'nokta').replace(/[^a-z0-9]+/gi,'_');
      a.href = url; a.download = `${base}_thumbnail.png`;
      document.body.appendChild(a); a.click(); a.remove();
    }, 'image/png');
  });

  document.addEventListener('nokta:fileloaded', () => {
    frameGrid.innerHTML = '';
    thumbEditor.hidden = true;
    baseImage = null; thumbTexts = [];
  });
})();
