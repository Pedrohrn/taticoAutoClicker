export function initSettings() {
  const selectStatusBarPos = document.getElementById('configStatusBarPos');
  const selectStatusBarAlign = document.getElementById('configStatusBarAlign');
  const checkStatusBarAtiva = document.getElementById('configStatusBarAtiva');

  // recuperando o gerenciamento da barra de status que havia sido perdido
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

  // referenciando os elementos de configuracao de inicializacao atuais
  const checkAutoStart = document.getElementById('configAutoStart');
  const checkResume = document.getElementById('configAutoStartResume');
  const selectModule = document.getElementById('configAutoStartModule');

  if (checkAutoStart && checkResume && selectModule) {
    // buscando os estados atuais no banco e preenchendo a ui
    chrome.storage.local.get(['autoStartEnabled', 'autoStartResume', 'autoStartModule'], (res) => {
      checkAutoStart.checked = res.autoStartEnabled || false;
      checkResume.checked = res.autoStartResume || false;
      selectModule.value = res.autoStartModule || 'revolver';
      atualizoVisibilidadeDosControles();
    });

    checkAutoStart.addEventListener('change', (e) => {
      chrome.storage.local.set({ autoStartEnabled: e.target.checked });
      atualizoVisibilidadeDosControles();
    });

    checkResume.addEventListener('change', (e) => {
      chrome.storage.local.set({ autoStartResume: e.target.checked });
      atualizoVisibilidadeDosControles();
    });

    selectModule.addEventListener('change', (e) => {
      chrome.storage.local.set({ autoStartModule: e.target.value });
    });

    // controlo as dependencias visuais baseando-me no checkbox principal
    function atualizoVisibilidadeDosControles() {
      checkResume.disabled = !checkAutoStart.checked;
      selectModule.disabled = !checkAutoStart.checked || checkResume.checked;
    }
  }
}
