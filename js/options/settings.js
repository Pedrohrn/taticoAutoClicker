export function initSettings() {
  const selectStatusBarPos = document.getElementById('configStatusBarPos');
  const selectStatusBarAlign = document.getElementById('configStatusBarAlign');
  const checkStatusBarAtiva = document.getElementById('configStatusBarAtiva');

  if (selectStatusBarPos && selectStatusBarAlign) {
    chrome.storage.local.get(['statusBarPos'], (res) => {
      const val = res.statusBarPos || 'bottom-center';
      if (val === 'custom') {
        selectStatusBarPos.value = 'custom';
        selectStatusBarAlign.disabled = true;
      } else {
        const parts = val.split('-');
        selectStatusBarPos.value = parts[0] || 'bottom';
        selectStatusBarAlign.value = parts[1] || 'center';
        selectStatusBarAlign.disabled = false;
      }
    });

    const salvarPosicao = () => {
      if (selectStatusBarPos.value === 'custom') {
        selectStatusBarAlign.disabled = true;
        chrome.storage.local.set({ statusBarPos: 'custom' });
      } else {
        selectStatusBarAlign.disabled = false;
        chrome.storage.local.set({ statusBarPos: `${selectStatusBarPos.value}-${selectStatusBarAlign.value}` });
      }
    };

    selectStatusBarPos.addEventListener('change', salvarPosicao);
    selectStatusBarAlign.addEventListener('change', salvarPosicao);
  }

  if (checkStatusBarAtiva) {
    chrome.storage.local.get(['statusBarClosed'], (res) => {
      checkStatusBarAtiva.checked = !res.statusBarClosed;
    });
    checkStatusBarAtiva.addEventListener('change', (e) => {
      chrome.storage.local.set({ statusBarClosed: !e.target.checked });
    });
  }

  const checkAutoStart = document.getElementById('configAutoStart');
  const checkResume = document.getElementById('configAutoStartResume');
  const checkClicker = document.getElementById('configAutoStartClicker');
  const checkRefresh = document.getElementById('configAutoStartRefresh');
  const checkRevolver = document.getElementById('configAutoStartRevolver');

  if (checkAutoStart && checkResume && checkClicker && checkRefresh && checkRevolver) {
    chrome.storage.local.get(['autoStartEnabled', 'autoStartResume', 'autoStartModules'], (res) => {
      checkAutoStart.checked = res.autoStartEnabled || false;
      checkResume.checked = res.autoStartResume || false;

      const modulos = res.autoStartModules || { clicker: false, refresh: false, revolver: false };
      checkClicker.checked = modulos.clicker;
      checkRefresh.checked = modulos.refresh;
      checkRevolver.checked = modulos.revolver;

      atualizoVisibilidadeDosControles();
    });

    const salvarEstadoModulos = () => {
      chrome.storage.local.set({
        autoStartModules: {
          clicker: checkClicker.checked,
          refresh: checkRefresh.checked,
          revolver: checkRevolver.checked
        }
      });
    };

    checkAutoStart.addEventListener('change', (e) => {
      chrome.storage.local.set({ autoStartEnabled: e.target.checked });
      atualizoVisibilidadeDosControles();
    });

    checkResume.addEventListener('change', (e) => {
      chrome.storage.local.set({ autoStartResume: e.target.checked });
      atualizoVisibilidadeDosControles();
    });

    checkClicker.addEventListener('change', salvarEstadoModulos);
    checkRefresh.addEventListener('change', salvarEstadoModulos);
    checkRevolver.addEventListener('change', salvarEstadoModulos);

    function atualizoVisibilidadeDosControles() {
      checkResume.disabled = !checkAutoStart.checked;
      const modulosDesabilitados = !checkAutoStart.checked || checkResume.checked;
      checkClicker.disabled = modulosDesabilitados;
      checkRefresh.disabled = modulosDesabilitados;
      checkRevolver.disabled = modulosDesabilitados;
    }
  }
}
