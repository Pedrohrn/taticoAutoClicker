document.addEventListener('DOMContentLoaded', () => {
  const btnToggle = document.getElementById('btnToggle');
  const btnOpcoes = document.getElementById('btnOpcoes');
  const textoStatus = document.getElementById('textoStatus');

  // implemento a reatividade unificada de tema e disparo logo no boot
  function aplicarTema(tema) {
    document.documentElement.setAttribute('data-theme', tema);
  }

  chrome.storage.local.get(['theme'], (res) => {
    const temaPadrao = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    aplicarTema(res.theme || temaPadrao);
  });

  document.getElementById('btnToggleTheme').addEventListener('click', () => {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark' ||
      (!document.documentElement.getAttribute('data-theme') && window.matchMedia('(prefers-color-scheme: dark)').matches);
    chrome.storage.local.set({ theme: isDark ? 'light' : 'dark' });
  });

  // gerencio o fluxo de parada e ui do controle de rotatividade global
  function atualizarInterface() {
    chrome.runtime.sendMessage({ action: "obterStatusRevolver" }, (response) => {
      const rodando = response && response.rodando;
      if (rodando) {
        textoStatus.textContent = "Status: Rodando (ON)";
        textoStatus.style.color = "var(--success)";
        btnToggle.textContent = "Pausar Revolver";
        btnToggle.className = "btn btn-danger";
      } else {
        textoStatus.textContent = "Status: Pausado (OFF)";
        textoStatus.style.color = "var(--text-muted)";
        btnToggle.textContent = "Iniciar Revolver";
        btnToggle.className = "btn btn-success";
      }
    });
  }

  // hooko o onchange nativo do chrome para espelhar as acoes em milisegundos
  chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'local') {
      if (changes.theme) {
        aplicarTema(changes.theme.newValue);
      }
      if (changes.revolverAtivo || changes.playlistIdAtiva) {
        atualizarInterface();
      }
    }
  });

  btnToggle.addEventListener('click', () => {
    chrome.runtime.sendMessage({ action: "obterStatusRevolver" }, (response) => {
      const rodando = response && response.rodando;
      const novoEstado = !rodando;
      chrome.storage.local.set({ revolverAtivo: novoEstado }, () => {
        atualizarInterface();
      });
    });
  });

  btnOpcoes.addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
  });

  atualizarInterface();
});
