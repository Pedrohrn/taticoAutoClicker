let mediaRecorder;
let db;
let micStream = null;

const initDB = () => new Promise((resolve, reject) => {
  const req = indexedDB.open('TaticoRecorderDB', 1);
  req.onupgradeneeded = (e) => {
    const database = e.target.result;
    if (!database.objectStoreNames.contains('chunks')) {
      database.createObjectStore('chunks', { autoIncrement: true });
    }
  };
  req.onsuccess = () => { db = req.result; resolve(); };
  req.onerror = () => reject(req.error);
});

const clearDB = () => new Promise((resolve) => {
  if (!db) return resolve();
  const tx = db.transaction('chunks', 'readwrite');
  tx.objectStore('chunks').clear();
  tx.oncomplete = resolve;
});

const saveChunk = (blob) => {
  if (!db) return;
  const tx = db.transaction('chunks', 'readwrite');
  tx.objectStore('chunks').add(blob);
};

chrome.runtime.onMessage.addListener(async (msg) => {
  if (msg.target !== 'offscreen') return;

  if (msg.action === 'start_capture') {
    await initDB();
    await clearDB();

    try {
      let screenStream;

      try {
        screenStream = await navigator.mediaDevices.getUserMedia({
          video: { mandatory: { chromeMediaSource: 'desktop', chromeMediaSourceId: msg.streamId } }
        });
      } catch (videoErr) {
        console.error("Falha crítica ao iniciar captura. O pop-up nativo foi cancelado ou token expirou.", videoErr);
        return;
      }

      const tracks = [...screenStream.getTracks()];

      if (msg.config.useMic) {
        try {
          const micConstraints = msg.config.micId && msg.config.micId !== 'default'
            ? { audio: { deviceId: { exact: msg.config.micId } } }
            : { audio: true };

          micStream = await navigator.mediaDevices.getUserMedia(micConstraints);
          tracks.push(...micStream.getAudioTracks());
        } catch (err) {
          console.warn("Falha ao capturar o microfone.", err);
        }
      }

      const combinedStream = new MediaStream(tracks);
      mediaRecorder = new MediaRecorder(combinedStream, { mimeType: 'video/webm; codecs=vp9' });

      mediaRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) saveChunk(e.data);
      };

      mediaRecorder.onstop = () => {
        combinedStream.getTracks().forEach(t => t.stop());
        if (micStream) micStream.getTracks().forEach(t => t.stop());
      };

      mediaRecorder.start(1000);
    } catch (e) {
      console.error("Erro fatal e genérico ao consolidar os streams dentro do Offscreen:", e);
    }
  }

  if (msg.action === 'toggle_mic') {
    if (micStream) {
      micStream.getAudioTracks().forEach(t => t.enabled = msg.state);
    }
  }

  if (msg.action === 'pause_recording') {
    if (mediaRecorder && mediaRecorder.state === 'recording') mediaRecorder.pause();
  }

  if (msg.action === 'resume_recording') {
    if (mediaRecorder && mediaRecorder.state === 'paused') mediaRecorder.resume();
  }

  if (msg.action === 'stop_recording') {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      mediaRecorder.stop();
    }
  }
});
