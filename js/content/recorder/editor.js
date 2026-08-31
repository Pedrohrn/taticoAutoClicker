document.addEventListener('DOMContentLoaded', async () => {
  const vid = document.getElementById('vidFinal');
  const btnDownload = document.getElementById('btnDownload');
  const editorContainer = document.getElementById('editorContainer');
  const loading = document.getElementById('loading');

  const timeline = document.getElementById('timeline');
  const currentTimeDisplay = document.getElementById('currentTimeDisplay');
  const durationDisplay = document.getElementById('durationDisplay');

  const trimStart = document.getElementById('trimStart');
  const trimEnd = document.getElementById('trimEnd');
  const cutStart = document.getElementById('cutStart');
  const cutEnd = document.getElementById('cutEnd');
  const muteStart = document.getElementById('muteStart');
  const muteEnd = document.getElementById('muteEnd');

  let originalBlobUrl = null;
  let audioCtx = null;
  let sourceNode = null;

  const req = indexedDB.open('TaticoRecorderDB', 1);
  req.onsuccess = (e) => {
    const db = e.target.result;
    const tx = db.transaction('chunks', 'readonly');
    const store = tx.objectStore('chunks');
    const getAll = store.getAll();

    getAll.onsuccess = () => {
      const chunks = getAll.result;
      if (chunks.length === 0) {
        loading.textContent = 'Erro: Nenhum dado de gravação encontrado.';
        return;
      }

      const videoBlob = new Blob(chunks, { type: 'video/webm' });
      originalBlobUrl = URL.createObjectURL(videoBlob);
      vid.src = originalBlobUrl;

      vid.onloadedmetadata = () => {
        timeline.max = vid.duration;
        trimEnd.value = vid.duration.toFixed(1);
        durationDisplay.textContent = vid.duration.toFixed(1);
        loading.style.display = 'none';
        editorContainer.style.display = 'flex';
      };

      const clearTx = db.transaction('chunks', 'readwrite');
      clearTx.objectStore('chunks').clear();
    };
  };

  btnDownload.addEventListener('click', () => {
    const a = document.createElement('a');
    a.href = originalBlobUrl;
    a.download = `tatico-original-${Date.now()}.webm`;
    a.click();
  });

  vid.addEventListener('timeupdate', () => {
    if (!vid.paused) timeline.value = vid.currentTime;
    currentTimeDisplay.textContent = vid.currentTime.toFixed(1);
  });

  timeline.addEventListener('input', () => {
    vid.currentTime = timeline.value;
    currentTimeDisplay.textContent = parseFloat(timeline.value).toFixed(1);
  });

  document.getElementById('btnTrim').addEventListener('click', async () => {
    const start = parseFloat(trimStart.value) || 0;
    const end = parseFloat(trimEnd.value) || vid.duration;
    const cStart = parseFloat(cutStart.value) || 0;
    const cEnd = parseFloat(cutEnd.value) || 0;
    const mStart = parseFloat(muteStart.value) || 0;
    const mEnd = parseFloat(muteEnd.value) || 0;

    if (end <= start) return alert('O fim deve ser maior que o início.');

    const status = document.getElementById('trimStatus');
    status.style.display = 'block';
    status.textContent = 'Processando... Deixe a aba aberta até concluir.';

    if (!audioCtx) {
      audioCtx = new AudioContext();
      sourceNode = audioCtx.createMediaElementSource(vid);
    }
    const gainNode = audioCtx.createGain();
    const dest = audioCtx.createMediaStreamDestination();

    sourceNode.disconnect();
    sourceNode.connect(gainNode);
    gainNode.connect(dest);

    gainNode.connect(audioCtx.destination);

    const canvas = document.createElement('canvas');
    canvas.width = vid.videoWidth;
    canvas.height = vid.videoHeight;
    const ctx = canvas.getContext('2d');

    const canvasStream = canvas.captureStream(30);
    const audioTracks = dest.stream.getAudioTracks();
    const combinedStream = new MediaStream([...canvasStream.getVideoTracks(), ...audioTracks]);

    const recorder = new MediaRecorder(combinedStream, { mimeType: 'video/webm' });
    const trimmedChunks = [];
    recorder.ondataavailable = e => { if (e.data.size > 0) trimmedChunks.push(e.data); };

    recorder.onstop = () => {
      const trimmedBlob = new Blob(trimmedChunks, { type: 'video/webm' });
      const trimmedUrl = URL.createObjectURL(trimmedBlob);
      const a = document.createElement('a');
      a.href = trimmedUrl;
      a.download = `tatico-editado-${Date.now()}.webm`;
      a.click();
      status.textContent = 'Processamento finalizado!';

      sourceNode.disconnect();
      sourceNode.connect(audioCtx.destination);
    };

    let isJumping = false;
    vid.currentTime = start;
    await vid.play();
    recorder.start();

    const drawLoop = () => {
      if (vid.currentTime >= end || vid.ended) {
        recorder.stop();
        vid.pause();
        return;
      }

      if (cEnd > cStart && vid.currentTime >= cStart && vid.currentTime < cEnd) {
        if (!isJumping) {
          isJumping = true;
          recorder.pause();
          vid.currentTime = cEnd;

          vid.addEventListener('seeked', function onSeek() {
            vid.removeEventListener('seeked', onSeek);
            recorder.resume();
            isJumping = false;
            requestAnimationFrame(drawLoop);
          }, { once: true });
          return;
        }
      }

      if (mEnd > mStart && vid.currentTime >= mStart && vid.currentTime <= mEnd) {
        gainNode.gain.value = 0;
      } else {
        gainNode.gain.value = 1;
      }

      if (!vid.paused && !isJumping) {
        ctx.drawImage(vid, 0, 0, canvas.width, canvas.height);
      }

      requestAnimationFrame(drawLoop);
    };

    drawLoop();
  });
});
