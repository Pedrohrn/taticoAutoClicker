if (!window.taticoOverlayInjected) {
  window.taticoOverlayInjected = true;

  let cursorHighlight = null;
  let videoContainer = null;
  let videoCam = null;
  let currentCamStream = null;

  function atualizarEstiloMouse(color, size, opacity) {
    if (!cursorHighlight) return;
    const pxSize = size * 10;
    cursorHighlight.style.width = `${pxSize}px`;
    cursorHighlight.style.height = `${pxSize}px`;
    cursorHighlight.style.background = color;
    cursorHighlight.style.opacity = opacity / 100;
  }

  document.addEventListener('tatico:toggle_webcam', async (e) => {
    const { action, deviceId } = e.detail;

    if (action === 'start') {
      if (!videoContainer) {
        videoContainer = document.createElement('div');
        videoContainer.id = 'tatico-webcam-container';
        videoContainer.style.cssText = `
          position: fixed; bottom: 80px; left: 20px; width: 160px; height: 160px;
          z-index: 2147483646; display: flex; justify-content: center; align-items: center;
          transition: width 0.2s, height 0.2s;
        `;

        const videoWrapper = document.createElement('div');
        videoWrapper.style.cssText = `
          width: 100%; height: 100%; border-radius: 50%; overflow: hidden;
          box-shadow: 0 6px 16px rgba(0,0,0,0.4); background: #222; pointer-events: none;
        `;

        videoCam = document.createElement('video');
        videoCam.autoplay = true;
        videoCam.style.cssText = `
          width: 100%; height: 100%; border-radius: 50%; object-fit: cover; transform: scaleX(-1); background: #000;
        `;

        const btnToggleCam = document.createElement('button');
        btnToggleCam.textContent = '➖';
        btnToggleCam.title = 'Minimizar Câmera';
        btnToggleCam.style.cssText = `
          position: absolute; top: 0; right: 0; background: #dc3545; color: white;
          border: none; border-radius: 50%; width: 26px; height: 26px; cursor: pointer;
          font-size: 11px; display: flex; justify-content: center; align-items: center; z-index: 2;
          box-shadow: 0 2px 6px rgba(0,0,0,0.4); transition: background 0.2s;
        `;

        btnToggleCam.onclick = () => {
          const isHidden = videoWrapper.style.display === 'none';
          videoWrapper.style.display = isHidden ? 'block' : 'none';
          btnToggleCam.textContent = isHidden ? '➖' : '👁';
          btnToggleCam.style.background = isHidden ? '#dc3545' : '#28a745';
          videoContainer.style.width = isHidden ? '160px' : '48px';
          videoContainer.style.height = isHidden ? '160px' : '48px';
        };

        let isDraggingCam = false, sX, sY, iX, iY;
        videoContainer.addEventListener('mousedown', (ev) => {
          if (ev.target === btnToggleCam) return;
          isDraggingCam = true;
          sX = ev.clientX; sY = ev.clientY;
          iX = videoContainer.offsetLeft; iY = videoContainer.offsetTop;
          videoContainer.style.cursor = 'grabbing';
        });

        document.addEventListener('mousemove', (ev) => {
          if (!isDraggingCam) return;
          videoContainer.style.left = `${iX + ev.clientX - sX}px`;
          videoContainer.style.top = `${iY + ev.clientY - sY}px`;
          videoContainer.style.bottom = 'auto';
        });

        document.addEventListener('mouseup', () => {
          if (isDraggingCam) {
            isDraggingCam = false;
            videoContainer.style.cursor = 'grab';
          }
        });

        videoContainer.addEventListener('mouseenter', () => videoContainer.style.zIndex = '2147483647');
        videoContainer.addEventListener('mouseleave', () => videoContainer.style.zIndex = '2147483646');

        videoWrapper.appendChild(videoCam);
        videoContainer.appendChild(videoWrapper);
        videoContainer.appendChild(btnToggleCam);
        document.body.appendChild(videoContainer);
      }

      try {
        if (currentCamStream) currentCamStream.getTracks().forEach(t => t.stop());
        const constraints = deviceId && deviceId !== 'default'
          ? { video: { deviceId: { exact: deviceId } } }
          : { video: true };

        currentCamStream = await navigator.mediaDevices.getUserMedia(constraints);
        videoCam.srcObject = currentCamStream;
        videoContainer.style.display = 'flex';
      } catch (err) {
        console.error('Erro webcam overlay:', err);
      }

    } else if (action === 'stop') {
      if (currentCamStream) {
        currentCamStream.getTracks().forEach(t => t.stop());
        currentCamStream = null;
      }
      if (videoContainer) {
        videoContainer.style.display = 'none';
      }
    }
  });

  document.addEventListener('tatico:remove_overlays', () => {
    if (cursorHighlight) {
      cursorHighlight.remove();
      cursorHighlight = null;
    }
    if (videoContainer) {
      if (currentCamStream) currentCamStream.getTracks().forEach(t => t.stop());
      videoContainer.remove();
      videoContainer = null;
      videoCam = null;
    }
  });

  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.action === 'init_overlay') {
      if (msg.config && msg.config.useHighlight) {
        if (!cursorHighlight) {
          cursorHighlight = document.createElement('div');
          cursorHighlight.id = 'tatico-mouse-highlight';
          cursorHighlight.style.cssText = `
            position: fixed; border-radius: 50%; pointer-events: none;
            z-index: 2147483645; transform: translate(-50%, -50%); display: none;
            transition: width 0.1s, height 0.1s, background 0.1s, opacity 0.1s;
          `;
          document.body.appendChild(cursorHighlight);

          chrome.storage.local.get(['mouseColor', 'mouseSize', 'mouseOpacity'], (res) => {
            atualizarEstiloMouse(res.mouseColor || '#ff0000', res.mouseSize || 4, res.mouseOpacity || 50);
          });

          document.addEventListener('mousemove', (e) => {
            if (cursorHighlight) {
              cursorHighlight.style.display = 'block';
              cursorHighlight.style.left = `${e.clientX}px`;
              cursorHighlight.style.top = `${e.clientY}px`;
            }
          });
        }
      }
    }

    if (msg.action === 'remove_overlays' || msg.action === 'stop_recording') {
      document.dispatchEvent(new Event('tatico:remove_overlays'));
    }
  });

  chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'local' && cursorHighlight) {
      chrome.storage.local.get(['mouseColor', 'mouseSize', 'mouseOpacity'], (res) => {
        atualizarEstiloMouse(res.mouseColor || '#ff0000', res.mouseSize || 4, res.mouseOpacity || 50);
      });
    }
  });
}
