let mediaRecorder;
let db;
let micStream = null;
let combinedStream = null;

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

window.onload = async () => {
  await initDB();
  await clearDB();

  chrome.storage.session.get(['recordingConfig'], (res) => {
    const config = res.recordingConfig || {};

    chrome.desktopCapture.chooseDesktopMedia(['screen', 'window', 'tab', 'audio'], (streamId) => {
      if (!streamId) {
        chrome.runtime.sendMessage({ action: 'recording_cancelled' });
        window.close();
        return;
      }
      initializeCapture(streamId, config);
    });
  });
};

async function initializeCapture(streamId, config) {
  try {
    let screenStream;
    try {
      screenStream = await navigator.mediaDevices.getUserMedia({
        video: { mandatory: { chromeMediaSource: 'desktop', chromeMediaSourceId: streamId } },
        audio: { mandatory: { chromeMediaSource: 'desktop', chromeMediaSourceId: streamId } }
      });
    } catch (audioSysErr) {
      screenStream = await navigator.mediaDevices.getUserMedia({
        video: { mandatory: { chromeMediaSource: 'desktop', chromeMediaSourceId: streamId } }
      });
    }

    const tracks = [...screenStream.getTracks()];

    if (config.useMic) {
      try {
        const micConstraints = config.micId && config.micId !== 'default'
          ? { audio: { deviceId: { exact: config.micId } } }
          : { audio: true };

        micStream = await navigator.mediaDevices.getUserMedia(micConstraints);
        tracks.push(...micStream.getAudioTracks());
      } catch (err) {
        console.warn("Falha ao capturar o microfone.", err);
      }
    }

    combinedStream = new MediaStream(tracks);
    mediaRecorder = new MediaRecorder(combinedStream, { mimeType: 'video/webm; codecs=vp9' });

    mediaRecorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) saveChunk(e.data);
    };

    screenStream.getVideoTracks()[0].onended = () => {
      stopCapture();
    };

    chrome.runtime.sendMessage({ action: 'recording_ready' });

  } catch (e) {
    console.error("Erro fatal ao consolidar streams:", e);
    chrome.runtime.sendMessage({ action: 'recording_cancelled' });
    window.close();
  }
}

function stopCapture() {
  if (mediaRecorder && mediaRecorder.state !== 'inactive') {
    mediaRecorder.stop();
  }
  if (combinedStream) combinedStream.getTracks().forEach(t => t.stop());
  if (micStream) micStream.getTracks().forEach(t => t.stop());

  chrome.runtime.sendMessage({ action: 'finalize_recording' });
  setTimeout(() => window.close(), 500);
}

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.action === 'start_recording_now') {
    if (mediaRecorder && mediaRecorder.state === 'inactive') mediaRecorder.start(1000);
  }
  if (msg.action === 'pause_recording') {
    if (mediaRecorder && mediaRecorder.state === 'recording') mediaRecorder.pause();
  }
  if (msg.action === 'resume_recording') {
    if (mediaRecorder && mediaRecorder.state === 'paused') mediaRecorder.resume();
  }
  if (msg.action === 'stop_recording') {
    stopCapture();
  }
  if (msg.action === 'toggle_mic') {
    if (micStream) micStream.getAudioTracks().forEach(t => t.enabled = msg.state);
  }
});
