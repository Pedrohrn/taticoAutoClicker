document.addEventListener('DOMContentLoaded', async () => {
  const btnToggleRevolver = document.getElementById('btnToggleRevolver');
  const btnToggleAutoClicker = document.getElementById('btnToggleAutoClicker');
  const btnToggleAutoRefresh = document.getElementById('btnToggleAutoRefresh');
  const btnToggleAutoScroll = document.getElementById('btnToggleAutoScroll');
  const btnToggleStatusBar = document.getElementById('btnToggleStatusBar');
  const btnResetStatusBar = document.getElementById('btnResetStatusBar');
  const btnOpcoes = document.getElementById('btnOpcoes');
  const comboJanelaScope = document.getElementById('comboJanelaScope');
  const textoStatusRevolver = document.getElementById('textoStatusRevolver');
  const textoRotinaAtual = document.getElementById('textoRotinaAtual');

  let currentWindowId = null;
  let allWindows = [];

  function aplicarTema(tema) {
    document.documentElement.setAttribute('data-theme', tema);
  }

  async function carregarJanelas() {
    allWindows = await chrome.windows.getAll({ populate: true });
    const currentWindow = await chrome.windows.getCurrent();
    currentWindowId = currentWindow.id;

    allWindows.forEach(win => {
      const activeTab = win.tabs.find(t => t.active) || win.tabs[0];
      const title = activeTab ? (activeTab.title.substring(0, 30) + (activeTab.title.length > 30 ? '...' : '')) : 'Janela Vazia';
      const label = win.id === currentWindowId ? `Janela Atual (${title})` : `Janela ID: ${win.id} (${title})`;

      const option = document.createElement('option');
      option.value = win.id;
      option.textContent = label;
      comboJanelaScope.appendChild(option);
    });
    comboJanelaScope.value = currentWindowId.toString();
  }

  function getScopeIds() {
    const val = comboJanelaScope.value;
    return val === 'global' ? allWindows.map(w => w.id) : [parseInt(val)];
  }

  function lerEstadoDoEscopoSelecionado(windowStates) {
    const ids = getScopeIds();
    let clickerPaused = true, refreshPaused = true, scrollPaused = true, revolverAtivo = false;

    ids.forEach(id => {
      const wState = windowStates[id] || {};
      if (!wState.autoClickerPaused) clickerPaused = false;
      if (!wState.autoRefreshPaused) refreshPaused = false;
      if (!wState.autoScrollPaused) scrollPaused = false;
      if (wState.revolverAtivo) revolverAtivo = true;
    });

    atualizarUiBotoes(clickerPaused, refreshPaused, scrollPaused);
    atualizarUiRevolver(revolverAtivo);
  }

  async function atualizarEstadoNoStorage(chave, booleanoAtivo) {
    const res = await chrome.storage.local.get(['windowStates']);
    const wStates = res.windowStates || {};
    const ids = getScopeIds();

    ids.forEach(id => {
      if (!wStates[id]) wStates[id] = { autoClickerPaused: false, autoRefreshPaused: false, autoScrollPaused: false, revolverAtivo: false };
      wStates[id][chave] = booleanoAtivo;
    });
    await chrome.storage.local.set({ windowStates: wStates });
  }

  function atualizarUiBotoes(clickerPaused, refreshPaused, scrollPaused) {
    btnToggleAutoClicker.textContent = clickerPaused ? "Retomar AutoClicker" : "Pausar AutoClicker";
    btnToggleAutoClicker.className = clickerPaused ? "btn btn-success btn-block" : "btn btn-secondary btn-block";

    btnToggleAutoRefresh.textContent = refreshPaused ? "Retomar AutoRefresh" : "Pausar AutoRefresh";
    btnToggleAutoRefresh.className = refreshPaused ? "btn btn-success btn-block" : "btn btn-secondary btn-block";

    btnToggleAutoScroll.textContent = scrollPaused ? "Retomar AutoScroll" : "Pausar AutoScroll";
    btnToggleAutoScroll.className = scrollPaused ? "btn btn-success btn-block" : "btn btn-secondary btn-block";
  }

  function atualizarUiRevolver(ativo) {
    textoStatusRevolver.textContent = ativo ? "Rodando (ON)" : "Pausado (OFF)";
    textoStatusRevolver.style.color = ativo ? "var(--success)" : "var(--text-main)";
    btnToggleRevolver.textContent = ativo ? "Pausar Revolver" : "Iniciar Revolver";
    btnToggleRevolver.className = ativo ? "btn btn-danger btn-block" : "btn btn-success btn-block";
  }

  await carregarJanelas();

  chrome.storage.local.get(['theme', 'statusBarClosed', 'rotinaAtualNome', 'windowStates'], async (res) => {
    aplicarTema(res.theme || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'));
    textoRotinaAtual.textContent = res.rotinaAtualNome || "Nenhuma";
    if (res.statusBarClosed) {
      btnToggleStatusBar.textContent = "Exibir Barra de Status UI";
      btnToggleStatusBar.className = "btn btn-info btn-block";
    }
    lerEstadoDoEscopoSelecionado(res.windowStates || {});
  });

  comboJanelaScope.addEventListener('change', () => {
    chrome.storage.local.get(['windowStates'], res => lerEstadoDoEscopoSelecionado(res.windowStates || {}));
  });

  document.getElementById('btnToggleTheme').addEventListener('click', () => {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark' || (!document.documentElement.getAttribute('data-theme') && window.matchMedia('(prefers-color-scheme: dark)').matches);
    chrome.storage.local.set({ theme: isDark ? 'light' : 'dark' });
  });

  chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'local') {
      if (changes.theme) aplicarTema(changes.theme.newValue);
      if (changes.statusBarClosed) {
        btnToggleStatusBar.textContent = changes.statusBarClosed.newValue ? "Exibir Barra de Status UI" : "Ocultar Barra de Status UI";
        btnToggleStatusBar.className = changes.statusBarClosed.newValue ? "btn btn-info btn-block" : "btn btn-secondary btn-block";
      }
      if (changes.rotinaAtualNome) textoRotinaAtual.textContent = changes.rotinaAtualNome.newValue || "Nenhuma";
      if (changes.windowStates) lerEstadoDoEscopoSelecionado(changes.windowStates.newValue || {});
    }
  });

  btnToggleRevolver.addEventListener('click', async () => {
    const res = await chrome.storage.local.get(['windowStates', 'playlistIdAtiva']);
    const wStates = res.windowStates || {};
    const ids = getScopeIds();
    const newState = !(wStates[ids[0]]?.revolverAtivo || false);
    ids.forEach(id => {
      if (!wStates[id]) wStates[id] = { autoClickerPaused: false, autoRefreshPaused: false, autoScrollPaused: false };
      wStates[id].revolverAtivo = newState;
      if (newState && res.playlistIdAtiva) wStates[id].playlistIdAtiva = res.playlistIdAtiva;
    });
    await chrome.storage.local.set({ windowStates: wStates });
  });

  btnToggleAutoClicker.addEventListener('click', async () => {
    const res = await chrome.storage.local.get(['windowStates']);
    await atualizarEstadoNoStorage('autoClickerPaused', !(res.windowStates?.[getScopeIds()[0]]?.autoClickerPaused || false));
  });

  btnToggleAutoRefresh.addEventListener('click', async () => {
    const res = await chrome.storage.local.get(['windowStates']);
    await atualizarEstadoNoStorage('autoRefreshPaused', !(res.windowStates?.[getScopeIds()[0]]?.autoRefreshPaused || false));
  });

  btnToggleAutoScroll.addEventListener('click', async () => {
    const res = await chrome.storage.local.get(['windowStates']);
    await atualizarEstadoNoStorage('autoScrollPaused', !(res.windowStates?.[getScopeIds()[0]]?.autoScrollPaused || false));
  });

  btnToggleStatusBar.addEventListener('click', () => {
    chrome.storage.local.get(['statusBarClosed'], res => chrome.storage.local.set({ statusBarClosed: !res.statusBarClosed }));
  });

  btnResetStatusBar.addEventListener('click', () => {
    chrome.storage.local.set({ statusBarPos: 'bottom-center', statusBarCustomX: null, statusBarCustomY: null, statusBarClosed: false });
  });

  btnOpcoes.addEventListener('click', () => chrome.runtime.openOptionsPage());

  const btnGravarTela = document.getElementById('btnGravarTela');
  if (btnGravarTela) {
    btnGravarTela.addEventListener('click', () => {
      chrome.runtime.sendMessage({
        action: 'prepare_recording',
        config: { useMic: false, useWebcam: false, useHighlight: true, micId: null, camId: null }
      }, () => window.close());
    });
  }
});
