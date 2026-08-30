document.addEventListener('DOMContentLoaded', async () => {
  const vid = document.getElementById('vidFinal');
  const btnDownload = document.getElementById('btnDownload');
  const divTrimming = document.getElementById('divTrimming');
  const loading = document.getElementById('loading');
  let originalBlobUrl = null;

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
      vid.style.display = 'block';
      btnDownload.style.display = 'inline-block';
      divTrimming.style.display = 'inline-block';
      loading.style.display = 'none';

      const clearTx = db.transaction('chunks', 'readwrite');
      clearTx.objectStore('chunks').clear();
    };
  };

  btnDownload.addEventListener('click', () => {
    const a = document.createElement('a');
    a.href = originalBlobUrl;
    a.download = `tatico-record-${Date.now()}.webm`;
    a.click();
  });

  document.getElementById('btnTrim').addEventListener('click', async () => {
    const start = parseFloat(document.getElementById('trimStart').value) || 0;
    let end = parseFloat(document.getElementById('trimEnd').value) || vid.duration;
    if (end <= start) return alert('O fim deve ser maior que o início.');

    const status = document.getElementById('trimStatus');
    status.textContent = 'Processando... (Isso levará o exato tempo da nova duração)';

    const canvas = document.createElement('canvas');
    canvas.width = vid.videoWidth;
    canvas.height = vid.videoHeight;
    const ctx = canvas.getContext('2d');

    const stream = canvas.captureStream(30);
    const recorder = new MediaRecorder(stream, { mimeType: 'video/webm' });
    const trimmedChunks = [];

    recorder.ondataavailable = e => { if (e.data.size > 0) trimmedChunks.push(e.data); };

    recorder.onstop = () => {
      const trimmedBlob = new Blob(trimmedChunks, { type: 'video/webm' });
      const trimmedUrl = URL.createObjectURL(trimmedBlob);
      const a = document.createElement('a');
      a.href = trimmedUrl;
      a.download = `tatico-trimmed-${Date.now()}.webm`;
      a.click();
      status.textContent = 'Corte finalizado!';
    };

    vid.currentTime = start;
    vid.play();
    recorder.start();

    const drawLoop = () => {
      if (vid.currentTime >= end || vid.ended || vid.paused) {
        recorder.stop();
        vid.pause();
        return;
      }
      ctx.drawImage(vid, 0, 0, canvas.width, canvas.height);
      requestAnimationFrame(drawLoop);
    };

    drawLoop();
  });
});
