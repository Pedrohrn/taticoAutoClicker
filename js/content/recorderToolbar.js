if (!window.taticoToolbarInjected) {
  window.taticoToolbarInjected = true;

  if (!document.getElementById('tatico-recorder-toolbar')) {
    const toolbar = document.createElement('div');
    toolbar.id = 'tatico-recorder-toolbar';
    toolbar.style.cssText = `
      position: fixed; bottom: 20px; left: 20px; background: #222; color: white;
      border-radius: 8px; z-index: 2147483647; display: flex; flex-direction: column;
      box-shadow: 0 4px 12px rgba(0,0,0,0.4); font-family: sans-serif; user-select: none;
      border: 1px solid #444; transition: width 0.2s; min-width: 200px;
    `;

    let isPaused = false;
    let isMinimized = false;
    let isRecording = false;
    let sessionConfig = { useMic: false, micId: null, useCam: false, camId: null, useHighlight: true };
    let streamIdForCapture = null;

    const dragHandle = document.createElement('div');
    dragHandle.style.cssText = `
      cursor: grab; background: #333; padding: 6px; border-radius: 8px 8px 0 0;
      display: flex; justify-content: space-between; align-items: center;
    `;
    const dragIcon = document.createElement('span');
    dragIcon.textContent = '✥ Arrastar';
    dragIcon.style.fontSize = '12px';
    dragIcon.style.color = '#aaa';

    const btnMinMax = document.createElement('button');
    btnMinMax.textContent = '➖';
    btnMinMax.style.cssText = 'background:none; border:none; color:white; cursor:pointer; font-size: 10px;';

    dragHandle.appendChild(dragIcon);
    dragHandle.appendChild(btnMinMax);

    const contentBody = document.createElement('div');
    contentBody.style.cssText = 'padding: 10px; display: flex; flex-direction: column; gap: 10px;';

    const mediaGroup = document.createElement('div');
    mediaGroup.style.cssText = 'display: flex; flex-direction: column; gap: 6px; font-size: 12px;';

    const micRow = document.createElement('div');
    micRow.style.cssText = 'display: flex; align-items: center; gap: 5px;';
    const btnMic = document.createElement('button');
    btnMic.textContent = '🎤 OFF';
    btnMic.title = 'Ligar/Desligar Microfone';
    btnMic.style.cssText = 'cursor:pointer; background:#555; color:white; border:none; border-radius:4px; padding:4px 8px; flex-shrink:0; width: 65px;';
    const selectMic = document.createElement('select');
    selectMic.style.cssText = 'display:none; flex:1; background:#333; color:white; border:1px solid #555; border-radius:4px; padding:3px; max-width: 130px; font-size: 11px;';
    micRow.appendChild(btnMic);
    micRow.appendChild(selectMic);

    const camRow = document.createElement('div');
    camRow.style.cssText = 'display: flex; align-items: center; gap: 5px;';
    const btnCam = document.createElement('button');
    btnCam.textContent = '📷 OFF';
    btnCam.title = 'Ligar/Desligar Câmera';
    btnCam.style.cssText = 'cursor:pointer; background:#555; color:white; border:none; border-radius:4px; padding:4px 8px; flex-shrink:0; width: 65px;';
    const selectCam = document.createElement('select');
    selectCam.style.cssText = 'display:none; flex:1; background:#333; color:white; border:1px solid #555; border-radius:4px; padding:3px; max-width: 130px; font-size: 11px;';
    camRow.appendChild(btnCam);
    camRow.appendChild(selectCam);

    mediaGroup.appendChild(micRow);
    mediaGroup.appendChild(camRow);

    const actionGroup = document.createElement('div');
    actionGroup.style.cssText = 'display: flex; gap: 6px; align-items: center; border-top: 1px solid #333; padding-top: 8px;';

    const btnPlay = document.createElement('button');
    btnPlay.textContent = '▶ Gravar';
    btnPlay.style.cssText = 'padding: 6px 12px; cursor:pointer; background:#28a745; color:white; border:none; border-radius:4px; flex: 1; font-weight:bold;';

    const btnPause = document.createElement('button');
    btnPause.textContent = '⏸ Pausar';
    btnPause.style.cssText = 'padding: 6px 12px; cursor:pointer; background:#555; color:white; border:none; border-radius:4px; flex: 1; display: none;';

    const btnStop = document.createElement('button');
    btnStop.textContent = '⏹ Parar';
    btnStop.style.cssText = 'padding: 6px 12px; cursor:pointer; background:#dc3545; color:white; border:none; border-radius:4px; flex: 1; display: none; font-weight:bold;';

    const btnSettings = document.createElement('button');
    btnSettings.textContent = '⚙️';
    btnSettings.title = 'Configurações de destaque do mouse';
    btnSettings.style.cssText = 'padding: 6px; cursor:pointer; background:#444; color:white; border:none; border-radius:4px; font-size: 14px;';

    actionGroup.appendChild(btnPlay);
    actionGroup.appendChild(btnPause);
    actionGroup.appendChild(btnStop);
    actionGroup.appendChild(btnSettings);

    const configGroup = document.createElement('div');
    configGroup.style.cssText = 'background: #1a1a1a; padding: 8px; border-radius: 4px; font-size: 11px; display: none; flex-direction: row; gap: 8px; justify-content: center; align-items: center;';
    configGroup.innerHTML = `
      <span title="Cor">🎨<input type="color" id="tbMouseColor" style="width:20px; height:20px; padding:0; border:none; margin-left:2px; cursor:pointer;"></span>
      <span title="Tamanho">📏<input type="range" id="tbMouseSize" min="1" max="10" style="width:50px; margin-left:2px;"></span>
      <span title="Opacidade">💡<input type="range" id="tbMouseOpacity" min="1" max="100" style="width:50px; margin-left:2px;"></span>
    `;

    contentBody.appendChild(mediaGroup);
    contentBody.appendChild(actionGroup);
    contentBody.appendChild(configGroup);
    toolbar.appendChild(dragHandle);
    toolbar.appendChild(contentBody);
    document.body.appendChild(toolbar);

    btnMic.addEventListener('click', async () => {
      if (sessionConfig.useMic) {
        sessionConfig.useMic = false;
        btnMic.textContent = '🎤 OFF';
        btnMic.style.background = '#555';
        selectMic.style.display = 'none';
        if (isRecording) chrome.runtime.sendMessage({ target: 'offscreen', action: 'toggle_mic', state: false });
      } else {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          sessionConfig.useMic = true;
          btnMic.textContent = '🎤 ON';
          btnMic.style.background = '#28a745';
          selectMic.style.display = 'block';

          const devices = await navigator.mediaDevices.enumerateDevices();
          selectMic.innerHTML = '';
          devices.filter(d => d.kind === 'audioinput').forEach(d => {
            const opt = document.createElement('option');
            opt.value = d.deviceId;
            opt.textContent = d.label || 'Microfone';
            selectMic.appendChild(opt);
          });
          const trackId = stream.getAudioTracks()[0]?.getSettings().deviceId;
          if (trackId) selectMic.value = trackId;
          sessionConfig.micId = selectMic.value;
          stream.getTracks().forEach(t => t.stop());

          if (isRecording) chrome.runtime.sendMessage({ target: 'offscreen', action: 'toggle_mic', state: true });
        } catch (e) {
          console.warn('Mic permission denied:', e);
          alert('Permissão de microfone negada pelo navegador ou dispositivo indisponível.');
        }
      }
    });

    selectMic.addEventListener('change', () => {
      sessionConfig.micId = selectMic.value;
      if (isRecording) chrome.runtime.sendMessage({ target: 'offscreen', action: 'toggle_mic', state: true, deviceId: sessionConfig.micId });
    });

    btnCam.addEventListener('click', async () => {
      if (sessionConfig.useCam) {
        sessionConfig.useCam = false;
        btnCam.textContent = '📷 OFF';
        btnCam.style.background = '#555';
        selectCam.style.display = 'none';
        document.dispatchEvent(new CustomEvent('tatico:toggle_webcam', { detail: { action: 'stop' } }));
      } else {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ video: true });
          sessionConfig.useCam = true;
          btnCam.textContent = '📷 ON';
          btnCam.style.background = '#28a745';
          selectCam.style.display = 'block';

          const devices = await navigator.mediaDevices.enumerateDevices();
          selectCam.innerHTML = '';
          devices.filter(d => d.kind === 'videoinput').forEach(d => {
            const opt = document.createElement('option');
            opt.value = d.deviceId;
            opt.textContent = d.label || 'Câmera';
            selectCam.appendChild(opt);
          });
          const trackId = stream.getVideoTracks()[0]?.getSettings().deviceId;
          if (trackId) selectCam.value = trackId;
          sessionConfig.camId = selectCam.value;
          stream.getTracks().forEach(t => t.stop());

          document.dispatchEvent(new CustomEvent('tatico:toggle_webcam', { detail: { action: 'start', deviceId: sessionConfig.camId } }));
        } catch (e) {
          console.warn('Cam permission denied:', e);
          alert('Permissão de câmera negada pelo navegador ou dispositivo indisponível.');
        }
      }
    });

    selectCam.addEventListener('change', () => {
      sessionConfig.camId = selectCam.value;
      document.dispatchEvent(new CustomEvent('tatico:toggle_webcam', { detail: { action: 'start', deviceId: sessionConfig.camId } }));
    });

    const tbColor = document.getElementById('tbMouseColor');
    const tbSize = document.getElementById('tbMouseSize');
    const tbOpacity = document.getElementById('tbMouseOpacity');

    chrome.storage.local.get(['mouseColor', 'mouseSize', 'mouseOpacity'], (res) => {
      tbColor.value = res.mouseColor || '#ff0000';
      tbSize.value = res.mouseSize || 4;
      tbOpacity.value = res.mouseOpacity || 50;
    });

    const salvarConfig = () => chrome.storage.local.set({ mouseColor: tbColor.value, mouseSize: tbSize.value, mouseOpacity: tbOpacity.value });
    tbColor.addEventListener('input', salvarConfig);
    tbSize.addEventListener('input', salvarConfig);
    tbOpacity.addEventListener('input', salvarConfig);

    btnSettings.addEventListener('click', () => {
      configGroup.style.display = configGroup.style.display === 'none' ? 'flex' : 'none';
    });

    btnMinMax.addEventListener('click', () => {
      isMinimized = !isMinimized;
      contentBody.style.display = isMinimized ? 'none' : 'flex';
      btnMinMax.textContent = isMinimized ? '➕' : '➖';
    });

    let isDragging = false, startX, startY, initialX, initialY;
    dragHandle.addEventListener('mousedown', (e) => {
      if (e.target === btnMinMax) return;
      isDragging = true;
      startX = e.clientX; startY = e.clientY;
      initialX = toolbar.offsetLeft; initialY = toolbar.offsetTop;
      dragHandle.style.cursor = 'grabbing';
    });

    document.addEventListener('mousemove', (e) => {
      if (!isDragging) return;
      toolbar.style.left = `${initialX + e.clientX - startX}px`;
      toolbar.style.top = `${initialY + e.clientY - startY}px`;
      toolbar.style.bottom = 'auto';
    });

    document.addEventListener('mouseup', () => {
      if (isDragging) {
        isDragging = false;
        dragHandle.style.cursor = 'grab';
      }
    });

    function showCountdownAndRecord() {
      const overlay = document.createElement('div');
      overlay.style.cssText = `
        position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
        background: rgba(0, 0, 0, 0.7); z-index: 2147483647;
        display: flex; justify-content: center; align-items: center;
        font-size: 180px; color: white; font-weight: bold; font-family: sans-serif;
      `;
      document.body.appendChild(overlay);

      isRecording = true;
      chrome.runtime.sendMessage({
        action: 'start_offscreen_capture',
        streamId: streamIdForCapture,
        config: sessionConfig
      });

      let count = 3;
      overlay.textContent = count;
      const interval = setInterval(() => {
        count--;
        if (count > 0) {
          overlay.textContent = count;
        } else {
          clearInterval(interval);
          overlay.remove();
        }
      }, 1000);
    }

    btnPlay.addEventListener('click', () => {
      chrome.runtime.sendMessage({ action: 'request_desktop_capture' }, (response) => {
        if (response && response.status === 'ready') {
          streamIdForCapture = response.streamId;
          btnPlay.style.display = 'none';
          btnSettings.style.display = 'none';
          configGroup.style.display = 'none';
          btnPause.style.display = 'block';
          btnStop.style.display = 'block';
          showCountdownAndRecord();
        }
      });
    });

    btnPause.addEventListener('click', () => {
      isPaused = !isPaused;
      btnPause.textContent = isPaused ? '▶ Retomar' : '⏸ Pausar';
      chrome.runtime.sendMessage({ action: isPaused ? 'pause_recording' : 'resume_recording' });
    });

    btnStop.addEventListener('click', () => {
      document.dispatchEvent(new Event('tatico:remove_overlays'));
      chrome.runtime.sendMessage({ action: 'stop_recording' });
      toolbar.remove();
      window.taticoToolbarInjected = false;
    });

    chrome.runtime.onMessage.addListener((msg) => {
      if (msg.action === 'init_overlay') {
        if (msg.config) {
          sessionConfig = { ...sessionConfig, ...msg.config };
          sessionConfig.useHighlight = msg.config.useHighlight !== false;
        }

        if (msg.state === 'recording') {
          isRecording = true;
          btnPlay.style.display = 'none';
          btnSettings.style.display = 'none';
          configGroup.style.display = 'none';
          btnPause.style.display = 'block';
          btnStop.style.display = 'block';
        }
      }
      if (msg.action === 'remove_overlays') {
        document.dispatchEvent(new Event('tatico:remove_overlays'));
        toolbar.remove();
        window.taticoToolbarInjected = false;
      }
    });
  }
}
