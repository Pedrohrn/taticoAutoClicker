document.addEventListener('DOMContentLoaded', async () => {
  const vid = document.getElementById('vidFinal');
  const loading = document.getElementById('loading');
  const editorContainer = document.getElementById('editorContainer');

  const btnPlayPause = document.getElementById('btnPlayPause');
  const currentTimeDisplay = document.getElementById('currentTimeDisplay');
  const durationDisplay = document.getElementById('durationDisplay');
  const btnMuteToggle = document.getElementById('btnMuteToggle');
  const volSlider = document.getElementById('volSlider');
  const btnPip = document.getElementById('btnPip');
  const btnFullscreen = document.getElementById('btnFullscreen');
  const btnDownload = document.getElementById('btnDownload');

  const timelineContainer = document.getElementById('timelineContainer');
  const timelineProgress = document.getElementById('timelineProgress');

  const trimStart = document.getElementById('trimStart');
  const trimEnd = document.getElementById('trimEnd');

  const pinTrimStart = document.getElementById('pinTrimStart');
  const pinTrimEnd = document.getElementById('pinTrimEnd');

  const cutItemsContainer = document.getElementById('cutItemsContainer');
  const muteItemsContainer = document.getElementById('muteItemsContainer');
  const btnAddCut = document.getElementById('btnAddCut');
  const btnAddMute = document.getElementById('btnAddMute');

  const btnTrim = document.getElementById('btnTrim');
  const btnUndo = document.getElementById('btnUndo');
  const trimStatus = document.getElementById('trimStatus');

  let originalBlobUrl = null;
  let editedBlobUrl = null;
  let videoDuration = 0;
  let audioCtx = null;
  let sourceNode = null;

  document.querySelectorAll('.accordion-header').forEach(btn => {
    btn.addEventListener('click', () => {
      btn.parentElement.classList.toggle('open');
    });
  });

  const createDynamicRow = (container, typeClass) => {
    const row = document.createElement('div');
    row.className = 'dynamic-row flex-row mb-15';
    row.innerHTML = `
      <label>De (s): <input type="number" class="${typeClass}-start" value="0" min="0" step="0.1"></label>
      <label>Até (s): <input type="number" class="${typeClass}-end" value="0" min="0" step="0.1"></label>
      <button type="button" class="btn btn-danger-sm btn-remove-row" title="Remover">🗑</button>
    `;
    row.querySelector('.btn-remove-row').addEventListener('click', () => row.remove());
    container.appendChild(row);
  };

  btnAddCut.addEventListener('click', () => createDynamicRow(cutItemsContainer, 'cut'));
  btnAddMute.addEventListener('click', () => createDynamicRow(muteItemsContainer, 'mute'));

  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = Math.floor(seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const updatePinPosition = (pin, value) => {
    if (videoDuration === 0) return;
    const percent = Math.min(Math.max((value / videoDuration) * 100, 0), 100);
    pin.style.left = `${percent}%`;
  };

  const initUI = (duration) => {
    videoDuration = duration;
    durationDisplay.textContent = formatTime(duration);
    trimEnd.value = duration.toFixed(1);

    [trimStart, trimEnd].forEach(input => {
      const pin = input === trimStart ? pinTrimStart : pinTrimEnd;
      updatePinPosition(pin, parseFloat(input.value));

      input.addEventListener('input', (e) => {
        let val = parseFloat(e.target.value) || 0;
        if (val > videoDuration) val = videoDuration;
        updatePinPosition(pin, val);
        vid.currentTime = val;
      });
    });

    loading.classList.add('d-none');
    editorContainer.classList.remove('d-none');
  };

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
        if (vid.duration === Infinity) {
          vid.currentTime = 1e8;
          vid.addEventListener('timeupdate', function getDuration() {
            if (vid.duration !== Infinity) {
              vid.removeEventListener('timeupdate', getDuration);
              initUI(vid.duration);
              vid.currentTime = 0;
            }
          });
        } else {
          initUI(vid.duration);
        }
      };

      const clearTx = db.transaction('chunks', 'readwrite');
      clearTx.objectStore('chunks').clear();
    };
  };

  const togglePlay = () => vid.paused ? vid.play() : vid.pause();
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      vid.requestFullscreen?.() || vid.parentElement.requestFullscreen?.();
    } else {
      document.exitFullscreen?.();
    }
  };

  vid.addEventListener('click', togglePlay);
  vid.addEventListener('dblclick', toggleFullscreen);

  btnPlayPause.addEventListener('click', togglePlay);
  btnFullscreen.addEventListener('click', toggleFullscreen);

  vid.addEventListener('play', () => btnPlayPause.textContent = '⏸');
  vid.addEventListener('pause', () => btnPlayPause.textContent = '▶');

  vid.addEventListener('timeupdate', () => {
    currentTimeDisplay.textContent = formatTime(vid.currentTime);
    if (videoDuration > 0) {
      timelineProgress.style.width = `${(vid.currentTime / videoDuration) * 100}%`;
    }
  });

  btnMuteToggle.addEventListener('click', () => {
    vid.muted = !vid.muted;
    btnMuteToggle.textContent = vid.muted ? '🔇' : '🔊';
  });

  volSlider.addEventListener('input', (e) => vid.volume = e.target.value);
  btnPip.addEventListener('click', () => vid.requestPictureInPicture && vid.requestPictureInPicture());

  btnDownload.addEventListener('click', () => {
    const a = document.createElement('a');
    a.href = editedBlobUrl || originalBlobUrl;
    a.download = `tatico-video-${Date.now()}.webm`;
    a.click();
  });

  let isDragging = null;

  timelineContainer.addEventListener('mousedown', (e) => {
    const rect = timelineContainer.getBoundingClientRect();
    if (e.target.classList.contains('pin')) {
      isDragging = e.target;
      isDragging.classList.add('active-drag');
      return;
    }
    const pos = (e.clientX - rect.left) / rect.width;
    vid.currentTime = pos * videoDuration;
  });

  document.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    const rect = timelineContainer.getBoundingClientRect();
    let pos = (e.clientX - rect.left) / rect.width;
    pos = Math.max(0, Math.min(pos, 1));

    const timeVal = pos * videoDuration;
    const input = isDragging.id === 'pinTrimStart' ? trimStart : trimEnd;

    input.value = timeVal.toFixed(1);
    updatePinPosition(isDragging, timeVal);
    vid.currentTime = timeVal;
  });

  document.addEventListener('mouseup', () => {
    if (isDragging) {
      isDragging.classList.remove('active-drag');
      isDragging = null;
    }
  });

  btnUndo.addEventListener('click', () => {
    vid.src = originalBlobUrl;
    btnUndo.classList.add('d-none');
    trimStatus.classList.remove('d-none', 'status-warning', 'status-success');
    trimStatus.classList.add('status-info');
    trimStatus.textContent = 'Edição desfeita. Exibindo original.';
  });

  btnTrim.addEventListener('click', async () => {
    const start = parseFloat(trimStart.value) || 0;
    const end = parseFloat(trimEnd.value) || videoDuration;

    if (end <= start) return alert('O fim do corte deve ser maior que o início.');

    const cuts = Array.from(document.querySelectorAll('.cut-start')).map(el => ({
      start: parseFloat(el.value) || 0,
      end: parseFloat(el.closest('.dynamic-row').querySelector('.cut-end').value) || 0
    })).filter(c => c.end > c.start).sort((a, b) => a.start - b.start);

    const mutes = Array.from(document.querySelectorAll('.mute-start')).map(el => ({
      start: parseFloat(el.value) || 0,
      end: parseFloat(el.closest('.dynamic-row').querySelector('.mute-end').value) || 0
    })).filter(m => m.end > m.start);

    trimStatus.classList.remove('d-none', 'status-info', 'status-success');
    trimStatus.classList.add('status-warning');
    trimStatus.textContent = 'Processando... Deixe a aba aberta até concluir.';
    btnUndo.classList.add('d-none');

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
    canvas.width = vid.videoWidth || 1920;
    canvas.height = vid.videoHeight || 1080;
    const ctx = canvas.getContext('2d');

    const canvasStream = canvas.captureStream(30);
    const audioTracks = dest.stream.getAudioTracks();
    const combinedStream = new MediaStream([...canvasStream.getVideoTracks(), ...audioTracks]);
    const recorder = new MediaRecorder(combinedStream, { mimeType: 'video/webm' });
    const trimmedChunks = [];

    recorder.ondataavailable = e => {
      if (e.data.size > 0) trimmedChunks.push(e.data);
    };

    recorder.onstop = () => {
      const trimmedBlob = new Blob(trimmedChunks, { type: 'video/webm' });

      if (editedBlobUrl) URL.revokeObjectURL(editedBlobUrl);
      editedBlobUrl = URL.createObjectURL(trimmedBlob);

      vid.src = editedBlobUrl;
      btnUndo.classList.remove('d-none');

      trimStatus.classList.remove('status-warning');
      trimStatus.classList.add('status-success');
      trimStatus.textContent = 'Processamento finalizado e pronto para download!';

      sourceNode.disconnect();
      sourceNode.connect(audioCtx.destination);
    };

    let isJumping = false;
    vid.src = originalBlobUrl;
    vid.currentTime = start;
    await vid.play();
    recorder.start();

    const drawLoop = () => {
      if (vid.currentTime >= end || vid.ended) {
        recorder.stop();
        vid.pause();
        return;
      }

      const currentCut = cuts.find(c => vid.currentTime >= c.start && vid.currentTime < c.end);
      if (currentCut) {
        if (!isJumping) {
          isJumping = true;
          recorder.pause();
          vid.currentTime = currentCut.end;
          vid.addEventListener('seeked', function onSeek() {
            vid.removeEventListener('seeked', onSeek);
            recorder.resume();
            isJumping = false;
            requestAnimationFrame(drawLoop);
          }, { once: true });
          return;
        }
      }

      const isMuted = mutes.some(m => vid.currentTime >= m.start && vid.currentTime <= m.end);
      gainNode.gain.value = isMuted ? 0 : 1;

      if (!vid.paused && !isJumping) {
        ctx.drawImage(vid, 0, 0, canvas.width, canvas.height);
      }

      requestAnimationFrame(drawLoop);
    };

    drawLoop();
  });
});
