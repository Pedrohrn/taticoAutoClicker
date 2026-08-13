document.addEventListener('DOMContentLoaded', () => {
  const btnToggleRevolver = document.getElementById('btnToggleRevolver');
  const btnToggleAutoClicker = document.getElementById('btnToggleAutoClicker');
  const btnToggleAutoRefresh = document.getElementById('btnToggleAutoRefresh');
  const btnToggleStatusBar = document.getElementById('btnToggleStatusBar');
  const btnOpcoes = document.getElementById('btnOpcoes');

  const textoStatusRevolver = document.getElementById('textoStatusRevolver');
  const textoRotinaAtual = document.getElementById('textoRotinaAtual');

  function aplicarTema(tema) {
    document.documentElement.setAttribute('data-theme', tema);
  }

  // resolvo o estado inicial
  chrome.storage.local.get(['theme', 'statusBarClosed', 'autoClickerPaused', 'autoRefreshPaused', 'rotinaAtualNome'], (res) => {
    const temaPadrao = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    aplicarTema(res.theme || temaPadrao);
    textoRotinaAtual.textContent = res.rotinaAtualNome || "Nenhuma";
    atualizarUiBotoes(res);
  });

  document.getElementById('btnToggleTheme').addEventListener('click', () => {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark' ||
      (!document.documentElement.getAttribute('data-theme') && window.matchMedia('(prefers-color-scheme: dark)').matches);
    chrome.storage.local.set({ theme: isDark ? 'light' : 'dark' });
  });

  function atualizarUiBotoes(estado) {
    if (estado.autoClickerPaused !== undefined) {
      if (estado.autoClickerPaused) {
        btnToggleAutoClicker.textContent = "Retomar AutoClicker";
        btnToggleAutoClicker.className = "btn btn-success btn-block";
      } else {
        btnToggleAutoClicker.textContent = "Pausar AutoClicker";
        btnToggleAutoClicker.className = "btn btn-secondary btn-block";
      }
    }

    if (estado.autoRefreshPaused !== undefined) {
      if (estado.autoRefreshPaused) {
        btnToggleAutoRefresh.textContent = "Retomar AutoRefresh";
        btnToggleAutoRefresh.className = "btn btn-success btn-block";
      } else {
        btnToggleAutoRefresh.textContent = "Pausar AutoRefresh";
        btnToggleAutoRefresh.className = "btn btn-secondary btn-block";
      }
    }

    if (estado.statusBarClosed !== undefined) {
      if (estado.statusBarClosed) {
        btnToggleStatusBar.textContent = "Exibir Barra de Status UI";
        // refact: uso btn-info para contrastar melhor ao inves de warning
        btnToggleStatusBar.className = "btn btn-info btn-block";
      } else {
        btnToggleStatusBar.textContent = "Ocultar Barra de Status UI";
        btnToggleStatusBar.className = "btn btn-secondary btn-block";
      }
    }
  }

  function atualizarStatusRevolver() {
    chrome.runtime.sendMessage({ action: "obterStatusRevolver" }, (response) => {
      const rodando = response && response.rodando;
      if (rodando) {
        textoStatusRevolver.textContent = "Rodando (ON)";
        textoStatusRevolver.style.color = "var(--success)";
        btnToggleRevolver.textContent = "Pausar Revolver";
        btnToggleRevolver.className = "btn btn-danger btn-block";
      } else {
        textoStatusRevolver.textContent = "Pausado (OFF)";
        textoStatusRevolver.style.color = "var(--text-main)";
        btnToggleRevolver.textContent = "Iniciar Revolver";
        btnToggleRevolver.className = "btn btn-success btn-block";
      }
    });
  }

  chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'local') {
      if (changes.theme) aplicarTema(changes.theme.newValue);
      if (changes.revolverAtivo || changes.playlistIdAtiva) atualizarStatusRevolver();
      if (changes.autoClickerPaused) atualizarUiBotoes({ autoClickerPaused: changes.autoClickerPaused.newValue });
      if (changes.autoRefreshPaused) atualizarUiBotoes({ autoRefreshPaused: changes.autoRefreshPaused.newValue });
      if (changes.statusBarClosed) atualizarUiBotoes({ statusBarClosed: changes.statusBarClosed.newValue });
      if (changes.rotinaAtualNome) textoRotinaAtual.textContent = changes.rotinaAtualNome.newValue || "Nenhuma";
    }
  });

  btnToggleRevolver.addEventListener('click', () => {
    chrome.runtime.sendMessage({ action: "obterStatusRevolver" }, (response) => {
      const rodando = response && response.rodando;
      chrome.storage.local.set({ revolverAtivo: !rodando }, atualizarStatusRevolver);
    });
  });

  btnToggleAutoClicker.addEventListener('click', () => {
    chrome.storage.local.get(['autoClickerPaused'], (res) => {
      chrome.storage.local.set({ autoClickerPaused: !res.autoClickerPaused });
    });
  });

  btnToggleAutoRefresh.addEventListener('click', () => {
    chrome.storage.local.get(['autoRefreshPaused'], (res) => {
      chrome.storage.local.set({ autoRefreshPaused: !res.autoRefreshPaused });
    });
  });

  btnToggleStatusBar.addEventListener('click', () => {
    chrome.storage.local.get(['statusBarClosed'], (res) => {
      chrome.storage.local.set({ statusBarClosed: !res.statusBarClosed });
    });
  });

  btnOpcoes.addEventListener('click', () => chrome.runtime.openOptionsPage());

  atualizarStatusRevolver();
});
